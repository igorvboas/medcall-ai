'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FileText,
  MessageCircle,
  Calendar,
  User,
  Settings,
  Plus,
  LogOut,
} from 'lucide-react';

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

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();

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
      </nav>

      <div className="bottom">
        <button className="nav-btn" aria-label="Sair">
          <LogOut size={20} />
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}