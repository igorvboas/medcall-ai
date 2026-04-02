import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /admin/doctors/search
 * Busca médicos por nome ou email (admin only)
 */
export async function searchDoctors(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const userId = req.user.id;

    // Verificar se é admin
    const { data: adminCheck, error: adminError } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', userId)
      .single();

    if (adminError || !adminCheck?.admin) {
      return res.status(403).json({ success: false, error: 'Acesso negado - apenas administradores' });
    }

    const { search } = req.query;

    if (!search || (search as string).length < 2) {
      return res.json({ success: true, doctors: [] });
    }

    const searchTerm = search as string;

    const { data: doctors, error } = await supabase
      .from('medicos')
      .select('id, name, email')
      .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('name', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Erro ao buscar médicos:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar médicos' });
    }

    return res.json({
      success: true,
      doctors: doctors || []
    });
  } catch (error) {
    console.error('Erro no endpoint GET /admin/doctors/search:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
