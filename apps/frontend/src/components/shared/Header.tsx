'use client';

import { Search, Bell, User, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Aguarda a hidratação para evitar erro de mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Função para alternar tema de forma segura
  const toggleTheme = () => {
    if (mounted) {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // Função para fazer logout
  const handleLogout = async () => {
    await signOut();
    router.push('/auth/signin');
  };



  return (
    <header className="header">
      <div className="header-content">
        {/* Search */}
        <div className="header-search">
          <div className="search-container">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Encontre pacientes ou funcionalidades do sistema"
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

          {/* Theme Switcher */}
          <button 
            className="theme-toggle-button"
            onClick={toggleTheme}
            title={mounted ? (theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro') : 'Alternar tema'}
          >
            {!mounted ? (
              <Moon className="theme-icon" />
            ) : theme === 'dark' ? (
              <Sun className="theme-icon" />
            ) : (
              <Moon className="theme-icon" />
            )}
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
              <div className="user-avatar">
                <User className="theme-icon" />
              </div>
              <span className="user-name">
                {user?.email?.split('@')[0] || 'Usuário'}
              </span>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-email">{user?.email}</p>
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