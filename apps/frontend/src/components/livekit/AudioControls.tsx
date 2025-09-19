'use client';

import React, { useState, useEffect } from 'react';
import { 
  useLocalParticipant, 
  useRemoteParticipants,
  useTracks,
  useRoomContext
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings,
  Activity
} from 'lucide-react';
import styles from './AudioControls.module.css';

interface AudioControlsProps {
  onNoiseSuppressionToggle?: (enabled: boolean) => void;
}

function AudioLevelIndicator({ 
  participant, 
  isLocal = false 
}: { 
  participant: Participant;
  isLocal?: boolean;
}) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const tracks = useTracks([
    { participant, source: Track.Source.Microphone }
  ], { onlySubscribed: false });

  useEffect(() => {
    const audioTrack = tracks[0]?.track;
    if (!audioTrack) return;

    let animationFrame: number;

    const updateAudioLevel = () => {
      // Simulate audio level for now
      // In a real implementation, you would analyze the audio track
      const level = Math.random() * 100;
      const speaking = level > 30;
      
      setAudioLevel(level);
      setIsSpeaking(speaking);
      
      animationFrame = requestAnimationFrame(updateAudioLevel);
    };

    if (!audioTrack.isMuted) {
      updateAudioLevel();
    } else {
      setAudioLevel(0);
      setIsSpeaking(false);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [tracks]);

  return (
    <div className={styles.audioLevelIndicator}>
      <div className={styles.participantLabel}>
        {isLocal ? 'Você' : participant.name || participant.identity}
      </div>
      
      <div className={styles.audioLevelContainer}>
        <div className={styles.audioLevelBar}>
          <div 
            className={styles.audioLevelFill}
            style={{ 
              width: `${audioLevel}%`,
              backgroundColor: isSpeaking ? '#48bb78' : '#4a5568'
            }}
          />
        </div>
        
        <div className={styles.speakingIndicator}>
          {isSpeaking && (
            <Activity 
              size={16} 
              className={styles.speakingIcon}
            />
          )}
        </div>
      </div>
      
      <div className={styles.audioLevelText}>
        {Math.round(audioLevel)}%
      </div>
    </div>
  );
}

function VolumeControl({ participant }: { participant: Participant }) {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const tracks = useTracks([
    { participant, source: Track.Source.Microphone }
  ], { onlySubscribed: true });

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // Apply volume to audio track
    const audioTrack = tracks[0]?.track;
    if (audioTrack && 'setVolume' in audioTrack) {
      (audioTrack as any).setVolume(newVolume);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    handleVolumeChange(newMuted ? 0 : volume);
  };

  return (
    <div className={styles.volumeControl}>
      <button 
        className={styles.volumeButton}
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={isMuted ? 0 : volume}
        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        className={styles.volumeSlider}
        disabled={isMuted}
      />
      
      <span className={styles.volumeText}>
        {Math.round((isMuted ? 0 : volume) * 100)}%
      </span>
    </div>
  );
}

function MicrophoneControls() {
  const { localParticipant } = useLocalParticipant();
  const [audioSettings, setAudioSettings] = useState({
    noiseSuppression: false,
    echoCancellation: true,
    autoGainControl: true,
  });

  // Wait for localParticipant to be initialized
  if (!localParticipant) {
    return <div>Carregando controles...</div>;
  }

  const toggleMicrophone = () => {
    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
  };

  const applyAudioSettings = async () => {
    try {
      // Get current audio track
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      
      if (audioTrack) {
        // Apply noise suppression and other settings
        // This would require audio processing capabilities
        console.log('Applying audio settings:', audioSettings);
      }
    } catch (error) {
      console.error('Error applying audio settings:', error);
    }
  };

  useEffect(() => {
    applyAudioSettings();
  }, [audioSettings]);

  return (
    <div className={styles.microphoneControls}>
      <button 
        className={`${styles.micButton} ${
          localParticipant.isMicrophoneEnabled ? styles.micActive : styles.micMuted
        }`}
        onClick={toggleMicrophone}
        title={localParticipant.isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
      >
        {localParticipant.isMicrophoneEnabled ? 
          <Mic size={20} /> : 
          <MicOff size={20} />
        }
      </button>

      <div className={styles.audioSettings}>
        <button 
          className={styles.settingsButton}
          title="Audio Settings"
        >
          <Settings size={16} />
        </button>
        
        <div className={styles.settingsDropdown}>
          <label className={styles.settingLabel}>
            <input
              type="checkbox"
              checked={audioSettings.noiseSuppression}
              onChange={(e) => setAudioSettings(prev => ({
                ...prev,
                noiseSuppression: e.target.checked
              }))}
            />
            Noise Suppression
          </label>
          
          <label className={styles.settingLabel}>
            <input
              type="checkbox"
              checked={audioSettings.echoCancellation}
              onChange={(e) => setAudioSettings(prev => ({
                ...prev,
                echoCancellation: e.target.checked
              }))}
            />
            Echo Cancellation
          </label>
          
          <label className={styles.settingLabel}>
            <input
              type="checkbox"
              checked={audioSettings.autoGainControl}
              onChange={(e) => setAudioSettings(prev => ({
                ...prev,
                autoGainControl: e.target.checked
              }))}
            />
            Auto Gain Control
          </label>
        </div>
      </div>
    </div>
  );
}

export function AudioControls({ onNoiseSuppressionToggle }: AudioControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  return (
    <div className={styles.audioControls}>
      {/* Microphone Controls */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Controles de Microfone</h4>
        <MicrophoneControls />
      </div>

      {/* Audio Level Monitoring */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Níveis de Áudio</h4>
        
        <AudioLevelIndicator 
          participant={localParticipant}
          isLocal={true}
        />
        
        {remoteParticipants.map((participant) => (
          <AudioLevelIndicator 
            key={participant.identity}
            participant={participant}
            isLocal={false}
          />
        ))}
      </div>

      {/* Volume Controls for Remote Participants */}
      {remoteParticipants.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Controle de Volume</h4>
          
          {remoteParticipants.map((participant) => (
            <div key={participant.identity} className={styles.volumeControlContainer}>
              <span className={styles.participantName}>
                {participant.name || participant.identity}
              </span>
              <VolumeControl participant={participant} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
