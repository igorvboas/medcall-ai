'use client';

import { useEffect, useRef } from 'react';
import { formatDuration } from '@/lib/audioUtils';

interface Transcription {
    speaker: 'doctor' | 'patient';
    text: string;
    timestamp: string;
    sequence: number;
}

interface PresencialTranscriptionProps {
    transcriptions: Transcription[];
    doctorName?: string;
    patientName?: string;
}

export function PresencialTranscription({
    transcriptions,
    doctorName = 'Médico',
    patientName = 'Paciente'
}: PresencialTranscriptionProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll para última transcrição
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [transcriptions]);

    return (
        <div className="presencial-transcription">
            <div className="transcription-header">
                <h3>Transcrição em Tempo Real (Debug)</h3>
                <span className="transcription-count">{transcriptions.length} mensagens</span>
            </div>

            <div ref={containerRef} className="transcription-container">
                {transcriptions.length === 0 ? (
                    <div className="empty-state">
                        <p>Aguardando transcrições...</p>
                        <p className="hint">As falas serão transcritas em tempo real</p>
                    </div>
                ) : (
                    transcriptions.map((t, index) => (
                        <div
                            key={`${t.speaker}-${t.sequence}-${index}`}
                            className={`transcription-item ${t.speaker}`}
                        >
                            <div className="transcription-header-item">
                                <span className="speaker-name">
                                    {t.speaker === 'doctor' ? `🩺 ${doctorName}` : `👤 ${patientName}`}
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
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .transcription-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 2px solid #e5e7eb;
          background: #f9fafb;
        }
        
        .transcription-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }
        
        .transcription-count {
          font-size: 14px;
          color: #6b7280;
          background: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 500;
        }
        
        .transcription-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #9ca3af;
        }
        
        .empty-state p {
          margin: 4px 0;
          text-align: center;
        }
        
        .empty-state .hint {
          font-size: 14px;
        }
        
        .transcription-item {
          padding: 12px 16px;
          border-radius: 8px;
          border-left: 4px solid #e5e7eb;
        }
        
        .transcription-item.doctor {
          background: #eff6ff;
          border-left-color: #3b82f6;
        }
        
        .transcription-item.patient {
          background: #f0fdf4;
          border-left-color: #10b981;
        }
        
        .transcription-header-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .speaker-name {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
        
        .timestamp {
          font-size: 12px;
          color: #9ca3af;
        }
        
        .transcription-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #111827;
        }
        
        .transcription-container::-webkit-scrollbar {
          width: 8px;
        }
        
        .transcription-container::-webkit-scrollbar-track {
          background: #f3f4f6;
        }
        
        .transcription-container::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        
        .transcription-container::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
        </div>
    );
}
