// Settings page type definitions

export type TabType = 'rules' | 'datasync' | 'customers' | 'team' | 'orgchart' | 'products';
export type RulesSubTab = 'quarterly' | 'monthly';
export type CustomerSubTab = 'list' | 'map' | '3rdparty';
export type ThirdPartySubTab = 'overview' | 'switchers' | 'map' | 'data';
export type OrgChartSubTab = 'team' | 'regions' | 'regionManager';
export type SortDirection = 'asc' | 'desc';

export interface CommissionConfig {
  buckets: Bucket[];
  lastUpdated?: string;
  updatedBy?: string;
}

export interface Bucket {
  id: string;
  name: string;
  weight: number;
  threshold: number;
  goal: number;
  type: 'revenue' | 'margin' | 'custom';
}

export interface ProductSubGoal {
  id: string;
  productNum: string;
  productDescription: string;
  goal: number;
  weight: number;
  active: boolean;
}

export interface ActivitySubGoal {
  id: string;
  activity: string;
  goal: number;
  weight: number;
  active: boolean;
}

export interface Rep {
  id: string;
  name: string;
  email: string;
  title: string;
  isActive: boolean;
  targetCommission?: number;
  targetRevenue?: number;
  targetMargin?: number;
}

export interface Customer {
  id: string;
  customerNum: string;
  customerName: string;
  accountNumber?: string;
  salesPerson?: string;
  accountType?: string;
  transferStatus?: string;
  originalOwner?: string;
  copperId?: string;
  lat?: number;
  lng?: number;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
}

export interface Product {
  id: string;
  productNum: string;
  productDescription: string;
  category?: string;
  productType?: string;
  size?: string;
  uom?: string;
  quarterlyBonusEligible: boolean;
  isActive: boolean;
  imageUrl?: string;
  imagePath?: string;
}

export interface Spiff {
  id: string;
  name: string;
  products: string[];
  amount: number;
  type: 'perUnit' | 'perOrder';
  startDate: string;
  endDate: string;
  active: boolean;
  description?: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  orgLevel: string;
  title: string;
  reportsTo?: string;
  isActive: boolean;
}

export interface CsvPreview {
  updates: any[];
  errors: string[];
}

export interface ProcessingStatus {
  message: string;
  progress: number;
  showConfetti: boolean;
}

export interface AdminChangeConfirmation {
  customerId: string;
  newRep: string;
  customerName: string;
}
