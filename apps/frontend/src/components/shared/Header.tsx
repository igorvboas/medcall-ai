'use client';

import { Search, Bell, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [medicoData, setMedicoData] = useState<any>(null);
  const [loadingMedico, setLoadingMedico] = useState(true);

  // Extrair dados do usuário diretamente do useAuth
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const email = user?.email || '';

  // Buscar dados do médico
  useEffect(() => {
    const fetchMedicoData = async () => {
      if (!user?.id) {
        console.log('Header: Usuário não encontrado');
        setLoadingMedico(false);
        return;
      }

      console.log('Header: Buscando dados do médico para user.id:', user.id);

      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('name, profile_pic')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Header: Erro ao buscar dados do médico:', error);
          // Tentar buscar por email se o ID não funcionar
          const { data: dataByEmail, error: errorByEmail } = await supabase
            .from('medicos')
            .select('name, profile_pic')
            .eq('email', user.email)
            .single();
          
          if (errorByEmail) {
            console.error('Header: Erro ao buscar por email também:', errorByEmail);
          } else {
            console.log('Header: Dados encontrados por email:', dataByEmail);
            setMedicoData(dataByEmail);
          }
        } else {
          console.log('Header: Dados do médico encontrados:', data);
          setMedicoData(data);
        }
      } catch (err) {
        console.error('Header: Erro ao buscar dados do médico:', err);
      } finally {
        setLoadingMedico(false);
      }
    };

    fetchMedicoData();
  }, [user?.id, user?.email]);

  // Função para fazer logout
  const handleLogout = async () => {
    await signOut();
    router.push('/auth/signin');
  };



  return (
    <header className="header main-header">
      <div className="header-content main-header-content">


        {/* Right Side Actions */}
        <div className="header-actions">

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
                  {(() => {
                    console.log('Header: Renderizando avatar - medicoData:', medicoData);
                    console.log('Header: profile_pic:', medicoData?.profile_pic);
                    
                    if (medicoData?.profile_pic) {
                      console.log('Header: Mostrando imagem de perfil');
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
                      console.log('Header: Mostrando iniciais');
                      return (
                        <div className="user-initials">
                          {displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      );
                    } else {
                      console.log('Header: Mostrando ícone de usuário');
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