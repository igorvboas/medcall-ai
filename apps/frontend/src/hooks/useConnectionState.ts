'use client';

import { useReducer, useCallback, useRef, useEffect } from 'react';

// ==================== TIPOS ====================

export type ConnectionPhase =
    | 'IDLE'           // Aguardando inicialização
    | 'CONNECTING'     // Socket.IO conectando
    | 'MEDIA_READY'    // getUserMedia obtido
    | 'SIGNALING'      // Offer/Answer em andamento
    | 'CONNECTED'      // ICE connected
    | 'RECONNECTING'   // Tentando reconectar
    | 'FAILED';        // Falha permanente

interface ConnectionState {
    phase: ConnectionPhase;
    socketConnected: boolean;
    mediaReady: boolean;
    peerConnected: boolean;
    participantJoined: boolean;
    callStarted: boolean;
    pendingOffer: RTCSessionDescriptionInit | null;
    reconnectAttempts: number;
    error: string | null;
}

type ConnectionAction =
    | { type: 'SOCKET_CONNECTED' }
    | { type: 'SOCKET_DISCONNECTED' }
    | { type: 'MEDIA_READY' }
    | { type: 'MEDIA_FAILED'; error: string }
    | { type: 'PARTICIPANT_JOINED' }
    | { type: 'PARTICIPANT_LEFT' }
    | { type: 'OFFER_RECEIVED'; offer: RTCSessionDescriptionInit }
    | { type: 'OFFER_CLEARED' }
    | { type: 'CALL_STARTED' }
    | { type: 'CALL_ENDED' }
    | { type: 'PEER_CONNECTED' }
    | { type: 'PEER_DISCONNECTED' }
    | { type: 'RECONNECTING' }
    | { type: 'RECONNECT_ATTEMPT' }
    | { type: 'RECONNECT_SUCCESS' }
    | { type: 'RECONNECT_FAILED' }
    | { type: 'RESET' };

// ==================== CONSTANTES ====================

const MAX_RECONNECT_ATTEMPTS = 5;

const initialState: ConnectionState = {
    phase: 'IDLE',
    socketConnected: false,
    mediaReady: false,
    peerConnected: false,
    participantJoined: false,
    callStarted: false,
    pendingOffer: null,
    reconnectAttempts: 0,
    error: null,
};

// ==================== REDUCER ====================

function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
    switch (action.type) {
        case 'SOCKET_CONNECTED':
            return {
                ...state,
                socketConnected: true,
                phase: state.mediaReady ? 'SIGNALING' : 'CONNECTING',
                error: null,
            };

        case 'SOCKET_DISCONNECTED':
            return {
                ...state,
                socketConnected: false,
                phase: 'RECONNECTING',
            };

        case 'MEDIA_READY':
            return {
                ...state,
                mediaReady: true,
                phase: state.socketConnected ? 'SIGNALING' : 'MEDIA_READY',
                error: null,
            };

        case 'MEDIA_FAILED':
            return {
                ...state,
                mediaReady: false,
                phase: 'FAILED',
                error: action.error,
            };

        case 'PARTICIPANT_JOINED':
            return {
                ...state,
                participantJoined: true,
            };

        case 'PARTICIPANT_LEFT':
            return {
                ...state,
                participantJoined: false,
                peerConnected: false,
            };

        case 'OFFER_RECEIVED':
            return {
                ...state,
                pendingOffer: action.offer,
            };

        case 'OFFER_CLEARED':
            return {
                ...state,
                pendingOffer: null,
            };

        case 'CALL_STARTED':
            return {
                ...state,
                callStarted: true,
                phase: 'SIGNALING',
            };

        case 'CALL_ENDED':
            return {
                ...state,
                callStarted: false,
                peerConnected: false,
                phase: 'IDLE',
            };

        case 'PEER_CONNECTED':
            return {
                ...state,
                peerConnected: true,
                phase: 'CONNECTED',
                reconnectAttempts: 0,
                error: null,
            };

        case 'PEER_DISCONNECTED':
            return {
                ...state,
                peerConnected: false,
                phase: state.socketConnected ? 'RECONNECTING' : 'FAILED',
            };

        case 'RECONNECTING':
            return {
                ...state,
                phase: 'RECONNECTING',
            };

        case 'RECONNECT_ATTEMPT':
            return {
                ...state,
                reconnectAttempts: state.reconnectAttempts + 1,
                phase: state.reconnectAttempts + 1 >= MAX_RECONNECT_ATTEMPTS
                    ? 'FAILED'
                    : 'RECONNECTING',
            };

        case 'RECONNECT_SUCCESS':
            return {
                ...state,
                peerConnected: true,
                phase: 'CONNECTED',
                reconnectAttempts: 0,
            };

        case 'RECONNECT_FAILED':
            return {
                ...state,
                phase: 'FAILED',
                error: 'Falha na reconexão após múltiplas tentativas',
            };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

// ==================== HOOK ====================

interface UseConnectionStateOptions {
    role: 'host' | 'participant';
    onReadyToCall?: () => void;
    onReadyToAnswer?: (offer: RTCSessionDescriptionInit) => void;
    onReconnectNeeded?: () => void;
}

export function useConnectionState(options: UseConnectionStateOptions) {
    const { role, onReadyToCall, onReadyToAnswer, onReconnectNeeded } = options;
    const [state, dispatch] = useReducer(connectionReducer, initialState);

    // Refs para callbacks (evitar stale closures)
    const onReadyToCallRef = useRef(onReadyToCall);
    const onReadyToAnswerRef = useRef(onReadyToAnswer);
    const onReconnectNeededRef = useRef(onReconnectNeeded);

    useEffect(() => {
        onReadyToCallRef.current = onReadyToCall;
        onReadyToAnswerRef.current = onReadyToAnswer;
        onReconnectNeededRef.current = onReconnectNeeded;
    });

    // ✅ Efeito: Médico está pronto para ligar
    useEffect(() => {
        if (
            role === 'host' &&
            state.socketConnected &&
            state.mediaReady &&
            state.participantJoined &&
            !state.callStarted
        ) {
            console.log('📞 [ConnectionState] Médico pronto para iniciar chamada');
            onReadyToCallRef.current?.();
        }
    }, [role, state.socketConnected, state.mediaReady, state.participantJoined, state.callStarted]);

    // ✅ Efeito: Paciente está pronto para responder
    useEffect(() => {
        if (
            role === 'participant' &&
            state.socketConnected &&
            state.mediaReady &&
            state.pendingOffer &&
            !state.callStarted
        ) {
            console.log('📞 [ConnectionState] Paciente pronto para responder');
            onReadyToAnswerRef.current?.(state.pendingOffer);
        }
    }, [role, state.socketConnected, state.mediaReady, state.pendingOffer, state.callStarted]);

    // ✅ Efeito: Reconexão necessária
    useEffect(() => {
        if (state.phase === 'RECONNECTING') {
            console.log('🔄 [ConnectionState] Reconexão necessária');
            onReconnectNeededRef.current?.();
        }
    }, [state.phase]);

    // ==================== ACTIONS ====================

    const actions = {
        socketConnected: useCallback(() => dispatch({ type: 'SOCKET_CONNECTED' }), []),
        socketDisconnected: useCallback(() => dispatch({ type: 'SOCKET_DISCONNECTED' }), []),
        mediaReady: useCallback(() => dispatch({ type: 'MEDIA_READY' }), []),
        mediaFailed: useCallback((error: string) => dispatch({ type: 'MEDIA_FAILED', error }), []),
        participantJoined: useCallback(() => dispatch({ type: 'PARTICIPANT_JOINED' }), []),
        participantLeft: useCallback(() => dispatch({ type: 'PARTICIPANT_LEFT' }), []),
        offerReceived: useCallback((offer: RTCSessionDescriptionInit) =>
            dispatch({ type: 'OFFER_RECEIVED', offer }), []),
        offerCleared: useCallback(() => dispatch({ type: 'OFFER_CLEARED' }), []),
        callStarted: useCallback(() => dispatch({ type: 'CALL_STARTED' }), []),
        callEnded: useCallback(() => dispatch({ type: 'CALL_ENDED' }), []),
        peerConnected: useCallback(() => dispatch({ type: 'PEER_CONNECTED' }), []),
        peerDisconnected: useCallback(() => dispatch({ type: 'PEER_DISCONNECTED' }), []),
        reconnecting: useCallback(() => dispatch({ type: 'RECONNECTING' }), []),
        reconnectAttempt: useCallback(() => dispatch({ type: 'RECONNECT_ATTEMPT' }), []),
        reconnectSuccess: useCallback(() => dispatch({ type: 'RECONNECT_SUCCESS' }), []),
        reconnectFailed: useCallback(() => dispatch({ type: 'RECONNECT_FAILED' }), []),
        reset: useCallback(() => dispatch({ type: 'RESET' }), []),
    };

    // ==================== HELPERS ====================

    const canStartCall = role === 'host' &&
        state.socketConnected &&
        state.mediaReady &&
        state.participantJoined &&
        !state.callStarted;

    const canAnswerCall = role === 'participant' &&
        state.socketConnected &&
        state.mediaReady &&
        state.pendingOffer !== null &&
        !state.callStarted;

    const isConnected = state.phase === 'CONNECTED';
    const isFailed = state.phase === 'FAILED';
    const isReconnecting = state.phase === 'RECONNECTING';

    return {
        state,
        actions,
        phase: state.phase,
        canStartCall,
        canAnswerCall,
        isConnected,
        isFailed,
        isReconnecting,
        reconnectAttempts: state.reconnectAttempts,
        maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    };
}

export default useConnectionState;
