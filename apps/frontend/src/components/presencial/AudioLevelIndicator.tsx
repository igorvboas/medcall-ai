'use client';

import { useEffect, useState } from 'react';

interface AudioLevelIndicatorProps {
    level: number; // 0.0 - 1.0
    label: string;
    isSpeaking?: boolean;
}

export function AudioLevelIndicator({ level, label, isSpeaking }: AudioLevelIndicatorProps) {
    const [bars, setBars] = useState<number>(0);

    useEffect(() => {
        // Converter nível (0-1) para barras (0-10)
        const numBars = Math.floor(level * 50); // 50 barras no máximo
        setBars(Math.min(numBars, 10));
    }, [level]);

    return (
        <div className="audio-level-indicator">
            <label className="audio-label">{label}</label>
            <div className="level-bars">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className={`level-bar ${i < bars ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
                    />
                ))}
            </div>
            <style jsx>{`
        .audio-level-indicator {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .audio-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        
        .level-bars {
          display: flex;
          gap: 4px;
          height: 24px;
          align-items: flex-end;
        }
        
        .level-bar {
          flex: 1;
          background: #e5e7eb;
          border-radius: 2px;
          transition: all 0.1s ease;
          min-height: 4px;
        }
        
        .level-bar.active {
          background: #10b981;
          height: 100%;
        }
        
        .level-bar.speaking {
          background: #3b82f6;
          animation: pulse 0.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
        </div>
    );
}
