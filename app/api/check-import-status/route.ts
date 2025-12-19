import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Check if Fishbowl import is actively running
 * 
 * Looks at recent database writes to determine if import is in progress
 */
export async function GET() {
  try {
    console.log('🔍 Checking import status...\n');

    // Check most recent writes in each collection
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const fiveMinutesAgo = new Date(now.getTime() - 300000);

    // Check orders
    const recentOrdersSnap = await adminDb.collection('fishbowl_sales_orders')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();

    // Check items
    const recentItemsSnap = await adminDb.collection('fishbowl_soitems')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();

    // Check customers
    const recentCustomersSnap = await adminDb.collection('fishbowl_customers')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();

    // Count total records
    const totalOrders = recentOrdersSnap.size > 0 ? 'Unknown (use count query)' : 0;
    const totalItems = recentItemsSnap.size > 0 ? 'Unknown (use count query)' : 0;

    // Analyze timestamps
    const recentOrderWrites: any[] = [];
    const recentItemWrites: any[] = [];
    const recentCustomerWrites: any[] = [];

    recentOrdersSnap.forEach(doc => {
      const data = doc.data();
      if (data.updatedAt) {
        const updatedAt = data.updatedAt.toDate();
        const secondsAgo = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
        recentOrderWrites.push({
          orderNum: data.num,
          secondsAgo,
          timestamp: updatedAt.toISOString(),
        });
      }
    });

    recentItemsSnap.forEach(doc => {
      const data = doc.data();
      if (data.updatedAt) {
        const updatedAt = data.updatedAt.toDate();
        const secondsAgo = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
        recentItemWrites.push({
          itemId: doc.id,
          secondsAgo,
          timestamp: updatedAt.toISOString(),
        });
      }
    });

    recentCustomersSnap.forEach(doc => {
      const data = doc.data();
      if (data.updatedAt) {
        const updatedAt = data.updatedAt.toDate();
        const secondsAgo = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
        recentCustomerWrites.push({
          customerName: data.name || data.customerName,
          secondsAgo,
          timestamp: updatedAt.toISOString(),
        });
      }
    });

    // Determine if import is likely running
    const mostRecentOrderWrite = recentOrderWrites[0]?.secondsAgo || Infinity;
    const mostRecentItemWrite = recentItemWrites[0]?.secondsAgo || Infinity;
    const mostRecentCustomerWrite = recentCustomerWrites[0]?.secondsAgo || Infinity;

    const mostRecentWrite = Math.min(mostRecentOrderWrite, mostRecentItemWrite, mostRecentCustomerWrite);

    let status = 'unknown';
    let message = '';

    if (mostRecentWrite < 10) {
      status = 'actively_running';
      message = `Import is ACTIVELY RUNNING - data written ${mostRecentWrite} seconds ago`;
    } else if (mostRecentWrite < 60) {
      status = 'probably_running';
      message = `Import is PROBABLY RUNNING - last write ${mostRecentWrite} seconds ago (might be slow or batching)`;
    } else if (mostRecentWrite < 300) {
      status = 'possibly_stalled';
      message = `Import might be STALLED - last write ${Math.floor(mostRecentWrite / 60)} minutes ago`;
    } else {
      status = 'idle';
      message = `Import appears IDLE - no recent writes in last 5 minutes`;
    }

    console.log(`\n📊 STATUS: ${status}`);
    console.log(`   ${message}\n`);

    return NextResponse.json({
      status,
      message,
      currentTime: now.toISOString(),
      recentActivity: {
        orders: {
          mostRecentWrite: mostRecentOrderWrite === Infinity ? 'none' : `${mostRecentOrderWrite}s ago`,
          samples: recentOrderWrites.slice(0, 3),
        },
        items: {
          mostRecentWrite: mostRecentItemWrite === Infinity ? 'none' : `${mostRecentItemWrite}s ago`,
          samples: recentItemWrites.slice(0, 3),
        },
        customers: {
          mostRecentWrite: mostRecentCustomerWrite === Infinity ? 'none' : `${mostRecentCustomerWrite}s ago`,
          samples: recentCustomerWrites.slice(0, 3),
        },
      },
      interpretation: {
        actively_running: 'Data being written within last 10 seconds - import is definitely running',
        probably_running: 'Data written within last minute - import is likely still processing',
        possibly_stalled: 'No writes in 1-5 minutes - might be stalled or finishing up',
        idle: 'No recent activity - import is complete or not running',
      },
    });

  } catch (error: any) {
    console.error('❌ Status check error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
