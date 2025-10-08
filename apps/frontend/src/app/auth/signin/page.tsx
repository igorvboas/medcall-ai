'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import './signin.css';

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


  if (authLoading) {
    return <LoadingScreen message="Carregando..." />;
  }

  return (
    <div className="signin-page">
      <div className="signin-container">
        {/* Logo Section */}
        <div className="signin-logo-section">
          <div className="signin-logo-wrapper">
            <Image
              src="/logo-eva.png"
              alt="TRIA Logo"
              width={48}
              height={48}
              className="signin-logo-image"
              priority
            />
          </div>
        </div>

        {/* Sign In Card */}
        <div className="signin-card">
          <div className="signin-header">
            <h2 className="signin-title">Entrar</h2>
            <p className="signin-subtitle">
              Entre com sua conta para acessar a plataforma
            </p>
          </div>

          <div className="signin-form-wrapper">
            <form onSubmit={handleSubmit} className="signin-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
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
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Senha
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    required
                    disabled={loading}
                    className="form-input password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="forgot-password-wrapper">
              <Link href="/auth/forgot-password" className="forgot-password-btn">
                Esqueceu sua senha?
              </Link>
            </div>

            <div className="divider-wrapper">
              <div className="divider-line"></div>
              <span className="divider-text">Ou</span>
            </div>

            <div className="signup-link-wrapper">
              <p className="signup-text">
                Não tem uma conta?{' '}
                <Link href="/auth/signup" className="signup-link">
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
