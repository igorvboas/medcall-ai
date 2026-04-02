'use client';

import { Layout } from '@/components/shared/Layout';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users, UserCheck } from 'lucide-react';

const tabs = [
  { href: '/administracao', label: 'Dashboard', icon: BarChart3, exact: true },
  { href: '/administracao/acompanhamento-medicos', label: 'Acompanhamento Médicos', icon: Users },
  { href: '/administracao/liberacao-medicos', label: 'Liberação Médicos', icon: UserCheck },
];

export default function AdministracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Layout>
      <div style={{ width: '100%' }}>
        <nav style={{
          display: 'flex',
          gap: '0',
          borderBottom: '2px solid #e5e7eb',
          padding: '0 32px',
          background: '#fff',
        }}
        className="admin-tabs-nav"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#3b82f6' : '#666',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </Layout>
  );
}
