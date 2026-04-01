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
    const [stream, setStream] = useState<MediaStream | null>(null);

    const sessionIdRef = useRef<string | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // Stream de audio
    const streamRef = useRef<MediaStream | null>(null);

    // RECORDER 1: Immediate (5s) — transcricao rapida incremental
    const immediateRecorderRef = useRef<MediaRecorder | null>(null);

    // RECORDER 2: Full session — grava consulta inteira para diarizacao no final
    const fullRecorderRef = useRef<MediaRecorder | null>(null);
    const fullChunksRef = useRef<Blob[]>([]);
    const fullAudioResolveRef = useRef<((blob: Blob) => void) | null>(null);
    const fullMimeTypeRef = useRef<string>('');

    // Voice Activity Detector
    const vadRef = useRef<VoiceActivityDetector | null>(null);

    // Contador de sequencia
    const sequenceRef = useRef(0);

    // Buffer de reconexao
    const bufferRef = useRef<AudioChunk[]>([]);

    // Nivel de audio (para UI)
    const [audioLevel, setAudioLevel] = useState(0);

    // Intervals
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const immediateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fullDataIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Inicia captura de audio com dois recorders paralelos:
     * 1. Immediate (5s): transcricao rapida incremental
     * 2. Full session: grava tudo para diarizacao ao finalizar consulta
     */
    const startCapture = useCallback(async (sessionId: string) => {
        if (!sessionId) {
            throw new Error('SessionId e obrigatorio para iniciar captura');
        }

        sessionIdRef.current = sessionId;
        console.log(`[SingleMic] SessionId armazenado na ref: ${sessionId}`);

        try {
            // Verificar socket
            if (!socket || !socket.connected) {
                console.warn('[SingleMic] Socket nao conectado, aguardando conexao...');
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
            setStream(stream);
            vadRef.current = new VoiceActivityDetector(stream);

            const mimeType = getBestAudioMimeType();
            fullMimeTypeRef.current = mimeType;

            // ========== RECORDER 1: Immediate (5s chunks para transcricao rapida) ==========
            const immediateRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
            let immediateChunks: Blob[] = [];

            immediateRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) immediateChunks.push(event.data);
            };

            immediateRecorder.onstop = async () => {
                if (immediateChunks.length > 0) {
                    const blob = new Blob(immediateChunks, { type: mimeType });
                    immediateChunks = [];
                    await handleImmediateChunk(blob, sequenceRef.current++);

                    // Reiniciar se ainda gravando
                    if (isRecordingRef.current && immediateRecorderRef.current?.state === 'inactive') {
                        immediateRecorderRef.current.start();
                    }
                }
            };

            immediateRecorderRef.current = immediateRecorder;

            // ========== RECORDER 2: Full session (grava consulta inteira) ==========
            const fullRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });

            fullRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) fullChunksRef.current.push(event.data);
            };

            fullRecorder.onstop = () => {
                const blob = new Blob(fullChunksRef.current, { type: mimeType });
                console.log(`[SingleMic] Full session audio: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
                if (fullAudioResolveRef.current) {
                    fullAudioResolveRef.current(blob);
                    fullAudioResolveRef.current = null;
                }
            };

            fullRecorderRef.current = fullRecorder;

            // Aguardar socket estar completamente pronto
            await new Promise(resolve => setTimeout(resolve, 500));

            // Iniciar ambos os recorders
            immediateRecorder.start();
            fullRecorder.start();

            // Timer para chunks imediatos (5s)
            immediateIntervalRef.current = setInterval(() => {
                if (immediateRecorderRef.current?.state === 'recording') {
                    immediateRecorderRef.current.stop();
                }
            }, 5000);

            // Flush data do full recorder periodicamente (evita acumulo na memoria)
            fullDataIntervalRef.current = setInterval(() => {
                if (fullRecorderRef.current?.state === 'recording') {
                    fullRecorderRef.current.requestData();
                }
            }, 10000);

            // Monitoramento de niveis
            startLevelMonitoring();

            setIsRecording(true);
            isRecordingRef.current = true;

            console.log('[SingleMic] Captura iniciada (5s imediato + full session recording)');

        } catch (error) {
            console.error('[SingleMic] Erro ao iniciar captura de audio:', error);
            throw error;
        }
    }, [socket, microphoneId]);

    /**
     * Envia chunk imediato (5s) para transcricao rapida
     */
    const handleImmediateChunk = async (blob: Blob, sequence: number) => {
        const chunk: AudioChunk = {
            sequence,
            speaker: 'mixed',
            audioData: blob,
            timestamp: new Date(),
            sent: false
        };

        bufferRef.current.push(chunk);
        await sendChunk(chunk);
    };

    /**
     * Envia chunk imediato para servidor
     */
    const sendChunk = async (chunk: AudioChunk) => {
        const currentSessionId = sessionIdRef.current;

        if (!socket || !socket.connected || !currentSessionId) {
            console.warn(`[SingleMic] Socket nao conectado, chunk em buffer`);
            return;
        }

        try {
            const base64Data = await blobToBase64(chunk.audioData);

            socket.emit('presencialAudioChunk', {
                sessionId: currentSessionId,
                speaker: 'mixed',
                audioChunk: base64Data,
                sequence: chunk.sequence,
                timestamp: chunk.timestamp.toISOString()
            }, (response: any) => {
                if (response?.success) {
                    chunk.sent = true;
                } else {
                    console.error(`[SingleMic] Erro no callback do chunk #${chunk.sequence}:`, response);
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
                setAudioLevel(vadRef.current.getAudioLevel());
            }
        }, 100);
    };

    /**
     * Para o full recorder e retorna o audio completo da consulta.
     * Deve ser chamado ANTES de stopCapture().
     */
    const getFullSessionAudio = useCallback((): Promise<Blob> => {
        return new Promise((resolve) => {
            if (!fullRecorderRef.current || fullRecorderRef.current.state === 'inactive') {
                // Ja parado — retorna o que tem
                const blob = new Blob(fullChunksRef.current, { type: fullMimeTypeRef.current || 'audio/webm' });
                resolve(blob);
                return;
            }
            fullAudioResolveRef.current = resolve;
            fullRecorderRef.current.stop();
        });
    }, []);

    /**
     * Para captura de audio (cleanup)
     */
    const stopCapture = useCallback(() => {
        // Parar timers
        if (immediateIntervalRef.current) {
            clearInterval(immediateIntervalRef.current);
            immediateIntervalRef.current = null;
        }
        if (fullDataIntervalRef.current) {
            clearInterval(fullDataIntervalRef.current);
            fullDataIntervalRef.current = null;
        }

        // Parar immediate recorder
        if (immediateRecorderRef.current?.state !== 'inactive') {
            immediateRecorderRef.current?.stop();
        }

        // Full recorder: so para se getFullSessionAudio nao foi chamado
        if (fullRecorderRef.current?.state !== 'inactive') {
            fullRecorderRef.current?.stop();
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

        // Limpar refs do full audio
        fullChunksRef.current = [];
        fullAudioResolveRef.current = null;

        setIsRecording(false);
        isRecordingRef.current = false;
        setAudioLevel(0);

        console.log('[SingleMic] Captura de audio parada');
    }, []);

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
        getFullSessionAudio,
        audioLevel,
        pendingChunks: bufferRef.current.filter(c => !c.sent).length,
        stream
    };
}
