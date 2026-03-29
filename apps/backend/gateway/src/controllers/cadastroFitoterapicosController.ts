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

// ==================== CATÁLOGO DE FITOTERÁPICOS (GLOBAL) ====================

/**
 * GET /cadastro-fitoterapicos
 */
export async function getFitoterapicos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const tipo = req.query.tipo as string || '';

    let query = supabase
      .from('cadastro_fitoterapicos')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,tipo.ilike.%${search}%,objetivo.ilike.%${search}%`);
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    query = query.order('nome', { ascending: true });
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar fitoterápicos' });
    }

    return res.json({
      success: true,
      fitoterapicos: data || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-fitoterapicos
 */
export async function createFitoterapico(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { nome, tipo, descricao, objetivo, tags } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_fitoterapicos')
      .insert({
        nome: nome.trim(),
        tipo: tipo || null,
        descricao: descricao || null,
        objetivo: objetivo || null,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao criar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar fitoterápico' });
    }

    return res.status(201).json({ success: true, fitoterapico: data });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

// ==================== PRESCRIÇÕES DE FITOTERÁPICOS (POR MÉDICO) ====================

/**
 * GET /cadastro-fitoterapicos/prescricoes
 */
export async function getFitoPrescricoes(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const favoritosOnly = req.query.favoritos === 'true';

    let query = supabase
      .from('cadastro_fitoterapico_prescricao')
      .select('*, cadastro_fitoterapicos(*)', { count: 'exact' })
      .eq('doctor_id', doctorId);

    if (search) {
      query = query.or(`descricao.ilike.%${search}%,dosagem.ilike.%${search}%,cadastro_fitoterapicos.nome.ilike.%${search}%`);
    }
    if (favoritosOnly) {
      query = query.eq('favorito', true);
    }

    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao buscar prescrições:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar prescrições' });
    }

    return res.json({
      success: true,
      prescricoes: data || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * GET /cadastro-fitoterapicos/prescricoes/:prescricaoId
 */
export async function getFitoPrescricaoById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { prescricaoId } = req.params;
    const { data, error } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .select('*, cadastro_fitoterapicos(*)')
      .eq('id', prescricaoId)
      .eq('doctor_id', doctorId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Prescrição não encontrada' });
    }

    return res.json({ success: true, prescricao: data });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-fitoterapicos/prescricoes
 */
export async function createFitoPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { fitoterapico_id, dosagem, horarios, descricao, tags, favorito } = req.body;
    if (!fitoterapico_id) {
      return res.status(400).json({ success: false, error: 'fitoterapico_id é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .insert({
        doctor_id: doctorId,
        fitoterapico_id,
        dosagem: dosagem || null,
        horarios: horarios || [],
        descricao: descricao || null,
        tags: tags || [],
        favorito: favorito || false,
      })
      .select('*, cadastro_fitoterapicos(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao criar prescrição:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar prescrição' });
    }

    return res.status(201).json({ success: true, prescricao: data });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PUT /cadastro-fitoterapicos/prescricoes/:prescricaoId
 */
export async function updateFitoPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { prescricaoId } = req.params;
    const { dosagem, horarios, descricao, tags, favorito } = req.body;

    const updateData: any = {};
    if (dosagem !== undefined) updateData.dosagem = dosagem;
    if (horarios !== undefined) updateData.horarios = horarios;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (tags !== undefined) updateData.tags = tags;
    if (favorito !== undefined) updateData.favorito = favorito;

    const { data, error } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .update(updateData)
      .eq('id', prescricaoId)
      .eq('doctor_id', doctorId)
      .select('*, cadastro_fitoterapicos(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao atualizar prescrição:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar prescrição' });
    }

    return res.json({ success: true, prescricao: data });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * DELETE /cadastro-fitoterapicos/prescricoes/:prescricaoId
 */
export async function deleteFitoPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { prescricaoId } = req.params;
    const { error } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .delete()
      .eq('id', prescricaoId)
      .eq('doctor_id', doctorId);

    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao deletar prescrição:', error);
      return res.status(500).json({ success: false, error: 'Erro ao deletar prescrição' });
    }

    return res.json({ success: true, message: 'Prescrição removida com sucesso' });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * PATCH /cadastro-fitoterapicos/prescricoes/:prescricaoId/favorito
 */
export async function toggleFavoritoFitoPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });
    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { prescricaoId } = req.params;
    const { data: prescricao } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .select('favorito')
      .eq('id', prescricaoId)
      .eq('doctor_id', doctorId)
      .single();

    if (!prescricao) {
      return res.status(404).json({ success: false, error: 'Prescrição não encontrada' });
    }

    const { data, error } = await supabase
      .from('cadastro_fitoterapico_prescricao')
      .update({ favorito: !prescricao.favorito })
      .eq('id', prescricaoId)
      .eq('doctor_id', doctorId)
      .select('*, cadastro_fitoterapicos(*)')
      .single();

    if (error) {
      console.error('[CADASTRO-FITOTERAPICOS] Erro ao toggle favorito:', error);
      return res.status(500).json({ success: false, error: 'Erro ao atualizar favorito' });
    }

    return res.json({ success: true, prescricao: data });
  } catch (err) {
    console.error('[CADASTRO-FITOTERAPICOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
