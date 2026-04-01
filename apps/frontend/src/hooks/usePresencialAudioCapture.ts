'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { VoiceActivityDetector, blobToBase64, getBestAudioMimeType } from '@/lib/audioUtils';

interface AudioChunk {
    sequence: number;
    speaker: 'doctor' | 'patient';
    audioData: Blob;
    timestamp: Date;
    sent: boolean;
}

interface UsePresencialAudioCaptureProps {
    socket: Socket | null;
    doctorMicrophoneId: string;
    patientMicrophoneId: string;
}

export function usePresencialAudioCapture({
    socket,
    doctorMicrophoneId,
    patientMicrophoneId
}: UsePresencialAudioCaptureProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Reactive stream state for downstream consumers (e.g., useMicMonitor)
    const [doctorStream, setDoctorStream] = useState<MediaStream | null>(null);

    // Usar refs para evitar problemas de closure nos callbacks
    const sessionIdRef = useRef<string | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // Streams de áudio
    const doctorStreamRef = useRef<MediaStream | null>(null);
    const patientStreamRef = useRef<MediaStream | null>(null);

    // MediaRecorders
    const doctorRecorderRef = useRef<MediaRecorder | null>(null);
    const patientRecorderRef = useRef<MediaRecorder | null>(null);

    // Voice Activity Detectors
    const doctorVADRef = useRef<VoiceActivityDetector | null>(null);
    const patientVADRef = useRef<VoiceActivityDetector | null>(null);

    // Contadores de sequência
    const doctorSequenceRef = useRef(0);
    const patientSequenceRef = useRef(0);

    // Amostras de voz (para VAD)
    const doctorVoiceSamplesRef = useRef(0);
    const patientVoiceSamplesRef = useRef(0);

    // Buffer de reconexão
    const bufferRef = useRef<AudioChunk[]>([]);

    // Níveis de áudio (para UI)
    const [doctorLevel, setDoctorLevel] = useState(0);
    const [patientLevel, setPatientLevel] = useState(0);

    // Interval para análise de nível
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Inicia captura de áudio
     */
    const startCapture = useCallback(async (sessionId: string) => {
        if (!sessionId) {
            throw new Error('SessionId é obrigatório para iniciar captura');
        }

        // Armazenar sessionId na ref
        sessionIdRef.current = sessionId;
        console.log(`🎬 SessionId armazenado na ref: ${sessionId}`);

        try {
            // Verificar se socket está conectado antes de iniciar
            if (!socket || !socket.connected) {
                console.warn('⚠️ Socket não conectado, aguardando conexão...');
                // Aguardar até 3 segundos pela conexão
                let attempts = 0;
                while ((!socket || !socket.connected) && attempts < 6) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }

                if (!socket || !socket.connected) {
                    throw new Error('Socket não conectado após 3 segundos de espera');
                }
            }

            console.log('✅ Socket verificado como conectado, iniciando captura...');

            // Obter streams de áudio
            const doctorStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: doctorMicrophoneId ? { exact: doctorMicrophoneId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const patientStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: patientMicrophoneId ? { exact: patientMicrophoneId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            doctorStreamRef.current = doctorStream;
            patientStreamRef.current = patientStream;
            setDoctorStream(doctorStream);

            // Inicializar VADs
            doctorVADRef.current = new VoiceActivityDetector(doctorStream);
            patientVADRef.current = new VoiceActivityDetector(patientStream);

            // Configurar MediaRecorders
            const mimeType = getBestAudioMimeType();

            const doctorRecorder = new MediaRecorder(doctorStream, {
                mimeType,
                audioBitsPerSecond: 128000
            });

            const patientRecorder = new MediaRecorder(patientStream, {
                mimeType,
                audioBitsPerSecond: 128000
            });

            // Handler para chunks do médico
            let doctorChunks: Blob[] = [];
            doctorRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    // Acumular chunks
                    doctorChunks.push(event.data);
                }
            };

            // Quando o recorder parar, processar todos os chunks acumulados
            doctorRecorder.onstop = async () => {
                if (doctorChunks.length > 0) {
                    // Combinar todos os chunks em um Blob único (WebM completo)
                    const completeBlob = new Blob(doctorChunks, { type: mimeType });
                    await handleAudioChunk(completeBlob, 'doctor', doctorSequenceRef.current++, doctorVoiceSamplesRef.current);
                    doctorVoiceSamplesRef.current = 0; // Reset contador
                    doctorChunks = []; // Limpar chunks

                    // Reiniciar gravação se ainda estiver em modo de gravação (usar ref para evitar closure)
                    if (isRecordingRef.current && doctorRecorderRef.current && doctorRecorderRef.current.state === 'inactive') {
                        console.log('🔄 [AUDIO] Reiniciando gravação doctor...');
                        doctorRecorderRef.current.start();
                    }
                }
            };

            // Handler para chunks do paciente
            let patientChunks: Blob[] = [];
            patientRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    // Acumular chunks
                    patientChunks.push(event.data);
                }
            };

            // Quando o recorder parar, processar todos os chunks acumulados
            patientRecorder.onstop = async () => {
                if (patientChunks.length > 0) {
                    // Combinar todos os chunks em um Blob único (WebM completo)
                    const completeBlob = new Blob(patientChunks, { type: mimeType });
                    await handleAudioChunk(completeBlob, 'patient', patientSequenceRef.current++, patientVoiceSamplesRef.current);
                    patientVoiceSamplesRef.current = 0; // Reset contador
                    patientChunks = []; // Limpar chunks

                    // Reiniciar gravação se ainda estiver em modo de gravação (usar ref para evitar closure)
                    if (isRecordingRef.current && patientRecorderRef.current && patientRecorderRef.current.state === 'inactive') {
                        console.log('🔄 [AUDIO] Reiniciando gravação patient...');
                        patientRecorderRef.current.start();
                    }
                }
            };

            doctorRecorderRef.current = doctorRecorder;
            patientRecorderRef.current = patientRecorder;

            // Aguardar 500ms adicional para garantir que socket está completamente pronto
            await new Promise(resolve => setTimeout(resolve, 500));

            // Iniciar gravação contínua (sem timeslice - vamos parar/iniciar manualmente)
            doctorRecorder.start();
            patientRecorder.start();

            // Timer para parar e reiniciar a cada 5 segundos
            const recordingInterval = setInterval(() => {
                console.log(`⏱️ [TIMER] Verificando estado dos recorders...`);
                console.log(`   Doctor state: ${doctorRecorderRef.current?.state}, Patient state: ${patientRecorderRef.current?.state}`);
                console.log(`   isRecordingRef: ${isRecordingRef.current}`);

                if (doctorRecorderRef.current && doctorRecorderRef.current.state === 'recording') {
                    console.log(`🛑 [TIMER] Parando doctor recorder...`);
                    doctorRecorderRef.current.stop();
                }
                if (patientRecorderRef.current && patientRecorderRef.current.state === 'recording') {
                    console.log(`🛑 [TIMER] Parando patient recorder...`);
                    patientRecorderRef.current.stop();
                }
            }, 5000);

            // Salvar interval ref para limpar depois
            (doctorRecorder as any).__interval = recordingInterval;

            // Iniciar monitoramento de níveis de áudio
            startLevelMonitoring();

            // Atualizar tanto state quanto ref
            setIsRecording(true);
            isRecordingRef.current = true;

            console.log('🎤 Captura de áudio iniciada (2 microfones)');

        } catch (error) {
            console.error('Erro ao iniciar captura de áudio:', error);
            throw error;
        }
    }, [socket, doctorMicrophoneId, patientMicrophoneId]);

    /**
     * Processa chunk de áudio
     */
    const handleAudioChunk = async (
        blob: Blob,
        speaker: 'doctor' | 'patient',
        sequence: number,
        voiceSamples: number
    ) => {
        // Verificar VAD - só enviar se detectou voz
        const vad = speaker === 'doctor' ? doctorVADRef.current : patientVADRef.current;

        if (vad && !vad.shouldSendChunk(5000, voiceSamples)) {
            console.log(`🔇 Chunk ${speaker} #${sequence} descartado (silêncio)`);
            return;
        }

        const chunk: AudioChunk = {
            sequence,
            speaker,
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

        console.log(`🔍 [DEBUG] Tentando enviar chunk ${chunk.speaker} #${chunk.sequence}...`);
        console.log(`🔍 [DEBUG] Socket existe?`, !!socket);
        console.log(`🔍 [DEBUG] Socket conectado?`, socket?.connected);
        console.log(`🔍 [DEBUG] SessionId (ref):`, currentSessionId);

        if (!socket || !socket.connected || !currentSessionId) {
            console.warn(`⚠️ [BUFFER] Socket não conectado, chunk em buffer - socket=${!!socket}, connected=${socket?.connected}, sessionId=${currentSessionId}`);
            return;
        }

        try {
            const base64Data = await blobToBase64(chunk.audioData);

            console.log(`🚀 [SENDING] Enviando chunk ${chunk.speaker} #${chunk.sequence} (${base64Data.length} chars base64)...`);

            socket.emit('presencialAudioChunk', {
                sessionId: currentSessionId,
                speaker: chunk.speaker,
                audioChunk: base64Data,
                sequence: chunk.sequence,
                timestamp: chunk.timestamp.toISOString()
            }, (response: any) => {
                if (response?.success) {
                    chunk.sent = true;
                    console.log(`✅ Chunk ${chunk.speaker} #${chunk.sequence} enviado`);
                } else {
                    console.error(`❌ Erro no callback do chunk ${chunk.speaker} #${chunk.sequence}:`, response);
                }
            });

        } catch (error) {
            console.error('❌ Erro ao enviar chunk:', error);
        }
    };

    /**
     * Monitora níveis de áudio para UI
     */
    const startLevelMonitoring = () => {
        levelIntervalRef.current = setInterval(() => {
            if (doctorVADRef.current) {
                const level = doctorVADRef.current.getAudioLevel();
                setDoctorLevel(level);

                // Incrementar contador de voz se detectado
                if (doctorVADRef.current.isSpeaking()) {
                    doctorVoiceSamplesRef.current++;
                }
            }

            if (patientVADRef.current) {
                const level = patientVADRef.current.getAudioLevel();
                setPatientLevel(level);

                // Incrementar contador de voz se detectado
                if (patientVADRef.current.isSpeaking()) {
                    patientVoiceSamplesRef.current++;
                }
            }
        }, 100);
    };

    /**
     * Para captura de áudio
     */
    const stopCapture = useCallback(() => {
        // Parar interval de gravação
        if (doctorRecorderRef.current && (doctorRecorderRef.current as any).__interval) {
            clearInterval((doctorRecorderRef.current as any).__interval);
        }

        // Parar recorders
        if (doctorRecorderRef.current && doctorRecorderRef.current.state !== 'inactive') {
            doctorRecorderRef.current.stop();
        }
        if (patientRecorderRef.current && patientRecorderRef.current.state !== 'inactive') {
            patientRecorderRef.current.stop();
        }

        // Parar streams
        doctorStreamRef.current?.getTracks().forEach(track => track.stop());
        patientStreamRef.current?.getTracks().forEach(track => track.stop());
        setDoctorStream(null);

        // Limpar VADs
        doctorVADRef.current?.destroy();
        patientVADRef.current?.destroy();

        // Parar monitoramento de nível
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
        }

        // Atualizar tanto state quanto ref
        setIsRecording(false);
        isRecordingRef.current = false;
        setDoctorLevel(0);
        setPatientLevel(0);

        console.log('🛑 Captura de áudio parada');
    }, []);

    /**
     * Reenviar chunks pendentes após reconexão
     */
    const retryPendingChunks = useCallback(async () => {
        const pending = bufferRef.current.filter(c => !c.sent);
        console.log(`📡 Reenviando ${pending.length} chunks pendentes...`);

        for (const chunk of pending) {
            await sendChunk(chunk);
        }

        // Limpar chunks enviados após 5s
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
        doctorLevel,
        patientLevel,
        pendingChunks: bufferRef.current.filter(c => !c.sent).length,
        doctorStream
    };
}
