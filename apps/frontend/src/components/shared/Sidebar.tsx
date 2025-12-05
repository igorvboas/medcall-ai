'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home,
  FileText,
  MessageCircle,
  Calendar,
  User,
  Settings,
  Plus,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

const menuItems = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: FileText, label: 'Nova Consulta', href: '/consulta/nova' },
  { icon: MessageCircle, label: 'Consultas', href: '/consultas' },
  { icon: Calendar, label: 'Agenda', href: '/agenda' },
  { icon: User, label: 'Pacientes', href: '/pacientes' },
  { icon: Plus, label: 'Cadastrar Paciente', href: '/pacientes/cadastro' },
  { icon: Settings, label: 'Configurações', href: '/configuracoes' },
];

const adminMenuItem = { icon: ShieldCheck, label: 'Admin', href: '/consultas-admin' };

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Verificar se o usuário é admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('admin')
          .eq('user_auth', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar status de admin:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data?.admin === true);
        }
      } catch (err) {
        console.error('Erro ao verificar status de admin:', err);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/signin');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <aside
      className={`sidebar ${expanded ? 'expanded' : ''}`}
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
    >
      <div className="logo">
        <img src="/logo-eva.png" alt="Eva Logo" className="sidebar-logo-image" />
      </div>

      <nav className="nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-btn ${isActive ? 'is-active' : ''}`}>
              <Icon size={20} />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Menu Admin - visível apenas para administradores */}
        {isAdmin && (
          <Link 
            href={adminMenuItem.href} 
            className={`nav-btn nav-btn-admin ${pathname === adminMenuItem.href ? 'is-active' : ''}`}
          >
            <adminMenuItem.icon size={20} />
            <span className="nav-label">{adminMenuItem.label}</span>
          </Link>
        )}
      </nav>

      <div className="bottom">
        <button className="nav-btn" aria-label="Sair" onClick={handleLogout}>
          <LogOut size={20} />
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}