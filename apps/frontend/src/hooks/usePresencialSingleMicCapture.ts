'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { VoiceActivityDetector, blobToBase64, getBestAudioMimeType } from '@/lib/audioUtils';

interface AudioChunk {
    sequence: number;
    speaker: 'mixed';
    audioData: Blob;
    timestamp: Date;
    sent: boolean;
}

interface UsePresencialSingleMicCaptureProps {
    socket: Socket | null;
    microphoneId: string;
}

export function usePresencialSingleMicCapture({
    socket,
    microphoneId
}: UsePresencialSingleMicCaptureProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Usar refs para evitar problemas de closure nos callbacks
    const sessionIdRef = useRef<string | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // Stream de audio
    const streamRef = useRef<MediaStream | null>(null);

    // MediaRecorder
    const recorderRef = useRef<MediaRecorder | null>(null);

    // Voice Activity Detector
    const vadRef = useRef<VoiceActivityDetector | null>(null);

    // Contador de sequencia
    const sequenceRef = useRef(0);

    // Amostras de voz (para VAD)
    const voiceSamplesRef = useRef(0);

    // Buffer de reconexao
    const bufferRef = useRef<AudioChunk[]>([]);

    // Nivel de audio (para UI) - single value
    const [audioLevel, setAudioLevel] = useState(0);

    // Interval para analise de nivel
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Interval para ciclo de gravacao
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Inicia captura de audio
     */
    const startCapture = useCallback(async (sessionId: string) => {
        if (!sessionId) {
            throw new Error('SessionId e obrigatorio para iniciar captura');
        }

        // Armazenar sessionId na ref
        sessionIdRef.current = sessionId;
        console.log(`[SingleMic] SessionId armazenado na ref: ${sessionId}`);

        try {
            // Verificar se socket esta conectado antes de iniciar
            if (!socket || !socket.connected) {
                console.warn('[SingleMic] Socket nao conectado, aguardando conexao...');
                // Aguardar ate 3 segundos pela conexao
                let attempts = 0;
                while ((!socket || !socket.connected) && attempts < 6) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }

                if (!socket || !socket.connected) {
                    throw new Error('Socket nao conectado apos 3 segundos de espera');
                }
            }

            console.log('[SingleMic] Socket verificado como conectado, iniciando captura...');

            // Obter stream de audio - single mic
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: microphoneId ? { exact: microphoneId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;

            // Inicializar VAD
            vadRef.current = new VoiceActivityDetector(stream);

            // Configurar MediaRecorder
            const mimeType = getBestAudioMimeType();

            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 128000
            });

            // Handler para chunks
            let chunks: Blob[] = [];
            recorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            // Quando o recorder parar, processar todos os chunks acumulados
            recorder.onstop = async () => {
                if (chunks.length > 0) {
                    // Combinar todos os chunks em um Blob unico (WebM completo)
                    const completeBlob = new Blob(chunks, { type: mimeType });
                    await handleAudioChunk(completeBlob, sequenceRef.current++, voiceSamplesRef.current);
                    voiceSamplesRef.current = 0; // Reset contador
                    chunks = []; // Limpar chunks

                    // Reiniciar gravacao se ainda estiver em modo de gravacao (usar ref para evitar closure)
                    if (isRecordingRef.current && recorderRef.current && recorderRef.current.state === 'inactive') {
                        console.log('[SingleMic] Reiniciando gravacao...');
                        recorderRef.current.start();
                    }
                }
            };

            recorderRef.current = recorder;

            // Aguardar 500ms adicional para garantir que socket esta completamente pronto
            await new Promise(resolve => setTimeout(resolve, 500));

            // Iniciar gravacao continua (sem timeslice - vamos parar/iniciar manualmente)
            recorder.start();

            // Timer para parar e reiniciar a cada 5 segundos
            recordingIntervalRef.current = setInterval(() => {
                console.log(`[SingleMic] Timer - recorder state: ${recorderRef.current?.state}, isRecordingRef: ${isRecordingRef.current}`);

                if (recorderRef.current && recorderRef.current.state === 'recording') {
                    console.log('[SingleMic] Parando recorder...');
                    recorderRef.current.stop();
                }
            }, 5000);

            // Iniciar monitoramento de niveis de audio
            startLevelMonitoring();

            // Atualizar tanto state quanto ref
            setIsRecording(true);
            isRecordingRef.current = true;

            console.log('[SingleMic] Captura de audio iniciada (1 microfone)');

        } catch (error) {
            console.error('[SingleMic] Erro ao iniciar captura de audio:', error);
            throw error;
        }
    }, [socket, microphoneId]);

    /**
     * Processa chunk de audio
     */
    const handleAudioChunk = async (
        blob: Blob,
        sequence: number,
        voiceSamples: number
    ) => {
        // Verificar VAD - so enviar se detectou voz
        const vad = vadRef.current;

        if (vad && !vad.shouldSendChunk(5000, voiceSamples)) {
            console.log(`[SingleMic] Chunk #${sequence} descartado (silencio)`);
            return;
        }

        const chunk: AudioChunk = {
            sequence,
            speaker: 'mixed',
            audioData: blob,
            timestamp: new Date(),
            sent: false
        };

        // Adicionar ao buffer
        bufferRef.current.push(chunk);

        // Tentar enviar
        await sendChunk(chunk);
    };

    /**
     * Envia chunk para servidor
     */
    const sendChunk = async (chunk: AudioChunk) => {
        const currentSessionId = sessionIdRef.current;

        if (!socket || !socket.connected || !currentSessionId) {
            console.warn(`[SingleMic] Socket nao conectado, chunk em buffer - socket=${!!socket}, connected=${socket?.connected}, sessionId=${currentSessionId}`);
            return;
        }

        try {
            const base64Data = await blobToBase64(chunk.audioData);

            console.log(`[SingleMic] Enviando chunk mixed #${chunk.sequence} (${base64Data.length} chars base64)...`);

            socket.emit('presencialAudioChunk', {
                sessionId: currentSessionId,
                speaker: 'mixed',
                audioChunk: base64Data,
                sequence: chunk.sequence,
                timestamp: chunk.timestamp.toISOString()
            }, (response: any) => {
                if (response?.success) {
                    chunk.sent = true;
                    console.log(`[SingleMic] Chunk mixed #${chunk.sequence} enviado`);
                } else {
                    console.error(`[SingleMic] Erro no callback do chunk mixed #${chunk.sequence}:`, response);
                }
            });

        } catch (error) {
            console.error('[SingleMic] Erro ao enviar chunk:', error);
        }
    };

    /**
     * Monitora niveis de audio para UI
     */
    const startLevelMonitoring = () => {
        levelIntervalRef.current = setInterval(() => {
            if (vadRef.current) {
                const level = vadRef.current.getAudioLevel();
                setAudioLevel(level);

                // Incrementar contador de voz se detectado
                if (vadRef.current.isSpeaking()) {
                    voiceSamplesRef.current++;
                }
            }
        }, 100);
    };

    /**
     * Para captura de audio
     */
    const stopCapture = useCallback(() => {
        // Parar interval de gravacao
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }

        // Parar recorder
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        }

        // Parar stream
        streamRef.current?.getTracks().forEach(track => track.stop());

        // Limpar VAD
        vadRef.current?.destroy();

        // Parar monitoramento de nivel
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
            levelIntervalRef.current = null;
        }

        // Atualizar tanto state quanto ref
        setIsRecording(false);
        isRecordingRef.current = false;
        setAudioLevel(0);

        console.log('[SingleMic] Captura de audio parada');
    }, []);

    /**
     * Reenviar chunks pendentes apos reconexao
     */
    const retryPendingChunks = useCallback(async () => {
        const pending = bufferRef.current.filter(c => !c.sent);
        console.log(`[SingleMic] Reenviando ${pending.length} chunks pendentes...`);

        for (const chunk of pending) {
            await sendChunk(chunk);
        }

        // Limpar chunks enviados apos 5s
        setTimeout(() => {
            bufferRef.current = bufferRef.current.filter(c => !c.sent);
        }, 5000);
    }, [socket]);

    // Efeito: reconectar socket
    useEffect(() => {
        if (socket && socket.connected && bufferRef.current.some(c => !c.sent)) {
            retryPendingChunks();
        }
    }, [socket?.connected, retryPendingChunks]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            stopCapture();
        };
    }, [stopCapture]);

    return {
        isRecording,
        isPaused,
        startCapture,
        stopCapture,
        audioLevel,
        pendingChunks: bufferRef.current.filter(c => !c.sent).length
    };
}
