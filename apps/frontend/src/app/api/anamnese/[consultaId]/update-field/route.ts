import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedSession } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;
    const body = await request.json();
    const { fieldPath, value } = body;

    if (!consultaId || !fieldPath || value === undefined) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Verificar autenticação
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { supabase } = authResult;

    // Determinar a tabela e campo baseado no fieldPath
    const pathParts = fieldPath.split('.');
    const tableName = pathParts[0];
    const fieldName = pathParts.slice(1).join('_');

    // Mapear nomes de tabela
    const tableMapping: { [key: string]: string } = {
      'cadastro_prontuario': 'a_cadastro_prontuario',
      'objetivos_queixas': 'a_objetivos_queixas',
      'historico_risco': 'a_historico_risco',
      'observacao_clinica_lab': 'a_observacao_clinica_lab',
      'historia_vida': 'a_historia_vida',
      'setenios_eventos': 'a_setenios_eventos',
      'ambiente_contexto': 'a_ambiente_contexto',
      'sensacao_emocoes': 'a_sensacao_emocoes',
      'preocupacoes_crencas': 'a_preocupacoes_crencas',
      'reino_miasma': 'a_reino_miasma',
    };

    const actualTableName = tableMapping[tableName];
    if (!actualTableName) {
      return NextResponse.json(
        { error: 'Tabela não encontrada' },
        { status: 400 }
      );
    }

    // Verificar se o registro existe
    const { data: existingRecord, error: fetchError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar registro existente:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar registro' },
        { status: 500 }
      );
    }

    let result;

    if (existingRecord) {
      // Atualizar registro existente
      const updateData: any = {};
      updateData[fieldName] = value;

      result = await supabase
        .from(actualTableName)
        .update(updateData)
        .eq('consulta_id', consultaId);
    } else {
      // Criar novo registro
      const insertData: any = {
        consulta_id: consultaId,
        [fieldName]: value,
      };

      result = await supabase
        .from(actualTableName)
        .insert(insertData);
    }

    if (result.error) {
      console.error('Erro ao atualizar/criar registro:', result.error);
      return NextResponse.json(
        { error: 'Erro ao salvar dados' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Campo atualizado com sucesso' 
    });

  } catch (error: any) {
    console.error('Erro ao atualizar campo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
