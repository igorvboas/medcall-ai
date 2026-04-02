import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DoctorFunnel {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  crm: string | null;
  created_at: string;
  // Funnel steps
  liberado_plataforma: boolean;
  notificado_whatsapp: boolean;
  criou_conta: boolean;
  verificou_email: boolean;
  fez_login: boolean;
  primeira_consulta_iniciada: boolean;
  primeira_consulta_finalizada: boolean;
  // Extra details
  data_liberacao: string | null;
  data_criacao_conta: string | null;
  data_verificacao_email: string | null;
  data_primeiro_login: string | null;
  data_primeira_consulta: string | null;
  data_consulta_finalizada: string | null;
}

/**
 * GET /admin/doctor-tracking
 * Returns the doctor lead funnel tracking data
 */
export const getDoctorTracking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verify admin access
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin, clinica_id')
      .eq('user_auth', userId)
      .single();

    if (medicoError || !medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
    }

    // 1. Get all subscriptions (leads released on platform)
    const { data: assinaturas, error: assinaturasError } = await supabase
      .from('assinaturas')
      .select('doctor_id, email, created_at, assinatura_ativa')
      .order('created_at', { ascending: false });

    if (assinaturasError) {
      console.error('[DoctorTracking] Erro ao buscar assinaturas:', assinaturasError);
      return res.status(500).json({ error: 'Erro ao buscar assinaturas' });
    }

    // 2. Get all doctors (to check account creation)
    const { data: medicos, error: medicosError2 } = await supabase
      .from('medicos')
      .select('id, email, name, phone, specialty, crm, user_auth, created_at, is_doctor');

    if (medicosError2) {
      console.error('[DoctorTracking] Erro ao buscar médicos:', medicosError2);
      return res.status(500).json({ error: 'Erro ao buscar médicos' });
    }

    // 3. Get auth.users to check email confirmation status
    const emailConfirmedByUserId: Record<string, string | null> = {};
    try {
      // Paginate through all auth users (listUsers returns max 1000 per page)
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (authError) {
          console.error('[DoctorTracking] Erro ao buscar auth.users:', authError);
          break;
        }
        users.forEach((u) => {
          // Check both email_confirmed_at and confirmed_at (OAuth users use confirmed_at)
          emailConfirmedByUserId[u.id] = u.email_confirmed_at || u.confirmed_at || null;
        });
        hasMore = users.length === 1000;
        page++;
      }
    } catch (err) {
      console.error('[DoctorTracking] Erro ao listar auth users:', err);
      // Non-fatal: continue without email verification data
    }

    // 4. Get login audit logs (to check if doctor logged in)
    const { data: loginLogs, error: loginLogsError } = await supabase
      .from('audit_logs')
      .select('user_id, user_email, created_at')
      .eq('action', 'LOGIN')
      .eq('success', true)
      .order('created_at', { ascending: true });

    if (loginLogsError) {
      console.error('[DoctorTracking] Erro ao buscar audit_logs:', loginLogsError);
      // Non-fatal: continue without login data
    }

    // Build a map of user_id/email -> first login date
    const firstLoginByUserId: Record<string, string> = {};
    const firstLoginByEmail: Record<string, string> = {};
    loginLogs?.forEach((log) => {
      if (log.user_id && !firstLoginByUserId[log.user_id]) {
        firstLoginByUserId[log.user_id] = log.created_at;
      }
      if (log.user_email) {
        const email = log.user_email.toLowerCase();
        if (!firstLoginByEmail[email]) {
          firstLoginByEmail[email] = log.created_at;
        }
      }
    });

    // 5. Get first consultations per doctor
    const { data: consultations, error: consultationsError } = await supabase
      .from('consultations')
      .select('doctor_id, status, created_at, consulta_inicio')
      .order('created_at', { ascending: true });

    if (consultationsError) {
      console.error('[DoctorTracking] Erro ao buscar consultas:', consultationsError);
      return res.status(500).json({ error: 'Erro ao buscar consultas' });
    }

    // Build a map of doctor_id -> first consultation info
    const doctorFirstConsultation: Record<string, { started: string | null; completed: string | null }> = {};
    consultations?.forEach((c) => {
      if (!doctorFirstConsultation[c.doctor_id]) {
        doctorFirstConsultation[c.doctor_id] = { started: null, completed: null };
      }
      // First consultation started
      if (!doctorFirstConsultation[c.doctor_id].started) {
        doctorFirstConsultation[c.doctor_id].started = c.consulta_inicio || c.created_at;
      }
      // First consultation completed
      if (!doctorFirstConsultation[c.doctor_id].completed && c.status === 'COMPLETED') {
        doctorFirstConsultation[c.doctor_id].completed = c.created_at;
      }
    });

    // Build a map of email -> medico
    const medicosByEmail: Record<string, typeof medicos[0]> = {};
    const medicosById: Record<string, typeof medicos[0]> = {};
    medicos?.forEach((m) => {
      if (m.email) medicosByEmail[m.email.toLowerCase()] = m;
      medicosById[m.id] = m;
    });

    // Build the funnel data
    // Start from assinaturas as the source of truth for "released leads"
    const funnelData: DoctorFunnel[] = [];
    const processedEmails = new Set<string>();

    assinaturas?.forEach((a) => {
      const email = (a.email || '').toLowerCase();
      if (!email || processedEmails.has(email)) return;
      processedEmails.add(email);

      const medicoRecord = medicosByEmail[email];
      const doctorId = a.doctor_id || medicoRecord?.id;
      const consultationInfo = doctorId ? doctorFirstConsultation[doctorId] : null;

      const criouConta = !!medicoRecord?.user_auth;

      // Check email verification via auth.users
      const userAuthId = medicoRecord?.user_auth;
      const emailConfirmedAt = userAuthId ? emailConfirmedByUserId[userAuthId] : null;
      const verificouEmail = !!emailConfirmedAt;

      // Check login: look up by user_auth (user_id) or by email
      const firstLoginDate = (userAuthId && firstLoginByUserId[userAuthId])
        || firstLoginByEmail[email]
        || null;
      const fezLogin = !!firstLoginDate;

      funnelData.push({
        id: doctorId || email,
        name: medicoRecord?.name || email.split('@')[0],
        email,
        phone: medicoRecord?.phone || null,
        specialty: medicoRecord?.specialty || null,
        crm: medicoRecord?.crm || null,
        created_at: a.created_at,
        // Funnel steps
        liberado_plataforma: true, // If in assinaturas, they were released
        notificado_whatsapp: true, // Hardcoded true for now
        criou_conta: criouConta,
        verificou_email: verificouEmail,
        fez_login: fezLogin,
        primeira_consulta_iniciada: !!consultationInfo?.started,
        primeira_consulta_finalizada: !!consultationInfo?.completed,
        // Dates
        data_liberacao: a.created_at,
        data_criacao_conta: criouConta ? medicoRecord!.created_at : null,
        data_verificacao_email: emailConfirmedAt || null,
        data_primeiro_login: firstLoginDate,
        data_primeira_consulta: consultationInfo?.started || null,
        data_consulta_finalizada: consultationInfo?.completed || null,
      });
    });

    // Funnel summary counts
    const summary = {
      total_liberados: funnelData.length,
      total_notificados: funnelData.filter((d) => d.notificado_whatsapp).length,
      total_criaram_conta: funnelData.filter((d) => d.criou_conta).length,
      total_verificaram_email: funnelData.filter((d) => d.verificou_email).length,
      total_fizeram_login: funnelData.filter((d) => d.fez_login).length,
      total_primeira_consulta: funnelData.filter((d) => d.primeira_consulta_iniciada).length,
      total_consulta_finalizada: funnelData.filter((d) => d.primeira_consulta_finalizada).length,
    };

    return res.json({
      summary,
      doctors: funnelData,
    });
  } catch (error) {
    console.error('[DoctorTracking] Erro:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados de acompanhamento',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};
