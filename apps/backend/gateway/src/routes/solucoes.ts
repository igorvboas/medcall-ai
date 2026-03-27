import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getSolucaoMentalidade,
  updateSolucaoMentalidadeField,
  getSolucaoSuplementacao,
  updateSolucaoSuplementacaoField,
  addSolucaoSuplementacaoItem,
  getAlimentacao,
  updateAlimentacaoField,
  deleteSolucaoSuplementacaoItem,
  addRefeicaoToProtocol,
  removeRefeicaoFromProtocol,
  addAlimentoToMeal,
  removeAlimentoFromMeal,
  getAtividadeFisica,
  updateAtividadeFisicaField,
  addExercicioToProtocol,
  removeExercicioFromProtocol,
  getListaExerciciosFisicos
} from '../controllers/solucoesController';

const router = Router();

/**
 * Solução Mentalidade
 */
router.get('/solucao-mentalidade/:consultaId', authenticateToken, getSolucaoMentalidade);
router.post('/solucao-mentalidade/:consultaId/update-field', authenticateToken, updateSolucaoMentalidadeField);

/**
 * Solução Suplementação
 */
router.get('/solucao-suplementacao/:consultaId', authenticateToken, getSolucaoSuplementacao);
router.post('/solucao-suplementacao/:consultaId/update-field', authenticateToken, updateSolucaoSuplementacaoField);
router.post('/solucao-suplementacao/:consultaId/add-item', authenticateToken, addSolucaoSuplementacaoItem);
router.post('/solucao-suplementacao/:consultaId/delete-item', authenticateToken, deleteSolucaoSuplementacaoItem);

/**
 * Alimentação
 */
router.get('/alimentacao/:consultaId', authenticateToken, getAlimentacao);
router.post('/alimentacao/:consultaId/update-field', authenticateToken, updateAlimentacaoField);
router.post('/alimentacao/:consultaId/add-refeicao', authenticateToken, addRefeicaoToProtocol);
router.post('/alimentacao/:consultaId/remove-refeicao', authenticateToken, removeRefeicaoFromProtocol);
router.post('/alimentacao/:consultaId/add-alimento-to-meal', authenticateToken, addAlimentoToMeal);
router.post('/alimentacao/:consultaId/remove-alimento-from-meal', authenticateToken, removeAlimentoFromMeal);

/**
 * Atividade Física
 */
router.get('/atividade-fisica/:consultaId', authenticateToken, getAtividadeFisica);
router.post('/atividade-fisica/:consultaId/update-field', authenticateToken, updateAtividadeFisicaField);
router.post('/atividade-fisica/:consultaId/add-item', authenticateToken, addExercicioToProtocol);
router.post('/atividade-fisica/:consultaId/delete-item', authenticateToken, removeExercicioFromProtocol);

/**
 * Lista de Exercícios
 */
router.get('/lista-exercicios-fisicos', authenticateToken, getListaExerciciosFisicos);

export default router;
