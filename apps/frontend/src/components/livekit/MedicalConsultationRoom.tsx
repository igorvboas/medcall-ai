'use client';

import React, { useState, useEffect } from 'react';
import { 
  LiveKitRoom, 
  VideoConference,
  GridLayout,
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  ConnectionState,
  ConnectionStateToast,
  PreJoin,
  LocalUserChoices
} from '@livekit/components-react';
import { Track } from 'livekit-client';

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

  // Handle connection events
  const handleConnected = () => {
    console.log('✅ Connected to room');
    setIsConnected(true);
    setConnectionError(null);
    onConnected?.();
  };

  const handleDisconnected = () => {
    console.log('❌ Disconnected from room');
    setIsConnected(false);
    onDisconnected?.();
  };

  const handleError = (error: Error) => {
    console.error('❌ Room error:', error);
    setConnectionError(error.message);
    onError?.(error);
  };

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
          Token: {token ? '✅' : '❌'}
        </p>
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
        videoCaptureDefaults: videoCaptureDefaults || {},
        audioCaptureDefaults: audioCaptureDefaults || {},
        publishDefaults: {
          dtx: false,
          videoSimulcastLayers: [
            { resolution: { width: 1280, height: 720 }, encoding: { maxBitrate: 2000000 } },
            { resolution: { width: 640, height: 360 }, encoding: { maxBitrate: 500000 } }
          ],
        },
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
        </div>

        {/* Video Area */}
        <div style={{ flex: 1, padding: '1rem' }}>
          <GridLayout style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
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