'use client';

import React from 'react';
import { ShoppingCart, ExternalLink } from 'lucide-react';

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-kanva-green rounded-full flex items-center justify-center text-white">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Quote Calculator</h1>
              <p className="text-sm text-gray-500">Generate quotes for Kanva Botanicals products</p>
            </div>
          </div>
          <a
            href="/quotes/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
        </div>
      </div>

      {/* Embedded Quote Calculator */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
        <iframe
          src="/quotes/index.html"
          className="w-full h-full border-0"
          title="Kanva Quote Calculator"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
