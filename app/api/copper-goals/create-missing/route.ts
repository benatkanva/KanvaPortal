import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

interface MissingCompany {
  fishbowlId: string;
  fishbowlCustomerId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  suggestedAccountType: 'C' | 'HQ' | 'DIST';
}

interface CreateResult {
  fishbowlId: string;
  fishbowlCustomerId: string;
  name: string;
  copperCompanyId?: string;
  copperAccountNumber?: string;
  status: 'created' | 'failed';
  error?: string;
}

/**
 * Find Fishbowl customers marked "NOT IN COPPER"
 */
async function findMissingCompanies(): Promise<MissingCompany[]> {
  console.log('🔍 Finding Fishbowl customers not in Copper...');
  
  const snapshot = await adminDb
    .collection('fishbowl_customers')
    .where('accountNumber', '==', 'NOT IN COPPER')
    .get();
  
  const missing: MissingCompany[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Determine suggested account type based on name or other criteria
    let suggestedAccountType: 'C' | 'HQ' | 'DIST' = 'C';
    const name = (data.name || '').toLowerCase();
    
    if (name.includes('distrib') || name.includes('wholesale')) {
      suggestedAccountType = 'DIST';
    } else if (name.includes('hq') || name.includes('headquarters')) {
      suggestedAccountType = 'HQ';
    }
    
    missing.push({
      fishbowlId: data.id,
      fishbowlCustomerId: doc.id,
      name: data.name || 'Unknown',
      address: data.shippingAddress || data.billToAddress || data.address || '',
      city: data.shippingCity || data.billToCity || data.city || '',
      state: data.shippingState || data.billToStateID || data.state || '',
      zip: data.shippingZip || data.billToZip || data.zip || '',
      phone: data.phone || '',
      email: data.email || '',
      suggestedAccountType
    });
  }
  
  console.log(`✅ Found ${missing.length} companies not in Copper`);
  return missing;
}

/**
 * Get next available account number for a type
 */
async function getNextAccountNumber(type: 'C' | 'HQ' | 'DIST'): Promise<string> {
  // Query Copper companies to find highest number for this type
  const snapshot = await adminDb
    .collection('copper_companies')
    .where('Account Number cf_698260', '>=', type)
    .where('Account Number cf_698260', '<', type + '\uf8ff')
    .get();
  
  let maxNumber = 0;
  
  for (const doc of snapshot.docs) {
    const accountNum = doc.data()['Account Number cf_698260'];
    if (accountNum && typeof accountNum === 'string') {
      const match = accountNum.match(new RegExp(`^${type}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }
  
  // Also check Fishbowl customers
  const fbSnapshot = await adminDb
    .collection('fishbowl_customers')
    .where('accountNumber', '>=', type)
    .where('accountNumber', '<', type + '\uf8ff')
    .get();
  
  for (const doc of fbSnapshot.docs) {
    const accountNum = doc.data().accountNumber;
    if (accountNum && typeof accountNum === 'string') {
      const match = accountNum.match(new RegExp(`^${type}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }
  
  const nextNumber = maxNumber + 1;
  return `${type}${nextNumber}`;
}

/**
 * Create company in Copper via API
 */
async function createCopperCompany(company: MissingCompany, accountNumber: string): Promise<{ id: string; accountNumber: string }> {
  const copperApiKey = process.env.COPPER_API_KEY;
  const copperEmail = process.env.COPPER_USER_EMAIL;
  
  if (!copperApiKey || !copperEmail) {
    throw new Error('Copper API credentials not configured');
  }
  
  // Build Copper company payload
  const payload = {
    name: company.name,
    address: {
      street: company.address || '',
      city: company.city || '',
      state: company.state || '',
      postal_code: company.zip || '',
    },
    phone_numbers: company.phone ? [{ number: company.phone, category: 'work' }] : [],
    emails: company.email ? [{ email: company.email, category: 'work' }] : [],
    custom_fields: [
      {
        custom_field_definition_id: 698260, // Account Number cf_698260
        value: accountNumber
      },
      {
        custom_field_definition_id: 712751, // Active Customer cf_712751
        value: 'checked'
      }
    ]
  };
  
  // Call Copper API
  const response = await fetch('https://api.copper.com/developer_api/v1/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PW-AccessToken': copperApiKey,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': copperEmail,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Copper API error: ${response.status} - ${error}`);
  }
  
  const copperCompany = await response.json();
  
  return {
    id: String(copperCompany.id),
    accountNumber
  };
}

/**
 * Create missing companies in Copper
 */
async function createMissingCompanies(companies: MissingCompany[]): Promise<CreateResult[]> {
  console.log(`🚀 Creating ${companies.length} companies in Copper...`);
  
  const results: CreateResult[] = [];
  
  for (const company of companies) {
    try {
      // Get next account number
      const accountNumber = await getNextAccountNumber(company.suggestedAccountType);
      
      // Create in Copper
      const copperResult = await createCopperCompany(company, accountNumber);
      
      // Update Fishbowl customer in Firestore with Copper linkage
      await adminDb
        .collection('fishbowl_customers')
        .doc(company.fishbowlCustomerId)
        .update({
          accountNumber: accountNumber,
          copperId: copperResult.id,  // Link to Copper company ID
          copperCompanyId: copperResult.id,
          copperAccountNumber: accountNumber,
          syncedToCopperAt: new Date().toISOString(),
        });
      
      results.push({
        fishbowlId: company.fishbowlId,
        fishbowlCustomerId: company.fishbowlCustomerId,
        name: company.name,
        copperCompanyId: copperResult.id,
        copperAccountNumber: accountNumber,
        status: 'created',
      });
      
      console.log(`✅ Created ${company.name} as ${accountNumber} (Copper ID: ${copperResult.id})`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`❌ Failed to create ${company.name}:`, error.message);
      
      results.push({
        fishbowlId: company.fishbowlId,
        fishbowlCustomerId: company.fishbowlCustomerId,
        name: company.name,
        status: 'failed',
        error: error.message,
      });
    }
  }
  
  return results;
}

/**
 * Find Fishbowl customers that exist in Copper but are NOT marked as Active
 * SIMPLIFIED LOGIC: Use the copperId field from Fishbowl to directly find them in Copper
 */
async function findInactiveCompanies() {
  console.log('🔍 Finding Fishbowl customers that are inactive in Copper...');
  
  // STEP 1: Get all Fishbowl customers
  console.log('   📦 Loading Fishbowl customers...');
  const fbCustomersSnapshot = await adminDb
    .collection('fishbowl_customers')
    .get();
  
  const fishbowlCustomersWithCopperId = [];
  const fishbowlCustomersWithoutCopperId = [];
  
  for (const doc of fbCustomersSnapshot.docs) {
    const data = doc.data();
    
    if (data.copperId) {
      // Has copperId - can directly match
      fishbowlCustomersWithCopperId.push({
        fishbowlId: doc.id,
        copperId: String(data.copperId),
        accountId: data.accountId,
        name: data.name,
      });
    } else if (data.accountId) {
      // No copperId but has accountId - need to match via Account Order ID
      fishbowlCustomersWithoutCopperId.push({
        fishbowlId: doc.id,
        accountId: String(data.accountId),
        name: data.name,
      });
    }
  }
  
  console.log(`   ✅ Found ${fishbowlCustomersWithCopperId.length} Fishbowl customers with copperId`);
  console.log(`   ✅ Found ${fishbowlCustomersWithoutCopperId.length} Fishbowl customers without copperId (will match by Account Order ID)`);
  
  // STEP 2: Load Copper companies by their IDs
  console.log('   🏢 Loading Copper companies...');
  const copperSnapshot = await adminDb
    .collection('copper_companies')
    .get();
  
  // Index Copper companies by ID AND by Account Order ID
  const copperById = new Map();
  const copperByAccountOrderId = new Map();
  
  for (const doc of copperSnapshot.docs) {
    const data = doc.data();
    const id = String(data.id);
    const accountOrderId = data['Account Order ID cf_698467'];
    const isActive = data['Active Customer cf_712751'] === 'checked';
    
    const copperInfo = {
      id: data.id,
      name: data.name,
      isActive: isActive,
      accountOrderId: accountOrderId,
    };
    
    copperById.set(id, copperInfo);
    
    if (accountOrderId) {
      copperByAccountOrderId.set(String(accountOrderId).trim(), copperInfo);
    }
  }
  
  console.log(`   ✅ Loaded ${copperById.size} Copper companies`);
  
  // STEP 3: Find Fishbowl customers that exist in Copper but are NOT active
  console.log('   🔍 Checking active status...');
  const inactive = [];
  let matchedWithCopperId = 0;
  let matchedWithAccountId = 0;
  let alreadyActive = 0;
  
  // Check customers WITH copperId
  for (const fbCustomer of fishbowlCustomersWithCopperId) {
    const copperCompany = copperById.get(fbCustomer.copperId);
    
    if (copperCompany) {
      matchedWithCopperId++;
      
      if (!copperCompany.isActive) {
        inactive.push({
          copperId: fbCustomer.copperId,
          copperName: copperCompany.name || 'Unknown',
          fishbowlName: fbCustomer.name,
          accountNumber: '(none)',
          accountId: fbCustomer.accountId || copperCompany.accountOrderId || '(none)',
        });
      } else {
        alreadyActive++;
      }
    }
  }
  
  // Check customers WITHOUT copperId (match by Account Order ID)
  console.log(`   🔍 DEBUG - Checking ${fishbowlCustomersWithoutCopperId.length} customers without copperId...`);
  console.log(`   🔍 DEBUG - Sample Fishbowl accountIds:`, fishbowlCustomersWithoutCopperId.slice(0, 5).map(c => c.accountId));
  console.log(`   🔍 DEBUG - Sample Copper Account Order IDs:`, Array.from(copperByAccountOrderId.keys()).slice(0, 5));
  
  for (const fbCustomer of fishbowlCustomersWithoutCopperId) {
    const copperCompany = copperByAccountOrderId.get(fbCustomer.accountId);
    
    if (copperCompany) {
      matchedWithAccountId++;
      
      if (!copperCompany.isActive) {
        inactive.push({
          copperId: String(copperCompany.id),
          copperName: copperCompany.name || 'Unknown',
          fishbowlName: fbCustomer.name,
          accountNumber: '(none)',
          accountId: fbCustomer.accountId,
        });
      } else {
        alreadyActive++;
      }
    }
  }
  
  const totalFishbowl = fishbowlCustomersWithCopperId.length + fishbowlCustomersWithoutCopperId.length;
  const totalMatched = matchedWithCopperId + matchedWithAccountId;
  
  console.log(`   📊 Total Fishbowl customers: ${totalFishbowl}`);
  console.log(`   ✅ Matched via copperId: ${matchedWithCopperId}`);
  console.log(`   ✅ Matched via Account Order ID: ${matchedWithAccountId}`);
  console.log(`   ✅ Total matched: ${totalMatched}`);
  console.log(`   ✅ Already active: ${alreadyActive}`);
  console.log(`   ⚠️  Inactive (need activation): ${inactive.length}`);
  
  return inactive;
}

/**
 * Activate companies in Copper by setting Active Customer checkbox
 */
async function activateCompanies(copperIds: string[]) {
  console.log(`🚀 Activating ${copperIds.length} companies in Copper...`);
  
  const copperApiKey = process.env.COPPER_API_KEY;
  const copperEmail = process.env.COPPER_USER_EMAIL;
  
  if (!copperApiKey || !copperEmail) {
    throw new Error('Copper API credentials not configured');
  }
  
  const results = [];
  
  for (const copperId of copperIds) {
    try {
      // Update company in Copper to set Active Customer = checked
      const response = await fetch(`https://api.copper.com/developer_api/v1/companies/${copperId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-PW-AccessToken': copperApiKey,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': copperEmail,
        },
        body: JSON.stringify({
          custom_fields: [
            {
              custom_field_definition_id: 712751, // Active Customer cf_712751
              value: 'checked'
            }
          ]
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Copper API error: ${response.status} - ${error}`);
      }
      
      results.push({
        copperId,
        status: 'activated',
      });
      
      console.log(`✅ Activated company ${copperId}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`❌ Failed to activate ${copperId}:`, error.message);
      results.push({
        copperId,
        status: 'failed',
        error: error.message,
      });
    }
  }
  
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    
    if (action === 'find') {
      // Find missing companies
      const missing = await findMissingCompanies();
      
      return NextResponse.json({
        success: true,
        missing,
        count: missing.length,
      });
    }
    
    if (action === 'find-inactive') {
      // Find inactive companies with Fishbowl data
      const inactive = await findInactiveCompanies();
      
      return NextResponse.json({
        success: true,
        inactive,
        count: inactive.length,
      });
    }
    
    if (action === 'debug-data') {
      // Return sample data for debugging
      console.log('🔍 Fetching debug data...');
      
      // Get 10 Copper companies
      const copperSnapshot = await adminDb
        .collection('copper_companies')
        .limit(10)
        .get();
      
      const samples = copperSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.id,
          name: data.name,
          accountNumber: data.accountNumber,
          'Account Number cf_698260': data['Account Number cf_698260'],
          activeCustomer: data.activeCustomer,
          'Active Customer cf_712751': data['Active Customer cf_712751'],
          allFields: Object.keys(data).filter(k => k.toLowerCase().includes('account') || k.toLowerCase().includes('active')),
        };
      });
      
      return NextResponse.json({
        success: true,
        samples,
      });
    }
    
    if (action === 'activate') {
      // Activate companies
      const copperIds = body.copperIds as string[];
      
      if (!copperIds || copperIds.length === 0) {
        return NextResponse.json(
          { error: 'No company IDs provided' },
          { status: 400 }
        );
      }
      
      const results = await activateCompanies(copperIds);
      
      const activated = results.filter(r => r.status === 'activated').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      return NextResponse.json({
        success: true,
        results,
        stats: {
          total: results.length,
          activated,
          failed,
        },
      });
    }
    
    if (action === 'create') {
      // Create missing companies
      const companies = body.companies as MissingCompany[];
      
      if (!companies || companies.length === 0) {
        return NextResponse.json(
          { error: 'No companies provided' },
          { status: 400 }
        );
      }
      
      const results = await createMissingCompanies(companies);
      
      const created = results.filter(r => r.status === 'created').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      return NextResponse.json({
        success: true,
        results,
        stats: {
          total: results.length,
          created,
          failed,
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "find", "find-inactive", "activate", or "create"' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('Create missing companies error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
