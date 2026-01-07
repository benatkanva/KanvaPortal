'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { QuoteCustomer } from '@/types/quote';
import { CustomerSearchResult } from '@/lib/services/customerLookupService';

interface CustomerLookupProps {
  onCustomerSelect: (customer: QuoteCustomer) => void;
  selectedCustomer?: QuoteCustomer;
}

export default function CustomerLookup({ onCustomerSelect, selectedCustomer }: CustomerLookupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<QuoteCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load recent customers on mount
    loadRecentCustomers();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounced search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  async function loadRecentCustomers() {
    try {
      const userId = localStorage.getItem('userId'); // Get from auth context in real implementation
      if (!userId) return;

      const response = await fetch(`/api/quotes/customer-search?recent=true&userId=${userId}`);
      const data = await response.json();
      setRecentCustomers(data.customers || []);
    } catch (error) {
      console.error('Error loading recent customers:', error);
    }
  }

  async function performSearch(query: string) {
    try {
      const response = await fetch(`/api/quotes/customer-search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.customers || []);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsSearching(false);
    }
  }

  function handleCustomerSelect(customer: QuoteCustomer | CustomerSearchResult) {
    onCustomerSelect(customer);
    setSearchQuery(customer.companyName);
    setShowResults(false);
  }

  function getStatusIcon(customer: CustomerSearchResult | QuoteCustomer) {
    if (customer.source === 'fishbowl') {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    if (customer.isActive) {
      return <CheckCircle className="w-4 h-4 text-blue-600" />;
    }
    return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }

  function getStatusLabel(customer: CustomerSearchResult | QuoteCustomer) {
    if (customer.source === 'fishbowl') {
      return 'Active in Fishbowl';
    }
    if (customer.isActive) {
      return 'Active in Copper';
    }
    return 'Copper Only';
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder="Search by company name, email, or phone..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        )}
      </div>

      {/* Selected Customer Display */}
      {selectedCustomer && !showResults && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900">{selectedCustomer.companyName}</h4>
                {getStatusIcon(selectedCustomer)}
                <span className="text-xs text-gray-500">{getStatusLabel(selectedCustomer)}</span>
              </div>
              {selectedCustomer.city && selectedCustomer.state && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCustomer.city}, {selectedCustomer.state}
                </p>
              )}
              {selectedCustomer.salesPerson && (
                <p className="text-xs text-gray-500 mt-1">
                  Sales Rep: {selectedCustomer.salesRepName || selectedCustomer.salesPerson}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && (searchResults.length > 0 || recentCustomers.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <h4 className="text-xs font-semibold text-gray-700 uppercase">Search Results</h4>
              </div>
              {searchResults.map((customer, index) => (
                <button
                  key={`${customer.source}-${customer.fishbowlId || customer.copperId}-${index}`}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-900">{customer.companyName}</h4>
                        {getStatusIcon(customer)}
                        <span className="text-xs text-gray-500">{getStatusLabel(customer)}</span>
                      </div>
                      {customer.city && customer.state && (
                        <p className="text-sm text-gray-600 mt-1">
                          {customer.city}, {customer.state}
                        </p>
                      )}
                      {customer.salesPerson && (
                        <p className="text-xs text-gray-500 mt-1">
                          Rep: {customer.salesRepName || customer.salesPerson}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{customer.matchReason}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent Customers */}
          {searchQuery.length < 2 && recentCustomers.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <h4 className="text-xs font-semibold text-gray-700 uppercase">Recent Customers</h4>
                </div>
              </div>
              {recentCustomers.map((customer, index) => (
                <button
                  key={`recent-${customer.fishbowlId || customer.copperId}-${index}`}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">{customer.companyName}</h4>
                        {getStatusIcon(customer)}
                      </div>
                      {customer.city && customer.state && (
                        <p className="text-sm text-gray-600 mt-1">
                          {customer.city}, {customer.state}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No customers found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
