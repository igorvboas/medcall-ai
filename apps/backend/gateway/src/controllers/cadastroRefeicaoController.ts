import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Helper: buscar doctor_id do usuário autenticado
 */
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
 * GET /cadastro-refeicoes
 * Lista todas as refeições do médico autenticado
 */
export async function getRefeicoes(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const favoritosOnly = req.query.favoritos === 'true';

    let query = supabase
      .from('cadastro_refeicoes')
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
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar refeições' });
    }

    return res.json({
      success: true,
      refeicoes: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * GET /cadastro-refeicoes/:id
 * Busca uma refeição com seus alimentos
 */
export async function getRefeicaoById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    const { data: refeicao, error } = await supabase
      .from('cadastro_refeicoes')
      .select('*')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (error || !refeicao) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    // Buscar alimentos da refeição com dados do alimento
    const { data: alimentos, error: alimentosError } = await supabase
      .from('cadastro_refeicao_alimentos')
      .select('*, cadastro_alimentos(*)')
      .eq('refeicao_id', id)
      .order('ordem', { ascending: true });

    if (alimentosError) {
      console.error('[CADASTRO-REFEICOES] Erro ao buscar alimentos:', alimentosError);
    }

    return res.json({
      success: true,
      refeicao: {
        ...refeicao,
        alimentos: alimentos || []
      }
    });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-refeicoes
 * Cria uma nova refeição
 */
export async function createRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { nome, categoria, descricao, favorito, tags } = req.body;

    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_refeicoes')
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
      console.error('[CADASTRO-REFEICOES] Erro ao criar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar refeição' });
    }

    return res.status(201).json({ success: true, refeicao: data });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PUT /cadastro-refeicoes/:id
 * Atualiza uma refeição
 */
export async function updateRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;
    const { nome, categoria, descricao, favorito, tags } = req.body;

    // Verificar ownership
    const { data: existing } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (favorito !== undefined) updateData.favorito = favorito;
    if (tags !== undefined) updateData.tags = tags;

    const { data, error } = await supabase
      .from('cadastro_refeicoes')
      .update(updateData)
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao atualizar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar refeição' });
    }

    return res.json({ success: true, refeicao: data });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * DELETE /cadastro-refeicoes/:id
 * Remove uma refeição (cascade deleta os alimentos)
 */
export async function deleteRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    const { error } = await supabase
      .from('cadastro_refeicoes')
      .delete()
      .eq('id', id)
      .eq('doctor_id', doctorId);

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao deletar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao deletar refeição' });
    }

    return res.json({ success: true, message: 'Refeição removida com sucesso' });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PATCH /cadastro-refeicoes/:id/favorito
 * Toggle favorito
 */
/**
 * PUT /cadastro-refeicoes/:refeicaoId/alimentos/:alimentoId
 * Atualiza um alimento da refeição (porção customizada, observação, ordem)
 */
/**
 * POST /cadastro-refeicoes/:refeicaoId/alimentos
 * Adiciona um alimento à refeição
 */
export async function addAlimentoToRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { refeicaoId } = req.params;
    const { alimento_id, porcao_customizada, observacao } = req.body;

    if (!alimento_id) {
      return res.status(400).json({ success: false, error: 'alimento_id é obrigatório' });
    }

    // Verificar ownership da refeição
    const { data: refeicao } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', refeicaoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!refeicao) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    // Determinar próxima ordem
    const { data: lastItem } = await supabase
      .from('cadastro_refeicao_alimentos')
      .select('ordem')
      .eq('refeicao_id', refeicaoId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrdem = (lastItem?.ordem || 0) + 1;

    const { data, error } = await supabase
      .from('cadastro_refeicao_alimentos')
      .insert({
        refeicao_id: refeicaoId,
        alimento_id,
        porcao_customizada: porcao_customizada || null,
        observacao: observacao || null,
        ordem: nextOrdem,
      })
      .select('*, cadastro_alimentos(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao adicionar alimento:', error);
      return res.status(500).json({ success: false, error: 'Erro ao adicionar alimento' });
    }

    return res.status(201).json({ success: true, alimento: data });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

export async function updateRefeicaoAlimento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { refeicaoId, alimentoId } = req.params;

    // Verificar ownership da refeição
    const { data: refeicao } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', refeicaoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!refeicao) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    const { porcao_customizada, observacao, ordem } = req.body;

    const updateData: any = {};
    if (porcao_customizada !== undefined) updateData.porcao_customizada = porcao_customizada;
    if (observacao !== undefined) updateData.observacao = observacao;
    if (ordem !== undefined) updateData.ordem = ordem;

    const { data, error } = await supabase
      .from('cadastro_refeicao_alimentos')
      .update(updateData)
      .eq('id', alimentoId)
      .eq('refeicao_id', refeicaoId)
      .select('*, cadastro_alimentos(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao atualizar alimento:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar alimento' });
    }

    return res.json({ success: true, alimento: data });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * DELETE /cadastro-refeicoes/:refeicaoId/alimentos/:alimentoId
 * Remove um alimento da refeição
 */
export async function deleteRefeicaoAlimento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { refeicaoId, alimentoId } = req.params;

    // Verificar ownership da refeição
    const { data: refeicao } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', refeicaoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!refeicao) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    const { error } = await supabase
      .from('cadastro_refeicao_alimentos')
      .delete()
      .eq('id', alimentoId)
      .eq('refeicao_id', refeicaoId);

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao remover alimento:', error);
      return res.status(500).json({ success: false, error: 'Erro ao remover alimento' });
    }

    return res.json({ success: true, message: 'Alimento removido da refeição' });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

export async function toggleFavoritoRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { id } = req.params;

    // Buscar estado atual
    const { data: refeicao } = await supabase
      .from('cadastro_refeicoes')
      .select('favorito')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!refeicao) {
      return res.status(404).json({ success: false, error: 'Refeição não encontrada' });
    }

    const { data, error } = await supabase
      .from('cadastro_refeicoes')
      .update({ favorito: !refeicao.favorito })
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-REFEICOES] Erro ao toggle favorito:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar favorito' });
    }

    return res.json({ success: true, refeicao: data });
  } catch (err) {
    console.error('[CADASTRO-REFEICOES] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
