import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// POST /api/solucao-mentalidade/[consultaId]/update-field - Atualizar campo específico
export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== POST /api/solucao-mentalidade/[consultaId]/update-field ===');
    
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

    // Pegar dados do body
    const { fieldPath, value } = await request.json();
    
    console.log('📝 Atualizando campo Mentalidade:', { fieldPath, value });

    // O fieldPath pode ser "mentalidade_data.campo_nome" ou "s_agente_mentalidade_do_paciente.campo_nome"
    const [tableName, fieldName] = fieldPath.split('.');
    
    if ((tableName !== 'mentalidade_data' && tableName !== 's_agente_mentalidade_do_paciente') || !fieldName) {
      return NextResponse.json(
        { error: 'Campo inválido' },
        { status: 400 }
      );
    }

    const actualTableName = 's_agente_mentalidade_2';

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

    // Buscar registro existente (filtrar APENAS por consulta_id)
    console.log('🔍 [MENTALIDADE] Buscando registro para consulta_id:', consultaId);
    
    const { data: existingRecord, error: fetchError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('📊 [MENTALIDADE] Registro encontrado:', existingRecord ? 'Sim' : 'Não');

    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Registro de mentalidade não encontrado. Por favor, carregue os dados primeiro.' },
        { status: 404 }
      );
    }

    console.log('✅ [MENTALIDADE] Atualizando registro ID:', existingRecord.id);
    
    // Preparar valor para salvar (stringify se for objeto)
    let valueToSave = value;
    if (typeof value === 'object' && value !== null) {
      valueToSave = JSON.stringify(value);
    }
    
    // Atualizar registro existente
    const updateData: any = { [fieldName]: valueToSave };
    
    const { error: updateError } = await supabase
      .from(actualTableName)
      .update(updateData)
      .eq('id', existingRecord.id);

    if (updateError) {
      console.error('❌ [MENTALIDADE] Erro ao atualizar:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar campo' },
        { status: 500 }
      );
    }
    
    console.log('✅ [MENTALIDADE] Campo atualizado com sucesso');

    console.log('✅ Campo Mentalidade atualizado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint POST /api/solucao-mentalidade/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

