import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Match RepRally customers (by location) with existing fishbowl_customers
 * Identifies which customers switched from direct sales to RepRally
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 MATCHING REPRALLY CUSTOMERS WITH FISHBOWL CUSTOMERS`);
    console.log(`${'='.repeat(80)}\n`);
    
    const stats = {
      repRallyLocations: 0,
      fishbowlCustomers: 0,
      matchesFound: 0,
      potentialSwitchers: 0,
      noMatch: 0
    };
    
    // Step 1: Get all line items and filter for Shopify/RepRally orders
    console.log('📦 Loading all line items to find RepRally orders...');
    const allItemsSnap = await adminDb
      .collection('fishbowl_soitems')
      .get();
    
    console.log(`   Loaded ${allItemsSnap.size} total line items`);
    
    // Filter for RepRally orders (customer 22, Robert Farias, or Shopify Customer)
    const shopifyItems: any[] = [];
    for (const doc of allItemsSnap.docs) {
      const item = doc.data();
      const customerId = String(item.customerId || '');
      const customerName = String(item.customerName || '').toLowerCase();
      const salesRep = String(item.salesRep || item.salesPerson || '').toLowerCase();
      
      if (customerId === '22' || 
          customerName.includes('shopify') ||
          salesRep.includes('robert farias') ||
          salesRep.includes('farias')) {
        shopifyItems.push(item);
      }
    }
    
    console.log(`   Found ${shopifyItems.length} RepRally line items\n`);
    
    // Group by unique location
    interface LocationData {
      city: string;
      state: string;
      zip: string;
      address: string;
      orders: Set<string>;
      totalRevenue: number;
    }
    
    const locationMap = new Map<string, LocationData>();
    
    for (const item of shopifyItems) {
      
      const city = String(item.billingCity || '').trim();
      const state = String(item.billingState || '').trim();
      const zip = String(item.billingZip || '').trim();
      const address = String(item.billingAddress || '').trim();
      
      if (!city || !state) continue;
      
      const locationKey = `${city}|${state}`.toLowerCase();
      
      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          city,
          state,
          zip,
          address,
          orders: new Set(),
          totalRevenue: 0
        });
      }
      
      const location = locationMap.get(locationKey)!;
      const orderNum = String(item.salesOrderNum || '');
      if (orderNum) location.orders.add(orderNum);
      location.totalRevenue += parseFloat(item.revenue || item.totalPrice || 0);
    }
    
    stats.repRallyLocations = locationMap.size;
    console.log(`   Identified ${stats.repRallyLocations} unique RepRally locations\n`);
    
    // Step 2: Load all fishbowl_customers
    console.log('📦 Loading Fishbowl customer database...');
    const customersSnap = await adminDb
      .collection('fishbowl_customers')
      .get();
    
    stats.fishbowlCustomers = customersSnap.size;
    console.log(`   Loaded ${stats.fishbowlCustomers} Fishbowl customers\n`);
    
    // Index customers by location
    const customersByLocation = new Map<string, any[]>();
    
    for (const doc of customersSnap.docs) {
      const customer = doc.data();
      
      const city = String(customer.billingCity || customer.shippingCity || '').trim();
      const state = String(customer.billingState || customer.shippingState || '').trim();
      
      if (!city || !state) continue;
      
      const locationKey = `${city}|${state}`.toLowerCase();
      
      if (!customersByLocation.has(locationKey)) {
        customersByLocation.set(locationKey, []);
      }
      
      customersByLocation.get(locationKey)!.push({
        customerId: doc.id,
        name: customer.name || customer.customerName,
        accountNumber: customer.accountNumber,
        copperId: customer.copperId,
        originalOwner: customer.originalOwner,
        salesPerson: customer.salesPerson,
        city,
        state,
        firstOrderDate: customer.firstOrderDate?.toDate?.() || null,
        lastOrderDate: customer.lastOrderDate?.toDate?.() || null,
        totalOrders: customer.totalOrders || 0
      });
    }
    
    console.log(`   Indexed ${customersByLocation.size} unique customer locations\n`);
    
    // Step 3: Match RepRally locations to Fishbowl customers
    console.log('🔍 Matching RepRally locations to Fishbowl customers...\n');
    
    const matches: any[] = [];
    const potentialSwitchers: any[] = [];
    
    for (const [locationKey, repRallyData] of locationMap.entries()) {
      const fishbowlCustomers = customersByLocation.get(locationKey) || [];
      
      if (fishbowlCustomers.length === 0) {
        stats.noMatch++;
        continue;
      }
      
      stats.matchesFound++;
      
      // If there are fishbowl customers at this location, they might be switchers
      for (const fbCustomer of fishbowlCustomers) {
        const match = {
          // RepRally data
          repRallyCity: repRallyData.city,
          repRallyState: repRallyData.state,
          repRallyZip: repRallyData.zip,
          repRallyAddress: repRallyData.address,
          repRallyOrders: repRallyData.orders.size,
          repRallyRevenue: repRallyData.totalRevenue,
          
          // Fishbowl customer data
          fishbowlCustomerId: fbCustomer.customerId,
          fishbowlBusinessName: fbCustomer.name,
          fishbowlAccountNumber: fbCustomer.accountNumber,
          fishbowlCopperId: fbCustomer.copperId,
          fishbowlOriginalOwner: fbCustomer.originalOwner,
          fishbowlSalesPerson: fbCustomer.salesPerson,
          fishbowlFirstOrder: fbCustomer.firstOrderDate,
          fishbowlLastOrder: fbCustomer.lastOrderDate,
          fishbowlTotalOrders: fbCustomer.totalOrders,
          
          // Match metadata
          matchConfidence: fishbowlCustomers.length === 1 ? 'high' : 'medium',
          alternativeMatches: fishbowlCustomers.length - 1
        };
        
        matches.push(match);
        
        // Determine if this is a potential switcher
        // (has both direct orders in fishbowl AND RepRally orders)
        if (fbCustomer.totalOrders > 0) {
          potentialSwitchers.push(match);
          stats.potentialSwitchers++;
        }
      }
    }
    
    // Sort by RepRally revenue
    matches.sort((a, b) => b.repRallyRevenue - a.repRallyRevenue);
    potentialSwitchers.sort((a, b) => b.repRallyRevenue - a.repRallyRevenue);
    
    console.log(`✅ Matching complete!\n`);
    console.log(`📊 MATCH RESULTS:`);
    console.log(`   RepRally Locations:     ${stats.repRallyLocations}`);
    console.log(`   Locations Matched:      ${stats.matchesFound}`);
    console.log(`   Potential Switchers:    ${stats.potentialSwitchers} (customers with both direct & RepRally orders)`);
    console.log(`   No Match:               ${stats.noMatch}`);
    console.log('');
    
    console.log(`🎯 Top 20 Potential Switchers (Highest RepRally Revenue):\n`);
    for (let i = 0; i < Math.min(20, potentialSwitchers.length); i++) {
      const switcher = potentialSwitchers[i];
      console.log(`   ${i + 1}. ${switcher.fishbowlBusinessName}`);
      console.log(`      Location: ${switcher.repRallyCity}, ${switcher.repRallyState}`);
      console.log(`      Direct Orders (Fishbowl): ${switcher.fishbowlTotalOrders}`);
      console.log(`      RepRally Orders: ${switcher.repRallyOrders}`);
      console.log(`      RepRally Revenue: $${switcher.repRallyRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
      console.log(`      Original Rep: ${switcher.fishbowlOriginalOwner || switcher.fishbowlSalesPerson || 'Unknown'}`);
      console.log('');
    }
    
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      stats,
      matches: matches.slice(0, 100), // First 100 matches
      potentialSwitchers: potentialSwitchers.slice(0, 50), // Top 50 switchers
      message: `Found ${stats.potentialSwitchers} potential switchers (customers with both direct and RepRally orders)`
    });
    
  } catch (error: any) {
    console.error('❌ Customer matching error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
