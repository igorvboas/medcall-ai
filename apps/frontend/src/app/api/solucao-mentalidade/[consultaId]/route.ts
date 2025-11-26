import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/solucao-mentalidade/[consultaId] - Buscar dados de Mentalidade
export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== GET /api/solucao-mentalidade/[consultaId] ===');
    
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

    console.log('🔍 [MENTALIDADE] Buscando dados para consulta_id:', consultaId);

    // Buscar dados de Mentalidade da tabela s_agente_mentalidade_2
    // Filtrar APENAS por consulta_id
    const { data: mentalidadeRaw, error: mentalidadeError } = await supabase
      .from('s_agente_mentalidade_2')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('📊 [MENTALIDADE] Resultado:', { 
      encontrado: !!mentalidadeRaw,
      erro: mentalidadeError?.message 
    });

    if (mentalidadeError && mentalidadeError.code !== 'PGRST116') {
      console.error('❌ [MENTALIDADE] Erro ao buscar:', mentalidadeError);
      return NextResponse.json({ error: 'Erro ao buscar dados de mentalidade' }, { status: 500 });
    }

    // Se não houver dados, retornar estrutura vazia
    if (!mentalidadeRaw) {
      console.log('⚠️ [MENTALIDADE] Nenhum dado encontrado');
      return NextResponse.json({
        mentalidade_data: {
          resumo_executivo: null,
          padrao_01: null,
          padrao_02: null,
          padrao_03: null,
          padrao_04: null,
          padrao_05: null,
          padrao_06: null,
          padrao_07: null,
          padrao_08: null,
          padrao_09: null,
          padrao_10: null
        }
      });
    }

    // Parse dos campos JSONB (que são strings JSON)
    const parseJsonField = (field: any) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          console.error('Erro ao fazer parse do campo:', e);
          return field;
        }
      }
      return field;
    };

    const mentalidade_data = {
      id: mentalidadeRaw.id,
      resumo_executivo: parseJsonField(mentalidadeRaw.resumo_executivo),
      padrao_01: parseJsonField(mentalidadeRaw.padrao_01),
      padrao_02: parseJsonField(mentalidadeRaw.padrao_02),
      padrao_03: parseJsonField(mentalidadeRaw.padrao_03),
      padrao_04: parseJsonField(mentalidadeRaw.padrao_04),
      padrao_05: parseJsonField(mentalidadeRaw.padrao_05),
      padrao_06: parseJsonField(mentalidadeRaw.padrao_06),
      padrao_07: parseJsonField(mentalidadeRaw.padrao_07),
      padrao_08: parseJsonField(mentalidadeRaw.padrao_08),
      padrao_09: parseJsonField(mentalidadeRaw.padrao_09),
      padrao_10: parseJsonField(mentalidadeRaw.padrao_10),
      created_at: mentalidadeRaw.created_at,
      consulta_id: mentalidadeRaw.consulta_id
    };

    console.log('✅ [MENTALIDADE] Dados parseados com sucesso');

    return NextResponse.json({
      mentalidade_data
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/solucao-mentalidade/[consultaId]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

