/**
 * PostgreSQL Data Service for CRM
 * Handles all database queries for accounts, contacts, prospects, deals
 */

import { queryDb } from '../db/config';
import type { UnifiedAccount, PaginationOptions, PaginatedResult } from './dataService';
import type { FilterCondition } from '@/components/crm/FilterSidebar';
import { getFilterField } from './filterFields';

/**
 * Build SQL WHERE clause from filter conditions
 */
function buildWhereClause(conditions: FilterCondition[]): { where: string; params: any[] } {
  const clauses: string[] = ['is_active_customer = true'];
  const params: any[] = [];
  let paramIndex = 1;
  
  for (const condition of conditions) {
    const field = getFilterField(condition.field);
    if (!field) continue;
    
    // Convert camelCase to snake_case for database columns
    const dbField = field.firestoreField
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase();
    
    const { operator, value } = condition;
    
    switch (operator) {
      case 'equals':
        clauses.push(`${dbField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;
        
      case 'not_equals':
        clauses.push(`${dbField} != $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;
        
      case 'contains':
        clauses.push(`${dbField} ILIKE $${paramIndex}`);
        params.push(`%${value}%`);
        paramIndex++;
        break;
        
      case 'starts_with':
        clauses.push(`${dbField} ILIKE $${paramIndex}`);
        params.push(`${value}%`);
        paramIndex++;
        break;
        
      case 'greater_than':
        clauses.push(`${dbField} > $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;
        
      case 'less_than':
        clauses.push(`${dbField} < $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;
        
      case 'is_empty':
        clauses.push(`(${dbField} IS NULL OR ${dbField} = '')`);
        break;
        
      case 'is_not_empty':
        clauses.push(`(${dbField} IS NOT NULL AND ${dbField} != '')`);
        break;
        
      case 'in':
        const values = typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value];
        clauses.push(`${dbField} = ANY($${paramIndex})`);
        params.push(values);
        paramIndex++;
        break;
    }
  }
  
  return {
    where: clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '',
    params
  };
}

/**
 * Load accounts from PostgreSQL with filtering and pagination
 */
export async function loadUnifiedAccountsSQL(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedAccount>> {
  const { pageSize = 50, cursor, searchTerm, filterConditions = [] } = options;
  
  try {
    // Full-text search query
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      console.log(`🔍 Searching PostgreSQL for: "${term}"`);
      
      const searchQuery = `
        SELECT * FROM accounts
        WHERE to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, ''))
          @@ plainto_tsquery('english', $1)
        ORDER BY name
        LIMIT $2
      `;
      
      const accounts = await queryDb<any>(searchQuery, [term, pageSize]);
      
      return {
        data: accounts.map(mapDbToAccount),
        total: accounts.length,
        hasMore: false,
      };
    }
    
    // Build WHERE clause from filters
    const { where, params } = buildWhereClause(filterConditions);
    
    // Pagination query with cursor
    let query: string;
    let queryParams: any[];
    
    if (cursor) {
      // Cursor-based pagination (continue from last name)
      query = `
        SELECT * FROM accounts
        ${where}
        ${where ? 'AND' : 'WHERE'} name > $${params.length + 1}
        ORDER BY name
        LIMIT $${params.length + 2}
      `;
      queryParams = [...params, cursor, pageSize + 1]; // +1 to check if more exist
    } else {
      // First page
      query = `
        SELECT * FROM accounts
        ${where}
        ORDER BY name
        LIMIT $${params.length + 1}
      `;
      queryParams = [...params, pageSize + 1]; // +1 to check if more exist
    }
    
    const accounts = await queryDb<any>(query, queryParams);
    const hasMore = accounts.length > pageSize;
    const data = hasMore ? accounts.slice(0, pageSize) : accounts;
    const nextCursor = hasMore ? data[data.length - 1].name : undefined;
    
    console.log(`✅ Loaded ${data.length} accounts from PostgreSQL (hasMore: ${hasMore})`);
    
    return {
      data: data.map(mapDbToAccount),
      total: data.length,
      hasMore,
      nextCursor,
    };
  } catch (error) {
    console.error('❌ Error loading accounts from PostgreSQL:', error);
    return {
      data: [],
      total: 0,
      hasMore: false,
    };
  }
}

/**
 * Get total account counts
 */
export async function getTotalAccountsCountSQL(): Promise<{
  total: number;
  active: number;
  fishbowl: number;
}> {
  try {
    const result = await queryDb<any>(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active_customer = true) as active,
        COUNT(*) FILTER (WHERE source = 'fishbowl') as fishbowl
      FROM accounts
    `);
    
    return {
      total: parseInt(result[0].total) || 0,
      active: parseInt(result[0].active) || 0,
      fishbowl: parseInt(result[0].fishbowl) || 0,
    };
  } catch (error) {
    console.error('❌ Error getting account counts:', error);
    return { total: 0, active: 0, fishbowl: 0 };
  }
}

/**
 * Load single account by ID
 */
export async function loadAccountByIdSQL(accountId: string): Promise<UnifiedAccount | null> {
  try {
    const result = await queryDb<any>(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );
    
    if (result.length === 0) return null;
    
    return mapDbToAccount(result[0]);
  } catch (error) {
    console.error('❌ Error loading account:', error);
    return null;
  }
}

/**
 * Map database row to UnifiedAccount interface
 */
function mapDbToAccount(row: any): UnifiedAccount {
  return {
    id: row.id,
    source: row.source as 'fishbowl' | 'copper' | 'manual',
    copperId: row.copper_id,
    fishbowlId: row.fishbowl_id,
    
    name: row.name,
    accountNumber: row.account_number,
    website: row.website,
    phone: row.phone,
    email: row.email,
    
    shippingStreet: row.shipping_street,
    shippingCity: row.shipping_city,
    shippingState: row.shipping_state,
    shippingZip: row.shipping_zip,
    billingStreet: row.billing_street,
    billingCity: row.billing_city,
    billingState: row.billing_state,
    billingZip: row.billing_zip,
    
    accountType: row.account_type,
    region: row.region,
    segment: row.segment,
    customerPriority: row.customer_priority,
    organizationLevel: row.organization_level,
    businessModel: row.business_model,
    
    paymentTerms: row.payment_terms,
    shippingTerms: row.shipping_terms,
    carrierName: row.carrier_name,
    
    salesPerson: row.sales_person,
    totalOrders: row.total_orders,
    totalSpent: parseFloat(row.total_spent) || undefined,
    lastOrderDate: row.last_order_date,
    firstOrderDate: row.first_order_date,
    
    primaryContactId: row.primary_contact_id,
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    primaryContactPhone: row.primary_contact_phone,
    
    accountOrderId: row.account_order_id,
    copperUrl: row.copper_url,
    contactType: row.contact_type,
    inactiveDays: row.inactive_days,
    interactionCount: row.interaction_count,
    lastContacted: row.last_contacted,
    ownedBy: row.owned_by,
    ownerId: row.owner_id,
    
    status: row.status as 'prospect' | 'active' | 'inactive' | 'churned',
    isActiveCustomer: row.is_active_customer,
    
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: row.notes,
  };
}
