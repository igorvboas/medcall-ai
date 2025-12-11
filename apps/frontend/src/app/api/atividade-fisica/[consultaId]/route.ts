import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta é obrigatório' },
        { status: 400 }
      );
    }

    console.log('🔍 [ATIVIDADE-FISICA] Buscando exercícios para consulta_id:', consultaId);

    // Buscar exercícios físicos filtrados por consulta_id (não paciente_id!)
    const { data: exercicios, error: exerciciosError } = await supabase
      .from('s_exercicios_fisicos')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('nome_treino', { ascending: true })
      .order('id', { ascending: true });

    if (exerciciosError) {
      console.error('❌ [ATIVIDADE-FISICA] Erro ao buscar exercícios:', exerciciosError);
      return NextResponse.json(
        { error: 'Erro ao buscar exercícios físicos' },
        { status: 500 }
      );
    }

    console.log('✅ [ATIVIDADE-FISICA] Exercícios encontrados:', exercicios?.length || 0);

    return NextResponse.json({
      exercicios: exercicios || [],
      consulta_id: consultaId
    });

  } catch (error) {
    console.error('❌ Erro interno na API de atividade física:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
