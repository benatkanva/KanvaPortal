import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// State name to abbreviation mapping
const stateNameToAbbr: { [key: string]: string } = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
  'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
  'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
  'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
  'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
  'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
  'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
};

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (normalized.length === 2) return normalized;
  return stateNameToAbbr[normalized] || normalized.slice(0, 2);
}

/**
 * Scheduled function to refresh customer metrics nightly at 2 AM PST
 * Runs every day at 2:00 AM Pacific Time
 */
export const refreshCustomerMetricsNightly = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '2GB'
  })
  .pubsub.schedule('0 2 * * *') // Every day at 2 AM
  .timeZone('America/Los_Angeles') // PST/PDT
  .onRun(async (context: functions.EventContext) => {
    const startTime = Date.now();
    console.log('🚀 Starting nightly customer metrics refresh...');

    try {
      // Load all customers
      console.log('📦 Loading customers from fishbowl_customers...');
      const customersSnapshot = await db.collection('fishbowl_customers').get();
      console.log(`✅ Found ${customersSnapshot.size} customers`);

      // Load all sales orders
      console.log('📦 Loading orders from fishbowl_sales_orders...');
      const ordersSnapshot = await db.collection('fishbowl_sales_orders').get();
      console.log(`✅ Found ${ordersSnapshot.size} orders`);

      // Load regions for state-to-region mapping
      console.log('📦 Loading regions for state mapping...');
      const regionsSnapshot = await db.collection('regions').get();
      const stateToRegionMap = new Map<string, { name: string; color: string }>();
      regionsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.states && Array.isArray(data.states)) {
          data.states.forEach((state: string) => {
            stateToRegionMap.set(state.toUpperCase(), {
              name: data.name,
              color: data.color || '#808080'
            });
          });
        }
      });
      console.log(`✅ Loaded ${regionsSnapshot.size} regions with ${stateToRegionMap.size} state mappings`);

      // Load users for sales rep mapping
      console.log('📦 Loading users for sales rep mapping...');
      const usersSnapshot = await db.collection('users').get();
      const usersMap = new Map<string, any>();
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.salesPerson) {
          usersMap.set(data.salesPerson, {
            id: doc.id,
            name: data.name,
            region: data.region || '',
            regionalTerritory: data.regionalTerritory || '',
            email: data.email || ''
          });
        }
      });
      console.log(`✅ Loaded ${usersMap.size} sales reps`);

      // Group orders by customer
      console.log('🔄 Aggregating sales data by customer...');
      const customerOrders = new Map<string, any[]>();
      
      ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        const customerId = order.customerId || order.customerName;
        
        if (!customerOrders.has(customerId)) {
          customerOrders.set(customerId, []);
        }
        
        customerOrders.get(customerId)!.push({
          revenue: Number(order.revenue) || 0,
          postingDateStr: order.postingDateStr || '',
          postingDate: order.postingDate,
          orderNum: order.orderNum || ''
        });
      });
      console.log(`✅ Aggregated orders for ${customerOrders.size} customers`);

      // Calculate date thresholds
      const now = new Date();
      const ytdStart = new Date(now.getFullYear(), 0, 1);
      const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const days180Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const months12Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Create summaries in batches
      console.log('📊 Creating customer summaries...');
      let summariesCreated = 0;
      let summariesFailed = 0;
      const batchSize = 50;
      const customerDocs = customersSnapshot.docs;

      for (let i = 0; i < customerDocs.length; i += batchSize) {
        const batch = customerDocs.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (customerDoc) => {
          try {
            const customer = customerDoc.data();
            const customerId = customer.id || customerDoc.id;
            const orders = customerOrders.get(customerId) || [];

            // Calculate metrics
            let totalSales = 0;
            let totalSalesYTD = 0;
            let sales_30d = 0;
            let sales_90d = 0;
            let sales_12m = 0;
            let orders_30d = 0;
            let orders_90d = 0;
            let orders_12m = 0;
            let firstOrderDate: Date | null = null;
            let lastOrderDate: Date | null = null;
            let lastOrderAmount = 0;

            const monthlySales = new Map<string, number>();
            const orderDates: Date[] = [];
            
            orders.forEach(order => {
              const revenue = order.revenue;
              totalSales += revenue;

              let orderDate: Date | null = null;
              if (order.postingDate && order.postingDate.toDate) {
                orderDate = order.postingDate.toDate();
              } else if (order.postingDateStr) {
                const parts = order.postingDateStr.split('/');
                if (parts.length === 3) {
                  orderDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
                }
              }

              if (orderDate) {
                orderDates.push(orderDate);
                
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                monthlySales.set(monthKey, (monthlySales.get(monthKey) || 0) + revenue);
                
                if (orderDate >= ytdStart) {
                  totalSalesYTD += revenue;
                }

                if (orderDate >= days30Ago) {
                  sales_30d += revenue;
                  orders_30d++;
                }
                if (orderDate >= days90Ago) {
                  sales_90d += revenue;
                  orders_90d++;
                }
                if (orderDate >= months12Ago) {
                  sales_12m += revenue;
                  orders_12m++;
                }

                if (!firstOrderDate || orderDate < firstOrderDate) {
                  firstOrderDate = orderDate;
                }
                if (!lastOrderDate || orderDate > lastOrderDate) {
                  lastOrderDate = orderDate;
                  lastOrderAmount = revenue;
                }
              }
            });
            
            const velocity = orders_12m > 0 ? orders_12m / 12 : 0;
            
            let sales_90to180d = 0;
            orderDates.forEach(date => {
              if (date >= days180Ago && date < days90Ago) {
                const order = orders.find(o => {
                  if (o.postingDate && o.postingDate.toDate) {
                    return o.postingDate.toDate().getTime() === date.getTime();
                  }
                  return false;
                });
                if (order) sales_90to180d += order.revenue;
              }
            });
            
            const trend = sales_90to180d > 0 
              ? ((sales_90d - sales_90to180d) / sales_90to180d) * 100 
              : 0;
            
            const daysSinceLastOrder = lastOrderDate 
              ? Math.floor((now.getTime() - (lastOrderDate as Date).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            const avgOrderValue = orders.length > 0 ? totalSales / orders.length : 0;
            
            const monthlySalesArray = Array.from(monthlySales.entries())
              .map(([month, sales]) => ({ month, sales }))
              .sort((a, b) => a.month.localeCompare(b.month));

            const salesPerson = customer.salesPerson || '';
            const repInfo = usersMap.get(salesPerson) || { id: '', name: salesPerson, region: '', regionalTerritory: '', email: '' };

            const stateAbbr = normalizeState(customer.shippingState || '');
            const regionInfo = stateToRegionMap.get(stateAbbr) || { name: '', color: '#808080' };

            const summary = {
              customerId: customerId,
              customerName: customer.name || '',
              totalSales: totalSales,
              totalSalesYTD: totalSalesYTD,
              orderCount: orders.length,
              orderCountYTD: orders.filter((o: any) => {
                if (o.postingDate && o.postingDate.toDate) {
                  return o.postingDate.toDate() >= ytdStart;
                }
                return false;
              }).length,
              sales_30d: sales_30d,
              sales_90d: sales_90d,
              sales_12m: sales_12m,
              orders_30d: orders_30d,
              orders_90d: orders_90d,
              orders_12m: orders_12m,
              firstOrderDate: firstOrderDate ? (firstOrderDate as Date).toISOString().split('T')[0] : null,
              lastOrderDate: lastOrderDate ? (lastOrderDate as Date).toISOString().split('T')[0] : null,
              lastOrderAmount: lastOrderAmount,
              avgOrderValue: avgOrderValue,
              velocity: velocity,
              trend: trend,
              daysSinceLastOrder: daysSinceLastOrder,
              monthlySales: monthlySalesArray,
              salesPerson: salesPerson,
              salesPersonName: repInfo.name,
              salesPersonId: repInfo.id,
              salesPersonRegion: repInfo.region,
              salesPersonTerritory: repInfo.regionalTerritory,
              region: regionInfo.name,
              regionColor: regionInfo.color,
              accountType: customer.accountType || '',
              shippingAddress: customer.shippingAddress || '',
              shippingCity: customer.shippingCity || '',
              shippingState: customer.shippingState || '',
              shippingZip: customer.shippingZip || '',
              lat: customer.lat || null,
              lng: customer.lng || null,
              copperId: customer.copperId || null,
              lastUpdatedAt: admin.firestore.Timestamp.now()
            };

            const summaryRef = db.collection('customer_sales_summary').doc(customerId);
            await summaryRef.set(summary);
            summariesCreated++;
          } catch (error) {
            console.error(`❌ Failed to create summary for customer ${customerDoc.id}:`, error);
            summariesFailed++;
          }
        }));

        console.log(`  💾 Progress: ${summariesCreated}/${customerDocs.length} summaries created`);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log('✅ Nightly refresh complete!');
      console.log(`📊 Created ${summariesCreated} customer summaries`);
      console.log(`❌ Failed ${summariesFailed} summaries`);
      console.log(`⏱️  Duration: ${duration} seconds`);

      // Log to a collection for monitoring
      await db.collection('scheduled_job_logs').add({
        jobName: 'refreshCustomerMetrics',
        status: 'success',
        summariesCreated,
        summariesFailed,
        duration,
        timestamp: admin.firestore.Timestamp.now()
      });

      return null;

    } catch (error: any) {
      console.error('❌ Nightly refresh failed:', error);
      
      // Log failure
      await db.collection('scheduled_job_logs').add({
        jobName: 'refreshCustomerMetrics',
        status: 'failed',
        error: error.message,
        timestamp: admin.firestore.Timestamp.now()
      });

      throw error;
    }
  });
