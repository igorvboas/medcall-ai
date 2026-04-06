import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /consultations
 * Lista consultas do médico autenticado
 */
export async function getConsultations(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, admin')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado no sistema'
      });
    }

    // Parâmetros de consulta
    const {
      search,
      status,
      type: consultationType,
      dateFrom,
      dateTo,
      page = '1',
      limit = '20',
      doctor_id: queryDoctorId
    } = req.query;

    // Admin sem doctor_id → ver todas; admin com doctor_id → filtrar; não-admin → próprio id
    let effectiveDoctorId: string | null = medico.id;
    if (medico.admin === true) {
      effectiveDoctorId = queryDoctorId ? (queryDoctorId as string) : null;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let query = supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          profile_pic
        ),
        medicos:doctor_id (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Admin vê todas (incluindo deletadas e em gravação); não-admin tem restrições
    if (!medico.admin) {
      query = query
        .eq('deletado', false)
        .not('status', 'in', '("DELETED","AGENDAMENTO","RECORDING")');
    }

    if (effectiveDoctorId) {
      query = query.eq('doctor_id', effectiveDoctorId);
    }

    // Aplicar filtros
    if (search) {
      query = query.or(`patient_name.ilike.%${search}%,patient_context.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (consultationType) {
      query = query.eq('consultation_type', consultationType);
    }

    // Aplicar filtro de intervalo de data
    if (dateFrom) {
      const from = new Date(dateFrom as string);
      from.setHours(0, 0, 0, 0);
      query = query.gte('created_at', from.toISOString());
    }
    if (dateTo) {
      const to = new Date(dateTo as string);
      to.setHours(23, 59, 59, 999);
      query = query.lte('created_at', to.toISOString());
    }
    // Paginação
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    query = query.range(from, to);

    const { data: consultations, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar consultas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar consultas'
      });
    }

    // Usar o nome atualizado de patients.name e adicionar doctor_name
    const enrichedConsultations = (consultations || []).map((c: any) => ({
      ...c,
      patient_name: c.patients?.name || c.patient_name,
      doctor_name: c.medicos?.name || null,
      doctor_email: c.medicos?.email || null,
    }));

    return res.json({
      success: true,
      consultations: enrichedConsultations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /consultations:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /consultations/:id
 * Busca detalhes de uma consulta específica
 */
export async function getConsultationById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, admin')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Buscar consulta
    let query = supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          profile_pic
        )
      `)
      .eq('id', id);

    // Admin pode ver consultas de qualquer médico
    if (medico.admin !== true) {
      query = query.eq('doctor_id', medico.id);
    }

    const { data: consultation, error } = await query.single();

    if (error || !consultation) {
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // Usar o nome atualizado de patients.name se disponível
    const result = {
      ...consultation,
      patient_name: (consultation as any).patients?.name || consultation.patient_name,
    };

    return res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Erro ao buscar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * PATCH /consultations/:id
 * Atualiza uma consulta
 */
export async function updateConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    const doctorAuthId = req.user.id;

    console.log('📝 [UPDATE CONSULTATION] Iniciando atualização:', {
      consultationId: id,
      updateData,
      doctorAuthId
    });

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, admin')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      console.error('❌ [UPDATE CONSULTATION] Médico não encontrado:', {
        doctorAuthId,
        error: medicoError
      });
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    console.log('✅ [UPDATE CONSULTATION] Médico encontrado:', medico.id);

    // Verificar se a consulta existe antes de atualizar
    const { data: existingConsultation, error: checkError } = await supabase
      .from('consultations')
      .select('id, doctor_id, status')
      .eq('id', id)
      .single();

    if (checkError || !existingConsultation) {
      console.error('Erro ao verificar consulta:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // Verificar permissão: admin pode editar qualquer consulta; não-admin só as suas
    if (!medico.admin && existingConsultation.doctor_id !== medico.id) {
      console.error('Tentativa de atualizar consulta de outro médico:', {
        consultationDoctorId: existingConsultation.doctor_id,
        currentMedicoId: medico.id
      });
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para atualizar esta consulta'
      });
    }

    // ✅ REQ 4: Se o status estiver sendo atualizado para COMPLETED, salvar transcrição e marcar como finalizada
    if (updateData.status === 'COMPLETED') {
      updateData.consulta_finalizada = true;
      try {
        const { data: transcriptionData, error: transError } = await supabase
          .from('transcriptions')
          .select('raw_text')
          .eq('consultation_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (transcriptionData && transcriptionData.raw_text) {
          updateData.transcricao = transcriptionData.raw_text;
          // Garantir que consulta_fim seja setado se não estiver no payload
          if (!updateData.consulta_fim) {
            updateData.consulta_fim = new Date().toISOString();
          }
          console.log(`📝 [UPDATE-CONSULTATION] Transcrição final anexada para consulta ${id}`);
        }
      } catch (e) {
        console.warn(`⚠️ [UPDATE-CONSULTATION] Erro ao buscar transcrição final: ${e}`);
      }
    }

    // Garantir consulta_finalizada = true se estiver sendo passado no payload
    if (updateData.consulta_finalizada === true && !updateData.consulta_fim) {
      updateData.consulta_fim = new Date().toISOString();
    }

    // Atualizar consulta
    let updateQuery = supabase
      .from('consultations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Admin pode atualizar qualquer consulta; não-admin só as suas
    if (!medico.admin) {
      updateQuery = updateQuery.eq('doctor_id', medico.id);
    }

    const { data: consultation, error } = await updateQuery.select().single();

    if (error) {
      console.error('Erro ao atualizar consulta no Supabase:', {
        error,
        consultationId: id,
        updateData,
        medicoId: medico.id
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar consulta'
      });
    }

    if (!consultation) {
      console.error('Consulta não retornada após atualização:', {
        consultationId: id,
        medicoId: medico.id
      });
      return res.status(500).json({
        success: false,
        error: 'Consulta não foi atualizada'
      });
    }

    return res.json({
      success: true,
      ...consultation
    });

  } catch (error) {
    console.error('Erro ao atualizar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * DELETE /consultations/:id
 * Deleta uma consulta
 */
import { deleteCalendarEventInternal } from './googleCalendarController';

/**
 * DELETE /consultations/:id
 * Deleta uma consulta
 */
export async function deleteConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, admin')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // 🔍 Buscar consulta antes de deletar para verificar se tem evento no Google Calendar
    let consultaQuery = supabase
      .from('consultations')
      .select('id, google_event_id')
      .eq('id', id);

    // Admin pode deletar qualquer consulta; não-admin só as suas
    if (!medico.admin) {
      consultaQuery = consultaQuery.eq('doctor_id', medico.id);
    }

    const { data: consulta, error: consultaError } = await consultaQuery.single();

    if (consultaError || !consulta) {
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // 📅 Se tiver evento no Google, tentar remover
    if (consulta.google_event_id && consulta.google_event_id.length > 5) {
      console.log(`🗑️ Removendo evento do Google Calendar: ${consulta.google_event_id}`);
      // Não aguardar o resultado bloquear a deleção, mas rodar em background seria melhor
      // Como é uma operação crítica, vamos aguardar (fast enough)
      const deleted = await deleteCalendarEventInternal(doctorAuthId, consulta.google_event_id);
      if (deleted) {
        console.log('✅ Evento removido do Google Calendar com sucesso');
      } else {
        console.warn('⚠️ Falha ao remover evento do Google Calendar (pode já ter sido removido ou erro de token)');
      }
    }

    // Soft delete: marcar status como DELETED (e deletado=true para retrocompatibilidade)
    let updateQuery = supabase
      .from('consultations')
      .update({ status: 'DELETED', deletado: true })
      .eq('id', id);

    if (!medico.admin) {
      updateQuery = updateQuery.eq('doctor_id', medico.id);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('Erro ao deletar consulta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar consulta'
      });
    }

    return res.json({
      success: true,
      message: 'Consulta deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3002';

/**
 * POST /consultations/:id/finalize-remote
 * Finaliza a consulta remotamente (mesmo fluxo do botão "Finalizar" na sala):
 * busca room_id da call_sessions, chama o realtime para finalizar sala (salvar transcrições, webhook)
 * Usado pelo popup "Consulta em Andamento" quando o médico clica em Finalizar fora da sala.
 */
export async function finalizeConsultationRemote(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { id: consultationId } = req.params;
    const doctorAuthId = req.user.id;

    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select('id')
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (consultationError || !consultation) {
      return res.status(404).json({ success: false, error: 'Consulta não encontrada' });
    }

    const { data: callSession, error: sessionError } = await supabase
      .from('call_sessions')
      .select('room_id')
      .eq('consultation_id', consultationId)
      .maybeSingle();

    if (sessionError || !callSession?.room_id) {
      return res.status(400).json({
        success: false,
        error: 'Sala não encontrada para esta consulta. A consulta pode já ter sido finalizada ou a sala não está ativa.'
      });
    }

    const roomId = callSession.room_id;
    const url = `${REALTIME_SERVICE_URL.replace(/\/$/, '')}/api/rooms/finalize/${roomId}`;

    console.log(`📤 [GATEWAY] Chamando realtime para finalizar sala ${roomId} (consulta ${consultationId})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      console.warn(`⚠️ [GATEWAY] Realtime finalize retornou ${response.status}:`, data);
      return res.status(response.status).json({
        success: false,
        error: data?.error ?? 'Erro ao finalizar sala no serviço de tempo real'
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Erro ao finalizar consulta remotamente:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}

/**
 * POST /consultations/:id/finalize-direct
 * Fallback de finalização: atualiza status para PROCESSING e envia webhook de transcrição.
 * Usado quando finalize-remote falha (ex: consulta presencial sem sala ativa).
 */
export async function finalizeConsultationDirect(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { id: consultationId } = req.params;
    const { finalizado_por } = req.body || {};
    const doctorAuthId = req.user.id;

    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, admin')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    let consultaQuery = supabase
      .from('consultations')
      .select('id, doctor_id, patient_id, consultation_type')
      .eq('id', consultationId);

    // Admin pode finalizar qualquer consulta; não-admin só as suas
    if (!medico.admin) {
      consultaQuery = consultaQuery.eq('doctor_id', medico.id);
    }

    const { data: consultation, error: consultationError } = await consultaQuery.single();

    if (consultationError || !consultation) {
      return res.status(404).json({ success: false, error: 'Consulta não encontrada' });
    }

    // Atualizar status para PROCESSING
    const { error: updateError } = await supabase
      .from('consultations')
      .update({
        status: 'PROCESSING',
        consulta_finalizada: true,
        consulta_fim: new Date().toISOString(),
      })
      .eq('id', consultationId);

    if (updateError) {
      return res.status(500).json({ success: false, error: 'Erro ao atualizar consulta' });
    }

    // Atualizar call_sessions.status para 'ended'
    await supabase
      .from('call_sessions')
      .update({ status: 'ended' })
      .eq('consultation_id', consultationId);

    // Buscar transcrição existente (pode estar vazia para presencial)
    const { data: transcription } = await supabase
      .from('transcriptions')
      .select('raw_text')
      .eq('consultation_id', consultationId)
      .maybeSingle();

    // Enviar webhook de transcrição
    const nodeEnv = process.env.NODE_ENV || 'production';
    const isHomolog = nodeEnv === 'homolog';
    const webhookUrl = isHomolog
      ? 'https://triahook.gst.dev.br/webhook/usi-analise-homolog'
      : 'https://triahook.gst.dev.br/webhook/usi-analise-v2';

    const webhookPayload: Record<string, unknown> = {
      consultationId,
      doctorId: consultation.doctor_id,
      patientId: consultation.patient_id,
      transcription: transcription?.raw_text || '',
      consulta_finalizada: true,
      paciente_entrou_sala: false,
      tipo_consulta: consultation.consultation_type || 'PRESENCIAL',
      env: nodeEnv,
    };

    if (finalizado_por) {
      webhookPayload.finalizado_por = finalizado_por;
    }

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WEBHOOK_AUTH_HEADER || '',
      },
      body: JSON.stringify(webhookPayload),
    }).catch((err) => {
      console.error('[FINALIZE-DIRECT] Webhook falhou:', err);
    });

    console.log(`✅ [FINALIZE-DIRECT] Consulta ${consultationId} finalizada e webhook disparado`);

    return res.json({ success: true, message: 'Consulta finalizada e webhook disparado' });
  } catch (error) {
    console.error('Erro ao finalizar consulta diretamente:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    });
  }
}

/**
 * POST /consultations/schedule
 * Cria um agendamento de consulta com verificação de conflito de horário
 */
export async function createScheduledConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { patient_id, patient_name, consultation_type, scheduled_date, duration_minutes = 60, andamento } = req.body;
    const doctorAuthId = req.user.id;

    if (!patient_id || !scheduled_date) {
      return res.status(400).json({ success: false, error: 'Dados incompletos para agendamento' });
    }

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const doctorId = medico.id;
    const startTime = new Date(scheduled_date);
    const endTime = new Date(startTime.getTime() + duration_minutes * 60000);

    // 🔍 Verificar conflitos de horário
    // Intervalo [start, end]
    // Conflito se: (existing.start < new.end) AND (existing.end > new.start)
    // E status não é cancelado/arquivado
    const { data: conflicts, error: conflictError } = await supabase
      .from('consultations')
      .select('id, consulta_inicio, consulta_fim, status')
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .neq('status', 'archived')
      .lt('consulta_inicio', endTime.toISOString())
      .gt('consulta_fim', startTime.toISOString());

    if (conflictError) {
      console.error('Erro ao verificar conflitos:', conflictError);
      return res.status(500).json({ success: false, error: 'Erro ao verificar disponibilidade' });
    }

    if (conflicts && conflicts.length > 0) {
      console.warn(`⚠️ Conflito de horário detectado para médico ${doctorId}:`, conflicts);
      return res.status(409).json({
        success: false,
        error: 'Este horário já está ocupado por outra consulta.',
        conflicts
      });
    }

    // ✅ Determinar "from" baseado na URL de origem
    let consultationFrom: string | null = null;
    const origin = (req.headers.origin || req.headers.referer || '') as string;
    if (origin.includes('medcall-ai-frontend-v2.vercel.app')) {
      consultationFrom = 'medcall';
    } else if (origin.includes('autonhealth.com.br')) {
      consultationFrom = 'auton';
    } else if (origin.includes('localhost')) {
      consultationFrom = 'localhost';
    }

    // ✅ Sem conflitos, criar agendamento
    const { data: newConsultation, error: createError } = await supabase
      .from('consultations')
      .insert({
        patient_id,
        patient_name,
        consultation_type: consultation_type === 'online' ? 'TELEMEDICINA' : 'PRESENCIAL',
        status: 'AGENDAMENTO',
        consulta_inicio: startTime.toISOString(),
        consulta_fim: endTime.toISOString(),
        doctor_id: doctorId,
        from: consultationFrom,
        andamento: andamento || 'NOVA',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar agendamento:', createError);
      return res.status(500).json({ success: false, error: 'Erro ao criar agendamento' });
    }

    return res.status(201).json({
      success: true,
      consultation: newConsultation
    });

  } catch (error) {
    console.error('Erro ao agendar consulta:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}
