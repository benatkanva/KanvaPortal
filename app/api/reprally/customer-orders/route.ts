import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// Helper to convert Firestore Timestamp or string to ISO string
function toISODate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Timestamp || (val._seconds !== undefined)) {
    // Firestore Timestamp
    const ts = val instanceof Timestamp ? val : new Timestamp(val._seconds, val._nanoseconds || 0);
    return ts.toDate().toISOString();
  }
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    // Already a string, validate it's a parseable date
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return null;
}

/**
 * Get sales orders with line items for a specific RepRally customer
 * Also fetches their direct orders from fishbowl_sales_orders for comparison
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const rrCustomerId = searchParams.get('rrCustomerId');
    
    if (!customerId && !rrCustomerId) {
      return NextResponse.json(
        { success: false, error: 'customerId or rrCustomerId is required' },
        { status: 400 }
      );
    }

    const result: any = {
      success: true,
      customerId,
      rrCustomerId,
      directOrders: [],
      reprallyOrders: [],
      stats: {
        directOrderCount: 0,
        directRevenue: 0,
        reprallyOrderCount: 0,
        reprallyRevenue: 0
      }
    };

    // 1) Fetch direct orders from fishbowl_sales_orders
    if (customerId) {
      console.log(`📦 Fetching direct orders for customer: ${customerId}`);
      
      const ordersSnap = await adminDb
        .collection('fishbowl_sales_orders')
        .where('customerId', '==', customerId)
        .get();

      for (const doc of ordersSnap.docs) {
        const order = doc.data();
        const orderNum = String(order.fishbowlNum || order.num || doc.id);
        const customerName = String(order.customerName || '').toLowerCase();
        const salesRep = String(order.salesRep || order.salesPerson || '').toLowerCase();

        // Skip RepRally orders (we want direct orders only)
        const isRepRallyOrder =
          customerName.includes('shopify') ||
          salesRep.includes('robert farias') ||
          salesRep.includes('farias') ||
          orderNum.startsWith('#') ||
          orderNum.includes('QPQ') ||
          orderNum.includes('000000');

        if (isRepRallyOrder) continue;

        // Fetch line items for this order
        const itemsSnap = await adminDb
          .collection('fishbowl_soitems')
          .where('salesOrderNum', '==', orderNum)
          .get();

        const lineItems = itemsSnap.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data()
        }));

        const orderRevenue = parseFloat(order.revenue || order.orderValue || order.totalAmount || 0);

        result.directOrders.push({
          id: doc.id,
          orderNum,
          postingDate: toISODate(order.postingDate) || toISODate(order.postingDateStr) || toISODate(order.dateCompleted),
          salesRep: order.salesRep || order.salesPerson,
          customerName: order.customerName,
          revenue: orderRevenue,
          status: order.status,
          lineItems,
          lineItemCount: lineItems.length
        });

        result.stats.directOrderCount++;
        result.stats.directRevenue += orderRevenue;
      }

      // Sort by date descending
      result.directOrders.sort((a: any, b: any) => {
        const dateA = new Date(a.postingDate || 0).getTime();
        const dateB = new Date(b.postingDate || 0).getTime();
        return dateB - dateA;
      });
    }

    // 2) Fetch RepRally orders from reprally_customers subcollection
    const targetCustomerId = rrCustomerId || customerId;
    if (targetCustomerId) {
      console.log(`🛍️ Fetching RepRally orders for customer: ${targetCustomerId}`);
      
      // First check if customer exists in reprally_customers
      const rrCustomerDoc = await adminDb
        .collection('reprally_customers')
        .doc(targetCustomerId)
        .get();

      if (rrCustomerDoc.exists) {
        const rrCustomer = rrCustomerDoc.data();
        result.reprallyCustomer = {
          id: rrCustomerDoc.id,
          businessName: rrCustomer?.businessName,
          billingAddress: rrCustomer?.billingAddress,
          billingCity: rrCustomer?.billingCity,
          billingState: rrCustomer?.billingState,
          totalRepRallyOrders: rrCustomer?.totalRepRallyOrders,
          totalRepRallyRevenue: rrCustomer?.totalRepRallyRevenue
        };

        // Fetch orders from subcollection
        const rrOrdersSnap = await adminDb
          .collection('reprally_customers')
          .doc(targetCustomerId)
          .collection('sales_orders')
          .get();

        for (const orderDoc of rrOrdersSnap.docs) {
          const order = orderDoc.data();
          
          // Fetch line items from order subcollection
          const itemsSnap = await adminDb
            .collection('reprally_customers')
            .doc(targetCustomerId)
            .collection('sales_orders')
            .doc(orderDoc.id)
            .collection('line_items')
            .get();

          const lineItems = itemsSnap.docs.map(itemDoc => ({
            id: itemDoc.id,
            ...itemDoc.data()
          }));

          const orderRevenue = parseFloat(order.revenue || order.orderValue || order.totalAmount || 0);

          result.reprallyOrders.push({
            id: orderDoc.id,
            orderNum: order.orderNum || order.fishbowlNum || orderDoc.id,
            postingDate: toISODate(order.postingDate) || toISODate(order.postingDateStr) || toISODate(order.orderDate),
            salesRep: order.salesRep || order.salesPerson,
            customerName: order.customerName || order.businessName,
            revenue: orderRevenue,
            status: order.status,
            lineItems,
            lineItemCount: lineItems.length
          });

          result.stats.reprallyOrderCount++;
          result.stats.reprallyRevenue += orderRevenue;
        }

        // Sort by date descending
        result.reprallyOrders.sort((a: any, b: any) => {
          const dateA = new Date(a.postingDate || 0).getTime();
          const dateB = new Date(b.postingDate || 0).getTime();
          return dateB - dateA;
        });
      } else {
        // Fallback: Check fishbowl_sales_orders for RepRally orders
        console.log(`   Customer not in reprally_customers, checking fishbowl_sales_orders...`);
        
        const ordersSnap = await adminDb
          .collection('fishbowl_sales_orders')
          .where('customerId', '==', targetCustomerId)
          .get();

        for (const doc of ordersSnap.docs) {
          const order = doc.data();
          const orderNum = String(order.fishbowlNum || order.num || doc.id);
          const customerName = String(order.customerName || '').toLowerCase();
          const salesRep = String(order.salesRep || order.salesPerson || '').toLowerCase();

          // Only include RepRally orders
          const isRepRallyOrder =
            customerName.includes('shopify') ||
            salesRep.includes('robert farias') ||
            salesRep.includes('farias') ||
            orderNum.startsWith('#') ||
            orderNum.includes('QPQ') ||
            orderNum.includes('000000');

          if (!isRepRallyOrder) continue;

          // Fetch line items
          const itemsSnap = await adminDb
            .collection('fishbowl_soitems')
            .where('salesOrderNum', '==', orderNum)
            .get();

          const lineItems = itemsSnap.docs.map(itemDoc => ({
            id: itemDoc.id,
            ...itemDoc.data()
          }));

          const orderRevenue = parseFloat(order.revenue || order.orderValue || order.totalAmount || 0);

          result.reprallyOrders.push({
            id: doc.id,
            orderNum,
            postingDate: toISODate(order.postingDate) || toISODate(order.postingDateStr) || toISODate(order.dateCompleted),
            salesRep: order.salesRep || order.salesPerson,
            customerName: order.customerName,
            revenue: orderRevenue,
            status: order.status,
            lineItems,
            lineItemCount: lineItems.length
          });

          result.stats.reprallyOrderCount++;
          result.stats.reprallyRevenue += orderRevenue;
        }

        result.reprallyOrders.sort((a: any, b: any) => {
          const dateA = new Date(a.postingDate || 0).getTime();
          const dateB = new Date(b.postingDate || 0).getTime();
          return dateB - dateA;
        });
      }
    }

    console.log(`✅ Found ${result.stats.directOrderCount} direct orders, ${result.stats.reprallyOrderCount} RepRally orders`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Error fetching customer orders:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
