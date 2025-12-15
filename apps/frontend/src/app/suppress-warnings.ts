'use client';

import { useEffect } from 'react';

// Componente para suprimir warnings de hydration causados por extensões do navegador
export function SuppressHydrationWarnings() {
  useEffect(() => {
    const originalError = console.error;
    
    console.error = (...args) => {
      const message = args[0]?.toString() || '';
      
      // Ignorar warnings de atributos adicionados por extensões do navegador
      if (
        message.includes('bis_skin_checked') ||
        message.includes('Extra attributes from the server')
      ) {
        return;
      }
      
      originalError.apply(console, args);
    };
    
    return () => {
      console.error = originalError;
    };
  }, []);
  
  return null;
}

