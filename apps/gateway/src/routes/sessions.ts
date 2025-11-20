import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { generateSimpleProtocol } from '../services/protocolService';
import { generateLiveKitToken } from '../config/providers';
import { livekitTranscriberAgent } from '../services/livekitTranscriberAgent';

const router = Router();

// Schema de validação para criar sessão
const createSessionSchema = z.object({
  consultation_id: z.string().optional(),
  session_type: z.enum(['presencial', 'online']).default('online'),
  participants: z.object({
    doctor: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
    }),
    patient: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
    }),
  }),
  consent: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

// Criar nova sessão
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('📨 Recebida requisição para criar sessão:', req.body);
  
  // Validar dados de entrada
  const validationResult = createSessionSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    console.error('❌ Validação falhou:', validationResult.error);
    throw new ValidationError(`Dados inválidos para criar sessão: ${validationResult.error.message}`);
  }

  const { consultation_id, session_type, participants, consent, metadata } = validationResult.data;

  // Verificar consentimento
  if (!consent) {
    throw new ValidationError('Consentimento é obrigatório para iniciar a sessão');
  }

  try {
    console.log('📝 Tentando criar sessão com dados:', {
      consultation_id,
      session_type,
      participants,
      consent,
      metadata,
      started_at: new Date().toISOString(),
    });

    // Criar sessão no banco
    const session = await db.createSession({
      consultation_id,
      session_type,
      participants,
      consent,
      metadata,
      started_at: new Date().toISOString(),
    });

    if (!session) {
      console.error('❌ Falha ao criar sessão - retornou null');
      throw new Error('Falha ao criar sessão no banco de dados');
    }

    console.log('✅ Sessão criada com sucesso:', session.id);

    const roomName = `session-${session.id}`;

    // Para sessões presenciais, não precisamos de tokens LiveKit
    if (session_type === 'presencial') {
      // Resposta para sessão presencial (sem LiveKit)
      res.status(201).json({
        session: {
          id: session.id,
          type: session_type,
          roomName,
          startedAt: session.started_at,
          participants: session.participants,
          consultation_id: session.consultation_id,
        },
        presential: {
          websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3001',
        },
      });
    } else {
      // Para sessões online, gerar tokens LiveKit
      console.log(`🌐 PROCESSANDO SESSÃO ONLINE - roomName: ${roomName}`);
      const [doctorToken, patientToken] = await Promise.all([
        generateLiveKitToken(
          participants.doctor.id,
          roomName,
          {
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            metadata: JSON.stringify({ role: 'doctor', sessionId: session.id }),
          }
        ),
        generateLiveKitToken(
          participants.patient.id,
          roomName,
          {
            canPublish: true,
            canSubscribe: true,
            canPublishData: false, // Paciente não pode enviar dados arbitrários
            metadata: JSON.stringify({ role: 'patient', sessionId: session.id }),
          }
        ),
      ]);

      // Gerar URLs específicas para médico e paciente
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const doctorUrl = `${baseUrl}/consulta/online/doctor?sessionId=${session.id}&roomName=${roomName}&token=${doctorToken}&consultationId=${session.consultation_id}&patientName=${encodeURIComponent(participants.patient.name)}`;
      const patientUrl = `${baseUrl}/consulta/online/patient?sessionId=${session.id}&roomName=${roomName}&token=${patientToken}&consultationId=${session.consultation_id}&doctorName=${encodeURIComponent(participants.doctor.name)}`;

      // TEMPORARIAMENTE DESABILITADO: Transcriber agent antigo (conflita com PCM WebSocket)
      // TODO: Remover completamente após validar que PCM WebSocket funciona
      /*
      try {
        console.log(`🎤 Iniciando transcriber agent para sala: ${roomName}`);
        await livekitTranscriberAgent.start(roomName);
        console.log(`✅ Transcriber agent iniciado para sala: ${roomName}`);
      } catch (error) {
        console.error(`❌ Erro ao iniciar transcriber agent para sala ${roomName}:`, error);
        // Não falhar a criação da sessão se o transcriber agent falhar
      }
      */
      console.log(`🔇 [DISABLED] LiveKit transcriber agent disabled, using PCM WebSocket instead`);

      // Resposta com tokens e informações da sessão online
      res.status(201).json({
        session: {
          id: session.id,
          type: session_type,
          roomName,
          startedAt: session.started_at,
          participants: session.participants,
          consultation_id: session.consultation_id,
        },
        tokens: {
          doctor: doctorToken,
          patient: patientToken,
        },
        urls: {
          doctor: doctorUrl,
          patient: patientUrl,
        },
        livekit: {
          url: process.env.LIVEKIT_URL,
        },
      });
    }

  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Falha ao criar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}));

// Buscar sessão por ID
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada',
      },
    });
  }

  // Buscar utterances, conversas e suggestions da sessão
  const [utterances, conversations, suggestions] = await Promise.all([
    db.getSessionUtterances(sessionId),
    db.getSessionConversations(sessionId), // ✅ Array de conversas formatado
    db.getSessionSuggestions(sessionId),
  ]);

  res.json({
    session,
    transcription: utterances, // Formato original (linhas separadas)
    conversations: conversations, // ✅ Novo formato: array de conversas
    suggestions,
  });
}));

// Buscar conversas de uma sessão (formato array)
router.get('/:sessionId/conversations', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const conversations = await db.getSessionConversations(sessionId);

  res.json({
    sessionId,
    conversations: conversations, // Array de conversas formatado
    total: conversations.length
  });
}));

// Finalizar sessão
router.patch('/:sessionId/end', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada',
      },
    });
  }

  if (session.ended_at) {
    return res.status(409).json({
      error: {
        code: 'SESSION_ALREADY_ENDED',
        message: 'Sessão já foi finalizada',
      },
    });
  }

  // Finalizar sessão
  const updated = await db.updateSession(sessionId, {
    ended_at: new Date().toISOString(),
    status: 'ended',
  });

  if (!updated) {
    throw new Error('Falha ao finalizar sessão');
  }

  res.json({
    message: 'Sessão finalizada com sucesso',
    sessionId,
    endedAt: new Date().toISOString(),
  });
}));

// Finalizar sessão e consolidar dados
router.post('/:sessionId/complete', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: { code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada' },
    });
  }

  // Definir ended_at caso ainda não tenha sido setado
  const endedAt = session.ended_at || new Date().toISOString();
  if (!session.ended_at) {
    await db.updateSession(sessionId, { ended_at: endedAt, status: 'ended' });
  }

  // Buscar dados da sessão
  const [utterances, suggestions] = await Promise.all([
    db.getSessionUtterances(sessionId),
    db.getSessionSuggestions(sessionId),
  ]);

  // Consolidar transcrição
  const transcriptText = utterances
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(u => `${u.speaker === 'doctor' ? 'Médico' : u.speaker === 'patient' ? 'Paciente' : 'Sistema'}: ${u.text}`)
    .join('\n');

  const avgConfidence =
    utterances.length > 0
      ? (utterances.reduce((sum, u) => sum + (u.confidence || 0), 0) / utterances.length)
      : null;

  const startedAt = new Date(session.started_at).getTime();
  const finishedAt = new Date(endedAt).getTime();
  const durationSeconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));

  // Sugestões usadas
  const usedSuggestions = suggestions.filter(s => s.used);

  // Gerar protocolo simples
  const protocol = generateSimpleProtocol({
    transcriptText,
    utterances,
    suggestions,
    usedSuggestions,
    participants: session.participants,
  });

  // Persistir dados agrupados
  // 1) Atualizar consulta, se existir
  if (session.consultation_id) {
    await db.updateConsultation(session.consultation_id, {
      status: 'COMPLETED',
      duration: durationSeconds,
      notes: protocol.summary,
    });

    // 2) Criar transcrição consolidada
    await db.createTranscription({
      consultation_id: session.consultation_id,
      raw_text: transcriptText,
      summary: protocol.summary,
      key_points: protocol.key_points,
      diagnosis: protocol.diagnosis || null,
      treatment: protocol.treatment || null,
      observations: protocol.observations || null,
      confidence: avgConfidence ?? undefined,
      language: 'pt-BR',
      model_used: 'live-realtime+fallback',
    });

    // 3) Criar documento de protocolo
    await db.createDocument({
      consultation_id: session.consultation_id,
      title: `Protocolo de Atendimento - ${new Date(endedAt).toLocaleString('pt-BR')}`,
      content: protocol.full_text,
      type: 'REPORT',
      format: 'text',
    });
  }

  // Responder com resumo
  return res.json({
    message: 'Sessão finalizada e consolidada com sucesso',
    sessionId,
    durationSeconds,
    suggestions: {
      total: suggestions.length,
      used: usedSuggestions.length,
    },
  });
}));

// Listar sessões recentes (para dashboard)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implementar listagem com paginação
  // Por enquanto, retorna resposta básica
  res.json({
    sessions: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },
  });
}));

export default router;