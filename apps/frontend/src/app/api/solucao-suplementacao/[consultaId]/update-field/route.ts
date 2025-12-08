import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// POST /api/solucao-suplementacao/[consultaId]/update-field - Atualizar campo específico
export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== POST /api/solucao-suplementacao/[consultaId]/update-field ===');
    
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
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const userId = medico.id;

    // Pegar dados do body: category, index, field, value
    const { category, index, field, value } = await request.json();
    
    console.log('📝 Atualizando campo Suplementação:', { category, index, field, value });

    if (!category || index === undefined || !field || value === undefined) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos. São necessários: category, index, field, value' },
        { status: 400 }
      );
    }

    // Validar categoria
    const validCategories = ['suplementos', 'fitoterapicos', 'homeopatia', 'florais_bach'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Categoria inválida' },
        { status: 400 }
      );
    }

    const actualTableName = 's_suplementacao2';

    // Buscar o paciente_id da consulta primeiro
    const { data: consultation } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .single();

    if (!consultation) {
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Buscar registro existente
    console.log('🔍 Buscando registro para consulta_id:', consultaId);
    
    // Filtrar APENAS por consulta_id (não por user_id)
    const { data: existingRecord, error: fetchError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('📊 Registro encontrado:', existingRecord ? 'Sim' : 'Não');

    // Helper para parse de array de JSON strings
    const parseJsonArray = (arr: string[] | null): any[] => {
      if (!arr || !Array.isArray(arr)) return [];
      try {
        return arr.map(item => JSON.parse(item));
      } catch (error) {
        console.error('Erro ao fazer parse de array:', error);
        return [];
      }
    };

    // Helper para stringify de array de objetos
    const stringifyJsonArray = (arr: any[]): string[] => {
      if (!arr || !Array.isArray(arr)) return [];
      try {
        return arr.map(item => JSON.stringify(item));
      } catch (error) {
        console.error('Erro ao fazer stringify de array:', error);
        return [];
      }
    };

    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Registro de suplementação não encontrado. Por favor, carregue os dados primeiro.' },
        { status: 404 }
      );
    }

    // Parse dos dados existentes
    const currentData = {
      suplementos: parseJsonArray(existingRecord.suplementos),
      fitoterapicos: parseJsonArray(existingRecord.fitoterapicos),
      homeopatia: parseJsonArray(existingRecord.homeopatia),
      florais_bach: parseJsonArray(existingRecord.florais_bach)
    };

    // Verificar se o índice existe
    if (!currentData[category][index]) {
      return NextResponse.json(
        { error: `Item no índice ${index} não encontrado na categoria ${category}` },
        { status: 404 }
      );
    }

    // Atualizar o campo específico
    currentData[category][index][field] = value;

    console.log('✅ Atualizando registro existente ID:', existingRecord.id);

    // Converter de volta para o formato da tabela (arrays de JSON strings)
    const updateData: any = {
      [category]: stringifyJsonArray(currentData[category])
    };
    
    const { error: updateError } = await supabase
      .from(actualTableName)
      .update(updateData)
      .eq('id', existingRecord.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar campo:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar campo' },
        { status: 500 }
      );
    }
    
    console.log('✅ Campo Suplementação atualizado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Campo atualizado com sucesso',
      updated_data: currentData[category][index]
    });

  } catch (error) {
    console.error('Erro no endpoint POST /api/solucao-suplementacao/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

