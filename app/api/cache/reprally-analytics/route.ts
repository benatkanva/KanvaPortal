import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type') || 'summary'; // summary | customers | switchers | all
    
    // Check if cache exists
    const summaryDoc = await adminDb.collection('cache_reprally').doc('summary').get();
    
    if (!summaryDoc.exists) {
      return NextResponse.json({
        success: false,
        cached: false,
        error: 'Cache not built. Please run cache rebuild first.'
      }, { status: 404 });
    }
    
    const summaryData = summaryDoc.data();
    const cacheAge = summaryData?.updatedAt?.toDate?.() 
      ? Date.now() - summaryData.updatedAt.toDate().getTime()
      : null;
    
    // Return based on requested data type
    if (dataType === 'summary') {
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeMs: cacheAge,
        updatedAt: summaryData?.updatedAt?.toDate?.()?.toISOString() || null,
        summary: {
          totalCustomers: summaryData?.totalCustomers || 0,
          totalRevenue: summaryData?.totalRevenue || 0,
          reprallyCustomers: summaryData?.reprallyCustomers || 0,
          reprallyRevenue: summaryData?.reprallyRevenue || 0,
          reprallyOrders: summaryData?.reprallyOrders || 0,
          retailCustomers: summaryData?.retailCustomers || 0,
          retailRevenue: summaryData?.retailRevenue || 0,
          retailOrders: summaryData?.retailOrders || 0,
          switcherCount: summaryData?.switcherCount || 0,
          avgOrderValue: summaryData?.avgOrderValue || 0,
          topStates: summaryData?.topStates || [],
          topSkus: summaryData?.topSkus || []
        }
      });
    }
    
    if (dataType === 'customers') {
      // Load top customers from cache
      const topCustomersDoc = await adminDb.collection('cache_reprally').doc('top_customers').get();
      const customers = topCustomersDoc.data()?.customers || [];
      
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeMs: cacheAge,
        updatedAt: summaryData?.updatedAt?.toDate?.()?.toISOString() || null,
        customers,
        totalCount: summaryData?.totalCustomers || 0
      });
    }
    
    if (dataType === 'switchers') {
      // Load switchers from cache
      const switchersDoc = await adminDb.collection('cache_reprally').doc('switchers').get();
      const switchers = switchersDoc.data()?.switchers || [];
      
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeMs: cacheAge,
        updatedAt: summaryData?.updatedAt?.toDate?.()?.toISOString() || null,
        switchers,
        count: switchers.length
      });
    }
    
    if (dataType === 'map') {
      // Load all customers with geocoding for map display
      // Fetch all chunks
      const chunksSnap = await adminDb.collection('cache_reprally')
        .where('chunkIndex', '>=', 0)
        .get();
      
      let allCustomers: any[] = [];
      chunksSnap.forEach(doc => {
        const data = doc.data();
        if (data.customers) {
          allCustomers = allCustomers.concat(data.customers);
        }
      });
      
      // Filter to only geocoded customers
      const geocodedCustomers = allCustomers.filter(c => c.lat && c.lng);
      
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeMs: cacheAge,
        updatedAt: summaryData?.updatedAt?.toDate?.()?.toISOString() || null,
        customers: geocodedCustomers,
        totalCount: allCustomers.length,
        geocodedCount: geocodedCustomers.length
      });
    }
    
    if (dataType === 'all') {
      // Load everything for full analysis
      const [topCustomersDoc, switchersDoc] = await Promise.all([
        adminDb.collection('cache_reprally').doc('top_customers').get(),
        adminDb.collection('cache_reprally').doc('switchers').get()
      ]);
      
      return NextResponse.json({
        success: true,
        cached: true,
        cacheAgeMs: cacheAge,
        updatedAt: summaryData?.updatedAt?.toDate?.()?.toISOString() || null,
        summary: {
          totalCustomers: summaryData?.totalCustomers || 0,
          totalRevenue: summaryData?.totalRevenue || 0,
          reprallyCustomers: summaryData?.reprallyCustomers || 0,
          reprallyRevenue: summaryData?.reprallyRevenue || 0,
          reprallyOrders: summaryData?.reprallyOrders || 0,
          retailCustomers: summaryData?.retailCustomers || 0,
          retailRevenue: summaryData?.retailRevenue || 0,
          retailOrders: summaryData?.retailOrders || 0,
          switcherCount: summaryData?.switcherCount || 0,
          avgOrderValue: summaryData?.avgOrderValue || 0,
          topStates: summaryData?.topStates || [],
          topSkus: summaryData?.topSkus || []
        },
        topCustomers: topCustomersDoc.data()?.customers || [],
        switchers: switchersDoc.data()?.switchers || []
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid type parameter. Use: summary, customers, switchers, map, or all'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('❌ Cache read error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
