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

    console.log('🔍 DEBUG [REFERENCIA] Buscando dados de atividade física para consulta:', consultaId);

    // 1. Buscar o paciente_id da consulta
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .single();

    if (consultaError) {
      console.error('❌ Erro ao buscar consulta:', consultaError);
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

    console.log('🔍 DEBUG [REFERENCIA] Paciente ID encontrado:', consulta.patient_id);

    // 2. Buscar exercícios físicos filtrados por paciente_id
    const { data: exercicios, error: exerciciosError } = await supabase
      .from('s_exercicios_fisicos')
      .select('*')
      .eq('paciente_id', consulta.patient_id)
      .order('nome_treino', { ascending: true })
      .order('id', { ascending: true });

    if (exerciciosError) {
      console.error('❌ Erro ao buscar exercícios físicos:', exerciciosError);
      return NextResponse.json(
        { error: 'Erro ao buscar exercícios físicos' },
        { status: 500 }
      );
    }

    console.log('🔍 DEBUG [REFERENCIA] Exercícios encontrados:', exercicios?.length || 0);

    return NextResponse.json({
      exercicios: exercicios || [],
      paciente_id: consulta.patient_id,
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
