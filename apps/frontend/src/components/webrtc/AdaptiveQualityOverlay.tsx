'use client';

import { useEffect, useState } from 'react';
import type { QualityMode, VideoResolution } from '@/hooks/useAdaptiveQuality';

interface AdaptiveQualityOverlayProps {
    currentMode: QualityMode;
    videoResolution: VideoResolution;
    reason: string | null;
    isTranscriptionPaused: boolean;
}

/**
 * Overlay visual que mostra o estado atual de qualidade adaptativa.
 * Exibe informações quando o modo não é 'full'.
 */
export function AdaptiveQualityOverlay({
    currentMode,
    videoResolution,
    reason,
    isTranscriptionPaused,
}: AdaptiveQualityOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Mostrar overlay quando modo não é full
        if (currentMode !== 'full') {
            setIsVisible(true);
        } else {
            // Esconder após transição suave
            const timer = setTimeout(() => setIsVisible(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [currentMode]);

    if (!isVisible) return null;

    const getModeIcon = () => {
        switch (currentMode) {
            case 'full': return '📶';
            case 'reduced': return '📶';
            case 'audio-only': return '🔊';
        }
    };

    const getModeLabel = () => {
        switch (currentMode) {
            case 'full': return 'Qualidade normal';
            case 'reduced': return `Qualidade reduzida (${videoResolution})`;
            case 'audio-only': return 'Modo somente áudio';
        }
    };

    const getModeColor = () => {
        switch (currentMode) {
            case 'full': return '#22c55e';      // verde
            case 'reduced': return '#f59e0b';    // amarelo
            case 'audio-only': return '#ef4444'; // vermelho
        }
    };

    const getSignalBars = () => {
        switch (currentMode) {
            case 'full': return [true, true, true, true];
            case 'reduced': return [true, true, false, false];
            case 'audio-only': return [true, false, false, false];
        }
    };

    return (
        <div
            className="adaptive-quality-overlay"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                borderRadius: '8px',
                padding: isExpanded ? '12px 16px' : '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                zIndex: 100,
                backdropFilter: 'blur(4px)',
                border: `1px solid ${getModeColor()}40`,
            }}
        >
            {/* Linha principal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Ícone de sinal */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
                    {getSignalBars().map((active, i) => (
                        <div
                            key={i}
                            style={{
                                width: '4px',
                                height: `${(i + 1) * 4}px`,
                                backgroundColor: active ? getModeColor() : '#666',
                                borderRadius: '1px',
                                transition: 'background-color 0.3s ease',
                            }}
                        />
                    ))}
                </div>

                {/* Label condensado */}
                <span style={{
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                }}>
                    {currentMode === 'audio-only' ? 'Áudio only' : videoResolution}
                </span>
            </div>

            {/* Detalhes expandidos */}
            {isExpanded && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <span style={{ color: '#ccc', fontSize: '11px' }}>
                        {getModeLabel()}
                    </span>

                    {reason && (
                        <span style={{ color: getModeColor(), fontSize: '11px' }}>
                            {reason}
                        </span>
                    )}

                    {isTranscriptionPaused && (
                        <span style={{
                            color: '#ef4444',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}>
                            ⏸️ Transcrição pausada
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdaptiveQualityOverlay;
