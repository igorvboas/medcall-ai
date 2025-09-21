'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SimpleLiveKitRoom } from '@/components/livekit/SimpleLiveKitRoom';

function NovaOnlineTestPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Extrair parâmetros da URL
  const sessionId = searchParams?.get('sessionId');
  const consultationId = searchParams?.get('consultationId');
  const roomName = searchParams?.get('roomName');
  const doctorToken = searchParams?.get('token');
  const patientToken = searchParams?.get('patientToken');
  const livekitUrl = searchParams?.get('livekitUrl');
  const patientName = searchParams?.get('patientName');
  const cameraId = searchParams?.get('cameraId');
  const microphoneId = searchParams?.get('microphoneId');
  const isTest = searchParams?.get('isTest') === 'true';

  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Debug: Log all parameters
  useEffect(() => {
    const params = {
      sessionId,
      consultationId,
      roomName,
      token: doctorToken ? `${doctorToken.substring(0, 30)}...` : null,
      patientToken: patientToken ? `${patientToken.substring(0, 30)}...` : null,
      livekitUrl,
      patientName,
      cameraId,
      microphoneId,
      isTest
    };
    
    console.log('🔍 TESTE LIVEKIT - Parâmetros recebidos:', params);
    setDebugInfo(params);
  }, [sessionId, consultationId, roomName, doctorToken, patientToken, livekitUrl, patientName, cameraId, microphoneId, isTest]);

  // Handlers
  const handleEndCall = () => {
    console.log('📞 Chamada finalizada');
    router.push('/testing-livekit');
  };

  const handleShareConsultation = () => {
    const shareUrl = `${window.location.origin}/testing-livekit/nova-online?${searchParams?.toString() || ''}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Link copiado para área de transferência!');
  };

  const handleError = (error: Error) => {
    console.error('❌ Erro na chamada:', error);
    alert(`Erro: ${error.message}`);
  };

  // Validar parâmetros obrigatórios
  if (!sessionId || !roomName || !doctorToken || !livekitUrl || !patientName) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1a1a1a',
        color: 'white',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '600px',
          background: '#2a2a2a',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #f56565'
        }}>
          <h2 style={{ color: '#f56565', marginBottom: '1rem' }}>
            ❌ Parâmetros Inválidos
          </h2>
          <p style={{ color: '#a0aec0', marginBottom: '1rem' }}>
            Alguns parâmetros obrigatórios estão faltando:
          </p>
          <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
            <p>• Session ID: {sessionId ? '✅' : '❌'}</p>
            <p>• Room Name: {roomName ? '✅' : '❌'}</p>
            <p>• Doctor Token: {doctorToken ? '✅' : '❌'}</p>
            <p>• LiveKit URL: {livekitUrl ? '✅' : '❌'}</p>
            <p>• Patient Name: {patientName ? '✅' : '❌'}</p>
          </div>
          <button
            onClick={() => router.push('/testing-livekit')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#a6ce39',
              color: 'black',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Voltar ao Teste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* Debug Panel */}
      {showDebug && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          width: '300px',
          maxHeight: '400px',
          background: '#2a2a2a',
          border: '1px solid #4a5568',
          borderRadius: '8px',
          padding: '1rem',
          zIndex: 1000,
          fontSize: '0.8rem',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#ffc107' }}>🔧 Debug Info</h4>
            <button
              onClick={() => setShowDebug(false)}
              style={{
                background: '#f56565',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.7rem'
              }}
            >
              ✕
            </button>
          </div>
          <pre style={{ margin: 0, color: '#a0aec0', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* Toggle Debug Button */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          zIndex: 1001,
          padding: '0.5rem',
          background: '#4a5568',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.8rem'
        }}
      >
        🔧 Debug
      </button>

      {/* LiveKit Component */}
      <SimpleLiveKitRoom
        roomName={roomName}
        participantName="Dr. Teste"
        userRole="doctor"
        sessionId={sessionId}
        serverUrl={livekitUrl}
        token={doctorToken}
        patientName={patientName}
        onEndCall={handleEndCall}
        onError={handleError}
      />

      {/* Test Banner */}
      {isTest && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          background: '#ffc107',
          color: 'black',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '600',
          zIndex: 1001
        }}>
          🧪 MODO TESTE
        </div>
      )}
    </div>
  );
}

export default function NovaOnlineTestPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #4a5568',
            borderTop: '3px solid #a6ce39',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Carregando página de teste...</p>
        </div>
      </div>
    }>
      <NovaOnlineTestPageContent />
    </Suspense>
  );
}
