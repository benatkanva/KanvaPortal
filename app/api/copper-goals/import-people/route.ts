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
    
    // Add Person ID from last column
    row['_copperId'] = values[values.length - 1] || '';
    
    data.push(row);
  }
  
  return data;
}

/**
 * Import Copper people/contacts into Firestore
 */
async function importPeople(buffer: Buffer, filename: string): Promise<number> {
  console.log('📥 Importing Copper people...');
  
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
  
  console.log(`✅ Found ${data.length} people to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalImported = 0;
  let skipped = 0;
  
  for (const row of data) {
    // Get Copper ID directly from the "Copper ID" column
    const copperPersonId = row['Copper ID'];
    
    // Skip if no valid ID
    if (!copperPersonId || String(copperPersonId).trim() === '') {
      skipped++;
      continue;
    }
    
    // Use the Copper ID as the document ID
    const docId = String(copperPersonId).trim();
    
    const docRef = adminDb.collection('copper_people').doc(docId);
    
    // Create document with ALL fields from CSV
    const personData: any = {
      id: Number(copperPersonId),
      
      // Import metadata
      importedAt: Timestamp.now(),
      source: 'copper_export',
      copperUrl: row['Copper URL'] || Object.values(row).pop() || ''
    };
    
    // Add ALL CSV columns as fields
    for (const [key, value] of Object.entries(row)) {
      if (key && key !== 'Copper URL') {
        personData[key] = value || '';
      }
    }
    
    // Add computed fields for easier querying
    personData.firstName = row['First Name'] || '';
    personData.lastName = row['Last Name'] || '';
    personData.name = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
    personData.email = row['Email'] || '';
    personData.phone = row['Phone Number'] || '';
    personData.title = row['Title'] || '';
    personData.company = row['Company'] || '';
    personData.companyName = row['Company Name'] || '';
    
    // Link to company if available
    const companyId = row['Company'] || row['Company ID'] || '';
    if (companyId) {
      personData.companyId = String(companyId);
    }
    
    batch.set(docRef, personData, { merge: true });
    batchCount++;
    
    // Smaller batch size for large documents
    if (batchCount >= 100) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`💾 Committed batch of ${batchCount} people (total: ${totalImported})`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`💾 Committed final batch of ${batchCount} people`);
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
    const peopleFile = formData.get('peopleFile') as File | null;
    
    if (!peopleFile) {
      return NextResponse.json(
        { error: 'No people file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${peopleFile.name}`);
    
    const buffer = Buffer.from(await peopleFile.arrayBuffer());
    const count = await importPeople(buffer, peopleFile.name);
    
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count} Copper people`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
