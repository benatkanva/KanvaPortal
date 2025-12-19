import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

interface SyncStats {
  dryRun: boolean;
  copperCompaniesLoaded: number;
  activeCompanies: number;
  fishbowlCustomersLoaded: number;
  usersLoaded: number;
  
  wouldCreate: number;
  wouldUpdate: number;
  noChanges: number;
  errors: number;
  
  changes: ChangeDetail[];
  errors_details: ErrorDetail[];
}

interface ChangeDetail {
  fishbowlCustomerId?: string;
  copperCompanyId: string;
  companyName: string;
  action: 'create' | 'update' | 'no_change';
  fieldsChanged: string[];
  before?: any;
  after?: any;
  concerns: string[];
}

interface ErrorDetail {
  copperCompanyId: string;
  companyName: string;
  error: string;
}

/**
 * Normalize account type from Copper to Commission Calculator format
 * Handles multiple Copper field formats:
 * - String: "Wholesale", "Distributor", "Retail"
 * - Array: ["Wholesale"], [2063862]
 * - Number: 2063862 (Copper option ID)
 * - MultiSelect object: { id: 2063862, name: "Wholesale" }
 */
function normalizeAccountType(copperType: any, companyName?: string, debug = false): string {
  if (!copperType) {
    if (debug) console.log(`   [${companyName}] No account type, defaulting to Retail`);
    return 'Retail';
  }
  
  // Handle array format (MultiSelect)
  if (Array.isArray(copperType)) {
    if (copperType.length === 0) {
      if (debug) console.log(`   [${companyName}] Empty array, defaulting to Retail`);
      return 'Retail';
    }
    
    // Take first item if array
    const firstItem = copperType[0];
    
    // If it's an object with name property
    if (typeof firstItem === 'object' && firstItem.name) {
      if (debug) console.log(`   [${companyName}] Array with object: ${firstItem.name}`);
      return normalizeAccountType(firstItem.name, companyName, false);
    }
    
    // If it's a number (option ID)
    if (typeof firstItem === 'number') {
      // Map Copper option IDs to types
      // 1981470 = Distributor, 2063862 = Wholesale, 2066840 = Retail
      const typeMap: Record<number, string> = {
        1981470: 'Distributor',
        2063862: 'Wholesale',
        2066840: 'Retail',
      };
      const mapped = typeMap[firstItem] || 'Retail';
      if (debug) console.log(`   [${companyName}] Array with ID ${firstItem} → ${mapped}`);
      return mapped;
    }
    
    // Otherwise treat as string
    if (debug) console.log(`   [${companyName}] Array with string: ${firstItem}`);
    return normalizeAccountType(firstItem, companyName, false);
  }
  
  // Handle number (option ID)
  if (typeof copperType === 'number') {
    const typeMap: Record<number, string> = {
      1981470: 'Distributor',
      2063862: 'Wholesale',
      2066840: 'Retail',
    };
    const mapped = typeMap[copperType] || 'Retail';
    if (debug) console.log(`   [${companyName}] Number ID ${copperType} → ${mapped}`);
    return mapped;
  }
  
  // Handle object format
  if (typeof copperType === 'object' && copperType.name) {
    if (debug) console.log(`   [${companyName}] Object with name: ${copperType.name}`);
    return normalizeAccountType(copperType.name, companyName, false);
  }
  
  // Handle string format
  const typeStr = String(copperType).toLowerCase().trim();
  
  if (debug) console.log(`   [${companyName}] Raw value: "${copperType}" → string: "${typeStr}"`);
  
  if (typeStr.includes('distributor') || typeStr.includes('distribution')) {
    return 'Distributor';
  }
  if (typeStr.includes('wholesale')) {
    return 'Wholesale';
  }
  
  if (debug) console.log(`   [${companyName}] No match, defaulting to Retail`);
  return 'Retail';
}

/**
 * Check if a company is active in Copper
 */
function isActiveCompany(copperData: any): boolean {
  const isActive = copperData['Active Customer cf_712751'];
  const activeValues = ['checked', 'true', 'Checked', true];
  return activeValues.includes(isActive);
}

/**
 * Extract and normalize address fields from Copper
 */
function extractAddress(copperData: any) {
  return {
    street: copperData['Street'] || copperData['street'] || '',
    city: copperData['city'] || copperData['City'] || '',
    state: copperData['State'] || copperData['state'] || '',
    zip: copperData['Postal Code'] || copperData['postal_code'] || copperData['zip'] || '',
    country: copperData['country'] || copperData['Country'] || '',
  };
}

/**
 * Compare two values and determine if they're different
 */
function hasChanged(oldVal: any, newVal: any): boolean {
  // Normalize empty values
  const old = oldVal === null || oldVal === undefined || oldVal === '' ? '' : String(oldVal).trim();
  const newV = newVal === null || newVal === undefined || newVal === '' ? '' : String(newVal).trim();
  
  return old !== newV;
}

export async function POST(request: NextRequest) {
  try {
    // Check if this is a live run or dry run
    const { searchParams } = new URL(request.url);
    const isLiveMode = searchParams.get('live') === 'true';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 CUSTOMER SYNC ${isLiveMode ? '🔴 LIVE MODE' : '🟢 DRY RUN'}`);
    console.log(`${'='.repeat(80)}\n`);

    const stats: SyncStats = {
      dryRun: !isLiveMode,
      copperCompaniesLoaded: 0,
      activeCompanies: 0,
      fishbowlCustomersLoaded: 0,
      usersLoaded: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      noChanges: 0,
      errors: 0,
      changes: [],
      errors_details: [],
    };

    // STEP 1: Load Users (for sales rep mapping)
    console.log('📂 Loading users collection...');
    const usersSnap = await adminDb.collection('users').get();
    const usersByCopperId = new Map<number, any>();
    
    usersSnap.forEach(doc => {
      const userData = doc.data();
      if (userData.copperUserId) {
        usersByCopperId.set(Number(userData.copperUserId), {
          id: doc.id,
          name: userData.name || '',
          salesPerson: userData.salesPerson || '',
          email: userData.email || userData.copperUserEmail || '',
          region: userData.region || '',
          title: userData.title || '',
        });
      }
    });
    
    stats.usersLoaded = usersByCopperId.size;
    console.log(`   ✅ Loaded ${stats.usersLoaded} users with Copper IDs`);

    // STEP 2: Load copper_companies (ACTIVE ONLY)
    console.log('\n📂 Loading copper_companies collection...');
    const copperSnap = await adminDb.collection('copper_companies').get();
    
    const activeCopperCompanies: any[] = [];
    copperSnap.forEach(doc => {
      const copperData = doc.data();
      
      // Filter: ACTIVE companies only
      if (isActiveCompany(copperData)) {
        activeCopperCompanies.push({
          id: doc.id,
          ...copperData,
        });
      }
    });
    
    stats.copperCompaniesLoaded = copperSnap.size;
    stats.activeCompanies = activeCopperCompanies.length;
    console.log(`   ✅ Loaded ${stats.copperCompaniesLoaded} companies (${stats.activeCompanies} active)`);

    // STEP 2.5: Build Copper indexes (prefer records with more data for duplicates)
    console.log('\n🔍 Building Copper company indexes (handling duplicates)...');
    const copperByAccountOrderId = new Map<string, any>();
    const copperByCopperId = new Map<string, any>();
    
    // Helper: Score a record's completeness (higher = more complete)
    function scoreCompleteness(company: any): number {
      let score = 0;
      if (company['Region cf_680701']) score += 10;
      if (company.Street) score += 5;
      if (company.city) score += 5;
      if (company.State) score += 5;
      if (company['Postal Code']) score += 3;
      if (company.assignee_id) score += 2;
      return score;
    }
    
    activeCopperCompanies.forEach(company => {
      const copperId = String(company.id);
      const accountOrderId = company['Account Order ID cf_698467'];
      
      // Always set by Copper ID (unique)
      copperByCopperId.set(copperId, company);
      
      // For Account Order ID, prefer the record with more data
      if (accountOrderId) {
        const key = String(accountOrderId).trim();
        const existing = copperByAccountOrderId.get(key);
        
        if (!existing) {
          copperByAccountOrderId.set(key, company);
        } else {
          // We have a duplicate! Choose the one with more data
          const existingScore = scoreCompleteness(existing);
          const newScore = scoreCompleteness(company);
          
          if (newScore > existingScore) {
            console.log(`   ⚠️ Duplicate Account Order ${key}: Preferring ${company.name} (score ${newScore}) over ${existing.name} (score ${existingScore})`);
            copperByAccountOrderId.set(key, company);
          }
        }
      }
    });
    
    console.log(`   ✅ Indexed ${copperByCopperId.size} by Copper ID`);
    console.log(`   ✅ Indexed ${copperByAccountOrderId.size} by Account Order ID (duplicates resolved)\n`);

    // STEP 3: Load fishbowl_customers (current state)
    console.log('\n📂 Loading fishbowl_customers collection...');
    const fishbowlSnap = await adminDb.collection('fishbowl_customers').get();
    
    // Build multiple indexes for matching
    const fishbowlByAccountNumber = new Map<string, any>();
    const fishbowlByCopperId = new Map<string, any>();
    const fishbowlByAccountId = new Map<string, any>();
    
    fishbowlSnap.forEach(doc => {
      const data: any = { id: doc.id, ...doc.data() };
      
      if (data.accountNumber) {
        fishbowlByAccountNumber.set(String(data.accountNumber).trim(), data);
      }
      if (data.copperId) {
        fishbowlByCopperId.set(String(data.copperId).trim(), data);
      }
      if (data.accountId) {
        fishbowlByAccountId.set(String(data.accountId).trim(), data);
      }
    });
    
    stats.fishbowlCustomersLoaded = fishbowlSnap.size;
    console.log(`   ✅ Loaded ${stats.fishbowlCustomersLoaded} fishbowl customers`);

    // STEP 4: Process each de-duplicated Copper company
    // Use copperByAccountOrderId which has duplicates resolved (best record chosen)
    const uniqueCompanies = Array.from(copperByAccountOrderId.values());
    console.log(`\n🔍 Analyzing ${uniqueCompanies.length} unique active Copper companies (duplicates resolved)...\n`);
    
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;
    let processedCount = 0;

    for (const copperCompany of uniqueCompanies) {
      try {
        const copperName = copperCompany.name || '';
        const copperAccountOrderId = copperCompany['Account Order ID cf_698467'] || '';
        const copperAccountType = copperCompany['Account Type cf_675914'] || '';
        const copperAccountId = copperCompany['Account ID cf_713477'] || '';
        const copperRegion = copperCompany['Region cf_680701'] || '';
        const copperAssigneeId = copperCompany.assignee_id;
        
        // Debug logging for first 20 companies to diagnose Account Type format
        const enableDebug = processedCount < 20;
        if (enableDebug) {
          console.log(`\n🔍 DEBUG #${processedCount + 1}: ${copperName}`);
          console.log(`   Raw Account Type field:`, copperAccountType);
          console.log(`   Type: ${typeof copperAccountType}`);
          if (Array.isArray(copperAccountType)) {
            console.log(`   Array length: ${copperAccountType.length}`);
            console.log(`   Array contents:`, copperAccountType);
          }
        }
        
        processedCount++;
        
        const address = extractAddress(copperCompany);
        
        // Map Copper assignee to sales rep
        let salesRepData = null;
        if (copperAssigneeId && usersByCopperId.has(Number(copperAssigneeId))) {
          salesRepData = usersByCopperId.get(Number(copperAssigneeId));
        }

        // Find matching fishbowl_customer
        let existingCustomer = null;
        let matchMethod = '';
        
        // Try matching by Copper ID first
        if (copperCompany.id && fishbowlByCopperId.has(copperCompany.id)) {
          existingCustomer = fishbowlByCopperId.get(copperCompany.id);
          matchMethod = 'copperId';
        }
        // Try matching by Account Order ID
        else if (copperAccountOrderId && fishbowlByAccountNumber.has(String(copperAccountOrderId).trim())) {
          existingCustomer = fishbowlByAccountNumber.get(String(copperAccountOrderId).trim());
          matchMethod = 'accountNumber';
        }
        // Try matching by Account ID
        else if (copperAccountId && fishbowlByAccountId.has(String(copperAccountId).trim())) {
          existingCustomer = fishbowlByAccountId.get(String(copperAccountId).trim());
          matchMethod = 'accountId';
        }

        // Build the new customer data from Copper
        // MERGE STRATEGY: Only update fields that have values in Copper
        const newCustomerData: any = {
          copperId: copperCompany.id,
          accountTypeSource: 'copper_companies',
          syncedFromCopperAt: Timestamp.now(),
        };
        
        // Only update if Copper has a value (don't overwrite with empty strings)
        if (copperName) newCustomerData.name = copperName;
        if (copperAccountOrderId) newCustomerData.accountNumber = copperAccountOrderId;
        if (copperAccountId) newCustomerData.accountId = copperAccountId;
        if (copperRegion) newCustomerData.region = copperRegion;
        
        // Account Type: Always set if Copper has data, or if creating new customer
        if (copperAccountType || !existingCustomer) {
          newCustomerData.accountType = normalizeAccountType(copperAccountType, copperName, enableDebug);
        }
        
        // Address fields: Only update if Copper has values
        if (address.street) {
          newCustomerData.billingAddress = address.street;
          newCustomerData.shippingAddress = address.street;
        }
        if (address.city) {
          newCustomerData.billingCity = address.city;
          newCustomerData.shippingCity = address.city;
        }
        if (address.state) {
          newCustomerData.billingState = address.state;
          newCustomerData.shippingState = address.state;
        }
        if (address.zip) {
          newCustomerData.billingZip = address.zip;
          newCustomerData.shipToZip = address.zip;
        }
        if (address.country) {
          newCustomerData.shippingCountry = address.country;
        }

        // Add sales rep data if available
        if (salesRepData) {
          newCustomerData.salesPerson = salesRepData.salesPerson;
          newCustomerData.salesRepName = salesRepData.name;
          newCustomerData.salesRepEmail = salesRepData.email;
          newCustomerData.salesRepRegion = salesRepData.region;
        }

        // Determine action: skip or update
        if (!existingCustomer) {
          // NO MATCH FOUND - SKIP (do not create new customers)
          // Customers must be created from Fishbowl data first, then enriched by Copper
          stats.wouldCreate++;
          
          stats.changes.push({
            copperCompanyId: copperCompany.id,
            companyName: copperName,
            action: 'no_change',
            fieldsChanged: [],
            after: {},
            concerns: [
              '⚠️ No matching customer in fishbowl_customers',
              'Customer must be imported from Fishbowl before Copper sync can update it',
              'SKIPPED - Not creating new customer',
            ],
          });
          
          // Log warning for first 10 unmatched companies
          if (stats.wouldCreate <= 10) {
            console.log(`⚠️  SKIPPED (No match): ${copperName} - Copper ID: ${copperCompany.id}, Account Order ID: ${copperAccountOrderId || 'N/A'}`);
          }
          
          // DO NOT CREATE - just skip and continue
        } else {
          // EXISTING CUSTOMER - check what would change
          const fieldsChanged: string[] = [];
          const before: any = {};
          const after: any = {};
          const concerns: string[] = [];

          // Compare each field
          for (const [key, newValue] of Object.entries(newCustomerData)) {
            if (key === 'syncedFromCopperAt') continue; // Always updates
            
            const oldValue = existingCustomer[key];
            
            if (hasChanged(oldValue, newValue)) {
              fieldsChanged.push(key);
              before[key] = oldValue;
              after[key] = newValue;
              
              // Flag critical changes
              if (key === 'accountType') {
                concerns.push(`⚠️ Account Type changing: "${oldValue}" → "${newValue}"`);
              }
            }
          }

          // Check if we're preserving critical fields
          const preservedFields = ['transferStatus', 'originalOwner', 'fishbowlUsername'];
          const hasPreservedData = preservedFields.some(field => existingCustomer[field]);
          
          if (hasPreservedData) {
            concerns.push(`✅ Preserving: ${preservedFields.filter(f => existingCustomer[f]).join(', ')}`);
          }
          
          // Warn if Account Type is not being updated because Copper has no value
          if (!copperAccountType && existingCustomer.accountType) {
            concerns.push(`ℹ️ Account Type not synced (Copper field is empty, keeping existing: "${existingCustomer.accountType}")`);
          }
          
          // Warn if address fields are missing in Copper
          if (!address.street && existingCustomer.billingAddress) {
            concerns.push(`ℹ️ Address not synced (Copper has no address data)`);
          }

          if (fieldsChanged.length === 0) {
            stats.noChanges++;
          } else {
            stats.wouldUpdate++;
            
            stats.changes.push({
              fishbowlCustomerId: existingCustomer.id,
              copperCompanyId: copperCompany.id,
              companyName: copperName,
              action: 'update',
              fieldsChanged,
              before,
              after,
              concerns,
            });

            if (isLiveMode) {
              const updateData = { ...newCustomerData };
              
              // PRESERVE commission-specific fields
              if (existingCustomer.transferStatus !== undefined) {
                delete updateData.transferStatus;
              }
              if (existingCustomer.originalOwner !== undefined) {
                delete updateData.originalOwner;
              }
              if (existingCustomer.fishbowlUsername !== undefined) {
                delete updateData.fishbowlUsername;
              }
              
              updateData.updatedAt = Timestamp.now();

              const customerRef = adminDb.collection('fishbowl_customers').doc(existingCustomer.id);
              batch.update(customerRef, updateData);
              batchCount++;
            }
          }
        }

        // Commit batch if needed
        if (isLiveMode && batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates`);
          batch = adminDb.batch();
          batchCount = 0;
        }

      } catch (error: any) {
        stats.errors++;
        stats.errors_details.push({
          copperCompanyId: copperCompany.id,
          companyName: copperCompany.name || 'Unknown',
          error: error.message,
        });
      }
    }

    // Commit final batch
    if (isLiveMode && batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} updates`);
    }

    // STEP 5: Generate report
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SYNC REPORT ${isLiveMode ? '(LIVE)' : '(DRY RUN)'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Copper Companies (Active):  ${stats.activeCompanies}`);
    console.log(`Fishbowl Customers:         ${stats.fishbowlCustomersLoaded}`);
    console.log(`Users Mapped:               ${stats.usersLoaded}`);
    console.log('');
    console.log(`${isLiveMode ? 'Created' : 'Would Create'}:            ${stats.wouldCreate}`);
    console.log(`${isLiveMode ? 'Updated' : 'Would Update'}:            ${stats.wouldUpdate}`);
    console.log(`No Changes:                 ${stats.noChanges}`);
    console.log(`Errors:                     ${stats.errors}`);
    console.log(`${'='.repeat(80)}\n`);

    // Show sample changes
    if (stats.changes.length > 0) {
      console.log(`\n📝 Sample Changes (first 10):`);
      stats.changes.slice(0, 10).forEach((change, idx) => {
        console.log(`\n${idx + 1}. ${change.companyName} (${change.action})`);
        if (change.action === 'update') {
          console.log(`   Changed: ${change.fieldsChanged.join(', ')}`);
          if (change.concerns.length > 0) {
            change.concerns.forEach(c => console.log(`   ${c}`));
          }
        }
      });
    }

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
