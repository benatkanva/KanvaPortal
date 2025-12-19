'use client';

import { useState } from 'react';
import { Link2, Database, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface MatchResult {
  fishbowlCustomerId: string;
  fishbowlCustomerName: string;
  copperCompanyId: string;
  copperCompanyName: string;
  matchType: 'account_number' | 'account_order_id' | 'name';
  confidence: 'high' | 'medium' | 'low';
  accountNumber?: string;
  accountOrderId?: string;
}

interface MatchStats {
  totalFishbowlCustomers: number;
  totalCopperCompanies: number;
  matched: number;
  unmatched: number;
}

interface UnmatchedAccount {
  fishbowlId: string;
  fishbowlName: string;
  fishbowlAccountId: string;
  copperId: string | null;
  copperName: string | null;
  copperAccountId: string | null;
  currentAccountOrderId: string | null;
}

export default function CopperFishbowlMatchPage() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [unmatchedAccounts, setUnmatchedAccounts] = useState<UnmatchedAccount[]>([]);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [progress, setProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    matchCount: number;
  } | null>(null);
  const [editingAccountOrderIds, setEditingAccountOrderIds] = useState<Record<string, string>>({});
  const [savingCopperIds, setSavingCopperIds] = useState<Set<string>>(new Set());
  
  // Filters and pagination
  const [filterMatchType, setFilterMatchType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const findMatches = async () => {
    setLoading(true);
    setError(null);
    setApplied(false);
    
    try {
      // Show realistic progress stages
      setProgress({ stage: '📥 Loading Fishbowl customers...', current: 1, total: 5, matchCount: 0 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress({ stage: '📥 Loading Copper companies (270K records)...', current: 2, total: 5, matchCount: 0 });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress({ stage: '🔍 Strategy 1: Matching by Account Number...', current: 3, total: 5, matchCount: 0 });
      
      const response = await fetch('/api/copper/match-fishbowl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find matches');
      }

      setMatches(data.matches);
      setUnmatchedAccounts(data.unmatchedAccounts || []);
      setStats(data.stats);
      setProgress({ 
        stage: 'Complete!', 
        current: data.stats.totalFishbowlCustomers, 
        total: data.stats.totalFishbowlCustomers,
        matchCount: data.stats.matched 
      });

      // Trigger confetti celebration! 🎉
      if (data.stats.matched > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCopperAccountOrderId = async (copperId: string, fishbowlAccountId: string) => {
    if (!copperId) {
      setToast({ message: 'No Copper ID found for this account', type: 'error' });
      return;
    }

    setSavingCopperIds(prev => new Set(prev).add(copperId));
    
    try {
      const response = await fetch('/api/copper/match-fishbowl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-copper',
          copperId,
          accountOrderId: fishbowlAccountId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update Copper');
      }

      setToast({ message: `✅ Updated Copper company ${copperId}`, type: 'success' });
      
      // Update local state to reflect the change
      setUnmatchedAccounts(prev => 
        prev.map(account => 
          account.copperId === copperId 
            ? { ...account, currentAccountOrderId: fishbowlAccountId }
            : account
        )
      );
      
    } catch (err: any) {
      setToast({ message: `Failed to update: ${err.message}`, type: 'error' });
    } finally {
      setSavingCopperIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(copperId);
        return newSet;
      });
    }
  };

  const applyMatches = async () => {
    setLoading(true);
    setError(null);
    setToast({ message: `Applying ${matches.length} matches to Firestore...`, type: 'info' });

    try {
      const response = await fetch('/api/copper/match-fishbowl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'apply',
          matches: matches  // Pass the already-found matches
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply matches');
      }

      setApplied(true);
      setToast({ message: `✅ Successfully applied ${matches.length} matches!`, type: 'success' });
      
      // Show confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      
      // Hide toast after 5 seconds
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setToast({ message: `❌ Error: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'account_number': return 'Account Number';
      case 'account_order_id': return 'Account Order ID';
      case 'name': return 'Company Name';
      default: return type;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };
    return colors[confidence as keyof typeof colors] || colors.low;
  };

  // Filter and paginate matches
  const filteredMatches = matches.filter(match => {
    // Filter by match type
    if (filterMatchType !== 'all' && match.matchType !== filterMatchType) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        match.fishbowlCustomerName.toLowerCase().includes(query) ||
        match.copperCompanyName.toLowerCase().includes(query) ||
        match.fishbowlCustomerId.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Calculate unmatched count
  const unmatchedCount = stats ? stats.unmatched : 0;

  // Pagination
  const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);
  const paginatedMatches = filteredMatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (type: string) => {
    setFilterMatchType(type);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 min-w-[300px] ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            <div className="flex items-center gap-3">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <Database className="w-5 h-5 animate-pulse" />}
              <p className="font-medium">{toast.message}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Link2 className="w-8 h-8 text-kanva-green" />
              Copper ↔ Fishbowl Matching
            </h1>
            <p className="text-gray-600 mt-2">
              Link Copper companies to Fishbowl customers for unified CRM data
            </p>
          </div>
          <a href="/admin" className="text-sm text-kanva-green hover:underline flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </a>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How Matching Works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Strategy 1 - Account Number:</strong> Fishbowl "Account Number" (custom field) → Copper "Account Number cf_698260" (C, HQ, etc.)</li>
            <li>• <strong>Strategy 2 - Customer Number:</strong> Fishbowl Customer ID → Copper "Account Order ID cf_698467"</li>
            <li>• <strong>Strategy 3 - Address:</strong> Exact address match (for new Fishbowl customers without Copper link)</li>
            <li>• <strong>High Confidence:</strong> Account Number or Customer Number match</li>
            <li>• <strong>Medium Confidence:</strong> Address match only</li>
          </ul>
        </div>

        {/* Confetti Animation */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="text-9xl animate-bounce">🎉</div>
          </div>
        )}

        {/* Progress Bar */}
        {loading && progress && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-semibold text-gray-800">{progress.stage}</span>
                <span className="text-sm font-bold text-kanva-green">
                  {progress.matchCount > 0 && `${progress.matchCount} matches! 🎯`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-kanva-green via-green-500 to-green-600 h-6 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-600 font-medium">
                  Step {progress.current} of {progress.total}
                </span>
                <span className="text-lg font-bold text-kanva-green">
                  {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                </span>
              </div>
              {progress.current === 3 && (
                <div className="mt-3 text-xs text-gray-500 italic">
                  ⏳ Processing large dataset... This may take 30-60 seconds
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={findMatches}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-kanva-green text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <Database className="w-5 h-5" />
              {loading ? '🔍 Scanning...' : 'Find Matches'}
            </button>

            {matches.length > 0 && !applied && (
              <button
                onClick={applyMatches}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-5 h-5" />
                Apply {matches.length} Matches
              </button>
            )}
          </div>

          {loading && (
            <p className="text-sm text-gray-600 mt-4">
              ⏳ Processing... This may take a few minutes for large datasets.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {applied && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-green-900">Matches Applied!</h3>
                <p className="text-sm text-green-800">
                  Successfully updated {matches.length} Fishbowl customers with Copper company links.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Fishbowl Customers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFishbowlCustomers.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Copper Companies</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCopperCompanies.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Matched</p>
              <p className="text-2xl font-bold text-green-600">{stats.matched.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Unmatched</p>
              <p className="text-2xl font-bold text-gray-600">{stats.unmatched.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Matches Table */}
        {matches.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Filters and Search */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Match Results ({filteredMatches.length} of {matches.length})
                </h2>
                <button
                  onClick={() => {
                    const csv = [
                      ['Fishbowl Customer', 'Fishbowl ID', 'Copper Company', 'Copper ID', 'Match Type', 'Confidence', 'Identifier'],
                      ...filteredMatches.map(m => [
                        m.fishbowlCustomerName,
                        m.fishbowlCustomerId,
                        m.copperCompanyName,
                        m.copperCompanyId,
                        getMatchTypeLabel(m.matchType),
                        m.confidence,
                        m.accountNumber || m.accountOrderId || ''
                      ])
                    ].map(row => row.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fishbowl-copper-matches-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  📥 Export CSV
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kanva-green focus:border-transparent"
                  />
                </div>

                {/* Match Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Match Type</label>
                  <select
                    value={filterMatchType}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kanva-green focus:border-transparent"
                  >
                    <option value="all">All Types ({matches.length})</option>
                    <option value="account_number">Account Number ({matches.filter(m => m.matchType === 'account_number').length})</option>
                    <option value="account_order_id">Account Order ID ({matches.filter(m => m.matchType === 'account_order_id').length})</option>
                    <option value="name">Address/Name ({matches.filter(m => m.matchType === 'name').length})</option>
                  </select>
                </div>

                {/* Confidence Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confidence</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kanva-green focus:border-transparent"
                  >
                    <option value="all">All Confidence</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredMatches.length)} of {filteredMatches.length} matches
                </div>
                {stats && (
                  <div className="flex gap-4">
                    <span className="text-green-600 font-semibold">{stats.matched} Matched</span>
                    <span className="text-orange-600 font-semibold">{stats.unmatched} Unmatched</span>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fishbowl Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Copper Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identifier</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMatches.map((match, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{match.fishbowlCustomerName}</div>
                        <div className="text-xs text-gray-500">ID: {match.fishbowlCustomerId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{match.copperCompanyName}</div>
                        <div className="text-xs text-gray-500">ID: {match.copperCompanyId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getMatchTypeLabel(match.matchType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getConfidenceBadge(match.confidence)}`}>
                          {match.confidence}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {match.accountNumber || match.accountOrderId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-kanva-green text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unmatched Accounts - Manual Fix Required */}
        {!loading && unmatchedAccounts.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-orange-500" />
                Unmatched Accounts - Manual Fix Required ({unmatchedAccounts.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                These Fishbowl customers have an accountId but couldn't be matched to Copper. 
                Update the <strong>Account Order ID</strong> in Copper to match the Fishbowl accountId.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fishbowl Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FB Account ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Copper Name (Possible Match)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {unmatchedAccounts.map((account) => {
                    const isSaving = savingCopperIds.has(account.copperId || '');
                    const editedValue = editingAccountOrderIds[account.fishbowlId] ?? String(account.fishbowlAccountId || '');
                    const hasValue = editedValue && String(editedValue).trim() !== '';
                    
                    return (
                      <tr key={account.fishbowlId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{account.fishbowlName}</div>
                          <div className="text-xs text-gray-500">FB ID: {account.fishbowlId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-mono rounded">
                            {account.fishbowlAccountId}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {account.copperName ? (
                            <>
                              <div className="text-sm font-medium text-gray-900">{account.copperName}</div>
                              <div className="text-xs text-gray-500">
                                Copper ID: {account.copperId}
                                {account.copperAccountId && (
                                  <> • Account ID: {account.copperAccountId}</>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-red-500 italic">No match found by name</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editedValue}
                              onChange={(e) => setEditingAccountOrderIds(prev => ({
                                ...prev,
                                [account.fishbowlId]: e.target.value
                              }))}
                              className="px-3 py-2 border border-gray-300 text-gray-900 text-sm font-mono rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-28"
                              placeholder="Enter ID"
                            />
                            {!account.currentAccountOrderId ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded whitespace-nowrap">
                                Empty in Copper
                              </span>
                            ) : account.currentAccountOrderId === editedValue ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded whitespace-nowrap">
                                ✓ Already Set
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded whitespace-nowrap">
                                Will Update
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {account.copperId ? (
                            hasValue ? (
                              <button
                                onClick={() => updateCopperAccountOrderId(account.copperId!, editedValue)}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                              >
                                {isSaving ? '⏳ Saving...' : '💾 Update Copper'}
                              </button>
                            ) : (
                              <span className="text-sm text-gray-400 italic">Enter ID first</span>
                            )
                          ) : (
                            <span className="text-sm text-gray-400 italic">No Copper company</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Matches */}
        {!loading && matches.length === 0 && stats && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Matches Found</h3>
            <p className="text-gray-600">
              No Copper companies could be matched to Fishbowl customers using the available identifiers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
