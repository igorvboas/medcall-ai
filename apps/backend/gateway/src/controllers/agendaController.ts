import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /agenda
 * Busca consultas agendadas por ano e mês
 */
export async function getAgenda(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: 'year e month são obrigatórios'
      });
    }

    // Buscar o ID do médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Buscar consultas do mês (calcular último dia corretamente)
    const y = Number(year);
    const m = Number(month);
    const lastDay = new Date(y, m, 0).getDate(); // último dia do mês
    const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`;

    const selectFields = `id, patient_name, patient_id, consultation_type, status, duration, created_at, consulta_inicio, consulta_fim`;

    // Buscar em paralelo: por consulta_inicio e por created_at (sem consulta_inicio)
    const [byInicio, byCreated] = await Promise.all([
      supabase.from('consultations').select(selectFields)
        .eq('doctor_id', medico.id)
        .not('consulta_inicio', 'is', null)
        .neq('status', 'DELETED')
        .gte('consulta_inicio', startDate)
        .lte('consulta_inicio', endDate)
        .order('consulta_inicio', { ascending: true }),
      supabase.from('consultations').select(selectFields)
        .eq('doctor_id', medico.id)
        .is('consulta_inicio', null)
        .neq('status', 'DELETED')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true }),
    ]);

    const error = byInicio.error || byCreated.error;
    // Merge e deduplicar
    const allConsultations = [...(byInicio.data || []), ...(byCreated.data || [])];
    const seen = new Set<string>();
    const consultations = allConsultations.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

    if (error) {
      console.error('Erro ao buscar agenda:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar agenda'
      });
    }

    // Mapear para formato esperado pelo frontend
    const items = (consultations || []).map(c => ({
      id: c.id,
      patient: c.patient_name,
      patient_id: c.patient_id,
      consultation_type: c.consultation_type,
      status: c.status,
      duration: c.duration,
      created_at: c.created_at,
      consulta_inicio: c.consulta_inicio,
      consulta_fim: c.consulta_fim
    }));

    return res.json({
      success: true,
      ok: true, // Para compatibilidade com código antigo
      items
    });

  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
