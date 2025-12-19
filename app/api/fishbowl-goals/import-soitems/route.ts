import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Import Fishbowl SOItem (Sales Order Line Items) into Firestore
 * Links line items to sales orders for product mix analysis
 */
async function importSOItems(buffer: Buffer, filename: string): Promise<number> {
  console.log('📥 Importing Fishbowl SOItems (Sales Order Line Items)...');
  
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
  
  console.log(`✅ Found ${data.length} line items to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalImported = 0;
  let skipped = 0;
  let processed = 0;
  const totalRows = data.length;
  
  for (const row of data) {
    processed++;
    
    // Log progress every 1000 rows
    if (processed % 1000 === 0) {
      console.log(`📊 Progress: ${processed} of ${totalRows} (${((processed/totalRows)*100).toFixed(1)}%) - Imported: ${totalImported}, Skipped: ${skipped}`);
    }
    
    // Get SOItem ID and soLineItem (which contains the SO number)
    const soItemId = row['id'];
    const soLineItem = row['soLineItem']; // This is the SO number!
    
    // Skip if no valid ID or SO line item
    if (!soItemId || !soLineItem) {
      skipped++;
      if (skipped <= 3) {
        console.log(`⚠️  Skipping row - missing id or soLineItem. Row:`, row);
      }
      continue;
    }
    
    // Use SOItem ID as document ID
    const docId = String(soItemId).trim();
    const docRef = adminDb.collection('fishbowl_soitems').doc(docId);
    
    // Check if already exists (for resume capability)
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      skipped++;
      continue;
    }
    
    // Create document with ALL fields from CSV
    const soItemData: any = {
      id: soItemId,
      soLineItem: String(soLineItem), // SO number from soLineItem field
      soId: `fb_so_${soLineItem}`, // Reference to fishbowl_sales_orders collection
      
      // Import metadata
      importedAt: Timestamp.now(),
      source: 'fishbowl',
    };
    
    // Add ALL CSV columns as fields (preserving exact field names)
    for (const [key, value] of Object.entries(row)) {
      if (key) {
        soItemData[key] = value || '';
      }
    }
    
    // Add computed/cleaned fields for easier querying
    soItemData.productId = row['productId'] || '';
    soItemData.productNum = row['productNum'] || '';
    soItemData.description = row['description'] || '';
    soItemData.quantity = parseFloat(row['qtyToFullfill'] || row['qtyFullfilled'] || 0);
    soItemData.unitPrice = parseFloat(row['unitPrice'] || 0);
    soItemData.totalPrice = parseFloat(row['totalPrice'] || 0);
    soItemData.totalCost = parseFloat(row['totalCost'] || 0);
    soItemData.markupCost = parseFloat(row['markupCost'] || 0);
    soItemData.taxRate = parseFloat(row['taxRate'] || 0);
    
    // Calculate total if not provided
    if (!soItemData.totalPrice && soItemData.quantity && soItemData.unitPrice) {
      soItemData.totalPrice = soItemData.quantity * soItemData.unitPrice;
    }
    
    batch.set(docRef, soItemData, { merge: true });
    batchCount++;
    
    // Commit in batches of 500
    if (batchCount >= 500) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`💾 Committed batch of ${batchCount} line items (total: ${totalImported})`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`💾 Committed final batch of ${batchCount} line items`);
  }
  
  console.log(`\n✅ IMPORT COMPLETE!`);
  console.log(`   Total imported: ${totalImported}`);
  console.log(`   Skipped (duplicate/invalid): ${skipped}`);
  console.log(`   Success rate: ${((totalImported / data.length) * 100).toFixed(1)}%\n`);
  
  return totalImported;
}

/**
 * Parse CSV data
 */
function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: Record<string, any>[] = [];
  
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${file.name}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const count = await importSOItems(buffer, file.name);
    
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully imported ${count} SOItems`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
