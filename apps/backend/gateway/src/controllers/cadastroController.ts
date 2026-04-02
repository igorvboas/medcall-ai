import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

const TABLE_MAP: Record<string, string> = {
  alimentos: 'cadastro_alimentos',
  refeicoes: 'cadastro_refeicoes',
  treinos: 'cadastro_treinos',
  suplementos: 'cadastro_suplementos',
  fitoterapicos: 'cadastro_fitoterapicos',
};

// Tabelas de catalogo global (sem doctor_id)
const GLOBAL_TABLES = ['cadastro_suplementos', 'cadastro_fitoterapicos'];

async function getDoctorId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', userId)
    .single();
  return data?.id || null;
}

/**
 * GET /cadastro/:tipo
 */
export async function listItems(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo } = req.params;
    const table = TABLE_MAP[tipo];
    if (!table) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const search = (req.query.search as string) || '';
    const favorito = req.query.favorito === 'true';
    const categoria = (req.query.categoria as string) || '';
    const tipoSuplemento = (req.query.tipo_suplemento as string) || '';

    const isGlobal = GLOBAL_TABLES.includes(table);

    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (!isGlobal) {
      query = query.eq('doctor_id', doctorId);
    }

    if (search) {
      query = query.or(`nome.ilike.%${search}%,descricao.ilike.%${search}%`);
    }
    if (favorito) {
      query = query.eq('favorito', true);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }
    if (tipoSuplemento && tipo === 'suplementos') {
      query = query.eq('tipo', tipoSuplemento);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Para refeicoes, buscar os alimentos de cada uma
    if (tipo === 'refeicoes' && data) {
      const refeicaoIds = data.map((r: any) => r.id);
      if (refeicaoIds.length > 0) {
        const { data: relacoes } = await supabase
          .from('cadastro_refeicao_alimentos')
          .select('*, alimento:cadastro_alimentos(*)')
          .in('refeicao_id', refeicaoIds)
          .order('ordem', { ascending: true });

        const alimentosByRefeicao: Record<string, any[]> = {};
        (relacoes || []).forEach((r: any) => {
          if (!alimentosByRefeicao[r.refeicao_id]) alimentosByRefeicao[r.refeicao_id] = [];
          alimentosByRefeicao[r.refeicao_id].push(r);
        });

        data.forEach((ref: any) => {
          ref.alimentos = alimentosByRefeicao[ref.id] || [];
        });
      }
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[CADASTRO] listItems error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /cadastro/:tipo
 */
export async function createItem(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo } = req.params;
    const table = TABLE_MAP[tipo];
    if (!table) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const { alimento_ids, ...itemData } = req.body;

    if (!itemData.nome) {
      return res.status(400).json({ success: false, error: 'Nome e obrigatorio' });
    }

    const isGlobal = GLOBAL_TABLES.includes(table);
    const insertData = isGlobal ? { ...itemData } : { ...itemData, doctor_id: doctorId };

    const { data, error } = await supabase
      .from(table)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Se for refeicao e tiver alimentos, criar relacoes
    if (tipo === 'refeicoes' && alimento_ids && Array.isArray(alimento_ids) && data) {
      const relacoes = alimento_ids.map((aid: string, idx: number) => ({
        refeicao_id: data.id,
        alimento_id: aid,
        ordem: idx,
      }));
      await supabase.from('cadastro_refeicao_alimentos').insert(relacoes);
    }

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('[CADASTRO] createItem error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /cadastro/:tipo/:id
 */
export async function updateItem(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const table = TABLE_MAP[tipo];
    if (!table) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const isGlobal = GLOBAL_TABLES.includes(table);
    const { alimento_ids, ...updateData } = req.body;
    delete updateData.id;
    delete updateData.doctor_id;
    delete updateData.created_at;

    let updateQuery = supabase
      .from(table)
      .update(updateData)
      .eq('id', id);

    if (!isGlobal) {
      updateQuery = updateQuery.eq('doctor_id', doctorId);
    }

    const { data, error } = await updateQuery.select().single();

    if (error) throw error;

    // Se for refeicao e tiver alimentos, atualizar relacoes
    if (tipo === 'refeicoes' && alimento_ids && Array.isArray(alimento_ids)) {
      // Remover relacoes antigas
      await supabase.from('cadastro_refeicao_alimentos').delete().eq('refeicao_id', id);
      // Criar novas
      const relacoes = alimento_ids.map((aid: string, idx: number) => ({
        refeicao_id: id,
        alimento_id: aid,
        ordem: idx,
      }));
      if (relacoes.length > 0) {
        await supabase.from('cadastro_refeicao_alimentos').insert(relacoes);
      }
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[CADASTRO] updateItem error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /cadastro/:tipo/:id
 */
export async function deleteItem(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const table = TABLE_MAP[tipo];
    if (!table) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const isGlobal = GLOBAL_TABLES.includes(table);
    let deleteQuery = supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (!isGlobal) {
      deleteQuery = deleteQuery.eq('doctor_id', doctorId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[CADASTRO] deleteItem error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /cadastro/:tipo/:id/favorito
 */
export async function toggleFavorito(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const table = TABLE_MAP[tipo];
    if (!table) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const isGlobal = GLOBAL_TABLES.includes(table);

    // Buscar valor atual
    let selectQuery = supabase
      .from(table)
      .select('favorito')
      .eq('id', id);
    if (!isGlobal) selectQuery = selectQuery.eq('doctor_id', doctorId);
    const { data: current } = await selectQuery.single();

    if (!current) return res.status(404).json({ success: false, error: 'Item nao encontrado' });

    let updateQuery = supabase
      .from(table)
      .update({ favorito: !current.favorito })
      .eq('id', id);
    if (!isGlobal) updateQuery = updateQuery.eq('doctor_id', doctorId);
    const { data, error } = await updateQuery.select().single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[CADASTRO] toggleFavorito error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /cadastro/refeicoes/:id/alimentos
 */
export async function addAlimentoToRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { id } = req.params;
    const { alimento_id, porcao_customizada, observacao } = req.body;

    if (!alimento_id) return res.status(400).json({ success: false, error: 'alimento_id obrigatorio' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    // Verificar que a refeicao pertence ao medico
    const { data: ref } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!ref) return res.status(404).json({ success: false, error: 'Refeicao nao encontrada' });

    // Pegar a maior ordem atual
    const { data: maxOrdem } = await supabase
      .from('cadastro_refeicao_alimentos')
      .select('ordem')
      .eq('refeicao_id', id)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('cadastro_refeicao_alimentos')
      .insert({
        refeicao_id: id,
        alimento_id,
        porcao_customizada,
        observacao,
        ordem: (maxOrdem?.ordem || 0) + 1,
      })
      .select('*, alimento:cadastro_alimentos(*)')
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('[CADASTRO] addAlimentoToRefeicao error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /cadastro/refeicoes/:id/alimentos/:alimentoRelId
 */
export async function removeAlimentoFromRefeicao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { id, alimentoRelId } = req.params;

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    // Verificar que a refeicao pertence ao medico
    const { data: ref } = await supabase
      .from('cadastro_refeicoes')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!ref) return res.status(404).json({ success: false, error: 'Refeicao nao encontrada' });

    const { error } = await supabase
      .from('cadastro_refeicao_alimentos')
      .delete()
      .eq('id', alimentoRelId)
      .eq('refeicao_id', id);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[CADASTRO] removeAlimentoFromRefeicao error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
