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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

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

  // Função para tentar reconectar automaticamente
  const retryConnection = () => {
    if (isRetrying || retryCount >= 3) return;
    
    console.log(`🔄 Tentativa de reconexão ${retryCount + 1}/3`);
    setIsRetrying(true);
    setConnectionError(null);
    setRetryCount(prev => prev + 1);
    
    // Simular reconexão após 2 segundos
    setTimeout(() => {
      setIsRetrying(false);
      window.location.reload();
    }, 2000);
  };

  // Debug: Log connection attempts
  useEffect(() => {
    console.log('🔍 MedicalConsultationRoom mounted with:', {
      serverUrl,
      token: token ? 'Present' : 'Missing',
      roomName,
      participantName
    });
    
    // Debug: Check environment variables
    console.log('🔍 Environment variables:', {
      NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
      NEXT_PUBLIC_LIVEKIT_API_KEY: process.env.NEXT_PUBLIC_LIVEKIT_API_KEY,
      hasServerUrl: Boolean(serverUrl),
      hasToken: Boolean(token),
      serverUrlValue: serverUrl,
      tokenValue: token ? `${token.substring(0, 20)}...` : 'null'
    });
  }, [serverUrl, token, roomName, participantName]);

  // Teste de conectividade com LiveKit
  useEffect(() => {
    const testLiveKitConnection = async () => {
      try {
        console.log('🧪 Testando conectividade com LiveKit...');
        const response = await fetch(`${serverUrl!.replace('wss://', 'https://')}/api/health`);
        console.log('✅ LiveKit server is reachable:', response.status);
      } catch (error) {
        console.error('❌ LiveKit server unreachable:', error);
      }
    };

    const validateJWTToken = () => {
      if (!token) {
        console.error('❌ Token JWT não fornecido');
        return;
      }
      
      try {
        // Decodificar JWT para verificar se é válido
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('❌ Token JWT inválido: formato incorreto');
          return;
        }
        
        const payload = JSON.parse(atob(parts[1]));
        console.log('🔍 JWT Token payload:', {
          sub: payload.sub,
          exp: payload.exp,
          expDate: new Date(payload.exp * 1000).toISOString(),
          isExpired: Date.now() > payload.exp * 1000,
          video: payload.video
        });
        
        if (Date.now() > payload.exp * 1000) {
          console.error('❌ Token JWT expirado!');
          setConnectionError('Token JWT expirado. Recarregue a página.');
        }
      } catch (error) {
        console.error('❌ Erro ao decodificar JWT:', error);
      }
    };

    if (serverUrl) {
      testLiveKitConnection();
    }
    
    validateJWTToken();
  }, [serverUrl, token]);

  // Timeout para detectar conexão travada com debug detalhado e retry automático
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isConnected && !isRetrying) {
        console.error('⏰ Timeout: Conexão não estabelecida em 30 segundos');
        
        // Debug detalhado do timeout
        console.log('🔍 Debug do Timeout:');
        console.log('  - serverUrl:', serverUrl);
        console.log('  - token presente:', !!token);
        console.log('  - token válido:', token ? 'Verificando...' : 'Não');
        console.log('  - roomName:', roomName);
        console.log('  - isConnected:', isConnected);
        console.log('  - connectionError:', connectionError);
        console.log('  - retryCount:', retryCount);
        
        // Testar conectividade do LiveKit
        if (serverUrl) {
          const testUrl = serverUrl.replace('wss://', 'https://');
          fetch(`${testUrl}/api/health`)
            .then(response => {
              console.log('🧪 LiveKit Health Check:', response.status);
              if (response.ok) {
                if (retryCount < 2) {
                  console.log('🔄 LiveKit está funcionando, tentando reconexão automática...');
                  retryConnection();
                } else {
                  setConnectionError('LiveKit está funcionando, mas a conexão WebSocket falhou. Verifique sua conexão de internet.');
                }
              } else {
                setConnectionError('Servidor LiveKit não está respondendo corretamente.');
              }
            })
            .catch(error => {
              console.error('🧪 LiveKit Health Check Failed:', error);
              if (retryCount < 2) {
                console.log('🔄 Problema de conectividade, tentando reconexão automática...');
                retryConnection();
              } else {
                setConnectionError('Não foi possível conectar ao servidor LiveKit. Verifique sua conexão de internet.');
              }
            });
        } else {
          setConnectionError('URL do servidor LiveKit não configurada.');
        }
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isConnected, serverUrl, token, roomName, connectionError, retryCount, isRetrying]);

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
          {isRetrying ? `Reconectando... (${retryCount}/3)` : 
           !isConnected ? 'Conectando à sala...' : 'Preparando interface...'}
        </h2>
        <p style={{ color: '#a0aec0' }}>
          Sala: {roomName} | Participante: {participantName}
        </p>
        {retryCount > 0 && (
          <p style={{ color: '#ffc107', fontSize: '14px', marginTop: '0.5rem' }}>
            ⚠️ Tentativa {retryCount}/3
          </p>
        )}
        
        {/* Botão de Debug */}
        <div style={{ marginTop: '1rem' }}>
          <button 
            onClick={() => {
              console.log('🔧 DEBUG MANUAL:');
              console.log('URL atual:', window.location.href);
              console.log('Parâmetros:', Object.fromEntries(new URLSearchParams(window.location.search)));
              console.log('ServerUrl:', serverUrl);
              console.log('Token length:', token?.length);
              console.log('RoomName:', roomName);
              console.log('ParticipantName:', participantName);
              
              // Testar gateway
              fetch('https://medcall-gateway-416450784258.southamerica-east1.run.app/api/health')
                .then(r => r.json())
                .then(data => console.log('Gateway Status:', data))
                .catch(err => console.error('Gateway Error:', err));
                
              // Testar LiveKit
              if (serverUrl) {
                const testUrl = serverUrl.replace('wss://', 'https://');
                fetch(`${testUrl}/api/health`)
                  .then(r => console.log('LiveKit Health:', r.status))
                  .catch(err => console.error('LiveKit Error:', err));
              }
              
              alert('Debug executado! Verifique o console (F12)');
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#4a5568',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔧 Debug (F12)
          </button>
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
        
        {/* Informações de Debug */}
        <div style={{ 
          background: '#2a2a2a', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1rem',
          fontSize: '12px',
          textAlign: 'left',
          maxWidth: '600px'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffc107' }}>🔍 Informações de Debug:</h4>
          <p style={{ margin: '0.25rem 0' }}>• Server URL: {serverUrl || 'Não definido'}</p>
          <p style={{ margin: '0.25rem 0' }}>• Token: {token ? 'Presente' : 'Ausente'}</p>
          <p style={{ margin: '0.25rem 0' }}>• Room: {roomName || 'Não definido'}</p>
          <p style={{ margin: '0.25rem 0' }}>• Participante: {participantName || 'Não definido'}</p>
          <p style={{ margin: '0.25rem 0' }}>• Timestamp: {new Date().toLocaleString()}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
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
          
          <button 
            onClick={() => {
              console.log('🔧 DEBUG COMPLETO:');
              console.log('URL:', window.location.href);
              console.log('Parâmetros:', Object.fromEntries(new URLSearchParams(window.location.search)));
              console.log('ServerUrl:', serverUrl);
              console.log('Token:', token ? `${token.substring(0, 50)}...` : 'null');
              console.log('RoomName:', roomName);
              console.log('Error:', connectionError);
              
              // Testes de conectividade
              fetch('https://medcall-gateway-416450784258.southamerica-east1.run.app/api/health')
                .then(r => r.json())
                .then(data => console.log('Gateway:', data))
                .catch(err => console.error('Gateway Error:', err));
                
              if (serverUrl) {
                const testUrl = serverUrl.replace('wss://', 'https://');
                fetch(`${testUrl}/api/health`)
                  .then(r => console.log('LiveKit:', r.status))
                  .catch(err => console.error('LiveKit Error:', err));
              }
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#4a5568',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔧 Debug Console
          </button>
        </div>
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

  console.log('🚀 Rendering LiveKitRoom with:', {
    serverUrl,
    token: token ? `${token.substring(0, 20)}...` : 'null',
    roomName,
    participantName
  });

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