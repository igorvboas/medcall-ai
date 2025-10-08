'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LoadingScreen } from './LoadingScreen';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se não está carregando autenticação
    if (!authLoading) {
      // Se não tem usuário, redireciona para login
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      
      // Simula um pequeno delay para garantir que tudo está carregado
      const timer = setTimeout(() => {
        setIsLayoutReady(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router]);

  // Mostra loading enquanto verifica autenticação ou carrega layout
  if (authLoading || !isLayoutReady || !user) {
    return <LoadingScreen message="Carregando..." />;
  }

  return (
    <div className="layout">
      <Sidebar 
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
      />
      
      <div className={`main-content ${sidebarExpanded ? 'expanded' : ''}`}>
        <Header />
        
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}