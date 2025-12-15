import React, { useState, useEffect } from 'react';
import Pages from './pages';
import Login from './pages/Login';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verifica sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Escuta mudanças (login, logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {!session ? <Login /> : <Pages />}
    </QueryClientProvider>
  );
}

export default App;