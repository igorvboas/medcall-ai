'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  useParticipants
} from '@livekit/components-react';
import { useTranscriptionWebSocket } from '../../hooks/useTranscriptionWebSocket';


interface TranscriptionDisplayProps {
  patientName?: string;
  userRole?: 'doctor' | 'patient';
  roomName: string;
  participantId: string;
  consultationId: string;
}
export function TranscriptionDisplay(props: any) {
    console.log('🔍 TESTE - TranscriptionDisplay renderizado!', props);
    
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'red',
        color: 'white',
        padding: '10px',
        zIndex: 9999
      }}>
        TESTE TRANSCRIÇÃO
      </div>
    );
  }