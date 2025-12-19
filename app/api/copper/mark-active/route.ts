import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

/**
 * Mark Copper companies as ACTIVE based on Fishbowl customer data
 * 
 * Strategy:
 * 1. Load all fishbowl_customers
 * 2. For each with copperId, mark that Copper company as active
 * 3. For those WITHOUT copperId but with accountNumber, try to find in Copper
 * 4. Update Copper "Active Customer" flag via API
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = true } = await request.json();
    
    // For LIVE MODE, use streaming for progress updates
    const useStreaming = !dryRun;
    let encoder: TextEncoder | undefined;
    let stream: TransformStream | undefined;
    let writer: WritableStreamDefaultWriter | undefined;
    
    if (useStreaming) {
      encoder = new TextEncoder();
      stream = new TransformStream();
      writer = stream.writable.getWriter();
    }
    
    const sendProgress = async (data: any) => {
      if (useStreaming && writer && encoder) {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error('Failed to send progress:', e);
        }
      }
    };

    const stats = {
      fishbowlCustomers: 0,
      withCopperId: 0,
      withoutCopperId: 0,
      copperUpdated: 0,
      copperCreated: 0,
      copperAlreadyActive: 0,
      copperNotFound: 0,
      duplicatesFound: 0,
      namesUpdated: 0,
      errors: 0
    };

    console.log(`🚀 Starting Copper Active Flag sync + Create missing (dryRun: ${dryRun})...`);

    // Load all fishbowl customers
    const { adminDb } = await import('@/lib/firebase/admin');
    const fishbowlSnap = await adminDb.collection('fishbowl_customers').get();
    stats.fishbowlCustomers = fishbowlSnap.size;

    console.log(`📦 Loaded ${stats.fishbowlCustomers} Fishbowl customers`);

    const updates: any[] = [];
    const creates: any[] = [];

    for (const doc of fishbowlSnap.docs) {
      const customer = doc.data();
      const copperId = customer.copperId;

      if (copperId) {
        stats.withCopperId++;

        // Check if already active in Copper
        try {
          const checkRes = await fetch(`${COPPER_API_BASE}/companies/${copperId}`, {
            method: 'GET',
            headers: {
              'X-PW-AccessToken': COPPER_API_KEY,
              'X-PW-Application': 'developer_api',
              'X-PW-UserEmail': COPPER_USER_EMAIL,
              'Content-Type': 'application/json',
            },
          });

          if (!checkRes.ok) {
            stats.copperNotFound++;
            console.log(`⚠️ Copper company not found (deleted?): ${copperId} (${customer.name}) - Will recreate`);
            
            // Invalid Copper ID - treat as new customer and recreate
            // Skip if no name
            if (!customer.name || customer.name.trim() === '') {
              console.log(`⚠️ Skipping customer ${customer.customerNum} (deleted Copper ID) - no name`);
              continue;
            }
            
            creates.push({
              fishbowlDocId: doc.id,
              customerNum: customer.customerNum,
              customerName: customer.name,
              accountNumber: customer.accountNumber,
              salesPerson: customer.salesPerson,
              accountType: customer.accountType,
              shippingAddress: customer.shippingAddress,
              shippingCity: customer.shippingCity,
              shippingState: customer.shippingState,
              shippingZip: customer.shippingZip,
              action: 'recreate',
              oldCopperId: copperId
            });
            continue;
          }

          const copperCompany = await checkRes.json();
          
          // Custom fields are in custom_fields array with field_id
          const customFields = copperCompany.custom_fields || [];
          const activeField = customFields.find((f: any) => f.custom_field_definition_id === 712751);
          const activeValue = activeField?.value;
          
          // Checkbox returns true when checked, false/null/undefined when unchecked
          const isActive = activeValue === true;

          if (isActive) {
            stats.copperAlreadyActive++;
          } else {
            // Need to mark as active
            updates.push({
              copperId,
              customerName: customer.name,
              action: 'mark_active'
            });
          }
          
          // Rate limit: 300ms between requests
          await new Promise(r => setTimeout(r, 300));
        } catch (error: any) {
          stats.errors++;
          console.error(`❌ Error checking Copper ${copperId}:`, error.message);
          
          // Rate limit even on errors
          await new Promise(r => setTimeout(r, 300));
        }
      } else {
        stats.withoutCopperId++;
        
        // Need to create in Copper - skip if no name
        if (!customer.name || customer.name.trim() === '') {
          console.log(`⚠️ Skipping customer ${customer.customerNum} - no name`);
          continue;
        }
        
        creates.push({
          fishbowlDocId: doc.id,
          customerNum: customer.customerNum,
          customerName: customer.name,
          accountNumber: customer.id || customer.accountId || customer.accountNumber || doc.id,
          salesPerson: customer.salesPerson,
          accountType: customer.accountType,
          shippingAddress: customer.shippingAddress,
          shippingCity: customer.shippingCity,
          shippingState: customer.shippingState,
          shippingZip: customer.shippingZip,
          action: 'create'
        });
      }
    }

    const recreates = creates.filter((c: any) => c.action === 'recreate').length;
    const newCreates = creates.filter((c: any) => c.action === 'create').length;

    console.log(`\n📊 Analysis Complete:`);
    console.log(`   Fishbowl customers: ${stats.fishbowlCustomers}`);
    console.log(`   With Copper ID: ${stats.withCopperId}`);
    console.log(`   Without Copper ID: ${stats.withoutCopperId}`);
    console.log(`   `);
    console.log(`   ✅ Already active: ${stats.copperAlreadyActive}`);
    console.log(`   🔄 Need to activate: ${updates.length}`);
    console.log(`   ➕ Need to CREATE (new): ${newCreates}`);
    console.log(`   🔄 Need to RECREATE (deleted from Copper): ${recreates}`);
    console.log(`   📊 Total creates in LIVE MODE: ${creates.length}`);

    if (dryRun) {
      console.log(`\n🔍 DRY RUN - No changes made`);
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats,
        updates: updates.slice(0, 20),
        creates: creates.slice(0, 20)
      });
    }

    // LIVE MODE - First check for duplicates, then update + create
    console.log(`\n🔥 LIVE MODE - Checking duplicates, updating ${updates.length}, creating ${creates.length}...`);

    // Start streaming response for LIVE MODE
    if (useStreaming) {
      // Don't await - start sending response immediately
      (async () => {
        // Continue processing in background...
      })();
    }

    // 0. Check for duplicates by address before creating
    console.log(`\n🔍 Checking for duplicate companies in Copper by address...`);
    await sendProgress({ stage: '🔍 Checking for duplicates...', current: 0, total: creates.length });
    
    const verified: any[] = [];
    let dupCheckIndex = 0;
    
    for (const create of creates) {
      dupCheckIndex++;
      if (!create.shippingAddress || create.shippingAddress.trim() === '') {
        // No address to match - proceed with create
        verified.push(create);
        continue;
      }

      try {
        // Search Copper for companies with matching address
        const searchRes = await fetch(`${COPPER_API_BASE}/companies/search`, {
          method: 'POST',
          headers: {
            'X-PW-AccessToken': COPPER_API_KEY,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': COPPER_USER_EMAIL,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page_size: 5,
            sort_by: 'name',
            // Search by address
            address: {
              street: create.shippingAddress
            }
          })
        });

        if (searchRes.ok) {
          const searchResults = await searchRes.json();
          
          // Look for exact address match
          let match = null;
          for (const company of searchResults) {
            const copperAddr = company.address?.street || '';
            const fishbowlAddr = create.shippingAddress || '';
            
            // Normalize addresses for comparison
            const normalizeAddr = (addr: string) => 
              addr.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            if (normalizeAddr(copperAddr) === normalizeAddr(fishbowlAddr)) {
              // Check if zip also matches for higher confidence
              const copperZip = company.address?.postal_code || '';
              const fishbowlZip = create.shippingZip || '';
              
              if (copperZip === fishbowlZip || !fishbowlZip) {
                match = company;
                break;
              }
            }
          }

          if (match) {
            stats.duplicatesFound++;
            console.log(`🔗 Found duplicate: ${match.name} (Copper ID: ${match.id}) matches ${create.customerName}`);
            await sendProgress({ 
              stage: '🔗 Found duplicate - linking...', 
              current: dupCheckIndex, 
              total: creates.length 
            });
            
            // Link this Copper ID to Fishbowl customer
            const { adminDb: db } = await import('@/lib/firebase/admin');
            const { Timestamp } = await import('firebase-admin/firestore');
            
            await db.collection('fishbowl_customers').doc(create.fishbowlDocId).update({
              copperId: String(match.id),
              copperCompanyId: String(match.id),
              copperCompanyName: match.name,
              accountTypeSource: 'copper_duplicate_found',
              updatedAt: Timestamp.now()
            });
            
            // Check if name needs updating in Copper
            if (match.name !== create.customerName) {
              console.log(`  � Name mismatch: Copper="${match.name}" vs Fishbowl="${create.customerName}" - Updating Copper...`);
              
              // Update the name in Copper to match Fishbowl (source of truth)
              const updateNameRes = await fetch(`${COPPER_API_BASE}/companies/${match.id}`, {
                method: 'PUT',
                headers: {
                  'X-PW-AccessToken': COPPER_API_KEY,
                  'X-PW-Application': 'developer_api',
                  'X-PW-UserEmail': COPPER_USER_EMAIL,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: create.customerName
                })
              });
              
              if (updateNameRes.ok) {
                stats.namesUpdated++;
                console.log(`  ✅ Updated Copper name to: ${create.customerName}`);
              } else {
                console.error(`  ⚠️ Failed to update name: ${updateNameRes.status}`);
              }
            }
            
            // Mark as active if needed
            const customFields = match.custom_fields || [];
            const activeField = customFields.find((f: any) => f.custom_field_definition_id === 712751);
            const isActive = activeField?.value === true;
            
            if (!isActive) {
              const activateRes = await fetch(`${COPPER_API_BASE}/companies/${match.id}`, {
                method: 'PUT',
                headers: {
                  'X-PW-AccessToken': COPPER_API_KEY,
                  'X-PW-Application': 'developer_api',
                  'X-PW-UserEmail': COPPER_USER_EMAIL,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  custom_fields: [
                    { custom_field_definition_id: 712751, value: true }
                  ]
                })
              });
              
              if (activateRes.ok) {
                stats.copperUpdated++;
                console.log(`  ✅ Marked as active`);
              }
            } else {
              console.log(`  ✅ Already active`);
            }
            
            // Don't create - we found and linked the duplicate
            continue;
          }
        }
        
        // No duplicate found - proceed with create
        verified.push(create);
        
        // Update progress every 10 checks
        if (dupCheckIndex % 10 === 0) {
          await sendProgress({ 
            stage: '🔍 Checking for duplicates...', 
            current: dupCheckIndex, 
            total: creates.length 
          });
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 300));
      } catch (error: any) {
        console.error(`⚠️ Error checking duplicate for ${create.customerName}:`, error.message);
        // On error, proceed with create to be safe
        verified.push(create);
      }
    }

    console.log(`\n📊 Duplicate check complete:`);
    console.log(`   Duplicates found & linked: ${stats.duplicatesFound}`);
    console.log(`   Names updated: ${stats.namesUpdated}`);
    console.log(`   Verified for creation: ${verified.length}`);
    
    await sendProgress({ 
      stage: `✅ Duplicate check done: ${stats.duplicatesFound} found`, 
      current: creates.length, 
      total: creates.length 
    });

    // 1. Mark existing companies as active
    await sendProgress({ stage: '🟢 Marking existing companies active...', current: 0, total: updates.length });
    
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
            'Active Customer cf_712751': true
          })
        });

        if (updateRes.ok) {
          stats.copperUpdated++;
          console.log(`✅ Marked ${update.customerName} as active`);
          
          // Progress every 5 updates
          if (updateIndex % 5 === 0) {
            await sendProgress({ 
              stage: '🟢 Marking companies active...', 
              current: updateIndex, 
              total: updates.length 
            });
          }
        } else {
          stats.errors++;
          console.error(`❌ Failed to update ${update.customerName}: ${updateRes.status}`);
        }

        // Rate limit: 300ms between requests (~3 req/sec, well under 150/min limit)
        await new Promise(r => setTimeout(r, 300));
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ Error updating ${update.customerName}:`, error.message);
      }
    }

    // 2. Create verified (non-duplicate) companies in Copper
    await sendProgress({ stage: '➕ Creating new companies...', current: 0, total: verified.length });
    
    const { adminDb: db } = await import('@/lib/firebase/admin');
    const { Timestamp } = await import('firebase-admin/firestore');
    
    let createIndex = 0;
    for (const create of verified) {
      createIndex++;
      try {
        // Map accountType to Copper option ID
        const accountTypeMap: Record<string, number> = {
          'Distributor': 1981470,
          'Wholesale': 2063862,
          'Retail': 2066840
        };
        const copperAccountType = accountTypeMap[create.accountType] || 2066840;

        const createRes = await fetch(`${COPPER_API_BASE}/companies`, {
          method: 'POST',
          headers: {
            'X-PW-AccessToken': COPPER_API_KEY,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': COPPER_USER_EMAIL,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: create.customerName,
            address: {
              street: create.shippingAddress || '',
              city: create.shippingCity || '',
              state: create.shippingState || '',
              postal_code: create.shippingZip || '',
              country: 'US'
            },
            custom_fields: [
              { custom_field_definition_id: 698467, value: create.accountNumber },
              { custom_field_definition_id: 675914, value: [copperAccountType] },
              { custom_field_definition_id: 712751, value: true }
            ]
          })
        });

        if (createRes.ok) {
          const newCompany = await createRes.json();
          stats.copperCreated++;
          
          // Update fishbowl_customers with new copperId and accountNumber
          await db.collection('fishbowl_customers').doc(create.fishbowlDocId).update({
            copperId: String(newCompany.id),
            accountNumber: create.accountNumber,
            accountTypeSource: 'copper_created',
            updatedAt: Timestamp.now()
          });
          
          console.log(`✅ [${createIndex}/${verified.length}] Created: ${create.customerName} (ID: ${newCompany.id})`);
          
          // Progress every 5 creates
          if (createIndex % 5 === 0 || createIndex === verified.length) {
            await sendProgress({ 
              stage: '➕ Creating new companies...', 
              current: createIndex, 
              total: verified.length 
            });
          }
        } else {
          const errorText = await createRes.text();
          stats.errors++;
          console.error(`❌ [${createIndex}/${verified.length}] Failed to create ${create.customerName}: ${createRes.status} - ${errorText}`);
        }

        // Rate limit: 300ms between requests (~3 req/sec, well under 150/min limit)
        await new Promise(r => setTimeout(r, 300));
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ Error creating ${create.customerName}:`, error.message);
      }
    }

    console.log(`\n✅ Sync Complete:`);
    console.log(`   Duplicates found: ${stats.duplicatesFound}`);
    console.log(`   Names updated: ${stats.namesUpdated}`);
    console.log(`   Updated (marked active): ${stats.copperUpdated}`);
    console.log(`   Created (new): ${stats.copperCreated}`);
    console.log(`   Errors: ${stats.errors}`);
    
    const result = {
      success: true,
      dryRun: false,
      stats,
      complete: true
    };

    if (useStreaming && writer && stream) {
      // Send final result
      await sendProgress(result);
      await writer.close();
      
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Copper active flag sync failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync active flags' },
      { status: 500 }
    );
  }
}
