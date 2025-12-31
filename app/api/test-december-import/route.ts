import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('\n🔍 TESTING DECEMBER 2025 IMPORT DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check orders for December 2025
    const dec2025Orders = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2025-12')
      .limit(10)
      .get();
    
    console.log(`\n📦 December 2025 Orders: ${dec2025Orders.size}`);
    
    if (dec2025Orders.size > 0) {
      dec2025Orders.forEach(doc => {
        const order = doc.data();
        console.log(`\nOrder: ${order.soNumber}`);
        console.log(`  Sales Person: ${order.salesPerson}`);
        console.log(`  Commission Month: ${order.commissionMonth}`);
        console.log(`  Commission Year: ${order.commissionYear}`);
        console.log(`  Posting Date: ${order.postingDate?.toDate?.()}`);
      });
    }
    
    // Check line items for December 2025
    const dec2025Items = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2025-12')
      .limit(10)
      .get();
    
    console.log(`\n📦 December 2025 Line Items: ${dec2025Items.size}`);
    
    if (dec2025Items.size > 0) {
      let totalRevenue = 0;
      dec2025Items.forEach(doc => {
        const item = doc.data();
        totalRevenue += item.totalPrice || 0;
        console.log(`\nLine Item: ${item.soItemId}`);
        console.log(`  Order: ${item.soNumber}`);
        console.log(`  Sales Person: ${item.salesPerson}`);
        console.log(`  Total Price: $${item.totalPrice?.toFixed(2)}`);
        console.log(`  Commission Month: ${item.commissionMonth}`);
      });
      console.log(`\n💰 Sample Revenue (first 10 items): $${totalRevenue.toFixed(2)}`);
    }
    
    // Get total count for December 2025
    const allDec2025Orders = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    const allDec2025Items = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    console.log(`\n📊 TOTALS FOR DECEMBER 2025:`);
    console.log(`   Orders: ${allDec2025Orders.size}`);
    console.log(`   Line Items: ${allDec2025Items.size}`);
    
    // Calculate total revenue by sales person
    const revenueBySalesPerson = new Map<string, number>();
    allDec2025Items.forEach(doc => {
      const item = doc.data();
      const salesPerson = item.salesPerson || 'Unknown';
      const revenue = item.totalPrice || 0;
      revenueBySalesPerson.set(salesPerson, (revenueBySalesPerson.get(salesPerson) || 0) + revenue);
    });
    
    console.log(`\n💰 REVENUE BY SALES PERSON (December 2025):`);
    const sortedReps = Array.from(revenueBySalesPerson.entries())
      .sort((a, b) => b[1] - a[1]);
    
    let grandTotal = 0;
    sortedReps.forEach(([salesPerson, revenue]) => {
      console.log(`   ${salesPerson}: $${revenue.toFixed(2)}`);
      grandTotal += revenue;
    });
    console.log(`   ─────────────────────────────────`);
    console.log(`   GRAND TOTAL: $${grandTotal.toFixed(2)}`);
    
    return NextResponse.json({
      success: true,
      december2025: {
        orders: allDec2025Orders.size,
        lineItems: allDec2025Items.size,
        totalRevenue: grandTotal,
        revenueBySalesPerson: Object.fromEntries(revenueBySalesPerson)
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error testing December import:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
