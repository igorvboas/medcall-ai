import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { auditTableField } from '@/lib/audit-table-field-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;
    const { fieldPath, value, refeicao, index, alimento, tipo, gramatura, kcal } = await request.json();

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta é obrigatório' },
        { status: 400 }
      );
    }

    // Criar cliente Supabase para server-side
    const supabase = createSupabaseServerClient();

    // Buscar sessão autenticada para auditoria
    const authResult = await getAuthenticatedSession();
    const user = authResult?.user;
    const doctorAuthId = user?.id;
    
    // Buscar médico para auditoria
    let medico: any = null;
    if (doctorAuthId) {
      const { data } = await supabase
        .from('medicos')
        .select('id, name, email')
        .eq('user_auth', doctorAuthId)
        .single();
      medico = data;
    }

    // 1. Buscar na tabela consultations filtrando pelo id da consulta
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id, patient_name')
      .eq('id', consultaId)
      .single();

    if (consultaError) {
      console.error('Erro ao buscar consulta:', consultaError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da consulta' },
        { status: 500 }
      );
    }

    if (!consulta) {
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Se for uma edição de item de refeição
    if (refeicao && alimento !== undefined) {
      const refeicaoMapping: { [key: string]: { g: string, kcal: string } } = {
        'cafe_da_manha': { g: 'ref1_g', kcal: 'ref1_kcal' },
        'almoco': { g: 'ref2_g', kcal: 'ref2_kcal' },
        'cafe_da_tarde': { g: 'ref3_g', kcal: 'ref3_kcal' },
        'jantar': { g: 'ref4_g', kcal: 'ref4_kcal' }
      };

      const campos = refeicaoMapping[refeicao];
      if (!campos) {
        return NextResponse.json(
          { error: 'Refeição inválida' },
          { status: 400 }
        );
      }

      // Buscar registros existentes para o paciente
      const { data: existingData, error: existingError } = await supabase
        .from('s_gramaturas_alimentares')
        .select('*')
        .eq('paciente_id', consulta.patient_id)
        .order('created_at', { ascending: true });

      if (existingError) {
        console.error('Erro ao buscar dados existentes:', existingError);
        return NextResponse.json(
          { error: 'Erro ao buscar dados existentes' },
          { status: 500 }
        );
      }

      // Se há um índice específico, atualizar o registro existente
      if (index !== undefined && existingData && existingData[index]) {
        const recordToUpdate = existingData[index];
        const updateData: any = {
          alimento: alimento,
          tipo_de_alimentos: tipo || null,
          [campos.g]: gramatura || null,
          [campos.kcal]: kcal || null
        };

        const { error: updateError } = await supabase
          .from('s_gramaturas_alimentares')
          .update(updateData)
          .eq('id', recordToUpdate.id);

        if (updateError) {
          console.error('Erro ao atualizar registro:', updateError);
          return NextResponse.json(
            { error: 'Erro ao salvar dados' },
            { status: 500 }
          );
        }
      } else {
        // Criar novo registro
        const newRecord = {
          paciente_id: consulta.patient_id,
          alimento: alimento,
          tipo_de_alimentos: tipo || null,
          [campos.g]: gramatura || null,
          [campos.kcal]: kcal || null,
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('s_gramaturas_alimentares')
          .insert(newRecord);

        if (insertError) {
          console.error('Erro ao inserir novo registro:', insertError);
          return NextResponse.json(
            { error: 'Erro ao salvar dados' },
            { status: 500 }
          );
        }

        // Registrar auditoria para criação de item de refeição
        if (doctorAuthId && medico) {
          const { data: newRecord } = await supabase
            .from('s_gramaturas_alimentares')
            .select('*')
            .eq('paciente_id', consulta.patient_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          await auditTableField({
            request,
            user_id: doctorAuthId,
            user_email: user?.email || '',
            user_name: medico.name,
            consultaId,
            consultation: consulta,
            tableName: 's_gramaturas_alimentares',
            fieldName: campos.g,
            fieldPath: `s_gramaturas_alimentares.${campos.g}`,
            existingRecord: null,
            updatedRecord: newRecord || null,
            wasCreated: true,
            resourceType: 'solucao'
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Dados de alimentação salvos com sucesso'
      });
    }

    // Se for uma atualização de campo genérico (manter compatibilidade)
    if (fieldPath) {
      // Buscar dados atuais da consulta
      const { data: consultaData, error: consultaDataError } = await supabase
        .from('consultations')
        .select('alimentacao_data')
        .eq('id', consultaId)
        .single();

      if (consultaDataError) {
        console.error('Erro ao buscar consulta:', consultaDataError);
        return NextResponse.json(
          { error: 'Erro ao buscar dados da consulta' },
          { status: 500 }
        );
      }

      // Atualizar o campo específico
      const alimentacaoData = consultaData?.alimentacao_data || {};
      
      // Função para atualizar campo aninhado
      const updateNestedField = (obj: any, path: string, value: any) => {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
      };

      updateNestedField(alimentacaoData, fieldPath, value);

      // Salvar dados atualizados
      const { error: updateError } = await supabase
        .from('consultations')
        .update({ 
          alimentacao_data: alimentacaoData,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultaId);

      if (updateError) {
        console.error('Erro ao atualizar consulta:', updateError);
        return NextResponse.json(
          { error: 'Erro ao salvar dados' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Campo atualizado com sucesso',
        alimentacao_data: alimentacaoData
      });
    }

    return NextResponse.json(
      { error: 'Parâmetros inválidos' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erro na API de atualização de alimentação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
