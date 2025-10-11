import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;
    const body = await request.json();
    const { id, field, value } = body;

    if (!consultaId || !id || !field) {
      return NextResponse.json(
        { error: 'ID da consulta, ID do exercício e campo são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔍 DEBUG [REFERENCIA] Atualizando campo de exercício:', { id, field, value });

    // Atualizar o campo específico na tabela s_exercicios_fisicos
    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .update({ [field]: value })
      .eq('id', id)
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar exercício:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar exercício' },
        { status: 500 }
      );
    }

    console.log('🔍 DEBUG [REFERENCIA] Exercício atualizado com sucesso:', data);

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Erro interno na API de atualização de atividade física:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
