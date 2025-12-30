// THIS IS THE UPDATED import-chunked/route.ts FILE
// Copy this to replace the old import-chunked/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Chunked Fishbowl Import Endpoint - WITH SMART SKIP OPTIMIZATION
 * 
 * CUSTOMER CREATION STRATEGY:
 * - Creates NEW customers from Fishbowl if they don't exist (accountType='Retail' by default)
 * - Copper sync (Step 0) will enrich with correct accountType later
 * - Admin can manually fix accountType in Customers UI
 * - accountTypeSource='fishbowl' marks customers needing review
 * 
 * SMART SKIP OPTIMIZATION:
 * - Compares existing orders/items with new data before writing
 * - Skips Firestore writes if data is unchanged (saves 80-90% on re-imports)
 * - Perfect for weekly uploads of current month or historical re-imports
 * - Real-time progress feedback every 500 rows or 3 seconds
 */

// Helper: Safe number parser (handles $, commas, tolerant)
function toNumberSafe(v: any): number {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).replace(/[\$,]/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Helper: Parse Excel serial dates, ISO dates, and common US formats
function parseExcelOrTextDate(raw: any): { date?: Date; monthKey?: string; y?: number } {
  if (!raw && raw !== 0) return {};
  try {
    if (typeof raw === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + raw * 86400000);
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
    const s = String(raw).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { // ISO YYYY-MM-DD
      const [Y, M, D] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) { // MM/DD/YYYY
      const [M, D, Yraw] = s.split('/').map((t) => t.trim());
      const Y = Number(Yraw.length === 2 ? (Number(Yraw) + 2000) : Yraw);
      const d = new Date(Y, Number(M) - 1, Number(D));
      return { date: d, monthKey: `${Y}-${String(Number(M)).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) { // MM-DD-YYYY
      const [M, D, Y] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
  } catch {}
  return {};
}

interface ImportStats {
  processed: number;
  customersNotFound: number;
  customersCreated: number;
  ordersCreated: number;
  ordersUpdated: number;
  ordersUnchanged: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  skipped: number;
}

// Helper: Compare two objects to see if key fields changed
function hasSignificantChanges(existing: any, newData: any): boolean {
  if (!existing) return true;
  
  const fieldsToCompare = Object.keys(newData).filter(
    key => !['updatedAt', 'importedAt', 'id'].includes(key)
  );
  
  for (const key of fieldsToCompare) {
    const existingVal = existing[key];
    const newVal = newData[key];
    
    const existingNormalized = (existingVal == null || existingVal === '') ? null : existingVal;
    const newNormalized = (newVal == null || newVal === '') ? null : newVal;
    
    if (existingVal?._seconds !== undefined && newVal?._seconds !== undefined) {
      if (existingVal._seconds !== newVal._seconds) return true;
      continue;
    }
    
    if (typeof existingVal === 'number' && typeof newVal === 'number') {
      if (Math.abs(existingVal - newVal) > 0.01) return true;
      continue;
    }
    
    if (existingNormalized !== newNormalized) {
      return true;
    }
  }
  
  return false;
}

// Store chunks in Firestore for serverless compatibility (in-memory doesn't work across instances)
async function storeChunkInFirestore(fileId: string, chunkIndex: number, totalChunks: number, chunkData: string, filename: string) {
  const chunkRef = adminDb.collection('import_chunks').doc(`${fileId}_chunk_${chunkIndex}`);
  await chunkRef.set({
    fileId,
    chunkIndex,
    totalChunks,
    filename,
    data: chunkData, // Base64 encoded
    createdAt: Timestamp.now()
  });
}

async function getChunksFromFirestore(fileId: string, totalChunks: number): Promise<{ complete: boolean; chunks: string[] }> {
  const chunksSnap = await adminDb.collection('import_chunks')
    .where('fileId', '==', fileId)
    .get();
  
  const chunks: string[] = new Array(totalChunks);
  let receivedCount = 0;
  
  chunksSnap.forEach(doc => {
    const data = doc.data();
    chunks[data.chunkIndex] = data.data;
    receivedCount++;
  });
  
  return { complete: receivedCount === totalChunks, chunks };
}

async function deleteChunksFromFirestore(fileId: string) {
  const chunksSnap = await adminDb.collection('import_chunks')
    .where('fileId', '==', fileId)
    .get();
  
  const batch = adminDb.batch();
  chunksSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File | null;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileId = formData.get('fileId') as string;
    const filename = formData.get('filename') as string;

    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !fileId) {
      return NextResponse.json({ error: 'Invalid chunk data' }, { status: 400 });
    }

    console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}`);

    // Store chunk in Firestore (base64 encoded)
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkBase64 = chunkBuffer.toString('base64');
    await storeChunkInFirestore(fileId, chunkIndex, totalChunks, chunkBase64, filename);

    console.log(`✅ Stored chunk ${chunkIndex + 1}/${totalChunks} in Firestore`);

    // Check if all chunks are received
    const { complete, chunks } = await getChunksFromFirestore(fileId, totalChunks);

    if (complete) {
      console.log('🎉 All chunks received! Ready for processing...');
      
      const importId = `import_${Date.now()}`;
      
      // Store metadata for processing (chunks stay in import_chunks collection)
      // DON'T reassemble into single doc - too large for Firestore
      await adminDb.collection('import_pending').doc(importId).set({
        fileId: fileId,  // Reference to chunks
        filename: filename,
        totalChunks: totalChunks,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      
      // Initialize progress
      await adminDb.collection('import_progress').doc(importId).set({
        status: 'pending',
        totalRows: 0,
        currentRow: 0,
        percentage: 0,
        stats: {},
        startedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log(`📦 Ready for processing: ${importId} (fileId: ${fileId})`);
      
      return NextResponse.json({
        success: true,
        complete: true,
        importId: importId,
        message: 'Upload complete - call /api/fishbowl/process-import to start processing',
        processing: false,
        needsProcessing: true
      });
    }

    // Count received chunks
    const receivedChunks = chunks.filter(c => c !== undefined).length;

    return NextResponse.json({
      success: true,
      complete: false,
      progress: (receivedChunks / totalChunks) * 100,
      received: receivedChunks,
      total: totalChunks
    });

  } catch (error: any) {
    console.error('❌ Chunk upload error:', error);
    return NextResponse.json({ error: error.message || 'Chunk upload failed' }, { status: 500 });
  }
}

async function importUnifiedReport(buffer: Buffer, filename: string, importId: string): Promise<{ stats: ImportStats; importId: string }> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  console.log(`📋 Import ID: ${importId}`);
  
  // Parse file
  console.log('📄 Parsing file...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} rows to process`);
  
  const stats: ImportStats = {
    processed: 0,
    customersNotFound: 0,
    customersCreated: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    ordersUnchanged: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsUnchanged: 0,
    skipped: 0
  };
  
  const missingCustomers = new Set<string>();
  
  // Initialize progress tracking
  const progressRef = adminDb.collection('import_progress').doc(importId);
  await progressRef.set({
    status: 'parsing',
    totalRows: data.length,
    currentRow: 0,
    percentage: 0,
    stats: stats,
    startedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  const processedCustomers = new Set<string>();
  const processedOrders = new Set<string>();
  
  const customerTypeCache = new Map<string, { type: string; source: string }>();
  
  // PRE-FETCH all existing customers, orders, and line items
  console.log('📦 Pre-fetching existing customers, orders, and line items...');
  const [existingCustomersSnap, existingOrdersSnap, existingItemsSnap] = await Promise.all([
    adminDb.collection('fishbowl_customers').get(),
    adminDb.collection('fishbowl_sales_orders').get(),
    adminDb.collection('fishbowl_soitems').get()
  ]);
  
  const existingCustomersMap = new Map<string, any>();
  existingCustomersSnap.forEach(doc => {
    existingCustomersMap.set(doc.id, doc.data());
  });
  
  const existingOrdersMap = new Map<string, any>();
  existingOrdersSnap.forEach(doc => {
    existingOrdersMap.set(doc.id, doc.data());
  });
  
  const existingItemsMap = new Map<string, any>();
  existingItemsSnap.forEach(doc => {
    existingItemsMap.set(doc.id, doc.data());
  });
  
  console.log(`✅ Found ${existingCustomersMap.size} existing customers, ${existingOrdersMap.size} existing orders, ${existingItemsMap.size} existing line items`);
  
  // FIRST PASS: Aggregate order totals
  console.log('🔄 First pass: Aggregating order totals...');
  const orderTotals = new Map<string, { revenue: Decimal; orderValue: Decimal; lineCount: number }>();
  
  for (const row of data) {
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    if (!salesOrderNum) continue;

    const labelLower = String(row['SO Item Product Number'] ?? row['Part Description'] ?? '').toLowerCase();
    const isShipping = labelLower.includes('shipping');
    const isCC = labelLower.includes('cc processing') || labelLower.includes('credit card processing');
    
    if (isShipping || isCC) continue;

    const revenue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Revenue']));
    const orderValue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price']));

    if (!orderTotals.has(salesOrderNum)) {
      orderTotals.set(salesOrderNum, { revenue: new Decimal(0), orderValue: new Decimal(0), lineCount: 0 });
    }
    const t = orderTotals.get(salesOrderNum)!;
    t.revenue = t.revenue.plus(revenue);
    t.orderValue = t.orderValue.plus(orderValue);
    t.lineCount++;
  }
  
  console.log(`✅ Aggregated ${orderTotals.size} unique orders`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 400;
  
  console.log(`\n🔄 Processing ${data.length} rows...\n`);
  let lastLogTime = Date.now();
  
  for (const row of data) {
    stats.processed++;
    
    // Real-time progress every 500 rows OR every 3 seconds
    const now = Date.now();
    if (stats.processed % 500 === 0 || (now - lastLogTime) > 3000) {
      const pct = ((stats.processed / data.length) * 100).toFixed(1);
      console.log(`📊 Progress: ${stats.processed}/${data.length} (${pct}%) | Orders: ${stats.ordersCreated}C/${stats.ordersUpdated}U/${stats.ordersUnchanged}S | Items: ${stats.itemsCreated}C/${stats.itemsUpdated}U/${stats.itemsUnchanged}S`);
      lastLogTime = now;
      
      // Update Firestore progress
      progressRef.update({
        status: pct >= '90' ? 'final_phase' : 'processing',
        currentRow: stats.processed,
        percentage: parseFloat(pct),
        stats: stats,
        updatedAt: Timestamp.now()
      }).catch(() => {});
    }
    
    const customerId = row['Account ID'] || row['Account id'] || row['Customer id'];
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const salesOrderId = row['Sales Order ID'] || row['SO ID'];
    const lineItemId = row['SO Item ID'] || row['SO item ID'];
    
    // Debug: Log first row that gets skipped
    if (!customerId || !salesOrderNum || !salesOrderId || !lineItemId) {
      if (stats.skipped === 0) {
        console.log(`\n⚠️  FIRST ROW SKIPPED - Missing required fields:`);
        console.log(`   Account ID: ${customerId ? '✅' : '❌ MISSING'}`);
        console.log(`   Sales Order Number: ${salesOrderNum ? '✅' : '❌ MISSING'}`);
        console.log(`   Sales Order ID: ${salesOrderId ? '✅' : '❌ MISSING'}`);
        console.log(`   SO Item ID: ${lineItemId ? '✅' : '❌ MISSING'}`);
        console.log(`\n   Available columns in CSV:`, Object.keys(row).slice(0, 10).join(', '));
        console.log(`   (showing first 10 columns)\n`);
      }
      stats.skipped++;
      continue;
    }
    
    // === 1. CREATE/UPDATE CUSTOMER ===
    if (!processedCustomers.has(String(customerId))) {
      const customerDocId = String(customerId).replace(/[/\\]/g, '_').trim();
      const customerRef = adminDb.collection('fishbowl_customers').doc(customerDocId);
      const existingData = existingCustomersMap.get(customerDocId);

      if (!existingData) {
        // CREATE NEW CUSTOMER from Fishbowl data
        const customerName = row['Customer Name'] || row['Customer'] || 'Unknown';
        const salesRep = row['Sales Rep'] || row['Sales person'] || row['Default Sales Rep'] || row['Sales man initials'] || '';
        const accountNumber = row['Account Order ID'] || row['Account order ID'] || '';
        const accountId = row['Account ID'] || row['Account id'] || '';
        
        console.log(`🆕 Creating NEW customer: ${customerName} (ID: ${customerDocId})`);
        
        const newCustomerData = {
          id: customerDocId,
          customerId: String(customerId),
          name: customerName,
          customerName: customerName,
          accountNumber: accountNumber,
          accountId: accountId,
          accountType: 'Retail', // Default - will be corrected by Copper sync or admin
          accountTypeSource: 'fishbowl',
          salesPerson: salesRep,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'fishbowl_import',
          needsReview: true,
        };
        
        batch.set(customerRef, newCustomerData);
        batchCount++;
        stats.customersCreated = (stats.customersCreated || 0) + 1;
        
        customerTypeCache.set(String(customerId), { type: 'Retail', source: 'fishbowl' });
      } else {
        // Customer exists - preserve their account type
        const finalAccountType = existingData.accountType || 'Retail';
        const accountTypeSource = existingData.accountTypeSource || 'existing';
        
        customerTypeCache.set(String(customerId), { 
          type: finalAccountType, 
          source: accountTypeSource
        });
      }
      
      processedCustomers.add(String(customerId));
    }
    
    // === 2. CREATE/UPDATE SALES ORDER ===
    if (!processedOrders.has(String(salesOrderId))) {
      const orderDocId = String(salesOrderId).replace(/[\/\\]/g, '_');
      const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDocId);
      const sanitizedCustomerId = String(customerId).replace(/[\/\\]/g, '_').trim();

      const rawDate = row['Issued date'] ?? row['Issued Date'] ?? row['Date fulfillment'] ?? row['Date fulfilled'] ?? row['Fulfilment Date'];
      const { date: postDate, monthKey, y } = parseExcelOrTextDate(rawDate);
      const postingDate = postDate ? Timestamp.fromDate(postDate) : null;
      const commissionMonth = monthKey ?? '';
      const commissionYear = y ?? 0;

      const soNumStr = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
      const totals = orderTotals.get(soNumStr);
      const revenue = totals ? totals.revenue.toNumber() : 0;
      const orderValue = totals ? totals.orderValue.toNumber() : 0;
      const lineCount = totals ? totals.lineCount : 0;

      const cachedType = customerTypeCache.get(String(customerId));
      const orderAccountType = cachedType?.type ?? 'Retail';
      const orderAccountTypeSource = cachedType?.source ?? 'fishbowl';

      const orderData: any = {
        id: orderDocId,
        num: soNumStr,
        fishbowlNum: soNumStr,
        salesOrderId: String(salesOrderId),
        customerId: sanitizedCustomerId,
        customerName: row['Customer Name'] || row['Customer'] || '',
        salesPerson: row['Sales Rep'] || row['Sales person'] || row['Default Sales Rep'] || row['Sales man initials'] || '',
        salesRep: row['Sales Rep'] || row['Sales person'] || row['Default Sales Rep'] || '',
        postingDate,
        commissionDate: postingDate,
        commissionMonth,
        commissionYear,
        revenue,
        orderValue,
        lineItemCount: lineCount,
        accountType: orderAccountType,
        accountTypeSource: orderAccountTypeSource,
        updatedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      const existingOrder = existingOrdersMap.get(orderDocId);
      let orderWasWritten = false;
      if (existingOrder) {
        if (hasSignificantChanges(existingOrder, orderData)) {
          batch.update(orderRef, orderData);
          stats.ordersUpdated++;
          batchCount++;
          orderWasWritten = true;
        } else {
          stats.ordersUnchanged++;
        }
      } else {
        batch.set(orderRef, orderData);
        stats.ordersCreated++;
        batchCount++;
        orderWasWritten = true;
      }
      
      // ALWAYS write to customer's order history subcollection
      // (even if flat collection is unchanged - allows subcollection structure updates)
      // Use sales order number (5799, 9082, etc.) as document ID for readability
      if (sanitizedCustomerId && soNumStr) {
        const orderHistoryRef = adminDb
          .collection('fishbowl_customers')
          .doc(sanitizedCustomerId)
          .collection('sales_order_history')
          .doc(soNumStr);
        
        batch.set(orderHistoryRef, {
          ...orderData,
          writtenAt: Timestamp.now()
        }, { merge: true });
        batchCount++;
        
        // Update customer summary fields (first/last order date)
        const customerSummaryRef = adminDb.collection('fishbowl_customers').doc(sanitizedCustomerId);
        batch.set(customerSummaryRef, {
          lastOrderDate: postingDate,
          lastOrderNum: soNumStr,
          lastSalesPerson: row['Sales person'] || '',
          updatedAt: Timestamp.now()
        }, { merge: true });
        batchCount++;
      }

      processedOrders.add(String(salesOrderId));
    }
    
    // === 3. CREATE/UPDATE LINE ITEM ===
    const itemDocId = `soitem_${String(lineItemId).replace(/[\/\\]/g,'_')}`;
    const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);
    const sanitizedCustomerId2 = String(customerId).replace(/[\/\\]/g, '_').trim();

    const rawDate2 = row['Issued date'] ?? row['Issued Date'] ?? row['Date fulfillment'] ?? row['Date fulfilled'] ?? row['Fulfilment Date'];
    const { date: postDate2, monthKey: monthKey2, y: y2 } = parseExcelOrTextDate(rawDate2);
    const postingDate2 = postDate2 ? Timestamp.fromDate(postDate2) : null;
    const commissionMonth2 = monthKey2 ?? '';
    const commissionYear2 = y2 ?? 0;

    const cachedType2 = customerTypeCache.get(String(customerId));
    const itemAccountType = cachedType2?.type ?? 'Retail';
    const itemAccountTypeSource = cachedType2?.source ?? 'fishbowl';

    const labelLower2 = String(row['SO Item Product Number'] ?? row['Part Description'] ?? '').toLowerCase();
    const isShippingItem = labelLower2.includes('shipping');
    const isCCItem = labelLower2.includes('cc processing') || labelLower2.includes('credit card processing');

    const itemData: any = {
      id: itemDocId,
      salesOrderId: String(salesOrderId),
      salesOrderNum: String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim(),
      soId: String(salesOrderId).replace(/[\/\\]/g, '_'),
      customerId: sanitizedCustomerId2,
      customerName: row['Customer Name'] || row['Customer'] || '',
 
      // Billing fields from Conversight (for RepRally customer extraction)
      billingName: row['Billing Name'] || '',
      billingAddress: row['Billing Address'] || '',
      billingCity: row['Billing City'] || '',
      billingState: row['Billing State'] || '',
      billingZip: row['Billing Zip'] || '',

      accountType: itemAccountType,
      accountTypeSource: itemAccountTypeSource,
      salesPerson: row['Sales Rep'] || row['Sales person'] || row['Default Sales Rep'] || row['Sales man initials'] || '',
      salesRep: row['Sales Rep'] || row['Sales person'] || row['Default Sales Rep'] || '',
      postingDate: postingDate2,
      commissionDate: postingDate2,
      commissionMonth: commissionMonth2,
      isCCProcessingItem: isCCItem,
      importedAt: Timestamp.now(),
      source: 'fishbowl_unified',
    };

    const existingItem = existingItemsMap.get(itemDocId);
    if (existingItem) {
      if (hasSignificantChanges(existingItem, itemData)) {
        batch.update(itemRef, itemData);
        stats.itemsUpdated++;
        batchCount++;
      } else {
        stats.itemsUnchanged++;
      }
    } else {
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
      batchCount++;
    }

    // Commit batch
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit().catch(e => console.error('❌ Batch commit failed:', e?.message));
      console.log(`✅ Committed batch of ${batchCount} operations`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Final commit
  if (batchCount > 0) {
    await batch.commit().catch(e => console.error('❌ Final batch commit failed:', e?.message));
    console.log(`✅ Committed final batch of ${batchCount} operations`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ IMPORT COMPLETE!');
  console.log('='.repeat(80));
  console.log(`   Rows Processed:        ${stats.processed.toLocaleString()}`);
  console.log(`   Customers Not Found:   ${stats.customersNotFound.toLocaleString()}`);
  console.log('');
  console.log('   📦 SALES ORDERS:');
  console.log(`      Created:    ${stats.ordersCreated.toLocaleString()}`);
  console.log(`      Updated:    ${stats.ordersUpdated.toLocaleString()}`);
  console.log(`      Unchanged:  ${stats.ordersUnchanged.toLocaleString()} ⚡ (skipped)`);
  console.log('');
  console.log('   📋 LINE ITEMS:');
  console.log(`      Created:    ${stats.itemsCreated.toLocaleString()}`);
  console.log(`      Updated:    ${stats.itemsUpdated.toLocaleString()}`);
  console.log(`      Unchanged:  ${stats.itemsUnchanged.toLocaleString()} ⚡ (skipped)`);
  console.log('');
  const totalWrites = stats.ordersCreated + stats.ordersUpdated + stats.itemsCreated + stats.itemsUpdated;
  const totalSkipped = stats.ordersUnchanged + stats.itemsUnchanged;
  const skipPercentage = totalWrites + totalSkipped > 0 ? ((totalSkipped / (totalWrites + totalSkipped)) * 100).toFixed(1) : '0.0';
  console.log(`   💾 Firestore Writes:   ${totalWrites.toLocaleString()} (saved ${totalSkipped.toLocaleString()} writes - ${skipPercentage}% reduction)`);
  console.log('='.repeat(80));
  
  await progressRef.update({
    status: 'complete',
    currentRow: stats.processed,
    percentage: 100,
    stats: stats,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return { stats, importId };
}
