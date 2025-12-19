/**
 * Check what commission rules are configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check both possible locations
    const rulesDoc1 = await adminDb.collection('settings').doc('commission_rules').get();
    const rulesDoc2 = await adminDb.collection('commission_rules').doc('current').get();
    
    const rules1 = rulesDoc1.exists ? rulesDoc1.data() : null;
    const rules2 = rulesDoc2.exists ? rulesDoc2.data() : null;
    
    console.log('\n📋 Commission Rules Check:');
    console.log('\nLocation 1: settings/commission_rules');
    console.log('  Exists:', rulesDoc1.exists);
    console.log('  Data:', JSON.stringify(rules1, null, 2));
    
    console.log('\nLocation 2: commission_rules/current');
    console.log('  Exists:', rulesDoc2.exists);
    console.log('  Data:', JSON.stringify(rules2, null, 2));
    
    return NextResponse.json({
      settingsCommissionRules: {
        exists: rulesDoc1.exists,
        data: rules1
      },
      commissionRulesCurrent: {
        exists: rulesDoc2.exists,
        data: rules2
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
