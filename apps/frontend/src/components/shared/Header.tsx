'use client';

import { Search, Bell, User, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
            <button className="user-button">
              <div className="user-avatar">
                <User className="theme-icon" />
              </div>
              <span className="user-name">Light</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}