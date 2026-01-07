'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Search, Filter, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getUserQuotes } from '@/lib/services/quoteService';
import { QuoteSummary, QuoteStatus } from '@/types/quote';

export default function QuotesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

  useEffect(() => {
    if (user) {
      loadQuotes();
    }
  }, [user]);

  useEffect(() => {
    filterQuotes();
  }, [searchQuery, statusFilter, quotes]);

  async function loadQuotes() {
    if (!user) return;
    
    try {
      const userQuotes = await getUserQuotes(user.uid);
      setQuotes(userQuotes);
      setLoading(false);
    } catch (error) {
      console.error('Error loading quotes:', error);
      setLoading(false);
    }
  }

  function filterQuotes() {
    let filtered = quotes;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(q => q.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.quoteNumber.toLowerCase().includes(query) ||
        q.customer.companyName.toLowerCase().includes(query) ||
        q.customer.email?.toLowerCase().includes(query)
      );
    }

    setFilteredQuotes(filtered);
  }

  const statusColors: Record<QuoteStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Quotes</h1>
              <p className="text-sm text-gray-500">Manage and create product quotes</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/quotes/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote number, company, or email..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Quotes List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No quotes found</p>
            <p className="text-xs text-gray-400 mt-1">
              {quotes.length === 0 ? 'Create your first quote to get started' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                onClick={() => router.push(`/quotes/${quote.id}`)}
                className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{quote.quoteNumber}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[quote.status]}`}>
                        {quote.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{quote.customer.companyName}</p>
                    {quote.customer.email && (
                      <p className="text-sm text-gray-500">{quote.customer.email}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Created {quote.createdAt.toLocaleDateString()}</span>
                      {quote.sentAt && (
                        <span>Sent {quote.sentAt.toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">${quote.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
