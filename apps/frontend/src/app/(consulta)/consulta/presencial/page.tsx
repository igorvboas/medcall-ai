'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { AlertCircle, CheckCircle, XCircle, Radio, AlertTriangle, ArrowLeft } from 'lucide-react';
import { DualMicrophoneControl } from '@/components/presencial/DualMicrophoneControl';
import { PresencialTranscription } from '@/components/presencial/PresencialTranscription';
import { usePresencialAudioCapture } from '@/hooks/usePresencialAudioCapture';
import { formatDuration } from '@/lib/audioUtils';

interface Transcription {
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  sequence: number;
}

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

  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [duration, setDuration] = useState(0);

  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Hook de captura de áudio
  const {
    isRecording,
    startCapture,
    stopCapture,
    doctorLevel,
    patientLevel,
    pendingChunks
  } = usePresencialAudioCapture({
    socket,
    doctorMicrophoneId,
    patientMicrophoneId
  });

  // Timer de duração
  useEffect(() => {
    if (!sessionStarted) return;

    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStarted]);

  // Conectar Socket.IO
  useEffect(() => {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001';

    const newSocket = io(gatewayUrl, {
      auth: {
        userName: 'Doctor',
        password: 'x'
      },
      transports: ['polling', 'websocket']
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket conectado');
      setSocketConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
      setSocketConnected(false);
    });

    // Receber transcrições
    newSocket.on('presencialTranscription', (data: Transcription) => {
      console.log('📝 Nova transcrição:', data);
      setTranscriptions(prev => [...prev, data]);
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
        const response = await fetch(`/api/consultations/${consultationId}`);
        if (response.ok) {
          const data = await response.json();
          setPatientName(data.consultation.patient_name);
        }
      } catch (error) {
        console.error('Erro ao carregar consulta:', error);
      }
    };

    loadConsultation();

    // Buscar nome do médico
    const loadDoctor = async () => {
      try {
        const response = await fetch('/api/medico');
        if (response.ok) {
          const data = await response.json();
          setDoctorName(data.medico?.name || 'Dr. Médico');
        }
      } catch (error) {
        console.error('Erro ao carregar médico:', error);
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
      setError('Socket não conectado ou consulta não encontrada');
      return;
    }

    if (!doctorMicrophoneId || !patientMicrophoneId) {
      setError('Selecione os microfones');
      return;
    }

    try {
      // Iniciar sessão no backend
      socket.emit('startPresencialSession', {
        consultationId,
        doctorMicrophoneId,
        patientMicrophoneId
      }, async (response: any) => {
        if (response.success) {
          console.log('✅ Sessão iniciada:', response.sessionId);

          // IMPORTANTE: Setar sessionId ANTES de iniciar captura
          setSessionId(response.sessionId);
          setSessionStarted(true);

          // Aguardar um pouco para garantir que o estado foi atualizado
          await new Promise(resolve => setTimeout(resolve, 100));

          // Iniciar captura de áudio IMEDIATAMENTE com sessionId do callback
          console.log('🎬 Iniciando captura de áudio com sessionId:', response.sessionId);
          await startCapture(response.sessionId);
        } else {
          setError(response.error || 'Erro ao iniciar sessão');
        }
      });
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      setError('Erro ao iniciar sessão');
    }
  };

  const handleEndSession = async () => {
    if (!socket || !sessionId) return;

    // Parar captura
    stopCapture();

    // Finalizar sessão no backend
    socket.emit('endPresencialSession', {
      sessionId
    }, (response: any) => {
      if (response.success) {
        console.log('✅ Sessão finalizada');

        // Redirecionar para lista de consultas
        router.push('/consultas');
      } else {
        setError(response.error || 'Erro ao finalizar sessão');
      }
    });
  };

  if (!consultationId) {
    return (
      <div className="presencial-page">
        <div className="error-card">
          <XCircle className="error-icon" size={48} />
          <h2>Consulta não encontrada</h2>
          <p>ID da consulta não fornecido</p>
          <button onClick={() => router.push('/consultas')} className="btn btn-primary">
            <ArrowLeft size={18} />
            Voltar para Consultas
          </button>
        </div>
      </div>
    );
  }

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

      {!sessionStarted ? (
        // Setup: Seleção de microfones
        <div className="setup-container">
          <DualMicrophoneControl
            onMicrophonesSelected={handleMicrophonesSelected}
            disabled={!socketConnected}
          />

          <div className="actions">
            <button
              onClick={handleStartSession}
              disabled={!socketConnected || !doctorMicrophoneId || !patientMicrophoneId}
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
                <span className="status-label">Duração:</span>
                <span className="status-value">{formatDuration(duration)}</span>
              </div>

              <div className="status-item">
                <span className="status-label">Conexão:</span>
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

              {pendingChunks > 0 && (
                <div className="status-item">
                  <span className="status-label">Buffer:</span>
                  <span className="status-value">{pendingChunks} chunks</span>
                </div>
              )}
            </div>

            <DualMicrophoneControl
              onMicrophonesSelected={handleMicrophonesSelected}
              disabled={true}
            />

            <button
              onClick={handleEndSession}
              className="btn btn-danger btn-lg"
            >
              Finalizar Consulta
            </button>
          </div>

          <div className="transcription-panel">
            <PresencialTranscription
              transcriptions={transcriptions}
              doctorName={doctorName}
              patientName={patientName}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .presencial-page {
          height: 100vh;
          background: #EBF3F6;
          padding: 8px 20px 12px 20px;
          overflow: hidden;
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
          grid-template-columns: 380px 1fr;
          gap: 16px;
          max-width: 1400px;
          margin: 0 auto;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          width: 100%;
          align-items: start;
        }
        
        .consultation-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
          overflow: hidden;
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
        
        .transcription-panel {
          height: calc(100vh - 60px);
          min-height: 700px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
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
          }
          
          .transcription-panel {
            height: 500px;
          }
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
