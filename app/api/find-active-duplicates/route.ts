import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/**
 * Find duplicate company names among ACTIVE customers only
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Scanning for duplicate company names in ACTIVE copper_companies...');

    // Get only ACTIVE companies
    const copperSnap = await adminDb.collection('copper_companies')
      .where('Active Customer cf_712751', '==', true)
      .get();
    
    console.log(`   Found ${copperSnap.size} active companies\n`);
    
    // Group companies by name (case-insensitive)
    const companiesByName = new Map<string, any[]>();
    
    copperSnap.forEach(doc => {
      const data = doc.data();
      const name = (data.name || '').trim().toLowerCase();
      
      if (!name) return;
      
      if (!companiesByName.has(name)) {
        companiesByName.set(name, []);
      }
      
      companiesByName.get(name)!.push({
        id: data.id || doc.id,
        name: data.name,
        accountType: data['Account Type cf_675914'],
        accountOrderId: data['Account Order ID cf_698467'],
        accountId: data['Account ID cf_713477'],
        assignee_id: data.assignee_id,
        region: data['Region cf_680701'],
        address: {
          street: data.Street || '',
          city: data.city || '',
          state: data.State || '',
          zip: data['Postal Code'] || '',
        },
      });
    });
    
    // Find duplicates (2+ companies with same name)
    const duplicates: any[] = [];
    
    companiesByName.forEach((companies, name) => {
      if (companies.length > 1) {
        // Format account type for display
        companies.forEach((c: any) => {
          if (Array.isArray(c.accountType) && c.accountType.length > 0) {
            // Map ID to name
            const typeMap: Record<number, string> = {
              1981470: 'Distributor',
              2063862: 'Wholesale',
              2066840: 'Retail',
            };
            c.accountTypeDisplay = typeMap[c.accountType[0]] || `ID:${c.accountType[0]}`;
          } else {
            c.accountTypeDisplay = c.accountType || 'Unknown';
          }
        });
        
        duplicates.push({
          name,
          displayName: companies[0].name, // Original casing
          count: companies.length,
          companies,
        });
      }
    });
    
    // Sort by count (most duplicates first)
    duplicates.sort((a, b) => b.count - a.count);
    
    console.log(`\n📊 Found ${duplicates.length} duplicate company names among ACTIVE customers`);
    
    if (duplicates.length > 0) {
      console.log('\n🔴 All ACTIVE duplicates:');
      duplicates.forEach((dup, idx) => {
        console.log(`\n   ${idx + 1}. "${dup.displayName}" - ${dup.count} copies`);
        dup.companies.forEach((c: any, cIdx: number) => {
          console.log(`      Copy ${cIdx + 1}:`);
          console.log(`         Copper ID:       ${c.id}`);
          console.log(`         Account Order:   ${c.accountOrderId || 'N/A'}`);
          console.log(`         Account Type:    ${c.accountTypeDisplay}`);
          console.log(`         Region:          ${c.region || 'N/A'}`);
          console.log(`         Address:         ${c.address.city}, ${c.address.state}`);
        });
      });
    } else {
      console.log('   ✅ No duplicates found among active customers!');
    }

    return NextResponse.json({
      totalActiveCompanies: copperSnap.size,
      totalDuplicates: duplicates.length,
      duplicates,
      summary: duplicates.length > 0 ? {
        mostDuplicated: duplicates.slice(0, 10).map(d => ({
          name: d.displayName,
          copies: d.count,
          accountNumbers: d.companies.map((c: any) => c.accountOrderId || 'N/A'),
        })),
      } : null,
    });

  } catch (error: any) {
    console.error('❌ Error finding active duplicates:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
