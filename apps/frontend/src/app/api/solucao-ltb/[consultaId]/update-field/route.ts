import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// POST /api/solucao-ltb/[consultaId]/update-field - Atualizar campo específico
export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== POST /api/solucao-ltb/[consultaId]/update-field ===');
    
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
    
    console.log('📝 Atualizando campo LTB:', { fieldPath, value });

    // O fieldPath pode ser "ltb_data.campo_nome" ou "s_agente_limpeza_do_terreno_biologico.campo_nome"
    const [tableName, fieldName] = fieldPath.split('.');
    
    if ((tableName !== 'ltb_data' && tableName !== 's_agente_limpeza_do_terreno_biologico') || !fieldName) {
      return NextResponse.json(
        { error: 'Campo inválido' },
        { status: 400 }
      );
    }

    const actualTableName = 's_agente_limpeza_do_terreno_biologico';

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

    // Primeiro, limpar registros duplicados se existirem
    console.log('🧹 Limpando registros duplicados LTB...');
    
    // Buscar todos os registros duplicados
    const { data: allRecords } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false });

    if (allRecords && allRecords.length > 1) {
      console.log(`🗑️ Encontrados ${allRecords.length} registros duplicados LTB, removendo os mais antigos...`);
      
      // Manter apenas o mais recente, deletar os outros
      const recordsToDelete = allRecords.slice(1);
      for (const record of recordsToDelete) {
        await supabase
          .from(actualTableName)
          .delete()
          .eq('id', record.id);
      }
      console.log(`✅ Removidos ${recordsToDelete.length} registros duplicados LTB`);
    }

    // Agora buscar o registro único (ou criar se não existir)
    console.log('🔍 Buscando registro único LTB...');
    
    const { data: existingRecord, error: fetchError } = await supabase
      .from(actualTableName)
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    console.log('📊 Registro LTB encontrado:', existingRecord);
    console.log('❌ Erro ao buscar LTB:', fetchError);

    if (existingRecord) {
      console.log('✅ Atualizando registro existente LTB ID:', existingRecord.id);
      // Atualizar registro existente
      const updateData: any = { [fieldName]: value };
      
      const { error: updateError } = await supabase
        .from(actualTableName)
        .update(updateData)
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar campo LTB:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar campo' },
          { status: 500 }
        );
      }
      console.log('✅ Registro LTB atualizado com sucesso');
    } else {
      console.log('➕ Criando novo registro LTB');
      // Criar novo registro
      const insertData: any = {
        user_id: userId,
        paciente_id: consultation.patient_id,
        consulta_id: consultaId,
        [fieldName]: value
      };

      const { error: insertError } = await supabase
        .from(actualTableName)
        .insert(insertData);

      if (insertError) {
        console.error('❌ Erro ao criar registro LTB:', insertError);
        return NextResponse.json(
          { error: 'Erro ao criar registro' },
          { status: 500 }
        );
      }
      console.log('✅ Novo registro LTB criado com sucesso');
    }

    console.log('✅ Campo LTB atualizado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint POST /api/solucao-ltb/[consultaId]/update-field:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

