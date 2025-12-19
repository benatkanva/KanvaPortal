import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Parse CSV data
 */
function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: Record<string, any>[] = [];
  
  console.log(`📋 CSV Headers: ${headers.length} columns`);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, any> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    data.push(row);
  }
  
  return data;
}

/**
 * Import Copper leads into Firestore
 */
async function importLeads(buffer: Buffer, filename: string): Promise<number> {
  console.log('📥 Importing Copper leads...');
  
  let data: Record<string, any>[];
  
  // Check if CSV or Excel
  if (filename.toLowerCase().endsWith('.csv')) {
    console.log('📄 Parsing CSV file...');
    const text = buffer.toString('utf-8');
    data = parseCSV(text);
    console.log(`✅ CSV parsed: ${data.length} rows`);
  } else {
    console.log('📊 Parsing Excel file...');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
    console.log(`✅ Excel parsed: ${data.length} rows`);
  }
  
  console.log(`✅ Found ${data.length} leads to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalImported = 0;
  let skipped = 0;
  
  for (const row of data) {
    // Get Copper ID directly from the "Copper ID" column
    const copperLeadId = row['Copper ID'];
    
    // Skip if no valid ID
    if (!copperLeadId || String(copperLeadId).trim() === '') {
      skipped++;
      continue;
    }
    
    // Use the Copper ID as the document ID (ensure it's valid)
    const docId = String(copperLeadId).trim();
    
    // Skip if docId is still empty after trimming or contains invalid characters
    if (!docId || docId === '' || docId.includes('/')) {
      skipped++;
      if (skipped <= 5) {
        console.log(`⚠️  Skipping invalid ID: "${docId}" (original: "${copperLeadId}")`);
      }
      continue;
    }
    
    const docRef = adminDb.collection('copper_leads').doc(docId);
    
    // Create document with ALL fields from CSV
    const leadData: any = {
      id: Number(copperLeadId),
      
      // Import metadata
      importedAt: Timestamp.now(),
      source: 'copper_export',
      copperUrl: row['Copper URL'] || ''
    };
    
    // Add ALL CSV columns as fields
    for (const [key, value] of Object.entries(row)) {
      if (key && key !== 'Copper URL') {
        leadData[key] = value || '';
      }
    }
    
    // Add computed fields for easier querying
    leadData.firstName = row['First Name'] || '';
    leadData.lastName = row['Last Name'] || '';
    leadData.name = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
    leadData.email = row['Email'] || '';
    leadData.phone = row['Phone Number'] || '';
    leadData.company = row['Company'] || '';
    leadData.status = row['Status'] || '';
    
    batch.set(docRef, leadData, { merge: true });
    batchCount++;
    
    // Smaller batch size for large documents
    if (batchCount >= 100) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`💾 Committed batch of ${batchCount} leads (total: ${totalImported})`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`💾 Committed final batch of ${batchCount} leads`);
  }
  
  console.log(`\n✅ IMPORT COMPLETE!`);
  console.log(`   Total imported: ${totalImported}`);
  console.log(`   Skipped (no ID): ${skipped}`);
  console.log(`   Success rate: ${((totalImported / data.length) * 100).toFixed(1)}%\n`);
  
  return totalImported;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const leadsFile = formData.get('leadsFile') as File | null;
    
    if (!leadsFile) {
      return NextResponse.json(
        { error: 'No leads file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${leadsFile.name}`);
    
    const buffer = Buffer.from(await leadsFile.arrayBuffer());
    const count = await importLeads(buffer, leadsFile.name);
    
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count} Copper leads`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
