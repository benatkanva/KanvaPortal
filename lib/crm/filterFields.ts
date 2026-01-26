/**
 * Complete field definitions for CRM filtering
 * Uses EXACT Supabase column names (snake_case) and data types
 */

import {
  REGION_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
  SEGMENT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SHIPPING_TERMS_OPTIONS,
  CARRIER_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
  ORGANIZATION_LEVEL_OPTIONS,
  STATE_OPTIONS,
} from './customFields';

export interface FilterFieldOption {
  value: string | boolean;
  label: string;
}

export interface FilterField {
  id: string; // Supabase column name (snake_case)
  label: string; // Display name
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean';
  category: 'interactions' | 'details' | 'identifiers' | 'financial' | 'system';
  options?: FilterFieldOption[];
  supabaseColumn: string; // Actual Supabase column name
}

// Convert custom field options to filter options
const toFilterOptions = (options: Array<{ id: number; name: string }>): FilterFieldOption[] => {
  return options.map(opt => ({ value: opt.name, label: opt.name }));
};

export const ACCOUNT_FILTER_FIELDS: FilterField[] = [
  // INTERACTIONS
  {
    id: 'created_at',
    label: 'Created Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'created_at'
  },
  {
    id: 'updated_at',
    label: 'Updated Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'updated_at'
  },
  {
    id: 'last_order_date',
    label: 'Last Order Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_order_date'
  },
  {
    id: 'first_order_date',
    label: 'First Order Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'first_order_date'
  },
  {
    id: 'last_contacted',
    label: 'Last Contacted',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_contacted'
  },
  {
    id: 'sales_person',
    label: 'Sales Person',
    type: 'text',
    category: 'interactions',
    supabaseColumn: 'sales_person'
  },

  // DETAILS
  {
    id: 'name',
    label: 'Account Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'name'
  },
  {
    id: 'email',
    label: 'Email',
    type: 'text',
    category: 'details',
    supabaseColumn: 'email'
  },
  {
    id: 'phone',
    label: 'Phone',
    type: 'text',
    category: 'details',
    supabaseColumn: 'phone'
  },
  {
    id: 'website',
    label: 'Website',
    type: 'text',
    category: 'details',
    supabaseColumn: 'website'
  },
  {
    id: 'shipping_city',
    label: 'Shipping City',
    type: 'text',
    category: 'details',
    supabaseColumn: 'shipping_city'
  },
  {
    id: 'shipping_state',
    label: 'Shipping State',
    type: 'select',
    category: 'details',
    options: toFilterOptions(STATE_OPTIONS),
    supabaseColumn: 'shipping_state'
  },
  {
    id: 'shipping_zip',
    label: 'Shipping Zip',
    type: 'text',
    category: 'details',
    supabaseColumn: 'shipping_zip'
  },
  {
    id: 'shipping_street',
    label: 'Shipping Street',
    type: 'text',
    category: 'details',
    supabaseColumn: 'shipping_street'
  },
  {
    id: 'billing_street',
    label: 'Billing Street',
    type: 'text',
    category: 'details',
    supabaseColumn: 'billing_street'
  },
  {
    id: 'billing_city',
    label: 'Billing City',
    type: 'text',
    category: 'details',
    supabaseColumn: 'billing_city'
  },
  {
    id: 'billing_state',
    label: 'Billing State',
    type: 'select',
    category: 'details',
    options: toFilterOptions(STATE_OPTIONS),
    supabaseColumn: 'billing_state'
  },
  {
    id: 'billing_zip',
    label: 'Billing Zip',
    type: 'text',
    category: 'details',
    supabaseColumn: 'billing_zip'
  },
  {
    id: 'primary_contact_name',
    label: 'Primary Contact Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'primary_contact_name'
  },
  {
    id: 'primary_contact_email',
    label: 'Primary Contact Email',
    type: 'text',
    category: 'details',
    supabaseColumn: 'primary_contact_email'
  },
  {
    id: 'primary_contact_phone',
    label: 'Primary Contact Phone',
    type: 'text',
    category: 'details',
    supabaseColumn: 'primary_contact_phone'
  },
  {
    id: 'notes',
    label: 'Notes',
    type: 'text',
    category: 'details',
    supabaseColumn: 'notes'
  },

  // IDENTIFIERS
  {
    id: 'account_number',
    label: 'Account Number',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_number'
  },
  {
    id: 'fishbowl_id',
    label: 'Fishbowl ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'fishbowl_id'
  },
  {
    id: 'copper_id',
    label: 'Copper ID',
    type: 'number',
    category: 'identifiers',
    supabaseColumn: 'copper_id'
  },
  {
    id: 'account_order_id',
    label: 'Account Order ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_order_id'
  },
  {
    id: 'is_active_customer',
    label: 'Is Active Customer',
    type: 'boolean',
    category: 'identifiers',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    supabaseColumn: 'is_active_customer'
  },
  {
    id: 'account_type',
    label: 'Account Type',
    type: 'multiselect',
    category: 'identifiers',
    options: toFilterOptions(ACCOUNT_TYPE_OPTIONS),
    supabaseColumn: 'account_type'
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    category: 'identifiers',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'prospect', label: 'Prospect' },
      { value: 'customer', label: 'Customer' },
    ],
    supabaseColumn: 'status'
  },
  {
    id: 'region',
    label: 'Region',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(REGION_OPTIONS),
    supabaseColumn: 'region'
  },
  {
    id: 'segment',
    label: 'Segment',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(SEGMENT_OPTIONS),
    supabaseColumn: 'segment'
  },
  {
    id: 'customer_priority',
    label: 'Customer Priority',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(CUSTOMER_PRIORITY_OPTIONS),
    supabaseColumn: 'customer_priority'
  },
  {
    id: 'organization_level',
    label: 'Organization Level',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(ORGANIZATION_LEVEL_OPTIONS),
    supabaseColumn: 'organization_level'
  },
  {
    id: 'business_model',
    label: 'Business Model',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(BUSINESS_MODEL_OPTIONS),
    supabaseColumn: 'business_model'
  },

  // FINANCIAL
  {
    id: 'total_spent',
    label: 'Total Spent',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'total_spent'
  },
  {
    id: 'total_orders',
    label: 'Total Orders',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'total_orders'
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    category: 'financial',
    options: toFilterOptions(PAYMENT_TERMS_OPTIONS),
    supabaseColumn: 'payment_terms'
  },

  // SYSTEM
  {
    id: 'shipping_terms',
    label: 'Shipping Terms',
    type: 'select',
    category: 'system',
    options: toFilterOptions(SHIPPING_TERMS_OPTIONS),
    supabaseColumn: 'shipping_terms'
  },
  {
    id: 'carrier_name',
    label: 'Carrier',
    type: 'select',
    category: 'system',
    options: toFilterOptions(CARRIER_OPTIONS),
    supabaseColumn: 'carrier_name'
  },
  {
    id: 'source',
    label: 'Data Source',
    type: 'select',
    category: 'system',
    options: [
      { value: 'fishbowl', label: 'Fishbowl' },
      { value: 'copper', label: 'Copper' },
      { value: 'manual', label: 'Manual' },
    ],
    supabaseColumn: 'source'
  },
  {
    id: 'copper_url',
    label: 'Copper URL',
    type: 'text',
    category: 'system',
    supabaseColumn: 'copper_url'
  },
  {
    id: 'contact_type',
    label: 'Contact Type',
    type: 'text',
    category: 'system',
    supabaseColumn: 'contact_type'
  },
  {
    id: 'inactive_days',
    label: 'Inactive Days',
    type: 'number',
    category: 'system',
    supabaseColumn: 'inactive_days'
  },
  {
    id: 'interaction_count',
    label: 'Interaction Count',
    type: 'number',
    category: 'system',
    supabaseColumn: 'interaction_count'
  },
  {
    id: 'owned_by',
    label: 'Owned By',
    type: 'text',
    category: 'system',
    supabaseColumn: 'owned_by'
  },
  {
    id: 'owner_id',
    label: 'Owner ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'owner_id'
  },
];

// Helper to get field by ID
export function getFilterField(fieldId: string): FilterField | undefined {
  return ACCOUNT_FILTER_FIELDS.find(f => f.id === fieldId);
}

// Helper to get fields by category
export function getFieldsByCategory(category: string): FilterField[] {
  return ACCOUNT_FILTER_FIELDS.filter(f => f.category === category);
}

// Helper to search fields
export function searchFilterFields(searchTerm: string): FilterField[] {
  if (!searchTerm) return ACCOUNT_FILTER_FIELDS;
  
  const term = searchTerm.toLowerCase();
  return ACCOUNT_FILTER_FIELDS.filter(field =>
    field.label.toLowerCase().includes(term) ||
    field.id.toLowerCase().includes(term)
  );
}
