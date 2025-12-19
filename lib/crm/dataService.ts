/**
 * Unified CRM Data Service
 * Links data from multiple Firebase collections:
 * - fishbowl_customers -> Accounts
 * - copper_companies -> Accounts (merged)
 * - copper_leads -> Prospects
 * - copper_opportunities -> Pipeline Deals
 * - copper_people -> Contacts
 * - fishbowl_sales_orders -> Order History
 * - customer_sales_summary -> Sales Metrics
 */

import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  doc,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  DocumentData
} from 'firebase/firestore';

// ============== ID Generation ==============
// Generates IDs in the same format as Copper (numeric)
let idCounter = Date.now();

export function generateCRMId(): number {
  idCounter++;
  return idCounter;
}

// ============== Type Definitions ==============

export interface UnifiedAccount {
  id: string;
  // Source tracking
  source: 'fishbowl' | 'copper' | 'manual';
  fishbowlId?: string;
  copperId?: number;
  
  // Core fields
  name: string;
  accountNumber?: string;
  website?: string;
  phone?: string;
  email?: string;
  
  // Address
  shippingStreet?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  
  // Classification
  accountType?: string[];
  region?: string;
  segment?: string;
  customerPriority?: string;
  organizationLevel?: string;
  businessModel?: string;
  
  // Terms
  paymentTerms?: string;
  shippingTerms?: string;
  carrierName?: string;
  
  // Sales data
  salesPerson?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  
  // Status
  status: 'prospect' | 'active' | 'inactive' | 'churned';
  isActiveCustomer?: boolean;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface UnifiedProspect {
  id: string;
  source: 'copper_lead' | 'manual';
  copperId?: number;
  
  // Core fields
  name: string;
  companyName?: string;
  title?: string;
  email?: string;
  phone?: string;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  
  // Classification
  accountType?: string[];
  region?: string;
  segment?: string;
  leadTemperature?: string;
  accountOpportunity?: string;
  
  // Status
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  assigneeId?: string;
  assigneeName?: string;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  followUpDate?: Date;
  notes?: string;
  tradeShowName?: string;
}

export interface UnifiedContact {
  id: string;
  source: 'copper_person' | 'manual';
  copperId?: number;
  
  // Core fields
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  title?: string;
  
  // Related account
  accountId?: string;
  accountName?: string;
  copperId_company?: number;
  
  // Address
  street?: string;
  city?: string;
  state?: string;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UnifiedDeal {
  id: string;
  source: 'copper_opportunity' | 'manual';
  copperId?: number;
  
  // Core fields
  name: string;
  value?: number;
  probability?: number;
  stage?: string;
  pipelineId?: string;
  
  // Related entities
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  
  // Status
  status: 'open' | 'won' | 'lost';
  expectedCloseDate?: Date;
  wonDate?: Date;
  lostDate?: Date;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  notes?: string;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  total: number;
  status: string;
  items?: OrderItem[];
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesSummary {
  accountId: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  topProducts?: { name: string; quantity: number; revenue: number }[];
}

// ============== Data Loading Functions ==============

/**
 * Load all accounts from fishbowl_customers merged with copper_companies
 */
export async function loadUnifiedAccounts(): Promise<UnifiedAccount[]> {
  const accounts: UnifiedAccount[] = [];
  const copperMap = new Map<number, DocumentData>();
  
  // First load copper_companies to create a lookup map
  try {
    const copperSnapshot = await getDocs(collection(db, 'copper_companies'));
    copperSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.id) {
        copperMap.set(data.id, { docId: doc.id, ...data });
      }
    });
    console.log(`Loaded ${copperMap.size} copper companies`);
  } catch (error) {
    console.error('Error loading copper_companies:', error);
  }
  
  // Load fishbowl_customers as the primary source
  try {
    const fishbowlSnapshot = await getDocs(collection(db, 'fishbowl_customers'));
    
    fishbowlSnapshot.forEach((doc) => {
      const fb = doc.data();
      const copperId = fb.copperId ? Number(fb.copperId) : undefined;
      const copperData = copperId ? copperMap.get(copperId) : undefined;
      
      // Merge Fishbowl + Copper data
      const account: UnifiedAccount = {
        id: doc.id,
        source: 'fishbowl',
        fishbowlId: fb.id || fb.customerNum || doc.id,
        copperId: copperId,
        
        // Core - prefer Fishbowl
        name: fb.name || fb.customerContact || copperData?.Name || 'Unknown',
        accountNumber: fb.accountId || fb.accountNumber || fb.customerNum,
        website: copperData?.Website || fb.website,
        phone: fb.phone || copperData?.['Phone Numbers'],
        email: fb.email || copperData?.['Email Domain'],
        
        // Address - from Fishbowl
        shippingStreet: fb.shippingAddress,
        shippingCity: fb.shippingCity,
        shippingState: fb.shippingState,
        shippingZip: fb.shippingZip,
        
        // Classification - merge both
        accountType: parseAccountType(fb.accountType || copperData?.['Account Type cf_698259']),
        region: fb.region || copperData?.['Region cf_698278'],
        segment: fb.segment || copperData?.['Segment cf_698498'],
        customerPriority: fb.customerPriority || copperData?.['Customer Priority cf_698264'],
        organizationLevel: copperData?.['Organization Level cf_698277'],
        businessModel: copperData?.['Business Model cf_698262'],
        
        // Terms
        paymentTerms: fb.paymentTerms || copperData?.['Payment Terms cf_766847'],
        shippingTerms: fb.shippingTerms || copperData?.['Shipping Terms cf_772920'],
        carrierName: fb.carrierName || copperData?.['Carrier Name cf_772921'],
        
        // Sales
        salesPerson: fb.salesPerson || fb.fishbowlUsername,
        totalOrders: fb.totalOrders || 0,
        totalSpent: fb.totalSpent || 0,
        lastOrderDate: fb.lastOrderDate?.toDate?.() || undefined,
        firstOrderDate: fb.firstOrderDate?.toDate?.() || undefined,
        
        // Status
        status: determineAccountStatus(fb, copperData),
        isActiveCustomer: copperData?.['Active Customer cf_712751'] === true || fb.isActiveCustomer,
        
        // Metadata
        createdAt: fb.createdAt?.toDate?.() || copperData?.importedAt?.toDate?.(),
        updatedAt: fb.updatedAt?.toDate?.(),
        notes: fb.notes || copperData?.['Account Notes cf_698256'],
      };
      
      accounts.push(account);
      
      // Remove from copperMap so we don't add it again
      if (copperId) {
        copperMap.delete(copperId);
      }
    });
    
    console.log(`Loaded ${accounts.length} fishbowl accounts`);
  } catch (error) {
    console.error('Error loading fishbowl_customers:', error);
  }
  
  // Add remaining copper_companies that weren't matched
  copperMap.forEach((copperData, copperId) => {
    const account: UnifiedAccount = {
      id: copperData.docId,
      source: 'copper',
      copperId: copperId,
      
      name: copperData.Name || copperData.Company || 'Unknown',
      accountNumber: copperData['Account Number cf_698260'],
      website: copperData.Website,
      phone: copperData['Phone Numbers'],
      email: copperData['Email Domain'],
      
      shippingStreet: copperData['Street Address'],
      shippingCity: copperData.City,
      shippingState: copperData.State,
      shippingZip: copperData['Postal Code'],
      
      accountType: parseAccountType(copperData['Account Type cf_698259']),
      region: copperData['Region cf_698278'],
      segment: copperData['Segment cf_698498'],
      customerPriority: copperData['Customer Priority cf_698264'],
      organizationLevel: copperData['Organization Level cf_698277'],
      businessModel: copperData['Business Model cf_698262'],
      
      paymentTerms: copperData['Payment Terms cf_766847'],
      shippingTerms: copperData['Shipping Terms cf_772920'],
      carrierName: copperData['Carrier Name cf_772921'],
      
      status: copperData['Active Customer cf_712751'] ? 'active' : 'prospect',
      isActiveCustomer: copperData['Active Customer cf_712751'] === true,
      
      createdAt: copperData.importedAt?.toDate?.(),
      notes: copperData['Account Notes cf_698256'],
    };
    
    accounts.push(account);
  });
  
  console.log(`Total unified accounts: ${accounts.length}`);
  return accounts.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load prospects from copper_leads
 */
export async function loadUnifiedProspects(): Promise<UnifiedProspect[]> {
  const prospects: UnifiedProspect[] = [];
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_leads'));
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      const prospect: UnifiedProspect = {
        id: doc.id,
        source: 'copper_lead',
        copperId: data.id || Number(doc.id),
        
        name: data.Name || data['Lead Name'] || 'Unknown',
        companyName: data['Company Name'] || data.Company,
        title: data.Title,
        email: data.Email || data['Email Address'],
        phone: data.Phone || data['Phone Number'],
        
        street: data['Street Address'],
        city: data.City,
        state: data.State,
        postalCode: data['Postal Code'],
        
        accountType: parseAccountType(data['Account Type cf_698259']),
        region: data['Region cf_698278'],
        segment: data['Segment cf_698498'],
        leadTemperature: data['Lead Temperature cf_698273'] || 'Warm',
        accountOpportunity: data['Account Opportunity cf_698257'],
        
        status: mapLeadStatus(data.Status),
        assigneeId: data['Assignee Id'],
        assigneeName: data.Assignee,
        
        createdAt: data.importedAt?.toDate?.() || data['Date Created'] ? new Date(data['Date Created']) : undefined,
        updatedAt: data['Date Modified'] ? new Date(data['Date Modified']) : undefined,
        notes: data['Prospect Notes cf_698281'] || data.Details,
        tradeShowName: data['Trade Show Name cf_698295'],
      };
      
      prospects.push(prospect);
    });
    
    console.log(`Loaded ${prospects.length} prospects from copper_leads`);
  } catch (error) {
    console.error('Error loading copper_leads:', error);
  }
  
  return prospects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load contacts from copper_people (via copper_companies relationships)
 */
export async function loadUnifiedContacts(): Promise<UnifiedContact[]> {
  const contacts: UnifiedContact[] = [];
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_people'));
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      const firstName = data['First Name'] || data.firstName || '';
      const lastName = data['Last Name'] || data.lastName || '';
      
      const contact: UnifiedContact = {
        id: doc.id,
        source: 'copper_person',
        copperId: data.id || Number(doc.id),
        
        firstName,
        lastName,
        fullName: data.Name || `${firstName} ${lastName}`.trim() || 'Unknown',
        email: data.Email || data['Email Address'],
        phone: data.Phone || data['Phone Number'],
        title: data.Title,
        
        accountId: data['Company Id']?.toString(),
        accountName: data['Company Name'] || data.Company,
        copperId_company: data['Company Id'],
        
        street: data['Street Address'],
        city: data.City,
        state: data.State,
        
        createdAt: data.importedAt?.toDate?.() || data['Date Created'] ? new Date(data['Date Created']) : undefined,
        updatedAt: data['Date Modified'] ? new Date(data['Date Modified']) : undefined,
      };
      
      contacts.push(contact);
    });
    
    console.log(`Loaded ${contacts.length} contacts from copper_people`);
  } catch (error) {
    console.error('Error loading copper_people:', error);
  }
  
  return contacts.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Load deals from copper_opportunities
 */
export async function loadUnifiedDeals(): Promise<UnifiedDeal[]> {
  const deals: UnifiedDeal[] = [];
  
  try {
    const snapshot = await getDocs(collection(db, 'copper_opportunities'));
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      const deal: UnifiedDeal = {
        id: doc.id,
        source: 'copper_opportunity',
        copperId: data.id || Number(doc.id),
        
        name: data.Name || data['Opportunity Name'] || 'Untitled Deal',
        value: parseFloat(data['Monetary Value']) || parseFloat(data.Value) || 0,
        probability: parseInt(data['Win Probability']) || parseInt(data.Probability) || 50,
        stage: data['Pipeline Stage'] || data.Stage,
        pipelineId: data['Pipeline Id']?.toString(),
        
        accountId: data['Primary Company Id']?.toString(),
        accountName: data['Primary Company'] || data.Company,
        contactId: data['Primary Contact Id']?.toString(),
        contactName: data['Primary Contact'],
        
        status: mapOpportunityStatus(data.Status),
        expectedCloseDate: data['Close Date'] ? new Date(data['Close Date']) : undefined,
        wonDate: data['Won Date'] ? new Date(data['Won Date']) : undefined,
        lostDate: data['Lost Date'] ? new Date(data['Lost Date']) : undefined,
        
        createdAt: data.importedAt?.toDate?.() || data['Date Created'] ? new Date(data['Date Created']) : undefined,
        updatedAt: data['Date Modified'] ? new Date(data['Date Modified']) : undefined,
        notes: data.Details || data.Notes,
      };
      
      deals.push(deal);
    });
    
    console.log(`Loaded ${deals.length} deals from copper_opportunities`);
  } catch (error) {
    console.error('Error loading copper_opportunities:', error);
  }
  
  return deals.sort((a, b) => (b.value || 0) - (a.value || 0));
}

/**
 * Load order history for an account
 */
export async function loadAccountOrders(accountId: string): Promise<OrderSummary[]> {
  const orders: OrderSummary[] = [];
  
  try {
    // First get the fishbowl customer to find the customer ID
    const accountDoc = await getDoc(doc(db, 'fishbowl_customers', accountId));
    if (!accountDoc.exists()) {
      console.log(`Account ${accountId} not found in fishbowl_customers`);
      return orders;
    }
    
    const accountData = accountDoc.data();
    const customerId = accountData.id || accountData.customerNum || accountData.accountId;
    
    if (!customerId) {
      console.log(`No customer ID found for account ${accountId}`);
      return orders;
    }
    
    // Query orders by customerId
    const ordersQuery = query(
      collection(db, 'fishbowl_sales_orders'),
      where('customerId', '==', customerId),
      orderBy('dateCreated', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(ordersQuery);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      orders.push({
        orderId: doc.id,
        orderNumber: data.orderNum || data.soNum || doc.id,
        orderDate: data.dateCreated?.toDate?.() || new Date(),
        total: parseFloat(data.totalAmount) || parseFloat(data.total) || 0,
        status: data.status || data.statusName || 'Unknown',
      });
    });
    
    console.log(`Loaded ${orders.length} orders for account ${accountId}`);
  } catch (error) {
    console.error('Error loading orders:', error);
  }
  
  return orders;
}

/**
 * Load sales summary for an account
 */
export async function loadAccountSalesSummary(accountId: string): Promise<any | null> {
  try {
    const docRef = doc(db, 'customer_sales_summary', accountId);
    const snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      return snapshot.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error loading sales summary:', error);
    return null;
  }
}

// ============== Helper Functions ==============

function parseAccountType(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Handle comma-separated values
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function determineAccountStatus(fishbowlData: any, copperData: any): UnifiedAccount['status'] {
  // If marked as active in either system
  if (copperData?.['Active Customer cf_712751'] === true || fishbowlData?.isActiveCustomer) {
    return 'active';
  }
  
  // If has recent orders (within last 6 months)
  if (fishbowlData?.lastOrderDate) {
    const lastOrder = fishbowlData.lastOrderDate.toDate?.() || new Date(fishbowlData.lastOrderDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (lastOrder > sixMonthsAgo) {
      return 'active';
    } else if (fishbowlData.totalOrders > 0) {
      return 'inactive';
    }
  }
  
  return 'prospect';
}

function mapLeadStatus(status: string): UnifiedProspect['status'] {
  if (!status) return 'new';
  const lower = status.toLowerCase();
  
  if (lower.includes('new') || lower.includes('open')) return 'new';
  if (lower.includes('contact')) return 'contacted';
  if (lower.includes('qualif')) return 'qualified';
  if (lower.includes('unqualif') || lower.includes('disqualif')) return 'unqualified';
  if (lower.includes('convert') || lower.includes('won')) return 'converted';
  
  return 'new';
}

function mapOpportunityStatus(status: string): UnifiedDeal['status'] {
  if (!status) return 'open';
  const lower = status.toLowerCase();
  
  if (lower.includes('won') || lower.includes('closed won')) return 'won';
  if (lower.includes('lost') || lower.includes('closed lost')) return 'lost';
  
  return 'open';
}

// ============== CRUD Operations ==============

/**
 * Create a new account in the accounts collection
 */
export async function createAccount(data: Partial<UnifiedAccount>): Promise<string> {
  const newId = generateCRMId();
  
  const accountData = {
    ...data,
    id: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'accounts'), accountData);
  return docRef.id;
}

/**
 * Create a new prospect
 */
export async function createProspect(data: Partial<UnifiedProspect>): Promise<string> {
  const newId = generateCRMId();
  
  const prospectData = {
    ...data,
    id: newId,
    copperId: newId, // Use same ID format as Copper
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'prospects'), prospectData);
  return docRef.id;
}

/**
 * Create a new contact
 */
export async function createContact(data: Partial<UnifiedContact>): Promise<string> {
  const newId = generateCRMId();
  
  const contactData = {
    ...data,
    id: newId,
    copperId: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'contacts'), contactData);
  return docRef.id;
}

/**
 * Create a new deal
 */
export async function createDeal(data: Partial<UnifiedDeal>): Promise<string> {
  const newId = generateCRMId();
  
  const dealData = {
    ...data,
    id: newId,
    copperId: newId,
    source: 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, 'pipeline_deals'), dealData);
  return docRef.id;
}
