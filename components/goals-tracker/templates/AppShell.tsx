"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Target, Settings, Users, Home, LayoutDashboard, BarChart3 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChange } from "@/lib/firebase/client";
import { userService } from "@/lib/firebase/services";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const searchParams = useSearchParams();
  const [userRole, setUserRole] = useState<string | null>(null);
  
  let query = '';
  try {
    // If embedded in Copper, preserve query params so SDK can initialize
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    const hasParams = searchParams && Array.from(searchParams.keys()).length > 0;
    if (inIframe && hasParams) {
      const qs = searchParams.toString();
      query = qs ? `?${qs}` : '';
    }
  } catch {
    // ignore cross-origin checks
  }

  // Check user role for admin/manager access
  useEffect(() => {
    const unsub = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await userService.getUser(firebaseUser.uid);
        setUserRole(userData?.role || null);
      } else {
        setUserRole(null);
      }
    });
    return () => unsub();
  }, []);

  const isAdmin = userRole === 'admin' || userRole === 'manager';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <Link href={`/${query}`} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-kanva-green text-white grid place-items-center group-hover:scale-105 transition-transform shadow-kanva">
                <Target className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-gray-900">Kanva Sales Goals</p>
                <p className="text-xs text-gray-500">KanvaPortal</p>
              </div>
            </Link>

            {/* Actions */}
            <nav className="flex items-center gap-2">
              <Link
                href={`/${query}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                aria-label="Home"
              >
                <Home className="w-4 h-4" /> Home
              </Link>
              <Link
                href={`/sales-insights${query}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                aria-label="Sales Insights"
              >
                <BarChart3 className="w-4 h-4" /> Sales Insights
              </Link>
              <Link
                href={`/dashboard${query}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                aria-label="Dashboard"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              <Link
                href={`/team-dashboard${query}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                aria-label="Team"
              >
                <Users className="w-4 h-4" /> Team
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href={`/admin${query}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                    aria-label="Settings"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <Link
                    href={`/admin/users${query}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                    aria-label="Users"
                  >
                    <Users className="w-4 h-4" /> Users
                  </Link>
                </>
              )}
            </nav>
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
          <span>© {new Date().getFullYear()} Kanva Botanicals</span>
          <span className="text-gray-400">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
