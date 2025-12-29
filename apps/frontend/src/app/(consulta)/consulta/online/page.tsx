'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnlineConsultationPage() {
  const router = useRouter();

  useEffect(() => {
    // Esta página antiga não é mais usada - redirecionar para nova consulta
    router.push('/consulta/nova');
  }, [router]);

    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
          <h1 className="page-title">Redirecionando...</h1>
            <p className="page-subtitle">
            Esta página não está mais disponível. Redirecionando para nova consulta...
            </p>
          </div>
        </div>
      </div>
  );
}
