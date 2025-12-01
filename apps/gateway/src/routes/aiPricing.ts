import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { aiPricingService } from '../services/aiPricingService';

const router = Router();

/**
 * GET /ai-pricing/stats
 * Retorna estatísticas gerais de custos de IA
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate as string) : undefined;
  const end = endDate ? new Date(endDate as string) : undefined;
  
  const stats = await aiPricingService.getTotalCosts(start, end);
  
  if (!stats) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas de custos'
    });
  }

  res.json({
    success: true,
    data: {
      ...stats,
      // Formatar valores em USD
      totalFormatted: `$${stats.total.toFixed(4)}`,
      totalTesterFormatted: `$${stats.totalTester.toFixed(4)}`,
      totalProductionFormatted: `$${stats.totalProduction.toFixed(4)}`,
    }
  });
}));

/**
 * GET /ai-pricing/consulta/:consultaId
 * Retorna custos de uma consulta específica
 */
router.get('/consulta/:consultaId', asyncHandler(async (req: Request, res: Response) => {
  const { consultaId } = req.params;
  
  if (!consultaId) {
    return res.status(400).json({
      success: false,
      error: 'consultaId é obrigatório'
    });
  }

  const costs = await aiPricingService.getConsultaCosts(consultaId);
  
  if (!costs) {
    return res.status(404).json({
      success: false,
      error: 'Custos não encontrados para esta consulta'
    });
  }

  res.json({
    success: true,
    data: {
      consultaId,
      ...costs,
      totalFormatted: `$${costs.total.toFixed(4)}`,
    }
  });
}));

/**
 * GET /ai-pricing/summary
 * Retorna resumo de custos por período (últimos 7 dias, 30 dias, etc)
 */
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  
  // Últimas 24 horas
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stats24h = await aiPricingService.getTotalCosts(last24h, now);
  
  // Últimos 7 dias
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stats7d = await aiPricingService.getTotalCosts(last7d, now);
  
  // Últimos 30 dias
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const stats30d = await aiPricingService.getTotalCosts(last30d, now);
  
  // Total (sem filtro de data)
  const statsTotal = await aiPricingService.getTotalCosts();

  res.json({
    success: true,
    data: {
      last24h: stats24h ? {
        total: stats24h.total,
        totalFormatted: `$${stats24h.total.toFixed(4)}`,
        count: stats24h.count,
      } : null,
      last7d: stats7d ? {
        total: stats7d.total,
        totalFormatted: `$${stats7d.total.toFixed(4)}`,
        count: stats7d.count,
      } : null,
      last30d: stats30d ? {
        total: stats30d.total,
        totalFormatted: `$${stats30d.total.toFixed(4)}`,
        count: stats30d.count,
      } : null,
      allTime: statsTotal ? {
        total: statsTotal.total,
        totalFormatted: `$${statsTotal.total.toFixed(4)}`,
        count: statsTotal.count,
        byEtapa: statsTotal.byEtapa,
        byModel: statsTotal.byModel,
      } : null,
    }
  });
}));

export default router;

