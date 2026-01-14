import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { auditUpdateField } from '@/lib/audit-update-field-helper';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== PATCH /api/anamnese/[consultaId]/update-field ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;
    const doctorAuthId = user.id;
    const consultaId = params.consultaId;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name, email')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const userId = medico.id;

    // Pegar dados do body
    const { fieldPath, value } = await request.json();
    
    console.log('📝 Atualizando campo:', { fieldPath, value });

    if (!consultaId || !fieldPath || value === undefined) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Determinar a tabela e campo baseado no fieldPath
    const pathParts = fieldPath.split('.');
    const tableName = pathParts[0];
    // Para síntese analítica, usar apenas o último segmento (sem join com _)
    const fieldName = tableName === 'a_sintese_analitica' 
      ? pathParts[pathParts.length - 1] 
      : pathParts.slice(1).join('_');

    console.log('🔍 Debug fieldPath:', { pathParts, tableName, fieldName });

    // Mapear nomes de tabela
    const tableMapping: { [key: string]: string } = {
      'cadastro_prontuario': 'a_cadastro_prontuario',
      'a_cadastro_prontuario': 'a_cadastro_prontuario', // Adicionar mapeamento direto
      'objetivos_queixas': 'a_objetivos_queixas',
      'a_objetivos_queixas': 'a_objetivos_queixas',
      'historico_risco': 'a_historico_risco',
      'a_historico_risco': 'a_historico_risco',
      'observacao_clinica_lab': 'a_observacao_clinica_lab',
      'a_observacao_clinica_lab': 'a_observacao_clinica_lab',
      'historia_vida': 'a_historia_vida',
      'a_historia_vida': 'a_historia_vida',
      'setenios_eventos': 'a_setenios_eventos',
      'a_setenios_eventos': 'a_setenios_eventos',
      'ambiente_contexto': 'a_ambiente_contexto',
      'a_ambiente_contexto': 'a_ambiente_contexto',
      'sensacao_emocoes': 'a_sensacao_emocoes',
      'a_sensacao_emocoes': 'a_sensacao_emocoes',
      'preocupacoes_crencas': 'a_preocupacoes_crencas',
      'a_preocupacoes_crencas': 'a_preocupacoes_crencas',
      'reino_miasma': 'a_reino_miasma',
      'a_reino_miasma': 'a_reino_miasma',
      'sintese_analitica': 'a_sintese_analitica',
      'a_sintese_analitica': 'a_sintese_analitica',
    };

    const actualTableName = tableMapping[tableName];
    console.log('🗂️ Mapeamento de tabela:', { tableName, actualTableName });
    
    if (!actualTableName) {
      console.error('❌ Tabela não encontrada no mapeamento:', tableName);
      return NextResponse.json(
        { error: 'Tabela não encontrada' },
        { status: 400 }
      );
    }

    // Buscar dados da consulta para auditoria
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select('patient_id, patient_name')
      .eq('id', consultaId)
      .single();

    if (consultationError || !consultation) {
      console.error('❌ Consulta não encontrada:', consultationError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o registro existe
    const { data: existingRecord, error: fetchError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Erro ao buscar registro existente:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar registro' },
        { status: 500 }
      );
    }

    if (existingRecord) {
      // Atualizar registro existente
      console.log('📝 Atualizando registro existente:', { actualTableName, fieldName, value, consultaId });
      
      const { error: updateError } = await supabase
        .from(actualTableName)
        .update({ [fieldName]: value })
        .eq('consulta_id', consultaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar campo:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar campo', details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Criar registro inicial
      const insertData = {
        user_id: userId,
        paciente_id: consultation.patient_id,
        consulta_id: consultaId,
        [fieldName]: value
      };
      
      console.log('📝 Criando novo registro:', { actualTableName, insertData });
      
      const { error: insertError } = await supabase
        .from(actualTableName)
        .insert(insertData);

      if (insertError) {
        console.error('❌ Erro ao criar registro:', insertError);
        return NextResponse.json(
          { error: 'Erro ao criar registro', details: insertError.message },
          { status: 500 }
        );
      }
    }

    console.log('✅ Campo atualizado com sucesso');

    // Buscar o registro atualizado para retornar na resposta e para auditoria
    const { data: updatedRecord, error: fetchUpdatedError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .single();

    if (fetchUpdatedError) {
      console.warn('⚠️ Erro ao buscar registro atualizado:', fetchUpdatedError);
    }

    // Registrar log de auditoria (APÓS buscar o registro atualizado)
    const tableRef = `${actualTableName}.${fieldName}`;
    
    // INSERÇÃO DIRETA NA TABELA audit_logs (SEM HELPERS)
    const url = new URL(request.url);
    const auditData: any = {
      user_id: doctorAuthId,
      user_email: user.email || null,
      user_role: 'medico',
      user_name: medico?.name || null,
      resource_type: 'anamnese',
      resource_id: consultaId,
      resource_description: `anamnese - ${consultation?.patient_name || 'Paciente'}`,
      action: existingRecord ? 'UPDATE' : 'CREATE',
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                  request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
      endpoint: url.pathname + url.search,
      http_method: 'PATCH',
      data_category: 'sensivel',
      legal_basis: 'tutela_saude',
      purpose: 'Atualização de dados de anamnese',
      contains_sensitive_data: true,
      data_before: existingRecord ? JSON.parse(JSON.stringify(existingRecord)) : null,
      data_after: updatedRecord ? JSON.parse(JSON.stringify(updatedRecord)) : null,
      data_fields_accessed: [fieldPath],
      changes_summary: `${existingRecord ? 'Atualizado' : 'Criado'} campo ${fieldPath} na tabela ${actualTableName}`,
      table_ref: tableRef,
      related_patient_id: consultation?.patient_id || null,
      related_consultation_id: consultaId,
      metadata: {
        table: actualTableName,
        field_path: fieldPath,
        field_name: fieldName,
        was_created: !existingRecord
      },
      success: true
    };

    // Inserir diretamente no audit_logs
    const { data: auditInserted, error: auditError } = await supabase
      .from('audit_logs')
      .insert(auditData)
      .select();

    if (auditError) {
      console.error('❌ ERRO AO INSERIR AUDITORIA:', {
        message: auditError.message,
        details: auditError.details,
        hint: auditError.hint,
        code: auditError.code
      });
    } else {
      console.log('✅ AUDITORIA INSERIDA COM SUCESSO. ID:', auditInserted?.[0]?.id);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Campo atualizado com sucesso',
      data: updatedRecord,
      fieldPath,
      fieldName,
      value
    });

  } catch (error: any) {
    console.error('❌ Erro no endpoint PATCH /api/anamnese/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
