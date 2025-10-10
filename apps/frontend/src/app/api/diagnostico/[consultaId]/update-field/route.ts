import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// POST /api/diagnostico/[consultaId]/update-field - Atualizar campo específico
export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== POST /api/diagnostico/[consultaId]/update-field ===');
    
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
    
    console.log('📝 Atualizando campo:', { fieldPath, value });

    // Determinar qual tabela e campo atualizar baseado no fieldPath
    const [tableName, fieldName] = fieldPath.split('.');
    
    // Mapear nomes de tabelas do frontend para backend
    const tableMap: Record<string, string> = {
      'diagnostico_principal': 'd_diagnostico_principal',
      'estado_geral': 'd_estado_geral',
      'estado_mental': 'd_estado_mental',
      'estado_fisiologico': 'd_estado_fisiologico',
      'integracao_diagnostica': 'd_agente_integracao_diagnostica',
      'habitos_vida': 'd_agente_habitos_vida_sistemica'
    };

    const actualTableName = tableMap[tableName] || tableName;

    if (!actualTableName || !fieldName) {
      return NextResponse.json(
        { error: 'Campo inválido' },
        { status: 400 }
      );
    }

    // Verificar se o registro existe (apenas por consulta_id já que não há RLS)
    const { data: existing } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

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
        .eq('consulta_id', consultaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar campo:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar campo' },
          { status: 500 }
        );
      }
    }

    console.log('✅ Campo atualizado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint POST /api/diagnostico/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
