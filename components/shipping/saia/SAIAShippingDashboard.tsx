'use client';

import { useState, useMemo } from 'react';
import { useSAIACustomers } from '@/hooks/useSAIACustomers';
import { useSAIACustomerDetail } from '@/hooks/useSAIACustomerDetail';
import SAIASummaryStats from './SAIASummaryStats';
import SAIACustomerCard from './SAIACustomerCard';
import SAIACustomerTable from './SAIACustomerTable';
import SAIACustomerDetail from './SAIACustomerDetail';
import SAIAShipmentSearch from './SAIAShipmentSearch';
import { Search, Filter, RefreshCw, LayoutGrid, List } from 'lucide-react';

type FilterType = 'all' | 'high-volume' | 'recent' | 'best-ontime';
type ViewType = 'dashboard' | 'search';
type DisplayMode = 'cards' | 'table';

export default function SAIAShippingDashboard() {
  const { customers, loading, error, refetch } = useSAIACustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('dashboard');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');

  const { customer: selectedCustomer, shipments: selectedShipments, loading: detailLoading } = 
    useSAIACustomerDetail(selectedCustomerKey);

  // Filter and search customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.city.toLowerCase().includes(query) ||
        c.state.toLowerCase().includes(query)
      );
    }

    // Apply filter type
    switch (filterType) {
      case 'high-volume':
        filtered = filtered.filter(c => c.totalShipments >= 5);
        break;
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(c => 
          new Date(c.lastShipmentDate) >= sevenDaysAgo
        );
        break;
      case 'best-ontime':
        filtered = filtered.filter(c => c.onTimePercentage >= 90);
        break;
    }

    // Sort by total shipments descending
    return filtered.sort((a, b) => b.totalShipments - a.totalShipments);
  }, [customers, searchQuery, filterType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading SAIA shipping data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setViewType('dashboard')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            viewType === 'dashboard'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setViewType('search')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            viewType === 'search'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🔍 Search Shipment
        </button>
      </div>

      {/* Search View */}
      {viewType === 'search' && <SAIAShipmentSearch />}

      {/* Dashboard View */}
      {viewType === 'dashboard' && (
        <>
          {/* Summary Statistics */}
          <SAIASummaryStats customers={customers} />

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name, city, or state..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setDisplayMode('cards')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      displayMode === 'cards'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Cards
                  </button>
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      displayMode === 'table'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    Table
                  </button>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Customers
                </button>
                <button
                  onClick={() => setFilterType('high-volume')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'high-volume'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  High Volume (5+)
                </button>
                <button
                  onClick={() => setFilterType('recent')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'recent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Recent (7 days)
                </button>
                <button
                  onClick={() => setFilterType('best-ontime')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'best-ontime'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Best On-Time (90%+)
                </button>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
            </div>
          </div>

          {/* Customer Display - Cards or Table */}
          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : displayMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCustomers.map((customer) => (
                <SAIACustomerCard
                  key={customer.id}
                  customer={customer}
                  onClick={() => setSelectedCustomerKey(customer.id)}
                />
              ))}
            </div>
          ) : (
            <SAIACustomerTable
              customers={filteredCustomers}
              onCustomerClick={(customerId) => setSelectedCustomerKey(customerId)}
            />
          )}
        </>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && !detailLoading && (
        <SAIACustomerDetail
          customer={selectedCustomer}
          shipments={selectedShipments}
          onClose={() => setSelectedCustomerKey(null)}
        />
      )}
    </div>
  );
}
