import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get RepRally customers for map visualization
 * Returns customer data with coordinates and revenue info
 */
export async function GET(request: NextRequest) {
  try {
    const snapshot = await adminDb.collection('reprally_customers').get();
    
    const customers: any[] = [];
    
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      
      // Skip aggregated "22" Shopify customer
      if (docSnap.id === '22' || d.businessName === 'Shopify Customer') return;
      
      // Helper to convert Firestore timestamp
      const toISODate = (val: any): string | null => {
        if (!val) return null;
        if (val.toDate && typeof val.toDate === 'function') {
          return val.toDate().toISOString();
        }
        if (typeof val === 'string') return val;
        return null;
      };
      
      customers.push({
        id: docSnap.id,
        businessName: d.businessName || '',
        billingAddress: d.billingAddress || '',
        billingCity: d.billingCity || '',
        billingState: d.billingState || '',
        billingZip: String(d.billingZip || ''),
        totalRepRallyOrders: d.totalRepRallyOrders || d.totalOrders || 0,
        totalRepRallyRevenue: d.totalRepRallyRevenue || d.lifetimeValue || 0,
        firstRepRallyOrder: toISODate(d.firstRepRallyOrder) || toISODate(d.firstOrderDate),
        lastRepRallyOrder: toISODate(d.lastRepRallyOrder) || toISODate(d.lastOrderDate),
        originalSalesRep: d.originalSalesRep || d.match?.fbOriginalSalesRep || '',
        lat: d.lat || null,
        lng: d.lng || null,
        isSwitcher: d.switcher?.isSwitcher || false,
        matchedFbCustomer: d.match?.fbBusinessName || null,
      });
    });

    // Calculate stats
    const total = customers.length;
    const geocoded = customers.filter(c => c.lat && c.lng).length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalRepRallyRevenue || 0), 0);
    const switcherCount = customers.filter(c => c.isSwitcher).length;

    console.log(`📍 RepRally map: loaded ${total} customers (${geocoded} geocoded, ${switcherCount} switchers)`);

    return NextResponse.json({
      success: true,
      customers,
      stats: {
        total,
        geocoded,
        totalRevenue,
        switcherCount
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching RepRally map customers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update customer coordinates after geocoding
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, lat, lng } = body;

    if (!customerId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'customerId, lat, and lng are required' },
        { status: 400 }
      );
    }

    await adminDb.collection('reprally_customers').doc(customerId).update({
      lat,
      lng,
      geocodedAt: new Date()
    });

    console.log(`📍 Updated coordinates for ${customerId}: ${lat}, ${lng}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error updating customer coordinates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
