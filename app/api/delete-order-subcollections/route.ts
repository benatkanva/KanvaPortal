import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Delete all sales_order_history subcollections under fishbowl_customers
 * 
 * This is needed when reimporting data to clear out broken nested orders.
 * 
 * Query params:
 * - confirmation: Must be "true" to actually delete (default: dry run)
 * 
 * Examples:
 * - Dry run: POST /api/delete-order-subcollections
 * - Actually delete: POST /api/delete-order-subcollections?confirmation=true
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmation = searchParams.get('confirmation') === 'true';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🗑️  DELETE ORDER SUBCOLLECTIONS`);
    console.log(`${'='.repeat(80)}\n`);
    
    if (!confirmation) {
      console.log('⚠️  DRY RUN MODE - No data will be deleted');
      console.log('   Add ?confirmation=true to actually delete data\n');
    }
    
    let totalCustomers = 0;
    let totalOrders = 0;
    
    // Get all customers
    console.log('📋 Loading all customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    totalCustomers = customersSnapshot.size;
    console.log(`   Found ${totalCustomers} customers\n`);
    
    // Process each customer
    for (const customerDoc of customersSnapshot.docs) {
      const customerId = customerDoc.id;
      
      // Get all orders in the subcollection
      const ordersSnapshot = await adminDb
        .collection('fishbowl_customers')
        .doc(customerId)
        .collection('sales_order_history')
        .get();
      
      if (ordersSnapshot.empty) continue;
      
      console.log(`🔍 Customer ${customerId}: ${ordersSnapshot.size} orders`);
      totalOrders += ordersSnapshot.size;
      
      if (confirmation) {
        // Delete in batches
        const batchSize = 450;
        for (let i = 0; i < ordersSnapshot.docs.length; i += batchSize) {
          const batch = adminDb.batch();
          const chunk = ordersSnapshot.docs.slice(i, i + batchSize);
          
          chunk.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          console.log(`   ✅ Deleted ${chunk.length} orders`);
        }
      } else {
        console.log(`   ℹ️  Would delete ${ordersSnapshot.size} orders (dry run)`);
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Customers processed: ${totalCustomers}`);
    console.log(`Total orders ${confirmation ? 'deleted' : 'that would be deleted'}: ${totalOrders}`);
    
    if (!confirmation) {
      console.log(`\n⚠️  THIS WAS A DRY RUN - No data was actually deleted`);
      console.log(`   To actually delete, add: ?confirmation=true`);
    } else {
      console.log(`\n✅ All subcollections deleted successfully`);
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      dryRun: !confirmation,
      customersProcessed: totalCustomers,
      ordersDeleted: totalOrders
    });
    
  } catch (error: any) {
    console.error('Error deleting subcollections:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
