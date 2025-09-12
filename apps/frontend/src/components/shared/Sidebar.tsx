'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  UserPlus, 
  Users, 
  FileText, 
  Settings, 
  LogOut 
} from 'lucide-react';

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

const menuItems = [
  {
    icon: Home,
    label: 'Home',
    href: '/',
  },
  {
    icon: UserPlus,
    label: 'Nova Consulta',
    href: '/consulta/nova',
  },
  {
    icon: Users,
    label: 'Consultas',
    href: '/consultas',
  },
  {
    icon: FileText,
    label: 'Pacientes',
    href: '/pacientes',
  },
  {
    icon: Settings,
    label: 'Configurações',
    href: '/configuracoes',
  },
];

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={`sidebar ${expanded ? 'expanded' : ''}`}
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-content">
          <div className="sidebar-logo-icon">
            <span>T</span>
          </div>
          {expanded && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">TRIA</span>
              <span className="sidebar-logo-beta">BETA</span>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="sidebar-menu-icon" />
                  {expanded && (
                    <span className="sidebar-menu-label">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-logout">
          <LogOut className="sidebar-menu-icon" />
          {expanded && (
            <span className="sidebar-menu-label">Sair</span>
          )}
        </button>
      </div>
    </div>
  );
}