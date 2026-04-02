import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

async function getDoctorId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', userId)
    .single();
  return data?.id || null;
}

const PRESCRICAO_MAP: Record<string, { table: string; catalogTable: string; fkField: string }> = {
  suplementos: {
    table: 'cadastro_suplemento_prescricao',
    catalogTable: 'cadastro_suplementos',
    fkField: 'suplemento_id',
  },
  fitoterapicos: {
    table: 'cadastro_fitoterapico_prescricao',
    catalogTable: 'cadastro_fitoterapicos',
    fkField: 'fitoterapico_id',
  },
};

/**
 * GET /cadastro-prescricoes/:tipo
 * Lista prescricoes do medico com dados do catalogo
 */
export async function listPrescricoes(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo } = req.params;
    const config = PRESCRICAO_MAP[tipo];
    if (!config) return res.status(400).json({ success: false, error: 'Tipo invalido. Use: suplementos ou fitoterapicos' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const search = (req.query.search as string) || '';
    const favorito = req.query.favorito === 'true';

    // Buscar prescricoes com join no catalogo
    let query = supabase
      .from(config.table)
      .select(`*, catalogo:${config.catalogTable}(*)`)
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (favorito) {
      query = query.eq('favorito', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filtrar por search (no nome do catalogo ou descricao da prescricao)
    let filtered = data || [];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.catalogo?.nome?.toLowerCase().includes(s) ||
        p.descricao?.toLowerCase().includes(s) ||
        p.dosagem?.toLowerCase().includes(s)
      );
    }

    return res.json({ success: true, data: filtered });
  } catch (err: any) {
    console.error('[PRESCRICOES] listPrescricoes error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /cadastro-prescricoes/:tipo
 * Criar prescricao vinculada a um item do catalogo
 */
export async function createPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo } = req.params;
    const config = PRESCRICAO_MAP[tipo];
    if (!config) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const { catalogo_id, dosagem, horarios, descricao, tags } = req.body;

    if (!catalogo_id) {
      return res.status(400).json({ success: false, error: 'catalogo_id e obrigatorio' });
    }

    const insertData: any = {
      doctor_id: doctorId,
      [config.fkField]: catalogo_id,
      dosagem: dosagem || '',
      horarios: horarios || [],
      descricao: descricao || '',
      tags: tags || [],
      favorito: false,
    };

    const { data, error } = await supabase
      .from(config.table)
      .insert(insertData)
      .select(`*, catalogo:${config.catalogTable}(*)`)
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('[PRESCRICOES] createPrescricao error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /cadastro-prescricoes/:tipo/:id
 */
export async function updatePrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const config = PRESCRICAO_MAP[tipo];
    if (!config) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.doctor_id;
    delete updateData.created_at;
    delete updateData.catalogo;

    const { data, error } = await supabase
      .from(config.table)
      .update(updateData)
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select(`*, catalogo:${config.catalogTable}(*)`)
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[PRESCRICOES] updatePrescricao error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /cadastro-prescricoes/:tipo/:id
 */
export async function deletePrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const config = PRESCRICAO_MAP[tipo];
    if (!config) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const { error } = await supabase
      .from(config.table)
      .delete()
      .eq('id', id)
      .eq('doctor_id', doctorId);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[PRESCRICOES] deletePrescricao error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /cadastro-prescricoes/:tipo/:id/favorito
 */
export async function toggleFavoritoPrescricao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Nao autorizado' });

    const { tipo, id } = req.params;
    const config = PRESCRICAO_MAP[tipo];
    if (!config) return res.status(400).json({ success: false, error: 'Tipo invalido' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Medico nao encontrado' });

    const { data: current } = await supabase
      .from(config.table)
      .select('favorito')
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .single();

    if (!current) return res.status(404).json({ success: false, error: 'Prescricao nao encontrada' });

    const { data, error } = await supabase
      .from(config.table)
      .update({ favorito: !current.favorito })
      .eq('id', id)
      .eq('doctor_id', doctorId)
      .select(`*, catalogo:${config.catalogTable}(*)`)
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[PRESCRICOES] toggleFavorito error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
