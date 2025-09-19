'use client';

import React from 'react';
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  TrackReference,
  ConnectionStateToast,
  useRoomContext,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User } from 'lucide-react';
import styles from './MedicalVideoConference.module.css';
import { MedicalToolbar } from './MedicalToolbar';
import { NotificationSystem } from './NotificationSystem';

interface MedicalVideoConferenceProps {
  userRole?: 'doctor' | 'patient';
  patientName?: string;
  onEndCall?: () => void;
  onShareConsultation?: () => void;
  sessionId?: string;
  consultationId?: string;
  // Slots for custom panels
  transcriptionPanel?: React.ReactNode;
  suggestionsPanel?: React.ReactNode;
  patientDataPanel?: React.ReactNode;
}

function CustomParticipantTile({ 
  participant, 
  source, 
  userRole, 
  isLocal = false 
}: { 
  participant: Participant; 
  source: Track.Source;
  userRole?: 'doctor' | 'patient';
  isLocal?: boolean;
}) {
  const tracks = useTracks([{ participant, source }], { onlySubscribed: false });
  const track = tracks[0];

  // Determine participant label
  let participantLabel = participant.name || participant.identity;
  if (isLocal) {
    participantLabel = userRole === 'doctor' ? 'Dr. Médico (Você)' : 'Você';
  } else {
    // Remote participant
    if (userRole === 'doctor') {
      participantLabel = participant.name || 'Paciente';
    } else {
      participantLabel = 'Dr. Médico';
    }
  }

  return (
    <div className={styles.medicalParticipantTile}>
      <ParticipantTile
        participant={participant}
        source={source}
        className={styles.medicalTile}
      />
      <div className={styles.medicalParticipantInfo}>
        <div className={styles.medicalParticipantName}>
          {participantLabel}
        </div>
        <div className={styles.medicalParticipantStatus}>
          {participant.connectionQuality ? (
            <span className={`${styles.connectionQuality} ${styles[`quality${participant.connectionQuality.charAt(0).toUpperCase()}${participant.connectionQuality.slice(1)}`]}`}>
              {participant.connectionQuality === 'excellent' ? '🟢' : 
               participant.connectionQuality === 'good' ? '🟡' : '🔴'}
            </span>
          ) : null}
          {track?.isMuted ? '🔇' : '🔊'}
        </div>
      </div>
    </div>
  );
}


function TwoParticipantLayout({ 
  userRole,
  localParticipant,
  remoteParticipants 
}: {
  userRole?: 'doctor' | 'patient';
  localParticipant: Participant;
  remoteParticipants: Participant[];
}) {
  return (
    <div className={styles.medicalTwoParticipantLayout}>
      {/* Local Participant (sempre visível) */}
      <div className={styles.localParticipantContainer}>
        <CustomParticipantTile
          participant={localParticipant}
          source={Track.Source.Camera}
          userRole={userRole}
          isLocal={true}
        />
      </div>

      {/* Remote Participant */}
      <div className={styles.remoteParticipantContainer}>
        {remoteParticipants.length > 0 ? (
          <CustomParticipantTile
            participant={remoteParticipants[0]}
            source={Track.Source.Camera}
            userRole={userRole}
            isLocal={false}
          />
        ) : (
          <div className={styles.waitingForParticipant}>
            <div className={styles.waitingAvatar}>
              <User size={48} />
            </div>
            <div className={styles.waitingText}>
              {userRole === 'doctor' ? 'Aguardando paciente...' : 'Aguardando médico...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MedicalVideoConference({
  userRole = 'doctor',
  patientName,
  onEndCall,
  onShareConsultation,
  sessionId,
  consultationId,
  transcriptionPanel,
  suggestionsPanel,
  patientDataPanel,
}: MedicalVideoConferenceProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  return (
    <div className={styles.medicalVideoConference} data-lk-theme="default">
      {/* Notification System */}
      <NotificationSystem userRole={userRole} />
      
      {/* Main Layout */}
      <div className={styles.medicalMainLayout}>
        {/* Video Area */}
        <div className={styles.medicalVideoArea}>
          <TwoParticipantLayout
            userRole={userRole}
            localParticipant={localParticipant}
            remoteParticipants={remoteParticipants}
          />
          
          {/* Medical Toolbar */}
          <MedicalToolbar 
            userRole={userRole}
            onEndCall={onEndCall}
            onShareConsultation={onShareConsultation}
            sessionId={sessionId}
            consultationId={consultationId}
          />
        </div>

        {/* Side Panels (apenas para médicos) */}
        {userRole === 'doctor' && (
          <div className={styles.medicalSidePanels}>
            {transcriptionPanel && (
              <div className={`${styles.medicalPanel} ${styles.transcriptionPanel}`}>
                {transcriptionPanel}
              </div>
            )}
            
            {suggestionsPanel && (
              <div className={`${styles.medicalPanel} ${styles.suggestionsPanel}`}>
                {suggestionsPanel}
              </div>
            )}
            
            {patientDataPanel && (
              <div className={`${styles.medicalPanel} ${styles.patientDataPanel}`}>
                {patientDataPanel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio Renderer */}
      <RoomAudioRenderer />
    </div>
  );
}
