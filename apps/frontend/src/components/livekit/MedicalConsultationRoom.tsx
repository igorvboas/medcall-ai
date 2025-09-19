'use client';

import React, { useState } from 'react';
import { LiveKitRoomProvider } from './LiveKitRoomProvider';
import { MedicalVideoConference } from './MedicalVideoConference';
import { RealtimeTranscription } from './RealtimeTranscription';
import { SuggestionsPanel } from '../call/SuggestionsPanel';

interface MedicalConsultationRoomProps {
  // Room configuration
  roomName: string;
  participantName: string;
  userRole?: 'doctor' | 'patient';
  sessionId: string;
  
  // Connection details (optional, will be fetched if not provided)
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
  
  // Quality settings
  hq?: boolean;
  
  // Event handlers
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onEndCall?: () => void;
  onShareConsultation?: () => void;
  
  // Panel data for doctors
  suggestions?: Array<{
    id: string;
    type: 'question' | 'diagnosis' | 'treatment';
    text: string;
    confidence: number;
    timestamp: string;
    used: boolean;
    used_at?: string;
  }>;
  
  onSuggestionUsed?: (suggestionId: string) => void;
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
  hq = false,
  onConnected,
  onDisconnected,
  onError,
  onEndCall,
  onShareConsultation,
  suggestions = [],
  onSuggestionUsed,
}: MedicalConsultationRoomProps) {
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  
  // Render transcription panel for doctors
  const transcriptionPanel = userRole === 'doctor' ? (
    <RealtimeTranscription
      sessionId={sessionId}
      userRole={userRole}
      onTranscriptionUpdate={setTranscriptions}
    />
  ) : null;

  // Render suggestions panel for doctors
  const suggestionsPanel = userRole === 'doctor' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #4a5568',
        background: '#2a2a2a',
        color: 'white'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          🧠 Sugestões de IA
        </h3>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SuggestionsPanel 
          suggestions={suggestions}
          onSuggestionUsed={onSuggestionUsed}
        />
      </div>
    </div>
  ) : null;

  // Render patient data panel for doctors
  const patientDataPanel = userRole === 'doctor' ? (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid #4a5568',
        background: '#2a2a2a',
        color: 'white'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          👤 Dados do Paciente
        </h3>
      </div>
      <div style={{ flex: 1, padding: '1rem', background: '#1a1a1a', color: 'white' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '0.5rem', color: '#a0aec0' }}>
            Nome
          </label>
          <div style={{ 
            padding: '0.5rem', 
            background: '#2a2a2a', 
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {patientName || 'Nome do paciente'}
          </div>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '0.5rem', color: '#a0aec0' }}>
            Status da Consulta
          </label>
          <div style={{ 
            padding: '0.5rem', 
            background: '#2a2a2a', 
            borderRadius: '4px',
            fontSize: '14px',
            color: '#48bb78'
          }}>
            ✅ Conectado
          </div>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '0.5rem', color: '#a0aec0' }}>
            Tipo de Consulta
          </label>
          <div style={{ 
            padding: '0.5rem', 
            background: '#2a2a2a', 
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            📹 Consulta Online
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <LiveKitRoomProvider
      roomName={roomName}
      participantName={participantName}
      serverUrl={serverUrl}
      token={token}
      onConnected={onConnected}
      onDisconnected={onDisconnected}
      onError={onError}
      hq={hq}
      videoCaptureDefaults={videoCaptureDefaults}
      audioCaptureDefaults={audioCaptureDefaults}
    >
      <MedicalVideoConference
        userRole={userRole}
        patientName={patientName}
        onEndCall={onEndCall}
        onShareConsultation={onShareConsultation}
        sessionId={sessionId}
        consultationId={sessionId} // Using sessionId as consultationId for now
        transcriptionPanel={transcriptionPanel}
        suggestionsPanel={suggestionsPanel}
        patientDataPanel={patientDataPanel}
      />
    </LiveKitRoomProvider>
  );
}
