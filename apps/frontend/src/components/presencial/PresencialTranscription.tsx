'use client';

import { useEffect, useRef } from 'react';
import { Stethoscope, User, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDuration } from '@/lib/audioUtils';

import { TranscriptionSegment } from '@/types/transcription';

interface PresencialTranscriptionProps {
  transcriptions: TranscriptionSegment[];
  doctorName?: string;
  patientName?: string;
  speakerMapping?: { speaker_0: 'doctor' | 'patient'; speaker_1: 'doctor' | 'patient' } | null;
  micMode?: 'single' | 'dual';
}

/**
 * Resolves the display info for a transcription segment in single-mic mode.
 * Returns the CSS class, label, and icon for the segment.
 */
function resolveSingleMicDisplay(
  segment: TranscriptionSegment,
  speakerMapping: { speaker_0: 'doctor' | 'patient'; speaker_1: 'doctor' | 'patient' } | null | undefined,
  doctorName: string,
  patientName: string
): { className: string; label: string; icon: 'stethoscope' | 'user' | 'message-circle' } {
  // UNKNOWN speaker: gray styling
  if (segment.speaker === 'UNKNOWN') {
    return {
      className: 'unknown',
      label: 'Processando...',
      icon: 'message-circle'
    };
  }

  // Already resolved to MEDICO/PACIENTE (e.g. from dual mode logic or fully resolved)
  if (segment.speaker === 'MEDICO') {
    return { className: 'doctor', label: doctorName, icon: 'stethoscope' };
  }
  if (segment.speaker === 'PACIENTE') {
    return { className: 'patient', label: patientName, icon: 'user' };
  }

  // Speaker ID-based resolution (speaker_0 / speaker_1)
  const participantId = segment.participantId;
  if (participantId === 'speaker_0' || participantId === 'speaker_1') {
    if (speakerMapping) {
      // Post-mapping: resolve to role
      const role = speakerMapping[participantId];
      if (role === 'doctor') {
        return { className: 'doctor', label: doctorName, icon: 'stethoscope' };
      } else {
        return { className: 'patient', label: patientName, icon: 'user' };
      }
    } else {
      // Pre-mapping: show Speaker 0 / Speaker 1 with muted styling
      const speakerNum = participantId === 'speaker_0' ? '0' : '1';
      const className = participantId === 'speaker_0' ? 'speaker-0' : 'speaker-1';
      return {
        className,
        label: `Speaker ${speakerNum}`,
        icon: participantId === 'speaker_0' ? 'stethoscope' : 'user'
      };
    }
  }

  // Fallback: treat as unknown
  return { className: 'unknown', label: 'Processando...', icon: 'message-circle' };
}

function SpeakerIcon({ type, size }: { type: 'stethoscope' | 'user' | 'message-circle'; size: number }) {
  switch (type) {
    case 'stethoscope':
      return <Stethoscope className="speaker-icon" size={size} />;
    case 'user':
      return <User className="speaker-icon" size={size} />;
    case 'message-circle':
      return <MessageCircle className="speaker-icon" size={size} />;
  }
}

export function PresencialTranscription({
  transcriptions,
  doctorName = 'Medico',
  patientName = 'Paciente',
  speakerMapping,
  micMode
}: PresencialTranscriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSingleMic = micMode === 'single';

  // Auto-scroll para ultima transcricao
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  return (
    <div className="presencial-transcription">
      <div className="transcription-header">
        <h3>Transcricao em Tempo Real</h3>
        <span className="transcription-count">{transcriptions.length} mensagens</span>
      </div>

      <div ref={containerRef} className="transcription-container">
        {transcriptions.length === 0 ? (
          <div className="empty-state">
            <p>Aguardando transcricoes...</p>
            <p className="hint">As falas serao transcritas em tempo real</p>
          </div>
        ) : isSingleMic ? (
          /* Single-mic mode: three-state display with transitions */
          <AnimatePresence mode="popLayout">
            {transcriptions.map((t, index) => {
              const display = resolveSingleMicDisplay(t, speakerMapping, doctorName, patientName);
              return (
                <motion.div
                  key={t.id || `t-${index}`}
                  className={`transcription-item ${display.className}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  layout
                >
                  <div className="transcription-header-item">
                    <span className="speaker-name">
                      <SpeakerIcon type={display.icon} size={16} />
                      {display.label}
                    </span>
                    <span className="timestamp">
                      {new Date(t.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="transcription-text">{t.text}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          /* Dual-mic mode: original rendering (backward compatible) */
          transcriptions.map((t, index) => (
            <div
              key={t.id || index}
              className={`transcription-item ${t.speaker === 'MEDICO' ? 'doctor' : 'patient'}`}
            >
              <div className="transcription-header-item">
                <span className="speaker-name">
                  {(t.speaker === 'MEDICO') ? (
                    <>
                      <Stethoscope className="speaker-icon" size={16} />
                      {doctorName}
                    </>
                  ) : (
                    <>
                      <User className="speaker-icon" size={16} />
                      {patientName}
                    </>
                  )}
                </span>
                <span className="timestamp">
                  {new Date(t.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <p className="transcription-text">{t.text}</p>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .presencial-transcription {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          border: 1px solid #E5E7EB;
        }

        .transcription-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 2px solid #E5E7EB;
          background: #F9FAFB;
        }

        .transcription-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1B4266;
        }

        .transcription-count {
          font-size: 14px;
          color: #1B4266;
          background: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          border: 1px solid #E5E7EB;
        }

        .transcription-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #FAFBFC;
          min-height: 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }

        .empty-state p {
          margin: 4px 0;
          text-align: center;
          font-size: 16px;
        }

        .empty-state .hint {
          font-size: 14px;
          color: #9ca3af;
        }

        .transcription-item {
          padding: 16px 20px;
          border-radius: 10px;
          border-left: 4px solid #E5E7EB;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .transcription-item.doctor {
          background: #EBF5FF;
          border-left-color: #1B4266;
        }

        .transcription-item.patient {
          background: #F0FDF4;
          border-left-color: #10B981;
        }

        .transcription-item.unknown {
          background: #F3F4F6;
          border-left-color: #9CA3AF;
        }

        .transcription-item.speaker-0 {
          background: #EBF5FF;
          border-left-color: #6B8DAF;
        }

        .transcription-item.speaker-1 {
          background: #F0FDF4;
          border-left-color: #6EE7B7;
        }

        .transcription-header-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .speaker-name {
          font-size: 15px;
          font-weight: 600;
          color: #1B4266;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .transcription-item.unknown .speaker-name {
          color: #6B7280;
        }

        .transcription-item.speaker-0 .speaker-name {
          color: #6B8DAF;
        }

        .transcription-item.speaker-1 .speaker-name {
          color: #059669;
        }

        .speaker-icon {
          color: inherit;
          flex-shrink: 0;
        }

        .timestamp {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .transcription-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #374151;
        }

        .transcription-item.unknown .transcription-text {
          color: #6B7280;
        }

        .transcription-container::-webkit-scrollbar {
          width: 10px;
        }

        .transcription-container::-webkit-scrollbar-track {
          background: #F3F4F6;
          border-radius: 5px;
        }

        .transcription-container::-webkit-scrollbar-thumb {
          background: #1B4266;
          border-radius: 5px;
        }

        .transcription-container::-webkit-scrollbar-thumb:hover {
          background: #153350;
        }
      `}</style>
    </div>
  );
}
