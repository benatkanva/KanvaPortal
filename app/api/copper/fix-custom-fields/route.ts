import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

/**
 * Fix custom fields for recently created companies (214 companies from IDs 74820794-74821021)
 * Sets Active Customer, Account Order ID, and ensures addresses are populated
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = true, startId, endId } = await request.json();

    const stats = {
      processed: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };

    console.log(`🚀 Starting custom field fix (dryRun: ${dryRun})...`);
    console.log(`   Copper ID range: ${startId} to ${endId}`);

    // Load fishbowl customers with Copper IDs in range
    const { adminDb } = await import('@/lib/firebase/admin');
    const fishbowlSnap = await adminDb
      .collection('fishbowl_customers')
      .where('copperId', '>=', String(startId))
      .where('copperId', '<=', String(endId))
      .get();

    console.log(`📦 Found ${fishbowlSnap.size} Fishbowl customers in range`);

    const updates: any[] = [];

    for (const doc of fishbowlSnap.docs) {
      const customer = doc.data();
      const copperId = customer.copperId;

      if (!copperId) continue;

      stats.processed++;

      // Map accountType to Copper option ID
      const accountTypeMap: Record<string, number> = {
        'Distributor': 1981470,
        'Wholesale': 2063862,
        'Retail': 2066840
      };
      const copperAccountType = accountTypeMap[customer.accountType] || 2066840;

      // Determine Account Order ID - use customer.id (the Fishbowl customer number)
      // This is the actual Fishbowl identifier, NOT accountNumber (which is often empty)
      const accountOrderId = customer.id || customer.accountId || customer.accountNumber || doc.id || '';
      
      if (!customer.id) {
        console.warn(`⚠️ Using fallback for Account Order ID: ${customer.name} (Copper ID: ${copperId}) - Account Order ID: ${accountOrderId}`);
      }

      updates.push({
        copperId,
        customerName: customer.name,
        accountNumber: accountOrderId,
        accountType: copperAccountType,
        shippingAddress: customer.shippingAddress || '',
        shippingCity: customer.shippingCity || '',
        shippingState: customer.shippingState || '',
        shippingZip: customer.shippingZip || ''
      });
    }

    console.log(`\n📊 Analysis Complete:`);
    console.log(`   Customers to update: ${updates.length}`);

    if (dryRun) {
      console.log(`\n🔍 DRY RUN - No changes made`);
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats,
        updates: updates.slice(0, 20)
      });
    }

    // LIVE MODE - Update all companies
    console.log(`\n🔥 LIVE MODE - Updating ${updates.length} companies...`);

    let updateIndex = 0;
    for (const update of updates) {
      updateIndex++;
      try {
        const updateRes = await fetch(`${COPPER_API_BASE}/companies/${update.copperId}`, {
          method: 'PUT',
          headers: {
            'X-PW-AccessToken': COPPER_API_KEY,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': COPPER_USER_EMAIL,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: {
              street: update.shippingAddress,
              city: update.shippingCity,
              state: update.shippingState,
              postal_code: update.shippingZip,
              country: 'US'
            },
            custom_fields: [
              { custom_field_definition_id: 698467, value: update.accountNumber },
              { custom_field_definition_id: 675914, value: [update.accountType] },
              { custom_field_definition_id: 712751, value: true }
            ]
          })
        });

        if (updateRes.ok) {
          stats.updated++;
          
          // ALSO update Firestore with accountNumber (it wasn't saved during creation)
          const { adminDb: fsDb } = await import('@/lib/firebase/admin');
          const { Timestamp: FS_Timestamp } = await import('firebase-admin/firestore');
          
          const fishbowlSnap = await fsDb.collection('fishbowl_customers')
            .where('copperId', '==', String(update.copperId))
            .limit(1)
            .get();
          
          if (!fishbowlSnap.empty) {
            const fishbowlDoc = fishbowlSnap.docs[0];
            await fishbowlDoc.ref.update({
              accountNumber: update.accountNumber,
              updatedAt: FS_Timestamp.now()
            });
          }
          
          console.log(`✅ [${updateIndex}/${updates.length}] Updated: ${update.customerName} (ID: ${update.copperId}, Account #: ${update.accountNumber})`);
        } else {
          const errorText = await updateRes.text();
          stats.errors++;
          console.error(`❌ [${updateIndex}/${updates.length}] Failed: ${update.customerName} - ${updateRes.status}: ${errorText}`);
        }

        // Rate limit: 300ms between requests
        await new Promise(r => setTimeout(r, 300));
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ Error updating ${update.customerName}:`, error.message);
      }
    }

    console.log(`\n✅ Fix Complete:`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Errors: ${stats.errors}`);

    return NextResponse.json({
      success: true,
      dryRun: false,
      stats
    });

  } catch (error: any) {
    console.error('❌ Custom field fix failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
