'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ==================== TIPOS ====================

export type NetworkStatus = 'excellent' | 'good' | 'poor' | 'critical' | 'unknown';

export interface NetworkQuality {
    status: NetworkStatus;
    packetLoss: number;           // 0-100%
    roundTripTime: number;        // ms
    jitter: number;               // ms
    availableBandwidth: number;   // kbps (estimado)
    timestamp: number;
}

interface NetworkStats {
    packetsLost: number;
    packetsSent: number;
    bytesReceived: number;
    bytesSent: number;
    currentRoundTripTime: number;
    jitter: number;
}

// ==================== CONSTANTES ====================

const POLL_INTERVAL_MS = 3000; // Verificar a cada 3 segundos

const THRESHOLDS = {
    packetLoss: {
        excellent: 0,
        good: 2,
        poor: 5,
        critical: 10,
    },
    rtt: {
        excellent: 100,
        good: 200,
        poor: 400,
        critical: 800,
    },
};

// ==================== HOOK ====================

export function useNetworkQuality(peerConnection: RTCPeerConnection | null) {
    const [quality, setQuality] = useState<NetworkQuality>({
        status: 'unknown',
        packetLoss: 0,
        roundTripTime: 0,
        jitter: 0,
        availableBandwidth: 0,
        timestamp: Date.now(),
    });

    const prevStatsRef = useRef<NetworkStats | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Calcular status baseado nas métricas
    const calculateStatus = useCallback((packetLoss: number, rtt: number): NetworkStatus => {
        // Packet loss tem prioridade (mais crítico)
        if (packetLoss >= THRESHOLDS.packetLoss.critical) return 'critical';
        if (packetLoss >= THRESHOLDS.packetLoss.poor) return 'poor';

        // Se RTT está muito alto, também é problema
        if (rtt >= THRESHOLDS.rtt.critical) return 'critical';
        if (rtt >= THRESHOLDS.rtt.poor) return 'poor';

        // Combinação de métricas ok
        if (packetLoss <= THRESHOLDS.packetLoss.excellent && rtt <= THRESHOLDS.rtt.excellent) {
            return 'excellent';
        }

        return 'good';
    }, []);

    // Função para coletar stats
    const collectStats = useCallback(async () => {
        if (!peerConnection || peerConnection.connectionState === 'closed') {
            return;
        }

        try {
            const stats = await peerConnection.getStats();
            let packetsLost = 0;
            let packetsSent = 0;
            let bytesReceived = 0;
            let bytesSent = 0;
            let currentRoundTripTime = 0;
            let jitter = 0;

            stats.forEach((report) => {
                // Outbound RTP (áudio enviado)
                if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                    packetsSent = report.packetsSent || 0;
                    bytesSent = report.bytesSent || 0;
                }

                // Inbound RTP (áudio recebido)
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    packetsLost = report.packetsLost || 0;
                    bytesReceived = report.bytesReceived || 0;
                    jitter = (report.jitter || 0) * 1000; // Converter para ms
                }

                // Candidate pair (RTT)
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    currentRoundTripTime = (report.currentRoundTripTime || 0) * 1000; // Converter para ms
                }
            });

            const currentStats: NetworkStats = {
                packetsLost,
                packetsSent,
                bytesReceived,
                bytesSent,
                currentRoundTripTime,
                jitter,
            };

            // Calcular packet loss (delta desde última medição)
            let packetLossPercent = 0;
            if (prevStatsRef.current && packetsSent > prevStatsRef.current.packetsSent) {
                const deltaLost = packetsLost - prevStatsRef.current.packetsLost;
                const deltaSent = packetsSent - prevStatsRef.current.packetsSent;
                if (deltaSent > 0) {
                    packetLossPercent = (deltaLost / deltaSent) * 100;
                }
            }

            // Estimar bandwidth (bytes/s -> kbps)
            let estimatedBandwidth = 0;
            if (prevStatsRef.current) {
                const deltaBytesReceived = bytesReceived - prevStatsRef.current.bytesReceived;
                const deltaBytesSent = bytesSent - prevStatsRef.current.bytesSent;
                const totalDeltaBytes = deltaBytesReceived + deltaBytesSent;
                estimatedBandwidth = (totalDeltaBytes * 8) / (POLL_INTERVAL_MS / 1000) / 1000; // kbps
            }

            const status = calculateStatus(packetLossPercent, currentRoundTripTime);

            setQuality({
                status,
                packetLoss: Math.round(packetLossPercent * 100) / 100,
                roundTripTime: Math.round(currentRoundTripTime),
                jitter: Math.round(jitter),
                availableBandwidth: Math.round(estimatedBandwidth),
                timestamp: Date.now(),
            });

            prevStatsRef.current = currentStats;

            // Log apenas quando status muda para pior
            if (status === 'poor' || status === 'critical') {
                console.warn(`⚠️ [NetworkQuality] Status: ${status} | Packet Loss: ${packetLossPercent.toFixed(2)}% | RTT: ${currentRoundTripTime}ms`);
            }

        } catch (error) {
            console.error('❌ [NetworkQuality] Erro ao coletar stats:', error);
        }
    }, [peerConnection, calculateStatus]);

    // Iniciar/parar polling
    useEffect(() => {
        if (peerConnection && peerConnection.connectionState === 'connected') {
            console.log('🔊 [NetworkQuality] Iniciando monitoramento de qualidade de rede');

            // Coletar imediatamente
            collectStats();

            // Iniciar polling
            pollIntervalRef.current = setInterval(collectStats, POLL_INTERVAL_MS);
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [peerConnection, collectStats]);

    // Resetar quando desconectar
    useEffect(() => {
        if (peerConnection) {
            const handleStateChange = () => {
                if (peerConnection.connectionState !== 'connected') {
                    setQuality(prev => ({ ...prev, status: 'unknown' }));
                    prevStatsRef.current = null;
                }
            };

            peerConnection.addEventListener('connectionstatechange', handleStateChange);
            return () => peerConnection.removeEventListener('connectionstatechange', handleStateChange);
        }
    }, [peerConnection]);

    return quality;
}

export default useNetworkQuality;
