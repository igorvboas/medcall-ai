'use client';

console.log('🚀🚀🚀 TRANSCRIPTION DISPLAY ARQUIVO CARREGADO!');

import React, { useState, useEffect, useRef } from 'react';
import { 
  useParticipants
} from '@livekit/components-react';
import { useTranscriptionLiveKit } from '../../hooks/useTranscriptionLiveKit';
interface TranscriptionDisplayProps {
  patientName?: string;
  userRole?: 'doctor' | 'patient';
  roomName: string;
  participantId: string;
  consultationId: string;
}

export function TranscriptionDisplay({ 
  patientName, 
  userRole, 
  roomName,
  participantId,
  consultationId 
}: TranscriptionDisplayProps) {
  console.log('🚀🚀🚀 TRANSCRIPTION DISPLAY RENDERIZADO!');
  
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);
  
  console.log('🔍 TranscriptionDisplay renderizado!');
  console.log('🔍 TranscriptionDisplay props:', { patientName, userRole, roomName, participantId, consultationId });
  console.log('🔍 TranscriptionDisplay isVisible:', isVisible);
  console.log('🔍🔍🔍 ANTES de chamar useTranscriptionLiveKit');
  
  let transcriptions: any[] = [];
  let isConnected = false;
  let error: string | null = null;
  let startTranscription: () => void = () => {};
  let stopTranscription: () => void = () => {};
  let clearTranscriptions: () => void = () => {};
  
  try {
    // Usar o hook WebSocket para transcrições
    const hookResult = useTranscriptionLiveKit({
      roomName,
      participantId,
      consultationId,
      enabled: true
    });
    
    transcriptions = hookResult.transcriptions;
    isConnected = hookResult.isConnected;
    error = hookResult.error;
    startTranscription = hookResult.startTranscription;
    stopTranscription = hookResult.stopTranscription;
    clearTranscriptions = hookResult.clearTranscriptions;
    
    console.log('🔍🔍🔍 DEPOIS de chamar useTranscriptionLiveKit - SUCESSO');
  } catch (hookError) {
    console.error('❌❌❌ ERRO ao chamar useTranscriptionLiveKit:', hookError);
    error = `Erro no hook: ${hookError}`;
  }
  
  // Obter participantes
  const participants = useParticipants();

  // Auto-scroll para a última transcrição
  const scrollToBottom = () => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcriptions]);

  // Agrupar transcrições por participante
  const groupedTranscriptions = React.useMemo(() => {
    const groups: { [participantId: string]: any[] } = {};
    
    transcriptions.forEach((transcription: any) => {
      // Usar participantId em vez de participantIdentity
      const participantId = transcription.participantId;
      if (!groups[participantId]) {
        groups[participantId] = [];
      }
      groups[participantId].push(transcription);
    });
    
    return groups;
  }, [transcriptions]);
  
  // Função para obter nome do participante
  const getParticipantName = (identity: string) => {
    const participant = participants.find(p => p.identity === identity);
    return participant?.name || identity;
  };

  // Função para determinar se é médico ou paciente
  const getParticipantRole = (identity: string) => {
    // Lógica para determinar role baseado no identity
    if (identity.includes('doctor') || identity === 'Dr. Médico') {
      return 'doctor';
    }
    return 'patient';
  };

  if (!isVisible) {
    console.log('🔍🔍🔍🔍 TranscriptionDisplay não é visível');
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#a6ce39',
          color: 'black',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          cursor: 'pointer',
          fontSize: '24px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        📝
      </button>
    );
  }
 console.log('🔍🔍🔍🔍 TranscriptionDisplay é visível');
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: isMinimized ? '300px' : '400px',
      height: isMinimized ? '60px' : '500px',
      background: 'rgba(26, 26, 26, 0.95)',
      border: '1px solid #4a5568',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: isMinimized ? 'none' : '1px solid #4a5568',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(74, 85, 104, 0.3)',
        borderRadius: '12px 12px 0 0'
      }}>
        <h3 style={{
          margin: 0,
          color: 'white',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          Transcrição em Tempo Real
        </h3>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a0aec0',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px'
            }}
          >
            {isMinimized ? '🔼' : '🔽'}
          </button>
          
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f56565',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          {/* Status */}
          <div style={{
            padding: '8px 16px',
            background: 'rgba(72, 187, 120, 0.2)',
            borderBottom: '1px solid #4a5568'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#68d391'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#68d391',
                animation: 'pulse 2s infinite'
              }} />
              Transcrição Ativa ({transcriptions.length} segmentos)
            </div>
          </div>

          {/* Transcriptions */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            maxHeight: '350px'
          }}>
            {Object.keys(groupedTranscriptions).length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#a0aec0',
                fontSize: '14px',
                marginTop: '20px'
              }}>
                <div>🎤</div>
                <p style={{ margin: '8px 0 0 0' }}>
                  Aguardando fala dos participantes...
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(groupedTranscriptions).map(([participantId, participantTranscriptions]) => {
                  const participantName = getParticipantName(participantId);
                  const participantRole = getParticipantRole(participantId);
                  console.log('🔍🔍🔍🔍 Participant ID:', participantId);
                  console.log('🔍🔍🔍🔍 Participant Name:', participantName);
                  console.log('🔍🔍🔍🔍 Participant Role:', participantRole);
                  return (
                    <div key={participantId}>
                      {participantTranscriptions.map((transcription, index) => (
                        <div
                          key={`${participantId}-${index}`}
                          style={{
                            marginBottom: '8px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: participantRole === 'doctor' 
                              ? 'rgba(166, 206, 57, 0.1)' 
                              : 'rgba(66, 153, 225, 0.1)',
                            border: `1px solid ${participantRole === 'doctor' 
                              ? 'rgba(166, 206, 57, 0.3)' 
                              : 'rgba(66, 153, 225, 0.3)'}`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: participantRole === 'doctor' ? '#a6ce39' : '#4299e1'
                            }}>
                              {participantRole === 'doctor' ? '👨‍⚕️ Dr. ' : '👤 '}
                              {participantName}
                            </span>
                            
                            <span style={{
                              fontSize: '10px',
                              color: '#a0aec0'
                            }}>
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <div style={{
                            color: 'white',
                            fontSize: '14px',
                            lineHeight: '1.4'
                          }}>
                            {transcription.text}
                            {!transcription.final && (
                              <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '14px',
                                background: '#a6ce39',
                                marginLeft: '4px',
                                animation: 'blink 1s infinite'
                              }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div ref={transcriptionsEndRef} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid #4a5568',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '10px',
              color: '#a0aec0'
            }}>
              Participantes: {participants.length}
            </div>
            
            <button
              onClick={() => {
                // Função para salvar transcrição
                const transcriptText = Object.entries(groupedTranscriptions)
                  .map(([participantId, transcripts]) => {
                    const name = getParticipantName(participantId);
                    return transcripts.map(t => `${name}: ${t.text}`).join('\n');
                  })
                  .join('\n\n');
                
                const blob = new Blob([transcriptText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transcricao-consulta-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              style={{
                background: 'transparent',
                border: '1px solid #4a5568',
                color: '#a0aec0',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              💾 Salvar
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}