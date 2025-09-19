'use client';

import React, { useState, useEffect } from 'react';
import { 
  LiveKitRoom, 
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';
import { Track, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';

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
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRoomReady, setIsRoomReady] = useState(false);

  // Handle connection events
  const handleConnected = async () => {
    console.log('✅ Connected to room');
    setIsConnected(true);
    setConnectionError(null);
    
    // INICIALIZAR MICROFONE E CÂMERA AUTOMATICAMENTE (como no useLiveKitCall)
    try {
      console.log('🎤 Inicializando microfone e câmera...');
      
      // Solicitar permissões de mídia primeiro
      await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log('✅ Permissões de mídia obtidas');
      
      // Aguardar um pouco para garantir que os tracks estejam prontos
      setTimeout(() => {
        setIsRoomReady(true);
        console.log('🚀 Sala pronta para uso');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro ao inicializar mídia:', error);
      setConnectionError(`Erro ao acessar microfone/câmera: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
    
    onConnected?.();
  };

  const handleDisconnected = () => {
    console.log('❌ Disconnected from room');
    setIsConnected(false);
    setIsRoomReady(false);
    onDisconnected?.();
  };

  const handleError = (error: Error) => {
    console.error('❌ Room error:', error);
    setConnectionError(error.message);
    onError?.(error);
  };

  // Debug: Log connection attempts
  useEffect(() => {
    console.log('🔍 MedicalConsultationRoom mounted with:', {
      serverUrl,
      token: token ? 'Present' : 'Missing',
      roomName,
      participantName
    });
  }, [serverUrl, token, roomName, participantName]);

  // Timeout para detectar conexão travada
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isConnected) {
        console.error('⏰ Timeout: Conexão não estabelecida em 30 segundos');
        setConnectionError('Timeout: Não foi possível conectar à sala em 30 segundos');
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isConnected]);

  // Show loading state while connecting
  if (!isConnected || !isRoomReady) {
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
        <div style={{ marginBottom: '1rem' }}>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #4a5568', 
            borderTop: '3px solid #a6ce39',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
        <h2 style={{ marginBottom: '0.5rem' }}>
          {!isConnected ? 'Conectando à sala...' : 'Preparando interface...'}
        </h2>
        <p style={{ color: '#a0aec0' }}>
          Sala: {roomName} | Participante: {participantName}
        </p>
      </div>
    );
  }

  // Show error state
  if (connectionError) {
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
        <h2 style={{ color: '#f56565', marginBottom: '1rem' }}>Erro de Conexão</h2>
        <p style={{ color: '#a0aec0', marginBottom: '1rem' }}>
          {connectionError}
        </p>
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
    );
  }

  // Validate required props
  if (!serverUrl || !token) {
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
        <div style={{ marginTop: '1rem', fontSize: '12px', color: '#666' }}>
          <p>Debug Info:</p>
          <p>ServerUrl: {serverUrl}</p>
          <p>Token: {token ? `${token.substring(0, 20)}...` : 'null'}</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      connectOptions={{
        autoSubscribe: true,
      }}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
    >
      <RoomAudioRenderer />
      <ConnectionStateToast />
      
      <div style={{ 
        height: '100vh',
        background: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '1rem 2rem',
          background: 'rgba(0,0,0,0.8)',
          borderBottom: '1px solid #4a5568'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
            🎥 Consulta Online - {userRole === 'doctor' ? 'Médico' : 'Paciente'}
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#a0aec0' }}>
            Paciente: {patientName} | Sala: {roomName}
          </p>
          <p style={{ margin: '0.25rem 0 0 0', color: '#48bb78', fontSize: '12px' }}>
            ✅ Conectado | 🚀 Sala Pronta
          </p>
        </div>

        {/* Video Area */}
        <div style={{ flex: 1, padding: '1rem' }}>
          <div style={{ 
            height: '100%', 
            background: '#2a2a2a',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #4a5568'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: '1rem' }}>🎥 Área de Vídeo</h3>
              <p style={{ color: '#a0aec0', marginBottom: '1rem' }}>
                Aguardando participantes...
              </p>
              <div style={{ 
                width: '200px', 
                height: '150px', 
                background: '#1a1a1a',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}>
                <ParticipantTile />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ 
          padding: '1rem',
          background: 'rgba(0,0,0,0.8)',
          borderTop: '1px solid #4a5568'
        }}>
          <ControlBar />
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '1rem', 
            marginTop: '1rem' 
          }}>
            {onEndCall && (
              <button 
                onClick={onEndCall}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f56565',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Finalizar Consulta
              </button>
            )}
            
            {onShareConsultation && userRole === 'doctor' && (
              <button 
                onClick={onShareConsultation}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#a6ce39',
                  color: 'black',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Compartilhar Link
              </button>
            )}
          </div>
        </div>
      </div>
    </LiveKitRoom>
  );
}