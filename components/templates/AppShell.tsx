'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  Calculator, 
  Settings, 
  Database, 
  FileText, 
  Home, 
  Users,
  LogOut,
  Package,
  Target,
  ShoppingCart,
  MapPin,
  LayoutGrid
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface AppShellProps {
  children: React.ReactNode;
}

// Separate component for search params to use with Suspense
function SearchParamsProvider({ onQueryChange }: { onQueryChange: (query: string) => void }) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Preserve query params for Copper iframe
    let query = '';
    try {
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      const hasParams = searchParams && Array.from(searchParams.keys()).length > 0;
      if (inIframe && hasParams) {
        const qs = searchParams.toString();
        query = qs ? `?${qs}` : '';
      }
    } catch {
      // ignore cross-origin checks
    }
    onQueryChange(query);
  }, [searchParams, onQueryChange]);
  
  return null;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user, userProfile, isAdmin, isManager } = useAuth();
  const [query, setQuery] = useState('');

  const handleSignOut = async () => {
    try {
      const { auth } = await import('@/lib/firebase/config');
      const { signOut } = await import('firebase/auth');
      if (auth) {
        await signOut(auth);
        toast.success('Signed out successfully');
        window.location.href = '/';
      }
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Search params handler with Suspense */}
      <Suspense fallback={null}>
        <SearchParamsProvider onQueryChange={setQuery} />
      </Suspense>
      
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link href={`/${query}`} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary-600 text-white grid place-items-center group-hover:scale-105 transition-transform shadow-md">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-gray-900">KanvaPortal</p>
                <p className="text-xs text-gray-500">Kanva Botanicals</p>
              </div>
            </Link>

            {/* Navigation */}
            {user && (
              <nav className="flex items-center gap-1">
                <Link
                  href={`/dashboard${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="w-4 h-4" /> Dashboard
                </Link>

                <Link
                  href={`/customers${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive('/customers')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" /> Customers
                </Link>

                {/* Goals Module */}
                <Link
                  href={`/goals/dashboard${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname?.startsWith('/goals')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Target className="w-4 h-4" /> Goals
                </Link>

                {/* Quotes Module */}
                <Link
                  href="/quotes/index.html"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname?.startsWith('/quotes')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" /> Quotes
                </Link>

                {/* Stores Module */}
                <Link
                  href={`/stores${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname?.startsWith('/stores')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MapPin className="w-4 h-4" /> Stores
                </Link>

                <Link
                  href={`/shipments${query}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive('/shipments')
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Package className="w-4 h-4" /> Shipments
                </Link>

                {isAdmin && (
                  <>
                    <Link
                      href={`/admin${query}`}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        pathname?.startsWith('/admin')
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Settings className="w-4 h-4" /> Admin
                    </Link>

                    <Link
                      href={`/settings${query}`}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive('/settings')
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Database className="w-4 h-4" /> Settings
                    </Link>
                  </>
                )}

                {/* User Menu */}
                <div className="ml-4 pl-4 border-l border-gray-200 flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile?.name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Sales Rep'}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Kanva Botanicals / CWL Brands</span>
          <span className="text-gray-400">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
