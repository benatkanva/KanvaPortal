const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// State name to abbreviation mapping
const stateNameToAbbr = {
  "ALABAMA": "AL",
  "ALASKA": "AK",
  "ARIZONA": "AZ",
  "ARKANSAS": "AR",
  "CALIFORNIA": "CA",
  "COLORADO": "CO",
  "CONNECTICUT": "CT",
  "DELAWARE": "DE",
  "FLORIDA": "FL",
  "GEORGIA": "GA",
  "HAWAII": "HI",
  "IDAHO": "ID",
  "ILLINOIS": "IL",
  "INDIANA": "IN",
  "IOWA": "IA",
  "KANSAS": "KS",
  "KENTUCKY": "KY",
  "LOUISIANA": "LA",
  "MAINE": "ME",
  "MARYLAND": "MD",
  "MASSACHUSETTS": "MA",
  "MICHIGAN": "MI",
  "MINNESOTA": "MN",
  "MISSISSIPPI": "MS",
  "MISSOURI": "MO",
  "MONTANA": "MT",
  "NEBRASKA": "NE",
  "NEVADA": "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  "OHIO": "OH",
  "OKLAHOMA": "OK",
  "OREGON": "OR",
  "PENNSYLVANIA": "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  "TENNESSEE": "TN",
  "TEXAS": "TX",
  "UTAH": "UT",
  "VERMONT": "VT",
  "VIRGINIA": "VA",
  "WASHINGTON": "WA",
  "WEST VIRGINIA": "WV",
  "WISCONSIN": "WI",
  "WYOMING": "WY",
};

/**
 * Normalize state name to abbreviation
 * @param {string} state - State name or abbreviation
 * @return {string} State abbreviation
 */
function normalizeState(state) {
  const normalized = state.trim().toUpperCase();
  if (normalized.length === 2) return normalized;
  return stateNameToAbbr[normalized] || normalized.slice(0, 2);
}

/**
 * Scheduled function to refresh customer metrics nightly at 2 AM PST
 * Runs every day at 2:00 AM Pacific Time
 */
exports.refreshCustomerMetricsNightly = functions
    .runWith({
      timeoutSeconds: 540,
      memory: "2GB",
    })
    .pubsub.schedule("0 2 * * *")
    .timeZone("America/Los_Angeles")
    .onRun(async (context) => {
      const startTime = Date.now();
      console.log("🚀 Starting nightly customer metrics refresh...");

      try {
        console.log("📦 Loading customers...");
        const customersSnap = await db.collection("fishbowl_customers")
            .get();
        console.log(`✅ Found ${customersSnap.size} customers`);

        console.log("📦 Loading orders...");
        const ordersSnap = await db.collection("fishbowl_sales_orders")
            .get();
        console.log(`✅ Found ${ordersSnap.size} orders`);

        console.log("📦 Loading regions...");
        const regionsSnap = await db.collection("regions").get();
        const stateToRegionMap = new Map();
        regionsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.states && Array.isArray(data.states)) {
            data.states.forEach((state) => {
              stateToRegionMap.set(state.toUpperCase(), {
                name: data.name,
                color: data.color || "#808080",
              });
            });
          }
        });
        console.log(`✅ Loaded ${regionsSnap.size} regions`);

        console.log("📦 Loading users...");
        const usersSnap = await db.collection("users").get();
        const usersMap = new Map();
        usersSnap.forEach((doc) => {
          const data = doc.data();
          if (data.salesPerson) {
            usersMap.set(data.salesPerson, {
              id: doc.id,
              name: data.name,
              region: data.region || "",
              regionalTerritory: data.regionalTerritory || "",
              email: data.email || "",
            });
          }
        });
        console.log(`✅ Loaded ${usersMap.size} sales reps`);

        console.log("🔄 Aggregating sales data...");
        const customerOrders = new Map();

        ordersSnap.forEach((doc) => {
          const order = doc.data();
          const customerId = order.customerId || order.customerName;

          if (!customerOrders.has(customerId)) {
            customerOrders.set(customerId, []);
          }

          customerOrders.get(customerId).push({
            revenue: Number(order.revenue) || 0,
            postingDateStr: order.postingDateStr || "",
            postingDate: order.postingDate,
            orderNum: order.orderNum || "",
          });
        });
        console.log(`✅ Aggregated ${customerOrders.size} customers`);

        const now = new Date();
        const ytdStart = new Date(now.getFullYear(), 0, 1);
        const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const days180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const months12 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        console.log("📊 Creating summaries...");
        let created = 0;
        let failed = 0;
        const batchSize = 50;
        const customerDocs = customersSnap.docs;

        for (let i = 0; i < customerDocs.length; i += batchSize) {
          const batch = customerDocs.slice(i, i + batchSize);

          await Promise.all(batch.map(async (customerDoc) => {
            try {
              const customer = customerDoc.data();
              const customerId = customer.id || customerDoc.id;
              const orders = customerOrders.get(customerId) || [];

              let totalSales = 0;
              let totalSalesYTD = 0;
              let sales30d = 0;
              let sales90d = 0;
              let sales12m = 0;
              let orders30d = 0;
              let orders90d = 0;
              let orders12m = 0;
              let firstOrderDate = null;
              let lastOrderDate = null;
              let lastOrderAmount = 0;

              const monthlySales = new Map();
              const orderDates = [];

              orders.forEach((order) => {
                const revenue = order.revenue;
                totalSales += revenue;

                let orderDate = null;
                if (order.postingDate && order.postingDate.toDate) {
                  orderDate = order.postingDate.toDate();
                } else if (order.postingDateStr) {
                  const parts = order.postingDateStr.split("/");
                  if (parts.length === 3) {
                    orderDate = new Date(
                        parseInt(parts[2]),
                        parseInt(parts[0]) - 1,
                        parseInt(parts[1]),
                    );
                  }
                }

                if (orderDate) {
                  orderDates.push(orderDate);

                  const monthKey = `${orderDate.getFullYear()}-` +
                    `${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
                  monthlySales.set(
                      monthKey,
                      (monthlySales.get(monthKey) || 0) + revenue,
                  );

                  if (orderDate >= ytdStart) totalSalesYTD += revenue;
                  if (orderDate >= days30) {
                    sales30d += revenue;
                    orders30d++;
                  }
                  if (orderDate >= days90) {
                    sales90d += revenue;
                    orders90d++;
                  }
                  if (orderDate >= months12) {
                    sales12m += revenue;
                    orders12m++;
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

              const velocity = orders12m > 0 ? orders12m / 12 : 0;

              let sales90to180d = 0;
              orderDates.forEach((date) => {
                if (date >= days180 && date < days90) {
                  const order = orders.find((o) => {
                    if (o.postingDate && o.postingDate.toDate) {
                      return o.postingDate.toDate().getTime() ===
                        date.getTime();
                    }
                    return false;
                  });
                  if (order) sales90to180d += order.revenue;
                }
              });

              const trend = sales90to180d > 0 ?
                ((sales90d - sales90to180d) / sales90to180d) * 100 : 0;

              const daysSince = lastOrderDate ?
                Math.floor((now.getTime() - lastOrderDate.getTime()) /
                  (1000 * 60 * 60 * 24)) : null;

              const avgOrderValue = orders.length > 0 ?
                totalSales / orders.length : 0;

              const monthlySalesArray = Array.from(monthlySales.entries())
                  .map(([month, sales]) => ({month, sales}))
                  .sort((a, b) => a.month.localeCompare(b.month));

              const salesPerson = customer.salesPerson || "";
              const repInfo = usersMap.get(salesPerson) || {
                id: "",
                name: salesPerson,
                region: "",
                regionalTerritory: "",
                email: "",
              };

              const stateAbbr = normalizeState(
                  customer.shippingState || "",
              );
              const regionInfo = stateToRegionMap.get(stateAbbr) || {
                name: "",
                color: "#808080",
              };

              const summary = {
                customerId: customerId,
                customerName: customer.name || "",
                totalSales: totalSales,
                totalSalesYTD: totalSalesYTD,
                orderCount: orders.length,
                orderCountYTD: orders.filter((o) => {
                  if (o.postingDate && o.postingDate.toDate) {
                    return o.postingDate.toDate() >= ytdStart;
                  }
                  return false;
                }).length,
                sales30d: sales30d,
                sales90d: sales90d,
                sales12m: sales12m,
                orders30d: orders30d,
                orders90d: orders90d,
                orders12m: orders12m,
                firstOrderDate: firstOrderDate ?
                  firstOrderDate.toISOString().split("T")[0] : null,
                lastOrderDate: lastOrderDate ?
                  lastOrderDate.toISOString().split("T")[0] : null,
                lastOrderAmount: lastOrderAmount,
                avgOrderValue: avgOrderValue,
                velocity: velocity,
                trend: trend,
                daysSinceLastOrder: daysSince,
                monthlySales: monthlySalesArray,
                salesPerson: salesPerson,
                salesPersonName: repInfo.name,
                salesPersonId: repInfo.id,
                salesPersonRegion: repInfo.region,
                salesPersonTerritory: repInfo.regionalTerritory,
                region: regionInfo.name,
                regionColor: regionInfo.color,
                accountType: customer.accountType || "",
                shippingAddress: customer.shippingAddress || "",
                shippingCity: customer.shippingCity || "",
                shippingState: customer.shippingState || "",
                shippingZip: customer.shippingZip || "",
                lat: customer.lat || null,
                lng: customer.lng || null,
                copperId: customer.copperId || null,
                lastUpdatedAt: admin.firestore.Timestamp.now(),
              };

              const summaryRef = db.collection("customer_sales_summary")
                  .doc(customerId);
              await summaryRef.set(summary);
              created++;
            } catch (error) {
              console.error(`❌ Failed for ${customerDoc.id}:`, error);
              failed++;
            }
          }));

          console.log(`  💾 Progress: ${created}/${customerDocs.length}`);
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log("✅ Nightly refresh complete!");
        console.log(`📊 Created ${created} summaries`);
        console.log(`❌ Failed ${failed} summaries`);
        console.log(`⏱️  Duration: ${duration} seconds`);

        await db.collection("scheduled_job_logs").add({
          jobName: "refreshCustomerMetrics",
          status: "success",
          summariesCreated: created,
          summariesFailed: failed,
          duration: duration,
          timestamp: admin.firestore.Timestamp.now(),
        });

        return null;
      } catch (error) {
        console.error("❌ Nightly refresh failed:", error);

        await db.collection("scheduled_job_logs").add({
          jobName: "refreshCustomerMetrics",
          status: "failed",
          error: error.message,
          timestamp: admin.firestore.Timestamp.now(),
        });

        throw error;
      }
    });
