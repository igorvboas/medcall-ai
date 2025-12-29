'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkQuality, NetworkStatus } from './useNetworkQuality';

// ==================== TIPOS ====================

export type QualityMode = 'full' | 'reduced' | 'audio-only';
export type VideoResolution = '720p' | '360p' | 'off';

export interface AdaptiveQualityState {
    currentMode: QualityMode;
    videoResolution: VideoResolution;
    reason: string | null;
    isTranscriptionPaused: boolean;
}

interface UseAdaptiveQualityOptions {
    peerConnection: RTCPeerConnection | null;
    localStream: MediaStream | null;
    onModeChange?: (mode: QualityMode, reason: string) => void;
    onTranscriptionPause?: () => void;
    onTranscriptionResume?: () => void;
}

// ==================== CONSTANTES ====================

const STABILITY_THRESHOLD_MS = 5000; // Aguardar 5s de estabilidade antes de melhorar
const DEGRADATION_DELAY_MS = 2000;   // Aguardar 2s de problemas antes de degradar

// ==================== HOOK ====================

/**
 * Hook para degradação graciosa de qualidade baseada na rede.
 * 
 * - Excelente/Bom: 720p, todas features
 * - Ruim: 360p, aviso visual
 * - Crítico: Áudio only, transcrição pausada
 */
export function useAdaptiveQuality({
    peerConnection,
    localStream,
    onModeChange,
    onTranscriptionPause,
    onTranscriptionResume,
}: UseAdaptiveQualityOptions) {

    const [state, setState] = useState<AdaptiveQualityState>({
        currentMode: 'full',
        videoResolution: '720p',
        reason: null,
        isTranscriptionPaused: false,
    });

    const networkQuality = useNetworkQuality(peerConnection);
    const lastGoodNetworkRef = useRef<number>(Date.now());
    const lastBadNetworkRef = useRef<number | null>(null);
    const previousModeRef = useRef<QualityMode>('full');

    // Aplicar resolução de vídeo via RTCRtpSender
    const setVideoResolution = useCallback(async (resolution: VideoResolution) => {
        if (!peerConnection) return;

        const videoSender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (!videoSender || !videoSender.track) return;

        try {
            const params = videoSender.getParameters();

            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }

            switch (resolution) {
                case '720p':
                    params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps
                    params.encodings[0].scaleResolutionDownBy = 1;
                    break;
                case '360p':
                    params.encodings[0].maxBitrate = 500000; // 500 Kbps
                    params.encodings[0].scaleResolutionDownBy = 2;
                    break;
                case 'off':
                    // Desativar track de vídeo
                    videoSender.track.enabled = false;
                    console.log('📹 [AdaptiveQuality] Vídeo desativado');
                    return;
            }

            // Garantir que vídeo está habilitado
            videoSender.track.enabled = true;

            await videoSender.setParameters(params);
            console.log(`📹 [AdaptiveQuality] Resolução alterada para ${resolution}`);

        } catch (error) {
            console.error('❌ [AdaptiveQuality] Erro ao alterar resolução:', error);
        }
    }, [peerConnection]);

    // Desativar/ativar vídeo local
    const toggleLocalVideo = useCallback((enabled: boolean) => {
        if (!localStream) return;

        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = enabled;
            console.log(`📹 [AdaptiveQuality] Vídeo local: ${enabled ? 'ativado' : 'desativado'}`);
        }
    }, [localStream]);

    // Lógica de adaptação baseada na qualidade de rede
    useEffect(() => {
        const { status, packetLoss } = networkQuality;
        const now = Date.now();

        // Ignorar se status ainda é desconhecido
        if (status === 'unknown') return;

        // Determinar modo alvo baseado no status
        let targetMode: QualityMode;
        let targetResolution: VideoResolution;
        let reason: string | null = null;

        switch (status) {
            case 'excellent':
            case 'good':
                targetMode = 'full';
                targetResolution = '720p';
                lastGoodNetworkRef.current = now;
                lastBadNetworkRef.current = null;
                break;

            case 'poor':
                targetMode = 'reduced';
                targetResolution = '360p';
                reason = `Conexão instável (${packetLoss.toFixed(1)}% perda)`;
                lastBadNetworkRef.current = lastBadNetworkRef.current || now;
                break;

            case 'critical':
                targetMode = 'audio-only';
                targetResolution = 'off';
                reason = `Conexão crítica (${packetLoss.toFixed(1)}% perda)`;
                lastBadNetworkRef.current = lastBadNetworkRef.current || now;
                break;

            default:
                return;
        }

        // Lógica de histerese para evitar oscilações
        const timeSinceGood = now - lastGoodNetworkRef.current;
        const timeSinceBad = lastBadNetworkRef.current ? now - lastBadNetworkRef.current : 0;

        // Para DEGRADAR: aguardar DEGRADATION_DELAY_MS de problemas
        if (targetMode !== 'full' && state.currentMode === 'full') {
            if (timeSinceBad < DEGRADATION_DELAY_MS) {
                return; // Aguardar mais antes de degradar
            }
        }

        // Para MELHORAR: aguardar STABILITY_THRESHOLD_MS de boa conexão
        if (targetMode === 'full' && state.currentMode !== 'full') {
            if (timeSinceGood < STABILITY_THRESHOLD_MS) {
                return; // Aguardar estabilidade antes de melhorar
            }
        }

        // Aplicar mudança se diferente do estado atual
        if (targetMode !== state.currentMode || targetResolution !== state.videoResolution) {
            console.log(`🔄 [AdaptiveQuality] Mudando de ${state.currentMode} para ${targetMode}`);

            // Aplicar resolução
            setVideoResolution(targetResolution);

            // Controlar vídeo local
            toggleLocalVideo(targetResolution !== 'off');

            // Controlar transcrição
            const shouldPauseTranscription = targetMode === 'audio-only';
            if (shouldPauseTranscription && !state.isTranscriptionPaused) {
                console.log('⏸️ [AdaptiveQuality] Pausando transcrição');
                onTranscriptionPause?.();
            } else if (!shouldPauseTranscription && state.isTranscriptionPaused) {
                console.log('▶️ [AdaptiveQuality] Retomando transcrição');
                onTranscriptionResume?.();
            }

            // Atualizar estado
            setState({
                currentMode: targetMode,
                videoResolution: targetResolution,
                reason,
                isTranscriptionPaused: shouldPauseTranscription,
            });

            // Callback de mudança
            if (targetMode !== previousModeRef.current) {
                onModeChange?.(targetMode, reason || 'Conexão estável');
                previousModeRef.current = targetMode;
            }
        }
    }, [
        networkQuality,
        state.currentMode,
        state.videoResolution,
        state.isTranscriptionPaused,
        setVideoResolution,
        toggleLocalVideo,
        onModeChange,
        onTranscriptionPause,
        onTranscriptionResume,
    ]);

    // ==================== API PÚBLICA ====================

    const forceMode = useCallback((mode: QualityMode) => {
        let resolution: VideoResolution;
        switch (mode) {
            case 'full': resolution = '720p'; break;
            case 'reduced': resolution = '360p'; break;
            case 'audio-only': resolution = 'off'; break;
        }

        setVideoResolution(resolution);
        toggleLocalVideo(resolution !== 'off');

        setState(prev => ({
            ...prev,
            currentMode: mode,
            videoResolution: resolution,
            reason: 'Modo forçado manualmente',
        }));
    }, [setVideoResolution, toggleLocalVideo]);

    return {
        ...state,
        networkStatus: networkQuality.status,
        packetLoss: networkQuality.packetLoss,
        roundTripTime: networkQuality.roundTripTime,
        forceMode,
    };
}

export default useAdaptiveQuality;
