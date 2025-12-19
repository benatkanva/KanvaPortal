/**
 * Migration Script: Backfill Orders into Customer Subcollections
 * 
 * This script migrates all existing orders from the flat fishbowl_sales_orders
 * collection into customer-specific subcollections for faster queries and
 * accurate commission calculations.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-orders-to-subcollections.ts
 * 
 * What it does:
 *   1. Reads all orders from fishbowl_sales_orders
 *   2. Groups them by customerId
 *   3. Writes to fishbowl_customers/{customerId}/sales_order_history
 *   4. Updates customer summary fields (firstOrderDate, lastOrderDate, etc.)
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin (adjust path to your service account key)
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

interface OrderData {
  customerId: string;
  postingDate: any;
  salesPerson: string;
  [key: string]: any;
}

interface CustomerSummary {
  firstOrderDate: any;
  lastOrderDate: any;
  totalOrders: number;
  firstSalesPerson: string;
  lastSalesPerson: string;
  originalOwner?: string;
}

async function migrateOrders() {
  console.log('🚀 Starting migration of orders to subcollections...\n');
  
  const startTime = Date.now();
  let processedOrders = 0;
  let processedCustomers = 0;
  let errors = 0;
  
  try {
    // Step 1: Get all orders from flat collection
    console.log('📥 Loading all orders from fishbowl_sales_orders...');
    const ordersSnapshot = await db.collection('fishbowl_sales_orders').get();
    console.log(`   ✅ Found ${ordersSnapshot.size.toLocaleString()} orders\n`);
    
    // Step 2: Group orders by customer
    console.log('📊 Grouping orders by customer...');
    const ordersByCustomer = new Map<string, OrderData[]>();
    
    for (const doc of ordersSnapshot.docs) {
      const orderData = doc.data() as OrderData;
      const customerId = orderData.customerId;
      
      if (!customerId) {
        console.warn(`⚠️  Order ${doc.id} has no customerId - skipping`);
        continue;
      }
      
      if (!ordersByCustomer.has(customerId)) {
        ordersByCustomer.set(customerId, []);
      }
      
      ordersByCustomer.get(customerId)!.push({
        ...orderData,
        id: doc.id
      });
    }
    
    console.log(`   ✅ Grouped into ${ordersByCustomer.size.toLocaleString()} customers\n`);
    
    // Step 3: Process each customer
    console.log('🔄 Writing orders to customer subcollections...\n');
    
    const MAX_BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const [customerId, orders] of ordersByCustomer) {
      processedCustomers++;
      
      // Sort orders by date
      orders.sort((a, b) => {
        const dateA = a.postingDate?.toDate ? a.postingDate.toDate() : new Date(0);
        const dateB = b.postingDate?.toDate ? b.postingDate.toDate() : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });
      
      const firstOrder = orders[0];
      const lastOrder = orders[orders.length - 1];
      
      // Calculate customer summary
      const summary: CustomerSummary = {
        firstOrderDate: firstOrder.postingDate,
        lastOrderDate: lastOrder.postingDate,
        totalOrders: orders.length,
        firstSalesPerson: firstOrder.salesPerson || '',
        lastSalesPerson: lastOrder.salesPerson || '',
        originalOwner: firstOrder.salesPerson || ''
      };
      
      // Write each order to subcollection
      for (const order of orders) {
        const orderHistoryRef = db
          .collection('fishbowl_customers')
          .doc(customerId)
          .collection('sales_order_history')
          .doc(order.id as string);
        
        batch.set(orderHistoryRef, {
          ...order,
          migratedAt: Timestamp.now()
        });
        
        batchCount++;
        processedOrders++;
        
        // Commit batch if needed
        if (batchCount >= MAX_BATCH_SIZE) {
          try {
            await batch.commit();
            console.log(`   ✅ Committed batch (${processedOrders.toLocaleString()} orders, ${processedCustomers} customers)`);
            batch = db.batch();
            batchCount = 0;
          } catch (error) {
            console.error(`   ❌ Batch commit failed:`, error);
            errors++;
          }
        }
      }
      
      // Update customer summary
      const customerRef = db.collection('fishbowl_customers').doc(customerId);
      batch.set(customerRef, {
        ...summary,
        updatedAt: Timestamp.now(),
        migratedAt: Timestamp.now()
      }, { merge: true });
      
      batchCount++;
      
      // Progress update every 100 customers
      if (processedCustomers % 100 === 0) {
        console.log(`   📊 Progress: ${processedCustomers.toLocaleString()} customers, ${processedOrders.toLocaleString()} orders`);
      }
      
      // Commit batch if needed
      if (batchCount >= MAX_BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`   ✅ Committed batch (${processedOrders.toLocaleString()} orders, ${processedCustomers} customers)`);
          batch = db.batch();
          batchCount = 0;
        } catch (error) {
          console.error(`   ❌ Batch commit failed:`, error);
          errors++;
        }
      }
    }
    
    // Final batch commit
    if (batchCount > 0) {
      try {
        await batch.commit();
        console.log(`   ✅ Committed final batch (${processedOrders.toLocaleString()} orders, ${processedCustomers} customers)`);
      } catch (error) {
        console.error(`   ❌ Final batch commit failed:`, error);
        errors++;
      }
    }
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(80));
    console.log(`   Orders migrated:    ${processedOrders.toLocaleString()}`);
    console.log(`   Customers updated:  ${processedCustomers.toLocaleString()}`);
    console.log(`   Errors:             ${errors}`);
    console.log(`   Duration:           ${duration}s`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run migration
migrateOrders();
