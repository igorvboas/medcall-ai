'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { ConsultationRoom } from '@/components/webrtc/ConsultationRoom';
import { ConsentModal } from '@/components/consent/ConsentModal';
import '@/components/webrtc/webrtc-styles.css';

function PatientConsultationContent() {
  const searchParams = useSearchParams();
  const { showWarning } = useNotifications();
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsent, setShowConsent] = useState(true);
  
  // Verificar se já deu consentimento anteriormente (localStorage)
  useEffect(() => {
    const consentKey = `consent_${searchParams?.get('roomId') || 'default'}`;
    const hasConsented = localStorage.getItem(consentKey);
    if (hasConsented === 'true') {
      setConsentGiven(true);
      setShowConsent(false);
    }
  }, [searchParams]);
  
  if (!searchParams) {
    return (
      <div className="error-container">
        <h2>Erro: Parâmetros não encontrados</h2>
        <p>Por favor, acesse através do link correto.</p>
      </div>
    );
  }
  
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

  const handleAcceptConsent = () => {
    // Salvar consentimento no localStorage
    const consentKey = `consent_${roomId}`;
    localStorage.setItem(consentKey, 'true');
    setConsentGiven(true);
    setShowConsent(false);
  };

  const handleRejectConsent = () => {
    showWarning('Você precisa aceitar o termo de consentimento para participar da consulta.', 'Atenção');
    window.location.href = '/';
  };

  // Mostrar modal de consentimento se ainda não foi dado
  if (showConsent && !consentGiven) {
    return (
      <ConsentModal
        onAccept={handleAcceptConsent}
        onReject={handleRejectConsent}
        patientName={patientName || undefined}
      />
    );
  }

  // Mostrar sala de consulta após consentimento
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ConsultationRoom 
        roomId={roomId}
        role={role as 'host' | 'participant'}
        userType="patient"
        patientId={patientId || undefined}
        patientName={patientName || undefined}
        onEndCall={() => {
          window.location.href = '/';
        }}
      />
    </div>
  );
}

export default function PatientConsultationPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #333',
            borderTop: '4px solid #A6CE39',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Carregando consulta...</p>
        </div>
      </div>
    }>
      <PatientConsultationContent />
    </Suspense>
  );
}

