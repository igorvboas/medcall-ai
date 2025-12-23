'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== TIPOS ====================

export interface VisibilityState {
    isVisible: boolean;
    wentBackgroundAt: number | null;
    timeInBackground: number;
    wasRecentlyInBackground: boolean;
}

interface UseVisibilityHandlerOptions {
    socket: any;
    roomId: string;
    peerConnection: RTCPeerConnection | null;
    onWentBackground?: () => void;
    onReturnedForeground?: (timeInBackground: number) => void;
    onIceRestart?: () => void;
}

// ==================== CONSTANTES ====================

const ICE_RESTART_THRESHOLD_MS = 5000;   // Reiniciar ICE se ficou > 5s em background
const RECONNECT_THRESHOLD_MS = 30000;    // Reconexão completa se ficou > 30s em background
const RECENT_BACKGROUND_DURATION = 10000; // Considerar "recentemente" por 10s

// ==================== HOOK ====================

/**
 * Hook para gerenciar comportamento quando app vai para background (mobile).
 * 
 * Eventos monitorados:
 * - visibilitychange
 * - pagehide / pageshow
 * - focus / blur
 * 
 * Ações automáticas:
 * - Notifica outro peer quando vai para background
 * - ICE restart quando retorna após breve background
 * - Reconexão completa após longo background
 */
export function useVisibilityHandler({
    socket,
    roomId,
    peerConnection,
    onWentBackground,
    onReturnedForeground,
    onIceRestart,
}: UseVisibilityHandlerOptions) {

    const [state, setState] = useState<VisibilityState>({
        isVisible: true,
        wentBackgroundAt: null,
        timeInBackground: 0,
        wasRecentlyInBackground: false,
    });

    const recentBackgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Notificar peer via socket
    const notifyPeerStatus = useCallback((status: 'background' | 'active') => {
        if (socket && roomId) {
            socket.emit(status === 'background' ? 'peer-went-background' : 'peer-returned', {
                roomId,
            });
            console.log(`📱 [Visibility] Notificando peer: ${status}`);
        }
    }, [socket, roomId]);

    // Tentar ICE restart
    const attemptIceRestart = useCallback(() => {
        if (peerConnection && peerConnection.connectionState !== 'closed') {
            console.log('🔄 [Visibility] Tentando ICE restart...');

            try {
                peerConnection.restartIce();
                onIceRestart?.();
            } catch (error) {
                console.error('❌ [Visibility] Erro ao reiniciar ICE:', error);
            }
        }
    }, [peerConnection, onIceRestart]);

    // Handler quando página fica invisível
    const handleHidden = useCallback(() => {
        const now = Date.now();

        console.log('📱 [Visibility] App foi para background');

        setState(prev => ({
            ...prev,
            isVisible: false,
            wentBackgroundAt: now,
        }));

        notifyPeerStatus('background');
        onWentBackground?.();
    }, [notifyPeerStatus, onWentBackground]);

    // Handler quando página fica visível novamente
    const handleVisible = useCallback(() => {
        const now = Date.now();

        setState(prev => {
            const timeInBackground = prev.wentBackgroundAt
                ? now - prev.wentBackgroundAt
                : 0;

            console.log(`📱 [Visibility] App retornou do background após ${timeInBackground}ms`);

            // Determinar ação baseada no tempo em background
            if (timeInBackground > RECONNECT_THRESHOLD_MS) {
                console.log('📱 [Visibility] Longo tempo em background, reconexão completa necessária');
                // A reconexão completa será tratada pelo componente pai
            } else if (timeInBackground > ICE_RESTART_THRESHOLD_MS) {
                console.log('📱 [Visibility] Tempo médio em background, tentando ICE restart');
                attemptIceRestart();
            }

            // Notificar peer que voltou
            notifyPeerStatus('active');
            onReturnedForeground?.(timeInBackground);

            // Limpar timer anterior de "recentemente em background"
            if (recentBackgroundTimerRef.current) {
                clearTimeout(recentBackgroundTimerRef.current);
            }

            // Marcar como "recentemente em background" por alguns segundos
            recentBackgroundTimerRef.current = setTimeout(() => {
                setState(s => ({ ...s, wasRecentlyInBackground: false }));
            }, RECENT_BACKGROUND_DURATION);

            return {
                isVisible: true,
                wentBackgroundAt: null,
                timeInBackground,
                wasRecentlyInBackground: true,
            };
        });
    }, [attemptIceRestart, notifyPeerStatus, onReturnedForeground]);

    // Setup event listeners
    useEffect(() => {
        // Handler principal de visibilidade
        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleHidden();
            } else {
                handleVisible();
            }
        };

        // Page lifecycle events (mais confiáveis em mobile)
        const handlePageHide = () => handleHidden();
        const handlePageShow = () => handleVisible();

        // Focus/blur como fallback
        const handleBlur = () => {
            // Só tratar como background se a janela perdeu foco por completo
            // Isso evita falsos positivos quando usuário clica em outro elemento
        };

        const handleFocus = () => {
            // Verificar se realmente estava em background
            if (!document.hidden) {
                // Já está visível, não precisa fazer nada
            }
        };

        // Registrar listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        // Cleanup
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);

            if (recentBackgroundTimerRef.current) {
                clearTimeout(recentBackgroundTimerRef.current);
            }
        };
    }, [handleHidden, handleVisible]);

    // ==================== API PÚBLICA ====================

    const forceIceRestart = useCallback(() => {
        attemptIceRestart();
    }, [attemptIceRestart]);

    return {
        ...state,
        forceIceRestart,
        needsReconnection: state.timeInBackground > RECONNECT_THRESHOLD_MS,
        needsIceRestart: state.timeInBackground > ICE_RESTART_THRESHOLD_MS,
    };
}

export default useVisibilityHandler;
