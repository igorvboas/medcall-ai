import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('lista_exercicios_fisicos')
      .select('id, atividade, grupo_muscular')
      .order('atividade', { ascending: true });

    if (search && search.length >= 2) {
      query = query.ilike('atividade', `%${search}%`);
    }

    query = query.limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [LISTA_EXERCICIOS] Erro ao buscar:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar exercícios' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exercicios: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('💥 [LISTA_EXERCICIOS] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

