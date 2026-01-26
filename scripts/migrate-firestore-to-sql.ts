/**
 * Migration Script: Firestore → PostgreSQL
 * Migrates all CRM data from Firestore to Google Cloud SQL
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDbPool } from '../lib/db/config';
import {
  decodeRegion,
  decodeSegment,
  decodeCustomerPriority,
  decodePaymentTerms,
  decodeShippingTerms,
  decodeCarrier,
  decodeBusinessModel,
  decodeOrganizationLevel,
} from '../lib/crm/customFields';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

const firestoreDb = getFirestore();
const pool = getDbPool();

/**
 * Parse account type from Copper data
 */
function parseAccountType(value: any): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return null;
}

/**
 * Migrate accounts from copper_companies to PostgreSQL
 */
async function migrateAccounts() {
  console.log('\n🔄 Starting accounts migration...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const accountsRef = firestoreDb.collection('copper_companies');
  const snapshot = await accountsRef.get();
  
  console.log(`📊 Found ${snapshot.size} accounts in Firestore\n`);
  
  let migrated = 0;
  let errors = 0;
  const startTime = Date.now();
  
  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      
      // Parse address
      const address = data.address || {};
      const street = address.street || data.street || data.Street || null;
      const city = address.city || data.city || data.City || null;
      const state = address.state || data.state || data.State || null;
      const zip = address.postal_code || data.zip || data['Postal Code'] || null;
      
      await pool.query(`
        INSERT INTO accounts (
          id, source, copper_id, name, account_number, website, phone, email,
          shipping_street, shipping_city, shipping_state, shipping_zip,
          account_type, region, segment, customer_priority, organization_level, business_model,
          payment_terms, shipping_terms, carrier_name,
          sales_person, total_orders, total_spent, last_order_date, first_order_date,
          primary_contact_id, primary_contact_name,
          account_order_id, copper_url, contact_type, inactive_days, interaction_count,
          last_contacted, owned_by, owner_id,
          status, is_active_customer, created_at, updated_at, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, $28,
          $29, $30, $31, $32, $33,
          $34, $35, $36,
          $37, $38, $39, $40, $41
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = CURRENT_TIMESTAMP
      `, [
        doc.id, // id
        'copper', // source
        data.id || null, // copper_id
        data.name || 'Unknown', // name
        data.cf_713477 || null, // account_number
        data.websites?.[0] || null, // website
        data.phone_numbers?.[0]?.number || null, // phone
        data.email || null, // email
        street, // shipping_street
        city, // shipping_city
        state, // shipping_state
        zip, // shipping_zip
        parseAccountType(data.cf_675914 || data['Account Type cf_675914']), // account_type
        decodeRegion(data.cf_680701 || data['Region cf_680701']) || null, // region
        decodeSegment(data.cf_698149 || data['Segment cf_698149']) || null, // segment
        decodeCustomerPriority(data.cf_698121 || data['Customer Priority cf_698121']) || null, // customer_priority
        decodeOrganizationLevel(data.cf_698362 || data['Organization Level cf_698362']) || null, // organization_level
        decodeBusinessModel(data.cf_698356 || data['Business Model cf_698356']) || null, // business_model
        decodePaymentTerms(data.cf_698434 || data['Payment Terms cf_698434']) || null, // payment_terms
        decodeShippingTerms(data.cf_698462 || data['Shipping Terms cf_698462']) || null, // shipping_terms
        decodeCarrier(data.cf_698464 || data['Carrier cf_698464']) || null, // carrier_name
        data['Owned By'] || null, // sales_person
        data.cf_698403 || null, // total_orders
        data.cf_698404 || null, // total_spent
        data.cf_698406 ? new Date(data.cf_698406) : null, // last_order_date
        data.cf_698405 ? new Date(data.cf_698405) : null, // first_order_date
        data['Primary Contact ID']?.toString() || null, // primary_contact_id
        data['Primary Contact'] || null, // primary_contact_name
        data.cf_698467 || data['Account Order ID cf_698467'] || null, // account_order_id
        data.copperUrl || null, // copper_url
        data['Contact Type'] || data.contact_type_id || null, // contact_type
        data['Inactive Days'] || null, // inactive_days
        data['Interaction Count'] || data.interaction_count || null, // interaction_count
        data['Last Contacted'] ? new Date(data['Last Contacted'] * 1000) : null, // last_contacted
        data['Owned By'] || null, // owned_by
        data['Owner Id'] || data.assignee_id || null, // owner_id
        data.cf_712751 || data['Active Customer cf_712751'] ? 'active' : 'prospect', // status
        data.cf_712751 || data['Active Customer cf_712751'] || false, // is_active_customer
        data['Created At'] ? new Date(data['Created At'] * 1000) : new Date(), // created_at
        data['Updated At'] ? new Date(data['Updated At'] * 1000) : new Date(), // updated_at
        data.details || data.notes || null // notes
      ]);
      
      migrated++;
      
      // Progress indicator
      if (migrated % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (migrated / (Date.now() - startTime) * 1000).toFixed(1);
        console.log(`✅ Migrated ${migrated}/${snapshot.size} accounts (${rate} accounts/sec, ${elapsed}s elapsed)`);
      }
    } catch (error) {
      console.error(`❌ Error migrating account ${doc.id}:`, error);
      errors++;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgRate = (migrated / (Date.now() - startTime) * 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Accounts migration complete!');
  console.log(`   Total: ${snapshot.size}`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Time: ${totalTime}s`);
  console.log(`   Rate: ${avgRate} accounts/sec`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');
  
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active_customer = true) as active,
      COUNT(*) FILTER (WHERE region IS NOT NULL) as with_region,
      COUNT(*) FILTER (WHERE segment IS NOT NULL) as with_segment
    FROM accounts
  `);
  
  const stats = result.rows[0];
  
  console.log('📊 PostgreSQL Database Stats:');
  console.log(`   Total accounts: ${stats.total}`);
  console.log(`   Active customers: ${stats.active}`);
  console.log(`   With region: ${stats.with_region}`);
  console.log(`   With segment: ${stats.with_segment}`);
  console.log('');
}

/**
 * Main migration function
 */
async function main() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Firestore → PostgreSQL Migration     ║');
    console.log('║  KanvaPortal CRM Database             ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    await migrateAccounts();
    await verifyMigration();
    
    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run migration
main();
