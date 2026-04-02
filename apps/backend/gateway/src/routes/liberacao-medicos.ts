import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { liberarMedico, liberarMedicosMassa } from '../controllers/liberacaoMedicosController';

const router = Router();

/**
 * POST /liberacao-medicos/liberar
 * Libera conta de médico manualmente (cria assinatura + conta + envia email + WhatsApp)
 * Requer autenticação (admin)
 */
router.post('/liberar', authenticateToken, liberarMedico);

/**
 * POST /liberacao-medicos/liberar-massa
 * Libera múltiplas contas de médicos em massa
 * Body: { medicos: [{ nome, email, telefone }] }
 * Requer autenticação (admin)
 */
router.post('/liberar-massa', authenticateToken, liberarMedicosMassa);

export default router;
