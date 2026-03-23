import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /cadastro-exercicios
 * Exercícios são globais do aplicativo (sem filtro por doctor_id)
 */
export async function getExercicios(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';

    let query = supabase
      .from('cadastro_exercicios')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,grupo_muscular.ilike.%${search}%,equipamento.ilike.%${search}%`);
    }

    query = query.order('nome', { ascending: true });
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[CADASTRO-EXERCICIOS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar exercícios' });
    }

    return res.json({
      success: true,
      exercicios: data || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error('[CADASTRO-EXERCICIOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-exercicios
 * Cria exercício global (sem doctor_id)
 */
export async function createExercicio(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { nome, grupo_muscular, descricao, url_tutorial, equipamento, favorito, tags } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_exercicios')
      .insert({
        nome: nome.trim(),
        grupo_muscular: grupo_muscular || null,
        descricao: descricao || null,
        url_tutorial: url_tutorial || null,
        equipamento: equipamento || null,
        favorito: favorito || false,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-EXERCICIOS] Erro ao criar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar exercício' });
    }

    return res.status(201).json({ success: true, exercicio: data });
  } catch (err) {
    console.error('[CADASTRO-EXERCICIOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
