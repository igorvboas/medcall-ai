import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getTreinos,
  getTreinoById,
  createTreino,
  updateTreino,
  deleteTreino,
  toggleFavoritoTreino,
  addExercicioToTreino,
  updateTreinoExercicio,
  deleteTreinoExercicio,
} from '../controllers/cadastroTreinosController';

const router = Router();

router.get('/', authenticateToken, getTreinos);
router.post('/', authenticateToken, createTreino);
router.get('/:id', authenticateToken, getTreinoById);
router.put('/:id', authenticateToken, updateTreino);
router.delete('/:id', authenticateToken, deleteTreino);
router.patch('/:id/favorito', authenticateToken, toggleFavoritoTreino);

// Exercícios do treino
router.post('/:treinoId/exercicios', authenticateToken, addExercicioToTreino);
router.put('/:treinoId/exercicios/:exercicioItemId', authenticateToken, updateTreinoExercicio);
router.delete('/:treinoId/exercicios/:exercicioItemId', authenticateToken, deleteTreinoExercicio);

export default router;
