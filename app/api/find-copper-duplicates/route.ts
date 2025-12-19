import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Find duplicate company names in copper_companies collection
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Scanning for duplicate company names in copper_companies...');

    const copperSnap = await adminDb.collection('copper_companies').get();
    
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
        active: data['Active Customer cf_712751'],
      });
    });
    
    // Find duplicates (2+ companies with same name)
    const duplicates: any[] = [];
    
    companiesByName.forEach((companies, name) => {
      if (companies.length > 1) {
        duplicates.push({
          name,
          count: companies.length,
          companies,
        });
      }
    });
    
    // Sort by count (most duplicates first)
    duplicates.sort((a, b) => b.count - a.count);
    
    console.log(`\n📊 Found ${duplicates.length} duplicate company names`);
    console.log(`   Total companies scanned: ${copperSnap.size}`);
    
    if (duplicates.length > 0) {
      console.log('\n🔴 Top 10 duplicates:');
      duplicates.slice(0, 10).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. "${dup.name}" - ${dup.count} copies`);
        dup.companies.forEach((c: any, cIdx: number) => {
          const accountTypeDisplay = Array.isArray(c.accountType) 
            ? `[${c.accountType.join(', ')}]`
            : c.accountType;
          console.log(`      Copy ${cIdx + 1}: ID=${c.id}, AccountType=${accountTypeDisplay}, OrderID=${c.accountOrderId}`);
        });
      });
    }

    return NextResponse.json({
      totalCompanies: copperSnap.size,
      totalDuplicates: duplicates.length,
      duplicates: duplicates.slice(0, 50), // Return top 50
      summary: {
        worstOffenders: duplicates.slice(0, 10).map(d => ({
          name: d.name,
          copies: d.count,
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ Error finding duplicates:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
