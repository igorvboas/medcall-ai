import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;

    console.log('🔍 [ALIMENTAÇÃO] Iniciando busca para consulta_id:', consultaId);

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Buscar na tabela consultations filtrando pelo id da consulta
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .single();

    if (consultaError) {
      console.error('❌ [ALIMENTAÇÃO] Erro ao buscar consulta:', consultaError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da consulta' },
        { status: 500 }
      );
    }

    if (!consulta) {
      console.log('⚠️ [ALIMENTAÇÃO] Consulta não encontrada');
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    console.log('✅ [ALIMENTAÇÃO] patient_id encontrado:', consulta.patient_id);

    // 2. Buscar na tabela s_gramaturas_alimentares usando o patient_id
    const { data: gramaturasData, error: gramaturasError } = await supabase
      .from('s_gramaturas_alimentares')
      .select('*')
      .eq('paciente_id', consulta.patient_id)
      .order('created_at', { ascending: true });

    console.log('📊 [ALIMENTAÇÃO] Registros encontrados:', gramaturasData?.length || 0);

    if (gramaturasError) {
      console.error('❌ [ALIMENTAÇÃO] Erro ao buscar gramaturas:', gramaturasError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados de alimentação' },
        { status: 500 }
      );
    }

    // Organizar os dados por refeição
    const alimentacaoData: any = {
      cafe_da_manha: [],
      almoco: [],
      cafe_da_tarde: [],
      jantar: []
    };

    // Processar os dados da tabela
    if (gramaturasData && gramaturasData.length > 0) {
      console.log('📦 [ALIMENTAÇÃO] Processando dados...');
      
      gramaturasData.forEach((item: any) => {
        console.log(`  → Alimento: ${item.alimento} | ref1_g: ${item.ref1_g} | ref2_g: ${item.ref2_g} | ref3_g: ${item.ref3_g} | ref4_g: ${item.ref4_g}`);
        
        // Mapear os dados para as refeições baseado na estrutura da tabela
        if (item.ref1_g || item.ref1_kcal) {
          alimentacaoData.cafe_da_manha.push({
            id: item.id,
            alimento: item.alimento || '',
            tipo: item.tipo_de_alimentos || '',
            gramatura: item.ref1_g || '',
            kcal: item.ref1_kcal || ''
          });
        }
        
        if (item.ref2_g || item.ref2_kcal) {
          alimentacaoData.almoco.push({
            id: item.id,
            alimento: item.alimento || '',
            tipo: item.tipo_de_alimentos || '',
            gramatura: item.ref2_g || '',
            kcal: item.ref2_kcal || ''
          });
        }
        
        if (item.ref3_g || item.ref3_kcal) {
          alimentacaoData.cafe_da_tarde.push({
            id: item.id,
            alimento: item.alimento || '',
            tipo: item.tipo_de_alimentos || '',
            gramatura: item.ref3_g || '',
            kcal: item.ref3_kcal || ''
          });
        }
        
        if (item.ref4_g || item.ref4_kcal) {
          alimentacaoData.jantar.push({
            id: item.id,
            alimento: item.alimento || '',
            tipo: item.tipo_de_alimentos || '',
            gramatura: item.ref4_g || '',
            kcal: item.ref4_kcal || ''
          });
        }
      });
      
      console.log('✅ [ALIMENTAÇÃO] Dados processados:', {
        cafe_da_manha: alimentacaoData.cafe_da_manha.length,
        almoco: alimentacaoData.almoco.length,
        cafe_da_tarde: alimentacaoData.cafe_da_tarde.length,
        jantar: alimentacaoData.jantar.length
      });
    } else {
      console.log('⚠️ [ALIMENTAÇÃO] Nenhum dado encontrado para processar');
    }

    return NextResponse.json({
      alimentacao_data: alimentacaoData,
      consulta_id: consultaId,
      patient_id: consulta.patient_id
    });

  } catch (error) {
    console.error('Erro na API de alimentação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
