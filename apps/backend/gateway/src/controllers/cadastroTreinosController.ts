import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

async function getDoctorId(userId: string) {
  const { data: medico, error } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', userId)
    .single();
  if (error || !medico) return null;
  return medico.id as string;
}

/**
 * GET /cadastro-treinos
 */
export async function getTreinos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const favoritosOnly = req.query.favoritos === 'true';

    let query = supabase
      .from('cadastro_treinos')
      .select('*', { count: 'exact' })
      .eq('doctor_id', doctorId);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,categoria.ilike.%${search}%,grupo_muscular.ilike.%${search}%,equipamento.ilike.%${search}%`);
    }

    if (favoritosOnly) {
      query = query.eq('favorito', true);
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar treinos' });
    }

    return res.json({
      success: true,
      treinos: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * GET /cadastro-treinos/:id
 */
export async function getTreinoById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    const { data: treino, error } = await supabase
      .from('cadastro_treinos')
      .select('*')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (error || !treino) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    return res.json({ success: true, treino });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-treinos
 */
export async function createTreino(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { nome, categoria, descricao, grupo_muscular, series, repeticoes, descanso, equipamento, favorito, tags } = req.body;

    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_treinos')
      .insert({
        doctor_id: doctorId,
        nome: nome.trim(),
        categoria: categoria || null,
        descricao: descricao || null,
        grupo_muscular: grupo_muscular || null,
        series: series || null,
        repeticoes: repeticoes || null,
        descanso: descanso || null,
        equipamento: equipamento || null,
        favorito: favorito || false,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao criar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar treino' });
    }

    return res.status(201).json({ success: true, treino: data });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PUT /cadastro-treinos/:id
 */
export async function updateTreino(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;
    const { nome, categoria, descricao, grupo_muscular, series, repeticoes, descanso, equipamento, favorito, tags } = req.body;

    const { data: existing } = await supabase
      .from('cadastro_treinos')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (grupo_muscular !== undefined) updateData.grupo_muscular = grupo_muscular;
    if (series !== undefined) updateData.series = series;
    if (repeticoes !== undefined) updateData.repeticoes = repeticoes;
    if (descanso !== undefined) updateData.descanso = descanso;
    if (equipamento !== undefined) updateData.equipamento = equipamento;
    if (favorito !== undefined) updateData.favorito = favorito;
    if (tags !== undefined) updateData.tags = tags;

    const { data, error } = await supabase
      .from('cadastro_treinos')
      .update(updateData)
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao atualizar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar treino' });
    }

    return res.json({ success: true, treino: data });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * DELETE /cadastro-treinos/:id
 */
export async function deleteTreino(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    const { error } = await supabase
      .from('cadastro_treinos')
      .delete()
      .eq('id', id)
      .eq('doctor_id', doctorId);

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao deletar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao deletar treino' });
    }

    return res.json({ success: true, message: 'Treino removido com sucesso' });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PATCH /cadastro-treinos/:id/favorito
 */
export async function toggleFavoritoTreino(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    const { data: treino } = await supabase
      .from('cadastro_treinos')
      .select('favorito')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!treino) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    const { data, error } = await supabase
      .from('cadastro_treinos')
      .update({ favorito: !treino.favorito })
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao toggle favorito:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar favorito' });
    }

    return res.json({ success: true, treino: data });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
