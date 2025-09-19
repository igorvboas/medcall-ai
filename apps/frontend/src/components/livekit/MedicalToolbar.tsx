'use client';

import React, { useState } from 'react';
import { 
  useLocalParticipant, 
  useRemoteParticipants,
  useRoomContext 
} from '@livekit/components-react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Settings, 
  Monitor,
  Share2,
  Users,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AudioControls } from './AudioControls';
import styles from './MedicalToolbar.module.css';

interface MedicalToolbarProps {
  userRole?: 'doctor' | 'patient';
  onEndCall?: () => void;
  onShareConsultation?: () => void;
  sessionId?: string;
  consultationId?: string;
}

function ConnectionQualityIndicator() {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  
  // Get overall connection quality
  const getConnectionQuality = () => {
    if (!room.isConnected) return 'disconnected';
    
    const qualities = [
      localParticipant.connectionQuality,
      ...remoteParticipants.map(p => p.connectionQuality)
    ].filter(Boolean);
    
    if (qualities.includes('poor')) return 'poor';
    if (qualities.includes('good')) return 'good';
    return 'excellent';
  };

  const quality = getConnectionQuality();
  
  const getQualityIcon = () => {
    switch (quality) {
      case 'excellent': return <Wifi className={styles.connectionExcellent} />;
      case 'good': return <Activity className={styles.connectionGood} />;
      case 'poor': return <Activity className={styles.connectionPoor} />;
      default: return <WifiOff className={styles.connectionDisconnected} />;
    }
  };

  const getQualityText = () => {
    switch (quality) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Boa';
      case 'poor': return 'Ruim';
      default: return 'Desconectado';
    }
  };

  return (
    <div className={styles.connectionQuality} title={`Qualidade da conexão: ${getQualityText()}`}>
      {getQualityIcon()}
      <span className={styles.connectionText}>{getQualityText()}</span>
    </div>
  );
}

function ParticipantCount() {
  const remoteParticipants = useRemoteParticipants();
  const totalParticipants = remoteParticipants.length + 1; // +1 for local participant

  return (
    <div className={styles.participantCount}>
      <Users size={16} />
      <span>{totalParticipants}/2</span>
    </div>
  );
}

function SessionInfo({ 
  sessionId, 
  consultationId 
}: { 
  sessionId?: string; 
  consultationId?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!sessionId && !consultationId) return null;

  return (
    <div className={styles.sessionInfo}>
      <button 
        className={styles.sessionButton}
        onClick={() => setShowDetails(!showDetails)}
        title="Informações da Sessão"
      >
        <Monitor size={16} />
        <span>Sessão</span>
      </button>
      
      {showDetails && (
        <div className={styles.sessionDetails}>
          {sessionId && (
            <div className={styles.sessionDetail}>
              <strong>Sessão:</strong> {sessionId.slice(0, 8)}...
            </div>
          )}
          {consultationId && (
            <div className={styles.sessionDetail}>
              <strong>Consulta:</strong> {consultationId.slice(0, 8)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'audio' | 'video' | 'general'>('audio');

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.settingsModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Configurações da Consulta</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalTabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'audio' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            Áudio
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'video' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('video')}
          >
            Vídeo
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'general' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('general')}
          >
            Geral
          </button>
        </div>
        
        <div className={styles.modalContent}>
          {activeTab === 'audio' && (
            <AudioControls />
          )}
          
          {activeTab === 'video' && (
            <div className={styles.videoSettings}>
              <h4>Configurações de Vídeo</h4>
              <p>Configurações de vídeo serão implementadas aqui.</p>
            </div>
          )}
          
          {activeTab === 'general' && (
            <div className={styles.generalSettings}>
              <h4>Configurações Gerais</h4>
              <p>Configurações gerais serão implementadas aqui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MedicalToolbar({
  userRole = 'doctor',
  onEndCall,
  onShareConsultation,
  sessionId,
  consultationId
}: MedicalToolbarProps) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [showSettings, setShowSettings] = useState(false);

  // Wait for localParticipant to be initialized
  if (!localParticipant) {
    return null;
  }

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
  };

  const toggleMicrophone = () => {
    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
  };

  const handleEndCall = () => {
    if (onEndCall) {
      onEndCall();
    } else {
      room?.disconnect();
    }
  };

  const handleShareConsultation = () => {
    if (onShareConsultation) {
      onShareConsultation();
    } else {
      // Default share functionality
      console.log('Share consultation');
    }
  };

  return (
    <>
      <div className={styles.medicalToolbar}>
        {/* Left Section - Session Info */}
        <div className={styles.toolbarSection}>
          <SessionInfo 
            sessionId={sessionId}
            consultationId={consultationId}
          />
          <ParticipantCount />
        </div>

        {/* Center Section - Main Controls */}
        <div className={styles.toolbarSection}>
          <button 
            className={`${styles.controlBtn} ${
              localParticipant.isMicrophoneEnabled ? styles.active : styles.muted
            }`}
            onClick={toggleMicrophone}
            title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {localParticipant.isMicrophoneEnabled ? 
              <Mic size={20} /> : 
              <MicOff size={20} />
            }
          </button>

          <button 
            className={`${styles.controlBtn} ${
              localParticipant.isCameraEnabled ? styles.active : styles.disabled
            }`}
            onClick={toggleCamera}
            title={localParticipant.isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {localParticipant.isCameraEnabled ? 
              <Video size={20} /> : 
              <VideoOff size={20} />
            }
          </button>

          {userRole === 'doctor' && onShareConsultation && (
            <button 
              className={`${styles.controlBtn} ${styles.shareBtn}`}
              onClick={handleShareConsultation}
              title="Share Consultation Link"
            >
              <Share2 size={20} />
            </button>
          )}

          <button 
            className={`${styles.controlBtn} ${styles.endCallBtn}`}
            onClick={handleEndCall}
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right Section - Status and Settings */}
        <div className={styles.toolbarSection}>
          <ConnectionQualityIndicator />
          
          <button 
            className={`${styles.controlBtn} ${styles.settingsBtn}`}
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
