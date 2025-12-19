import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Verify accountType data integrity across collections
 * 
 * Checks:
 * 1. Customer accountType sources (copper_companies vs copper_sync vs fishbowl)
 * 2. Order accountType consistency with customer
 * 3. Line item accountType consistency with customer
 */
export async function GET() {
  try {
    console.log('🔍 Verifying accountType data integrity...\n');

    // Load customers
    const customersSnap = await adminDb.collection('fishbowl_customers').limit(1000).get();
    
    const customerStats = {
      total: customersSnap.size,
      byCopperCompanies: 0,
      byCopperSync: 0,
      byFishbowl: 0,
      byExisting: 0,
      noSource: 0,
      distributor: 0,
      wholesale: 0,
      retail: 0,
    };

    const customerTypeMap = new Map<string, { accountType: string; source: string }>();

    customersSnap.forEach(doc => {
      const data = doc.data();
      const accountType = data.accountType || 'Unknown';
      const accountTypeSource = data.accountTypeSource || 'none';

      customerTypeMap.set(doc.id, { accountType, source: accountTypeSource });

      // Count by source
      if (accountTypeSource === 'copper_companies') customerStats.byCopperCompanies++;
      else if (accountTypeSource === 'copper_sync') customerStats.byCopperSync++;
      else if (accountTypeSource === 'fishbowl') customerStats.byFishbowl++;
      else if (accountTypeSource === 'existing') customerStats.byExisting++;
      else customerStats.noSource++;

      // Count by type
      if (accountType === 'Distributor') customerStats.distributor++;
      else if (accountType === 'Wholesale') customerStats.wholesale++;
      else if (accountType === 'Retail') customerStats.retail++;
    });

    // Sample orders to check consistency
    console.log('📦 Sampling 100 recent orders...');
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders')
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();

    const orderStats = {
      total: ordersSnap.size,
      matched: 0,
      mismatched: 0,
      customerNotFound: 0,
      mismatches: [] as any[],
    };

    ordersSnap.forEach(doc => {
      const orderData = doc.data();
      const customerId = orderData.customerId;
      const orderAccountType = orderData.accountType;

      const customerData = customerTypeMap.get(customerId);
      if (!customerData) {
        orderStats.customerNotFound++;
        return;
      }

      if (customerData.accountType === orderAccountType) {
        orderStats.matched++;
      } else {
        orderStats.mismatched++;
        if (orderStats.mismatches.length < 10) {
          orderStats.mismatches.push({
            orderId: doc.id,
            orderNum: orderData.num,
            customerId,
            customerName: orderData.customerName,
            customerAccountType: customerData.accountType,
            orderAccountType,
            customerSource: customerData.source,
            orderSource: orderData.accountTypeSource,
          });
        }
      }
    });

    // Sample line items to check consistency
    console.log('📦 Sampling 100 recent line items...');
    const itemsSnap = await adminDb.collection('fishbowl_soitems')
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();

    const itemStats = {
      total: itemsSnap.size,
      matched: 0,
      mismatched: 0,
      customerNotFound: 0,
    };

    itemsSnap.forEach(doc => {
      const itemData = doc.data();
      const customerId = itemData.customerId;
      const itemAccountType = itemData.accountType;

      const customerData = customerTypeMap.get(customerId);
      if (!customerData) {
        itemStats.customerNotFound++;
        return;
      }

      if (customerData.accountType === itemAccountType) {
        itemStats.matched++;
      } else {
        itemStats.mismatched++;
      }
    });

    const report = {
      summary: {
        customersAnalyzed: customerStats.total,
        ordersChecked: orderStats.total,
        lineItemsChecked: itemStats.total,
      },
      customers: {
        bySource: {
          copper_companies: customerStats.byCopperCompanies,
          copper_sync: customerStats.byCopperSync,
          fishbowl: customerStats.byFishbowl,
          existing: customerStats.byExisting,
          no_source: customerStats.noSource,
        },
        byType: {
          Distributor: customerStats.distributor,
          Wholesale: customerStats.wholesale,
          Retail: customerStats.retail,
        },
      },
      orders: {
        matched: orderStats.matched,
        mismatched: orderStats.mismatched,
        customerNotFound: orderStats.customerNotFound,
        consistencyRate: orderStats.total > 0 
          ? `${((orderStats.matched / orderStats.total) * 100).toFixed(1)}%`
          : 'N/A',
        sampleMismatches: orderStats.mismatches,
      },
      lineItems: {
        matched: itemStats.matched,
        mismatched: itemStats.mismatched,
        customerNotFound: itemStats.customerNotFound,
        consistencyRate: itemStats.total > 0
          ? `${((itemStats.matched / itemStats.total) * 100).toFixed(1)}%`
          : 'N/A',
      },
      interpretation: {
        customers_copper_companies: 'accountType set by Step 0 (Copper Sync) - CORRECT ✅',
        customers_copper_sync: 'accountType set by Step 2 (address matching) - May be incorrect if ran after Fishbowl import ⚠️',
        customers_fishbowl: 'accountType from Fishbowl data (always Retail) - INCORRECT if not overridden by Copper ❌',
        orders_matched: 'Order accountType matches customer - GOOD ✅',
        orders_mismatched: 'Order accountType differs from customer - BAD ❌',
      },
    };

    console.log('\n📊 REPORT:', JSON.stringify(report, null, 2));

    return NextResponse.json(report);

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
