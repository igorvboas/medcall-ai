import { useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, supabaseConfigDebug } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export interface AuthActions {
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obter sessão inicial
    const getInitialSession = async () => {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.getInitialSession start', supabaseConfigDebug);
      const { data: { session } } = await supabase.auth.getSession();
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.getInitialSession session', { hasSession: Boolean(session) });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Escutar mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.signIn request', { email, url: supabaseConfigDebug.url });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.signIn response', { error });
      return { error };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[DEBUG] useAuth.signIn catch', error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.signOut');
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };
}
