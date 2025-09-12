import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { generateLiveKitToken } from '@/config/providers';

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
router.post('/', asyncHandler(async (req, res) => {
  // Validar dados de entrada
  const validationResult = createSessionSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw new ValidationError('Dados inválidos para criar sessão');
  }

  const { consultation_id, session_type, participants, consent, metadata } = validationResult.data;

  // Verificar consentimento
  if (!consent) {
    throw new ValidationError('Consentimento é obrigatório para iniciar a sessão');
  }

  try {
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
      throw new Error('Falha ao criar sessão no banco de dados');
    }

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
        livekit: {
          url: process.env.LIVEKIT_URL,
        },
      });
    }

  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    throw new Error('Falha ao criar sessão. Tente novamente.');
  }
}));

// Buscar sessão por ID
router.get('/:sessionId', asyncHandler(async (req, res) => {
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

  // Buscar utterances e suggestions da sessão
  const [utterances, suggestions] = await Promise.all([
    db.getSessionUtterances(sessionId),
    db.getSessionSuggestions(sessionId),
  ]);

  res.json({
    session,
    transcription: utterances,
    suggestions,
  });
}));

// Finalizar sessão
router.patch('/:sessionId/end', asyncHandler(async (req, res) => {
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

// Listar sessões recentes (para dashboard)
router.get('/', asyncHandler(async (req, res) => {
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