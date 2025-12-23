'use client';

import { useEffect, useState } from 'react';
import type { NetworkStatus } from '@/hooks/useNetworkQuality';

interface NetworkWarningProps {
    status: NetworkStatus;
    packetLoss: number;
    onTranscriptionPaused?: () => void;
    onTranscriptionResumed?: () => void;
}

/**
 * Componente visual para avisar sobre problemas de conexão.
 * Exibe toast/banner quando a rede está ruim.
 */
export function NetworkWarning({
    status,
    packetLoss,
    onTranscriptionPaused,
    onTranscriptionResumed,
}: NetworkWarningProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [wasTranscriptionPaused, setWasTranscriptionPaused] = useState(false);

    useEffect(() => {
        if (status === 'critical') {
            setIsVisible(true);
            setMessage(`Conexão crítica (${packetLoss.toFixed(1)}% de perda). Transcrição pausada.`);

            if (!wasTranscriptionPaused) {
                onTranscriptionPaused?.();
                setWasTranscriptionPaused(true);
            }
        } else if (status === 'poor') {
            setIsVisible(true);
            setMessage(`Conexão instável (${packetLoss.toFixed(1)}% de perda). Transcrição pode ser pausada.`);
        } else if (status === 'good' || status === 'excellent') {
            // Esconder aviso após 2 segundos de boa conexão
            const timer = setTimeout(() => {
                setIsVisible(false);
                setMessage('');

                if (wasTranscriptionPaused) {
                    onTranscriptionResumed?.();
                    setWasTranscriptionPaused(false);
                }
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [status, packetLoss, wasTranscriptionPaused, onTranscriptionPaused, onTranscriptionResumed]);

    if (!isVisible) return null;

    const getStatusColor = () => {
        switch (status) {
            case 'critical': return '#ef4444'; // vermelho
            case 'poor': return '#f59e0b';     // amarelo/laranja
            default: return '#22c55e';          // verde
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'critical': return '🔴';
            case 'poor': return '🟡';
            default: return '🟢';
        }
    };

    return (
        <div
            className="network-warning"
            style={{
                position: 'fixed',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                borderLeft: `4px solid ${getStatusColor()}`,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                animation: 'slideDown 0.3s ease-out',
                maxWidth: '90vw',
            }}
        >
            <span style={{ fontSize: '18px' }}>{getStatusIcon()}</span>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{message}</span>

            <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
        </div>
    );
}

export default NetworkWarning;
