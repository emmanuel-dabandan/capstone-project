import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes (like logging in or out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading ASCEND Portal...</div>;

  // 🟢 The Auth Gate
  return session ? (
    <AdminDashboard session={session} />
  ) : (
    <AdminLogin onLogin={setSession} />
  );
}