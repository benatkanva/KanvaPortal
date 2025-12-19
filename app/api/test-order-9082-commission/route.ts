/**
 * Test endpoint - Calculate commission for ONLY Order 9082
 * Returns detailed breakdown in response
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const output: string[] = [];
    const log = (msg: string) => {
      console.log(msg);
      output.push(msg);
    };
    
    log('\n🔍 ========== ORDER 9082 COMMISSION TEST ==========\n');
    
    // Get commission rules (same location as actual calculation)
    const rulesDoc = await adminDb.collection('settings').doc('commission_rules').get();
    const commissionRules = rulesDoc.exists ? rulesDoc.data() : {
      excludeShipping: true,
      excludeCCProcessing: true,
      useOrderValue: true
    } as any;
    log(`Commission Rules: excludeShipping=${commissionRules?.excludeShipping ?? true}, excludeCCProcessing=${commissionRules?.excludeCCProcessing ?? true}`);
    
    // Find Order 9082
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('num', '==', '9082')
      .get();
    
    if (ordersSnapshot.empty) {
      return NextResponse.json({ error: 'Order 9082 not found' });
    }
    
    const order = ordersSnapshot.docs[0].data();
    log(`\nOrder Details:`);
    log(`   Order #: ${order.num}`);
    log(`   Sales Order ID: ${order.salesOrderId}`);
    log(`   Order Revenue: $${order.revenue}`);
    log(`   Customer: ${order.customerName}`);
    log(`   Sales Person: ${order.salesPerson}`);
    
    // Get line items
    log(`\n📦 Fetching Line Items:`);
    log(`   Query: salesOrderId == "${order.salesOrderId}"`);
    
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('salesOrderId', '==', order.salesOrderId)
      .get();
    
    log(`   Found: ${lineItemsSnapshot.size} line items\n`);
    
    if (lineItemsSnapshot.empty) {
      log('❌ NO LINE ITEMS FOUND!');
      return NextResponse.json({
        error: 'No line items found',
        output: output.join('\n')
      });
    }
    
    // Process each line item
    let positiveBase = 0;           // Sum of positive, commissionable items
    let negativeAdjustments = 0;    // Sum of negative items (credits, rep-paid shipping)
    const lineItemDetails: any[] = [];
    
    log('Processing Line Items:\n');
    
    for (const doc of lineItemsSnapshot.docs) {
      const item = doc.data();
      const itemPrice = item.totalPrice || item.revenue || 0;
      const partNumber = item.partNumber || item.productNum || item.product || '';
      const isShippingFlag = item.isShippingItem || false;
      
      log(`   📦 ${partNumber || 'Unknown'}`);
      log(`      Total Price: $${itemPrice}`);
      log(`      isShippingItem flag: ${isShippingFlag}`);
      log(`      Is Negative: ${itemPrice < 0}`);
      
      // Decision logic
      if (itemPrice < 0) {
        // Track negative amounts separately to deduct from FINAL commission
        negativeAdjustments += itemPrice;
        log(`      💳 NEGATIVE (will be deducted from commission)`);
        
        lineItemDetails.push({
          product: partNumber,
          price: itemPrice,
          action: 'NEGATIVE',
          reason: 'Negative amount (deduct from final commission)'
        });
      } else if (isShippingFlag && (commissionRules?.excludeShipping ?? true)) {
        // Exclude positive shipping by default (unless explicitly disabled)
        log(`      🚫 EXCLUDED (Shipping)`);
        
        lineItemDetails.push({
          product: partNumber,
          price: itemPrice,
          action: 'EXCLUDED',
          reason: 'Positive shipping (excludeShipping enabled)'
        });
      } else {
        // Include everything else in the POSITIVE base only
        positiveBase += itemPrice;
        const itemType = isShippingFlag ? 'Shipping (included)' : 'Product';
        log(`      ✅ INCLUDED (${itemType}) - Positive base running total: $${positiveBase}`);
        
        lineItemDetails.push({
          product: partNumber,
          price: itemPrice,
          action: 'INCLUDED',
          reason: isShippingFlag ? 'Shipping (excludeShipping off)' : 'Regular product'
        });
      }
      
      log('');
    }
    
    // Calculate commission using CFO method:
    // 1) Commission on positive items
    // 2) Then subtract negative adjustments from the commission
    const rate = 8.0; // Distributor new customer rate
    const commissionBeforeAdjust = new Decimal(positiveBase).times(rate).dividedBy(100).toNumber();
    const commission = commissionBeforeAdjust + negativeAdjustments; // negativeAdjustments is negative
    
    log(`\n📊 FINAL CALCULATION:`);
    log(`   Positive Base: $${positiveBase.toFixed(2)}`);
    log(`   Rate: ${rate}%`);
    log(`   Commission before negatives: $${commissionBeforeAdjust.toFixed(2)}`);
    log(`   Negative adjustments: $${negativeAdjustments.toFixed(2)}`);
    log(`   Final Commission: $${commission.toFixed(2)}`);
    log(`\n   Expected (CFO): $2,380.40`);
    log(`   Match: ${Math.abs(commission - 2380.40) < 1 ? '✅ YES' : '❌ NO'}`);
    log('\n🔍 ========== TEST COMPLETE ==========\n');
    
    return NextResponse.json({
      success: true,
      order: {
        num: order.num,
        revenue: order.revenue,
        salesOrderId: order.salesOrderId
      },
      lineItems: lineItemDetails,
      calculation: {
        positiveBase: positiveBase,
        negativeAdjustments: negativeAdjustments,
        rate: rate,
        commission: commission,
        expected: 2380.40,
        match: Math.abs(commission - 2380.40) < 1
      },
      output: output.join('\n')
    });
    
  } catch (error: any) {
    console.error('❌ Test error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
