'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Square, Play, Volume2, FileText, Brain, AlertCircle, ClipboardList, User, Calendar } from 'lucide-react';
import { useAudioForker } from '@/hooks/useAudioForker';
import io, { Socket } from 'socket.io-client';

interface PresentialCallRoomProps {
  sessionId: string;
  consultationId: string;
  doctorMicId: string;
  patientMicId: string;
  patientName: string;
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
  type: 'question' | 'diagnosis' | 'treatment' | 'note';
  text: string;
  confidence: number;
  timestamp: string;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function PresentialCallRoom({
  sessionId,
  consultationId,
  doctorMicId,
  patientMicId,
  patientName
}: PresentialCallRoomProps) {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const transcriptionScrollRef = useRef<HTMLDivElement>(null);
  
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

  // Hook para captura de áudio dual
  const audioForker = useAudioForker({
    doctorMicId,
    patientMicId,
    onAudioData: useCallback((data: {
      channel: 'doctor' | 'patient';
      audioData: Float32Array;
      timestamp: number;
      sampleRate: number;
    }) => {
      // Enviar dados de áudio via WebSocket
      if (socket && connectionState.isConnected) {
        socket.emit(`presential:audio:${data.channel}`, {
          sessionId,
          audioData: Array.from(data.audioData), // Converter para array serializável
          timestamp: data.timestamp,
          sampleRate: data.sampleRate
        });
      }
    }, [socket, connectionState.isConnected, sessionId]),
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
      socketInstance = io(process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:3001', {
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
          userId: 'doctor-current', // TODO: Pegar do contexto de auth
          role: 'doctor'
        });
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

      // Handlers para transcrição
      socketInstance.on('transcription:update', (data) => {
        console.log('📨 Frontend recebeu transcrição:', data);
        if (data.utterance) {
          // 🛡️ PROTEÇÃO CONTRA DUPLICAÇÃO: Verificar se ID já foi processado
          if (processedUtteranceIds.current.has(data.utterance.id)) {
            console.log('🛡️ Utterance duplicado bloqueado:', data.utterance.id);
            return;
          }
          
          // Marcar como processado ANTES de adicionar
          processedUtteranceIds.current.add(data.utterance.id);
          
          console.log('✅ Adicionando utterance à lista:', data.utterance);
          setUtterances(prev => [...prev, data.utterance]);
          
          // Limpeza periódica do Set (manter últimos 1000 IDs)
          if (processedUtteranceIds.current.size > 1000) {
            const idsArray = Array.from(processedUtteranceIds.current);
            processedUtteranceIds.current.clear();
            // Manter só os últimos 500 IDs
            idsArray.slice(-500).forEach(id => processedUtteranceIds.current.add(id));
          }
        } else {
          console.warn('⚠️ Dados de transcrição sem utterance:', data);
        }
      });

      // Handlers para sugestões de IA
      socketInstance.on('ai:suggestion', (data) => {
        if (data.suggestion) {
          setSuggestions(prev => [...prev, data.suggestion]);
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
  }, [sessionId]);

  // Scroll automático quando novas transcrições chegam
  useEffect(() => {
    if (transcriptionScrollRef.current && utterances.length > 0) {
      transcriptionScrollRef.current.scrollTop = transcriptionScrollRef.current.scrollHeight;
    }
  }, [utterances]);

  // Simular extração automática de dados pela IA baseada nas transcrições
  useEffect(() => {
    if (utterances.length > 0) {
      // Simular processamento de IA para extrair dados do paciente
      const latestUtterance = utterances[utterances.length - 1];
      
      // Exemplo de extração automática (em produção, isso viria do backend)
      if (latestUtterance.text.toLowerCase().includes('nasci') || latestUtterance.text.toLowerCase().includes('nascimento')) {
        // Extrair data de nascimento (exemplo)
        const birthDateMatch = latestUtterance.text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{1,2}-\d{1,2})/);
        if (birthDateMatch) {
          setPatientData(prev => ({
            ...prev,
            birthDate: birthDateMatch[0]
          }));
        }
      }
      
      if (latestUtterance.text.toLowerCase().includes('anos') || latestUtterance.text.toLowerCase().includes('idade')) {
        // Extrair idade (exemplo)
        const ageMatch = latestUtterance.text.match(/(\d+)\s*anos?/);
        if (ageMatch) {
          setPatientData(prev => ({
            ...prev,
            age: ageMatch[1] + ' anos'
          }));
        }
      }
    }
  }, [utterances]);

  // Função para iniciar sessão
  const handleStartSession = useCallback(async () => {
    if (!audioForker.isSupported) {
      alert('Seu browser não suporta a captura de áudio necessária.');
      return;
    }

    try {
      await audioForker.startRecording();
      setSessionStartTime(new Date());

      // Notificar gateway sobre início da gravação
      if (socket && connectionState.isConnected) {
        socket.emit('presential:start_recording', {
          sessionId,
          consultationId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
    }
  }, [audioForker, socket, connectionState.isConnected, sessionId, consultationId]);

  // Função para parar sessão
  const handleStopSession = useCallback(() => {
    audioForker.stopRecording();
    setSessionStartTime(null);

    // Notificar gateway sobre fim da gravação
    if (socket && connectionState.isConnected) {
      socket.emit('presential:stop_recording', {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }, [audioForker, socket, connectionState.isConnected, sessionId]);

  // Função para marcar sugestão como usada
  const handleUseSuggestion = useCallback((suggestionId: string) => {
    if (socket && connectionState.isConnected) {
      socket.emit('suggestion:used', {
        suggestionId,
        sessionId
      });
    }

    // Remover da lista
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, [socket, connectionState.isConnected, sessionId]);

  // Calcular duração da sessão
  const sessionDuration = sessionStartTime 
    ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="presential-call-room">
      {/* Header da Sessão */}
      <div className="session-header">
        <div className="session-info">
          <h1>Consulta Presencial</h1>
          <p>Paciente: <strong>{patientName}</strong></p>
          {sessionStartTime && (
            <p>Duração: <strong>{formatDuration(sessionDuration)}</strong></p>
          )}
        </div>

        <div className="session-controls">
          <div className="audio-controls-header">
            <h3>
              <Volume2 className="w-5 h-5" />
              Controle de Áudio
            </h3>
            
            <div className="mic-controls-compact">
              <div className="mic-control-compact">
                <Mic className="w-4 h-4" />
                <span>Médico</span>
              </div>
              <div className="mic-control-compact">
                <Mic className="w-4 h-4" />
                <span>Paciente</span>
              </div>
            </div>
          </div>

          <div className="recording-control">
            {!audioForker.isRecording ? (
              <button
                onClick={handleStartSession}
                className="btn btn-primary btn-large"
                disabled={connectionState.isConnecting || !connectionState.isConnected}
              >
                <Play className="w-5 h-5" />
                Iniciar Gravação
              </button>
            ) : (
              <button
                onClick={handleStopSession}
                className="btn btn-danger btn-large"
              >
                <Square className="w-5 h-5" />
                Parar Gravação
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status da Conexão */}
      {connectionState.error && (
        <div className="connection-error">
          <AlertCircle className="w-5 h-5" />
          <span>{connectionState.error}</span>
        </div>
      )}

      {connectionState.isConnecting && (
        <div className="connection-status">
          <div className="loading-spinner" />
          <span>Conectando ao servidor...</span>
        </div>
      )}

      <div className="call-content">
        {/* Painel de Anamnese */}
        <div className="anamnese-panel">
          <h2>
            <ClipboardList className="w-5 h-5" />
            Anamnese
          </h2>

          <div className="anamnese-content">
            {/* Informações do Paciente */}
            <div className="patient-info-section">
              <h3>
                <User className="w-4 h-4" />
                Informações do Paciente
              </h3>
              
              <div className="patient-field">
                <label className="patient-field-label">Nome do Paciente</label>
                <div className="patient-field-value ai-generated">
                  {patientData.name}
                </div>
                <div className="ai-indicator">
                  <Brain className="w-3 h-3" />
                  Preenchido automaticamente
                </div>
              </div>

              <div className="patient-field">
                <label className="patient-field-label">Data de Nascimento</label>
                <div className={`patient-field-value ${!patientData.birthDate ? 'waiting' : 'ai-generated'}`}>
                  {patientData.birthDate || 'Aguardando transcrição...'}
                </div>
                {patientData.birthDate && (
                  <div className="ai-indicator">
                    <Brain className="w-3 h-3" />
                    Extraído pela IA
                  </div>
                )}
              </div>
            </div>

            {/* Status do Sistema */}
            <div className="patient-info-section">
              <h3>Status do Sistema</h3>
              <div className="system-status">
                <div className="status-item">
                  <span>WebSocket:</span>
                  <span className={`status ${connectionState.isConnected ? 'connected' : 'disconnected'}`}>
                    {connectionState.isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="status-item">
                  <span>Áudio:</span>
                  <span className={`status ${audioForker.isSupported ? 'supported' : 'unsupported'}`}>
                    {audioForker.isSupported ? 'Suportado' : 'Não Suportado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Painel de Transcrição */}
        <div className="transcription-panel">
          <h2>
            <FileText className="w-5 h-5" />
            Transcrição em Tempo Real
          </h2>

          <div className="transcription-content" ref={transcriptionScrollRef}>
            {utterances.length === 0 ? (
              <p className="no-transcription">
                {audioForker.isRecording 
                  ? 'Aguardando fala...' 
                  : 'Inicie a gravação para ver a transcrição'}
              </p>
            ) : (
              <div className="utterances-list">
                {utterances.map((utterance, index) => (
                  <div 
                    key={`${utterance.id}-${index}`} 
                    className={`utterance ${utterance.speaker}`}
                  >
                    <div className="utterance-header">
                      <span className="speaker">
                        {utterance.speaker === 'doctor' ? 'Médico' : 'Paciente'}
                      </span>
                      <span className="timestamp">
                        {new Date(utterance.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <span className="confidence">
                        {Math.round(utterance.confidence * 100)}%
                      </span>
                    </div>
                    <div className="utterance-text">
                      {utterance.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel de Sugestões de IA */}
        <div className="suggestions-panel">
          <h2>
            <Brain className="w-5 h-5" />
            Sugestões de IA
          </h2>

          <div className="suggestions-content">
            {suggestions.length === 0 ? (
              <p className="no-suggestions">
                Nenhuma sugestão disponível
              </p>
            ) : (
              <div className="suggestions-list">
                {suggestions.map((suggestion) => (
                  <div 
                    key={suggestion.id} 
                    className={`suggestion ${suggestion.type}`}
                  >
                    <div className="suggestion-header">
                      <span className="type">
                        {suggestion.type === 'question' && 'Pergunta'}
                        {suggestion.type === 'diagnosis' && 'Diagnóstico'}
                        {suggestion.type === 'treatment' && 'Tratamento'}
                        {suggestion.type === 'note' && 'Observação'}
                      </span>
                      <span className="confidence">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <div className="suggestion-text">
                      {suggestion.text}
                    </div>
                    <button
                      onClick={() => handleUseSuggestion(suggestion.id)}
                      className="btn btn-sm btn-outline"
                    >
                      Usar Sugestão
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
