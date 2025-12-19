import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Streaming import with real-time progress updates
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'No file provided' })}\n\n`));
          controller.close();
          return;
        }

        // Send initial message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'parsing', message: 'Parsing file...' })}\n\n`));

        // Parse file
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

        const totalRows = data.length;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'starting', total: totalRows, message: `Found ${totalRows} rows` })}\n\n`));

        let batch = adminDb.batch();
        let batchCount = 0;
        let totalImported = 0;
        let totalUpdated = 0;
        let skipped = 0;
        let processed = 0;
        const BATCH_SIZE = 1000; // Increased from 500 for speed

        for (const row of data) {
          processed++;

          // Send progress update every 5000 rows (less frequent for speed)
          if (processed % 5000 === 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              status: 'processing',
              processed,
              total: totalRows,
              imported: totalImported,
              updated: totalUpdated,
              skipped,
              percent: ((processed / totalRows) * 100).toFixed(1)
            })}\n\n`));
          }

          const copperCompanyId = row['Copper ID'];
          
          if (!copperCompanyId || String(copperCompanyId).trim() === '') {
            skipped++;
            continue;
          }

          const docId = String(copperCompanyId)
            .trim()
            .replace(/\//g, '_')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_-]/g, '');

          if (!docId || docId === '') {
            skipped++;
            continue;
          }

          const docRef = adminDb.collection('copper_companies').doc(docId);
          
          // SPEED OPTIMIZATION: Skip duplicate check on fresh import
          // Assumes collection is empty or you want to overwrite
          
          // Create/update document
          const now = Timestamp.now();
          const companyData: any = {
            id: Number(copperCompanyId),
            importedAt: now,
            updatedAt: now, // Add this for stats tracking
            source: 'copper_export',
            copperUrl: row['Copper URL'] || ''
          };

          for (const [key, value] of Object.entries(row)) {
            if (key && key !== 'Copper URL') {
              companyData[key] = value || '';
            }
          }

          companyData.name = row['Name'] || '';
          companyData.email = row['Email'] || '';
          companyData.phone = row['Phone Number'] || '';
          companyData.street = row['Street'] || '';
          companyData.city = row['City'] || '';
          companyData.state = row['State'] || '';
          companyData.zip = row['Postal Code'] || '';
          companyData.country = row['Country'] || '';

          batch.set(docRef, companyData);
          batchCount++;
          totalImported++;

          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              status: 'batch_committed',
              processed,
              total: totalRows,
              imported: totalImported,
              updated: totalUpdated,
              skipped
            })}\n\n`));
            batch = adminDb.batch();
            batchCount = 0;
          }
        }

        // Commit remaining
        if (batchCount > 0) {
          await batch.commit();
        }

        // Send completion message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          status: 'complete',
          processed: totalRows,
          imported: totalImported,
          updated: totalUpdated,
          skipped,
          message: `Import complete! Imported: ${totalImported}, Updated: ${totalUpdated}, Skipped: ${skipped}`
        })}\n\n`));

        controller.close();

      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
