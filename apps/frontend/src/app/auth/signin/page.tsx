'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu email primeiro para redefinir a senha');
      return;
    }

    try {
      const { resetPassword } = useAuth();
      const { error } = await resetPassword(email);
      
      if (error) {
        setError(error.message);
      } else {
        setError(null);
        alert('Email de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (err) {
      setError('Erro ao enviar email de recuperação');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '0.5rem',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '24rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            margin: '0 auto 0.75rem auto',
            height: '3rem',
            width: '3rem',
            backgroundColor: '#A6CE39',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>T</span>
          </div>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 'bold', 
            color: 'var(--text-primary)',
            margin: '0 0 0.5rem 0'
          }}>
            TRIA
          </h1>
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)',
            margin: '0'
          }}>
            Plataforma de Consultas Médicas com IA
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              textAlign: 'center',
              margin: '0 0 0.5rem 0'
            }}>
              Entrar
            </h2>
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)',
              textAlign: 'center',
              margin: '0 0 1rem 0'
            }}>
              Entre com sua conta para acessar a plataforma TRIA
            </p>
          </div>

          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  fontWeight: '500', 
                  color: 'var(--text-primary)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: '2.5rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.375rem',
                    backgroundColor: 'var(--input-bg)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.75rem', 
                  fontWeight: '500', 
                  color: 'var(--text-primary)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: '2.5rem',
                      padding: '0.5rem 2.5rem 0.5rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.375rem',
                      backgroundColor: 'var(--input-bg)',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? (
                      <EyeOff size={16} style={{ color: 'var(--text-secondary)' }} />
                    ) : (
                      <Eye size={16} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '0.75rem',
                  borderRadius: '0.375rem'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '2.5rem',
                  backgroundColor: loading ? '#9CA3AF' : '#A6CE39',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '1rem'
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                style={{
                  fontSize: '0.875rem',
                  color: '#A6CE39',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                Esqueceu sua senha?
              </button>
            </div>

            <div style={{ 
              position: 'relative', 
              margin: '1.5rem 0',
              textAlign: 'center'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: 'var(--border-color)'
              }}></div>
              <span style={{
                position: 'relative',
                backgroundColor: 'var(--card-bg)',
                padding: '0 1rem',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)'
              }}>
                Ou
              </span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0' }}>
                Não tem uma conta?{' '}
                <Link
                  href="/auth/signup"
                  style={{
                    fontWeight: '500',
                    color: '#A6CE39',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                  Criar conta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
