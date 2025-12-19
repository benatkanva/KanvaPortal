import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large imports

/**
 * Fishbowl Import Endpoint
 * 
 * Reads Fishbowl Excel files and imports data into Firestore
 * 
 * POST /api/fishbowl/import
 * Body: { type: 'customers' | 'sales_orders' | 'both' }
 */

interface ImportStats {
  customersProcessed: number;
  customersCreated: number;
  customersUpdated: number;
  ordersProcessed: number;
  ordersCreated: number;
  ordersUpdated: number;
  errors: Array<{ recordId: string; error: string }>;
}

/**
 * Parse date from various formats
 */
function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  
  if (value instanceof Date) return value;
  
  // Handle Excel date numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date;
  }
  
  // Handle string dates
  if (typeof value === 'string') {
    // Skip time-only values like "37:46.7" or "09:52.0"
    if (/^\d{1,2}:\d{2}\.\d$/.test(value.trim())) {
      console.warn(`Skipping time-only value: ${value}`);
      return undefined;
    }
    
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return undefined;
}

/**
 * Parse boolean from various formats
 */
function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === 'yes' || lower === '1';
  }
  return false;
}

/**
 * Parse number safely
 */
function parseNumber(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Import Fishbowl Customers
 */
async function importCustomers(buffer: Buffer, stats: ImportStats): Promise<void> {
  console.log('📥 Importing customers...');
  
  // Read Excel file from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} customers to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const row of data) {
    try {
      const originalId = String(row.id || '').trim();
      if (!originalId) {
        stats.errors.push({ recordId: 'unknown', error: 'Missing customer ID' });
        continue;
      }
      
      stats.customersProcessed++;
      
      // Create composite key with prefix
      const compositeId = `fb_cust_${originalId}`;
      
      // Reference to document with composite ID
      const docRef = adminDb.collection('fishbowl_customers').doc(compositeId);
      
      // Check if document already exists
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      
      // Build customer document with ALL fields from Excel (like Copper import)
      const customerData: Record<string, any> = {
        id: compositeId,
        fishbowlId: originalId,  // Store original Fishbowl ID
        
        // Sync tracking
        syncStatus: 'pending' as const,
        
        // Metadata
        updatedAt: Timestamp.now(),
        source: 'fishbowl' as const,
      };
      
      // Add ALL fields from the Excel row
      for (const [key, value] of Object.entries(row)) {
        if (key && value !== null && value !== undefined && String(value).trim() !== '') {
          // Handle dates
          if (key.toLowerCase().includes('date')) {
            const parsedDate = parseDate(value);
            if (parsedDate) {
              customerData[key] = Timestamp.fromDate(parsedDate);
              continue;
            }
          }
          
          // Handle booleans
          if (key.toLowerCase().includes('flag') || 
              key.toLowerCase().includes('active') ||
              key.toLowerCase().includes('exempt') ||
              key.toLowerCase().includes('emailed') ||
              key.toLowerCase().includes('printed')) {
            customerData[key] = parseBoolean(value);
            continue;
          }
          
          // Handle numbers
          if (typeof value === 'number') {
            customerData[key] = value;
            continue;
          }
          
          // Default: store as string
          customerData[key] = String(value);
        }
      }
      
      // Check if data actually changed
      let hasChanges = false;
      if (existingData) {
        // Compare new data with existing (excluding metadata fields)
        for (const [key, value] of Object.entries(customerData)) {
          if (key !== 'updatedAt' && key !== 'syncStatus') {
            if (JSON.stringify(existingData[key]) !== JSON.stringify(value)) {
              hasChanges = true;
              break;
            }
          }
        }
      }
      
      // Track stats
      if (!existingData) {
        stats.customersCreated++;
      } else if (hasChanges) {
        stats.customersUpdated++;
      }
      // If no changes, don't count as updated
      
      // Only write if new or changed
      if (!existingData || hasChanges) {
        batch.set(docRef, {
          ...customerData,
          createdAt: existingData?.createdAt || Timestamp.now(),
        }, { merge: true });
        
        batchCount++;
      }
      
      // Commit batch if we hit the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`💾 Committed batch of ${batchCount} customers`);
        batch = adminDb.batch(); // Create new batch
        batchCount = 0;
      }
      
    } catch (error: any) {
      stats.errors.push({
        recordId: String(row.id || 'unknown'),
        error: error.message,
      });
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Committed final batch of ${batchCount} customers`);
  }
}

/**
 * Import Fishbowl Sales Orders
 */
async function importSalesOrders(buffer: Buffer, stats: ImportStats): Promise<void> {
  console.log('📥 Importing sales orders...');
  
  // Read Excel file from buffer
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} sales orders to import`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const row of data) {
    try {
      const originalNum = String(row.num || row.id || '').trim();
      if (!originalNum) {
        stats.errors.push({ recordId: 'unknown', error: 'Missing SO number' });
        continue;
      }
      
      stats.ordersProcessed++;
      
      // Create composite key with prefix
      const compositeId = `fb_so_${originalNum}`;
      
      // Reference to document with composite ID
      const docRef = adminDb.collection('fishbowl_sales_orders').doc(compositeId);
      
      // Check if document already exists
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      
      // Build sales order document with ALL fields from Excel (like Copper/Customers import)
      const orderData: Record<string, any> = {
        id: compositeId,
        fishbowlNum: originalNum,  // Store original SO number
        num: originalNum,  // Keep for compatibility
        
        // Sync tracking
        syncStatus: 'pending' as const,
        
        // Metadata
        updatedAt: Timestamp.now(),
        source: 'fishbowl' as const,
      };
      
      // Add ALL fields from the Excel row
      for (const [key, value] of Object.entries(row)) {
        if (key && value !== null && value !== undefined && String(value).trim() !== '') {
          // Skip if already set
          if (orderData[key]) continue;
          
          // Handle dates
          if (key.toLowerCase().includes('date')) {
            const parsedDate = parseDate(value);
            if (parsedDate) {
              orderData[key] = Timestamp.fromDate(parsedDate);
              continue;
            }
          }
          
          // Handle booleans
          if (key.toLowerCase().includes('flag') || 
              key.toLowerCase().includes('residential') ||
              key.toLowerCase().includes('tobe') ||
              key.toLowerCase().includes('includes') ||
              key.toLowerCase().includes('exempt') ||
              key.toLowerCase().includes('emailed') ||
              key.toLowerCase().includes('printed')) {
            orderData[key] = parseBoolean(value);
            continue;
          }
          
          // Handle currency/numbers (price, cost, tax, total, subtotal, rate, etc.)
          if (key.toLowerCase().includes('price') ||
              key.toLowerCase().includes('cost') ||
              key.toLowerCase().includes('tax') ||
              key.toLowerCase().includes('total') ||
              key.toLowerCase().includes('subtotal') ||
              key.toLowerCase().includes('rate') ||
              key.toLowerCase().includes('amount') ||
              key.toLowerCase().includes('value')) {
            const num = parseNumber(value);
            if (num !== undefined) {
              orderData[key] = num;
              continue;
            }
          }
          
          // Handle numbers (IDs, counts, etc.)
          if (typeof value === 'number') {
            orderData[key] = value;
            continue;
          }
          
          // Default: store as string
          orderData[key] = String(value);
        }
      }
      
      // Check if data actually changed
      let hasChanges = false;
      if (existingData) {
        // Compare new data with existing (excluding metadata fields)
        for (const [key, value] of Object.entries(orderData)) {
          if (key !== 'updatedAt' && key !== 'syncStatus') {
            if (JSON.stringify(existingData[key]) !== JSON.stringify(value)) {
              hasChanges = true;
              break;
            }
          }
        }
      }
      
      // Track stats
      if (!existingData) {
        stats.ordersCreated++;
      } else if (hasChanges) {
        stats.ordersUpdated++;
      }
      // If no changes, don't count as updated
      
      // Only write if new or changed
      if (!existingData || hasChanges) {
        batch.set(docRef, {
          ...orderData,
          createdAt: existingData?.createdAt || Timestamp.now(),
        }, { merge: true });
        
        batchCount++;
      }
      
      // Commit batch if we hit the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`💾 Committed batch of ${batchCount} orders`);
        batch = adminDb.batch(); // Create new batch
        batchCount = 0;
      }
      
    } catch (error: any) {
      stats.errors.push({
        recordId: String(row.num || row.id || 'unknown'),
        error: error.message,
      });
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Committed final batch of ${batchCount} orders`);
  }
}

/**
 * Log sync to audit trail
 */
async function logSync(stats: ImportStats, startTime: Date): Promise<void> {
  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();
  
  await adminDb.collection('sync_log').add({
    syncType: 'fishbowl_to_firestore',
    status: stats.errors.length > 0 ? 'completed' : 'completed',
    recordsProcessed: stats.customersProcessed + stats.ordersProcessed,
    recordsCreated: stats.customersCreated + stats.ordersCreated,
    recordsUpdated: stats.customersUpdated + stats.ordersUpdated,
    recordsFailed: stats.errors.length,
    errors: stats.errors.slice(0, 100), // Limit to first 100 errors
    startedAt: Timestamp.fromDate(startTime),
    completedAt: Timestamp.fromDate(endTime),
    duration,
    triggeredBy: 'api',
    metadata: {
      customersProcessed: stats.customersProcessed,
      customersCreated: stats.customersCreated,
      customersUpdated: stats.customersUpdated,
      ordersProcessed: stats.ordersProcessed,
      ordersCreated: stats.ordersCreated,
      ordersUpdated: stats.ordersUpdated,
    },
  });
}

export async function POST(req: NextRequest) {
  const startTime = new Date();
  
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const customersFile = formData.get('customersFile') as File | null;
    const ordersFile = formData.get('ordersFile') as File | null;
    
    if (!customersFile && !ordersFile) {
      return NextResponse.json(
        { error: 'No files provided. Please upload at least one Excel file.' },
        { status: 400 }
      );
    }
    
    const stats: ImportStats = {
      customersProcessed: 0,
      customersCreated: 0,
      customersUpdated: 0,
      ordersProcessed: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      errors: [],
    };
    
    // Import customers
    if (customersFile) {
      const buffer = Buffer.from(await customersFile.arrayBuffer());
      await importCustomers(buffer, stats);
    }
    
    // Import sales orders
    if (ordersFile) {
      const buffer = Buffer.from(await ordersFile.arrayBuffer());
      await importSalesOrders(buffer, stats);
    }
    
    // Log sync
    await logSync(stats, startTime);
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats: {
        customers: {
          processed: stats.customersProcessed,
          created: stats.customersCreated,
          updated: stats.customersUpdated,
        },
        salesOrders: {
          processed: stats.ordersProcessed,
          created: stats.ordersCreated,
          updated: stats.ordersUpdated,
        },
        errors: stats.errors.length,
        errorSamples: stats.errors.slice(0, 10),
      },
    });
    
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
