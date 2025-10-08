'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './LoadingScreen.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Carregando...' }: LoadingScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const content = (
    <div className="loading-screen" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999
    }}>
      <div className="loading-screen-content">
        <div className="loading-screen-gif-container">
          <Image
            src="/loading.gif"
            alt="Carregando"
            width={300}
            height={300}
            unoptimized
            priority
            className="loading-screen-gif"
          />
        </div>
        <p className="loading-screen-text">{message}</p>
      </div>
    </div>
  );

  // Renderiza usando portal para garantir que fica fora de qualquer container
  if (!mounted) return content;
  return createPortal(content, document.body);
}

