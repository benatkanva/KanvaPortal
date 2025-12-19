import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes (memory: 512MB set in firebase.json)

interface MatchResult {
  fishbowlCustomerId: string;
  fishbowlCustomerName: string;
  copperCompanyId: string;
  copperCompanyName: string;
  matchType: 'account_number' | 'account_order_id' | 'account_id' | 'account_number_fallback' | 'name';
  confidence: 'high' | 'medium' | 'low';
  accountNumber?: string;
  accountOrderId?: string;
}

/**
 * Normalize address for matching
 */
function normalizeAddress(address: any): string {
  if (!address || typeof address !== 'string') return '';
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/g, '') // Remove street types
    .trim();
}

interface UnmatchedAccount {
  fishbowlId: string;
  fishbowlName: string;
  fishbowlAccountId: string;
  copperId: string | null;
  copperName: string | null;
  currentAccountOrderId: string | null;
}

/**
 * Match Fishbowl customers to Copper companies
 */
async function matchCopperToFishbowl(): Promise<{
  matches: MatchResult[];
  unmatchedAccounts: UnmatchedAccount[];
  stats: {
    totalFishbowlCustomers: number;
    totalCopperCompanies: number;
    matched: number;
    unmatched: number;
    unmatchedReasons?: {
      alreadyHasCopperId: number;
      noAccountId: number;
      accountIdNotInCopper: number;
    };
  };
}> {
  console.log('🔗 Starting Fishbowl → Copper matching...');
  
  // Get all Fishbowl customers
  console.log('📥 Loading Fishbowl customers...');
  const fishbowlSnapshot = await adminDb.collection('fishbowl_customers').get();
  const fishbowlCustomers = fishbowlSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];
  
  console.log(`✅ Found ${fishbowlCustomers.length} Fishbowl customers`);
  
  // Get ALL Copper companies (no limit - we need all 270K)
  console.log('📥 Loading Copper companies (this takes 20-30 seconds for 270K records)...');
  const startLoad = Date.now();
  const copperSnapshot = await adminDb.collection('copper_companies').get();
  const copperCompanies = copperSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      firestoreId: doc.id,  // Firestore document ID
      id: data.id,          // Actual Copper company ID
      ...data
    };
  }) as any[];
  const loadTime = ((Date.now() - startLoad) / 1000).toFixed(1);
  
  console.log(`✅ Loaded ${copperCompanies.length} Copper companies in ${loadTime}s`);
  
  const matches: MatchResult[] = [];
  const matchedFishbowlIds = new Set<string>();
  
  // Build fast lookup maps
  console.log('🗺️  Building lookup maps for fast matching...');
  const copperByAccountId = new Map();    // Map by Account ID cf_713477 (Copper's custom field, always populated)
  const copperByOrderId = new Map();       // Map by Account Order ID cf_698467 (matches Fishbowl accountId OR accountNumber)
  const copperByAddress = new Map();       // Map by normalized address
  
  for (const copper of copperCompanies) {
    // Map by Account ID cf_713477 (Copper's custom workflow field - always has a value)
    const accountId = copper['Account ID cf_713477'] || copper['Account ID'];
    if (accountId && String(accountId).trim() !== '') {
      copperByAccountId.set(String(accountId).trim(), copper);
    }
    
    // Map by Account Order ID cf_698467 (Should contain Fishbowl accountId OR accountNumber)
    const orderId = copper['Account Order ID cf_698467'];
    if (orderId && String(orderId).trim() !== '') {
      copperByOrderId.set(String(orderId).trim(), copper);
    }
    
    // Map by normalized address for fallback matching
    const address = copper.Street || copper.street || copper.Address || copper.address || '';
    if (address) {
      const normalized = normalizeAddress(address);
      if (normalized.length > 5) {
        copperByAddress.set(normalized, copper);
      }
    }
  }
  
  const mapTime = ((Date.now() - startLoad) / 1000).toFixed(1);
  console.log(`✅ Built maps in ${mapTime}s: ${copperByAccountId.size} account IDs, ${copperByOrderId.size} order IDs, ${copperByAddress.size} addresses`);
  
  // Strategy 1: Match by Fishbowl accountId → Copper Account Order ID cf_698467
  console.log('🔍 Strategy 1: Matching by Fishbowl accountId → Copper Account Order ID cf_698467...');
  const startMatch = Date.now();
  for (const fishbowl of fishbowlCustomers) {
    // Fishbowl accountId = auto-generated number that should match Copper's Account Order ID
    const fishbowlAccountId = fishbowl.accountId;
    
    if (fishbowlAccountId && String(fishbowlAccountId).trim() !== '') {
      const copper = copperByOrderId.get(String(fishbowlAccountId).trim());
      
      if (copper && !matchedFishbowlIds.has(fishbowl.id)) {
        matches.push({
          fishbowlCustomerId: String(fishbowl.id),
          fishbowlCustomerName: fishbowl.name || '',
          copperCompanyId: String(copper.id), // Copper's system ID (source of truth)
          copperCompanyName: copper.Name || copper.name || '',
          matchType: 'account_order_id',
          confidence: 'high',
          accountOrderId: String(fishbowlAccountId)
        });
        matchedFishbowlIds.add(fishbowl.id);
      }
    }
  }
  
  console.log(`✅ Matched ${matches.length} by accountId`);
  
  // Strategy 2: Match by Fishbowl accountNumber → Copper Account Order ID cf_698467
  console.log('🔍 Strategy 2: Matching by Fishbowl accountNumber → Copper Account Order ID cf_698467...');
  for (const fishbowl of fishbowlCustomers) {
    if (matchedFishbowlIds.has(fishbowl.id)) continue; // Already matched
    
    // Fishbowl accountNumber = different auto-generated number that can also match Account Order ID
    const fishbowlAccountNumber = fishbowl.accountNumber;
    
    if (fishbowlAccountNumber && String(fishbowlAccountNumber).trim() !== '') {
      const copper = copperByOrderId.get(String(fishbowlAccountNumber).trim());
      
      if (copper && !matchedFishbowlIds.has(fishbowl.id)) {
        matches.push({
          fishbowlCustomerId: String(fishbowl.id),
          fishbowlCustomerName: fishbowl.name || '',
          copperCompanyId: String(copper.id),
          copperCompanyName: copper.Name || copper.name || '',
          matchType: 'account_order_id',
          confidence: 'high',
          accountOrderId: String(fishbowlAccountNumber)
        });
        matchedFishbowlIds.add(fishbowl.id);
      }
    }
  }
  
  console.log(`✅ Matched ${matches.length} total after accountNumber matching`);
  
  // Strategy 3: Match by Address (for new Fishbowl customers without Copper link)
  console.log('🔍 Strategy 3: Matching by Address...');
  for (const fishbowl of fishbowlCustomers) {
    if (matchedFishbowlIds.has(fishbowl.id)) continue; // Already matched
    
    const fishbowlAddress = fishbowl.address || fishbowl.street || '';
    const normalizedFishbowlAddress = normalizeAddress(fishbowlAddress);
    
    if (normalizedFishbowlAddress.length > 5) { // Minimum address length
      // FAST lookup using Map
      const copper = copperByAddress.get(normalizedFishbowlAddress);
      
      if (copper && !matchedFishbowlIds.has(fishbowl.id)) {
        matches.push({
          fishbowlCustomerId: fishbowl.id,
          fishbowlCustomerName: fishbowl.name || '',
          copperCompanyId: String(copper.id),
          copperCompanyName: copper.Name || copper.name || '',
          matchType: 'name',
          confidence: 'medium',
          accountNumber: `Address: ${fishbowlAddress.substring(0, 30)}...`
        });
        matchedFishbowlIds.add(fishbowl.id);
      }
    }
  }
  
  const matchTime = ((Date.now() - startMatch) / 1000).toFixed(1);
  const totalTime = ((Date.now() - startLoad) / 1000).toFixed(1);
  console.log(`✅ Total matched: ${matches.length} (${matchedFishbowlIds.size} unique)`);
  console.log(`⏱️  Matching completed in ${matchTime}s (total: ${totalTime}s)`);
  
  // DIAGNOSTICS: Analyze unmatched accounts
  const unmatchedCount = fishbowlCustomers.length - matches.length;
  console.log(`\n📊 UNMATCHED ANALYSIS (${unmatchedCount} accounts):`);
  
  let noAccountId = 0;
  let accountIdNotInCopper = 0;
  let alreadyHasCopperId = 0;
  const unmatchedAccounts = [];
  
  for (const fishbowl of fishbowlCustomers) {
    if (matchedFishbowlIds.has(fishbowl.id)) continue; // Skip matched
    
    // Check if already has copperId
    if (fishbowl.copperId) {
      alreadyHasCopperId++;
      continue;
    }
    
    // Check if has accountId
    if (!fishbowl.accountId) {
      noAccountId++;
    } else {
      // Has accountId but not found in Copper - need manual intervention
      accountIdNotInCopper++;
      
      // Try to find by name in Copper for manual matching (EXACT match only)
      let possibleCopperMatch = null;
      const normalizedFbName = (fishbowl.name || '').toLowerCase().trim();
      
      for (const copper of copperCompanies) {
        const copperName = (copper.Name || copper.name || '').toLowerCase().trim();
        if (copperName === normalizedFbName) {
          possibleCopperMatch = copper;
          break;
        }
      }
      
      unmatchedAccounts.push({
        fishbowlId: fishbowl.id,
        fishbowlName: fishbowl.name || 'Unknown',
        fishbowlAccountId: fishbowl.accountId,
        copperId: possibleCopperMatch?.id || null,
        copperName: possibleCopperMatch?.Name || possibleCopperMatch?.name || null,
        copperAccountId: possibleCopperMatch?.['Account ID cf_713477'] || possibleCopperMatch?.['Account ID'] || null,
        currentAccountOrderId: possibleCopperMatch?.['Account Order ID cf_698467'] || null,
      });
    }
  }
  
  console.log(`   ✅ ${alreadyHasCopperId} already have copperId (skip)`);
  console.log(`   ⚠️  ${noAccountId} have no accountId (can't match)`);
  console.log(`   ❌ ${accountIdNotInCopper} have accountId but NOT in Copper (need manual fix)`);
  
  return {
    matches,
    unmatchedAccounts,
    stats: {
      totalFishbowlCustomers: fishbowlCustomers.length,
      totalCopperCompanies: copperCompanies.length,
      matched: matches.length,
      unmatched: unmatchedCount,
      unmatchedReasons: {
        alreadyHasCopperId,
        noAccountId,
        accountIdNotInCopper
      }
    }
  };
}

/**
 * Apply matches to Firestore
 */
async function applyMatches(matches: MatchResult[]): Promise<number> {
  console.log(`💾 Applying ${matches.length} matches to Firestore...`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalUpdated = 0;
  
  for (const match of matches) {
    const fishbowlRef = adminDb.collection('fishbowl_customers').doc(match.fishbowlCustomerId);
    
    // Use set with merge to avoid errors if document doesn't exist
    batch.set(fishbowlRef, {
      copperId: match.copperCompanyId, // IMPORTANT: Store as copperId (this is what we look for!)
      copperCompanyName: match.copperCompanyName,
      matchType: match.matchType,
      matchConfidence: match.confidence,
      matchedAt: new Date().toISOString()
    }, { merge: true });
    
    batchCount++;
    
    if (batchCount >= 500) {
      await batch.commit();
      totalUpdated += batchCount;
      console.log(`💾 Updated ${totalUpdated} customers...`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
    totalUpdated += batchCount;
  }
  
  console.log(`✅ Updated ${totalUpdated} Fishbowl customers with Copper links`);
  return totalUpdated;
}

/**
 * Update Account Order ID in Copper via API
 */
async function updateCopperAccountOrderId(copperId: string, accountOrderId: string): Promise<boolean> {
  const copperApiKey = process.env.COPPER_API_KEY;
  const copperEmail = process.env.COPPER_USER_EMAIL; // Fixed: was COPPER_EMAIL
  
  if (!copperApiKey || !copperEmail) {
    console.error('Missing Copper API credentials:', { 
      hasApiKey: !!copperApiKey, 
      hasEmail: !!copperEmail 
    });
    throw new Error('Missing Copper API credentials');
  }
  
  console.log(`📝 Updating Copper company ${copperId} with Account Order ID: ${accountOrderId}`);
  
  // First, verify the company exists by checking Firestore
  const companySnapshot = await adminDb.collection('copper_companies')
    .where('id', '==', parseInt(copperId))
    .limit(1)
    .get();
  
  if (companySnapshot.empty) {
    console.error(`❌ Company ID ${copperId} not found in Firestore`);
    throw new Error(`Company ID ${copperId} not found in database. The Copper ID may be incorrect.`);
  }
  
  const companyData = companySnapshot.docs[0].data();
  const accountIdField = companyData['Account ID cf_713477'] || companyData['Account ID'];
  console.log(`   Found company in Firestore: ${companyData.Name || companyData.name} (Account ID: ${accountIdField})`);
  
  const url = `https://api.copper.com/developer_api/v1/companies/${copperId}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-PW-AccessToken': copperApiKey,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': copperEmail,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      custom_fields: [
        {
          custom_field_definition_id: 698467, // Account Order ID cf_698467
          value: accountOrderId
        },
        {
          custom_field_definition_id: 712751, // Active Customer cf_712751
          value: 'checked'
        }
      ]
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to update Copper company ${copperId}:`, errorText);
    
    // Provide more helpful error message
    if (response.status === 404) {
      throw new Error(`Company not found in Copper. The stored Copper ID (${copperId}) may be outdated. Try refreshing your Copper data sync.`);
    }
    
    throw new Error(`Copper API error: ${response.status} - ${errorText}`);
  }
  
  console.log(`✅ Updated Copper company ${copperId}`);
  
  // Update in Firestore
  await companySnapshot.docs[0].ref.update({
    'Account Order ID cf_698467': accountOrderId,
    'Active Customer cf_712751': 'checked',
    updatedAt: new Date().toISOString()
  });
  
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, matches, copperId, accountOrderId } = body;
    
    if (action === 'match') {
      // Just find matches, don't apply
      const result = await matchCopperToFishbowl();
      
      return NextResponse.json({
        success: true,
        ...result
      });
    } else if (action === 'apply') {
      // Apply matches - either from client or re-match
      let matchesToApply = matches;
      
      if (!matchesToApply || !Array.isArray(matchesToApply) || matchesToApply.length === 0) {
        console.log('⚠️  No matches provided, running fresh match...');
        const result = await matchCopperToFishbowl();
        matchesToApply = result.matches;
      }
      
      console.log(`📝 Applying ${matchesToApply.length} matches...`);
      const updated = await applyMatches(matchesToApply);
      
      return NextResponse.json({
        success: true,
        updated,
        total: matchesToApply.length
      });
    } else if (action === 'update-copper') {
      // Update a single Copper company's Account Order ID
      if (!copperId || !accountOrderId) {
        return NextResponse.json(
          { error: 'Missing copperId or accountOrderId' },
          { status: 400 }
        );
      }
      
      await updateCopperAccountOrderId(copperId, accountOrderId);
      
      return NextResponse.json({
        success: true,
        message: `Updated Copper company ${copperId} with Account Order ID ${accountOrderId}`
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "match", "apply", or "update-copper"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ Matching error:', error);
    return NextResponse.json(
      { error: error.message || 'Matching failed' },
      { status: 500 }
    );
  }
}
