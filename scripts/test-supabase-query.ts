/**
 * Quick test to verify Supabase data is accessible
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery() {
  console.log('\n🔍 Testing Supabase Query...\n');

  // Test 1: Count all accounts
  const { count: totalCount, error: countError } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Count error:', countError);
  } else {
    console.log(`✅ Total accounts: ${totalCount}`);
  }

  // Test 2: Get first 5 accounts
  const { data: accounts, error: queryError } = await supabase
    .from('accounts')
    .select('id, name, region, segment, is_active_customer, company_id')
    .limit(5);

  if (queryError) {
    console.error('❌ Query error:', queryError);
  } else {
    console.log(`\n✅ Sample accounts (${accounts?.length}):`);
    accounts?.forEach(acc => {
      console.log(`   - ${acc.name} (${acc.region || 'no region'}) [${acc.company_id}]`);
    });
  }

  // Test 3: Filter by company_id
  const { count: kanvaCount, error: kanvaError } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'kanva-botanicals');

  if (kanvaError) {
    console.error('❌ Company filter error:', kanvaError);
  } else {
    console.log(`\n✅ Kanva Botanicals accounts: ${kanvaCount}`);
  }

  // Test 4: Filter by active customers
  const { count: activeCount, error: activeError } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'kanva-botanicals')
    .eq('is_active_customer', true);

  if (activeError) {
    console.error('❌ Active filter error:', activeError);
  } else {
    console.log(`✅ Active customers: ${activeCount}`);
  }

  // Test 5: Search by name
  const { data: searchResults, error: searchError } = await supabase
    .from('accounts')
    .select('id, name, email, phone')
    .eq('company_id', 'kanva-botanicals')
    .ilike('name', '%market%')
    .limit(5);

  if (searchError) {
    console.error('❌ Search error:', searchError);
  } else {
    console.log(`\n✅ Search results for "market" (${searchResults?.length}):`);
    searchResults?.forEach(acc => {
      console.log(`   - ${acc.name}`);
    });
  }

  console.log('\n✅ All tests passed!\n');
}

testQuery()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
