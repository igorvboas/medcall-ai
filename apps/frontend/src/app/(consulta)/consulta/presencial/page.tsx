'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useRouter, useSearchParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { AlertCircle, CheckCircle, XCircle, Radio, AlertTriangle, ArrowLeft, ClipboardList, X, FileText } from 'lucide-react';
import { DualMicrophoneControl } from '@/components/presencial/DualMicrophoneControl';
import { PresencialTranscription } from '@/components/presencial/PresencialTranscription';
import { usePresencialAudioCapture } from '@/hooks/usePresencialAudioCapture';
import { usePresencialSingleMicCapture } from '@/hooks/usePresencialSingleMicCapture';
import { MicModeToggle } from '@/components/presencial/MicModeToggle';
import { SingleMicrophoneControl } from '@/components/presencial/SingleMicrophoneControl';
import { formatDuration, blobToBase64 } from '@/lib/audioUtils';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { supabase } from '@/lib/supabase';

import { TranscriptionSegment, Speaker } from '@/types/transcription';
import { useMicMonitor } from '@/hooks/useMicMonitor';
import { useBeforeUnloadProtection } from '@/hooks/useBeforeUnloadProtection';
import { MicAlertBanner } from '@/components/alerts/MicAlertBanner';

const IS_DEV = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_NODE_ENV !== 'production';

function PresencialConsultationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const consultationId = searchParams.get('consultationId');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  const [doctorMicrophoneId, setDoctorMicrophoneId] = useState('');
  const [patientMicrophoneId, setPatientMicrophoneId] = useState('');

  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [duration, setDuration] = useState(0);

  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [showQuestionarioPopup, setShowQuestionarioPopup] = useState(false);
  const [showAnamnesePopup, setShowAnamnesePopup] = useState(false);
  const [allAnamneses, setAllAnamneses] = useState<any[]>([]);
  const [selectedAnamneseIndex, setSelectedAnamneseIndex] = useState(0);

  // Single-mic mode state
  const [micMode, setMicMode] = useState<'single' | 'dual'>('dual');
  const [singleMicId, setSingleMicId] = useState('');
  const [isFinalizingAudio, setIsFinalizingAudio] = useState(false);

  // Estados para monitoramento de niveis de audio durante setup
  const [doctorMicLevel, setDoctorMicLevel] = useState(0);
  const [patientMicLevel, setPatientMicLevel] = useState(0);
  const [singleMicLevel, setSingleMicLevel] = useState(0);
  const doctorStreamRef = useRef<MediaStream | null>(null);
  const patientStreamRef = useRef<MediaStream | null>(null);
  const singleStreamRef = useRef<MediaStream | null>(null);
  const doctorAnalyserRef = useRef<AnalyserNode | null>(null);
  const patientAnalyserRef = useRef<AnalyserNode | null>(null);
  const singleAnalyserRef = useRef<AnalyserNode | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hook de captura de audio - BOTH hooks called unconditionally (React rules of hooks)
  const dualCapture = usePresencialAudioCapture({
    socket: micMode === 'dual' ? socket : null,
    doctorMicrophoneId,
    patientMicrophoneId
  });

  // Buscar anamneses do paciente via consultationId
  useEffect(() => {
    if (!consultationId) return;
    (async () => {
      try {
        const { data: consulta } = await supabase.from('consultations').select('patient_id').eq('id', consultationId).maybeSingle();
        if (!consulta?.patient_id) return;
        const { data: anamneses } = await supabase.from('a_cadastro_anamnese').select('*').eq('paciente_id', consulta.patient_id).order('created_at', { ascending: false });
        if (anamneses && anamneses.length > 0) setAllAnamneses(anamneses);
      } catch (e) { console.error('Erro ao buscar anamneses:', e); }
    })();
  }, [consultationId]);

  const singleCapture = usePresencialSingleMicCapture({
    socket: micMode === 'single' ? socket : null,
    microphoneId: singleMicId
  });

  // Unified capture interface
  const activeCapture = micMode === 'single' ? {
    isRecording: singleCapture.isRecording,
    startCapture: singleCapture.startCapture,
    stopCapture: singleCapture.stopCapture,
    pendingChunks: singleCapture.pendingChunks,
  } : {
    isRecording: dualCapture.isRecording,
    startCapture: dualCapture.startCapture,
    stopCapture: dualCapture.stopCapture,
    pendingChunks: dualCapture.pendingChunks,
  };

  // Select stream to monitor based on mic mode
  const streamToMonitor = micMode === 'single'
    ? singleCapture.stream
    : dualCapture.doctorStream;

  const { isMicConnected, isSilent } = useMicMonitor(streamToMonitor, activeCapture.isRecording);
  useBeforeUnloadProtection(activeCapture.isRecording);

  // Monitorar niveis de audio durante setup (antes de iniciar sessao)
  useEffect(() => {
    if (sessionStarted) {
      return;
    }

    const startLevelMonitoring = async () => {
      // Limpar streams anteriores
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (singleStreamRef.current) {
        singleStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      // Single-mic mode monitoring
      if (micMode === 'single') {
        setDoctorMicLevel(0);
        setPatientMicLevel(0);

        if (!singleMicId) {
          setSingleMicLevel(0);
          return;
        }

        try {
          const singleStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: singleMicId ? { exact: singleMicId } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });

          singleStreamRef.current = singleStream;

          const audioContext = new AudioContext();
          const singleSource = audioContext.createMediaStreamSource(singleStream);
          const singleAnalyser = audioContext.createAnalyser();
          singleAnalyser.fftSize = 256;
          singleSource.connect(singleAnalyser);
          singleAnalyserRef.current = singleAnalyser;

          const calculateVolumeLevel = (analyser: AnalyserNode): number => {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            return Math.min(average / 128, 1);
          };

          levelIntervalRef.current = setInterval(() => {
            if (singleAnalyserRef.current) {
              const level = calculateVolumeLevel(singleAnalyserRef.current);
              setSingleMicLevel(level);
            }
          }, 100);

        } catch (err) {
          console.error('Erro ao monitorar nivel de audio (single):', err);
          setSingleMicLevel(0);
        }

        return;
      }

      // Dual-mic mode monitoring (original logic)
      setSingleMicLevel(0);

      if (!doctorMicrophoneId || !patientMicrophoneId) {
        setDoctorMicLevel(0);
        setPatientMicLevel(0);
        return;
      }

      try {
        const doctorStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: doctorMicrophoneId ? { exact: doctorMicrophoneId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        const patientStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: patientMicrophoneId ? { exact: patientMicrophoneId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        doctorStreamRef.current = doctorStream;
        patientStreamRef.current = patientStream;

        const audioContext = new AudioContext();
        const doctorSource = audioContext.createMediaStreamSource(doctorStream);
        const patientSource = audioContext.createMediaStreamSource(patientStream);

        const doctorAnalyser = audioContext.createAnalyser();
        const patientAnalyser = audioContext.createAnalyser();

        doctorAnalyser.fftSize = 256;
        patientAnalyser.fftSize = 256;

        doctorSource.connect(doctorAnalyser);
        patientSource.connect(patientAnalyser);

        doctorAnalyserRef.current = doctorAnalyser;
        patientAnalyserRef.current = patientAnalyser;

        const calculateVolumeLevel = (analyser: AnalyserNode): number => {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          return Math.min(average / 128, 1);
        };

        levelIntervalRef.current = setInterval(() => {
          if (doctorAnalyserRef.current) {
            const level = calculateVolumeLevel(doctorAnalyserRef.current);
            setDoctorMicLevel(level);
          }

          if (patientAnalyserRef.current) {
            const level = calculateVolumeLevel(patientAnalyserRef.current);
            setPatientMicLevel(level);
          }
        }, 100);

      } catch (err) {
        console.error('Erro ao monitorar niveis de audio:', err);
        setDoctorMicLevel(0);
        setPatientMicLevel(0);
      }
    };

    startLevelMonitoring();

    // Cleanup
    return () => {
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
      }
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (singleStreamRef.current) {
        singleStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [doctorMicrophoneId, patientMicrophoneId, singleMicId, micMode, sessionStarted]);

  // Timer de duracao
  useEffect(() => {
    if (!sessionStarted) return;

    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStarted]);

  // Conectar Socket.IO
  useEffect(() => {
    let realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'ws://localhost:3002';

    if (!process.env.NEXT_PUBLIC_REALTIME_WS_URL && typeof window !== 'undefined') {
      console.warn('NEXT_PUBLIC_REALTIME_WS_URL nao configurada, usando fallback');
    }

    if (realtimeUrl.startsWith('wss://')) {
      realtimeUrl = realtimeUrl.replace('wss://', 'https://');
    } else if (realtimeUrl.startsWith('ws://')) {
      realtimeUrl = realtimeUrl.replace('ws://', 'http://');
    }

    console.log('Conectando Socket.IO para:', realtimeUrl);

    const newSocket = io(realtimeUrl, {
      auth: {
        userName: 'Doctor',
        password: 'x'
      },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      upgrade: true,
      forceNew: false,
      rememberUpgrade: true
    });

    newSocket.on('connect', () => {
      console.log('Socket conectado via', newSocket.io.engine.transport.name);
      setSocketConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
      setSocketConnected(false);

      if (reason === 'io server disconnect') {
        console.warn('Servidor desconectou a conexao');
        setError('Conexao encerrada pelo servidor');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Erro de conexao Socket.IO:', error);
      setSocketConnected(false);

      let errorMessage = 'Erro de conexao WebSocket';
      if (error.message.includes('websocket error')) {
        errorMessage = 'Falha ao conectar ao servidor. Tentando novamente...';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout ao conectar. Verifique sua conexao.';
      } else {
        errorMessage = `Erro de conexao: ${error.message}`;
      }

      setError(errorMessage);
    });

    (newSocket.io as any).on('upgrade', () => {
      console.log('Transporte atualizado para:', newSocket.io.engine.transport.name);
    });

    (newSocket.io as any).on('upgradeError', (error: any) => {
      console.warn('Erro ao fazer upgrade para websocket, continuando com polling:', error);
    });

    // Receber transcricoes imediatas (5s chunks)
    // Salva texto incremental. Diarizacao real acontece no final com audio completo.
    newSocket.on('presencialTranscription', (data: any) => {
      console.log('Nova transcricao:', data);
      const isMixed = data.speaker === 'mixed' || data.speaker === 'unknown';

      const mappedData: TranscriptionSegment = {
        id: `t-${data.sequence || Date.now()}`,
        text: data.text,
        speaker: isMixed ? 'UNKNOWN' :
                 data.speaker === 'doctor' ? 'MEDICO' : 'PACIENTE',
        participantId: isMixed ? undefined : data.speaker,
        timestamp: data.timestamp,
        confidence: 1.0,
      };
      setTranscriptions(prev => [...prev, mappedData]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Buscar dados da consulta
  useEffect(() => {
    const loadConsultation = async () => {
      if (!consultationId) return;

      try {
        const response = await gatewayClient.get(`/consultations/${consultationId}`);
        if (response.success && response.patient_name) {
          setPatientName(response.patient_name);
        } else if (response.error) {
          console.error('Erro ao carregar consulta:', response.error);
          setError(response.error);
        }
      } catch (error) {
        console.error('Erro ao carregar consulta:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    };

    loadConsultation();

    const loadDoctor = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('Usuario nao autenticado');
          return;
        }

        const { data: medico, error: medicoError } = await supabase
          .from('medicos')
          .select('*')
          .eq('user_auth', user.id)
          .single();

        if (!medicoError && medico) {
          setDoctorName(medico.name || 'Dr. Medico');
        }
      } catch (error) {
        console.error('Erro ao carregar medico:', error);
      }
    };

    loadDoctor();
  }, [consultationId]);

  const handleMicrophonesSelected = (doctorMic: string, patientMic: string) => {
    setDoctorMicrophoneId(doctorMic);
    setPatientMicrophoneId(patientMic);
  };

  const handleStartSession = async () => {
    if (!socket || !consultationId) {
      setError('Socket nao conectado ou consulta nao encontrada');
      return;
    }

    // Validate based on mode
    if (micMode === 'single' && !singleMicId) {
      setError('Selecione o microfone');
      return;
    }
    if (micMode === 'dual' && (!doctorMicrophoneId || !patientMicrophoneId)) {
      setError('Selecione os microfones');
      return;
    }

    try {
      socket.emit('startPresencialSession', {
        consultationId,
        micMode: micMode,
        doctorMicrophoneId: micMode === 'single' ? singleMicId : doctorMicrophoneId,
        ...(micMode === 'dual' ? { patientMicrophoneId } : {}),
      }, async (response: any) => {
        if (response.success) {
          console.log('Sessao iniciada:', response.sessionId);

          setSessionId(response.sessionId);
          setSessionStarted(true);

          // Parar streams de monitoramento de nivel
          if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
          }
          if (doctorStreamRef.current) {
            doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            doctorStreamRef.current = null;
          }
          if (patientStreamRef.current) {
            patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            patientStreamRef.current = null;
          }
          if (singleStreamRef.current) {
            singleStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            singleStreamRef.current = null;
          }

          await new Promise(resolve => setTimeout(resolve, 100));

          console.log('Iniciando captura de audio com sessionId:', response.sessionId);
          await activeCapture.startCapture(response.sessionId);
        } else {
          setError(response.error || 'Erro ao iniciar sessao');
        }
      });
    } catch (error) {
      console.error('Erro ao iniciar sessao:', error);
      setError('Erro ao iniciar sessao');
    }
  };

  const handleEndSession = async () => {
    if (!socket || !sessionId) return;

    try {
      setIsFinalizingAudio(true);

      // Em single-mic: pegar audio completo da consulta antes de parar
      let fullAudioBase64: string | undefined;
      if (micMode === 'single') {
        console.log('[EndSession] Obtendo audio completo da consulta...');
        const fullBlob = await singleCapture.getFullSessionAudio();
        console.log(`[EndSession] Audio completo: ${(fullBlob.size / 1024 / 1024).toFixed(2)} MB`);
        if (fullBlob.size > 0) {
          fullAudioBase64 = await blobToBase64(fullBlob);
          console.log(`[EndSession] Base64: ${(fullAudioBase64.length / 1024 / 1024).toFixed(2)} MB`);
        }
      }

      // Parar captura
      activeCapture.stopCapture();

      // Enviar para backend com audio completo
      socket.emit('endPresencialSession', {
        sessionId,
        fullAudioData: fullAudioBase64, // undefined se dual-mic
      }, (response: any) => {
        setIsFinalizingAudio(false);
        if (response.success) {
          console.log('Sessao finalizada');
          router.push('/consultas');
        } else {
          setError(response.error || 'Erro ao finalizar sessao');
        }
      });
    } catch (err) {
      setIsFinalizingAudio(false);
      console.error('[EndSession] Erro:', err);
      setError('Erro ao finalizar consulta');
    }
  };

  if (!consultationId) {
    return (
      <div className="presencial-page">
        <div className="error-card">
          <XCircle className="error-icon" size={48} />
          <h2>Consulta nao encontrada</h2>
          <p>ID da consulta nao fornecido</p>
          <button onClick={() => router.push('/consultas')} className="btn btn-primary">
            <ArrowLeft size={18} />
            Voltar para Consultas
          </button>
        </div>
      </div>
    );
  }

  const bars = [0.3, 0.5, 0.7, 0.85, 0.95, 1, 0.9, 0.75, 0.6, 0.8, 1, 0.85, 0.7, 0.55, 0.9, 1, 0.8, 0.65, 0.5, 0.35, 0.6, 0.75, 0.9, 0.7, 0.45, 0.8, 0.95, 0.6, 0.4, 0.55];

  return (
    <div className="presencial-page">
      <div className="page-header">
        <h1>Consulta Presencial</h1>
        <p>Paciente: {patientName || 'Carregando...'}</p>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      <MicAlertBanner isMicConnected={isMicConnected} isSilent={isSilent} />

      {!sessionStarted ? (
        // Setup: Selecao de microfones
        <div className="setup-container">
          <MicModeToggle
            mode={micMode}
            onModeChange={setMicMode}
            disabled={sessionStarted}
          />

          {micMode === 'single' ? (
            <SingleMicrophoneControl
              onMicrophoneSelected={setSingleMicId}
              audioLevel={singleMicLevel}
              disabled={!socketConnected}
            />
          ) : (
            <DualMicrophoneControl
              onMicrophonesSelected={handleMicrophonesSelected}
              disabled={!socketConnected}
              doctorLevel={doctorMicLevel}
              patientLevel={patientMicLevel}
            />
          )}

          <div className="actions">
            <button
              onClick={handleStartSession}
              disabled={
                !socketConnected ||
                (micMode === 'single' ? !singleMicId : (!doctorMicrophoneId || !patientMicrophoneId))
              }
              className="btn btn-primary btn-lg"
            >
              {!socketConnected ? 'Conectando...' : 'Iniciar Consulta'}
            </button>

            <button
              onClick={() => router.push('/consultas')}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        // Consulta em andamento
        <div className="consultation-container">
          <div className="consultation-controls">
            <div className="status-bar">
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className="status-value recording">
                  <Radio className="recording-icon" size={16} />
                  Gravando
                </span>
              </div>

              <div className="status-item">
                <span className="status-label">Duracao:</span>
                <span className="status-value">{formatDuration(duration)}</span>
              </div>

              <div className="status-item">
                <span className="status-label">Conexao:</span>
                <span className={`status-value ${socketConnected ? 'connected' : 'disconnected'}`}>
                  {socketConnected ? (
                    <>
                      <CheckCircle className="status-icon" size={16} />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="status-icon" size={16} />
                      Desconectado
                    </>
                  )}
                </span>
              </div>

              {micMode === 'single' && isFinalizingAudio && (
                <div className="status-item">
                  <span className="status-label">Status:</span>
                  <span className="status-value">Processando audio...</span>
                </div>
              )}
            </div>

            {micMode === 'single' ? (
              <SingleMicrophoneControl
                onMicrophoneSelected={setSingleMicId}
                audioLevel={singleCapture.audioLevel}
                disabled={true}
                initialMic={singleMicId}
              />
            ) : (
              <DualMicrophoneControl
                onMicrophonesSelected={handleMicrophonesSelected}
                disabled={true}
                doctorLevel={dualCapture.doctorLevel}
                patientLevel={dualCapture.patientLevel}
                initialDoctorMic={doctorMicrophoneId}
                initialPatientMic={patientMicrophoneId}
              />
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => { setSelectedAnamneseIndex(0); setShowAnamnesePopup(true); }}
                disabled={allAnamneses.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9, border: 'none', background: allAnamneses.length > 0 ? '#1B4266' : '#CBD5E1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: allAnamneses.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                <FileText size={16} />
                Ver Anamnese
              </button>
              <button
                onClick={() => setShowQuestionarioPopup(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9, border: 'none', background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <ClipboardList size={16} />
                Questionário
              </button>
            </div>

            <div className="finish-button">
              <button
                onClick={() => setShowConfirmEndModal(true)}
                className="btn btn-danger btn-lg"
              >
                Finalizar Consulta
              </button>
            </div>
          </div>

          {/* Visualizador de Audio / Transcricao */}
          <div className="audio-visualizer-panel">
            {micMode === 'single' ? (
              <>
                <div className="audio-viz-row" style={{ flex: 'none' }}>
                  <div className="audio-viz-card">
                    <div className="audio-viz-label" style={{ color: singleCapture.audioLevel > 0.03 ? '#1B4266' : '#94A3B8' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: singleCapture.audioLevel > 0.03 ? '#1B4266' : '#E2E8F0', display: 'inline-block', marginRight: 6 }} />
                      Microfone Compartilhado
                    </div>
                    <div className="audio-viz-bars">
                      {bars.map((factor, i) => {
                        const h = singleCapture.audioLevel > 0.03 ? Math.max(6, singleCapture.audioLevel * factor * 100) : 6;
                        return (
                          <div key={i} className="audio-viz-bar" style={{ height: `${h}%`, background: singleCapture.audioLevel > 0.03 ? '#1B4266' : '#E2E8F0' }} />
                        );
                      })}
                    </div>
                  </div>
                </div>
                {IS_DEV && (
                  <div className="dev-transcription-panel">
                    <div className="dev-badge">DEV — Transcricao incremental (nao visivel em producao)</div>
                    <PresencialTranscription
                      transcriptions={transcriptions}
                      doctorName={doctorName}
                      patientName={patientName}
                      micMode={micMode}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="audio-viz-row">
                  {[
                    { label: 'Profissional', level: dualCapture.doctorLevel || 0, color: '#1B4266' },
                    { label: 'Paciente', level: dualCapture.patientLevel || 0, color: '#22c55e' },
                  ].map((mic) => {
                    const isActive = mic.level > 0.03;
                    return (
                      <div key={mic.label} className="audio-viz-card">
                        <div className="audio-viz-label" style={{ color: isActive ? mic.color : '#94A3B8' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? mic.color : '#E2E8F0', display: 'inline-block', marginRight: 6 }} />
                          {mic.label}
                        </div>
                        <div className="audio-viz-bars">
                          {bars.map((factor, i) => {
                            const h = isActive ? Math.max(6, mic.level * factor * 100) : 6;
                            return (
                              <div key={i} className="audio-viz-bar" style={{ height: `${h}%`, background: isActive ? mic.color : '#E2E8F0' }} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="transcription-panel">
                  <PresencialTranscription
                    transcriptions={transcriptions}
                    doctorName={doctorName}
                    patientName={patientName}
                    micMode={micMode}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmacao para finalizar consulta */}
      <ConfirmModal
        isOpen={showConfirmEndModal}
        onClose={() => setShowConfirmEndModal(false)}
        onConfirm={handleEndSession}
        title="Finalizar Consulta"
        message="Tem certeza que deseja finalizar esta consulta? O audio completo sera processado para identificar quem falou o que."
        confirmText="Sim, Finalizar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Popup Anamnese */}
      {showAnamnesePopup && allAnamneses.length > 0 && (
        <div onClick={() => setShowAnamnesePopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#fff" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Histórico de Anamneses</h3>
              </div>
              <button onClick={() => setShowAnamnesePopup(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ width: 160, borderRight: '1px solid #E2E8F0', overflowY: 'auto', background: '#FAFBFC', padding: '8px 0' }}>
                {allAnamneses.map((a, idx) => (
                  <button key={idx} onClick={() => setSelectedAnamneseIndex(idx)}
                    style={{ width: '100%', padding: '10px 14px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: selectedAnamneseIndex === idx ? '#EBF3F6' : 'transparent', borderLeft: selectedAnamneseIndex === idx ? '3px solid #1B4266' : '3px solid transparent' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selectedAnamneseIndex === idx ? '#1B4266' : '#64748B' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : `Anamnese ${idx + 1}`}
                    </div>
                    {idx === 0 && <div style={{ fontSize: 10, color: '#1B4266', fontWeight: 700, marginTop: 2 }}>Mais recente</div>}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {(() => {
                  const a = allAnamneses[selectedAnamneseIndex];
                  if (!a) return null;
                  const sections = [
                    { title: 'Dados Pessoais', fields: [{ label: 'Nome', value: a.nome_completo }, { label: 'Email', value: a.email }, { label: 'Telefone', value: a.telefone }, { label: 'Data Nasc.', value: a.data_nascimento }, { label: 'Gênero', value: a.genero }, { label: 'Profissão', value: a.profissao }] },
                    { title: 'Medidas', fields: [{ label: 'Peso Atual', value: a.peso_atual }, { label: 'Altura', value: a.altura }, { label: 'Peso Desejado', value: a.peso_desejado }] },
                    { title: 'Sono, Água e Jejum', fields: [{ label: 'Sono', value: a.avaliacao_sono }, { label: 'Água', value: a.consumo_agua }, { label: 'Urina', value: a.cor_urina }, { label: 'Jejum', value: a.pratica_jejum }] },
                    { title: 'Objetivo e Atividade', fields: [{ label: 'Objetivo', value: a.objetivo_principal }, { label: 'Atividade', value: a.patrica_atividade_fisica }, { label: 'Frequência', value: a.frequencia_deseja_treinar }] },
                    { title: 'Saúde', fields: [{ label: 'Medicamentos', value: a.toma_medicamentos }, { label: 'Detalhes', value: a.medicamentos_detalhes }, { label: 'Condições', value: Array.isArray(a.condicoes) ? a.condicoes.join(', ') : a.condicoes }] },
                  ];
                  return sections.map(s => {
                    const vf = s.fields.filter(f => f.value);
                    if (!vf.length) return null;
                    return (<div key={s.title} style={{ marginBottom: 20 }}><h4 style={{ fontSize: 13, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', marginBottom: 10 }}>{s.title}</h4><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px' }}>{vf.map(f => (<div key={f.label} style={{ padding: '6px 0' }}><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>{f.label}</div><div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{String(f.value)}</div></div>))}</div></div>);
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Questionário */}
      {showQuestionarioPopup && (
        <div onClick={() => setShowQuestionarioPopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={18} color="#fff" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Roteiro de Condução Clínica</h3>
              </div>
              <button onClick={() => setShowQuestionarioPopup(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: 'center', fontStyle: 'italic' }}>Roteiro com o objetivo de encontrar a CAUSA RAIZ</p>
              {[
                { mod: '1', title: 'Abertura do Campo', obj: 'Estabilizar o campo emocional e identificar a queixa principal de entrada', questions: ['1. O que hoje mais te incomoda na sua vida ou na sua saúde?', '2. O que você gostaria de melhorar neste momento?', '3. Se pudesse resolver apenas uma coisa agora, qual seria?'] },
                { mod: '2', title: 'Leitura da Queixa', obj: 'Mapear palavras-chave, linguagem emocional, padrão de ameaça e início da suspeita de Reino', questions: ['4. Desde quando isso começou?', '5. O que estava acontecendo na sua vida nessa época?', '6. Isso surgiu de forma súbita ou foi aos poucos? □ Súbita □ Aos poucos □ Não sabe', '7. O que isso te impede de fazer hoje?', '8. Em quais momentos piora?', '9. Em quais momentos melhora?', '10. Se esse sintoma pudesse falar, o que ele diria?'] },
                { mod: '3', title: 'Sensação Corporal (Reino)', obj: 'Classificar o padrão sensorial em Vegetal, Mineral ou Animal', questions: ['11. Qual é a sensação exata no corpo?', '12. É pressão, aperto, peso, queimação, bloqueio, invasão ou fragilidade? □ Pressão □ Aperto □ Peso □ Queimação □ Bloqueio □ Invasão □ Fragilidade □ Outro', '13. Onde exatamente você sente isso?', '14. Essa sensação se move ou fica fixa? □ Move □ Fixa □ Varia', '15. Isso te lembra algo da sua vida?'] },
                { mod: '4', title: 'Emoção de Sobrevivência (Eixo HPA)', obj: 'Identificar o medo dominante, padrão de defesa e ativação simpática ou colapso', questions: ['16. O que você mais teme perder hoje?', '17. O que mais te gera medo?', '18. O que mais te gera raiva?', '19. Você se sente ameaçado, pressionado, abandonado ou desvalorizado? □ Ameaçado □ Pressionado □ Abandonado □ Desvalorizado', '20. Você sente que precisa se defender da vida? □ Sim □ Não □ Às vezes'] },
                { mod: '5', title: 'Projeto de Vida (IKIGAI)', obj: 'Avaliar presença ou ausência de propósito, bloqueio existencial e coerência de vida', questions: ['21. Qual é seu projeto de vida hoje?', '22. Como você se imagina daqui a 5 anos?', '23. O que te dá sentido para viver?', '24. O que você gostaria de estar vivendo e não consegue?'] },
                { mod: '6', title: 'História de Vida (Mapa do Miasma)', obj: 'Detectar padrões repetitivos, traumas não resolvidos e origem do conflito', questions: ['25. Como foi sua infância?', '26. Como eram seus pais com você?', '27. Houve perdas importantes? □ Sim □ Não', '28. Houve mudanças bruscas na sua vida? □ Sim □ Não', '29. Existe algo que se repete na sua vida e você não entende por quê?'] },
                { mod: '7', title: 'Histórico Gestacional', obj: 'Correlacionar ansiedade precoce, eixo HPA, microbiota e comportamento desde a gestação', questions: ['30. A gestação foi planejada ou surpresa? □ Planejada □ Surpresa □ Não sabe', '31. Como sua mãe se sentia durante a gravidez?', '32. Houve medo, rejeição ou estresse? □ Sim □ Não □ Não sabe', '33. Houve intercorrências na gestação ou parto? □ Sim □ Não □ Não sabe'] },
                { mod: '8', title: 'Setênios (Localização do Trauma)', obj: 'Identificar o ponto de ruptura e início do padrão em cada fase da vida', questions: ['34. Entre 0 e 7 anos, algo marcou sua vida?', '35. Entre 7 e 14 anos?', '36. Entre 14 e 21 anos?', '37. Em qual fase você sente que algo mudou dentro de você?'] },
                { mod: '9', title: 'Eixos Fisiológicos', obj: 'Avaliar padrões de sono, intestino e metabolismo', questions: ['— Sono —', '38. Você dorme bem? □ Sim □ Não □ Regularmente', '39. Acorda cansado(a)? □ Sim □ Não □ Às vezes', '40. Acorda durante a noite? □ Sim □ Não □ Às vezes', '— Intestino —', '41. Como é seu intestino?', '42. Tem gases, distensão ou constipação? □ Gases □ Distensão □ Constipação □ Nenhum', '— Metabolismo —', '43. Tem ganho de peso? □ Sim □ Não □ Estável', '44. Tem desejo por doces? □ Sim □ Não □ Às vezes', '45. Já teve alteração de glicose? □ Sim □ Não □ Não sabe'] },
                { mod: '10', title: 'Hábitos e Estilo de Vida', obj: 'Mapear fatores externos que impactam o processo saúde-doença', questions: ['46. Como é sua alimentação?', '47. Você pratica atividade física? □ Sim □ Não □ Às vezes', '48. Como é sua rotina de trabalho?', '49. Você tem momentos de descanso? □ Sim □ Não □ Raramente'] },
                { mod: '11', title: 'Fechamento do Campo', obj: 'Integrar a percepção do paciente e alinhar expectativas terapêuticas', questions: ['50. O que você acredita que seu corpo está tentando te mostrar?', '51. O que você espera desse tratamento?'] },
              ].map(m => (
                <div key={m.mod} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', marginBottom: 12 }}>Módulo {m.mod} — {m.title}</div>
                  <p style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginBottom: 10 }}>Objetivo: {m.obj}</p>
                  <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 2 }}>
                    {m.questions.map((q, i) => {
                      if (q.startsWith('—')) return <div key={i} style={{ fontWeight: 600, color: '#1B4266', marginTop: 8 }}>{q.replace(/—/g, '').trim()}</div>;
                      const parts = q.split('□');
                      return <div key={i}>{parts[0]}{parts.length > 1 && <span style={{ color: '#94A3B8' }}>{parts.slice(1).map((p, j) => `□${p}`).join('')}</span>}</div>;
                    })}
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 16, padding: 16, background: '#F8FAFC', borderRadius: 10, border: '1.5px solid #E2E8F0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', marginBottom: 12 }}>Processamento — Análise AUTON</div>
                <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 2.2 }}>
                  <div><strong>Reino predominante:</strong> _______________</div>
                  <div><strong>Miasma ativo:</strong> _______________</div>
                  <div><strong>Eixos comprometidos:</strong> _______________</div>
                  <div><strong>Prioridade terapêutica:</strong> _______________</div>
                  <div style={{ marginTop: 10 }}><strong>Sequência terapêutica sugerida:</strong></div>
                  <div style={{ color: '#64748B' }}>□ 1. Sistema nervoso □ 2. Intestino □ 3. Inflamação □ 4. Hormonal □ 5. Emocional □ 6. Propósito</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', marginTop: 20 }}>"Não escute apenas o que o paciente diz. Escute o que o corpo dele está tentando resolver." — AUTON USI</p>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de finalizacao */}
      {isFinalizingAudio && (
        <div className="finalizing-overlay">
          <div className="finalizing-card">
            <div className="finalizing-spinner" />
            <h3>Finalizando consulta...</h3>
            <p>Processando audio e identificando speakers. Isso pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .presencial-page {
          min-height: 100vh;
          background: #EBF3F6;
          padding: 8px 20px 12px 20px;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .page-header {
          text-align: center;
          color: #1B4266;
          margin-bottom: 4px;
          flex-shrink: 0;
        }

        .page-header h1 {
          font-size: 20px;
          margin: 0 0 2px 0;
          font-weight: 700;
          color: #1B4266;
        }

        .page-header p {
          font-size: 13px;
          color: #5B5B5B;
          font-weight: 500;
          margin: 0;
        }

        .page-header h1 {
          font-size: 32px;
          margin: 0 0 8px 0;
          font-weight: 700;
          color: #1B4266;
        }

        .page-header p {
          font-size: 18px;
          color: #5B5B5B;
          font-weight: 500;
        }

        .error-banner {
          background: #fee2e2;
          color: #b91c1c;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 500;
          border-left: 4px solid #dc2626;
        }

        .error-card {
          background: white;
          padding: 60px 40px;
          border-radius: 16px;
          text-align: center;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .error-icon {
          color: #dc2626;
        }

        .error-card h2 {
          margin: 0;
        }

        .setup-container {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .actions {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        .consultation-wrapper {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .consultation-container {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          align-items: stretch;
          flex: 1;
        }

        .consultation-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: fit-content;
        }

        .status-bar {
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid #E5E7EB;
          flex-shrink: 0;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          border-bottom: 1px solid #F3F4F6;
        }

        .status-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .status-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        .status-value {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }

        .status-value {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .status-icon {
          flex-shrink: 0;
        }

        .recording-icon {
          color: #dc2626;
        }

        .status-value.recording {
          color: #dc2626;
        }

        .status-value.connected {
          color: #10b981;
        }

        .status-value.connected .status-icon {
          color: #10b981;
        }

        .status-value.disconnected {
          color: #ef4444;
        }

        .status-value.disconnected .status-icon {
          color: #ef4444;
        }

        .speaker-0-active {
          color: #1B4266;
        }

        .speaker-1-active {
          color: #10B981;
        }

        .transcription-panel {
          min-height: 400px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .dev-transcription-panel {
          position: relative;
          border: 2px dashed #F59E0B;
          border-radius: 12px;
          overflow: hidden;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 300px;
          max-height: calc(100vh - 100px);
          opacity: 0.85;
        }

        .dev-badge {
          background: #F59E0B;
          color: white;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          padding: 4px 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .audio-visualizer-panel {
          padding: 8px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .audio-viz-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .audio-viz-card {
          background: #fff;
          border: 1.5px solid #E2E8F0;
          border-radius: 14px;
          padding: 12px 16px;
          text-align: center;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .audio-viz-label {
          font-size: 13px;
          font-weight: 700;
          color: #0F172A;
          margin-bottom: 8px;
          flex-shrink: 0;
        }

        .audio-viz-bars {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
          flex: 1;
          min-height: 150px;
          padding: 0 4px;
        }

        .audio-viz-bar {
          flex: 1;
          max-width: 10px;
          min-height: 4px;
          border-radius: 4px;
          transition: height 0.1s ease;
        }

        .finish-button {
          margin-top: auto;
          padding-top: 12px;
        }

        .btn {
          padding: 14px 28px;
          border: none;
          border-radius: 9px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-lg {
          padding: 12px 24px;
          font-size: 16px;
          width: 100%;
          flex-shrink: 0;
        }

        .btn-primary {
          background: #1B4266;
          color: white;
          box-shadow: 0 2px 4px rgba(27, 66, 102, 0.2);
        }

        .btn-primary:hover:not(:disabled) {
          background: #153350;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(27, 66, 102, 0.3);
        }

        .btn-secondary {
          background: white;
          color: #1B4266;
          border: 2px solid #1B4266;
        }

        .btn-secondary:hover {
          background: #F3F4F6;
        }

        .btn-danger {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }

        .btn-danger:hover {
          background: #b91c1c;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        @media (max-width: 1024px) {
          .consultation-container {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .consultation-controls {
            order: 2;
          }

          .transcription-panel {
            order: 1;
            max-height: 500px;
            min-height: 400px;
          }

          .finish-button {
            margin-top: 12px;
            padding-top: 0;
          }
        }

        @media (max-height: 800px) {
          .transcription-panel {
            max-height: calc(100vh - 200px);
            min-height: 400px;
          }
        }

        .finalizing-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .finalizing-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .finalizing-card h3 {
          margin: 16px 0 8px;
          color: #1B4266;
          font-size: 20px;
        }

        .finalizing-card p {
          margin: 0;
          color: #6B7280;
          font-size: 14px;
        }

        .finalizing-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #E5E7EB;
          border-top-color: #1B4266;
          border-radius: 50%;
          margin: 0 auto;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function PresencialConsultationPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PresencialConsultationContent />
    </Suspense>
  );
}
