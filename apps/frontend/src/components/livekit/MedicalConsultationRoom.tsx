'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LiveKitRoom, 
  VideoConference,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react'; 
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { useMicTransmitter } from '../../hooks/useMicTransmitter';

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
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);
  
  // Hook para transmissão de áudio para transcrição
  const micTransmitter = useMicTransmitter();
  
  // Desabilitar logs do LiveKit em produção
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Sobrescrever console.log temporariamente para filtrar logs do LiveKit
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        // Filtrar logs específicos do LiveKit que causam spam
        if (message.includes('already connected to room') || 
            message.includes('participant:') || 
            message.includes('roomID:')) {
          return; // Não exibir esses logs
        }
        originalLog.apply(console, args);
      };

      // Restaurar console.log original após 5 segundos (depois da inicialização)
      setTimeout(() => {
        console.log = originalLog;
      }, 5000);
    }
  }, []);
  
  // Logs de debug removidos para evitar spam no console
  // Handle connection events
  const handleConnected = async () => {
    console.log('[MDR] >> ✅ Connected to room');
    setConnectionError(null);
    setIsLiveKitConnected(true);
    
    console.log('[MDR] >> 🎙️ LiveKit connected, waiting for user gesture to start transcription...');
    
    onConnected?.();
  };

  // Função para iniciar transcrição após user gesture
  const startTranscriptionWithUserGesture = useCallback(async () => {
    console.log('[MDR] >> 🚨 [DEBUG] Button clicked! startTranscriptionWithUserGesture called');
    console.log('[MDR] >> 🚨 [DEBUG] Current state:', {
      isLiveKitConnected,
      micTransmitterState: {
        isConnected: micTransmitter.isConnected,
        isTransmitting: micTransmitter.isTransmitting,
        isMuted: micTransmitter.isMuted,
        error: micTransmitter.error
      },
      sessionId,
      userRole
    });

    if (!isLiveKitConnected) {
      console.log('[MDR] >> ⚠️ LiveKit not connected yet, waiting...');
      return;
    }

    try {
      console.log('[MDR] >> 🎤 Starting mic transmitter after user gesture...');
      
      // Limpar participantId para ASCII simples
      const cleanParticipantId = userRole === 'doctor' ? 'Doctor' : 'Patient';
      
      await micTransmitter.start({
        sessionId,
        participantId: cleanParticipantId,
      });
      console.log('[MDR] >> ✅ Mic transmitter started for transcription with participantId:', cleanParticipantId);
    } catch (error) {
      console.error('❌❌ Failed to start mic transmitter:', error);
    }
  }, [micTransmitter, sessionId, userRole, isLiveKitConnected]);

  const handleDisconnected = () => {
    console.log('[MDR] >> ❌ Disconnected from room');
    setIsLiveKitConnected(false);
    
    // Parar transmissão de áudio
    micTransmitter.stop();
    console.log('[MDR] >> 🔇 Mic transmitter stopped');
    
    onDisconnected?.();
  };

  const handleError = (error: Error) => {
    console.error('❌ Room error:', error);
    setConnectionError(error.message);
    
    // Parar transmissão de áudio em caso de erro
    if (isLiveKitConnected) {
      micTransmitter.stop();
    }
    
    onError?.(error);
  };

  // Cleanup mic transmitter on unmount
  useEffect(() => {
    return () => {
      micTransmitter.stop();
    };
  }, [micTransmitter]);

  // Validate required props
  if (!serverUrl || !token) {
    // Log removido para evitar spam infinito

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

  // Debug logs removidos para evitar render loops

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
          {/* Botão para ativar transcrição */}
          {isLiveKitConnected && !micTransmitter.isTransmitting && (
            <button 
              onClick={startTranscriptionWithUserGesture}
              style={{
                padding: '0.5rem 1rem',
                background: micTransmitter.isConnected ? '#4caf50' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🎤 Ativar Transcrição
            </button>
          )}

          {/* Status da transcrição */}
          {micTransmitter.isTransmitting && (
            <div style={{
              padding: '0.5rem 1rem',
              background: micTransmitter.isMuted ? '#ff9800' : '#4caf50',
              color: 'white',
              borderRadius: '6px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {micTransmitter.isMuted ? '🔇' : '🎤'} Transcrição {micTransmitter.isMuted ? 'Pausada' : 'Ativa'}
            </div>
          )}

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