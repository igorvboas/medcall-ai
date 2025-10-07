'use client';

import { usePathname } from 'next/navigation';
import { Layout } from '@/components/shared/Layout';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Se for a página do paciente, renderizar sem sidebar e header
  if (pathname?.includes('/patient')) {
    return children;
  }
  
  // Para todas as outras páginas, usar o layout padrão com sidebar e header
  return <Layout>{children}</Layout>;
}
