'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
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
  LayoutDashboard,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  isTopMenu?: boolean;
}

const menuItems = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: FileText, label: 'Nova Consulta', href: '/consulta/nova' },
  { icon: LayoutDashboard, label: 'Gestão de Clínica', href: '/clinica/gestao' },
  { icon: MessageCircle, label: 'Consultas', href: '/consultas' },
  { icon: Calendar, label: 'Agenda', href: '/agenda' },
  { icon: User, label: 'Pacientes', href: '/pacientes' },
  { icon: Plus, label: 'Cadastrar Paciente', href: '/pacientes/cadastro' },
  { icon: Settings, label: 'Configurações', href: '/configuracoes' },
];

const adminMenuItems = [
  { icon: Building2, label: 'Administração', href: '/administracao' },
  { icon: ShieldCheck, label: 'Admin Sistema', href: '/consultas-admin' }
];

export function Sidebar({ expanded, onExpandedChange, isTopMenu = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          .select('admin, clinica_admin')
          .eq('user_auth', user.id)
          .maybeSingle();



        if (error) {
          console.error('Erro ao verificar status de admin:', error);
          setIsAdmin(false);
        } else {
          const isSystemAdmin = data?.admin === true;
          const isClinicAdmin = data?.clinica_admin === true;

          // ✅ Verifica tanto admin do sistema quanto admin de clínica
          setIsAdmin(isSystemAdmin || isClinicAdmin);
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

  const handleMouseEnter = () => {
    // Se for menu no topo, não expandir (sempre compacto)
    if (isTopMenu) return;

    // Limpar qualquer timeout pendente
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    onExpandedChange(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Se for menu no topo, não fazer nada
    if (isTopMenu) return;

    const sidebar = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as Node | null;

    // Verificar se o mouse realmente saiu do sidebar
    // Verificar se relatedTarget é um Node válido antes de usar contains
    if (!relatedTarget || !(relatedTarget instanceof Node) || !sidebar.contains(relatedTarget)) {
      // Limpar qualquer timeout anterior
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Pequeno delay para evitar colapsar durante movimentos rápidos
      hoverTimeoutRef.current = setTimeout(() => {
        onExpandedChange(false);
        hoverTimeoutRef.current = null;
      }, 150);
    }
  };

  // Limpar timeout quando componente desmontar
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Garantir que o menu no topo sempre fique compacto (nunca expandido)
  useEffect(() => {
    if (isTopMenu) {
      onExpandedChange(false);
    }
  }, [isTopMenu, onExpandedChange]);

  return (
    <aside
      className={`sidebar ${expanded ? 'expanded' : ''} ${isTopMenu ? 'top-menu' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <nav className="nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-btn ${isActive ? 'is-active' : ''}`}>
              <Icon size={24} />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu Admin - visível apenas para administradores */}
        {isAdmin && adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-btn nav-btn-admin ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={24} />
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="bottom">
        <button className="nav-btn" aria-label="Sair" onClick={handleLogout}>
          <LogOut size={24} />
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}