import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

export async function searchAlimentosNutricionais(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const search = req.query.search as string || '';
    const limit = parseInt(req.query.limit as string) || 20;

    if (!search.trim()) {
      return res.json({ success: true, alimentos: [] });
    }

    const { data, error } = await supabase
      .from('alimentos_nutricionais')
      .select('table_id, nome, categoria, energia_kcal, proteina_g, lipideos_g, carboidrato_g, fibra_alimentar_g')
      .ilike('nome', `%${search}%`)
      .order('nome', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[ALIMENTOS-NUTRICIONAIS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar alimentos' });
    }

    return res.json({ success: true, alimentos: data || [] });
  } catch (err) {
    console.error('[ALIMENTOS-NUTRICIONAIS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
