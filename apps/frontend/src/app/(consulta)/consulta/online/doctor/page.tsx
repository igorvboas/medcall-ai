'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MedicalConsultationRoom } from '@/components/livekit/MedicalConsultationRoom';
import { ShareConsultationModal } from '@/components/call/ShareConsultationModal';
import { useState } from 'react';
import '@livekit/components-styles';

function DoctorConsultationContent() {
  const searchParams = useSearchParams();
  const [showShareModal, setShowShareModal] = useState(false);
  
  console.log('🔍 DoctorConsultationContent mounted');
  
  const sessionId = searchParams?.get('sessionId');
  const consultationId = searchParams?.get('consultationId');
  const roomName = searchParams?.get('roomName');
  const doctorToken = searchParams?.get('token');
  const patientName = searchParams?.get('patientName');
  const cameraId = searchParams?.get('cameraId');
  const microphoneId = searchParams?.get('microphoneId');
  const patientToken = searchParams?.get('patientToken');
  const livekitUrl = searchParams?.get('livekitUrl');
  

  // Log removido para evitar spam infinito

  // Validar parâmetros obrigatórios
  if (!sessionId || !consultationId || !doctorToken || !roomName || !patientName) {
    console.log('❌ Missing required parameters:', {
      sessionId: !!sessionId,
      consultationId: !!consultationId,
      doctorToken: !!doctorToken,
      roomName: !!roomName,
      patientName: !!patientName
    });
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

  const handleEndCall = () => {
    // Redirect to consultation summary or dashboard
    window.location.href = '/consulta/nova';
  };

  const handleError = (error: Error) => {
    console.error('Medical consultation error:', error);
    // You could show a toast notification here
  };

  // Log removido para evitar spam infinito

  return (
    <>
      <MedicalConsultationRoom
        roomName={roomName}
        participantName="Dr. Médico"
        userRole="doctor"
        sessionId={sessionId}
        serverUrl={livekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={doctorToken}
        patientName={decodeURIComponent(patientName)}
        videoCaptureDefaults={{
          deviceId: cameraId || undefined
        }}
        audioCaptureDefaults={{
          deviceId: microphoneId || undefined
        }}
        onEndCall={handleEndCall}
        onShareConsultation={() => setShowShareModal(true)}
        onError={handleError}
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
  console.log('🔍 DoctorConsultationPage mounted');
  
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
