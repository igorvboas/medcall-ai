import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getTreinos,
  getTreinoById,
  createTreino,
  updateTreino,
  deleteTreino,
  toggleFavoritoTreino,
} from '../controllers/cadastroTreinosController';

const router = Router();

router.get('/', authenticateToken, getTreinos);
router.post('/', authenticateToken, createTreino);
router.get('/:id', authenticateToken, getTreinoById);
router.put('/:id', authenticateToken, updateTreino);
router.delete('/:id', authenticateToken, deleteTreino);
router.patch('/:id/favorito', authenticateToken, toggleFavoritoTreino);

export default router;
