'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { OnlineCallRoom } from '@/components/call/OnlineCallRoom';
import { ShareConsultationModal } from '@/components/call/ShareConsultationModal';
import { useState } from 'react';

function DoctorConsultationContent() {
  const searchParams = useSearchParams();
  const [showShareModal, setShowShareModal] = useState(false);
  
  const sessionId = searchParams.get('sessionId');
  const consultationId = searchParams.get('consultationId');
  const roomName = searchParams.get('roomName');
  const doctorToken = searchParams.get('token');
  const patientName = searchParams.get('patientName');
  const cameraId = searchParams.get('cameraId');
  const microphoneId = searchParams.get('microphoneId');
  const patientToken = searchParams.get('patientToken');

  // Validar parâmetros obrigatórios
  if (!sessionId || !consultationId || !doctorToken || !roomName || !patientName) {
    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Parâmetros Inválidos</h1>
            <p className="page-subtitle">
              Alguns parâmetros necessários para a consulta não foram fornecidos.
            </p>
          </div>
          <div className="form-card">
            <p>Parâmetros necessários:</p>
            <ul style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              <li>sessionId: {sessionId ? '✅' : '❌'}</li>
              <li>consultationId: {consultationId ? '✅' : '❌'}</li>
              <li>doctorToken: {doctorToken ? '✅' : '❌'}</li>
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

  return (
    <>
      <OnlineCallRoom
        sessionId={sessionId}
        consultationId={consultationId}
        doctorToken={doctorToken}
        patientToken={null} // Médico não precisa do token do paciente
        livekitUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ''}
        roomName={roomName}
        patientName={decodeURIComponent(patientName)}
        userRole="doctor"
        selectedDevices={{
          cameraId: cameraId || null,
          microphoneId: microphoneId || null
        }}
        onShareConsultation={() => setShowShareModal(true)}
      />
      
      {showShareModal && (
        <ShareConsultationModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          patientUrl={`${window.location.origin}/consulta/online/patient?sessionId=${sessionId}&roomName=${roomName}&token=${patientToken}&consultationId=${consultationId}&doctorName=${encodeURIComponent('Dr. Médico')}`}
          sessionId={sessionId}
          patientName={decodeURIComponent(patientName)}
        />
      )}
    </>
  );
}

export default function DoctorConsultationPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Carregando Consulta</h1>
            <p className="page-subtitle">Preparando interface do médico...</p>
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
      <DoctorConsultationContent />
    </Suspense>
  );
}
