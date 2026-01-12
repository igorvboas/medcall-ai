import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { syncConsultationToGoogleCalendar } from '@/lib/google-calendar-service';
import { logAudit, getAuditContext, sanitizeData } from '@/lib/audit-helper';

// GET /api/consultations - Listar consultas do médico logado
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/consultations ===');

    const authResult = await getAuthenticatedSession();

    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;

    // Buscar médico na tabela medicos usando a FK do auth.users
    // Retry logic para lidar com timeouts temporários
    let medico = null;
    let medicoError = null;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await supabase
        .from('medicos')
        .select('id')
        .eq('user_auth', doctorAuthId)
        .single();
      
      medico = result.data;
      medicoError = result.error;
      
      // Se sucesso ou erro não relacionado a timeout, parar
      if (!medicoError || (!medicoError.message?.includes('timeout') && !medicoError.message?.includes('upstream connect error'))) {
        break;
      }
      
      // Aguardar antes de tentar novamente (apenas se não for a última tentativa)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    if (medicoError || !medico) {
      // Log apenas se não for timeout (para reduzir spam)
      if (!medicoError?.message?.includes('timeout') && !medicoError?.message?.includes('upstream connect error')) {
        console.error('❌ Médico não encontrado:', medicoError);
      }
      
      // Retornar erro apropriado baseado no tipo
      if (medicoError?.message?.includes('timeout') || medicoError?.message?.includes('upstream connect error')) {
        return NextResponse.json(
          { error: 'Erro de conexão com o servidor. Tente novamente em alguns instantes.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status') as 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'COMPLETED' | 'ERROR' | 'CANCELLED' | 'AGENDAMENTO' | null;
    const consultationType = searchParams.get('type') as 'PRESENCIAL' | 'TELEMEDICINA' | null;
    const dateFilter = searchParams.get('dateFilter') as 'day' | 'week' | 'month' | null;
    const date = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

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
      `, { count: 'exact' })
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false });

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

    // Aplicar filtro de data
    if (dateFilter && date) {
      const selectedDate = new Date(date);

      if (dateFilter === 'day') {
        // Filtrar por dia específico
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      } else if (dateFilter === 'week') {
        // Filtrar por semana (segunda a domingo da semana selecionada)
        const dayOfWeek = selectedDate.getDay();
        // Calcular diferença para segunda-feira (0 = domingo, 1 = segunda, etc)
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() + diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfWeek.toISOString())
          .lte('created_at', endOfWeek.toISOString());
      } else if (dateFilter === 'month') {
        // Filtrar por mês
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString());
      }
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: consultations, error, count } = await query;

    if (error) {
      // Log apenas se não for timeout (para reduzir spam)
      if (!error.message?.includes('timeout') && !error.message?.includes('upstream connect error')) {
        console.error('Erro ao buscar consultas:', error);
      }
      
      // Retornar erro apropriado baseado no tipo
      if (error.message?.includes('timeout') || error.message?.includes('upstream connect error')) {
        return NextResponse.json(
          { error: 'Erro de conexão com o servidor. Tente novamente em alguns instantes.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Erro ao buscar consultas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      consultations: consultations || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/consultations:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/consultations - Criar nova consulta
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/consultations ===');

    const authResult = await getAuthenticatedSession();

    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;

    // Buscar médico na tabela medicos usando a FK do auth.users (incluindo nome)
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Parse do body da requisição
    const body = await request.json();
    const { patient_id, consultation_type, patient_name, status, consulta_inicio } = body;

    // Validação dos dados obrigatórios
    if (!patient_id || !consultation_type || !patient_name) {
      return NextResponse.json(
        { error: 'Dados obrigatórios: patient_id, consultation_type, patient_name' },
        { status: 400 }
      );
    }

    // Validação de agendamento
    if (status === 'AGENDAMENTO' && !consulta_inicio) {
      return NextResponse.json(
        { error: 'Para agendamentos, o campo consulta_inicio é obrigatório' },
        { status: 400 }
      );
    }

    // Validar se o paciente pertence ao médico
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name')
      .eq('id', patient_id)
      .eq('doctor_id', medico.id)
      .single();

    if (patientError || !patient) {
      console.error('❌ Paciente não encontrado ou não pertence ao médico:', patientError);
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    // Preparar dados da consulta
    const consultationData: any = {
      patient_id,
      consultation_type,
      patient_name,
      doctor_id: medico.id,
      status: status || 'CREATED',
    };

    // Adicionar consulta_inicio se for agendamento
    if (consulta_inicio) {
      consultationData.consulta_inicio = consulta_inicio;
    }

    // Criar a consulta
    const { data: consultation, error: insertError } = await supabase
      .from('consultations')
      .insert([consultationData])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar consulta:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar consulta' },
        { status: 500 }
      );
    }

    console.log('✅ Consulta criada com sucesso:', consultation.id, status === 'AGENDAMENTO' ? '(Agendamento)' : '');

    // Registrar log de auditoria
    const auditContext = getAuditContext(request);
    await logAudit({
      user_id: doctorAuthId,
      user_email: user.email,
      user_name: medico.name,
      user_role: 'medico',
      action: 'CREATE',
      resource_type: 'consultations',
      resource_id: consultation.id,
      resource_description: `Consulta ${consultation_type} - ${patient_name}`,
      related_patient_id: patient_id,
      related_consultation_id: consultation.id,
      ...auditContext,
      http_method: 'POST',
      data_category: 'sensivel',
      legal_basis: 'tutela_saude',
      purpose: 'Criação de consulta médica',
      contains_sensitive_data: true,
      data_after: sanitizeData(consultation),
      metadata: {
        consultation_type,
        status: consultation.status,
        is_scheduled: status === 'AGENDAMENTO'
      }
    });

    // Sincronizar com Google Calendar (se o médico tiver conectado)
    // Apenas para consultas não presenciais
    if (consultation_type !== 'PRESENCIAL') {
      try {
        const syncResult = await syncConsultationToGoogleCalendar(supabase, medico.id, {
          id: consultation.id,
          patient_name: consultation.patient_name,
          consultation_type: consultation.consultation_type,
          consulta_inicio: consultation.consulta_inicio,
          created_at: consultation.created_at,
          duration: consultation.duration,
          notes: consultation.notes,
          doctor_name: medico.name, // Nome do médico para o evento
        });

        if (syncResult.success && syncResult.eventId) {
          console.log('📅 Consulta sincronizada com Google Calendar:', syncResult.eventId);
          // Buscar consulta atualizada com google_event_id
          const { data: updatedConsultation } = await supabase
            .from('consultations')
            .select('*')
            .eq('id', consultation.id)
            .single();

          if (updatedConsultation) {
            return NextResponse.json(updatedConsultation, { status: 201 });
          }
        } else if (!syncResult.success && syncResult.error) {
          console.warn('⚠️ Falha ao sincronizar com Google Calendar:', syncResult.error);
          // Não retorna erro, a consulta foi criada com sucesso no banco
        }
      } catch (syncError) {
        console.warn('⚠️ Erro ao sincronizar com Google Calendar:', syncError);
        // Não retorna erro, a consulta foi criada com sucesso no banco
      }
    }

    return NextResponse.json(consultation, { status: 201 });

  } catch (error) {
    console.error('Erro no endpoint POST /api/consultations:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
