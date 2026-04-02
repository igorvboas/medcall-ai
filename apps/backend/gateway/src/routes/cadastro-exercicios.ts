import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getExercicios, createExercicio } from '../controllers/cadastroExerciciosController';

const router = Router();

router.get('/', authenticateToken, getExercicios);
router.post('/', authenticateToken, createExercicio);

export default router;
