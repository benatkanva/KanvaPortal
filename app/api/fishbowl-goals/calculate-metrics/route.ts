import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300; // 5 minutes for local processing
export const dynamic = 'force-dynamic';

interface CalculationStats {
  totalCustomers: number;
  updated: number;
  skipped: number;
  totalLineItems: number;
  activeCopperCustomers: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    await adminAuth.verifyIdToken(token);

    console.log(`🔢 Starting Fishbowl metrics calculation (local processing)...`);

    // ========================================
    // STEP 1: Load ALL Copper Customers
    // ========================================
    console.log('📊 Loading Copper customers...');
    const copperSnapshot = await adminDb
      .collection('copper_companies')
      .get();
    const copperIds = new Set(
      copperSnapshot.docs.map(doc => doc.data().id)
    );
    console.log(`   ✅ Found ${copperIds.size} Copper customers`);

    // ========================================
    // STEP 2: Load Fishbowl Customers (Matched & Active)
    // ========================================
    console.log('📊 Loading Fishbowl customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const allCustomers = customersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const matchedCustomers = allCustomers.filter(c => 
      c.copperId && copperIds.has(c.copperId)
    );
    console.log(`   ✅ Found ${allCustomers.length} total, ${matchedCustomers.length} matched to Copper`);

    // ========================================
    // STEP 3: Load ALL Line Items
    // ========================================
    console.log('📦 Loading line items...');
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems').get();
    const allLineItems = lineItemsSnapshot.docs.map(doc => doc.data()) as any[];
    console.log(`   ✅ Loaded ${allLineItems.length} line items`);

    // ========================================
    // STEP 4: Group Line Items by Customer
    // ========================================
    console.log('🗺️  Grouping line items by customer...');
    const lineItemsByCustomer = new Map<string, any[]>();
    for (const item of allLineItems) {
      // Unified import sets customerId on line items to the sanitized Fishbowl Account ID
      const customerId = item.customerId || item.customerNum || item.customerID;
      if (!customerId) continue;
      
      const key = String(customerId);
      if (!lineItemsByCustomer.has(key)) {
        lineItemsByCustomer.set(key, []);
      }
      lineItemsByCustomer.get(key)!.push(item);
    }
    console.log(`   ✅ Grouped for ${lineItemsByCustomer.size} customers`);

    // ========================================
    // STEP 5: Calculate Metrics for Each Customer
    // ========================================
    console.log('🔢 Calculating metrics...');
    let updated = 0;
    let skipped = 0;
    const batchSize = 500;
    let currentBatch = adminDb.batch();
    let batchCount = 0;

    for (let i = 0; i < matchedCustomers.length; i++) {
      const customer = matchedCustomers[i];
      
      // Log progress every 100 customers
      if (i % 100 === 0) {
        console.log(`   📊 Progress: ${i + 1} of ${matchedCustomers.length} (${((i / matchedCustomers.length) * 100).toFixed(1)}%)`);
      }
      
      // Use Fishbowl Account ID (customer.id) to match with line items.
      // Unified import writes soitem.customerId = sanitized Account ID (which is doc id).
      // Fall back to accountId/accountNumber only if needed.
      const customerId = customer.id || customer.accountId || customer.accountNumber;
      
      if (!customerId) {
        skipped++;
        continue;
      }

      const customerLineItems = lineItemsByCustomer.get(String(customerId)) || [];
      
      let metrics;
      if (customerLineItems.length === 0) {
        // No line items - set zeros
        metrics = {
          totalOrders: 0,
          totalSpent: 0,
          firstOrderDate: null,
          lastOrderDate: null,
          averageOrderValue: 0,
          daysSinceLastOrder: null,
          topProducts: '',
        };
      } else {
        // Calculate metrics from line items
        const uniqueOrderNums = new Set(
          customerLineItems.map((item: any) => item.salesOrderNum).filter(Boolean)
        );
        const totalOrders = uniqueOrderNums.size;
        
        const totalSpent = customerLineItems.reduce((sum: number, item: any) => {
          return sum + parseFloat(item.revenue || 0);
        }, 0);

        // Get dates
        const dates = customerLineItems
          .map((item: any) => item.commissionDate)
          .filter(Boolean)
          .map((d: any) => {
            if (d && d.toDate) return d.toDate();
            if (typeof d === 'string') return new Date(d);
            if (d instanceof Date) return d;
            return null;
          })
          .filter((d: any) => d && !isNaN(d.getTime()));

        const firstOrderDate = dates.length > 0 
          ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))).toISOString()
          : null;
        
        const lastOrderDate = dates.length > 0
          ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))).toISOString()
          : null;

        const daysSinceLastOrder = lastOrderDate
          ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

        // Top 3 products
        const productRevenue = new Map<string, { name: string; revenue: number }>();
        for (const item of customerLineItems) {
          const partNumber = item.partNumber || item.productNum || 'Unknown';
          const productName = item.product || partNumber;
          const revenue = parseFloat(item.revenue || 0);
          
          if (!productRevenue.has(partNumber)) {
            productRevenue.set(partNumber, { name: productName, revenue: 0 });
          }
          const prod = productRevenue.get(partNumber)!;
          prod.revenue += revenue;
        }

        const topProducts = Array.from(productRevenue.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
          .map(p => p.name)
          .join(', ');

        metrics = {
          totalOrders,
          totalSpent,
          firstOrderDate,
          lastOrderDate,
          averageOrderValue,
          daysSinceLastOrder,
          topProducts,
        };
      }

      const docRef = adminDb.collection('fishbowl_customers').doc(customer.id);
      currentBatch.update(docRef, {
        metrics,
        metricsCalculatedAt: new Date().toISOString(),
      });
      updated++;
      batchCount++;

      // Commit in batches of 500
      if (batchCount >= batchSize) {
        await currentBatch.commit();
        console.log(`   💾 Committed batch: ${updated} customers updated`);
        currentBatch = adminDb.batch();
        batchCount = 0;
      }
    }

    // Commit final batch
    if (batchCount > 0) {
      await currentBatch.commit();
      console.log(`   💾 Committed final batch: ${updated} total customers`);
    }

    const duration = Date.now() - startTime;
    const stats = {
      totalCustomers: matchedCustomers.length,
      updated,
      skipped,
      totalLineItems: allLineItems.length,
      totalCopperCustomers: copperIds.size,
    };

    console.log(`✅ Metrics calculation complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   ${updated} customers updated, ${skipped} skipped`);

    return NextResponse.json({ 
      success: true,
      stats,
      duration: `${(duration / 1000).toFixed(1)}s`,
    });

  } catch (error: any) {
    console.error('❌ Metrics calculation error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
