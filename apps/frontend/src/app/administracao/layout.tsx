'use client';

import { Layout } from '@/components/shared/Layout';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Users, UserCheck } from 'lucide-react';

const tabs = [
  { label: 'Dashboard', href: '/administracao', icon: BarChart3 },
  { label: 'Acompanhamento Médicos', href: '/administracao/acompanhamento-medicos', icon: Users },
  { label: 'Liberação Médicos', href: '/administracao/liberacao-medicos', icon: UserCheck },
];

export default function AdministracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Layout>
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 32px',
        display: 'flex',
        gap: '0',
      }}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.href ||
            (tab.href !== '/administracao' && pathname.startsWith(tab.href));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#2563eb' : '#6b7280',
                textDecoration: 'none',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={18} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </Layout>
  );
}
