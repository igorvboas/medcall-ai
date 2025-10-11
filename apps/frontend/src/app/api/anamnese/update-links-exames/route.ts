import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedSession } from '@/lib/supabase-server';

export async function PATCH(request: NextRequest) {
  try {
    console.log('🔍 DEBUG [REFERENCIA] Iniciando atualização de links de exames');
    
    // Verificar autenticação
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      console.error('❌ Falha na autenticação: Sessão não encontrada');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { supabase, user } = authResult;
    console.log('✅ Usuário autenticado:', user.id);

    const body = await request.json();
    const { consultaId, linksExames } = body;

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta não fornecido' },
        { status: 400 }
      );
    }

    if (!linksExames || !Array.isArray(linksExames)) {
      return NextResponse.json(
        { error: 'Links de exames não fornecidos ou formato inválido' },
        { status: 400 }
      );
    }

    console.log(`🔍 DEBUG [REFERENCIA] Atualizando links para consulta ${consultaId}:`, linksExames);

    // Verificar se a consulta existe e pertence ao usuário
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('id, doctor_id, patient_id')
      .eq('id', consultaId)
      .single();

    if (consultaError || !consulta) {
      console.error('❌ Consulta não encontrada:', consultaError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o médico tem acesso à consulta
    if (consulta.doctor_id !== user.id) {
      console.error('❌ Médico não tem acesso à consulta');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', user.id)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado na tabela medicos:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ Médico encontrado:', medico.id);

    // Verificar se o registro já existe na tabela a_observacao_clinica_lab
    const { data: existingRecord, error: fetchError } = await supabase
      .from('a_observacao_clinica_lab')
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

    let result;

    if (existingRecord) {
      // Atualizar registro existente
      console.log('🔍 DEBUG [REFERENCIA] Atualizando registro existente');
      
      result = await supabase
        .from('a_observacao_clinica_lab')
        .update({
          links_exames: linksExames,
          updated_at: new Date().toISOString()
        })
        .eq('consulta_id', consultaId);
    } else {
      // Criar novo registro
      console.log('🔍 DEBUG [REFERENCIA] Criando novo registro');
      
      result = await supabase
        .from('a_observacao_clinica_lab')
        .insert({
          user_id: user.id.toString(),
          paciente_id: consulta.patient_id.toString(),
          consulta_id: consultaId.toString(),
          links_exames: linksExames
        });
    }

    if (result.error) {
      console.error('❌ Erro ao atualizar/criar registro:', result.error);
      return NextResponse.json(
        { error: 'Erro ao salvar links de exames', details: result.error.message },
        { status: 500 }
      );
    }

    console.log('✅ Links de exames atualizados com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Links de exames atualizados com sucesso',
      consultaId,
      linksExames,
      action: existingRecord ? 'updated' : 'created'
    });

  } catch (error: any) {
    console.error('❌ Erro ao atualizar links de exames:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
