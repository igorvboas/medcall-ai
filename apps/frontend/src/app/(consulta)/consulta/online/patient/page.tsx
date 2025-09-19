'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { Camera, Mic, Phone, AlertCircle, User, CheckCircle, Volume2 } from 'lucide-react';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { MedicalConsultationRoom } from '@/components/livekit/MedicalConsultationRoom';
import '@livekit/components-styles';

function PatientConsultationContent() {
  const searchParams = useSearchParams();
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionId = searchParams.get('sessionId');
  const consultationId = searchParams.get('consultationId');
  const roomName = searchParams.get('roomName');
  const patientToken = searchParams.get('token');
  const doctorName = searchParams.get('doctorName');

  const {
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    previewState,
    previewVideoRef,
    loadDevices,
    selectCamera,
    selectMicrophone,
    startPreview,
    stopPreview,
    getSelectedDevices
  } = useMediaDevices();

  // Validar parâmetros obrigatórios
  useEffect(() => {
    if (!sessionId || !consultationId || !patientToken || !roomName) {
      setError('Link de consulta inválido');
      return;
    }
  }, [sessionId, consultationId, patientToken, roomName]);

  // Carregar dispositivos automaticamente
  useEffect(() => {
    loadDevices().catch((err) => {
      setError('Erro ao carregar dispositivos. Verifique as permissões.');
      console.error('Erro ao carregar dispositivos:', err);
    });
  }, [loadDevices]);

  // Iniciar preview automaticamente quando dispositivos estiverem selecionados
  useEffect(() => {
    if (selectedCamera && selectedMicrophone && !previewState.isPreviewActive && !isInCall) {
      startPreview().catch((err) => {
        console.error('Erro ao iniciar preview:', err);
      });
    }
  }, [selectedCamera, selectedMicrophone, previewState.isPreviewActive, isInCall, startPreview]);

  const handleJoinCall = async () => {
    if (!selectedCamera || !selectedMicrophone) {
      setError('Selecione uma câmera e microfone antes de entrar');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Parar preview antes de entrar na chamada
      stopPreview();
      
      // Entrar na chamada
      setIsInCall(true);
      
    } catch (error) {
      console.error('Erro ao entrar na chamada:', error);
      setError('Erro ao entrar na chamada. Tente novamente.');
      setIsJoining(false);
    }
  };

  if (error) {
    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Erro na Consulta</h1>
            <p className="page-subtitle">{error}</p>
          </div>
          <div className="form-card">
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
      </div>
    );
  }

  // Se já está na chamada, mostrar o componente principal
  if (isInCall) {
    const handleEndCall = () => {
      // Redirect to home or feedback page
      window.location.href = '/';
    };

    const handleError = (error: Error) => {
      console.error('Patient consultation error:', error);
      setError('Erro na consulta. Por favor, tente novamente.');
      setIsInCall(false);
    };

    return (
      <MedicalConsultationRoom
        roomName={roomName!}
        participantName="Paciente"
        userRole="patient"
        sessionId={sessionId!}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={patientToken!}
        patientName="Você"
        videoCaptureDefaults={{
          deviceId: selectedCamera || undefined
        }}
        audioCaptureDefaults={{
          deviceId: selectedMicrophone || undefined
        }}
        onEndCall={handleEndCall}
        onError={handleError}
      />
    );
  }

  // Tela de configuração para o paciente
  return (
    <div className="patient-setup-page">
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Consulta Online</h1>
          <p className="page-subtitle">
            Você foi convidado para uma consulta com {doctorName ? decodeURIComponent(doctorName) : 'o médico'}
          </p>
        </div>

        <div className="setup-layout">
          {/* Preview da Câmera */}
          <div className="preview-section">
            <div className="form-card">
              <h3 className="form-section-title">
                <Camera className="form-section-icon" />
                Sua Câmera
              </h3>
              
              <div className="video-preview">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="preview-video"
                />
                {!previewState.isPreviewActive && (
                  <div className="video-placeholder">
                    <Camera size={48} />
                    <p>Aguardando câmera...</p>
                  </div>
                )}
              </div>

              {/* Indicador de Áudio */}
              <div className="audio-indicator">
                <Volume2 size={16} />
                <div className="audio-level-bar">
                  <div 
                    className="audio-level-fill"
                    style={{ width: `${previewState.audioLevel}%` }}
                  />
                </div>
                <span className="audio-level-text">
                  {Math.round(previewState.audioLevel)}%
                </span>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="settings-section">
            {/* Seleção de Câmera */}
            <div className="form-card">
              <h3 className="form-section-title">
                <Camera className="form-section-icon" />
                Selecionar Câmera
              </h3>
              
              <div className="device-selection">
                {cameras.length === 0 ? (
                  <div className="no-devices">
                    <AlertCircle size={20} />
                    <span>Nenhuma câmera encontrada</span>
                  </div>
                ) : (
                  <select 
                    value={selectedCamera || ''} 
                    onChange={(e) => selectCamera(e.target.value)}
                    className="device-select"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Seleção de Microfone */}
            <div className="form-card">
              <h3 className="form-section-title">
                <Mic className="form-section-icon" />
                Selecionar Microfone
              </h3>
              
              <div className="device-selection">
                {microphones.length === 0 ? (
                  <div className="no-devices">
                    <AlertCircle size={20} />
                    <span>Nenhum microfone encontrado</span>
                  </div>
                ) : (
                  <select 
                    value={selectedMicrophone || ''} 
                    onChange={(e) => selectMicrophone(e.target.value)}
                    className="device-select"
                  >
                    {microphones.map((microphone) => (
                      <option key={microphone.deviceId} value={microphone.deviceId}>
                        {microphone.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Informações da Consulta */}
            <div className="form-card">
              <h3 className="form-section-title">
                <User className="form-section-icon" />
                Informações
              </h3>
              
              <div className="consultation-info">
                <div className="info-item">
                  <span className="info-label">Médico:</span>
                  <span className="info-value">{doctorName ? decodeURIComponent(doctorName) : 'Dr. Médico'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tipo:</span>
                  <span className="info-value">Consulta Online</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value status-ready">
                    <CheckCircle size={16} />
                    Pronto para entrar
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Entrar */}
            <div className="form-actions">
              <button
                onClick={handleJoinCall}
                disabled={isJoining || !selectedCamera || !selectedMicrophone}
                className="btn btn-primary btn-large"
              >
                {isJoining ? (
                  <>
                    <div className="loading-icon" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Phone size={20} />
                    Entrar na Consulta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientConsultationPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Carregando Consulta</h1>
            <p className="page-subtitle">Preparando entrada na consulta...</p>
          </div>
          <div className="form-card">
            <div className="loading-indicator">
              <div className="loading-icon" />
              <span>Verificando permissões...</span>
            </div>
          </div>
        </div>
      </div>
    }>
      <PatientConsultationContent />
    </Suspense>
  );
}
