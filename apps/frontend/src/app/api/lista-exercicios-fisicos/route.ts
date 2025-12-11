import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Forçar rota dinâmica (usa cookies)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    console.log('🔍 [LISTA_EXERCICIOS] Buscando exercícios com termo:', search);

    // Buscar exercícios da tabela lista_exercicios_fisicos
    let query = supabase
      .from('lista_exercicios_fisicos')
      .select('id, atividade, grupo_muscular')
      .order('atividade', { ascending: true });

    // Se houver termo de busca, filtrar por nome da atividade
    if (search && search.length >= 2) {
      query = query.ilike('atividade', `%${search}%`);
    }

    // Limitar resultados para performance
    query = query.limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [LISTA_EXERCICIOS] Erro ao buscar:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar exercícios' },
        { status: 500 }
      );
    }

    console.log('✅ [LISTA_EXERCICIOS] Exercícios encontrados:', data?.length || 0);

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

