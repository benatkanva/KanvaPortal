'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  company_id?: string;
  title?: string;
  salesPerson?: string;
  canViewAllCommissions?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canViewAllCommissions: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  canViewAllCommissions: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        // Build user profile from Supabase user metadata
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email || '',
          role: session.user.user_metadata?.role || 'user',
          company_id: session.user.user_metadata?.company_id,
          canViewAllCommissions: session.user.user_metadata?.role === 'admin',
        };
        
        setUserProfile(profile);
      }
      
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email || '',
          role: session.user.user_metadata?.role || 'user',
          company_id: session.user.user_metadata?.company_id,
          canViewAllCommissions: session.user.user_metadata?.role === 'admin',
        };
        
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const canViewAllCommissions = 
    isAdmin || 
    userProfile?.canViewAllCommissions === true ||
    (userProfile?.title?.toUpperCase().includes('VP') ?? false);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, isManager, canViewAllCommissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
