/**
 * Debug endpoint to check Order 9082 line items
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('\n🔍 DEBUGGING ORDER 9082...\n');
    
    // Find the order
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('num', '==', '9082')
      .get();
    
    if (ordersSnapshot.empty) {
      return NextResponse.json({ error: 'Order 9082 not found' });
    }
    
    const orderDoc = ordersSnapshot.docs[0];
    const order = orderDoc.data();
    
    console.log('📋 ORDER 9082 DETAILS:');
    console.log(`   Document ID: ${orderDoc.id}`);
    console.log(`   Order Num: ${order.num}`);
    console.log(`   Sales Order ID: ${order.salesOrderId}`);
    console.log(`   Revenue: $${order.revenue}`);
    console.log(`   Order Value: $${order.orderValue || 'N/A'}`);
    console.log(`   Customer: ${order.customerName}`);
    console.log(`   Sales Person: ${order.salesPerson}`);
    
    // Try to find line items using salesOrderId
    console.log('\n📦 SEARCHING FOR LINE ITEMS:');
    console.log(`   Query 1: salesOrderId == "${order.salesOrderId}"`);
    
    const lineItemsByOrderId = await adminDb.collection('fishbowl_soitems')
      .where('salesOrderId', '==', order.salesOrderId)
      .get();
    
    console.log(`   Found: ${lineItemsByOrderId.size} line items\n`);
    
    // Also try by salesOrderNum
    console.log(`   Query 2: salesOrderNum == "9082"`);
    const lineItemsByOrderNum = await adminDb.collection('fishbowl_soitems')
      .where('salesOrderNum', '==', '9082')
      .get();
    
    console.log(`   Found: ${lineItemsByOrderNum.size} line items\n`);
    
    // Display line items
    if (lineItemsByOrderNum.size > 0) {
      console.log('📦 LINE ITEMS FOUND:');
      const lineItems: any[] = [];
      
      lineItemsByOrderNum.docs.forEach(doc => {
        const item = doc.data();
        console.log(`\n   Product: ${item.partNumber || item.productNum || item.product || 'Unknown'}`);
        console.log(`   Description: ${item.productName || item.description || 'N/A'}`);
        console.log(`   Total Price: $${item.totalPrice || item.revenue || 0}`);
        console.log(`   Revenue: $${item.revenue || 0}`);
        console.log(`   Quantity: ${item.quantity || 0}`);
        console.log(`   Sales Order ID: ${item.salesOrderId}`);
        console.log(`   Sales Order Num: ${item.salesOrderNum}`);
        console.log(`   isShippingItem: ${item.isShippingItem || false}`);
        console.log(`   isCCProcessingItem: ${item.isCCProcessingItem || false}`);
        
        lineItems.push({
          product: item.partNumber || item.productNum || item.product,
          description: item.productName || item.description,
          totalPrice: item.totalPrice || item.revenue || 0,
          quantity: item.quantity,
          isShippingItem: item.isShippingItem,
          salesOrderId: item.salesOrderId,
          salesOrderNum: item.salesOrderNum
        });
      });
      
      // Calculate what commission should be
      let commissionBase = 0;
      lineItems.forEach(item => {
        if (item.totalPrice < 0) {
          console.log(`\n   💳 NEGATIVE ITEM: ${item.product} = $${item.totalPrice}`);
          commissionBase += item.totalPrice;
        } else if (item.isShippingItem) {
          console.log(`   🚫 SHIPPING (excluded): ${item.product} = $${item.totalPrice}`);
        } else {
          console.log(`   ✅ PRODUCT: ${item.product} = $${item.totalPrice}`);
          commissionBase += item.totalPrice;
        }
      });
      
      console.log(`\n📊 CALCULATED COMMISSION BASE: $${commissionBase}`);
      console.log(`📊 COMMISSION (8%): $${(commissionBase * 0.08).toFixed(2)}`);
      
      return NextResponse.json({
        order: {
          id: orderDoc.id,
          num: order.num,
          salesOrderId: order.salesOrderId,
          revenue: order.revenue,
          customerName: order.customerName
        },
        lineItemsFoundByOrderId: lineItemsByOrderId.size,
        lineItemsFoundByOrderNum: lineItemsByOrderNum.size,
        lineItems,
        calculatedCommissionBase: commissionBase,
        calculatedCommission: (commissionBase * 0.08).toFixed(2),
        expectedCommission: '2693.20',
        match: Math.abs(commissionBase * 0.08 - 2693.20) < 1
      });
    } else {
      console.log('❌ NO LINE ITEMS FOUND!');
      return NextResponse.json({
        error: 'No line items found',
        order: {
          id: orderDoc.id,
          num: order.num,
          salesOrderId: order.salesOrderId,
          revenue: order.revenue
        },
        lineItemsFoundByOrderId: lineItemsByOrderId.size,
        lineItemsFoundByOrderNum: lineItemsByOrderNum.size
      });
    }
    
  } catch (error: any) {
    console.error('❌ Debug error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
