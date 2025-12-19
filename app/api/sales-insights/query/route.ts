import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded;
  } catch (e) {
    console.error('[Sales Insights] Token verification failed:', e);
    return null;
  }
}

interface CustomerRow {
  customerId: string;
  customerName: string;
  salesPerson: string | null;
  salesRep: string | null;
  salesRepName: string | null;
  salesRepRegion: string | null;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  totalOrdersAllTime: number;
  totalRevenueAllTime: number;
  revenueInRange: number;
  ordersInRange: number;
  isNewInRange: boolean;
  isDormant?: boolean;
}

function parseFirestoreDate(value: any): Date | null {
  if (!value) return null;
  if (value._seconds) return new Date(value._seconds * 1000);
  if (value.toDate) return value.toDate();
  if (typeof value === 'string') return new Date(value);
  if (value instanceof Date) return value;
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { startDate, endDate, filters, includeOrderDetails, salesOrderNum } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    console.log(`[Sales Insights] Query: ${startDate} to ${endDate}`);

    // Load Fishbowl sales orders
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders').get();
    console.log(`[Sales Insights] Loaded ${ordersSnap.size} orders`);

    // Load Fishbowl customers for mapping
    const customersSnap = await adminDb.collection('fishbowl_customers').get();
    const customersById = new Map<string, any>();
    for (const doc of customersSnap.docs) {
      const data = doc.data();
      customersById.set(doc.id, { id: doc.id, ...data });
      if (data.customerId) customersById.set(data.customerId, { id: doc.id, ...data });
    }

    // Aggregate orders by customer
    const customerAggregates = new Map<string, {
      customerId: string;
      customerName: string;
      salesPerson: string | null;
      salesRep: string | null;
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
      totalOrdersAllTime: number;
      totalRevenueAllTime: number;
      ordersInRange: number;
      revenueInRange: number;
      orders: any[];
    }>();

    const salesRepSet = new Set<string>();
    const ordersByCustomer: Record<string, any[]> = {};

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const customerId = order.customerId || order.customerNum || doc.id;
      const orderDate = parseFirestoreDate(order.dateCreated) || parseFirestoreDate(order.dateIssued);
      const orderTotal = parseFloat(order.totalIncludingTax || order.total || order.subTotal || 0);
      const salesPerson = order.salesPerson || order.salesman || null;

      // Get customer info
      const customer = customersById.get(customerId);
      const customerName = order.customerName || customer?.name || customer?.customerName || 'Unknown';

      if (salesPerson) salesRepSet.add(salesPerson);

      // Apply filters
      if (filters?.salesPerson && salesPerson !== filters.salesPerson) continue;
      if (filters?.salesRep && salesPerson !== filters.salesRep) continue;

      // Search for specific order number
      if (salesOrderNum && order.num !== salesOrderNum && order.salesOrderNum !== salesOrderNum) continue;

      // Initialize or get aggregate
      if (!customerAggregates.has(customerId)) {
        customerAggregates.set(customerId, {
          customerId,
          customerName,
          salesPerson,
          salesRep: salesPerson,
          firstOrderDate: null,
          lastOrderDate: null,
          totalOrdersAllTime: 0,
          totalRevenueAllTime: 0,
          ordersInRange: 0,
          revenueInRange: 0,
          orders: [],
        });
      }

      const agg = customerAggregates.get(customerId)!;
      
      // Update all-time stats
      agg.totalOrdersAllTime++;
      agg.totalRevenueAllTime += orderTotal;

      // Track first/last order dates
      if (orderDate) {
        if (!agg.firstOrderDate || orderDate < agg.firstOrderDate) {
          agg.firstOrderDate = orderDate;
        }
        if (!agg.lastOrderDate || orderDate > agg.lastOrderDate) {
          agg.lastOrderDate = orderDate;
        }

        // Check if order is in range
        if (orderDate >= start && orderDate <= end) {
          agg.ordersInRange++;
          agg.revenueInRange += orderTotal;

          if (includeOrderDetails) {
            agg.orders.push({
              orderNum: order.num || order.salesOrderNum,
              date: orderDate.toISOString().split('T')[0],
              total: orderTotal,
              status: order.status || order.statusName,
            });
          }
        }
      }
    }

    // Build customer rows
    const customers: CustomerRow[] = [];
    let totalCustomersWithActivity = 0;
    let newCustomers = 0;
    let totalRevenueInRange = 0;
    let newRevenueInRange = 0;

    // Aggregate data for charts
    const repAggregates: Record<string, { rep: string; newRevenue: number; oldRevenue: number; totalRevenue: number; customerCount: number }> = {};
    const weeklyNewBusiness: Record<string, { week: string; revenue: number; customerCount: number }> = {};

    for (const [customerId, agg] of customerAggregates) {
      // Determine if customer is "new" in range (first order within date range)
      const isNewInRange = agg.firstOrderDate && agg.firstOrderDate >= start && agg.firstOrderDate <= end;
      
      // Check for dormant (no orders in last 12 months but has history)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const isDormant = agg.lastOrderDate && agg.lastOrderDate < twelveMonthsAgo && agg.totalOrdersAllTime > 0;

      // Only include customers with activity in range or if searching all
      if (agg.ordersInRange > 0 || salesOrderNum) {
        totalCustomersWithActivity++;
        totalRevenueInRange += agg.revenueInRange;

        if (isNewInRange) {
          newCustomers++;
          newRevenueInRange += agg.revenueInRange;
        }

        // Aggregate by sales rep for chart
        const rep = agg.salesPerson || 'Unassigned';
        if (!repAggregates[rep]) {
          repAggregates[rep] = { rep, newRevenue: 0, oldRevenue: 0, totalRevenue: 0, customerCount: 0 };
        }
        repAggregates[rep].totalRevenue += agg.revenueInRange;
        repAggregates[rep].customerCount++;
        if (isNewInRange) {
          repAggregates[rep].newRevenue += agg.revenueInRange;
        } else {
          repAggregates[rep].oldRevenue += agg.revenueInRange;
        }

        customers.push({
          customerId,
          customerName: agg.customerName,
          salesPerson: agg.salesPerson,
          salesRep: agg.salesRep,
          salesRepName: agg.salesPerson,
          salesRepRegion: null,
          firstOrderDate: agg.firstOrderDate?.toISOString().split('T')[0] || null,
          lastOrderDate: agg.lastOrderDate?.toISOString().split('T')[0] || null,
          totalOrdersAllTime: agg.totalOrdersAllTime,
          totalRevenueAllTime: agg.totalRevenueAllTime,
          revenueInRange: agg.revenueInRange,
          ordersInRange: agg.ordersInRange,
          isNewInRange: !!isNewInRange,
          isDormant: isDormant || undefined,
        });

        if (includeOrderDetails && agg.orders.length > 0) {
          ordersByCustomer[customerId] = agg.orders;
        }
      }
    }

    // Sort by revenue descending
    customers.sort((a, b) => b.revenueInRange - a.revenueInRange);

    console.log(`[Sales Insights] Found ${customers.length} customers with activity, ${newCustomers} new`);

    return NextResponse.json({
      stats: {
        totalCustomersWithActivity,
        newCustomers,
        totalRevenueInRange,
        newRevenueInRange,
        startDate,
        endDate,
      },
      customers,
      options: {
        salesRep: Array.from(salesRepSet).sort(),
      },
      ordersByCustomer: includeOrderDetails ? ordersByCustomer : undefined,
      chartData: {
        repAggregates: Object.values(repAggregates).sort((a, b) => b.totalRevenue - a.totalRevenue),
        weeklyNewBusiness: Object.values(weeklyNewBusiness),
      },
    });
  } catch (e: any) {
    console.error('[Sales Insights Query] Error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to query sales insights' }, { status: 500 });
  }
}
