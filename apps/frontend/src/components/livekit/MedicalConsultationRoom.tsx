'use client';

import React, { useState, useEffect } from 'react';
import { 
  LiveKitRoom, 
  VideoConference,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react'; 
import { TranscriptionDisplay } from './TranscriptionDisplay';

interface MedicalConsultationRoomProps {
  // Room configuration
  roomName: string;
  participantName: string;
  userRole?: 'doctor' | 'patient';
  sessionId: string;
  
  // Connection details
  serverUrl?: string;
  token?: string;
  
  // Patient information
  patientName?: string;
  
  // Device preferences
  videoCaptureDefaults?: {
    deviceId?: string;
  };
  audioCaptureDefaults?: {
    deviceId?: string;
  };
  
  // Event handlers
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onEndCall?: () => void;
  onShareConsultation?: () => void;
}

export function MedicalConsultationRoom({
  roomName,
  participantName,
  userRole = 'doctor',
  sessionId,
  serverUrl,
  token,
  patientName,
  videoCaptureDefaults,
  audioCaptureDefaults,
  onConnected,
  onDisconnected,
  onError,
  onEndCall,
  onShareConsultation,
}: MedicalConsultationRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  console.log('MedicalConsultationRoom renderizado!');
  console.log('MedicalConsultationRoom props:', { roomName, participantName, userRole, sessionId, serverUrl, token, patientName, videoCaptureDefaults, audioCaptureDefaults, onConnected, onDisconnected, onError, onEndCall, onShareConsultation });
  // Handle connection events
  const handleConnected = async () => {
    console.log('✅ Connected to room');
    setConnectionError(null);
    onConnected?.();
  };

  const handleDisconnected = () => {
    console.log('❌ Disconnected from room');
    onDisconnected?.();
  };

  const handleError = (error: Error) => {
    console.error('❌ Room error:', error);
    setConnectionError(error.message);
    onError?.(error);
  };

  // Validate required props
  if (!serverUrl || !token) {
    console.log('🔍🔍🔍🔍 Props inválidas:', {
      serverUrl,
      token,
      roomName,
      participantName
    });

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#1a1a1a',
        color: 'white',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#f56565', marginBottom: '1rem' }}>Configuração Inválida</h2>
        <p style={{ color: '#a0aec0', marginBottom: '1rem' }}>
          Server URL ou Token não fornecidos
        </p>
        <p style={{ color: '#a0aec0', fontSize: '14px' }}>
          Server URL: {serverUrl ? '✅' : '❌'}<br/>
          Token: {token ? '✅' : '❌'}<br/>
          Room Name: {roomName ? '✅' : '❌'}<br/>
          Participant: {participantName ? '✅' : '❌'}
        </p>
      </div>
    );
  }

  console.log('🚀 Rendering LiveKitRoom with:', {
    serverUrl,
    token: token ? `${token.substring(0, 20)}...` : 'null',
    roomName,
    participantName
  });

  console.log('🔍🔍🔍🔍 Props para TranscriptionDisplay:', {
    patientName,
    userRole,
    roomName,
    participantId: participantName,
    consultationId: sessionId
  });


console.log('🔍 Verificando se TranscriptionDisplay será renderizado...');

  return (
    <div style={{ height: '100vh', background: '#1a1a1a' }}>
      {/* Header customizado para consulta médica */}
      <div style={{ 
        padding: '1rem 2rem',
        background: 'rgba(0,0,0,0.9)',
        borderBottom: '1px solid #4a5568',
        color: 'white',
        position: 'relative',
        zIndex: 1000
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          Consulta Online - {userRole === 'doctor' ? 'Médico' : 'Paciente'}
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#a0aec0' }}>
          Paciente: {patientName} | Sala: {roomName}
        </p>
        
        {/* Botões customizados */}
        <div style={{ 
          position: 'absolute',
          top: '1rem',
          right: '2rem',
          display: 'flex',
          gap: '1rem'
        }}>
          {onShareConsultation && userRole === 'doctor' && (
            <button 
              onClick={onShareConsultation}
              style={{
                padding: '0.5rem 1rem',
                background: '#a6ce39',
                color: 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Compartilhar Link
            </button>
          )}
          
          {onEndCall && (
            <button 
              onClick={onEndCall}
              style={{
                padding: '0.5rem 1rem',
                background: '#f56565',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Finalizar Consulta
            </button>
          )}
        </div>
      </div>

      {/* LiveKit Meet Implementation */}
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={true} // ESSENCIAL para LiveKit Meet
          data-lk-theme="default"
          style={{ height: '100%' }}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          connectOptions={{
            autoSubscribe: true,
          }}
          options={{
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: videoCaptureDefaults || {},
            audioCaptureDefaults: audioCaptureDefaults || {},
          }}
        >
          {/* Este é o componente principal do LiveKit Meet */}
          <VideoConference />
          
          {/* Componentes auxiliares */}
          <RoomAudioRenderer />
          
          <ConnectionStateToast />

          {/* Componente de Transcrição em Tempo Real */}
          <TranscriptionDisplay 
            patientName={patientName}
            userRole={userRole}
            roomName={roomName}
            participantId={participantName}
            consultationId={sessionId}
          />
        </LiveKitRoom>
      </div>

      {/* Error overlay se necessário */}
      {connectionError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#1a1a1a',
            color: 'white',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#f56565', marginBottom: '1rem' }}>Erro de Conexão</h2>
            <p style={{ marginBottom: '1rem' }}>{connectionError}</p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#a6ce39',
                color: 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}