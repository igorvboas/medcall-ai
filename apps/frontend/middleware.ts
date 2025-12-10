import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // ✅ Pular verificação de auth para assets e APIs públicas
  const { pathname } = req.nextUrl;
  const publicPaths = ['/auth', '/', '/api/public', '/fail', '/anamnese-inicial'];
  if (publicPaths.some(path => pathname.startsWith(path) || pathname === '/')) {
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            req.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            req.cookies.set({
              name,
              value: '',
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // ✅ Adicionar timeout de 5 segundos
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    const { data: { session } } = await Promise.race([
      sessionPromise,
      timeoutPromise
    ]) as any;

    // Rotas que precisam de autenticação
    const protectedRoutes = ['/dashboard', '/call', '/consulta', '/pacientes'];
    const protectedApiRoutes = ['/api/patients'];
    const authRoutes = ['/auth/signin', '/auth/signup'];

    // Se não há sessão e está tentando acessar rota protegida
    if (!session && protectedRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    // Se não há sessão e está tentando acessar API protegida
    if (!session && protectedApiRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Se há sessão e está tentando acessar página de auth, redirecionar para dashboard
    if (session && authRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return response;
  } catch (error) {
    console.error('[MIDDLEWARE] Erro ao verificar sessão:', error);
    // Em caso de erro, permitir acesso (fail-open para evitar travar o app)
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.svg (favicon and logo files)
     * - public assets (.js, .css, .png, .jpg, etc)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|logo.svg|.*\\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
