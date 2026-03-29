import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getDocumentos,
  getDocumento,
  createDocumento,
  deleteDocumento,
  signDocumento,
  getSignStatus,
  zapsignWebhook,
} from '../controllers/documentosController';

const router = Router();

// Webhook ZapSign (SEM autenticação - chamado externamente)
// IMPORTANTE: deve vir ANTES das rotas com :id para não conflitar
router.post('/webhook/zapsign', zapsignWebhook);

// Listar todos os documentos do médico
router.get('/', authenticateToken, getDocumentos);

// Buscar documento específico
router.get('/:id', authenticateToken, getDocumento);

// Criar novo documento
router.post('/', authenticateToken, createDocumento);

// Excluir documento
router.delete('/:id', authenticateToken, deleteDocumento);

// Enviar para assinatura via ZapSign
router.post('/:id/sign', authenticateToken, signDocumento);

// Consultar status de assinatura
router.get('/:id/status', authenticateToken, getSignStatus);

export default router;
