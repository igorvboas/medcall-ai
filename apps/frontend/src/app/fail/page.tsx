'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import './fail.css';

function FailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'unknown';
  const message = searchParams.get('message') || 'Ocorreu um erro durante a autenticação';
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determinar qual tema está ativo (considerando systemTheme)
  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const logoSrc = currentTheme === 'dark' ? '/logo-white.svg' : '/logo-black.svg';

  // Mapear códigos de erro para mensagens amigáveis
  const getErrorTitle = (errorCode: string) => {
    const errorTitles: Record<string, string> = {
      'access_denied': 'Acesso Negado',
      'no_code': 'Código Inválido',
      'exchange_failed': 'Falha na Autenticação',
      'unexpected': 'Erro Inesperado',
      'unknown': 'Erro de Autenticação',
    };
    return errorTitles[errorCode] || 'Erro de Autenticação';
  };

  const getErrorDescription = (errorCode: string, customMessage: string) => {
    const errorDescriptions: Record<string, string> = {
      'access_denied': 'Você cancelou o processo de login ou não autorizou o acesso.',
      'no_code': 'O código de autorização não foi fornecido. Por favor, tente novamente.',
      'exchange_failed': 'Não foi possível completar a autenticação. Por favor, tente novamente.',
      'unexpected': 'Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.',
    };
    return errorDescriptions[errorCode] || customMessage;
  };

  return (
    <div className="fail-page">
      <div className="fail-container">
        {/* Logo Section */}
        <div className="fail-logo-section">
          <div className="fail-logo-wrapper">
            <Image
              src={logoSrc}
              alt="TRIA Logo"
              width={48}
              height={48}
              className="fail-logo-image"
              priority
            />
          </div>
        </div>

        {/* Error Card */}
        <div className="fail-card">
          <div className="fail-icon-wrapper">
            <svg 
              className="fail-icon" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="fail-title">{getErrorTitle(error)}</h1>
          <p className="fail-description">{getErrorDescription(error, message)}</p>

          <div className="fail-actions">
            <Link href="/auth/signin" className="fail-button-primary">
              Tentar Novamente
            </Link>
            <Link href="/" className="fail-button-secondary">
              Voltar ao Início
            </Link>
          </div>

          {/* Error code for debugging */}
          <p className="fail-error-code">
            Código do erro: {error}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="fail-page">
        <div className="fail-container">
          <div className="fail-loading">Carregando...</div>
        </div>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}

