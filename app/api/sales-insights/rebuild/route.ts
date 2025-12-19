import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    if (email && admins.includes(email)) return decoded;
    return null;
  } catch (e) {
    console.error('[Sales Insights Rebuild] Token verification failed:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
  }

  try {
    console.log('[Sales Insights Rebuild] Starting rebuild...');
    
    // Get all customers
    const customersSnap = await adminDb.collection('customers').get();
    let customersProcessed = 0;
    let customersUpdated = 0;

    const batch = adminDb.batch();
    const batchSize = 500;
    let batchCount = 0;

    for (const doc of customersSnap.docs) {
      const data = doc.data();
      
      // Calculate metrics from available data
      const updates: any = {
        salesInsightsUpdatedAt: new Date().toISOString(),
      };

      // Try to get first/last order dates from orders if not set
      if (!data.firstOrderDate || !data.lastOrderDate) {
        // Query orders subcollection if it exists
        try {
          const ordersSnap = await adminDb
            .collection('customers')
            .doc(doc.id)
            .collection('orders')
            .orderBy('orderDate', 'asc')
            .limit(1)
            .get();

          if (!ordersSnap.empty) {
            const firstOrder = ordersSnap.docs[0].data();
            updates.firstOrderDate = firstOrder.orderDate;
          }

          const lastOrderSnap = await adminDb
            .collection('customers')
            .doc(doc.id)
            .collection('orders')
            .orderBy('orderDate', 'desc')
            .limit(1)
            .get();

          if (!lastOrderSnap.empty) {
            const lastOrder = lastOrderSnap.docs[0].data();
            updates.lastOrderDate = lastOrder.orderDate;
          }
        } catch (e) {
          // Orders subcollection may not exist
        }
      }

      // Calculate total revenue and orders if not already set
      if (data.totalRevenue === undefined) {
        try {
          const ordersSnap = await adminDb
            .collection('customers')
            .doc(doc.id)
            .collection('orders')
            .get();

          let totalRevenue = 0;
          let totalOrders = 0;

          ordersSnap.docs.forEach(orderDoc => {
            const orderData = orderDoc.data();
            totalRevenue += orderData.total || orderData.revenue || 0;
            totalOrders++;
          });

          updates.totalRevenue = totalRevenue;
          updates.totalOrders = totalOrders;
        } catch (e) {
          // Orders subcollection may not exist
        }
      }

      if (Object.keys(updates).length > 1) { // More than just the timestamp
        batch.update(doc.ref, updates);
        customersUpdated++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batchCount = 0;
        }
      }

      customersProcessed++;
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[Sales Insights Rebuild] Processed ${customersProcessed} customers, updated ${customersUpdated}`);

    return NextResponse.json({
      success: true,
      customersProcessed,
      customersUpdated,
    });
  } catch (e: any) {
    console.error('[Sales Insights Rebuild] Error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to rebuild sales insights' }, { status: 500 });
  }
}
