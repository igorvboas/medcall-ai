import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getFitoterapicos,
  createFitoterapico,
  getFitoPrescricoes,
  getFitoPrescricaoById,
  createFitoPrescricao,
  updateFitoPrescricao,
  deleteFitoPrescricao,
  toggleFavoritoFitoPrescricao,
} from '../controllers/cadastroFitoterapicosController';

const router = Router();

// Catálogo global de fitoterápicos (searchbox)
router.get('/', authenticateToken, getFitoterapicos);
router.post('/', authenticateToken, createFitoterapico);

// Prescrições do médico
router.get('/prescricoes', authenticateToken, getFitoPrescricoes);
router.post('/prescricoes', authenticateToken, createFitoPrescricao);
router.get('/prescricoes/:prescricaoId', authenticateToken, getFitoPrescricaoById);
router.put('/prescricoes/:prescricaoId', authenticateToken, updateFitoPrescricao);
router.delete('/prescricoes/:prescricaoId', authenticateToken, deleteFitoPrescricao);
router.patch('/prescricoes/:prescricaoId/favorito', authenticateToken, toggleFavoritoFitoPrescricao);

export default router;
