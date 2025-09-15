'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PresentialCallRoom } from '@/components/call/PresentialCallRoom';

function PresentialConsultationContent() {
  const searchParams = useSearchParams();
  
  const sessionId = searchParams.get('sessionId');
  const consultationId = searchParams.get('consultationId');
  const doctorMicId = searchParams.get('doctorMicId');
  const patientMicId = searchParams.get('patientMicId');
  const patientName = searchParams.get('patientName');

  // Validar parâmetros obrigatórios
  if (!sessionId || !consultationId || !doctorMicId || !patientMicId || !patientName) {
    return (
      <div className="error-page">
        <h1>Parâmetros Inválidos</h1>
        <p>Alguns parâmetros necessários para a consulta não foram fornecidos.</p>
        <p>Por favor, inicie uma nova consulta a partir da página de configuração.</p>
      </div>
    );
  }

  return (
    <PresentialCallRoom
      sessionId={sessionId}
      consultationId={consultationId}
      doctorMicId={doctorMicId}
      patientMicId={patientMicId}
      patientName={decodeURIComponent(patientName)}
    />
  );
}

export default function PresentialConsultationPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="loading-spinner" />
        <p>Carregando consulta presencial...</p>
      </div>
    }>
      <PresentialConsultationContent />
    </Suspense>
  );
}
