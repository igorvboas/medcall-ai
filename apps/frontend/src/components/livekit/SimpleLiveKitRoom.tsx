'use client';

import React, { useState, useEffect } from 'react';
import { 
  LiveKitRoom, 
  ParticipantTile,
  ControlBar,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';

interface SimpleLiveKitRoomProps {
  roomName: string;
  participantName: string;
  userRole?: 'doctor' | 'patient';
  sessionId: string;
  serverUrl?: string;
  token?: string;
  patientName?: string;
  onEndCall?: () => void;
  onError?: (error: Error) => void;
}

export function SimpleLiveKitRoom({
  roomName,
  participantName,
  userRole = 'doctor',
  sessionId,
  serverUrl,
  token,
  patientName,
  onEndCall,
  onError,
}: SimpleLiveKitRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Função para adicionar logs
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-9), logEntry]); // Manter últimos 10 logs
  };

  // Handle connection events
  const handleConnected = async () => {
    addLog('✅ Conectado à sala LiveKit', 'success');
    setIsConnected(true);
    setConnectionError(null);
    
    try {
      // Solicitar permissões de mídia
      await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      addLog('✅ Permissões de mídia obtidas', 'success');
    } catch (error) {
      addLog(`❌ Erro ao acessar mídia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    }
  };

  const handleDisconnected = () => {
    addLog('❌ Desconectado da sala', 'error');
    setIsConnected(false);
  };

  const handleError = (error: Error) => {
    addLog(`❌ Erro: ${error.message}`, 'error');
    setConnectionError(error.message);
    onError?.(error);
  };

  // Debug: Log connection attempts
  useEffect(() => {
    addLog(`🔍 Iniciando conexão com sala: ${roomName}`);
    addLog(`🔍 Server URL: ${serverUrl}`);
    addLog(`🔍 Token: ${token ? 'Presente' : 'Ausente'}`);
    addLog(`🔍 Participante: ${participantName}`);
  }, [roomName, serverUrl, token, participantName]);

  // Timeout para detectar conexão travada
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isConnected) {
        addLog('⏰ Timeout: Conexão não estabelecida em 30 segundos', 'error');
        setConnectionError('Timeout: Não foi possível conectar à sala em 30 segundos');
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isConnected]);

  // Show loading state while connecting
  if (!isConnected) {
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
          Conectando à sala...
        </h2>
        <p style={{ color: '#a0aec0' }}>
          Sala: {roomName} | Participante: {participantName}
        </p>
        
        {/* Debug Logs */}
        <div style={{
          marginTop: '2rem',
          width: '100%',
          maxWidth: '600px',
          background: '#2a2a2a',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.8rem',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffc107' }}>📋 Logs de Debug:</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {debugLogs.map((log, index) => (
              <div key={index} style={{ margin: '0.25rem 0', fontFamily: 'monospace' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
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
        
        {/* Debug Logs */}
        <div style={{
          background: '#2a2a2a', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1rem',
          fontSize: '0.8rem',
          textAlign: 'left',
          maxWidth: '600px',
          width: '100%'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffc107' }}>📋 Logs de Debug:</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {debugLogs.map((log, index) => (
              <div key={index} style={{ margin: '0.25rem 0', fontFamily: 'monospace' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
        
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
          🔄 Tentar Novamente
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
            🧪 Teste LiveKit - {userRole === 'doctor' ? 'Médico' : 'Paciente'}
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
                Finalizar Teste
              </button>
            )}
          </div>
        </div>
      </div>
    </LiveKitRoom>
  );
}
