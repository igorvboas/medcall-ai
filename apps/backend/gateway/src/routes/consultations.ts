import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getConsultations,
  getConsultationById,
  updateConsultation,
  deleteConsultation,
  finalizeConsultationRemote,
  finalizeConsultationDirect,
  createScheduledConsultation
} from '../controllers/consultationsController';

const router = Router();

/**
 * GET /consultations
 * Lista consultas do médico
 */
router.get('/', authenticateToken, getConsultations);

/**
 * POST /consultations/:id/finalize-remote
 * Finaliza a consulta remotamente (salva transcrições, envia webhook de conclusão).
 * Usado pelo popup "Consulta em Andamento" quando o médico clica em Finalizar.
 */
router.post('/:id/finalize-remote', authenticateToken, finalizeConsultationRemote);

/**
 * POST /consultations/:id/finalize-direct
 * Fallback: atualiza PROCESSING + envia webhook (para consultas sem sala ativa).
 */
router.post('/:id/finalize-direct', authenticateToken, finalizeConsultationDirect);

/**
 * POST /consultations/schedule
 * Cria novo agendamento com verificação de conflitos
 */
router.post('/schedule', authenticateToken, createScheduledConsultation);

/**
 * GET /consultations/:id
 * Busca uma consulta específica
 */
router.get('/:id', authenticateToken, getConsultationById);

/**
 * PATCH /consultations/:id
 * Atualiza uma consulta
 */
router.patch('/:id', authenticateToken, updateConsultation);

/**
 * DELETE /consultations/:id
 * Deleta uma consulta
 */
router.delete('/:id', authenticateToken, deleteConsultation);

export default router;
