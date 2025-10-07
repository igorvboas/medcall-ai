'use client';

import { Search, Bell, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const isDashboard = pathname === '/dashboard';

  // Extrair dados do usuário diretamente do useAuth
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const email = user?.email || '';

  // Função para fazer logout
  const handleLogout = async () => {
    await signOut();
    router.push('/auth/signin');
  };



  return (
    <header className="header main-header">
      <div className="header-content main-header-content">
        {/* Search sempre visível */}
        <div className="header-search">
          <div className="search-container">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Pesquisar"
              className="search-input"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="header-actions">
          {/* Help */}
          <button className="today-button">
            Hoje
          </button>


          {/* Notifications */}
          <button className="notification-button">
            <Bell className="notification-icon" />
            <span className="notification-badge"></span>
          </button>

          {/* User Menu */}
          <div className="user-menu">
            <button 
              className="user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-info-header">
                <div className="user-name-email">
                  <span className="user-full-name">
                    {loading ? 'Carregando...' : displayName}
                  </span>
                  <span className="user-email-header">
                    {loading ? 'Carregando...' : email}
                  </span>
                </div>
                <div className="user-avatar">
                  {displayName && displayName !== 'Usuário' && displayName !== 'Carregando...' ? (
                    <div className="user-initials">
                      {displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  ) : (
                    <User className="theme-icon" />
                  )}
                </div>
                <ChevronDown className="dropdown-icon" />
              </div>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-email">{email}</p>
                </div>
                <button 
                  className="logout-button"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}