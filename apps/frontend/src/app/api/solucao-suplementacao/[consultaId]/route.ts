import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/solucao-suplementacao/[consultaId] - Buscar dados de Suplementação
export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== GET /api/solucao-suplementacao/[consultaId] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;
    const doctorAuthId = user.id;
    const consultaId = params.consultaId;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const userId = medico.id;

    console.log('🔍 Buscando suplementação para consulta_id:', consultaId);

    // Buscar dados de Suplementação da tabela s_suplementacao2
    // Filtrar APENAS por consulta_id (não por user_id)
    const { data: suplementacaoRaw, error: suplementacaoError } = await supabase
      .from('s_suplementacao2')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('📊 Resultado da busca:', { 
      encontrado: !!suplementacaoRaw, 
      erro: suplementacaoError?.message,
      errorCode: suplementacaoError?.code
    });

    if (suplementacaoError && suplementacaoError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar suplementação:', suplementacaoError);
      return NextResponse.json({ error: 'Erro ao buscar dados de suplementação' }, { status: 500 });
    }

    // Se não houver dados, retornar estrutura vazia
    if (!suplementacaoRaw) {
      console.log('⚠️ Nenhum dado encontrado, retornando estrutura vazia');
      return NextResponse.json({
        suplementacao_data: {
          suplementos: [],
          fitoterapicos: [],
          homeopatia: [],
          florais_bach: []
        }
      });
    }

    console.log('📦 Dados brutos do banco:', JSON.stringify(suplementacaoRaw, null, 2));

    // Parse dos arrays de JSON strings
    const parseJsonArray = (arr: string[] | null): any[] => {
      if (!arr || !Array.isArray(arr)) return [];
      try {
        return arr.map(item => JSON.parse(item));
      } catch (error) {
        console.error('Erro ao fazer parse de array:', error);
        return [];
      }
    };

    const suplementacao_data = {
      id: suplementacaoRaw.id,
      suplementos: parseJsonArray(suplementacaoRaw.suplementos),
      fitoterapicos: parseJsonArray(suplementacaoRaw.fitoterapicos),
      homeopatia: parseJsonArray(suplementacaoRaw.homeopatia),
      florais_bach: parseJsonArray(suplementacaoRaw.florais_bach),
      created_at: suplementacaoRaw.created_at,
      consulta_id: suplementacaoRaw.consulta_id
    };

    console.log('✅ Dados de suplementação parseados:', suplementacao_data);

    return NextResponse.json({
      suplementacao_data
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/solucao-suplementacao/[consultaId]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

