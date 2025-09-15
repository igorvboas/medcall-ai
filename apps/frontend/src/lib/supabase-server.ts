import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Carregar variáveis de ambiente explicitamente
import { config } from 'dotenv';
config({ path: '.env.local' });

// Cliente Supabase para server-side (API routes)
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// Função helper para obter sessão autenticada
export async function getAuthenticatedSession() {
  const supabase = createSupabaseServerClient();
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return null;
  }
  
  return { supabase, session };
}
