import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, getProfile, signOut as supabaseSignOut } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    try {
      const data = await getProfile(userId);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err.message);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = async () => {
    await supabaseSignOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = () => {
    if (session?.user) loadProfile(session.user.id);
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAuthenticated: !!session,
    isSeeker: profile?.role === 'seeker',
    isAgent: profile?.role === 'agent',
    isAdmin: profile?.role === 'admin',
    isSuspended: profile?.is_suspended === true,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
