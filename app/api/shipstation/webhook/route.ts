import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ShipStation webhook event types
type WebhookEvent = 
  | 'ORDER_NOTIFY'           // New Orders
  | 'ITEM_ORDER_NOTIFY'      // Order item updates
  | 'SHIP_NOTIFY'            // Order Shipped
  | 'ITEM_SHIP_NOTIFY'       // Item shipped
  | 'FULFILLMENT_SHIPPED'    // Fulfillment Shipped
  | 'FULFILLMENT_REJECTED';  // Fulfillment Rejected

interface ShipStationWebhookPayload {
  resource_url: string;
  resource_type: string;
}

// Log webhook events for debugging
async function logWebhookEvent(
  event: string,
  payload: unknown,
  status: 'received' | 'processed' | 'error',
  details?: string
) {
  try {
    await adminDb.collection('shipstation_webhook_logs').add({
      event,
      payload,
      status,
      details,
      receivedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}

// Fetch order details from resource_url and update Firestore
async function processOrderUpdate(resourceUrl: string) {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('ShipStation API credentials not configured');
  }

  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const response = await fetch(resourceUrl, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`);
  }

  const data = await response.json();
  const orders = data.orders || [data];
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  
  for (const order of orders) {
    if (!order.orderId) continue;
    
    const orderRef = adminDb.collection('shipstation_orders').doc(String(order.orderId));
    
    await orderRef.set({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      orderDate: Timestamp.fromDate(new Date(order.orderDate || order.createDate)),
      orderStatus: order.orderStatus,
      customerEmail: order.customerEmail || null,
      billTo: order.billTo || {},
      shipTo: order.shipTo || {},
      items: order.items || [],
      orderTotal: order.orderTotal || 0,
      amountPaid: order.amountPaid || 0,
      taxAmount: order.taxAmount || 0,
      shippingAmount: order.shippingAmount || 0,
      customerNotes: order.customerNotes || null,
      internalNotes: order.internalNotes || null,
      shipments: order.shipments || [],
      displayStatus: order.orderStatus,
      lastSyncedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      webhookUpdated: true,
    }, { merge: true });
  }
  
  return orders.length;
}

export async function POST(request: NextRequest) {
  try {
    // Get the webhook event type from header
    const event = request.headers.get('x-shipstation-event') as WebhookEvent | null;
    
    // Parse the payload
    const payload: ShipStationWebhookPayload = await request.json();
    
    console.log(`ShipStation webhook received: ${event}`, payload);
    
    // Log the incoming webhook
    await logWebhookEvent(event || 'unknown', payload, 'received');
    
    // Process based on event type
    if (payload.resource_url) {
      try {
        const ordersUpdated = await processOrderUpdate(payload.resource_url);
        await logWebhookEvent(event || 'unknown', payload, 'processed', `Updated ${ordersUpdated} orders`);
        
        return NextResponse.json({ 
          success: true, 
          message: `Processed ${event}: updated ${ordersUpdated} orders` 
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await logWebhookEvent(event || 'unknown', payload, 'error', errorMsg);
        console.error('Webhook processing error:', err);
        
        // Return 200 to prevent ShipStation from retrying
        return NextResponse.json({ 
          success: false, 
          error: errorMsg 
        });
      }
    }
    
    // No resource_url - just acknowledge
    return NextResponse.json({ success: true, message: 'Webhook received' });
    
  } catch (err) {
    console.error('Webhook error:', err);
    // Return 200 to prevent retries
    return NextResponse.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
  }
}

// ShipStation may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'ShipStation webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
