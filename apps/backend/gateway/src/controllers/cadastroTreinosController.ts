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
      query = query.or(`nome.ilike.%${search}%,categoria.ilike.%${search}%,descricao.ilike.%${search}%`);
    }
    if (favoritosOnly) {
      query = query.eq('favorito', true);
    }

    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar treinos' });
    }

    return res.json({
      success: true,
      treinos: data || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
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

    // Buscar exercícios do treino com dados do exercício
    const { data: exercicios, error: exError } = await supabase
      .from('cadastro_treino_exercicios')
      .select('*, cadastro_exercicios(*)')
      .eq('treino_id', id)
      .order('ordem', { ascending: true });

    if (exError) {
      console.error('[CADASTRO-TREINOS] Erro ao buscar exercícios:', exError);
    }

    return res.json({
      success: true,
      treino: { ...treino, exercicios: exercicios || [] },
    });
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

    const { nome, categoria, descricao, favorito, tags } = req.body;
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
    const { nome, categoria, descricao, favorito, tags } = req.body;

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

// ==================== EXERCÍCIOS DO TREINO ====================

/**
 * POST /cadastro-treinos/:treinoId/exercicios
 */
export async function addExercicioToTreino(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { treinoId } = req.params;
    const { exercicio_id, series, repeticoes, descanso, observacao } = req.body;

    if (!exercicio_id) {
      return res.status(400).json({ success: false, error: 'exercicio_id é obrigatório' });
    }

    // Verificar ownership do treino
    const { data: treino } = await supabase
      .from('cadastro_treinos')
      .select('id')
      .eq('id', treinoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!treino) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    // Próxima ordem
    const { data: lastItem } = await supabase
      .from('cadastro_treino_exercicios')
      .select('ordem')
      .eq('treino_id', treinoId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrdem = (lastItem?.ordem || 0) + 1;

    const { data, error } = await supabase
      .from('cadastro_treino_exercicios')
      .insert({
        treino_id: treinoId,
        exercicio_id,
        series: series || null,
        repeticoes: repeticoes || null,
        descanso: descanso || null,
        observacao: observacao || null,
        ordem: nextOrdem,
      })
      .select('*, cadastro_exercicios(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao adicionar exercício:', error);
      return res.status(500).json({ success: false, error: 'Erro ao adicionar exercício' });
    }

    return res.status(201).json({ success: true, exercicio: data });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PUT /cadastro-treinos/:treinoId/exercicios/:exercicioItemId
 */
export async function updateTreinoExercicio(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { treinoId, exercicioItemId } = req.params;

    // Verificar ownership
    const { data: treino } = await supabase
      .from('cadastro_treinos')
      .select('id')
      .eq('id', treinoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!treino) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    const { series, repeticoes, descanso, observacao, ordem } = req.body;
    const updateData: any = {};
    if (series !== undefined) updateData.series = series;
    if (repeticoes !== undefined) updateData.repeticoes = repeticoes;
    if (descanso !== undefined) updateData.descanso = descanso;
    if (observacao !== undefined) updateData.observacao = observacao;
    if (ordem !== undefined) updateData.ordem = ordem;

    const { data, error } = await supabase
      .from('cadastro_treino_exercicios')
      .update(updateData)
      .eq('id', exercicioItemId)
      .eq('treino_id', treinoId)
      .select('*, cadastro_exercicios(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao atualizar exercício:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar exercício' });
    }

    return res.json({ success: true, exercicio: data });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * DELETE /cadastro-treinos/:treinoId/exercicios/:exercicioItemId
 */
export async function deleteTreinoExercicio(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { treinoId, exercicioItemId } = req.params;

    const { data: treino } = await supabase
      .from('cadastro_treinos')
      .select('id')
      .eq('id', treinoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!treino) {
      return res.status(404).json({ success: false, error: 'Treino não encontrado' });
    }

    const { error } = await supabase
      .from('cadastro_treino_exercicios')
      .delete()
      .eq('id', exercicioItemId)
      .eq('treino_id', treinoId);

    if (error) {
      console.error('[CADASTRO-TREINOS] Erro ao remover exercício:', error);
      return res.status(500).json({ success: false, error: 'Erro ao remover exercício' });
    }

    return res.json({ success: true, message: 'Exercício removido do treino' });
  } catch (err) {
    console.error('[CADASTRO-TREINOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
