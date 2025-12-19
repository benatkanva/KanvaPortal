import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/**
 * Export ACTIVE duplicates in a format ready for Copper merging
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Generating duplicate merge list...');

    // Get only ACTIVE companies
    const copperSnap = await adminDb.collection('copper_companies')
      .where('Active Customer cf_712751', '==', true)
      .get();
    
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
        street: data.Street || '',
        city: data.city || '',
        state: data.State || '',
        zip: data['Postal Code'] || '',
      });
    });
    
    // Find duplicates
    const duplicates: any[] = [];
    
    companiesByName.forEach((companies, name) => {
      if (companies.length > 1) {
        // Score completeness
        companies.forEach((c: any) => {
          let score = 0;
          if (c.region) score += 10;
          if (c.street) score += 5;
          if (c.city) score += 5;
          if (c.state) score += 5;
          if (c.zip) score += 3;
          if (c.assignee_id) score += 2;
          c.completenessScore = score;
          
          // Format account type
          if (Array.isArray(c.accountType) && c.accountType.length > 0) {
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
        
        // Sort by completeness (best first)
        companies.sort((a, b) => b.completenessScore - a.completenessScore);
        
        duplicates.push({
          displayName: companies[0].name,
          companies,
          recommendation: {
            keepCopperId: companies[0].id,
            mergeCopperIds: companies.slice(1).map((c: any) => c.id),
            reason: `Keep ID ${companies[0].id} (score: ${companies[0].completenessScore}) - most complete data`,
          },
        });
      }
    });
    
    // Sort by name
    duplicates.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Generate merge instructions
    const mergeInstructions = duplicates.map((dup, idx) => {
      const keep = dup.companies[0];
      const merge = dup.companies.slice(1);
      
      return {
        step: idx + 1,
        companyName: dup.displayName,
        action: 'MERGE',
        keepRecord: {
          copperId: keep.id,
          url: `https://app.copper.com/companies/${keep.id}`,
          accountOrderId: keep.accountOrderId || 'N/A',
          score: keep.completenessScore,
          hasRegion: !!keep.region,
          hasAddress: !!(keep.street && keep.city),
        },
        mergeIntoKeep: merge.map((m: any) => ({
          copperId: m.id,
          url: `https://app.copper.com/companies/${m.id}`,
          accountOrderId: m.accountOrderId || 'N/A',
          score: m.completenessScore,
        })),
      };
    });

    console.log('\n📋 MERGE INSTRUCTIONS:');
    console.log('='.repeat(80));
    mergeInstructions.forEach(inst => {
      console.log(`\n${inst.step}. ${inst.companyName}`);
      console.log(`   KEEP:  ID ${inst.keepRecord.copperId} (Score: ${inst.keepRecord.score})`);
      console.log(`          ${inst.keepRecord.url}`);
      inst.mergeIntoKeep.forEach((m: any) => {
        console.log(`   MERGE: ID ${m.copperId} (Score: ${m.score})`);
        console.log(`          ${m.url}`);
      });
    });

    return NextResponse.json({
      totalDuplicates: duplicates.length,
      totalRecordsToMerge: duplicates.reduce((sum, d) => sum + (d.companies.length - 1), 0),
      mergeInstructions,
    });

  } catch (error: any) {
    console.error('❌ Error generating merge list:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
