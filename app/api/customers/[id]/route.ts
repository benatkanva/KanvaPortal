import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/customers/[id]
 * Get unified customer profile combining Copper CRM and Fishbowl data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    // Load customer sales summary (primary source for metrics)
    const summaryDoc = await adminDb
      .collection('customer_sales_summary')
      .doc(customerId)
      .get();

    if (!summaryDoc.exists) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const summary = summaryDoc.data();

    // Load Fishbowl customer data
    const fishbowlDoc = await adminDb
      .collection('fishbowl_customers')
      .doc(customerId)
      .get();

    const fishbowlData = fishbowlDoc.exists ? fishbowlDoc.data() : null;

    // Load Copper CRM data if available
    let copperData = null;
    if (summary?.copperId) {
      const copperDoc = await adminDb
        .collection('copper_company')
        .doc(summary.copperId.toString())
        .get();
      copperData = copperDoc.exists ? copperDoc.data() : null;
    }

    // Load recent orders (last 50)
    const ordersSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .orderBy('postingDate', 'desc')
      .limit(50)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      postingDate: doc.data().postingDate?.toDate?.()?.toISOString() || null
    }));

    // Load line items for SKU analysis
    const lineItemsSnapshot = await adminDb
      .collection('fishbowl_line_items')
      .where('customerId', '==', customerId)
      .get();

    // Calculate SKU mix
    const skuMap = new Map<string, { 
      productName: string; 
      quantity: number; 
      revenue: number; 
      orderCount: number;
    }>();

    lineItemsSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const sku = item.productNumber || item.productName || 'Unknown';
      const existing = skuMap.get(sku) || {
        productName: item.productName || sku,
        quantity: 0,
        revenue: 0,
        orderCount: 0
      };

      skuMap.set(sku, {
        productName: existing.productName,
        quantity: existing.quantity + (Number(item.quantity) || 0),
        revenue: existing.revenue + (Number(item.totalPrice) || 0),
        orderCount: existing.orderCount + 1
      });
    });

    const skuMix = Array.from(skuMap.entries())
      .map(([sku, data]) => ({ sku, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20); // Top 20 SKUs

    // Build unified profile
    const unifiedProfile = {
      // Basic Info
      customerId: customerId,
      customerName: summary?.customerName || fishbowlData?.name || copperData?.name || 'Unknown',
      accountType: fishbowlData?.accountType || summary?.accountType || 'Unknown',
      
      // Contact Info (prefer Copper for most current)
      email: copperData?.email || fishbowlData?.email || null,
      phone: copperData?.phone_numbers?.[0]?.number || fishbowlData?.phone || null,
      website: copperData?.website || null,
      
      // Address Info
      shippingAddress: fishbowlData?.shippingAddress || summary?.shippingAddress || null,
      shippingCity: fishbowlData?.shippingCity || summary?.shippingCity || null,
      shippingState: fishbowlData?.shippingState || summary?.shippingState || null,
      shippingZip: fishbowlData?.shippingZip || summary?.shippingZip || null,
      billingAddress: copperData?.address?.street || null,
      billingCity: copperData?.address?.city || null,
      billingState: copperData?.address?.state || null,
      billingZip: copperData?.address?.postal_code || null,
      
      // Geographic
      lat: fishbowlData?.lat || summary?.lat || null,
      lng: fishbowlData?.lng || summary?.lng || null,
      region: summary?.region || null,
      regionColor: summary?.regionColor || '#808080',
      
      // Sales Metrics
      totalSales: summary?.totalSales || 0,
      totalSalesYTD: summary?.totalSalesYTD || 0,
      orderCount: summary?.orderCount || 0,
      orderCountYTD: summary?.orderCountYTD || 0,
      avgOrderValue: summary?.avgOrderValue || 0,
      
      // Time-based Metrics
      sales_30d: summary?.sales_30d || 0,
      sales_90d: summary?.sales_90d || 0,
      sales_12m: summary?.sales_12m || 0,
      orders_30d: summary?.orders_30d || 0,
      orders_90d: summary?.orders_90d || 0,
      orders_12m: summary?.orders_12m || 0,
      
      // Advanced Metrics
      velocity: summary?.velocity || 0, // Orders per month
      trend: summary?.trend || 0, // % change in sales
      daysSinceLastOrder: summary?.daysSinceLastOrder || null,
      monthlySales: summary?.monthlySales || [],
      
      // Order History
      firstOrderDate: summary?.firstOrderDate || null,
      lastOrderDate: summary?.lastOrderDate || null,
      lastOrderAmount: summary?.lastOrderAmount || 0,
      recentOrders: orders,
      
      // SKU Analysis
      skuMix: skuMix,
      topProduct: skuMix[0] || null,
      
      // Sales Rep Info
      salesPerson: summary?.salesPerson || fishbowlData?.salesPerson || null,
      salesPersonName: summary?.salesPersonName || null,
      salesPersonId: summary?.salesPersonId || null,
      salesPersonRegion: summary?.salesPersonRegion || null,
      
      // CRM Data
      copperId: summary?.copperId || fishbowlData?.copperId || null,
      copperTags: copperData?.tags || [],
      copperCustomFields: copperData?.custom_fields || [],
      
      // Metadata
      lastUpdatedAt: summary?.lastUpdatedAt || null,
      dataSource: {
        hasFishbowl: !!fishbowlData,
        hasCopper: !!copperData,
        hasSummary: !!summary
      }
    };

    return NextResponse.json({
      success: true,
      customer: unifiedProfile
    });

  } catch (error: any) {
    console.error('Error fetching customer profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer profile' },
      { status: 500 }
    );
  }
}
