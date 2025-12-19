// CRM Entity Types matching Copper structure

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface PhoneNumber {
  number: string;
  category: 'work' | 'mobile' | 'home' | 'other';
}

export interface Email {
  email: string;
  category: 'work' | 'personal' | 'other';
}

// Base entity with common fields
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  assigneeId?: string;
  tags?: string[];
}

// Lead/Prospect Entity
export interface Prospect extends BaseEntity {
  // Core fields
  name: string;
  companyName?: string;
  title?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: Address;
  
  // Custom fields matching Copper
  accountType?: string[]; // MultiSelect: Distributor, Wholesale, Retail
  region?: string;
  state?: string;
  county?: string;
  segment?: string;
  leadTemperature?: 'Cold' | 'Warm' | 'Hot';
  accountOpportunity?: string;
  organizationLevel?: string;
  businessModel?: string;
  followUpDate?: Date;
  prospectNotes?: string;
  accountNotes?: string;
  productCategoriesOfInterest?: string[];
  tradeShowName?: string;
  parentAccountNumber?: string;
  workEmail?: string;
  mainPhone?: string;
  
  // Status
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  convertedToAccountId?: string;
  convertedToContactId?: string;
  
  // Copper sync
  copperId?: number;
  copperSyncedAt?: Date;
}

// Contact/Person Entity
export interface Contact extends BaseEntity {
  // Core fields
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  
  // Related account
  accountId?: string;
  accountName?: string;
  
  // Address
  address?: Address;
  
  // Custom fields matching Copper
  accountType?: string[];
  region?: string;
  state?: string;
  county?: string;
  segment?: string;
  accountOpportunity?: string;
  organizationLevel?: string;
  pmName?: string;
  pmHours?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  accountNotes?: string;
  prospectNotes?: string;
  taxExemptNumber?: string;
  parentAccountNumber?: string;
  parentAccount?: string;
  workEmail?: string;
  mainPhone?: string;
  secondaryContact?: string;
  tradeShowName?: string;
  accountOrderId?: string;
  
  // Contact preferences
  preferredContactMethod?: 'email' | 'phone' | 'sms';
  doNotContact?: boolean;
  
  // Copper sync
  copperId?: number;
  copperSyncedAt?: Date;
}

// Account/Company Entity
export interface Account extends BaseEntity {
  // Core fields
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  
  // Address
  address?: Address;
  billingAddress?: Address;
  shippingAddress?: Address;
  
  // Custom fields matching Copper
  accountType?: string[];
  region?: string;
  state?: string;
  county?: string;
  segment?: string;
  customerPriority?: '1' | '2' | '3' | '4' | '5';
  accountOpportunity?: string;
  organizationLevel?: string;
  businessModel?: string;
  
  // Order/Financial data
  totalOrders?: number;
  totalSpent?: number;
  averageOrderValue?: number;
  firstOrderDate?: Date;
  lastOrderDate?: Date;
  orderFrequency?: string;
  
  // Terms and Settings
  paymentTerms?: string;
  shippingTerms?: string;
  carrierName?: string;
  resellerPermit?: 'YES' | 'NO';
  taxExemptNumber?: string;
  taxEntity?: string;
  
  // Notes and Relationships
  notes?: string;
  accountNotes?: string;
  parentAccountNumber?: string;
  corporateParentAccountNumber?: string;
  parentAccount?: string;
  workEmail?: string;
  mainPhone?: string;
  secondaryContact?: string;
  startTime?: string;
  endTime?: string;
  favoriteProduct?: string;
  tradeShowName?: string;
  accountOrderId?: string;
  
  // Status
  status: 'prospect' | 'active' | 'inactive' | 'churned';
  
  // Fishbowl sync
  fishbowlCustomerId?: string;
  fishbowlSyncedAt?: Date;
  
  // Copper sync
  copperId?: number;
  copperSyncedAt?: Date;
}

// Activity types for CRM feed
export interface Activity extends BaseEntity {
  type: 'call' | 'email' | 'sms' | 'note' | 'task' | 'meeting' | 'order';
  title: string;
  description?: string;
  
  // Related entities
  prospectId?: string;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  
  // Activity details
  direction?: 'inbound' | 'outbound';
  duration?: number; // seconds
  outcome?: string;
  
  // For tasks
  dueDate?: Date;
  completedAt?: Date;
  priority?: 'low' | 'medium' | 'high';
  
  // JustCall integration
  justcallId?: string;
  recordingUrl?: string;
}

// Opportunity/Deal Entity
export interface Opportunity extends BaseEntity {
  name: string;
  value?: number;
  probability?: number;
  stage?: string;
  expectedCloseDate?: Date;
  
  // Related entities
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  
  // Custom fields
  soNumber?: string;
  dateIssued?: Date;
  orderStatus?: string;
  paymentStatus?: string;
  
  // Copper sync
  copperId?: number;
  copperSyncedAt?: Date;
}

// Pipeline Stage
export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  probability?: number; // Win probability at this stage (0-100)
}

// Pipeline Definition
export interface Pipeline extends BaseEntity {
  name: string;
  description?: string;
  stages: PipelineStage[];
  isDefault?: boolean;
  ownerId?: string; // User who owns this pipeline (null for shared)
  isShared?: boolean; // Visible to all users
}

// Pipeline Deal - represents a deal/opportunity in a pipeline
export interface PipelineDeal extends BaseEntity {
  name: string;
  pipelineId: string;
  stageId: string;
  
  // Value
  value?: number;
  probability?: number;
  expectedCloseDate?: Date;
  
  // Related entities
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  prospectId?: string;
  prospectName?: string;
  
  // Source - links to existing data
  fishbowlCustomerId?: string;
  copperOpportunityId?: number;
  
  // Deal details
  source?: string; // Where the lead came from
  notes?: string;
  lostReason?: string;
  wonDate?: Date;
  lostDate?: Date;
  
  // Status
  status: 'open' | 'won' | 'lost';
  
  // Ordering within stage
  stageOrder?: number;
}
