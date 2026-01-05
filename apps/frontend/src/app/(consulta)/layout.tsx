'use client';

import { usePathname } from 'next/navigation';
import { Layout } from '@/components/shared/Layout';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Páginas que devem ser renderizadas sem sidebar e header (página limpa)
  const cleanPages = ['/patient', '/finalizada'];
  
  // Se for uma página que deve ser limpa, renderizar sem layout
  if (pathname && cleanPages.some(page => pathname.includes(page))) {
    return children;
  }
  
  // Para todas as outras páginas (incluindo /consulta/online), usar o layout padrão com sidebar e header
  return <Layout>{children}</Layout>;
}
