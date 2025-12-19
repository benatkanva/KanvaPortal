'use client';

import { useState, useRef } from 'react';

export default function CopperImportSimplePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [companiesFile, setCompaniesFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!companiesFile) {
      setError('Please select the Copper companies file');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('companiesFile', companiesFile);

      const response = await fetch('/api/copper/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setCompaniesFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            📥 Import Copper Companies
          </h1>
          <a href="/admin" className="text-sm text-kanva-green hover:underline">
            ← Back to Admin
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Load Copper Data into Firestore</h2>
          <p className="text-sm text-gray-600 mb-6">
            This imports all Copper companies into Firestore. This is a <strong>one-time operation</strong> that makes future matching much faster!
          </p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏢 Copper Companies File (.xlsx or .csv)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setCompaniesFile(e.target.files?.[0] || null)}
                disabled={loading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
              />
              {companiesFile && (
                <p className="mt-2 text-sm text-green-600">
                  ✅ Selected: {companiesFile.name} ({(companiesFile.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !companiesFile}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              {loading ? '⏳ Importing to Firestore...' : '📥 Import to Firestore'}
            </button>
          </div>

          {loading && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ⏳ <strong>Importing...</strong> This may take 5-10 minutes for large files. Check your terminal for progress!
              </p>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 What this does:</strong> Loads all Copper companies into the <code className="bg-blue-100 px-1 rounded">copper_companies</code> Firestore collection. This only needs to be done once!
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">❌ Error</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">✅ Import Complete!</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-sm font-medium text-gray-700">Companies Imported</span>
                <span className="text-2xl font-bold text-green-600">{result.count.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded border border-green-300">
              <p className="text-sm text-green-900 font-medium">✨ <strong>Next Step:</strong></p>
              <p className="text-sm text-green-800 mt-1">
                Now you can use the matching tool to link Copper companies to Fishbowl customers!
              </p>
            </div>

            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              Clear Results
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📚 How It Works</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Upload your Copper companies export (companies_10.2.xlsx)</li>
            <li>The system reads all companies from the Excel file</li>
            <li>Each company is stored in Firestore with:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Company ID, name, contact info</li>
                <li>Custom fields (Account Number, Account Order ID, etc.)</li>
                <li>Address, owner, tags, and metadata</li>
              </ul>
            </li>
            <li>Data is stored in the <code className="bg-blue-100 px-1 rounded">copper_companies</code> collection</li>
            <li>This is a <strong>one-time operation</strong> - you don't need to repeat it</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded border border-blue-300">
            <p className="text-sm text-blue-900 font-medium">✨ <strong>Benefits:</strong></p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-1 ml-2">
              <li>Parse the Excel file once, use it many times</li>
              <li>Much faster matching (queries Firestore instead of Excel)</li>
              <li>Can analyze and query Copper data anytime</li>
              <li>Consistent data warehouse approach</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
