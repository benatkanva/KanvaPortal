import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

interface CopperCompany {
  id: number;
  name: string;
  assignee_id?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone_numbers?: Array<{ number: string; category: string }>;
  email_domain?: string;
  custom_fields?: Array<{
    custom_field_definition_id: number;
    value: any;
  }>;
}

interface SyncStats {
  totalFetched: number;
  activeFetched: number;
  updated: number;
  created: number;
  errors: number;
  errorDetails: Array<{ id: number; name: string; error: string }>;
}

/**
 * Direct Copper API → copper_companies Firestore sync
 * Pulls ACTIVE companies with ALL fields directly from Copper API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔥 DIRECT COPPER API SYNC → copper_companies');
    console.log('='.repeat(80) + '\n');

    const stats: SyncStats = {
      totalFetched: 0,
      activeFetched: 0,
      updated: 0,
      created: 0,
      errors: 0,
      errorDetails: [],
    };

    // Get Copper API credentials
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      throw new Error('Copper API credentials not configured (COPPER_API_KEY, COPPER_USER_EMAIL)');
    }

    console.log('📡 Fetching ACTIVE companies from Copper API...');
    console.log(`   Using email: ${copperEmail}`);
    console.log(`   Filtering for: Active Customer cf_712751 = true\n`);

    // Copper API: Search for companies
    // Filter for ACTIVE companies using custom field
    // For checkbox fields, use boolean true (not string "checked")
    const searchBody = {
      page_size: 200,
      sort_by: 'name',
      custom_fields: [
        {
          custom_field_definition_id: 712751, // Active Customer cf_712751
          value: true, // Boolean true for checked checkbox
        },
      ],
    };

    let allCompanies: CopperCompany[] = [];
    let currentPage = 1;
    let hasMore = true;

    // Fetch all pages
    while (hasMore) {
      console.log(`   Fetching page ${currentPage}...`);

      const response = await fetch('https://api.copper.com/developer_api/v1/companies/search', {
        method: 'POST',
        headers: {
          'X-PW-AccessToken': copperApiKey,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': copperEmail,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...searchBody,
          page_number: currentPage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Copper API error: ${response.status} - ${errorText}`);
      }

      const companies: CopperCompany[] = await response.json();
      console.log(`   ✅ Fetched ${companies.length} companies from page ${currentPage}`);

      if (companies.length === 0) {
        hasMore = false;
      } else {
        allCompanies = allCompanies.concat(companies);
        currentPage++;
        
        // Copper API rate limit: max 10 requests/second
        // Add small delay between pages
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    }

    stats.totalFetched = allCompanies.length;
    stats.activeFetched = allCompanies.length; // All fetched are active (filtered by API)
    console.log(`\n✅ Total ACTIVE companies fetched: ${stats.activeFetched}\n`);

    // Process each company and update Firestore
    console.log('💾 Updating copper_companies collection...\n');

    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;

    for (const company of allCompanies) {
      try {
        // Extract custom fields into a more usable format
        const customFieldsMap: Record<string, any> = {};
        if (company.custom_fields) {
          company.custom_fields.forEach(cf => {
            // Map field ID to field name with ID suffix
            const fieldId = cf.custom_field_definition_id;
            let fieldName = '';
            
            // Map known field IDs to names
            switch (fieldId) {
              case 675914: fieldName = 'Account Type cf_675914'; break;
              case 698467: fieldName = 'Account Order ID cf_698467'; break;
              case 712751: fieldName = 'Active Customer cf_712751'; break;
              case 713477: fieldName = 'Account ID cf_713477'; break;
              case 680701: fieldName = 'Region cf_680701'; break;
              case 698457: fieldName = 'Street Address cf_698457'; break;
              case 698461: fieldName = 'City cf_698461'; break;
              case 698465: fieldName = 'State cf_698465'; break;
              case 698469: fieldName = 'Postal Code cf_698469'; break;
              case 698473: fieldName = 'Phone cf_698473'; break;
              case 698477: fieldName = 'Email cf_698477'; break;
              case 708027: fieldName = 'Sales Rep cf_708027'; break;
              case 708028: fieldName = 'Original Owner cf_708028'; break;
              default: fieldName = `cf_${fieldId}`;
            }
            
            customFieldsMap[fieldName] = cf.value;
          });
        }

        // Build Firestore document
        const firestoreDoc: any = {
          id: company.id,
          name: company.name || '',
          assignee_id: company.assignee_id || null,
          
          // Standard address fields
          Street: company.address?.street || '',
          city: company.address?.city || '',
          State: company.address?.state || '',
          'Postal Code': company.address?.postal_code || '',
          country: company.address?.country || '',
          
          // Phone
          phone: company.phone_numbers?.[0]?.number || '',
          
          // Email
          email_domain: company.email_domain || '',
          
          // Custom fields
          ...customFieldsMap,
          
          // Metadata
          syncedFromCopperApiAt: Timestamp.now(),
          source: 'copper_api_direct',
        };

        // Use Copper ID as Firestore document ID
        const docRef = adminDb.collection('copper_companies').doc(String(company.id));
        
        // Check if exists
        const existingDoc = await docRef.get();
        
        if (existingDoc.exists) {
          batch.update(docRef, firestoreDoc);
          stats.updated++;
        } else {
          batch.set(docRef, {
            ...firestoreDoc,
            createdAt: Timestamp.now(),
          });
          stats.created++;
        }
        
        batchCount++;

        // Commit batch if needed
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates`);
          batch = adminDb.batch();
          batchCount = 0;
        }

        // Log progress every 50 companies
        if ((stats.updated + stats.created) % 50 === 0) {
          console.log(`   Progress: ${stats.updated + stats.created} / ${stats.totalFetched}`);
        }

      } catch (error: any) {
        stats.errors++;
        stats.errorDetails.push({
          id: company.id,
          name: company.name || 'Unknown',
          error: error.message,
        });
        console.error(`   ❌ Error processing ${company.name}:`, error.message);
      }
    }

    // Commit final batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} updates`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COPPER API SYNC COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Active Companies: ${stats.activeFetched}`);
    console.log(`Created:                ${stats.created}`);
    console.log(`Updated:                ${stats.updated}`);
    console.log(`Errors:                 ${stats.errors}`);
    console.log('='.repeat(80) + '\n');

    if (stats.errorDetails.length > 0) {
      console.log('❌ Errors:');
      stats.errorDetails.forEach(err => {
        console.log(`   ${err.name} (ID: ${err.id}): ${err.error}`);
      });
    }

    return NextResponse.json({
      success: true,
      stats,
      message: `Synced ${stats.activeFetched} active companies from Copper API to copper_companies collection`,
    });

  } catch (error: any) {
    console.error('❌ Copper API sync error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
