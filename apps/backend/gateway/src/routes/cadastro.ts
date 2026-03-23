import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  toggleFavorito,
  addAlimentoToRefeicao,
  removeAlimentoFromRefeicao,
} from '../controllers/cadastroController';

const router = Router();

// CRUD generico para alimentos, refeicoes, treinos, suplementos
router.get('/:tipo', authenticateToken, listItems);
router.post('/:tipo', authenticateToken, createItem);
router.put('/:tipo/:id', authenticateToken, updateItem);
router.delete('/:tipo/:id', authenticateToken, deleteItem);
router.patch('/:tipo/:id/favorito', authenticateToken, toggleFavorito);

// Refeicao <-> Alimento relacao
router.post('/refeicoes/:id/alimentos', authenticateToken, addAlimentoToRefeicao);
router.delete('/refeicoes/:id/alimentos/:alimentoRelId', authenticateToken, removeAlimentoFromRefeicao);

export default router;
