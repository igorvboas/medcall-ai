'use client';

import { Search, Bell, User, LogOut, ChevronDown, Moon, Sun, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [medicoData, setMedicoData] = useState<any>(null);
  const [loadingMedico, setLoadingMedico] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Extrair dados do usuário diretamente do useAuth
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const email = user?.email || '';

  // Aguarda a hidratação para evitar erro de mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Buscar dados do médico
  useEffect(() => {
    const fetchMedicoData = async () => {
      if (!user?.id) {
        setLoadingMedico(false);
        return;
      }

      try {
        // Buscar usando user_auth (FK para auth.users)
        const { data, error } = await supabase
          .from('medicos')
          .select('name, profile_pic')
          .eq('user_auth', user.id)
          .maybeSingle();

        if (error) {
          console.error('Header: Erro ao buscar dados do médico:', error);
        } else if (data) {
          setMedicoData(data);
        }
        // Se não houver dados, simplesmente não define nada (usa fallback)
      } catch (err) {
        console.error('Header: Erro ao buscar dados do médico:', err);
      } finally {
        setLoadingMedico(false);
      }
    };

    fetchMedicoData();
  }, [user?.id]);

  // Função para alternar tema
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

  // Função para ir para configurações
  const handleGoToSettings = () => {
    setShowUserMenu(false);
    router.push('/configuracoes');
  };



  return (
    <header className="header main-header">
      <div className="header-content main-header-content">


        {/* Right Side Actions */}
        <div className="header-actions">

          {/* Theme Toggle */}
          <button 
            className="theme-toggle-button"
            onClick={toggleTheme}
            title={mounted ? (theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro') : 'Alternar tema'}
            aria-label="Alternar tema"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="theme-icon" />
            ) : (
              <Moon className="theme-icon" />
            )}
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
                  {(() => {
                    if (medicoData?.profile_pic) {
                      return (
                        <Image
                          src={medicoData.profile_pic}
                          alt="Foto de perfil"
                          width={40}
                          height={40}
                          className="user-profile-image"
                          style={{
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                          unoptimized
                        />
                      );
                    } else if (displayName && displayName !== 'Usuário' && displayName !== 'Carregando...') {
                      return (
                        <div className="user-initials">
                          {displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      );
                    } else {
                      return <User className="theme-icon" />;
                    }
                  })()}
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
                  className="dropdown-item-button"
                  onClick={handleGoToSettings}
                >
                  <Settings className="w-4 h-4" />
                  Configurações
                </button>
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