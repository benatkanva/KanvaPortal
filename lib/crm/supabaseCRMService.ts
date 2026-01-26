/**
 * Generic CRM Data Service for Supabase
 * Handles People, Tasks, Opportunities, Leads
 * Enterprise-grade reusable pattern
 */

import { supabase } from '@/lib/supabase/client';
import type { Person, Task, Opportunity, Lead, EntityType, PaginatedResponse, EntityCounts } from './types-crm';
import type { FilterCondition } from './types';

// Generic table name mapping
const TABLE_MAP: Record<EntityType, string> = {
  people: 'people',
  tasks: 'tasks',
  opportunities: 'opportunities',
  leads: 'leads',
  accounts: 'accounts',
};

// Generic filter application
function applyFilters<T>(query: any, filters?: {
  search?: string;
  filterConditions?: FilterCondition[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}): any {
  let q = query;

  // Search across common text fields
  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    q = q.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`);
  }

  // Advanced filter conditions
  if (filters?.filterConditions && filters.filterConditions.length > 0) {
    filters.filterConditions.forEach((condition: FilterCondition) => {
      const { field, operator, value } = condition;

      switch (operator) {
        case 'equals':
          q = q.eq(field, value);
          break;
        case 'not_equals':
          q = q.neq(field, value);
          break;
        case 'contains':
          q = q.ilike(field, `%${value}%`);
          break;
        case 'starts_with':
          q = q.ilike(field, `${value}%`);
          break;
        case 'greater_than':
          q = q.gt(field, value);
          break;
        case 'less_than':
          q = q.lt(field, value);
          break;
        case 'is_empty':
          q = q.is(field, null);
          break;
        case 'is_not_empty':
          q = q.not(field, 'is', null);
          break;
        case 'in':
          if (Array.isArray(value)) {
            q = q.in(field, value);
          }
          break;
      }
    });
  }

  return q;
}

// ============================================
// GENERIC ENTITY FETCHING
// ============================================
export async function getEntities<T>(
  entityType: EntityType,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    filterConditions?: FilterCondition[];
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}
): Promise<PaginatedResponse<T>> {
  try {
    const {
      page = 1,
      pageSize = 50,
      search,
      filterConditions,
      sortBy = 'name',
      sortDirection = 'asc',
    } = options;

    const tableName = TABLE_MAP[entityType];
    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    // Apply filters
    query = applyFilters(query, { search, filterConditions });

    // Apply sorting
    query = query.order(sortBy, { ascending: sortDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error(`Error loading ${entityType}:`, error);
      throw error;
    }

    return {
      data: (data || []) as T[],
      count,
      hasMore: count ? offset + pageSize < count : false,
    };
  } catch (error) {
    console.error(`Error in getEntities(${entityType}):`, error);
    throw error;
  }
}

// ============================================
// GENERIC ENTITY COUNTS
// ============================================
export async function getEntityCounts(
  entityType: EntityType,
  filterConditions?: FilterCondition[]
): Promise<EntityCounts> {
  try {
    const tableName = TABLE_MAP[entityType];

    // Total count
    let totalQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (filterConditions && filterConditions.length > 0) {
      totalQuery = applyFilters(totalQuery, { filterConditions });
    }

    const { count: total } = await totalQuery;

    // Entity-specific counts
    const counts: EntityCounts = { total: total || 0 };

    // Add entity-specific counts based on type
    switch (entityType) {
      case 'people':
        const { count: withAccounts } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .not('account_id', 'is', null);
        counts.with_accounts = withAccounts || 0;
        break;

      case 'tasks':
        const { count: completed } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .not('completed_at', 'is', null);
        counts.completed = completed || 0;
        
        const { count: pending } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .is('completed_at', null);
        counts.pending = pending || 0;
        break;

      case 'opportunities':
        const { count: won } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Won');
        counts.won = won || 0;

        const { count: lost } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Lost');
        counts.lost = lost || 0;

        const { count: open } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Open');
        counts.open = open || 0;
        break;

      case 'leads':
        const { count: converted } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .not('converted_at', 'is', null);
        counts.converted = converted || 0;

        const { count: active } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .is('converted_at', null);
        counts.active = active || 0;
        break;
    }

    return counts;
  } catch (error) {
    console.error(`Error getting ${entityType} counts:`, error);
    return { total: 0 };
  }
}

// ============================================
// SPECIFIC ENTITY FUNCTIONS
// ============================================

export async function getPeople(options: Parameters<typeof getEntities>[1] = {}) {
  return getEntities<Person>('people', options);
}

export async function getTasks(options: Parameters<typeof getEntities>[1] = {}) {
  return getEntities<Task>('tasks', options);
}

export async function getOpportunities(options: Parameters<typeof getEntities>[1] = {}) {
  return getEntities<Opportunity>('opportunities', options);
}

export async function getLeads(options: Parameters<typeof getEntities>[1] = {}) {
  return getEntities<Lead>('leads', options);
}

export async function getPeopleCounts(filterConditions?: FilterCondition[]) {
  return getEntityCounts('people', filterConditions);
}

export async function getTaskCounts(filterConditions?: FilterCondition[]) {
  return getEntityCounts('tasks', filterConditions);
}

export async function getOpportunityCounts(filterConditions?: FilterCondition[]) {
  return getEntityCounts('opportunities', filterConditions);
}

export async function getLeadCounts(filterConditions?: FilterCondition[]) {
  return getEntityCounts('leads', filterConditions);
}

// ============================================
// SINGLE ENTITY FETCH
// ============================================
export async function getEntityById<T>(
  entityType: EntityType,
  id: string
): Promise<T | null> {
  try {
    const tableName = TABLE_MAP[entityType];
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching ${entityType} by ID:`, error);
      throw error;
    }

    return data as T;
  } catch (error) {
    console.error(`Error in getEntityById(${entityType}, ${id}):`, error);
    return null;
  }
}

// ============================================
// CREATE/UPDATE/DELETE
// ============================================
export async function createEntity<T>(
  entityType: EntityType,
  data: Partial<T>
): Promise<T | null> {
  try {
    const tableName = TABLE_MAP[entityType];
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${entityType}:`, error);
      throw error;
    }

    return result as T;
  } catch (error) {
    console.error(`Error in createEntity(${entityType}):`, error);
    return null;
  }
}

export async function updateEntity<T>(
  entityType: EntityType,
  id: string,
  data: Partial<T>
): Promise<T | null> {
  try {
    const tableName = TABLE_MAP[entityType];
    const { data: result, error } = await supabase
      .from(tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${entityType}:`, error);
      throw error;
    }

    return result as T;
  } catch (error) {
    console.error(`Error in updateEntity(${entityType}, ${id}):`, error);
    return null;
  }
}

export async function deleteEntity(
  entityType: EntityType,
  id: string
): Promise<boolean> {
  try {
    const tableName = TABLE_MAP[entityType];
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting ${entityType}:`, error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`Error in deleteEntity(${entityType}, ${id}):`, error);
    return false;
  }
}
