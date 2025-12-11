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

    if (!id || !field) {
      return NextResponse.json(
        { error: 'ID do exercício e campo são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔍 [UPDATE-EXERCICIO] Atualizando:', { id, field, value, consultaId });

    // Atualizar o campo específico na tabela s_exercicios_fisicos
    // Apenas pelo ID do exercício (sem filtro por consulta_id pois pode não existir)
    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .update({ [field]: value })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [UPDATE-EXERCICIO] Erro ao atualizar:', error);
      
      // Log detalhado para debug
      console.error('❌ [UPDATE-EXERCICIO] Detalhes:', {
        id,
        field,
        value,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      });
      
      return NextResponse.json(
        { error: 'Erro ao atualizar exercício', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('❌ [UPDATE-EXERCICIO] Nenhum registro encontrado com id:', id);
      return NextResponse.json(
        { error: 'Exercício não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ [UPDATE-EXERCICIO] Sucesso:', data);

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ [UPDATE-EXERCICIO] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
