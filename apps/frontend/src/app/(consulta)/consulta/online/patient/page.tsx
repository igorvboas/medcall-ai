'use client';

import { useSearchParams } from 'next/navigation';
import { ConsultationRoom } from '@/components/webrtc/ConsultationRoom';
import '@/components/webrtc/webrtc-styles.css';

export default function PatientConsultationPage() {
  const searchParams = useSearchParams();
  
  const roomId = searchParams.get('roomId');
  const role = searchParams.get('role') || 'participant';
  const patientId = searchParams.get('patientId');
  const patientName = searchParams.get('patientName');

  if (!roomId) {
    return (
      <div className="error-container">
        <h2>Erro: ID da sala não encontrado</h2>
        <p>Por favor, acesse através do link correto.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ConsultationRoom 
        roomId={roomId}
        role={role as 'host' | 'participant'}
        patientId={patientId || undefined}
        patientName={patientName || undefined}
        onEndCall={() => {
          window.location.href = '/';
        }}
      />
    </div>
  );
}