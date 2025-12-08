import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta não fornecido' },
        { status: 400 }
      );
    }

    // Verificar autenticação usando helper
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      console.error('❌ Falha na autenticação: Sessão não encontrada');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { supabase, user } = authResult;
    console.log('✅ Usuário autenticado:', user.id);

    // Buscar síntese analítica
    const { data: sinteseAnalitica, error: sinteseError } = await supabase
      .from('a_sintese_analitica')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sinteseError && sinteseError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar síntese analítica:', sinteseError);
      return NextResponse.json(
        { error: 'Erro ao buscar síntese analítica', details: sinteseError.message },
        { status: 500 }
      );
    }

    // Se não encontrou, retornar null
    if (!sinteseAnalitica) {
      return NextResponse.json(null);
    }

    // Remover campos técnicos
    const { id, created_at, user_id, paciente_id, consulta_id, ...rest } = sinteseAnalitica;

    return NextResponse.json(rest);

  } catch (error: any) {
    console.error('Erro ao buscar síntese analítica:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar síntese analítica', details: error.message },
      { status: 500 }
    );
  }
}

