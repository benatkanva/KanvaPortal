'use client';

import { useState } from 'react';
import { UserPlus, Database, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface MissingCompany {
  fishbowlId: string;
  fishbowlCustomerId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  suggestedAccountType: 'C' | 'HQ' | 'DIST';
}

interface CreateResult {
  fishbowlId: string;
  fishbowlCustomerId: string;
  name: string;
  copperCompanyId?: string;
  copperAccountNumber?: string;
  status: 'created' | 'failed';
  error?: string;
}

interface InactiveCompany {
  copperId: string;
  copperName: string;
  fishbowlName: string;
  accountNumber: string;
  accountId?: string;
}

export default function CopperCreateMissingPage() {
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<MissingCompany[]>([]);
  const [results, setResults] = useState<CreateResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  
  // New state for inactive companies
  const [inactive, setInactive] = useState<InactiveCompany[]>([]);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  
  // Debug state
  const [debugData, setDebugData] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const findMissing = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setCreated(false);

    try {
      const loadingToast = toast.loading('Searching for missing companies...');
      
      const response = await fetch('/api/copper/create-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find missing companies');
      }

      toast.dismiss(loadingToast);
      setMissing(data.missing || []);
      
      if (data.missing?.length === 0) {
        toast.success('All Fishbowl customers already have account numbers!');
      } else {
        toast.success(`Found ${data.missing.length} missing companies`);
      }
    } catch (err: any) {
      console.error('❌ Error finding missing companies:', err);
      setError(err.message || 'An unexpected error occurred');
      toast.error(err.message || 'Failed to find missing companies');
    } finally {
      setLoading(false);
    }
  };

  const createCompanies = async () => {
    if (!confirm(`Create ${missing.length} companies in Copper? This will assign account numbers and cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadingToast = toast.loading(`Creating ${missing.length} companies in Copper...`);
      
      const response = await fetch('/api/copper/create-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          companies: missing,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create companies');
      }

      toast.dismiss(loadingToast);
      setResults(data.results);
      setCreated(true);
      setMissing([]); // Clear missing list
      
      const created = data.results.filter((r: any) => r.status === 'created').length;
      const failed = data.results.filter((r: any) => r.status === 'failed').length;
      
      if (failed === 0) {
        toast.success(`Successfully created ${created} companies!`);
      } else {
        toast.success(`Created ${created} companies (${failed} failed)`);
      }
    } catch (err: any) {
      console.error('❌ Error creating companies:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to create companies');
    } finally {
      setLoading(false);
    }
  };

  const findInactive = async () => {
    setActivating(true);
    setError(null);
    setActivated(false);

    try {
      const loadingToast = toast.loading('Searching for inactive companies...');
      
      const response = await fetch('/api/copper/create-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find-inactive' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find inactive companies');
      }

      toast.dismiss(loadingToast);
      setInactive(data.inactive || []);
      
      if (data.inactive?.length === 0) {
        toast.success('All companies with Fishbowl data are already active!');
      } else {
        toast.success(`Found ${data.inactive.length} inactive companies`);
      }
    } catch (err: any) {
      console.error('❌ Error finding inactive companies:', err);
      setError(err.message || 'An unexpected error occurred');
      toast.error(err.message || 'Failed to find inactive companies');
    } finally {
      setActivating(false);
    }
  };

  const fetchDebugData = async () => {
    try {
      const response = await fetch('/api/copper/create-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'debug-data' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDebugData(data.samples);
        setShowDebug(true);
        toast.success('Debug data loaded!');
      }
    } catch (err: any) {
      toast.error('Failed to load debug data');
    }
  };

  const activateCompanies = async () => {
    if (!confirm(`Activate ${inactive.length} companies in Copper? This will check the "Active Customer" field.`)) {
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const loadingToast = toast.loading(`Activating ${inactive.length} companies...`);
      
      const copperIds = inactive.map(c => c.copperId);
      
      const response = await fetch('/api/copper/create-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          copperIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate companies');
      }

      toast.dismiss(loadingToast);
      setActivated(true);
      setInactive([]);
      
      const activatedCount = data.stats?.activated || 0;
      const failedCount = data.stats?.failed || 0;
      
      if (failedCount === 0) {
        toast.success(`Successfully activated ${activatedCount} companies!`);
      } else {
        toast.success(`Activated ${activatedCount} companies (${failedCount} failed)`);
      }
    } catch (err: any) {
      console.error('❌ Error activating companies:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to activate companies');
    } finally {
      setActivating(false);
    }
  };

  const getAccountTypeBadge = (type: string) => {
    const colors = {
      C: 'bg-blue-100 text-blue-800',
      HQ: 'bg-purple-100 text-purple-800',
      DIST: 'bg-green-100 text-green-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <a href="/admin" className="text-sm text-kanva-green hover:underline flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="w-8 h-8 text-kanva-green" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Missing Copper Companies</h1>
              <p className="text-sm text-gray-600">
                Create Copper companies for Fishbowl customers marked "NOT IN COPPER"
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">How This Works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Step 1:</strong> Find Fishbowl customers with accountNumber = "NOT IN COPPER"</li>
              <li>• <strong>Step 2:</strong> Review suggested account types (C, HQ, DIST)</li>
              <li>• <strong>Step 3:</strong> Create companies in Copper via API</li>
              <li>• <strong>Step 4:</strong> Assign sequential account numbers</li>
              <li>• <strong>Step 5:</strong> Update Fishbowl records with Copper account number</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={findMissing}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-kanva-green text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Database className="w-5 h-5" />
              {loading && !created ? 'Finding...' : 'Find Missing Companies'}
            </button>

            {missing.length > 0 && !created && (
              <button
                onClick={createCompanies}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-5 h-5" />
                {loading ? 'Creating...' : `Create ${missing.length} Companies`}
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Error:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* No Missing Companies Message */}
          {!loading && missing.length === 0 && !created && !error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">All Set! ✨</h3>
                  <p className="text-sm text-green-700 mt-1">
                    All Fishbowl customers already have account numbers assigned. No missing companies found.
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    💡 <strong>Note:</strong> Companies are marked as "NOT IN COPPER" during the Fishbowl import if they don't match existing Copper companies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Missing Companies List */}
          {missing.length > 0 && !created && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Missing Companies ({missing.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fishbowl ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {missing.slice(0, 100).map((company) => (
                      <tr key={company.fishbowlCustomerId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{company.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {company.address && (
                            <div>
                              <div>{company.address}</div>
                              <div>{company.city}, {company.state} {company.zip}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{company.fishbowlId}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountTypeBadge(company.suggestedAccountType)}`}>
                            {company.suggestedAccountType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {missing.length > 100 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Showing first 100 of {missing.length} companies
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {created && results.length > 0 && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {results.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Processed</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {results.filter(r => r.status === 'created').length}
                  </div>
                  <div className="text-sm text-gray-600">Created</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {results.filter(r => r.status === 'failed').length}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900">Creation Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Copper ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.map((result) => (
                        <tr key={result.fishbowlCustomerId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {result.status === 'created' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{result.name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {result.copperAccountNumber || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {result.copperCompanyId || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600">
                            {result.error || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NEW SECTION: Activate Inactive Companies */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Activate Inactive Companies</h1>
              <p className="text-sm text-gray-600">
                Find companies with Fishbowl data that exist in Copper but aren't marked as Active
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-orange-900 mb-2">How This Works:</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• <strong>Step 1:</strong> Scan Copper for companies linked to Fishbowl but NOT marked active</li>
              <li>• <strong>Step 2:</strong> Review the list of inactive companies</li>
              <li>• <strong>Step 3:</strong> Bulk activate by checking "Active Customer" field</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={findInactive}
              disabled={activating}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Database className="w-5 h-5" />
              {activating && !activated ? 'Searching...' : 'Find Inactive Companies'}
            </button>

            {inactive.length > 0 && !activated && (
              <button
                onClick={activateCompanies}
                disabled={activating}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-5 h-5" />
                {activating ? 'Activating...' : `Activate ${inactive.length} Companies`}
              </button>
            )}
            
            <button
              onClick={fetchDebugData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              🔍 Debug: Show Raw Data
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Error:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* No Inactive Companies Message */}
          {!activating && inactive.length === 0 && !activated && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">All Active! ✨</h3>
                  <p className="text-sm text-green-700 mt-1">
                    All companies with Fishbowl data are already marked as Active in Copper.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Inactive Companies Table */}
          {inactive.length > 0 && !activated && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Inactive Companies ({inactive.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account ID (FB)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Copper ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inactive.slice(0, 100).map((company) => (
                      <tr key={company.copperId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{company.copperName}</td>
                        <td className="px-4 py-3 text-sm font-mono text-blue-600">{company.accountId || '(none)'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{company.accountNumber}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{company.copperId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inactive.length > 100 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Showing first 100 of {inactive.length} companies
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {activated && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Successfully Activated! 🎉</h3>
                  <p className="text-sm text-green-700 mt-1">
                    All companies have been marked as Active in Copper.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Data Display */}
          {showDebug && debugData.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-yellow-900">🔍 Debug: Sample Copper Companies</h3>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-sm text-yellow-700 hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {debugData.map((company, idx) => (
                  <div key={idx} className="bg-white p-4 rounded border border-yellow-300 text-xs font-mono">
                    <div><strong>ID:</strong> {company.id}</div>
                    <div><strong>Name:</strong> {company.name}</div>
                    <div><strong>accountNumber:</strong> {String(company.accountNumber || 'null')}</div>
                    <div><strong>Account Number cf_698260:</strong> {String(company['Account Number cf_698260'] || 'null')}</div>
                    <div><strong>activeCustomer:</strong> {String(company.activeCustomer || 'null')}</div>
                    <div><strong>Active Customer cf_712751:</strong> {String(company['Active Customer cf_712751'] || 'null')}</div>
                    <div className="mt-2"><strong>All account/active fields:</strong> {company.allFields.join(', ') || 'none'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
