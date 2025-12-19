'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadUnifiedAccounts,
  loadUnifiedProspects,
  loadUnifiedContacts,
  loadUnifiedDeals,
  loadAccountOrders,
  loadAccountSalesSummary,
  type UnifiedAccount,
  type UnifiedProspect,
  type UnifiedContact,
  type UnifiedDeal,
  type OrderSummary,
  type SalesSummary,
} from './dataService';

// Query keys for cache management
export const queryKeys = {
  accounts: ['crm', 'accounts'] as const,
  prospects: ['crm', 'prospects'] as const,
  contacts: ['crm', 'contacts'] as const,
  deals: ['crm', 'deals'] as const,
  accountOrders: (accountId: string) => ['crm', 'orders', accountId] as const,
  accountSales: (accountId: string) => ['crm', 'sales', accountId] as const,
};

// Hook for loading all accounts with caching
export function useAccounts() {
  return useQuery<UnifiedAccount[]>({
    queryKey: queryKeys.accounts,
    queryFn: loadUnifiedAccounts,
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
  });
}

// Hook for loading all prospects with caching
export function useProspects() {
  return useQuery<UnifiedProspect[]>({
    queryKey: queryKeys.prospects,
    queryFn: loadUnifiedProspects,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading all contacts with caching
export function useContacts() {
  return useQuery<UnifiedContact[]>({
    queryKey: queryKeys.contacts,
    queryFn: loadUnifiedContacts,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading all deals with caching
export function useDeals() {
  return useQuery<UnifiedDeal[]>({
    queryKey: queryKeys.deals,
    queryFn: loadUnifiedDeals,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading orders for a specific account
export function useAccountOrders(accountId: string | null) {
  return useQuery<OrderSummary[]>({
    queryKey: queryKeys.accountOrders(accountId || ''),
    queryFn: () => loadAccountOrders(accountId || ''),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading sales summary for a specific account
export function useAccountSales(accountId: string | null) {
  return useQuery<SalesSummary | null>({
    queryKey: queryKeys.accountSales(accountId || ''),
    queryFn: () => loadAccountSalesSummary(accountId || ''),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get a single account by ID (uses cached data)
export function useAccount(accountId: string | null) {
  const { data: accounts } = useAccounts();
  return accounts?.find((a) => a.id === accountId) || null;
}

// Hook to get contacts for a specific account
export function useAccountContacts(accountId: string | null) {
  const { data: contacts } = useContacts();
  if (!accountId || !contacts) return [];
  return contacts.filter((c) => c.accountId === accountId);
}

// Hook to prefetch data (call on app mount for instant loading)
export function usePrefetchCRMData() {
  const queryClient = useQueryClient();

  const prefetch = async () => {
    // Prefetch all CRM data in parallel
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.accounts,
        queryFn: loadUnifiedAccounts,
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.prospects,
        queryFn: loadUnifiedProspects,
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.contacts,
        queryFn: loadUnifiedContacts,
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.deals,
        queryFn: loadUnifiedDeals,
        staleTime: 5 * 60 * 1000,
      }),
    ]);
  };

  return prefetch;
}

// Hook to invalidate and refetch data
export function useRefreshCRMData() {
  const queryClient = useQueryClient();

  return {
    refreshAccounts: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
    refreshProspects: () => queryClient.invalidateQueries({ queryKey: queryKeys.prospects }),
    refreshContacts: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    refreshDeals: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals }),
    refreshAll: () => queryClient.invalidateQueries({ queryKey: ['crm'] }),
  };
}
