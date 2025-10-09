import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// POST /api/solucao-habitos-vida/[consultaId]/update-field - Atualizar campo específico
export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== POST /api/solucao-habitos-vida/[consultaId]/update-field ===');
    
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
    
    console.log('📝 Atualizando campo Hábitos de Vida:', { fieldPath, value });

    // O fieldPath será "habitos_vida_data.campo_nome"
    const [tableName, fieldName] = fieldPath.split('.');
    
    if (tableName !== 'habitos_vida_data' || !fieldName) {
      return NextResponse.json(
        { error: 'Campo inválido' },
        { status: 400 }
      );
    }

    const actualTableName = 's_agente_habitos_de_vida_final';

    // Verificar se o registro existe
    const { data: existing } = await supabase
      .from(actualTableName)
      .select('user_id')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    if (!existing) {
      // Se não existir, buscar o paciente_id da consulta
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

      // Criar registro inicial
      const { error: insertError } = await supabase
        .from(actualTableName)
        .insert({
          user_id: userId,
          paciente_id: consultation.patient_id,
          consulta_id: consultaId,
          [fieldName]: value
        });

      if (insertError) {
        console.error('❌ Erro ao criar registro:', insertError);
        return NextResponse.json(
          { error: 'Erro ao criar registro' },
          { status: 500 }
        );
      }
    } else {
      // Atualizar registro existente
      const { error: updateError } = await supabase
        .from(actualTableName)
        .update({ [fieldName]: value })
        .eq('user_id', userId)
        .eq('consulta_id', consultaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar campo:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar campo' },
          { status: 500 }
        );
      }
    }

    console.log('✅ Campo Hábitos de Vida atualizado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint POST /api/solucao-habitos-vida/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

