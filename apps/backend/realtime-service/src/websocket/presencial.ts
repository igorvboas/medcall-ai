import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import { presencialSessionManager } from '../services/presencialSessionManager';
import { db, logError } from '../config/database';
import { tryAcquireFinalizationLock, releaseFinalizationLock } from '../shared/finalizationGuard';

/**
 * Configurar handlers Socket.IO para consultas presenciais
 */
export function setupPresencialWebSocket(io: SocketIOServer): void {
    // Provide Socket.IO reference for emitting diarized batch events
    presencialSessionManager.setIO(io);

    io.on('connection', (socket: Socket) => {
        const userName = socket.handshake.auth.userName;
        const password = socket.handshake.auth.password;

        // Autenticação básica
        if (password !== "x") {
            socket.disconnect(true);
            return;
        }

        console.log(`[PRESENCIAL] ${userName} conectado - Socket: ${socket.id}`);

        // ==================== INICIAR SESSÃO PRESENCIAL ====================

        socket.on('startPresencialSession', async (data, callback) => {
            try {
                const {
                    consultationId,
                    doctorMicrophoneId,
                    patientMicrophoneId
                } = data;

                console.log(`[PRESENCIAL] Iniciando sessão para consulta ${consultationId}...`);

                // Buscar dados da consulta
                const { supabase } = await import('../config/database');
                const { data: consultation, error: consultError } = await supabase
                    .from('consultations')
                    .select('*, medicos(id, name)')
                    .eq('id', consultationId)
                    .single();

                if (consultError || !consultation) {
                    console.error('[PRESENCIAL] Consulta não encontrada:', consultError);
                    callback({
                        success: false,
                        error: 'Consulta não encontrada'
                    });
                    return;
                }

                // Gerar ID da sessão
                const sessionId = 'pres-' + crypto.randomBytes(6).toString('hex');

                // Criar sessão
                const session = await presencialSessionManager.createSession({
                    sessionId,
                    consultationId: consultation.id,
                    doctorId: consultation.doctor_id,
                    patientId: consultation.patient_id,
                    patientName: consultation.patient_name,
                    doctorName: consultation.medicos?.name || userName,
                    doctorMicrophoneId,
                    patientMicrophoneId
                });

                // Atualizar consultation para status RECORDING
                const updateData: any = {
                    status: 'RECORDING',
                    updated_at: new Date().toISOString()
                };
                // Preencher consulta_inicio se ainda não estiver definido
                if (!consultation.consulta_inicio) {
                    updateData.consulta_inicio = new Date().toISOString();
                }
                await supabase
                    .from('consultations')
                    .update(updateData)
                    .eq('id', consultationId);

                // Entrar na sala Socket.IO
                socket.join(sessionId);

                console.log(`✅ [PRESENCIAL] Sessão ${sessionId} criada`);

                callback({
                    success: true,
                    sessionId,
                    session: {
                        sessionId: session.sessionId,
                        consultationId: session.consultationId,
                        patientName: session.patientName,
                        doctorName: session.doctorName,
                        startTime: session.startTime
                    }
                });
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao criar sessão:', error);

                logError(
                    'Erro ao criar sessão presencial',
                    'error',
                    null,
                    {
                        consultationId: data.consultationId,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );

                callback({
                    success: false,
                    error: 'Erro ao criar sessão: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
                });
            }
        });

        // ==================== CHUNK DE ÁUDIO ====================

        socket.on('presencialAudioChunk', async (data, callback) => {
            try {
                const {
                    sessionId,
                    speaker, // 'doctor' | 'patient' | 'mixed'
                    audioChunk, // base64 string
                    sequence,
                    timestamp
                } = data;

                console.log(`📥 [PRESENCIAL] Chunk recebido: ${speaker} #${sequence} (${audioChunk.length} chars base64)`);

                // Converter base64 para Buffer
                const audioBuffer = Buffer.from(audioChunk, 'base64');

                console.log(`🔄 [PRESENCIAL] Buffer criado: ${audioBuffer.length} bytes`);

                // Processar chunk imediatamente e obter transcrição
                const transcription = await presencialSessionManager.processAudioChunkAndReturn(
                    sessionId,
                    speaker,
                    audioBuffer,
                    sequence
                );

                // Confirmar recebimento
                if (callback) {
                    callback({ success: true });
                }

                // Se houve transcrição, emitir imediatamente
                if (transcription) {
                    console.log(`📡 [PRESENCIAL] Emitindo transcrição para sala ${sessionId}: "${transcription.text}"`);
                    io.to(sessionId).emit('presencialTranscription', {
                        sessionId,
                        speaker: transcription.speaker,
                        text: transcription.text,
                        timestamp: transcription.timestamp,
                        sequence: transcription.sequence,
                        detectedSpeaker: transcription.detectedSpeaker,
                    });
                } else {
                    console.log(`⚠️ [PRESENCIAL] Nenhuma transcrição gerada para chunk ${speaker} #${sequence}`);
                }

            } catch (error) {
                console.error('[PRESENCIAL] Erro ao processar chunk:', error);

                if (callback) {
                    callback({
                        success: false,
                        error: error instanceof Error ? error.message : 'Erro desconhecido'
                    });
                }
            }
        });

        // ==================== BATCH DE DIARIZAÇÃO (60s WebM válido do frontend) ====================

        socket.on('presencialDiarizationBatch', async (data, callback) => {
            try {
                const { sessionId, audioChunk } = data;

                console.log(`📦 [DIARIZATION] Batch recebido do frontend (${audioChunk.length} chars base64)`);

                const audioBuffer = Buffer.from(audioChunk, 'base64');
                console.log(`📦 [DIARIZATION] Buffer: ${audioBuffer.length} bytes`);

                // Processar diarização diretamente com o WebM válido
                await presencialSessionManager.processDiarizationBatch(sessionId, audioBuffer);

                if (callback) {
                    callback({ success: true });
                }

            } catch (error) {
                console.error('[DIARIZATION] Erro ao processar batch:', error);
                if (callback) {
                    callback({
                        success: false,
                        error: error instanceof Error ? error.message : 'Erro desconhecido'
                    });
                }
            }
        });

        // ==================== FINALIZAR SESSÃO ====================

        socket.on('endPresencialSession', async (data, callback) => {
            try {
                const { sessionId, fullAudioData } = data;

                // Per D-08: Mutex prevents concurrent finalization
                if (!tryAcquireFinalizationLock(sessionId)) {
                    callback({ success: true, already_finalizing: true, message: 'Sessao ja esta sendo finalizada' });
                    return;
                }

                try {
                    console.log(`[PRESENCIAL] Finalizando sessao ${sessionId}...`);

                    // Se tem audio completo (single-mic), processar diarizacao final
                    if (fullAudioData) {
                        const audioBuffer = Buffer.from(fullAudioData, 'base64');
                        console.log(`[PRESENCIAL] Audio completo recebido: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                        await presencialSessionManager.finalizeWithFullAudio(sessionId, audioBuffer);
                    }

                    // Finalizar sessao (salva transcricao, webhook, etc)
                    await presencialSessionManager.endSession(sessionId);

                    // Sair da sala
                    socket.leave(sessionId);

                    console.log(`[PRESENCIAL] Sessao ${sessionId} finalizada`);

                    callback({
                        success: true,
                        message: 'Sessao finalizada com sucesso'
                    });
                } finally {
                    releaseFinalizationLock(sessionId);
                }
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao finalizar sessao:', error);

                logError(
                    'Erro ao finalizar sessao presencial',
                    'error',
                    null,
                    {
                        sessionId: data.sessionId,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );

                callback({
                    success: false,
                    error: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        });

        // ==================== MAPEAR SPEAKERS ====================

        socket.on('mapSpeakers', async (data, callback) => {
            try {
                const { sessionId, mapping } = data;
                // mapping expected: { speaker_0: 'doctor', speaker_1: 'patient' }

                console.log(`[PRESENCIAL] Mapping speakers for session ${sessionId}:`, mapping);

                // Validate mapping
                if (!sessionId || !mapping || !mapping.speaker_0 || !mapping.speaker_1) {
                    console.error('[PRESENCIAL] Invalid mapSpeakers data:', data);
                    if (callback) {
                        callback({ success: false, error: 'sessionId and mapping (speaker_0, speaker_1) are required' });
                    }
                    return;
                }

                // Validate roles
                const validRoles = ['doctor', 'patient'];
                if (!validRoles.includes(mapping.speaker_0) || !validRoles.includes(mapping.speaker_1)) {
                    if (callback) {
                        callback({ success: false, error: 'speaker roles must be "doctor" or "patient"' });
                    }
                    return;
                }

                // Get session to find callSessionId and consultationId
                const session = presencialSessionManager.getSession(sessionId);
                if (!session) {
                    console.error(`[PRESENCIAL] Session ${sessionId} not found for speaker mapping`);
                    if (callback) {
                        callback({ success: false, error: 'Session not found' });
                    }
                    return;
                }

                // 1. Batch UPDATE transcriptions_med: set speaker role based on mapping (per D-20)
                const mappingUpdated = await db.updateSpeakerMapping(session.callSessionId, mapping);
                if (!mappingUpdated) {
                    console.error(`[PRESENCIAL] Failed to update speaker mapping in transcriptions_med`);
                }

                // 2. Regenerate transcriptions.raw_text with correct labels (per D-21)
                const rawTextUpdated = await db.regenerateRawTextWithSpeakers(
                    session.callSessionId,
                    session.consultationId,
                    mapping
                );
                if (!rawTextUpdated) {
                    console.error(`[PRESENCIAL] Failed to regenerate raw_text with speaker labels`);
                }

                // 3. Store mapping in call_sessions.metadata (per D-22)
                const { supabase } = await import('../config/database');

                // Fetch existing metadata first to merge
                const { data: callSession } = await supabase
                    .from('call_sessions')
                    .select('metadata')
                    .eq('room_id', sessionId)
                    .single();

                const existingMetadata = callSession?.metadata || {};
                const updatedMetadata = {
                    ...existingMetadata,
                    speakerMapping: mapping
                };

                const { error: metadataError } = await supabase
                    .from('call_sessions')
                    .update({ metadata: updatedMetadata })
                    .eq('room_id', sessionId);

                if (metadataError) {
                    console.error('[PRESENCIAL] Failed to save speaker mapping to call_sessions.metadata:', metadataError);
                }

                // 4. Emit speakerMappingUpdated to all room participants (per D-23)
                io.to(sessionId).emit('speakerMappingUpdated', {
                    sessionId,
                    mapping
                });

                console.log(`[PRESENCIAL] Speaker mapping completed for session ${sessionId}`);

                if (callback) {
                    callback({ success: true });
                }
            } catch (error) {
                console.error('[PRESENCIAL] Error mapping speakers:', error);

                logError(
                    'Error mapping speakers in presencial session',
                    'error',
                    null,
                    {
                        sessionId: data?.sessionId,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );

                if (callback) {
                    callback({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        });

        // ==================== OBTER TRANSCRIÇÕES ====================

        socket.on('getPresencialTranscriptions', (data, callback) => {
            try {
                const { sessionId } = data;

                const transcriptions = presencialSessionManager.getTranscriptions(sessionId);

                callback({
                    success: true,
                    transcriptions: transcriptions.map(t => ({
                        speaker: t.speaker,
                        text: t.text,
                        timestamp: t.timestamp,
                        sequence: t.sequence
                    }))
                });
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao obter transcrições:', error);
                callback({
                    success: false,
                    error: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        });

        // ==================== DESCONEXÃO ====================

        socket.on('disconnect', (reason) => {
            console.log(`[PRESENCIAL] ${userName} desconectado: ${reason}`);
        });
    });
}
