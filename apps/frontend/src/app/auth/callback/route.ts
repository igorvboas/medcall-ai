import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Se houver erro do provider OAuth
  if (error) {
    console.error('[AUTH CALLBACK] OAuth error:', error, error_description);
    const failUrl = new URL('/fail', origin);
    failUrl.searchParams.set('error', error);
    if (error_description) {
      failUrl.searchParams.set('message', error_description);
    }
    return NextResponse.redirect(failUrl);
  }

  // Se não houver código de autorização
  if (!code) {
    console.error('[AUTH CALLBACK] No code provided');
    const failUrl = new URL('/fail', origin);
    failUrl.searchParams.set('error', 'no_code');
    failUrl.searchParams.set('message', 'Código de autorização não fornecido');
    return NextResponse.redirect(failUrl);
  }

  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Trocar o código por uma sessão
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError);
      const failUrl = new URL('/fail', origin);
      failUrl.searchParams.set('error', 'exchange_failed');
      failUrl.searchParams.set('message', exchangeError.message);
      return NextResponse.redirect(failUrl);
    }

    // Sucesso! Redirecionar para o dashboard
    console.log('[AUTH CALLBACK] Success! Redirecting to dashboard');
    return NextResponse.redirect(new URL('/dashboard', origin));

  } catch (err) {
    console.error('[AUTH CALLBACK] Unexpected error:', err);
    const failUrl = new URL('/fail', origin);
    failUrl.searchParams.set('error', 'unexpected');
    failUrl.searchParams.set('message', 'Erro inesperado durante a autenticação');
    return NextResponse.redirect(failUrl);
  }
}

