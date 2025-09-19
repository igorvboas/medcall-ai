'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MedicalConsultationRoom } from '@/components/livekit/MedicalConsultationRoom';
import '@livekit/components-styles';

function OnlineConsultationContent() {
  const searchParams = useSearchParams();
  
  const sessionId = searchParams.get('sessionId');
  const consultationId = searchParams.get('consultationId');
  const doctorToken = searchParams.get('doctorToken');
  const patientToken = searchParams.get('patientToken');
  const livekitUrl = searchParams.get('livekitUrl');
  const roomName = searchParams.get('roomName');
  const patientName = searchParams.get('patientName');

  // Validar parâmetros obrigatórios
  if (!sessionId || !consultationId || !doctorToken || !livekitUrl || !roomName || !patientName) {
    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Parâmetros Inválidos</h1>
            <p className="page-subtitle">
              Alguns parâmetros necessários para a consulta online não foram fornecidos.
            </p>
          </div>
          <div className="form-card">
            <p>Parâmetros necessários:</p>
            <ul style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              <li>sessionId: {sessionId ? '✅' : '❌'}</li>
              <li>consultationId: {consultationId ? '✅' : '❌'}</li>
              <li>doctorToken: {doctorToken ? '✅' : '❌'}</li>
              <li>livekitUrl: {livekitUrl ? '✅' : '❌'}</li>
              <li>roomName: {roomName ? '✅' : '❌'}</li>
              <li>patientName: {patientName ? '✅' : '❌'}</li>
            </ul>
            <div className="form-actions">
              <button 
                onClick={() => window.location.href = '/consulta/nova'}
                className="btn btn-primary"
              >
                Voltar para Nova Consulta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEndCall = () => {
    window.location.href = '/consulta/nova';
  };

  const handleError = (error: Error) => {
    console.error('Online consultation error:', error);
  };

  // Determine user role based on available tokens
  const userRole = doctorToken ? 'doctor' : 'patient';
  const token = doctorToken || patientToken;

  return (
    <MedicalConsultationRoom
      roomName={roomName}
      participantName={userRole === 'doctor' ? 'Dr. Médico' : 'Paciente'}
      userRole={userRole}
      sessionId={sessionId}
      serverUrl={livekitUrl}
      token={token}
      patientName={decodeURIComponent(patientName)}
      onEndCall={handleEndCall}
      onError={handleError}
    />
  );
}

export default function OnlineConsultationPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Carregando Consulta Online</h1>
            <p className="page-subtitle">Preparando a videochamada...</p>
          </div>
          <div className="form-card">
            <div className="loading-indicator">
              <div className="loading-icon" />
              <span>Conectando ao LiveKit...</span>
            </div>
          </div>
        </div>
      </div>
    }>
      <OnlineConsultationContent />
    </Suspense>
  );
}
