import { NextRequest, NextResponse } from 'next/server';
import { metricService } from '@/lib/firebase/services/goals';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { startOfMonth, endOfMonth, format } from 'date-fns';

/**
 * Sync sales data from monthly_commissions to goals metrics
 * This runs automatically after Fishbowl imports to update sales goals
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const body = await request.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: 'Missing month or year' }, { status: 400 });
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(new Date(year, month - 1, 1));

    // Fetch monthly_commissions data grouped by salesPerson and customer accountType
    const commissionsSnapshot = await adminDb
      .collection('monthly_commissions')
      .where('commissionMonth', '==', monthStr)
      .get();

    // Aggregate sales by user and account type
    const salesByUser = new Map<string, { wholesale: number; distribution: number }>();
    const userIdMap = new Map<string, string>(); // Map salesPerson name to userId

    // First, get user mappings
    const usersSnapshot = await adminDb.collection('users').get();
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.name) {
        userIdMap.set(userData.name.toLowerCase(), doc.id);
      }
    });

    commissionsSnapshot.forEach(doc => {
      const data = doc.data();
      const salesPerson = data.salesPerson || '';
      const customerId = data.customerId;
      const totalPrice = parseFloat(data.totalPrice) || 0;

      if (!salesPerson || totalPrice <= 0) return;

      const userId = userIdMap.get(salesPerson.toLowerCase());
      if (!userId) return;

      if (!salesByUser.has(userId)) {
        salesByUser.set(userId, { wholesale: 0, distribution: 0 });
      }

      const userSales = salesByUser.get(userId)!;

      // Determine account type from customer record
      // We'll need to fetch customer data to determine if wholesale or distribution
      // For now, we'll aggregate total and split based on customer type later
      userSales.wholesale += totalPrice; // Placeholder - will be refined
    });

    // Fetch customer account types to properly categorize sales
    const customerIds = new Set<string>();
    commissionsSnapshot.forEach(doc => {
      const customerId = doc.data().customerId;
      if (customerId) customerIds.add(customerId);
    });

    const customerTypes = new Map<string, string>();
    if (customerIds.size > 0) {
      const customersSnapshot = await adminDb
        .collection('fishbowl_customers')
        .where('customerId', 'in', Array.from(customerIds).slice(0, 10)) // Firestore 'in' limit
        .get();

      customersSnapshot.forEach(doc => {
        const data = doc.data();
        customerTypes.set(data.customerId, (data.accountType || '').toLowerCase());
      });
    }

    // Re-aggregate with proper account types
    const properSalesByUser = new Map<string, { wholesale: number; distribution: number }>();
    
    commissionsSnapshot.forEach(doc => {
      const data = doc.data();
      const salesPerson = data.salesPerson || '';
      const customerId = data.customerId;
      const totalPrice = parseFloat(data.totalPrice) || 0;
      const accountType = customerTypes.get(customerId) || '';

      if (!salesPerson || totalPrice <= 0) return;

      const userId = userIdMap.get(salesPerson.toLowerCase());
      if (!userId) return;

      if (!properSalesByUser.has(userId)) {
        properSalesByUser.set(userId, { wholesale: 0, distribution: 0 });
      }

      const userSales = properSalesByUser.get(userId)!;

      if (accountType.includes('distributor')) {
        userSales.distribution += totalPrice;
      } else if (accountType.includes('wholesale')) {
        userSales.wholesale += totalPrice;
      } else {
        // Default to wholesale for retail/unknown
        userSales.wholesale += totalPrice;
      }
    });

    // Log metrics for each user
    const metricsLogged = [];
    const metricDate = new Date(year, month - 1, 15); // Mid-month date for monthly metrics

    for (const [userId, sales] of properSalesByUser.entries()) {
      // Log wholesale sales
      if (sales.wholesale > 0) {
        const metricId = await metricService.logMetric({
          userId,
          type: 'new_sales_wholesale',
          value: sales.wholesale,
          date: metricDate,
          source: 'fishbowl',
          metadata: {
            month: monthStr,
            syncDate: new Date().toISOString()
          }
        });
        metricsLogged.push(metricId);
      }

      // Log distribution sales
      if (sales.distribution > 0) {
        const metricId = await metricService.logMetric({
          userId,
          type: 'new_sales_distribution',
          value: sales.distribution,
          date: metricDate,
          source: 'fishbowl',
          metadata: {
            month: monthStr,
            syncDate: new Date().toISOString()
          }
        });
        metricsLogged.push(metricId);
      }
    }

    return NextResponse.json({
      success: true,
      month: monthStr,
      usersProcessed: properSalesByUser.size,
      metricsLogged: metricsLogged.length,
      salesData: Object.fromEntries(
        Array.from(properSalesByUser.entries()).map(([userId, sales]) => [
          userId,
          {
            wholesale: sales.wholesale,
            distribution: sales.distribution,
            total: sales.wholesale + sales.distribution
          }
        ])
      )
    });
  } catch (error) {
    console.error('Error syncing sales metrics:', error);
    return NextResponse.json({ error: 'Failed to sync sales data' }, { status: 500 });
  }
}
