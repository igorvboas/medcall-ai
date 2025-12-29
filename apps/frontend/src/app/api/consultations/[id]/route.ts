import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { syncConsultationToGoogleCalendar, removeConsultationFromGoogleCalendar } from '@/lib/google-calendar-service';
import { logAudit, getAuditContext, sanitizeData } from '@/lib/audit-helper';

// GET /api/consultations/[id] - Buscar detalhes de uma consulta específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== GET /api/consultations/[id] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    const consultationId = params.id;

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Buscar consulta com dados relacionados
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          profile_pic,
          birth_date,
          gender,
          cpf,
          address,
          emergency_contact,
          emergency_phone,
          medical_history,
          allergies,
          current_medications
        )
      `)
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (consultationError || !consultation) {
      console.error('❌ Consulta não encontrada:', consultationError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Buscar transcrição se existir
    const { data: transcription } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('consultation_id', consultationId)
      .single();

    // Buscar arquivos de áudio se existirem
    const { data: audioFiles } = await supabase
      .from('audio_files')
      .select('*')
      .eq('consultation_id', consultationId);

    // Buscar documentos se existirem
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('consultation_id', consultationId);

    // Buscar call_session para obter roomId (se consulta estiver em RECORDING)
    let roomId = null;
    if (consultation.status === 'RECORDING') {
      // Primeiro tentar buscar por consultation_id
      let { data: callSession } = await supabase
        .from('call_sessions')
        .select('room_id')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Se não encontrar, buscar pela data de criação próxima (pode ter sido criado antes da consulta)
      if (!callSession || !callSession.room_id) {
        const consultationCreatedAt = new Date(consultation.created_at);
        const fiveMinutesAgo = new Date(consultationCreatedAt.getTime() - 5 * 60 * 1000);
        const fiveMinutesLater = new Date(consultationCreatedAt.getTime() + 5 * 60 * 1000);
        
        const { data: callSessions } = await supabase
          .from('call_sessions')
          .select('room_id, created_at')
          .gte('created_at', fiveMinutesAgo.toISOString())
          .lte('created_at', fiveMinutesLater.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);
        
        // Pegar a mais recente que tenha room_id
        if (callSessions && callSessions.length > 0) {
          callSession = callSessions.find(cs => cs.room_id) || null;
        }
      }
      
      if (callSession && callSession.room_id) {
        roomId = callSession.room_id;
      }
    }

    return NextResponse.json({
      consultation: {
        ...consultation,
        transcription,
        audioFiles: audioFiles || [],
        documents: documents || [],
        roomId // Adicionar roomId se disponível
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/consultations/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/consultations/[id] - Atualizar consulta
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== PATCH /api/consultations/[id] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    const consultationId = params.id;

    // Buscar médico na tabela medicos (incluindo nome)
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

    // Pegar os dados do body
    const body = await request.json();
    
    console.log('📝 Dados recebidos para atualização:', body);

    // Validar que a consulta pertence ao médico e buscar dados antes da atualização
    const { data: existingConsultation, error: checkError } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingConsultation) {
      console.error('❌ Consulta não encontrada ou não autorizada:', checkError);
      return NextResponse.json(
        { error: 'Consulta não encontrada ou você não tem permissão para editá-la' },
        { status: 404 }
      );
    }

    // Atualizar a consulta
    const { data: updatedConsultation, error: updateError } = await supabase
      .from('consultations')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar consulta:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar consulta' },
        { status: 500 }
      );
    }

    console.log('✅ Consulta atualizada com sucesso:', updatedConsultation);

    // Registrar log de auditoria
    const auditContext = getAuditContext(request);
    const changedFields = Object.keys(body).filter(key => {
      const oldValue = existingConsultation[key];
      const newValue = updatedConsultation[key];
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    });

    await logAudit({
      user_id: doctorAuthId,
      user_email: user.email,
      user_name: medico.name,
      user_role: 'medico',
      action: 'UPDATE',
      resource_type: 'consultations',
      resource_id: consultationId,
      resource_description: `Consulta ${updatedConsultation.consultation_type} - ${updatedConsultation.patient_name}`,
      related_patient_id: updatedConsultation.patient_id,
      related_consultation_id: consultationId,
      ...auditContext,
      http_method: 'PATCH',
      data_category: 'sensivel',
      legal_basis: 'tutela_saude',
      purpose: 'Atualização de dados da consulta',
      contains_sensitive_data: true,
      data_before: sanitizeData(existingConsultation),
      data_after: sanitizeData(updatedConsultation),
      data_fields_accessed: changedFields,
      changes_summary: `Campos alterados: ${changedFields.join(', ')}`,
      metadata: {
        fields_changed: changedFields,
        status_changed: existingConsultation.status !== updatedConsultation.status
      }
    });

    // Sincronizar alterações com Google Calendar (se o médico tiver conectado)
    try {
      const syncResult = await syncConsultationToGoogleCalendar(supabase, medico.id, {
        id: updatedConsultation.id,
        patient_name: updatedConsultation.patient_name,
        consultation_type: updatedConsultation.consultation_type,
        consulta_inicio: updatedConsultation.consulta_inicio,
        created_at: updatedConsultation.created_at,
        duration: updatedConsultation.duration,
        notes: updatedConsultation.notes,
        doctor_name: medico.name, // Nome do médico para o evento
        google_event_id: updatedConsultation.google_event_id,
        google_calendar_id: updatedConsultation.google_calendar_id,
      });

      if (syncResult.success && syncResult.eventId) {
        console.log('📅 Consulta sincronizada com Google Calendar:', syncResult.eventId);
      }
    } catch (syncError) {
      console.warn('⚠️ Erro ao sincronizar com Google Calendar:', syncError);
    }

    return NextResponse.json({
      consultation: updatedConsultation,
      message: 'Consulta atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint PATCH /api/consultations/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/consultations/[id] - Excluir consulta e todos os dados relacionados
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 DEBUG [REFERENCIA: DELETE_CONSULTA] Iniciando exclusão de consulta:', params.id);
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    const consultationId = params.id;

    console.log('🔍 DEBUG [REFERENCIA: BUSCAR_MEDICO] Buscando médico na tabela medicos');
    
    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    console.log('🔍 DEBUG [REFERENCIA: VALIDAR_CONSULTA] Validando se consulta pertence ao médico');
    
    // Validar que a consulta pertence ao médico (e buscar dados do Google Calendar)
    const { data: existingConsultation, error: checkError } = await supabase
      .from('consultations')
      .select('id, google_event_id, google_calendar_id')
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingConsultation) {
      console.error('❌ Consulta não encontrada ou não autorizada:', checkError);
      return NextResponse.json(
        { error: 'Consulta não encontrada ou você não tem permissão para excluí-la' },
        { status: 404 }
      );
    }

    // Remover evento do Google Calendar (se existir)
    if (existingConsultation.google_event_id) {
      try {
        console.log('📅 Removendo evento do Google Calendar:', existingConsultation.google_event_id);
        // Passa skipDbUpdate=true para não atualizar o banco pois vamos deletar a seguir
        await removeConsultationFromGoogleCalendar(supabase, medico.id, existingConsultation, true);
      } catch (syncError) {
        console.warn('⚠️ Erro ao remover do Google Calendar:', syncError);
        // Continuar com a exclusão mesmo se falhar no Google Calendar
      }
    }

    console.log('🔍 DEBUG [REFERENCIA: EXCLUIR_TABELAS_ANAMNESE] Iniciando exclusão das tabelas de anamnese/prontuário');
    
    // Lista das tabelas que precisam ser limpas (com coluna consulta_id)
    const anamneseTables = [
      'a_ambiente_contexto',
      'a_cadastro_anamnese', 
      'a_cadastro_prontuario',
      'a_historia_vida',
      'a_historico_risco',
      'a_objetivos_queixas',
      'a_observacao_clinica_laboratorial',
      'a_preocupacoes_crencas',
      'a_reino_miasma',
      'a_sensacao_emocoes',
      'a_setenios_eventos',
      'd_agente_habitos_vida_sistemica',
      'd_agente_integracao_diagnostica',
      'd_diagnostico_principal',
      'd_estado_fisiologico',
      'd_estado_geral',
      'd_estado_mental',
      's_agente_habitos_de_vida_final',
      's_agente_limpeza_do_terreno_biologico',
      's_agente_mentalidade_do_paciente',
      's_exercicios_fisicos',
      's_exercicios_pdf_merge',
      's_gramaturas_alimentares',
      's_suplementacao'
    ];

    // Excluir registros das tabelas de anamnese/prontuário
    for (const tableName of anamneseTables) {
      try {
        //console.log(`🔍 DEBUG [REFERENCIA: EXCLUIR_${tableName.toUpperCase()}] Excluindo registros da tabela ${tableName}`);
        
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('consulta_id', consultationId);

        if (deleteError) {
          console.error(`❌ Erro ao excluir da tabela ${tableName}:`, deleteError);
          // Continuar com outras tabelas mesmo se uma falhar
        } else {
          console.log(`✅ Registros excluídos da tabela ${tableName}`);
        }
      } catch (tableError) {
        console.error(`❌ Erro inesperado ao excluir da tabela ${tableName}:`, tableError);
        // Continuar com outras tabelas
      }
    }

    //console.log('🔍 DEBUG [REFERENCIA: EXCLUIR_TABELAS_RELACIONADAS] Excluindo tabelas relacionadas (transcriptions, audio_files, documents)');
    
    // Excluir registros das tabelas relacionadas
    const relatedTables = [
      { table: 'transcriptions', column: 'consultation_id' },
      { table: 'audio_files', column: 'consultation_id' },
      { table: 'documents', column: 'consultation_id' }
    ];

    for (const { table, column } of relatedTables) {
      try {
        console.log(`🔍 DEBUG [REFERENCIA: EXCLUIR_${table.toUpperCase()}] Excluindo registros da tabela ${table}`);
        
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq(column, consultationId);

        if (deleteError) {
          console.error(`❌ Erro ao excluir da tabela ${table}:`, deleteError);
        } else {
          console.log(`✅ Registros excluídos da tabela ${table}`);
        }
      } catch (tableError) {
        console.error(`❌ Erro inesperado ao excluir da tabela ${table}:`, tableError);
      }
    }

    console.log('🔍 DEBUG [REFERENCIA: EXCLUIR_CONSULTA] Excluindo consulta principal da tabela consultations');
    
    // Por último, excluir a consulta principal
    const { error: consultationDeleteError } = await supabase
      .from('consultations')
      .delete()
      .eq('id', consultationId)
      .eq('doctor_id', medico.id);

    if (consultationDeleteError) {
      console.error('❌ Erro ao excluir consulta principal:', consultationDeleteError);
      return NextResponse.json(
        { error: 'Erro ao excluir consulta' },
        { status: 500 }
      );
    }

    console.log('🔍 DEBUG [REFERENCIA: EXCLUSAO_CONCLUIDA] Consulta excluída com sucesso:', consultationId);

    return NextResponse.json({
      message: 'Consulta excluída com sucesso',
      consultationId: consultationId
    });

  } catch (error) {
    console.error('❌ Erro no endpoint DELETE /api/consultations/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}