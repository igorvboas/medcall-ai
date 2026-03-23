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
 * GET /cadastro-alimentos
 * Lista alimentos do médico com busca
 */
export async function getAlimentos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';

    let query = supabase
      .from('cadastro_alimentos')
      .select('*', { count: 'exact' })
      .eq('doctor_id', doctorId);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,categoria.ilike.%${search}%`);
    }

    query = query.order('nome', { ascending: true });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[CADASTRO-ALIMENTOS] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar alimentos' });
    }

    return res.json({
      success: true,
      alimentos: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err) {
    console.error('[CADASTRO-ALIMENTOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /cadastro-alimentos
 * Cria um novo alimento
 */
export async function createAlimento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const doctorId = await getDoctorId(req.user.id);
    if (!doctorId) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { nome, categoria, descricao, porcao, calorias, proteinas, carboidratos, gorduras, fibras, favorito, tags } = req.body;

    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
    }

    const { data, error } = await supabase
      .from('cadastro_alimentos')
      .insert({
        doctor_id: doctorId,
        nome: nome.trim(),
        categoria: categoria || null,
        descricao: descricao || null,
        porcao: porcao || null,
        calorias: calorias || null,
        proteinas: proteinas || null,
        carboidratos: carboidratos || null,
        gorduras: gorduras || null,
        fibras: fibras || null,
        favorito: favorito || false,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[CADASTRO-ALIMENTOS] Erro ao criar:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar alimento' });
    }

    return res.status(201).json({ success: true, alimento: data });
  } catch (err) {
    console.error('[CADASTRO-ALIMENTOS] Erro:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
