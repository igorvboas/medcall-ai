'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AnamnesePersonalizadaContent() {
  const searchParams = useSearchParams();
  const pacienteId = searchParams.get('paciente_id');

  // Construir URL do Typebot com query params se existirem
  const typebotUrl = pacienteId 
    ? `https://funnel.insiderhub.com.br/anamnese-personalizada?paciente_id=${pacienteId}`
    : 'https://funnel.insiderhub.com.br/anamnese-personalizada';

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <iframe
        src={typebotUrl}
        style={{ border: 'none', width: '100%', height: '100%' }}
        title="Typebot - Anamnese Personalizada"
        allow="microphone; camera"
      />
    </div>
  );
}

export default function AnamnesePersonalizadaPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AnamnesePersonalizadaContent />
    </Suspense>
  );
}

