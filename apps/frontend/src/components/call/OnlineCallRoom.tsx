'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, FileText, Brain, AlertCircle, ClipboardList, User, Calendar, Share2 } from 'lucide-react';
import { useLiveKitCall } from '@/hooks/useLiveKitCall';
import { validateLiveKitConfig, getLiveKitServerUrl } from '@/lib/livekit';
import { TranscriptionPanel } from './TranscriptionPanel';
import { SuggestionsPanel } from './SuggestionsPanel';
import { CompletionModal } from './CompletionModal';
import io, { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

interface OnlineCallRoomProps {
  sessionId: string;
  consultationId: string;
  doctorToken: string | null;
  patientToken: string | null;
  livekitUrl: string;
  roomName: string;
  patientName: string;
  userRole?: 'doctor' | 'patient';
  selectedDevices?: {
    cameraId: string | null;
    microphoneId: string | null;
  };
  onShareConsultation?: () => void;
}

interface Utterance {
  id: string;
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  confidence: number;
}

interface Suggestion {
  id: string;
  type: 'question' | 'diagnosis' | 'treatment';
  text: string;
  confidence: number;
  timestamp: string;
  used: boolean;
  used_at?: string;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function OnlineCallRoom({
  sessionId,
  consultationId,
  doctorToken,
  patientToken,
  livekitUrl,
  roomName,
  patientName,
  userRole = 'doctor',
  selectedDevices,
  onShareConsultation
}: OnlineCallRoomProps) {
  const router = useRouter();
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{ durationSeconds: number; suggestions: { total: number; used: number } } | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const transcriptionScrollRef = useRef<HTMLDivElement>(null);
  
  // Estado para forçar re-renderização quando tracks mudarem
  const [trackUpdateKey, setTrackUpdateKey] = useState(0);
  
  // Estados para dados da anamnese
  const [patientData, setPatientData] = useState({
    name: patientName,
    birthDate: '',
    age: '',
    gender: '',
    medicalHistory: '',
    currentMedications: '',
    allergies: ''
  });
  
  // 🛡️ PROTEÇÃO CONTRA DUPLICAÇÃO: Set para rastrear IDs já processados
  const processedUtteranceIds = useRef<Set<string>>(new Set());

  // Validar configuração do LiveKit
  try {
    validateLiveKitConfig();
  } catch (error) {
    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Configuração Inválida</h1>
            <p className="page-subtitle">
              LiveKit não está configurado corretamente.
            </p>
          </div>
          <div className="form-card">
            <div className="error-message">
              <AlertCircle size={24} />
              <p>{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
            </div>
            <div className="form-actions">
              <button 
                onClick={() => router.push('/consulta/nova')}
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

  // Hook para gerenciar a call LiveKit
  const {
    room,
    isConnected: isLiveKitConnected,
    participants,
    localVideoTrack,
    localAudioTrack,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    connect,
    disconnect
  } = useLiveKitCall({
    token: userRole === 'doctor' ? (doctorToken || '') : (patientToken || ''),
    serverUrl: (() => {
      // Tratar casos onde livekitUrl vem como string "undefined"
      const isValidUrl = livekitUrl && livekitUrl !== 'undefined' && livekitUrl !== 'null';
      const url = isValidUrl ? livekitUrl : getLiveKitServerUrl();
      return url;
    })(),
    roomName: roomName,
    onAudioData: useCallback((audioData: Float32Array, timestamp: number) => {
      // Enviar dados de áudio via WebSocket para transcrição
      if (socket && connectionState.isConnected) {
        const audioChannel = userRole === 'doctor' ? 'doctor' : 'patient';
        socket.emit(`online:audio:${audioChannel}`, {
          sessionId,
          audioData: Array.from(audioData),
          timestamp,
          sampleRate: 16000 // LiveKit default
        });
      }
    }, [socket, connectionState.isConnected, sessionId, userRole]),
    onError: useCallback((error: string) => {
      setConnectionState(prev => ({ ...prev, error }));
    }, [])
  });

  // Inicializar conexão WebSocket
  useEffect(() => {
    let socketInstance: Socket | null = null;

    const initializeWebSocket = () => {
      setConnectionState(prev => ({ ...prev, isConnecting: true }));

        // Conectar ao gateway WebSocket
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:3001';
        let wsUrl = gatewayUrl;
        
        // Converter HTTP/HTTPS para WS/WSS apenas se necessário
        if (gatewayUrl.startsWith('https://')) {
          wsUrl = gatewayUrl.replace('https://', 'wss://');
        } else if (gatewayUrl.startsWith('http://')) {
          wsUrl = gatewayUrl.replace('http://', 'ws://');
        }

        socketInstance = io(wsUrl, {
        transports: ['websocket'],
        timeout: 10000
      });

      socketInstance.on('connect', () => {
        console.log('✅ WebSocket conectado');
        setConnectionState({
          isConnected: true,
          isConnecting: false,
          error: null
        });

        // Entrar na sessão
        socketInstance!.emit('session:join', {
          sessionId,
          userId: userRole === 'doctor' ? 'doctor-current' : 'patient-current',
          role: userRole
        });

        // Iniciar gravação da sessão online
        socketInstance!.emit('online:start_recording', {
          sessionId,
          consultationId,
          timestamp: new Date().toISOString()
        });

        setSessionStartTime(new Date());
      });

      socketInstance.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setConnectionState(prev => ({
          ...prev,
          isConnected: false
        }));
      });

      socketInstance.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
        setConnectionState({
          isConnected: false,
          isConnecting: false,
          error: `Erro de conexão: ${error.message}`
        });
      });

      // ✅ NOVO: Handler para receber histórico de transcrições ao reconectar
      socketInstance.on('transcription:history', (data) => {
        console.log('📜 Histórico de transcrições recebido:', data);
        if (data.utterances && Array.isArray(data.utterances)) {
          // Converter formato do banco para formato do frontend
          const formattedUtterances = data.utterances.map((u: any) => ({
            id: u.id,
            speaker: u.speaker,
            text: u.text,
            timestamp: new Date(u.created_at || u.timestamp),
            confidence: u.confidence || 0,
            isFinal: u.is_final !== false
          }));

          // Adicionar IDs ao Set de processados para evitar duplicação
          formattedUtterances.forEach((u: any) => {
            processedUtteranceIds.current.add(u.id);
          });

          // Popular estado com histórico
          setUtterances(formattedUtterances);
          console.log(`✅ ${formattedUtterances.length} transcrições históricas carregadas`);
        } else {
          console.warn('⚠️ Dados de histórico sem utterances:', data);
        }
      });

      // Handlers para transcrição
      socketInstance.on('transcription:update', (data) => {
        console.log('📝 Nova transcrição recebida:', data);
        
        // 🛡️ PROTEÇÃO CONTRA DUPLICAÇÃO
        if (processedUtteranceIds.current.has(data.utterance.id)) {
          console.log('⚠️ Transcrição duplicada ignorada:', data.utterance.id);
          return;
        }
        
        processedUtteranceIds.current.add(data.utterance.id);
        
        setUtterances(prev => [...prev, data.utterance]);
      });

      // Handlers para sugestões de IA
      socketInstance.on('ai:suggestion', (data) => {
        console.log('🧠 Nova sugestão recebida:', data);
        setSuggestions(prev => [...prev, data.suggestion]);
      });

      socketInstance.on('suggestion:used', (data) => {
        console.log('✅ Sugestão marcada como usada:', data);
        setSuggestions(prev => 
          prev.map(s => 
            s.id === data.suggestionId 
              ? { ...s, used: true, used_at: data.timestamp }
              : s
          )
        );
      });

      socketInstance.on('suggestions:response', (data) => {
        console.log('📋 Frontend recebeu sugestões existentes:', data);
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      });

      // Handler para erros de sessão
      socketInstance.on('session:error', (data) => {
        setConnectionState(prev => ({
          ...prev,
          error: data.error.message
        }));
      });

      setSocket(socketInstance);
    };

    initializeWebSocket();

    // Cleanup ao desmontar ou re-executar
    return () => {
      if (socketInstance) {
        console.log('🧹 Limpando listeners WebSocket');
        socketInstance.emit('session:leave', {
          sessionId,
          userId: 'doctor-current'
        });
        socketInstance.disconnect();
        socketInstance = null;
      }
      
      // 🧹 Limpar IDs processados ao trocar de sessão
      processedUtteranceIds.current.clear();
    };
  }, [sessionId, consultationId]);

  // Conectar ao LiveKit quando o WebSocket estiver pronto
  useEffect(() => {
    if (connectionState.isConnected && !isLiveKitConnected) {
      connect();
    }
  }, [connectionState.isConnected, isLiveKitConnected, connect]);

  // Scroll automático quando novas transcrições chegam
  useEffect(() => {
    if (transcriptionScrollRef.current && utterances.length > 0) {
      transcriptionScrollRef.current.scrollTop = transcriptionScrollRef.current.scrollHeight;
    }
  }, [utterances]);

  // Forçar re-renderização quando participants mudarem
  useEffect(() => {
    setTrackUpdateKey(prev => prev + 1);
  }, [participants]);

  // Simular extração automática de dados pela IA baseada nas transcrições
  useEffect(() => {
    if (utterances.length > 0) {
      const latestUtterance = utterances[utterances.length - 1];
      
      // Exemplo de extração automática (em produção, isso viria do backend)
      if (latestUtterance.text.toLowerCase().includes('nasci') || latestUtterance.text.toLowerCase().includes('nascimento')) {
        const birthDateMatch = latestUtterance.text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{1,2}-\d{1,2})/);
        if (birthDateMatch) {
          setPatientData(prev => ({
            ...prev,
            birthDate: birthDateMatch[0]
          }));
        }
      }
      
      if (latestUtterance.text.toLowerCase().includes('anos') && latestUtterance.text.match(/\d+/)) {
        const ageMatch = latestUtterance.text.match(/(\d+)\s*anos?/);
        if (ageMatch) {
          setPatientData(prev => ({
            ...prev,
            age: ageMatch[1]
          }));
        }
      }
    }
  }, [utterances]);

  const handleFinalizeSession = async () => {
    if (isFinalizing) return;
    
    setIsFinalizing(true);
    
    try {
      // Parar gravação
      if (socket && connectionState.isConnected) {
        socket.emit('online:stop_recording', {
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      // Desconectar do LiveKit
      await disconnect();

      // Calcular duração da sessão
      const durationSeconds = sessionStartTime 
        ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
        : 0;

      // Contar sugestões
      const totalSuggestions = suggestions.length;
      const usedSuggestions = suggestions.filter(s => s.used).length;

      setCompletionSummary({
        durationSeconds,
        suggestions: {
          total: totalSuggestions,
          used: usedSuggestions
        }
      });

      setIsCompleted(true);
      setShowCompletionModal(true);
      
    } catch (error) {
      console.error('Erro ao finalizar sessão:', error);
      alert('Erro ao finalizar sessão. Tente novamente.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCloseModal = () => {
    setShowCompletionModal(false);
    router.push('/dashboard');
  };

  // Renderizar estado de carregamento
  if (connectionState.isConnecting) {
    return (
      <div className="online-call-room">
        <div className="page-header">
          <h1 className="page-title">Conectando à Consulta Online</h1>
          <p className="page-subtitle">Preparando a videochamada...</p>
        </div>
        <div className="form-card">
          <div className="loading-indicator">
            <div className="loading-icon" />
            <span>Conectando ao LiveKit e WebSocket...</span>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar estado de erro
  if (connectionState.error) {
    return (
      <div className="online-call-room">
        <div className="page-header">
          <h1 className="page-title">Erro de Conexão</h1>
          <p className="page-subtitle">Não foi possível conectar à consulta online</p>
        </div>
        <div className="form-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error-color)', marginBottom: '1rem' }}>
            <AlertCircle size={20} />
            <span>Erro: {connectionState.error}</span>
          </div>
          <div className="form-actions">
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="online-call-room">
      {/* Header da Sessão */}
      <div className="session-header">
        <div className="session-info">
          <h1>Consulta Online</h1>
          <p>Paciente: {patientName}</p>
          <p>Sessão: {sessionId.slice(0, 8)}...</p>
          <p>Status: {isLiveKitConnected ? '🟢 Conectado' : '🟡 Conectando'}</p>
        </div>
        <div className="session-controls">
          <div className="status-indicator">
            {isLiveKitConnected ? 'Conectado' : 'Conectando...'}
          </div>
        </div>
      </div>

      {/* Layout Principal */}
      <div className="call-layout">
        {/* Área Principal de Vídeo */}
        <div className="main-video-area">
          {/* Participantes da Videoconferência */}
          <div className="video-participants">
            {/* Participante Atual (Você) */}
            <div className="participant-container">
              <div className="participant-video">
                {localVideoTrack ? (
                  <video
                    ref={(element) => {
                      if (element && localVideoTrack) {
                        localVideoTrack.attach(element);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                  />
                ) : (
                  <div className="participant-avatar">
                    <User size={40} />
                  </div>
                )}
              </div>
              <div className="participant-name">
                {userRole === 'doctor' ? 'Dr. Médico (Você)' : 'Você'}
              </div>
              <div className="participant-status">
                {isLiveKitConnected ? 'Conectado' : 'Conectando'}
              </div>
            </div>

            {/* Outro Participante */}
            <div className="participant-container">
              <div className={`participant-video ${participants.length === 0 ? 'offline' : ''}`}>
                {participants.length > 0 ? (
                  // Renderizar vídeo do primeiro participante remoto
                  (() => {
                    const participant = participants[0];
                    console.log('🎥 Renderizando participante:', participant.identity);
                    console.log('🎥 Video publications:', participant.videoTrackPublications.size);
                    
                    // Buscar track de vídeo ativo
                    const videoPublications = Array.from(participant.videoTrackPublications.values());
                    const activeVideoPublication = videoPublications.find(pub => pub.track && !pub.isMuted);
                    
                    console.log('🎥 Active video publication:', activeVideoPublication?.trackSid);
                    
                    if (activeVideoPublication?.track) {
                      return (
                        <video
                          key={`${participant.identity}-${activeVideoPublication.trackSid}-${trackUpdateKey}`}
                          ref={(element) => {
                            if (element && activeVideoPublication.track) {
                              // Detach primeiro se já estiver anexado
                              activeVideoPublication.track.detach(element);
                              // Attach o track
                              activeVideoPublication.track.attach(element);
                            }
                          }}
                          autoPlay
                          playsInline
                          muted={false}
                        />
                      );
                    }
                    return (
                  <div className="participant-avatar">
                    <User size={40} />
                  </div>
                    );
                  })()
                ) : (
                  <div className="participant-avatar">
                    <User size={40} />
                  </div>
                )}
              </div>
              <div className="participant-name">
                {userRole === 'doctor' ? patientName : 'Dr. Médico'}
              </div>
              <div className={`participant-status ${participants.length === 0 && !isLiveKitConnected ? 'offline' : ''}`}>
                {participants.length > 0 ? 'Conectado' : (isLiveKitConnected ? 'Conectado' : 'Aguardando...')}
              </div>
            </div>
          </div>

          {/* Controles da Chamada */}
          <div className="call-controls">
            <button 
              onClick={toggleAudio}
              className={`control-btn mic ${!isAudioEnabled ? 'muted' : ''}`}
              title={isAudioEnabled ? 'Desativar Microfone' : 'Ativar Microfone'}
            >
              {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            
            <button 
              onClick={toggleVideo}
              className={`control-btn video ${!isVideoEnabled ? 'disabled' : ''}`}
              title={isVideoEnabled ? 'Desativar Câmera' : 'Ativar Câmera'}
            >
              {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            
            {userRole === 'doctor' && onShareConsultation && (
              <button 
                onClick={onShareConsultation}
                className="control-btn share"
                title="Compartilhar Link com Paciente"
              >
                <Share2 size={24} />
              </button>
            )}
            
            <button 
              onClick={handleFinalizeSession}
              className="control-btn end"
              disabled={isFinalizing}
              title="Finalizar Consulta"
            >
              {isFinalizing ? <div className="loading-icon" /> : <PhoneOff size={24} />}
            </button>
          </div>
        </div>

        {/* Painéis Laterais */}
        <div className="side-panels">
          {/* Transcrição */}
          <div className="form-card">
            <h3 className="form-section-title">
              <FileText className="form-section-icon" />
              Transcrição em Tempo Real
            </h3>
            <TranscriptionPanel 
              utterances={utterances}
              scrollRef={transcriptionScrollRef}
            />
          </div>

          {/* Sugestões de IA */}
          <div className="form-card">
            <h3 className="form-section-title">
              <Brain className="form-section-icon" />
              Sugestões de IA
            </h3>
            <SuggestionsPanel 
              suggestions={suggestions}
              onSuggestionUsed={(suggestionId) => {
                if (socket && connectionState.isConnected) {
                  socket.emit('suggestion:use', {
                    sessionId,
                    suggestionId,
                    timestamp: new Date().toISOString()
                  });
                }
              }}
            />
          </div>

          {/* Dados do Paciente */}
          <div className="form-card">
            <h3 className="form-section-title">
              <ClipboardList className="form-section-icon" />
              Dados do Paciente
            </h3>
            <div className="patient-data">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input 
                  type="text" 
                  value={patientData.name} 
                  readOnly 
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input 
                  type="text" 
                  value={patientData.birthDate} 
                  readOnly 
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Idade</label>
                <input 
                  type="text" 
                  value={patientData.age} 
                  readOnly 
                  className="form-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Finalização */}
      {showCompletionModal && completionSummary && (
        <CompletionModal
          isOpen={showCompletionModal}
          onClose={handleCloseModal}
          consultationData={{
            sessionId,
            consultationId,
            patientName,
            durationSeconds: completionSummary.durationSeconds,
            suggestions: completionSummary.suggestions,
            utterances,
            usedSuggestions: suggestions.filter(s => s.used)
          }}
          onRedirectToConsultations={handleCloseModal}
        />
      )}
    </div>
  );
}
