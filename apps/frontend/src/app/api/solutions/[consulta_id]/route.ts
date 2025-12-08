import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { consulta_id: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const consultaId = params.consulta_id;

    if (!consultaId) {
      return NextResponse.json({ error: 'Consulta ID é obrigatório' }, { status: 400 });
    }

    // Primeiro, buscar o paciente_id da consulta
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .single();

    if (consultaError || !consulta) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }

    const pacienteId = consulta.patient_id;

    // Buscar dados de todas as 6 tabelas de soluções
    
    const [
      ltbResult,
      mentalidadeResult,
      alimentacaoResult,
      suplementacaoResult,
      exerciciosResult,
      habitosResult
    ] = await Promise.all([
      // 1. LTB - Limpeza do Terreno Biológico
      supabase
        .from('s_agente_limpeza_do_terreno_biologico')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1),

      // 2. Mentalidade do Paciente
      supabase
        .from('s_agente_mentalidade_do_paciente')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1),

      // 3. Gramaturas Alimentares (usa paciente_id)
      supabase
        .from('s_gramaturas_alimentares')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }),

      // 4. Suplementação
      supabase
        .from('s_suplementacao')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1),

      // 5. Exercícios Físicos (usa paciente_id)
      supabase
        .from('s_exercicios_fisicos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }),

      // 6. Hábitos de Vida
      supabase
        .from('s_agente_habitos_de_vida_final')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    // Verificar erros
    const errors = [
      ltbResult.error,
      mentalidadeResult.error,
      alimentacaoResult.error,
      suplementacaoResult.error,
      exerciciosResult.error,
      habitosResult.error
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Erros ao buscar soluções:', errors);
      return NextResponse.json({ error: 'Erro ao buscar dados das soluções' }, { status: 500 });
    }

    // Retornar dados organizados
    const solutions = {
      ltb: ltbResult.data?.[0] || null,
      mentalidade: mentalidadeResult.data?.[0] || null,
      alimentacao: alimentacaoResult.data || [],
      suplementacao: suplementacaoResult.data?.[0] || null,
      exercicios: exerciciosResult.data || [],
      habitos: habitosResult.data?.[0] || null
    };

    return NextResponse.json({ solutions });

  } catch (error) {
    console.error('Erro na API de soluções:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
