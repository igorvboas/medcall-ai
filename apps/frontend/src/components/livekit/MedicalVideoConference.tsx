'use client';

import React from 'react';
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
} from '@livekit/components-react';
import styles from './MedicalVideoConference.module.css';

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
  // Simplified version for debugging
  return (
    <div className={styles.medicalVideoConference} data-lk-theme="default">
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#1a1a1a',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem'
      }}>
        <h2>🎥 Consulta Online - {userRole === 'doctor' ? 'Médico' : 'Paciente'}</h2>
        <p>Paciente: {patientName}</p>
        <p>Sessão: {sessionId}</p>
        
        {/* Use the most basic LiveKit components */}
        <div style={{ 
          width: '80%', 
          height: '60%', 
          border: '1px solid #4a5568',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <GridLayout style={{ height: '100%', width: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ControlBar />
          
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
      
      {/* Audio Renderer */}
      <RoomAudioRenderer />
    </div>
  );
}