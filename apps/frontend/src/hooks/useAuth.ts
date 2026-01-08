import { useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, supabaseConfigDebug } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export interface AuthActions {
  signUp: (email: string, password: string, name?: string, role?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obter sessão inicial com timeout para evitar loading infinito
    const getInitialSession = async () => {
      try {
        // eslint-disable-next-line no-console
        //console.log('[DEBUG] useAuth.getInitialSession start', supabaseConfigDebug);

        // Timeout de 5 segundos para evitar loading infinito
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao verificar sessão')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();

        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as { data: { session: Session | null } };

        // eslint-disable-next-line no-console
        //console.log('[DEBUG] useAuth.getInitialSession session', { hasSession: Boolean(session) });
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        // eslint-disable-next-line no-console
        //onsole.error('[DEBUG] useAuth.getInitialSession error:', error);
        // Em caso de erro ou timeout, continuar sem sessão
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
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

  const signUp = async (email: string, password: string, name?: string, role?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
            role: role || 'doctor', // Default to doctor if not specified
          },
        },
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
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && authData.user) {
        // ✅ Verificar se o médico foi deletado/bloqueado
        const { data: medico } = await supabase
          .from('medicos')
          .select('medico_deletado')
          .eq('user_auth', authData.user.id)
          .single();

        if (medico?.medico_deletado) {
          // Bloquear acesso e fazer logout
          await supabase.auth.signOut();
          return {
            error: {
              message: 'Acesso bloqueado pela clínica. Entre em contato com o administrador.',
              name: 'AuthError',
              status: 403
            } as AuthError
          };
        }
      }

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

  const signInWithGoogle = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] useAuth.signInWithGoogle');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[DEBUG] useAuth.signInWithGoogle catch', error);
      return { error: error as AuthError };
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
}
