'use client';

import { Search, Bell, User, LogOut, ChevronDown, Moon, Sun, Settings, GraduationCap, RotateCcw, PlayCircle, X } from 'lucide-react';
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
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);


  // Extrair dados do usuário diretamente do useAuth
  const email = user?.email || '';
  // Usar o nome do médico da tabela medicos quando disponível, caso contrário usar metadata ou email
  const displayName = medicoData?.name || user?.user_metadata?.name || email?.split('@')[0] || 'Usuário';

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

  // Tutorial: reiniciar
  const handleRestartTutorial = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('auton_tutorial_done_'));
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('auton_tutorial_active', 'true');
    setShowHelpDropdown(false);
    window.dispatchEvent(new CustomEvent('tutorial-restart'));
  };

  // Tutorial: titulo da pagina para o modal de video
  const PAGE_VIDEO_MAP: Record<string, { title: string; url: string }> = {
    '/dashboard': { title: 'Home', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=64ac31ae-3355-46fd-b793-f32e0f30bc38' },
    '/consultas': { title: 'Análise de Consultas', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=57f89471-a9e7-41b1-89a4-a256a4b14d19' },
    '/agenda': { title: 'Home', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=64ac31ae-3355-46fd-b793-f32e0f30bc38' },
    '/pacientes': { title: 'Como cadastrar e gerenciar seus pacientes', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=373a51cc-5775-4b5d-ac8b-66229822a978' },
    '/consulta/nova': { title: 'Como criar uma consulta online', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=904afd55-a7ec-4d45-bd99-dd5a3a0941e8' },
    '/configuracoes': { title: 'Configurações', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=768c5ec4-96d0-416d-9ddd-9f1c20936056' },
    '/cadastro': { title: 'Cadastro', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=4989a010-2833-43ea-96ec-4f03c8dadae6' },
    '/treinamento': { title: 'Boas vindas à plataforma', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=a383051d-1155-49bd-81d0-66d560ee5a1e' },
  };

  const getPageVideo = () => {
    // Tentar match exato, depois por prefixo
    if (PAGE_VIDEO_MAP[pathname]) return PAGE_VIDEO_MAP[pathname];
    const prefix = Object.keys(PAGE_VIDEO_MAP).find(k => pathname.startsWith(k) && k !== '/');
    if (prefix) return PAGE_VIDEO_MAP[prefix];
    return { title: 'Boas vindas à plataforma', url: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=a383051d-1155-49bd-81d0-66d560ee5a1e' };
  };

  const getPageTitle = () => {
    return getPageVideo().title;
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!showHelpDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tutorial-help-dropdown') && !target.closest('.tutorial-restart-btn')) {
        setShowHelpDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHelpDropdown]);

  // Função para ir para configurações
  const handleGoToSettings = () => {
    setShowUserMenu(false);
    router.push('/configuracoes');
  };



  return (
    <>
      <header className="header main-header">
        <div className="header-content main-header-content">

          {/* Homolog Badge */}
          {process.env.NEXT_PUBLIC_ENV === 'homolog' && (
            <span style={{
              background: '#dc2626',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}>
              HOMOLOG
            </span>
          )}

          {/* Right Side Actions */}
          <div className="header-actions">

          {/* Tutorial Help Button */}
          <div style={{ position: 'relative' }} ref={(el) => { if (el) (window as any).__tutorialBtnRef = el; }}>
            <button
              className="tutorial-restart-btn dark-mode-toggle-btn"
              onClick={() => setShowHelpDropdown(!showHelpDropdown)}
              title="Central de Ajuda"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10,
                background: '#1B4266', border: 'none', cursor: 'pointer',
                color: '#fff', transition: 'all 0.2s',
              }}
            >
              <GraduationCap size={18} />
            </button>
            {showHelpDropdown && (() => {
              const btnEl = (window as any).__tutorialBtnRef as HTMLElement | undefined;
              const btnRect = btnEl?.getBoundingClientRect();
              const dropdownTop = btnRect ? btnRect.bottom + 8 : 72;
              const dropdownRight = btnRect ? window.innerWidth - btnRect.right : 16;
              return (
              <div className="tutorial-help-dropdown" style={{
                position: 'fixed', top: dropdownTop, right: dropdownRight,
                background: 'var(--card-bg, #fff)', borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: '1px solid var(--border-color, #E2E8F0)',
                minWidth: 220, zIndex: 100001, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color, #E2E8F0)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Central de Ajuda</span>
                </div>
                <button onClick={handleRestartTutorial} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 14, color: 'var(--text-primary, #0F172A)',
                  fontFamily: 'inherit', transition: 'background 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #F1F5F9)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <RotateCcw size={16} style={{ color: '#1B4266' }} /> Reiniciar Tutorial
                </button>
                <button onClick={() => { setShowVideoModal(true); setShowHelpDropdown(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 14, color: 'var(--text-primary, #0F172A)',
                  fontFamily: 'inherit', transition: 'background 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #F1F5F9)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <PlayCircle size={16} style={{ color: '#1B4266' }} /> Assistir Aula
                </button>
              </div>
              );
            })()}
          </div>

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

      {/* Modal de Video */}
      {showVideoModal && (
        <div onClick={() => setShowVideoModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card-bg, #fff)', borderRadius: 16,
            width: '90vw', maxWidth: 960, maxHeight: '90vh',
            overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid var(--border-color, #E2E8F0)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EBF3F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayCircle size={20} style={{ color: '#1B4266' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>{getPageTitle()}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>Aprenda a utilizar esta tela</div>
                </div>
              </div>
              <button onClick={() => setShowVideoModal(false)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'var(--hover-bg, #F1F5F9)', cursor: 'pointer',
                color: 'var(--text-secondary, #64748B)',
              }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                src={getPageVideo().url}
                title={getPageVideo().title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}