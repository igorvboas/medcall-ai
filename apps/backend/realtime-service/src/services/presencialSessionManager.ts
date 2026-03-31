import { whisperService } from './whisperService';
import { db, logError } from '../config/database';
import fetch from 'node-fetch';
import { getWebhookUrl, getWebhookHeaders, getEnv } from '../config/webhookConfig';
import { isValidTranscriptionText } from '../utils/antiHallucinationFilter';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import { aiConfig } from '../config';
import { AudioAccumulator, DiarizedUtterance, BatchResult, DeepgramDiarizedUtterance, DeepgramWordWithSpeaker } from '../types/diarization';

/**
 * Interface para chunk de áudio em fila
 */
interface AudioChunk {
    sequence: number;
    speaker: 'doctor' | 'patient' | 'mixed';
    audioBuffer: Buffer;
    timestamp: Date;
    sessionId: string;
}

/**
 * Interface para transcrição
 */
interface Transcription {
    speaker: 'doctor' | 'patient' | 'unknown';
    text: string;
    timestamp: Date;
    sequence: number;
    detectedSpeaker?: string; // speaker_0 / speaker_1 from Deepgram diarization
}

/**
 * Interface para sessão presencial em memória
 */
interface PresencialSession {
    sessionId: string;
    consultationId: string;
    callSessionId: string;
    doctorId: string;
    patientId: string;
    patientName: string;
    doctorName: string;

    startTime: Date;
    endTime?: Date;
    status: 'active' | 'paused' | 'ended';

    // Transcrições acumuladas
    transcriptions: Transcription[];

    // Metadados
    doctorMicrophoneId: string;
    patientMicrophoneId: string;

    // Estatísticas
    totalChunks: number;
    totalTranscriptions: number;
}

/**
 * Gerenciador de sessões presenciais
 * Mantém sessões ativas em memória e processa chunks de áudio
 */
class PresencialSessionManager {
    // Sessões ativas em memória
    private sessions = new Map<string, PresencialSession>();

    // Audio accumulators for 60s batch diarization (per D-01)
    private accumulators = new Map<string, AudioAccumulator>();

    // Socket.IO server reference for emitting events
    private io: any = null;

    // Confidence threshold for speaker attribution (per D-16, D-18)
    private diarizationConfidenceThreshold: number;

    // Fila de chunks para processar
    private processingQueue: AudioChunk[] = [];
    private isProcessing = false;

    // Deepgram client para transcrição pre-recorded
    private deepgramClient: ReturnType<typeof createDeepgramClient> | null = null;
    private useDeepgram: boolean;

    constructor() {
        const apiKey = aiConfig.deepgram?.apiKey || process.env.DEEPGRAM_API_KEY || '';
        this.useDeepgram = !!(aiConfig.deepgram?.enabled && apiKey);

        if (this.useDeepgram) {
            this.deepgramClient = createDeepgramClient(apiKey);
            console.log('[PRESENCIAL] Deepgram habilitado para transcricao');
        } else {
            console.log('[PRESENCIAL] Usando Whisper para transcricao (fallback)');
        }

        this.diarizationConfidenceThreshold = parseFloat(process.env.DIARIZATION_CONFIDENCE_THRESHOLD || '0.7');
        console.log(`[PRESENCIAL] Diarization confidence threshold: ${this.diarizationConfidenceThreshold}`);
    }

    /**
     * Set Socket.IO server reference for emitting diarized batch events
     */
    setIO(io: any): void {
        this.io = io;
    }

    // ==================== ACCUMULATOR LIFECYCLE ====================

    /**
     * Start audio accumulator for batch diarization (per D-01, D-03)
     */
    private startAccumulator(sessionId: string): void {
        const acc: AudioAccumulator = {
            chunks: [],
            timer: null,
            batchNumber: 0,
            startTime: new Date(),
            totalDurationMs: 0,
        };
        this.accumulators.set(sessionId, acc);
        this.scheduleFlush(sessionId);
        console.log(`[DIARIZATION] Accumulator started for session ${sessionId}`);
    }

    /**
     * Schedule next 60s flush using setTimeout chain (not setInterval) to prevent overlap
     */
    private scheduleFlush(sessionId: string): void {
        const acc = this.accumulators.get(sessionId);
        if (!acc) return;

        acc.timer = setTimeout(async () => {
            await this.flushBatch(sessionId);
            // Re-schedule only if accumulator still exists (session not ended)
            if (this.accumulators.has(sessionId)) {
                this.scheduleFlush(sessionId);
            }
        }, 60_000);
    }

    /**
     * Add audio chunk to accumulator (called from processAudioChunkAndReturn)
     */
    private addChunkToAccumulator(sessionId: string, audioBuffer: Buffer): void {
        const acc = this.accumulators.get(sessionId);
        if (!acc) return;

        acc.chunks.push(audioBuffer);
        acc.totalDurationMs += 5000; // Each chunk is 5s per D-01
        console.log(`[DIARIZATION] Chunk added to accumulator for ${sessionId} (${acc.chunks.length} chunks, ${acc.totalDurationMs / 1000}s)`);
    }

    /**
     * Flush accumulated audio batch to Deepgram with diarization (per D-01, D-02, D-05)
     */
    private async flushBatch(sessionId: string): Promise<void> {
        const acc = this.accumulators.get(sessionId);
        if (!acc || acc.chunks.length === 0) return;

        const batchId = `batch-${sessionId.substring(0, 8)}-${acc.batchNumber++}`;
        const chunksToProcess = [...acc.chunks];
        // Clear accumulator immediately so new chunks go to next batch
        acc.chunks = [];
        acc.totalDurationMs = 0;

        const concatenated = Buffer.concat(chunksToProcess);
        console.log(`[DIARIZATION] Flushing batch ${batchId}: ${chunksToProcess.length} chunks, ${concatenated.length} bytes`);

        const session = this.sessions.get(sessionId);
        if (!session) {
            console.error(`[DIARIZATION] Session ${sessionId} not found for batch ${batchId}`);
            return;
        }

        try {
            const utterances = await this.transcribeWithDiarization(concatenated, session.consultationId);
            await this.processDiarizedUtterances(sessionId, batchId, utterances);
        } catch (err) {
            console.error(`[DIARIZATION] Batch ${batchId} failed:`, err);
            // Do NOT re-throw — don't crash the timer chain
        }
    }

    /**
     * Stop accumulator and clear timer (per Pitfall 5 from RESEARCH.md)
     */
    private stopAccumulator(sessionId: string): void {
        const acc = this.accumulators.get(sessionId);
        if (!acc) return;

        if (acc.timer) {
            clearTimeout(acc.timer);
        }
        this.accumulators.delete(sessionId);
        console.log(`[DIARIZATION] Accumulator stopped for session ${sessionId}`);
    }

    // ==================== DIARIZATION PROCESSING ====================

    /**
     * Transcribe audio buffer using Deepgram pre-recorded API with utterances + diarize (per D-05, D-06)
     */
    private async transcribeWithDiarization(
        audioBuffer: Buffer,
        consultationId: string
    ): Promise<DeepgramDiarizedUtterance[]> {
        if (!this.deepgramClient) {
            throw new Error('Deepgram client nao inicializado');
        }

        const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
                model: 'nova-3',
                language: 'pt-BR',
                smart_format: true,
                punctuate: true,
                numerals: true,
                diarize: true,
                utterances: true,
                keyterm: [
                    'paciente', 'doutor', 'doutora',
                    'pressao arterial', 'frequencia cardiaca',
                    'hemograma', 'diagnostico', 'medicamento',
                ],
            }
        );

        if (error) {
            throw new Error(`Deepgram diarization API error: ${JSON.stringify(error)}`);
        }

        const utterances = (result as any)?.results?.utterances || [];

        // Log cost tracking (same pattern as existing transcribeWithDeepgram)
        try {
            const duration = (result as any)?.metadata?.duration || 0;
            const { aiPricingService } = await import('./aiPricingService');
            await aiPricingService.logWhisperUsage(
                duration * 1000,
                consultationId,
                `[BATCH-DIARIZATION] ${utterances.length} utterances`,
                { provider: 'deepgram', model: 'nova-2' }
            );
        } catch (e) {
            // Don't block transcription for logging errors
        }

        return utterances as DeepgramDiarizedUtterance[];
    }

    /**
     * Process diarized utterances: map, filter, save, emit (per D-10, D-11, D-16)
     */
    private async processDiarizedUtterances(
        sessionId: string,
        batchId: string,
        utterances: DeepgramDiarizedUtterance[]
    ): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Map Deepgram utterances to our DiarizedUtterance type
        const mappedUtterances: DiarizedUtterance[] = utterances
            .map((utt) => {
                const diarizationConfidence = utt.words && utt.words.length > 0
                    ? utt.words.reduce((sum, w) => sum + (w.speaker_confidence || 0), 0) / utt.words.length
                    : 0;

                return {
                    speakerId: `speaker_${utt.speaker}`,
                    transcript: utt.transcript,
                    startMs: Math.round(utt.start * 1000),
                    endMs: Math.round(utt.end * 1000),
                    transcriptionConfidence: utt.confidence,
                    diarizationConfidence,
                    needsReview: diarizationConfidence < this.diarizationConfidenceThreshold,
                };
            })
            .filter((u) => u.transcript && u.transcript.trim().length > 0 && isValidTranscriptionText(u.transcript.trim()));

        if (mappedUtterances.length === 0) {
            console.log(`[DIARIZATION] Batch ${batchId} had no valid utterances after filtering`);
            return;
        }

        // Save to transcriptions_med (speaker is always 'unknown' until doctor maps via DIAR-06)
        await db.saveDiarizedUtterances(
            session.callSessionId,
            batchId,
            mappedUtterances.map((u) => ({
                speaker: 'unknown' as const,
                speakerId: u.speakerId,
                text: u.transcript,
                startMs: u.startMs,
                endMs: u.endMs,
                confidence: u.transcriptionConfidence,
                diarizationConfidence: u.diarizationConfidence,
                needsReview: u.needsReview,
                doctorName: session.doctorName,
            }))
        );

        // Append to transcriptions.raw_text (per D-15)
        const lines = mappedUtterances.map((u) => {
            const ts = this.formatMs(u.startMs);
            return `[${u.speakerId.toUpperCase()}] (${ts}): ${u.transcript}`;
        });
        await db.appendConsultationTranscription(
            session.consultationId,
            lines.join('\n'),
            'BATCH',
            new Date().toISOString().substring(11, 19)
        );

        // Emit presencialDiarizedBatch event (per D-09)
        if (this.io) {
            this.io.to(sessionId).emit('presencialDiarizedBatch', {
                sessionId,
                batchId,
                utterances: mappedUtterances.map((u) => ({
                    speakerId: u.speakerId,
                    text: u.transcript,
                    startMs: u.startMs,
                    endMs: u.endMs,
                    diarizationConfidence: u.diarizationConfidence,
                    needsReview: u.needsReview,
                })),
            });
        }

        console.log(`[DIARIZATION] Batch ${batchId} processed: ${mappedUtterances.length} utterances`);
    }

    /**
     * Process a diarization batch from frontend (valid 30s WebM file)
     * Called directly via Socket.IO event instead of backend accumulator
     */
    async processDiarizationBatch(sessionId: string, audioBuffer: Buffer): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        const batchId = `batch-${sessionId.substring(0, 8)}-${Date.now()}`;
        console.log(`[DIARIZATION] Processing frontend batch ${batchId}: ${audioBuffer.length} bytes`);

        const utterances = await this.transcribeWithDiarization(audioBuffer, session.consultationId);
        await this.processDiarizedUtterances(sessionId, batchId, utterances);
    }

    /**
     * Convert milliseconds to HH:mm:ss format
     */
    private formatMs(ms: number): string {
        const totalSecs = Math.floor(ms / 1000);
        const hh = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    /**
     * Transcreve um buffer de áudio usando Deepgram (pre-recorded API)
     * Aceita WebM, WAV, ou qualquer formato suportado pelo Deepgram
     */
    private async transcribeWithDeepgram(
        audioBuffer: Buffer,
        speaker: 'doctor' | 'patient' | 'mixed',
        language: string = 'pt-BR',
        consultationId?: string
    ): Promise<{ text: string; confidence: number; duration: number; detectedSpeaker?: string }> {
        if (!this.deepgramClient) {
            throw new Error('Deepgram client não inicializado');
        }

        try {
            const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
                audioBuffer,
                {
                    model: 'nova-3',
                    language: language,
                    smart_format: true,
                    punctuate: true,
                    numerals: true,
                    diarize: true,
                    keyterm: [
                        'paciente', 'doutor', 'doutora',
                        'pressão arterial', 'frequência cardíaca',
                        'hemograma', 'diagnóstico', 'medicamento',
                    ],
                }
            );

            if (error) {
                throw new Error(`Deepgram API error: ${JSON.stringify(error)}`);
            }

            const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
            const text = transcript?.transcript || '';
            const confidence = transcript?.confidence || 0;
            const duration = result?.metadata?.duration || 0;

            // Extract dominant speaker from words (for single-mic mode)
            let detectedSpeaker: string | undefined;
            if (speaker === 'mixed') {
                const words = (transcript as any)?.words || [];
                if (words.length > 0) {
                    // Count words per speaker, pick the dominant one
                    const speakerCounts: Record<number, number> = {};
                    for (const w of words) {
                        if (w.speaker !== undefined) {
                            speakerCounts[w.speaker] = (speakerCounts[w.speaker] || 0) + 1;
                        }
                    }
                    const dominant = Object.entries(speakerCounts)
                        .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
                    if (dominant) {
                        detectedSpeaker = `speaker_${dominant[0]}`;
                    }
                }
            }

            // Registrar uso para monitoramento de custos
            try {
                const { aiPricingService } = await import('./aiPricingService');
                await aiPricingService.logWhisperUsage(
                    duration * 1000,
                    consultationId,
                    text,
                    { provider: 'deepgram', model: 'nova-3' }
                );
            } catch (e) {
                // Não bloquear transcrição por erro de logging
            }

            return { text, confidence, duration: duration * 1000, detectedSpeaker };
        } catch (error) {
            console.error(`❌ [PRESENCIAL-DEEPGRAM] Erro na transcrição:`, error);
            throw error;
        }
    }

    /**
     * Cria nova sessão presencial
     */
    async createSession(data: {
        sessionId: string;
        consultationId: string;
        doctorId: string;
        patientId: string;
        patientName: string;
        doctorName: string;
        doctorMicrophoneId: string;
        patientMicrophoneId: string;
    }): Promise<PresencialSession> {
        console.log(`📋 [PRESENCIAL] Criando sessão ${data.sessionId}...`);

        // Criar registro em call_sessions
        const callSession = await db.createCallSession({
            room_id: data.sessionId,
            room_name: `Presencial - ${data.patientName}`,
            session_type: 'presencial',
            participants: {
                doctor: data.doctorName,
                patient: data.patientName,
                doctorId: data.doctorId,
                patientId: data.patientId
            },
            metadata: {
                doctorMicrophoneId: data.doctorMicrophoneId,
                patientMicrophoneId: data.patientMicrophoneId,
                audioChunkSize: 5,
                vadEnabled: true,
                vadThreshold: 0.02
            }
        });

        if (!callSession) {
            throw new Error('Falha ao criar call_session no banco');
        }

        // Atualizar consultation com call_session
        await db.updateCallSession(data.sessionId, {
            consultation_id: data.consultationId
        });

        const session: PresencialSession = {
            sessionId: data.sessionId,
            consultationId: data.consultationId,
            callSessionId: callSession.id,
            doctorId: data.doctorId,
            patientId: data.patientId,
            patientName: data.patientName,
            doctorName: data.doctorName,
            startTime: new Date(),
            status: 'active',
            transcriptions: [],
            doctorMicrophoneId: data.doctorMicrophoneId,
            patientMicrophoneId: data.patientMicrophoneId,
            totalChunks: 0,
            totalTranscriptions: 0
        };

        this.sessions.set(data.sessionId, session);

        // Start batch accumulator for diarization (per D-01)
        this.startAccumulator(data.sessionId);

        console.log(`[PRESENCIAL] Sessao ${data.sessionId} criada`);

        return session;
    }

    /**
     * Obtém sessão existente
     */
    getSession(sessionId: string): PresencialSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Adiciona chunk de áudio à fila de processamento
     */
    async addAudioChunk(
        sessionId: string,
        speaker: 'doctor' | 'patient' | 'mixed',
        audioBuffer: Buffer,
        sequence: number
    ): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        if (session.status !== 'active') {
            throw new Error(`Sessão ${sessionId} não está ativa (status: ${session.status})`);
        }

        // Adicionar à fila
        this.processingQueue.push({
            sequence,
            speaker,
            audioBuffer,
            timestamp: new Date(),
            sessionId
        });

        session.totalChunks++;

        console.log(`🎵 [PRESENCIAL] Chunk adicionado à fila: ${speaker} #${sequence} (${audioBuffer.length} bytes) - Fila: ${this.processingQueue.length}`);

        // Iniciar processamento se não estiver rodando
        if (!this.isProcessing) {
            console.log(`🚀 [PRESENCIAL] Iniciando processamento da fila...`);
            this.processQueue();
        } else {
            console.log(`⏳ [PRESENCIAL] Processamento já em andamento, chunk aguardando na fila...`);
        }
    }

    /**
     * Processa chunk de áudio imediatamente e retorna a transcrição
     * (Versão síncrona para uso com Socket.IO)
     */
    async processAudioChunkAndReturn(
        sessionId: string,
        speaker: 'doctor' | 'patient' | 'mixed',
        audioBuffer: Buffer,
        sequence: number
    ): Promise<Transcription | null> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        if (session.status !== 'active') {
            throw new Error(`Sessão ${sessionId} não está ativa (status: ${session.status})`);
        }

        session.totalChunks++;

        // Note: batch diarization is now handled by frontend sending valid 60s WebM
        // via presencialDiarizationBatch event (no more backend accumulator for single-mic)

        console.log(`[PRESENCIAL] Processando chunk sincrono: ${speaker} #${sequence} (${audioBuffer.length} bytes)`);

        try {
            let result: { text: string; confidence?: number; duration?: number; detectedSpeaker?: string };

            if (this.useDeepgram) {
                // Deepgram (pre-recorded API para chunks WebM)
                console.log(`🔄 [PRESENCIAL] Enviando para Deepgram: ${speaker} #${sequence}`);
                result = await this.transcribeWithDeepgram(
                    audioBuffer,
                    speaker,
                    'pt-BR',
                    session.consultationId
                );
            } else {
                // Whisper fallback
                console.log(`🔄 [PRESENCIAL] Enviando para Whisper API: ${speaker} #${sequence}`);
                result = await whisperService.transcribeAudioChunk(
                    audioBuffer,
                    speaker,
                    'pt',
                    session.consultationId
                );
            }

            console.log(`✅ [PRESENCIAL] Transcrição retornou: "${result.text}" (duração: ${result.duration || 0}ms)${result.detectedSpeaker ? ` [${result.detectedSpeaker}]` : ''}`);

            if (!result.text || result.text.trim().length === 0) {
                console.log(`⚠️ [PRESENCIAL] Chunk ${speaker} #${sequence} sem transcrição (silêncio)`);
                return null;
            }

            // 🛡️ FILTRO ANTI-ALUCINAÇÃO: validar texto antes de salvar
            if (!isValidTranscriptionText(result.text.trim())) {
                console.log(`🛡️ [PRESENCIAL] Chunk ${speaker} #${sequence} descartado (alucinação): "${result.text.trim().substring(0, 60)}"`);
                return null;
            }

            // Criar transcrição
            // Map 'mixed' (single-mic mode) to 'unknown' for DB constraint compatibility
            const dbSpeaker = speaker === 'mixed' ? 'unknown' as const : speaker;
            const transcription: Transcription = {
                speaker: dbSpeaker,
                text: result.text,
                timestamp: new Date(),
                sequence: sequence,
                detectedSpeaker: result.detectedSpeaker,
            };

            // Adicionar à sessão (memória)
            session.transcriptions.push(transcription);
            session.totalTranscriptions++;

            console.log(`📝 [PRESENCIAL] Transcrição ${speaker} #${sequence} salva: "${result.text}" (Total: ${session.totalTranscriptions})`);

            // Salvar incrementalmente no banco (mesmo processo da consulta online)
            await this.saveTranscriptionIncrementally(session, transcription);

            return transcription;

        } catch (error) {
            console.error(`❌ [PRESENCIAL] Erro ao processar chunk ${speaker} #${sequence}:`, error);

            logError(
                'Erro ao processar chunk de áudio',
                'error',
                null,
                {
                    sessionId,
                    speaker,
                    sequence,
                    error: error instanceof Error ? error.message : String(error)
                }
            );

            return null;
        }
    }

    /**
     * Processa fila de chunks de áudio
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        if (this.processingQueue.length === 0) return;

        this.isProcessing = true;

        console.log(`⚙️ [PRESENCIAL] Processando fila (${this.processingQueue.length} chunks)...`);

        while (this.processingQueue.length > 0) {
            const chunk = this.processingQueue.shift();
            if (!chunk) break;

            try {
                await this.processChunk(chunk);
            } catch (error) {
                console.error(`❌ [PRESENCIAL] Erro ao processar chunk ${chunk.speaker} #${chunk.sequence}:`, error);

                logError(
                    'Erro ao processar chunk de áudio',
                    'error',
                    null,
                    {
                        sessionId: chunk.sessionId,
                        speaker: chunk.speaker,
                        sequence: chunk.sequence,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );
            }
        }

        this.isProcessing = false;
        console.log(`✅ [PRESENCIAL] Fila processada`);
    }

    /**
     * Processa um chunk individual
     */
    private async processChunk(chunk: AudioChunk): Promise<void> {
        const session = this.sessions.get(chunk.sessionId);
        if (!session) {
            console.error(`❌ [PRESENCIAL] Sessão ${chunk.sessionId} não encontrada para chunk ${chunk.speaker} #${chunk.sequence}`);
            return;
        }

        console.log(`🎙️ [PRESENCIAL] Processando chunk ${chunk.speaker} #${chunk.sequence} (${chunk.audioBuffer.length} bytes)...`);

        let result: { text: string; confidence?: number; duration?: number };

        if (this.useDeepgram) {
            console.log(`🔄 [PRESENCIAL] Enviando para Deepgram: ${chunk.speaker} #${chunk.sequence}`);
            result = await this.transcribeWithDeepgram(
                chunk.audioBuffer,
                chunk.speaker,
                'pt-BR',
                session.consultationId
            );
        } else {
            console.log(`🔄 [PRESENCIAL] Enviando para Whisper API: ${chunk.speaker} #${chunk.sequence}`);
            result = await whisperService.transcribeAudioChunk(
                chunk.audioBuffer,
                chunk.speaker,
                'pt'
            );
        }

        console.log(`✅ [PRESENCIAL] Transcrição retornou: "${result.text}" (duração: ${result.duration || 0}ms)`);

        if (!result.text || result.text.trim().length === 0) {
            console.log(`⚠️ [PRESENCIAL] Chunk ${chunk.speaker} #${chunk.sequence} sem transcrição (silêncio)`);
            return;
        }

        // 🛡️ FILTRO ANTI-ALUCINAÇÃO: validar texto antes de salvar
        if (!isValidTranscriptionText(result.text.trim())) {
            console.log(`🛡️ [PRESENCIAL] Chunk ${chunk.speaker} #${chunk.sequence} descartado (alucinação): "${result.text.trim().substring(0, 60)}"`);
            return;
        }

        // Adicionar transcrição à sessão
        // Map 'mixed' (single-mic mode) to 'unknown' for DB constraint compatibility
        const dbSpeaker = chunk.speaker === 'mixed' ? 'unknown' as const : chunk.speaker;
        const transcription: Transcription = {
            speaker: dbSpeaker,
            text: result.text,
            timestamp: chunk.timestamp,
            sequence: chunk.sequence
        };

        session.transcriptions.push(transcription);
        session.totalTranscriptions++;

        console.log(`📝 [PRESENCIAL] Transcrição ${chunk.speaker} #${chunk.sequence} salva na sessão: "${result.text}" (Total: ${session.totalTranscriptions})`);

        // Salvar incrementalmente no banco (mesmo processo da consulta online)
        await this.saveTranscriptionIncrementally(session, transcription);
    }

    /**
     * Salva uma transcrição incrementalmente nas tabelas transcriptions_med e transcriptions
     * (mesmo processo usado na consulta online)
     */
    private async saveTranscriptionIncrementally(session: PresencialSession, transcription: Transcription): Promise<void> {
        try {
            const timestamp = transcription.timestamp.toISOString().substring(11, 19); // HH:mm:ss

            // 1. Salvar em transcriptions_med apenas se speaker é conhecido (dual-mic mode)
            // No single-mic mode, speaker='unknown' — salva só na transcriptions até o mapeamento
            if (transcription.speaker !== 'unknown') {
                const speakerId = transcription.speaker === 'doctor' ? session.doctorId : session.patientId;
                const saved = await db.addTranscriptionToSession(session.callSessionId, {
                    speaker: transcription.speaker,
                    speaker_id: speakerId,
                    text: transcription.text,
                    doctor_name: session.doctorName,
                });

                if (saved) {
                    console.log(`💾 [PRESENCIAL] Transcrição salva em transcriptions_med (session: ${session.callSessionId})`);
                }
            }

            // 2. Salvar em transcriptions (raw_text append) — sempre, independente do modo
            const speakerLabel = transcription.speaker === 'doctor' ? 'MEDICO' :
                                 transcription.speaker === 'patient' ? 'PACIENTE' : 'DESCONHECIDO';
            const appended = await db.appendConsultationTranscription(
                session.consultationId,
                transcription.text,
                speakerLabel,
                timestamp
            );

            if (appended) {
                console.log(`💾 [PRESENCIAL] Transcrição appendada em transcriptions (consultation: ${session.consultationId})`);
            }
        } catch (error) {
            // Não bloquear o fluxo se falhar o save incremental
            console.error(`⚠️ [PRESENCIAL] Erro ao salvar transcrição incrementalmente (não bloqueia):`, error);
        }
    }

    /**
     * Finaliza sessão e salva no banco
     */
    async endSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        console.log(`[PRESENCIAL] Finalizando sessao ${sessionId}...`);

        // Flush remaining audio in accumulator and stop timer (per D-03, D-04)
        const acc = this.accumulators.get(sessionId);
        if (acc && acc.chunks.length > 0) {
            console.log(`[DIARIZATION] Flushing remaining ${acc.chunks.length} chunks on session end`);
            await this.flushBatch(sessionId);
        }
        this.stopAccumulator(sessionId);

        session.status = 'ended';
        session.endTime = new Date();

        // Aguardar processamento completo da fila
        while (this.processingQueue.some(c => c.sessionId === sessionId)) {
            console.log(`⏳ [PRESENCIAL] Aguardando fila processar...`);
            await this.sleep(500);
        }

        // Salvar transcrições no banco
        await this.saveTranscriptions(session);

        // Atualizar consultation
        const durationSeconds = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
        const durationMinutes = durationSeconds / 60; // Converter para minutos conforme schema do banco

        const { supabase } = await import('../config/database');
        await supabase
            .from('consultations')
            .update({
                status: 'PROCESSING',
                consulta_finalizada: true,
                consulta_fim: session.endTime.toISOString(),
                duracao: durationMinutes, // Campo duracao é REAL em minutos
                updated_at: new Date().toISOString()
            })
            .eq('id', session.consultationId);

        // Atualizar call_sessions.status para 'ended'
        {
            const { error: csError } = await supabase
                .from('call_sessions')
                .update({
                    status: 'ended',
                    ended_at: session.endTime.toISOString(),
                    webrtc_active: false
                })
                .eq('room_id', sessionId);

            if (csError) {
                console.error(`⚠️ [PRESENCIAL] Erro ao atualizar call_sessions:`, csError);
            } else {
                console.log(`✅ [PRESENCIAL] call_sessions.status atualizado para 'ended'`);
            }
        }

        console.log(`✅ [PRESENCIAL] Sessão ${sessionId} finalizada (${session.totalTranscriptions} transcrições, ${durationMinutes.toFixed(2)} min)`);

        // 💰 NOVO: Calcular e atualizar valor_consulta
        try {
            const { aiPricingService } = await import('./aiPricingService');
            const totalCost = await aiPricingService.calculateAndUpdateConsultationCost(session.consultationId);
            if (totalCost !== null) {
                console.log(`💰 [PRESENCIAL] Custo total calculado e salvo: $${totalCost.toFixed(6)}`);
            }
        } catch (costError) {
            console.error('❌ [PRESENCIAL] Erro ao calcular custo da consulta (não bloqueia finalização):', costError);
        }

        // Enviar webhook com dados da consulta finalizada
        try {
            const { supabase } = await import('../config/database');

            // Read transcription from DB (not memory) per D-14
            const { data: txnForWebhook } = await supabase
                .from('transcriptions')
                .select('raw_text')
                .eq('consultation_id', session.consultationId)
                .maybeSingle();

            const webhookData = {
                consultationId: session.consultationId,
                doctorId: session.doctorId,
                patientId: session.patientId,
                transcription: txnForWebhook?.raw_text || '',
                consulta_finalizada: true,
                paciente_entrou_sala: true,
                tipo_consulta: 'PRESENCIAL' as const,
                env: getEnv(),
            };

            const webhookUrl = getWebhookUrl('transcricao');
            console.log(`[PRESENCIAL] Enviando webhook para ${webhookUrl}...`);

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: getWebhookHeaders(),
                body: JSON.stringify(webhookData),
            });

            if (response.ok) {
                console.log(`[PRESENCIAL] Webhook enviado com sucesso (status: ${response.status})`);
            } else {
                console.warn(`[PRESENCIAL] Webhook retornou status ${response.status}`);
            }
        } catch (webhookError) {
            console.error(`[PRESENCIAL] Erro ao enviar webhook:`, webhookError);
            logError(
                'Erro ao enviar webhook de finalizacao de consulta presencial',
                'warning',
                session.consultationId,
                {
                    sessionId,
                    error: webhookError instanceof Error ? webhookError.message : String(webhookError)
                }
            );
        }

        // Remover da memória após 5 minutos
        setTimeout(() => {
            this.sessions.delete(sessionId);
            console.log(`🧹 [PRESENCIAL] Sessão ${sessionId} removida da memória`);
        }, 5 * 60 * 1000);
    }

    /**
     * Salva transcrições no banco de dados
     */
    private async saveTranscriptions(session: PresencialSession): Promise<void> {
        // Read transcription from DB (crash-safe) per D-07, D-08
        const { supabase } = await import('../config/database');
        const { data: txnRecord } = await supabase
            .from('transcriptions')
            .select('raw_text')
            .eq('consultation_id', session.consultationId)
            .maybeSingle();

        const fullText = txnRecord?.raw_text || '';

        if (!fullText) {
            console.log(`[PRESENCIAL] Nenhuma transcricao encontrada em transcriptions para consulta ${session.consultationId}`);
            return;
        }

        // Copy to consultations.transcricao
        const { error } = await supabase
            .from('consultations')
            .update({
                transcricao: fullText
            })
            .eq('id', session.consultationId);

        if (error) {
            console.error('[PRESENCIAL] Erro ao salvar transcricoes:', error);
            throw error;
        }

        console.log(`[PRESENCIAL] Transcricao consolidada de transcriptions.raw_text para consultations.transcricao`);
    }

    /**
     * Retorna transcrições de uma sessão
     */
    getTranscriptions(sessionId: string): Transcription[] {
        const session = this.sessions.get(sessionId);
        return session?.transcriptions || [];
    }

    /**
     * Processa audio completo da consulta ao finalizar (single-mic mode):
     * 1. Envia audio inteiro para Deepgram com diarizacao
     * 2. Atualiza transcricoes com speaker correto (speaker_0 → doctor, speaker_1 → patient)
     * 3. Salva audio no Supabase storage
     * 4. Atualiza consultation.transcricao e consultation.url_audio
     */
    async finalizeWithFullAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        console.log(`[FINALIZE] Processando audio completo: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        // 1. Diarizar audio completo
        const utterances = await this.transcribeWithDiarization(audioBuffer, session.consultationId);
        console.log(`[FINALIZE] Diarizacao completa: ${utterances.length} utterances`);

        if (utterances.length === 0) {
            console.warn('[FINALIZE] Nenhuma utterance encontrada no audio');
            return;
        }

        // 2. Mapear speakers: speaker_0 = doctor (primeiro a falar, normalmente o medico)
        const speakerMapping: Record<string, 'doctor' | 'patient'> = {
            '0': 'doctor',
            '1': 'patient',
        };

        // Verificar se o mapeamento ja foi feito manualmente (salvo em metadata)
        try {
            const { supabase } = await import('../config/database');
            const { data: callSession } = await supabase
                .from('call_sessions')
                .select('metadata')
                .eq('room_id', sessionId)
                .single();

            if (callSession?.metadata?.speakerMapping) {
                const savedMapping = callSession.metadata.speakerMapping;
                // savedMapping format: { speaker_0: 'doctor', speaker_1: 'patient' }
                speakerMapping['0'] = savedMapping.speaker_0 || 'doctor';
                speakerMapping['1'] = savedMapping.speaker_1 || 'patient';
                console.log(`[FINALIZE] Usando mapeamento salvo: speaker_0=${speakerMapping['0']}, speaker_1=${speakerMapping['1']}`);
            }
        } catch (e) {
            console.warn('[FINALIZE] Erro ao buscar mapeamento salvo, usando padrao (speaker_0=doctor)');
        }

        // 3. Formatar transcricao final com speakers corretos
        const finalTranscriptions: Transcription[] = utterances
            .filter(utt => utt.transcript && utt.transcript.trim().length > 0 && isValidTranscriptionText(utt.transcript.trim()))
            .map((utt, idx) => {
                const speakerNum = String(utt.speaker);
                const role = speakerMapping[speakerNum] || 'doctor';
                return {
                    speaker: role as 'doctor' | 'patient',
                    text: utt.transcript.trim(),
                    timestamp: new Date(session.startTime.getTime() + Math.round(utt.start * 1000)),
                    sequence: idx,
                };
            });

        // Substituir transcricoes incrementais com as diarizadas
        session.transcriptions = finalTranscriptions;
        console.log(`[FINALIZE] ${finalTranscriptions.length} transcricoes com speaker correto`);

        // 4. Reescrever transcriptions.raw_text com speakers corretos
        try {
            const { supabase: supa, db: dbUtil } = await import('../config/database');
            const rawText = finalTranscriptions.map(t => {
                const label = t.speaker === 'doctor' ? 'MEDICO' : t.speaker === 'patient' ? 'PACIENTE' : 'DESCONHECIDO';
                const ts = t.timestamp.toISOString().substring(11, 19);
                return `[${label}] (${ts}): ${t.text}`;
            }).join('\n');

            // Sobrescrever raw_text na tabela transcriptions
            const { error: rawErr } = await supa
                .from('transcriptions')
                .update({ raw_text: rawText, updated_at: new Date().toISOString() })
                .eq('consultation_id', session.consultationId);

            if (rawErr) {
                console.error(`[FINALIZE] Erro ao atualizar transcriptions.raw_text:`, rawErr);
            } else {
                console.log(`[FINALIZE] transcriptions.raw_text atualizado com speakers corretos`);
            }
        } catch (rawTextError) {
            console.error(`[FINALIZE] Erro ao reescrever raw_text:`, rawTextError);
        }

        // 5. Upload audio para Supabase storage
        try {
            const { supabase } = await import('../config/database');
            const fileName = `consulta_${session.consultationId}.webm`;
            const bucket = 'audios';

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, audioBuffer, {
                    contentType: 'audio/webm',
                    upsert: true, // sobrescrever se existir
                });

            if (uploadError) {
                console.error(`[FINALIZE] Erro ao fazer upload do audio:`, uploadError);
            } else {
                // Gerar URL publica
                const { data: urlData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(fileName);

                const audioUrl = urlData?.publicUrl;
                console.log(`[FINALIZE] Audio salvo: ${audioUrl}`);

                // Salvar url_audio na consultation
                if (audioUrl) {
                    const { error: updateError } = await supabase
                        .from('consultations')
                        .update({ url_audio: audioUrl })
                        .eq('id', session.consultationId);

                    if (updateError) {
                        console.error(`[FINALIZE] Erro ao salvar url_audio:`, updateError);
                    } else {
                        console.log(`[FINALIZE] url_audio salvo na consultation`);
                    }
                }
            }
        } catch (storageError) {
            // Nao bloquear finalizacao se storage falhar
            console.error(`[FINALIZE] Erro no storage:`, storageError);
        }
    }

    /**
     * Helper para sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Exportar instância singleton
export const presencialSessionManager = new PresencialSessionManager();
