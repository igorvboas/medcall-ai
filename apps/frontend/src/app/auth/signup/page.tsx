'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import './signup.css';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ NOVO: Estado para tipo de conta
  const [accountType, setAccountType] = useState<'doctor' | 'clinic'>('doctor');


  const { signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
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
    setMessage(null);

    if (!name.trim()) {
      setError('Por favor, informe seu nome');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // ✅ Passando accountType (role) para o signUp
      const { error } = await signUp(email, password, name.trim(), accountType);

      if (error) {
        setError(error.message);
      } else {
        setMessage('Verifique seu email para confirmar sua conta!');
        // Opcional: redirecionar para uma página de confirmação
        setTimeout(() => {
          router.push('/auth/signin');
        }, 3000);
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
      // Se não houver erro, o usuário será redirecionado automaticamente
    } catch (err) {
      setError('Erro ao conectar com Google. Tente novamente.');
      setGoogleLoading(false);
    }
  };

  if (authLoading) {
    return <LoadingScreen message="Carregando..." />;
  }

  return (
    <div className="signup-page">
      <div className="signup-container">
        {/* Logo Section */}
        <div className="signup-logo-section">
          <div className="signup-logo-wrapper">
            <Image
              src="/logo-eva.png"
              alt="TRIA Logo"
              width={48}
              height={48}
              className="signup-logo-image"
              priority
            />
          </div>
        </div>

        {/* Sign Up Card */}
        <div className="signup-card">
          <div className="signup-header">
            <h2 className="signup-title">Criar Conta</h2>
            <p className="signup-subtitle">
              Crie sua conta para acessar a plataforma
            </p>
          </div>

          <div className="signup-form-wrapper">

            {/* Seletor de Tipo de Conta */}
            <div className="account-type-selector">
              <button
                type="button"
                onClick={() => setAccountType('doctor')}
                className={`account-type-button ${accountType === 'doctor' ? 'active' : ''}`}
              >
                Médico Independente
              </button>
              <button
                type="button"
                onClick={() => setAccountType('clinic')}
                className={`account-type-button ${accountType === 'clinic' ? 'active' : ''}`}
              >
                Clínica
              </button>
            </div>

            <form onSubmit={handleSubmit} className="signup-form">
              {/* Mensagem explicativa dinâmica */}
              <div className="account-type-message">
                {accountType === 'doctor'
                  ? 'Você está criando uma conta para atendimento médico individual.'
                  : 'Você está criando uma conta administrativa para sua clínica.'}
              </div>

              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Nome Completo
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  disabled={loading}
                  className="form-input"
                />
              </div>

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
                    placeholder="Mínimo 6 caracteres"
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

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirmar Senha
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha novamente"
                    required
                    disabled={loading}
                    className="form-input password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle-btn"
                    aria-label={showConfirmPassword ? 'Ocultar senha de confirmação' : 'Mostrar senha de confirmação'}
                  >
                    {showConfirmPassword ? (
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

              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </button>
            </form>

            <div className="divider-wrapper">
              <div className="divider-line"></div>
              <span className="divider-text">Ou</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || loading}
              className="google-button"
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? 'Conectando...' : 'Continuar com Google'}
            </button>

            <div className="signin-link-wrapper">
              <p className="signin-text">
                Já tem uma conta?{' '}
                <Link href="/auth/signin" className="signin-link">
                  Faça login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
