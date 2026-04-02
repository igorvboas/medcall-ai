import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getRefeicoes,
  getRefeicaoById,
  createRefeicao,
  updateRefeicao,
  deleteRefeicao,
  toggleFavoritoRefeicao,
  addAlimentoToRefeicao,
  updateRefeicaoAlimento,
  deleteRefeicaoAlimento
} from '../controllers/cadastroRefeicaoController';

const router = Router();

/**
 * GET /cadastro-refeicoes
 * Lista todas as refeições do médico
 */
router.get('/', authenticateToken, getRefeicoes);

/**
 * POST /cadastro-refeicoes
 * Cria uma nova refeição
 */
router.post('/', authenticateToken, createRefeicao);

/**
 * GET /cadastro-refeicoes/:id
 * Busca uma refeição com seus alimentos
 */
router.get('/:id', authenticateToken, getRefeicaoById);

/**
 * PUT /cadastro-refeicoes/:id
 * Atualiza uma refeição
 */
router.put('/:id', authenticateToken, updateRefeicao);

/**
 * DELETE /cadastro-refeicoes/:id
 * Remove uma refeição
 */
router.delete('/:id', authenticateToken, deleteRefeicao);

/**
 * PATCH /cadastro-refeicoes/:id/favorito
 * Toggle favorito
 */
router.patch('/:id/favorito', authenticateToken, toggleFavoritoRefeicao);

/**
 * POST /cadastro-refeicoes/:refeicaoId/alimentos
 * Adiciona um alimento à refeição
 */
router.post('/:refeicaoId/alimentos', authenticateToken, addAlimentoToRefeicao);

/**
 * PUT /cadastro-refeicoes/:refeicaoId/alimentos/:alimentoId
 * Atualiza um alimento da refeição
 */
router.put('/:refeicaoId/alimentos/:alimentoId', authenticateToken, updateRefeicaoAlimento);

/**
 * DELETE /cadastro-refeicoes/:refeicaoId/alimentos/:alimentoId
 * Remove um alimento da refeição
 */
router.delete('/:refeicaoId/alimentos/:alimentoId', authenticateToken, deleteRefeicaoAlimento);

export default router;
