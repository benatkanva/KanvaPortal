import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    if (email && admins.includes(email)) return decoded;
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/fishbowl-salesmen
 * Get unique list of Fishbowl salesmen from orders
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Fishbowl Salesmen] Querying both customers and orders for salesPerson field...');
    
    // Try customers first
    const customersSnapshot = await adminDb
      .collection('fishbowl_customers')
      .get(); // No limit - get all

    console.log('[Fishbowl Salesmen] Found', customersSnapshot.docs.length, 'customers');

    const salesmenFromCustomers = new Set<string>();
    
    for (const doc of customersSnapshot.docs) {
      const customer = doc.data();
      const salesPerson = customer.salesPerson;
      
      if (salesPerson && typeof salesPerson === 'string' && salesPerson.trim()) {
        // Skip generic entries
        if (!['SHOPIFY', 'Commerce', 'commerce'].includes(salesPerson)) {
          salesmenFromCustomers.add(salesPerson.trim());
        }
      }
    }

    console.log('[Fishbowl Salesmen] From customers:', Array.from(salesmenFromCustomers));

    // Also check orders (they have salesPerson field too)
    // Get ALL orders (no limit) to find all salesmen
    const ordersSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .get();

    console.log('[Fishbowl Salesmen] Found', ordersSnapshot.docs.length, 'orders');

    const salesmenFromOrders = new Set<string>();
    
    for (const doc of ordersSnapshot.docs) {
      const order = doc.data();
      const salesPerson = order.salesPerson || order.salesRep;
      
      if (salesPerson && typeof salesPerson === 'string' && salesPerson.trim()) {
        // Skip generic entries
        if (!['SHOPIFY', 'Commerce', 'commerce'].includes(salesPerson)) {
          salesmenFromOrders.add(salesPerson.trim());
        }
      }
    }

    console.log('[Fishbowl Salesmen] From orders:', Array.from(salesmenFromOrders));

    // Combine both sources
    const allSalesmen = new Set([...salesmenFromCustomers, ...salesmenFromOrders]);
    const salesmen = Array.from(allSalesmen).sort();

    console.log('[Fishbowl Salesmen] Combined unique salesmen:', salesmen);

    return NextResponse.json({
      salesmen,
      count: salesmen.length,
      totalCustomers: customersSnapshot.docs.length,
      totalOrders: ordersSnapshot.docs.length,
    });
  } catch (error: any) {
    console.error('[Fishbowl Salesmen] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get salesmen' },
      { status: 500 }
    );
  }
}
