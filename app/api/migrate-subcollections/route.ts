/**
 * API Route: Migrate Orders to Subcollections
 * 
 * This endpoint migrates existing orders from fishbowl_sales_orders
 * into customer-specific subcollections.
 * 
 * POST /api/migrate-subcollections
 * Body: { dryRun?: boolean, batchSize?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

interface OrderData {
  customerId: string;
  postingDate: any;
  salesPerson: string;
  [key: string]: any;
}

interface MigrationStats {
  ordersProcessed: number;
  customersUpdated: number;
  ordersWritten: number;
  errors: number;
  dryRun: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun ?? false;
    const batchSize = body.batchSize ?? 1000; // Process in batches
    
    console.log(`🚀 Starting migration (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    
    const stats: MigrationStats = {
      ordersProcessed: 0,
      customersUpdated: 0,
      ordersWritten: 0,
      errors: 0,
      dryRun
    };
    
    // Get all orders
    console.log('📥 Loading orders from fishbowl_sales_orders...');
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').limit(batchSize).get();
    console.log(`   Found ${ordersSnapshot.size} orders to process`);
    
    // Group by customer
    const ordersByCustomer = new Map<string, OrderData[]>();
    
    for (const doc of ordersSnapshot.docs) {
      const orderData = doc.data() as OrderData;
      const customerId = orderData.customerId;
      
      if (!customerId) {
        console.warn(`⚠️  Order ${doc.id} has no customerId - skipping`);
        stats.errors++;
        continue;
      }
      
      if (!ordersByCustomer.has(customerId)) {
        ordersByCustomer.set(customerId, []);
      }
      
      ordersByCustomer.get(customerId)!.push({
        ...orderData,
        id: doc.id
      });
      
      stats.ordersProcessed++;
    }
    
    console.log(`📊 Grouped into ${ordersByCustomer.size} customers`);
    
    if (!dryRun) {
      // Write to subcollections
      const MAX_BATCH_SIZE = 400;
      let batch = adminDb.batch();
      let batchCount = 0;
      
      for (const [customerId, orders] of ordersByCustomer) {
        // Sort by date
        orders.sort((a, b) => {
          const dateA = a.postingDate?.toDate ? a.postingDate.toDate() : new Date(0);
          const dateB = b.postingDate?.toDate ? b.postingDate.toDate() : new Date(0);
          return dateA.getTime() - dateB.getTime();
        });
        
        const firstOrder = orders[0];
        const lastOrder = orders[orders.length - 1];
        
        // Write each order to subcollection
        for (const order of orders) {
          const orderHistoryRef = adminDb
            .collection('fishbowl_customers')
            .doc(customerId)
            .collection('sales_order_history')
            .doc(order.id as string);
          
          batch.set(orderHistoryRef, {
            ...order,
            migratedAt: Timestamp.now()
          });
          
          batchCount++;
          stats.ordersWritten++;
          
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
        
        // Update customer summary
        const customerRef = adminDb.collection('fishbowl_customers').doc(customerId);
        batch.set(customerRef, {
          firstOrderDate: firstOrder.postingDate,
          lastOrderDate: lastOrder.postingDate,
          totalOrders: orders.length,
          firstSalesPerson: firstOrder.salesPerson || '',
          lastSalesPerson: lastOrder.salesPerson || '',
          originalOwner: firstOrder.salesPerson || '',
          updatedAt: Timestamp.now(),
          migratedAt: Timestamp.now()
        }, { merge: true });
        
        batchCount++;
        stats.customersUpdated++;
        
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
      
      // Final commit
      if (batchCount > 0) {
        await batch.commit();
      }
    }
    
    console.log('✅ Migration complete!', stats);
    
    return NextResponse.json({
      success: true,
      stats,
      message: dryRun 
        ? `Dry run complete - would migrate ${stats.ordersProcessed} orders for ${ordersByCustomer.size} customers`
        : `Migrated ${stats.ordersWritten} orders for ${stats.customersUpdated} customers`
    });
    
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
