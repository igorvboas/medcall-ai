import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAlimentos, createAlimento } from '../controllers/cadastroAlimentosController';

const router = Router();

/**
 * GET /cadastro-alimentos
 * Lista alimentos do médico
 */
router.get('/', authenticateToken, getAlimentos);

/**
 * POST /cadastro-alimentos
 * Cria um novo alimento
 */
router.post('/', authenticateToken, createAlimento);

export default router;
