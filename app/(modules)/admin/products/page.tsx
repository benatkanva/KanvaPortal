'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Package, Layers, ArrowLeft } from 'lucide-react';
import ProductsTab from '@/app/settings/ProductsTab';
import ProductHierarchyContent from '@/components/admin/ProductHierarchyContent';
import Link from 'next/link';

export default function AdminProductsPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('management');

  useEffect(() => {
    if (user && userProfile?.role !== 'admin') {
      router.push('/');
    }
  }, [user, userProfile, router]);

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (userProfile.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all product-related settings and configurations</p>
          </div>
          <Link href="/admin" className="text-sm text-kanva-green hover:underline">
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('management')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'management'
                  ? 'border-kanva-green text-kanva-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Product Management
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'hierarchy'
                  ? 'border-kanva-green text-kanva-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-2" />
              Product Hierarchy
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'management' && (
            <ProductsTab isAdmin={true} />
          )}
          {activeTab === 'hierarchy' && (
            <ProductHierarchyContent />
          )}
        </div>
      </div>
    </div>
  );
}
