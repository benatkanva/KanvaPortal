import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('\n🔍 CHECKING DECEMBER 2025 DATA IN FIRESTORE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Get all December 2025 orders
    const dec2025Orders = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    console.log(`\n📦 December 2025 Orders: ${dec2025Orders.size}`);
    
    // Get all December 2025 line items
    const dec2025Items = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    console.log(`📦 December 2025 Line Items: ${dec2025Items.size}`);
    
    // Calculate revenue by sales person
    const revenueBySalesPerson = new Map<string, { revenue: number; items: number; orders: Set<string> }>();
    
    dec2025Items.forEach(doc => {
      const item = doc.data();
      const salesPerson = item.salesPerson || 'Unknown';
      const revenue = item.totalPrice || 0;
      const orderNum = item.soNumber || item.salesOrderId;
      
      if (!revenueBySalesPerson.has(salesPerson)) {
        revenueBySalesPerson.set(salesPerson, { revenue: 0, items: 0, orders: new Set() });
      }
      
      const data = revenueBySalesPerson.get(salesPerson)!;
      data.revenue += revenue;
      data.items++;
      if (orderNum) data.orders.add(orderNum);
    });
    
    console.log(`\n💰 REVENUE BY SALES PERSON (December 2025):`);
    const sortedReps = Array.from(revenueBySalesPerson.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue);
    
    let grandTotal = 0;
    sortedReps.forEach(([salesPerson, data]) => {
      console.log(`   ${salesPerson}: $${data.revenue.toFixed(2)} (${data.items} items, ${data.orders.size} orders)`);
      grandTotal += data.revenue;
    });
    console.log(`   ─────────────────────────────────`);
    console.log(`   GRAND TOTAL: $${grandTotal.toFixed(2)}`);
    
    console.log(`\n📊 EXPECTED (from Excel):`);
    console.log(`   BenW: $291,879.50`);
    console.log(`   Zalak: $393,355.20`);
    console.log(`   DerekW: $318,966.95`);
    console.log(`   BrandonG: $267,930.38`);
    console.log(`   Jared: $160,166.70`);
    console.log(`   TOTAL: $1,432,298.73`);
    
    console.log(`\n⚠️  DISCREPANCY: $${(1432298.73 - grandTotal).toFixed(2)}`);
    
    // Check for orders with wrong commission month
    console.log(`\n🔍 Checking for December orders with wrong commissionMonth...`);
    const allOrders = await adminDb.collection('fishbowl_sales_orders')
      .get();
    
    let wrongMonthCount = 0;
    const wrongMonthOrders: any[] = [];
    
    allOrders.forEach(doc => {
      const order = doc.data();
      const postingDate = order.postingDate?.toDate();
      if (postingDate && postingDate.getMonth() === 11 && postingDate.getFullYear() === 2025) {
        // This is a December 2025 order
        if (order.commissionMonth !== '2025-12') {
          wrongMonthCount++;
          wrongMonthOrders.push({
            soNumber: order.soNumber,
            commissionMonth: order.commissionMonth,
            postingDate: postingDate.toISOString(),
            salesPerson: order.salesPerson
          });
        }
      }
    });
    
    console.log(`   Found ${wrongMonthCount} December orders with wrong commissionMonth`);
    if (wrongMonthOrders.length > 0) {
      console.log(`   Sample wrong orders:`, wrongMonthOrders.slice(0, 10));
    }
    
    return NextResponse.json({
      success: true,
      december2025: {
        orders: dec2025Orders.size,
        lineItems: dec2025Items.size,
        totalRevenue: grandTotal,
        revenueBySalesPerson: Object.fromEntries(
          Array.from(revenueBySalesPerson.entries()).map(([sp, data]) => [sp, {
            revenue: data.revenue,
            items: data.items,
            orders: data.orders.size
          }])
        ),
        expected: 1432298.73,
        discrepancy: 1432298.73 - grandTotal,
        wrongMonthOrders: wrongMonthCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error checking December data:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
