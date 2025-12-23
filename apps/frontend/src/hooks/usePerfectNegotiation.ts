'use client';

import { useRef, useCallback, useEffect } from 'react';

// ==================== TIPOS ====================

interface PerfectNegotiationOptions {
    peerConnection: RTCPeerConnection | null;
    socket: any; // Socket.IO socket
    roomId: string;
    isPolite: boolean; // true = paciente (polite), false = médico (impolite)
    localStream: MediaStream | null;
    onRemoteStream?: (stream: MediaStream) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
}

interface NegotiationState {
    makingOffer: boolean;
    ignoreOffer: boolean;
    isSettingRemoteAnswer: boolean;
}

// ==================== HOOK ====================

/**
 * Hook que implementa o padrão "Perfect Negotiation" do WebRTC 1.0.
 * 
 * O padrão resolve problemas de "glare" (colisão quando ambos os peers
 * tentam negociar simultaneamente).
 * 
 * - IMPOLITE (médico): Ignora ofertas recebidas se estiver fazendo uma
 * - POLITE (paciente): Faz rollback e aceita ofertas em caso de colisão
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 */
export function usePerfectNegotiation({
    peerConnection,
    socket,
    roomId,
    isPolite,
    localStream,
    onRemoteStream,
    onConnected,
    onDisconnected,
    onError,
}: PerfectNegotiationOptions) {

    const stateRef = useRef<NegotiationState>({
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswer: false,
    });

    const roleLabel = isPolite ? '🩺 [PACIENTE]' : '👨‍⚕️ [MÉDICO]';

    // ==================== CRIAR OFFER ====================

    const createOffer = useCallback(async () => {
        if (!peerConnection || !socket) {
            console.error(`${roleLabel} createOffer: peerConnection ou socket não disponível`);
            return;
        }

        try {
            stateRef.current.makingOffer = true;
            console.log(`${roleLabel} Criando offer...`);

            const offer = await peerConnection.createOffer();

            // Verificar se o estado de sinalização ainda permite
            if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
                console.warn(`${roleLabel} Estado de sinalização inesperado: ${peerConnection.signalingState}`);
            }

            await peerConnection.setLocalDescription(offer);

            console.log(`${roleLabel} Offer criada, enviando via signaling...`);
            socket.emit('newOffer', {
                roomId,
                offer: peerConnection.localDescription,
            });

        } catch (error) {
            console.error(`${roleLabel} Erro ao criar offer:`, error);
            onError?.(error as Error);
        } finally {
            stateRef.current.makingOffer = false;
        }
    }, [peerConnection, socket, roomId, roleLabel, onError]);

    // ==================== PROCESSAR OFFER (com Perfect Negotiation) ====================

    const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, offererUserName: string) => {
        if (!peerConnection || !socket) return;

        const state = stateRef.current;
        const signalingState = peerConnection.signalingState;

        console.log(`${roleLabel} Recebeu offer de ${offererUserName}. Estado: ${signalingState}, makingOffer: ${state.makingOffer}`);

        // Detectar colisão (glare)
        const offerCollision = state.makingOffer || signalingState !== 'stable';

        if (offerCollision) {
            console.log(`${roleLabel} COLISÃO DETECTADA! isPolite: ${isPolite}`);

            if (!isPolite) {
                // IMPOLITE: Ignorar offer durante colisão
                console.log(`${roleLabel} IMPOLITE: Ignorando offer (já estou fazendo uma)`);
                state.ignoreOffer = true;
                return;
            }

            // POLITE: Fazer rollback e aceitar offer
            console.log(`${roleLabel} POLITE: Fazendo rollback e aceitando offer...`);

            try {
                // Rollback da offer anterior
                await peerConnection.setLocalDescription({ type: 'rollback' });
            } catch (rollbackError) {
                console.warn(`${roleLabel} Rollback falhou (pode ser ok):`, rollbackError);
            }
        }

        state.ignoreOffer = false;

        try {
            console.log(`${roleLabel} Definindo remote description (offer)...`);
            await peerConnection.setRemoteDescription(offer);

            // Criar e enviar answer
            console.log(`${roleLabel} Criando answer...`);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log(`${roleLabel} Answer criada, enviando...`);
            socket.emit('newAnswer', {
                roomId,
                answer: peerConnection.localDescription,
            });

        } catch (error) {
            console.error(`${roleLabel} Erro ao processar offer:`, error);
            onError?.(error as Error);
        }
    }, [peerConnection, socket, roomId, isPolite, roleLabel, onError]);

    // ==================== PROCESSAR ANSWER ====================

    const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
        if (!peerConnection) return;

        const state = stateRef.current;

        // Verificar estado
        if (peerConnection.signalingState !== 'have-local-offer') {
            console.warn(`${roleLabel} Answer ignorada - estado: ${peerConnection.signalingState}`);
            return;
        }

        try {
            state.isSettingRemoteAnswer = true;
            console.log(`${roleLabel} Definindo remote description (answer)...`);

            await peerConnection.setRemoteDescription(answer);

            console.log(`${roleLabel} Answer processada com sucesso!`);

        } catch (error) {
            console.error(`${roleLabel} Erro ao processar answer:`, error);
            onError?.(error as Error);
        } finally {
            state.isSettingRemoteAnswer = false;
        }
    }, [peerConnection, roleLabel, onError]);

    // ==================== PROCESSAR ICE CANDIDATE ====================

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (!peerConnection) return;

        // Ignorar se estamos ignorando a offer correspondente
        if (stateRef.current.ignoreOffer) {
            console.log(`${roleLabel} ICE candidate ignorado (offer foi ignorada)`);
            return;
        }

        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            // Ignorar erros de ICE se estamos ignorando a offer
            if (!stateRef.current.ignoreOffer) {
                console.error(`${roleLabel} Erro ao adicionar ICE candidate:`, error);
            }
        }
    }, [peerConnection, roleLabel]);

    // ==================== SETUP PEER CONNECTION EVENTS ====================

    useEffect(() => {
        if (!peerConnection) return;

        // Evento de negociação necessária
        const handleNegotiationNeeded = async () => {
            console.log(`${roleLabel} onnegotiationneeded disparado`);

            // Só o IMPOLITE (médico) inicia negociação proativamente
            if (!isPolite) {
                await createOffer();
            }
        };

        // Evento de ICE candidate local
        const handleLocalIceCandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && socket) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    roomId,
                    iceCandidate: event.candidate,
                    didIOffer: !isPolite, // médico é quem fez offer
                });
            }
        };

        // Evento de track remoto
        const handleTrack = (event: RTCTrackEvent) => {
            console.log(`${roleLabel} Track remoto recebido:`, event.track.kind);
            if (event.streams[0]) {
                onRemoteStream?.(event.streams[0]);
            }
        };

        // Evento de estado de conexão
        const handleConnectionStateChange = () => {
            const state = peerConnection.connectionState;
            console.log(`${roleLabel} Connection state: ${state}`);

            if (state === 'connected') {
                onConnected?.();
            } else if (state === 'disconnected' || state === 'failed') {
                onDisconnected?.();
            }
        };

        peerConnection.addEventListener('negotiationneeded', handleNegotiationNeeded);
        peerConnection.addEventListener('icecandidate', handleLocalIceCandidate);
        peerConnection.addEventListener('track', handleTrack);
        peerConnection.addEventListener('connectionstatechange', handleConnectionStateChange);

        return () => {
            peerConnection.removeEventListener('negotiationneeded', handleNegotiationNeeded);
            peerConnection.removeEventListener('icecandidate', handleLocalIceCandidate);
            peerConnection.removeEventListener('track', handleTrack);
            peerConnection.removeEventListener('connectionstatechange', handleConnectionStateChange);
        };
    }, [peerConnection, socket, roomId, isPolite, createOffer, onRemoteStream, onConnected, onDisconnected, roleLabel]);

    // ==================== SETUP SOCKET EVENTS ====================

    useEffect(() => {
        if (!socket) return;

        // Listener de offer recebida
        const handleOfferReceived = (data: { offer: RTCSessionDescriptionInit; offererUserName: string }) => {
            console.log(`${roleLabel} Evento newOfferAwaiting recebido`);
            handleOffer(data.offer, data.offererUserName);
        };

        // Listener de answer recebida
        const handleAnswerReceived = (data: { answer: RTCSessionDescriptionInit }) => {
            console.log(`${roleLabel} Evento answerResponse recebido`);
            handleAnswer(data.answer);
        };

        // Listener de ICE candidate recebido
        const handleIceCandidateReceived = (candidate: RTCIceCandidateInit) => {
            handleIceCandidate(candidate);
        };

        socket.on('newOfferAwaiting', handleOfferReceived);
        socket.on('answerResponse', handleAnswerReceived);
        socket.on('receivedIceCandidateFromServer', handleIceCandidateReceived);

        return () => {
            socket.off('newOfferAwaiting', handleOfferReceived);
            socket.off('answerResponse', handleAnswerReceived);
            socket.off('receivedIceCandidateFromServer', handleIceCandidateReceived);
        };
    }, [socket, handleOffer, handleAnswer, handleIceCandidate, roleLabel]);

    // ==================== API PÚBLICA ====================

    return {
        createOffer,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        isPolite,
    };
}

export default usePerfectNegotiation;
