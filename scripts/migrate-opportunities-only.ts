/**
 * Opportunities-Only Migration Script: Firebase → Supabase
 * Migrates only opportunities with fixed data type parsing
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Verify environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Missing Firebase environment variables!');
  process.exit(1);
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPANY_ID = 'kanva-botanicals';
const BATCH_SIZE = 100;

// Helper to parse numeric values safely
const parseNumeric = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
};

// Helper to parse integer values safely
const parseInteger = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'unchecked' || value === 'checked') return null;
  if (typeof value === 'number') return Math.floor(value);
  const num = parseInt(String(value).replace(/[^0-9-]/g, ''));
  return isNaN(num) ? null : num;
};

async function migrateOpportunities() {
  console.log('🔄 Starting opportunities migration...\n');
  
  try {
    // Step 1: Delete existing opportunities
    console.log('🗑️  Deleting existing opportunities...');
    const { error: deleteError } = await supabase
      .from('opportunities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Error deleting existing opportunities:', deleteError);
    } else {
      console.log('✅ Deleted existing opportunities\n');
    }

    // Step 2: Fetch from Firebase
    const snapshot = await getDocs(collection(db, 'copper_opportunities'));
    const total = snapshot.size;
    console.log(`📊 Found ${total} opportunities to migrate\n`);

    let migrated = 0;
    let errors = 0;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const opportunity = {
        id: doc.id,
        company_id: COMPANY_ID,
        source: data.source || 'copper',
        
        // Core fields
        name: data.Name || data.name,
        details: data.Details || null,
        value: parseNumeric(data.Value || data.value),
        
        // Pipeline & Status
        pipeline: data.Pipeline || data.pipeline || null,
        stage: data.Stage || data.stage || null,
        status: data.Status || data.status || null,
        win_probability: parseInteger(data['Win Probability']),
        priority: data.Priority || null,
        loss_reason: data['Loss Reason'] || null,
        
        // Relationships
        account_id: data.companyId || data['Company Id'] || null,
        company_name: data.Company || data.company || null,
        primary_contact: data['Primary Person Contact'] || data.primaryContact || null,
        primary_contact_id: null,
        
        // Ownership
        owner: data.Owner || null,
        owner_id: data['Owner Id'] || null,
        assignee_id: null,
        
        // Dates
        close_date: data['Close Date'] ? new Date(data['Close Date']) : null,
        completed_date: data['Completed Date'] ? new Date(data['Completed Date']) : null,
        lead_created_at: data['Lead Created At'] ? new Date(data['Lead Created At']) : null,
        last_stage_at: data['Last Stage At'] ? new Date(data['Last Stage At']) : null,
        days_in_stage: parseInteger(data['Days in Stage']),
        inactive_days: parseInteger(data['Inactive Days']),
        
        // Financial details
        converted_value: parseNumeric(data['Converted Value']),
        currency: data.Currency || null,
        exchange_rate: parseNumeric(data['Exchange Rate']),
        
        // Order details
        so_number: data['SO Number cf_698395'] || null,
        account_order_id: data['Account Order ID cf_698467'] || null,
        customer_po: data['Customer PO cf_712764'] || null,
        
        // Shipping
        shipping_amount: parseNumeric(data['Shipping Amount cf_698427']),
        shipping_status: data['Shipping Status cf_706518'] || null,
        shipping_method: data['Shipping Method cf_698435'] || null,
        ship_date: data['Ship Date cf_698436'] ? new Date(data['Ship Date cf_698436']) : null,
        delivery_date: data['Delivery Date cf_706517'] ? new Date(data['Delivery Date cf_706517']) : null,
        tracking_number: data['Tracking Number cf_698433'] || null,
        carrier: data['Carrier cf_706513'] || null,
        
        // Financial breakdown
        subtotal: parseNumeric(data['Subtotal cf_698438']),
        tax_amount: parseNumeric(data['Tax Amount cf_698439']),
        discount_amount: parseNumeric(data['Discount Amount cf_698440']),
        order_total: parseNumeric(data['Order Total cf_698441']),
        
        // Payment
        payment_terms: data['Payment Terms cf_698434'] || null,
        payment_status: data['Payment Status cf_698399'] || null,
        
        // Products
        products_involved: data['Products Involved cf_705070'] || null,
        
        // Copper metadata
        copper_id: parseInteger(data['Copper ID'] || data.id),
        copper_url: data.copperUrl || null,
        tags: data.Tags || null,
        interaction_count: parseInteger(data['Interaction Count']) || 0,
        last_contacted: data['Last Contacted'] ? new Date(data['Last Contacted']) : null,
        
        // Custom fields
        region: data['Region cf_680701'] || null,
        segment: data['Segment cf_698149'] || null,
        account_type: data['Account Type cf_675914'] || null,
        customer_priority: data['Customer Priority cf_698121'] || null,
        business_model: data['Business Model cf_698356'] || null,
        account_number: data['Account Number cf_698260'] || null,
        sale_type: data['Sale Type cf_710692'] || null,
        
        // Sync tracking
        sync_status: data['Sync Status cf_698445'] || null,
        fishbowl_status: data['Fishbowl Status cf_698443'] || null,
        
        // Tracking
        imported_at: new Date(),
      };

      batch.push(opportunity);

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from('opportunities').insert(batch);
        if (error) {
          console.error(`❌ Error inserting batch:`, error.message);
          errors++;
        } else {
          migrated += batch.length;
          console.log(`✅ Migrated ${migrated}/${total} opportunities`);
        }
        batch = [];
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      const { error } = await supabase.from('opportunities').insert(batch);
      if (error) {
        console.error(`❌ Error inserting final batch:`, error.message);
        errors++;
      } else {
        migrated += batch.length;
      }
    }

    console.log(`\n✅ Opportunities migration complete: ${migrated}/${total}`);
    if (errors > 0) {
      console.log(`⚠️  Encountered ${errors} batch errors`);
    }

    // Verify count
    const { count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Final count in Supabase: ${count} opportunities`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateOpportunities()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
