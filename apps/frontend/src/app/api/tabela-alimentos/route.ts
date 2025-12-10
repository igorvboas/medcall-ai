import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    console.log('🔍 [TABELA_ALIMENTOS] Buscando alimentos com termo:', search);

    // Buscar alimentos da tabela tabela_alimentos
    let query = supabase
      .from('tabela_alimentos')
      .select('numero_do_alimento, alimento, energia_kcal, proteina, lipideos, hidrato, fibra_alimentar')
      .order('alimento', { ascending: true });

    // Se houver termo de busca, filtrar por nome do alimento
    if (search && search.length >= 2) {
      query = query.ilike('alimento', `%${search}%`);
    }

    // Limitar resultados para performance
    query = query.limit(50);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [TABELA_ALIMENTOS] Erro ao buscar:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar alimentos' },
        { status: 500 }
      );
    }

    console.log('✅ [TABELA_ALIMENTOS] Alimentos encontrados:', data?.length || 0);

    return NextResponse.json({
      alimentos: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('💥 [TABELA_ALIMENTOS] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

