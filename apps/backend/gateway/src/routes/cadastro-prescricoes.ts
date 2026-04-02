import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listPrescricoes,
  createPrescricao,
  updatePrescricao,
  deletePrescricao,
  toggleFavoritoPrescricao,
} from '../controllers/cadastroPrescricoesController';

const router = Router();

// CRUD prescricoes (suplementos e fitoterapicos)
router.get('/:tipo', authenticateToken, listPrescricoes);
router.post('/:tipo', authenticateToken, createPrescricao);
router.put('/:tipo/:id', authenticateToken, updatePrescricao);
router.delete('/:tipo/:id', authenticateToken, deletePrescricao);
router.patch('/:tipo/:id/favorito', authenticateToken, toggleFavoritoPrescricao);

export default router;
