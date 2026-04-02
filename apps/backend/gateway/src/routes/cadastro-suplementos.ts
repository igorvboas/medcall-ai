import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getSuplementos,
  createSuplemento,
  getPrescricoes,
  getPrescricaoById,
  createPrescricao,
  updatePrescricao,
  deletePrescricao,
  toggleFavoritoPrescricao,
} from '../controllers/cadastroSuplementosController';

const router = Router();

// Catálogo global de suplementos (searchbox)
router.get('/', authenticateToken, getSuplementos);
router.post('/', authenticateToken, createSuplemento);

// Prescrições do médico (CRUD principal da página)
router.get('/prescricoes', authenticateToken, getPrescricoes);
router.post('/prescricoes', authenticateToken, createPrescricao);
router.get('/prescricoes/:prescricaoId', authenticateToken, getPrescricaoById);
router.put('/prescricoes/:prescricaoId', authenticateToken, updatePrescricao);
router.delete('/prescricoes/:prescricaoId', authenticateToken, deletePrescricao);
router.patch('/prescricoes/:prescricaoId/favorito', authenticateToken, toggleFavoritoPrescricao);

export default router;
