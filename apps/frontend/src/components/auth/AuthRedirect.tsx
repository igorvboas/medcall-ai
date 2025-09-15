'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AuthRedirectProps {
  redirectTo?: string;
  fallbackTo?: string;
}

export function AuthRedirect({ redirectTo = '/dashboard', fallbackTo = '/landing' }: AuthRedirectProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(redirectTo);
      } else {
        router.push(fallbackTo);
      }
    }
  }, [user, loading, router, redirectTo, fallbackTo]);

  // Mostrar loading enquanto verifica autenticação
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
}
