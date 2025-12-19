import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Parse CSV data
 * Column DI (index 112) contains the Copper Company ID
 */
function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: Record<string, any>[] = [];
  
  console.log(`📋 CSV Headers: ${headers.length} columns`);
  console.log(`📍 Column DI (Copper ID) is at index: ${headers.length - 1}`);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, any> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    // Add Copper ID from last column (Column DI)
    row['_copperId'] = values[values.length - 1] || '';
    
    data.push(row);
  }
  
  return data;
}

/**
 * Import Copper companies into Firestore
 * Supports both Excel and CSV files
 */
async function importCompanies(buffer: Buffer, filename: string): Promise<number> {
  console.log('📥 Importing Copper companies...');
  
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
  
  console.log(`✅ Found ${data.length} companies to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalImported = 0;
  let skipped = 0;
  let processed = 0;
  const totalRows = data.length;
  
  for (const row of data) {
    processed++;
    
    // Log progress every 100 rows
    if (processed % 100 === 0) {
      console.log(`📊 Progress: ${processed} of ${totalRows} (${((processed/totalRows)*100).toFixed(1)}%) - Imported: ${totalImported}, Skipped: ${skipped}`);
    }
    // Get Copper ID directly from the "Copper ID" column
    const copperCompanyId = row['Copper ID'];
    
    // Skip if no valid ID
    if (!copperCompanyId || String(copperCompanyId).trim() === '') {
      skipped++;
      if (skipped <= 5) {
        console.log(`⚠️  Skipping row without Copper ID`);
      }
      continue;
    }
    
    // Use the Copper ID as the document ID
    // Clean it: remove slashes, spaces, and invalid characters
    const docId = String(copperCompanyId)
      .trim()
      .replace(/\//g, '_')  // Replace slashes with underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9_-]/g, ''); // Remove other invalid chars
    
    // Final validation - must not be empty after cleaning
    if (!docId || docId === '') {
      skipped++;
      console.log(`⚠️  Skipping row with invalid Copper ID after cleaning: "${copperCompanyId}"`);
      continue;
    }
    
    const docRef = adminDb.collection('copper_companies').doc(docId);
    
    // Smart delta import: Check if needs update
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      const csvUpdatedAt = row['Updated At'] || '';
      const firestoreUpdatedAt = existingData?.['Updated At'] || '';
      
      // Skip if CSV data is not newer
      if (csvUpdatedAt && firestoreUpdatedAt && csvUpdatedAt <= firestoreUpdatedAt) {
        skipped++;
        if (skipped <= 5) {
          console.log(`⏭️  Skipping unchanged: ${docId} (last updated: ${firestoreUpdatedAt})`);
        }
        continue;
      }
      
      // If CSV is newer or no timestamp, update it
      if (skipped <= 5 && csvUpdatedAt > firestoreUpdatedAt) {
        console.log(`🔄 Updating changed record: ${docId} (${firestoreUpdatedAt} → ${csvUpdatedAt})`);
      }
    }
    
    // Create document with ALL fields from CSV (even if blank)
    // This ensures schema is ready for future data
    const companyData: any = {
      id: Number(copperCompanyId),
      
      // Import metadata
      importedAt: Timestamp.now(),
      source: 'copper_export',
      copperUrl: row['Copper URL'] || Object.values(row).pop() || ''
    };
    
    // Add ALL CSV columns as fields (preserving exact column names)
    // This ensures we capture everything, even blank fields
    for (const [key, value] of Object.entries(row)) {
      if (key && key !== 'Copper URL') { // Skip URL since we already added it
        // Store with original column name
        companyData[key] = value || '';
      }
    }
    
    // Add some computed/cleaned fields for easier querying
    companyData.name = row['Name'] || '';
    companyData.email = row['Email'] || '';
    companyData.phone = row['Phone Number'] || '';
    companyData.street = row['Street'] || '';
    companyData.city = row['City'] || '';
    companyData.state = row['State'] || '';
    companyData.postalCode = row['Postal Code'] || '';
    companyData.country = row['Country'] || '';
    companyData.ownedBy = row['Owned By'] || '';
    companyData.tags = row['Tags'] || '';
    
    // Important custom fields for matching
    companyData.accountNumber = row['Account Number cf_698260'] || '';
    companyData.accountOrderId = row['Account Order ID cf_698467'] || '';
    companyData.accountType = row['Account Type cf_675914'] || '';
    companyData.region = row['Region cf_680701'] || '';
    companyData.segment = row['Segment cf_698149'] || '';
    
    batch.set(docRef, companyData, { merge: true });
    batchCount++;
    
    // Smaller batch size due to large documents (114 fields per doc)
    // Firestore limit: 10MB per batch
    if (batchCount >= 100) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`💾 Committed batch of ${batchCount} companies (total: ${totalImported})`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`💾 Committed final batch of ${batchCount} companies`);
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
    const companiesFile = formData.get('companiesFile') as File | null;
    
    if (!companiesFile) {
      return NextResponse.json(
        { error: 'No companies file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${companiesFile.name}`);
    
    const buffer = Buffer.from(await companiesFile.arrayBuffer());
    const count = await importCompanies(buffer, companiesFile.name);
    
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count} Copper companies`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
