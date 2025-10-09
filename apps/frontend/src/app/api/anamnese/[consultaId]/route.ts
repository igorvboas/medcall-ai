import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedSession } from '@/lib/supabase-server';

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

    // Buscar dados de todas as tabelas de anamnese
    // Usando Promise.allSettled para não falhar se alguma tabela não tiver dados
    // Usando order + limit(1) ao invés de maybeSingle() para lidar com duplicatas
    const results = await Promise.allSettled([
      supabase
        .from('a_cadastro_prontuario')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_objetivos_queixas')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_historico_risco')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_observacao_clinica_lab')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_historia_vida')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_setenios_eventos')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_ambiente_contexto')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_sensacao_emocoes')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_preocupacoes_crencas')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('a_reino_miasma')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    // Extrair dados dos resultados, ignorando erros
    const tableNames = [
      'a_cadastro_prontuario',
      'a_objetivos_queixas',
      'a_historico_risco',
      'a_observacao_clinica_lab',
      'a_historia_vida',
      'a_setenios_eventos',
      'a_ambiente_contexto',
      'a_sensacao_emocoes',
      'a_preocupacoes_crencas',
      'a_reino_miasma',
    ];

    const [
      cadastroProntuario,
      objetivosQueixas,
      historicoRisco,
      observacaoClinicaLab,
      historiaVida,
      seteniosEventos,
      ambienteContexto,
      sensacaoEmocoes,
      preocupacoesCrencas,
      reinoMiasma,
    ] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        console.log(`✅ ${tableNames[index]}:`, value.error ? 'ERRO - ' + value.error.message : 'OK');
        return value;
      }
      console.log(`❌ ${tableNames[index]}: Falha na Promise -`, result.reason);
      return { data: null, error: null };
    });

    // Função para remover campos desnecessários e lidar com erros
    const cleanData = (result: any) => {
      // Se houver erro (como PGRST116 - não encontrado), retornar null
      if (result.error) {
        console.log('Registro não encontrado:', result.error.message);
        return null;
      }
      
      if (!result.data) return null;
      
      const { id, created_at, user_id, paciente_id, consulta_id, ...rest } = result.data;
      return rest;
    };

    // Preparar resposta com dados limpos
    const anamneseData = {
      cadastro_prontuario: cleanData(cadastroProntuario),
      objetivos_queixas: cleanData(objetivosQueixas),
      historico_risco: cleanData(historicoRisco),
      observacao_clinica_lab: cleanData(observacaoClinicaLab),
      historia_vida: cleanData(historiaVida),
      setenios_eventos: cleanData(seteniosEventos),
      ambiente_contexto: cleanData(ambienteContexto),
      sensacao_emocoes: cleanData(sensacaoEmocoes),
      preocupacoes_crencas: cleanData(preocupacoesCrencas),
      reino_miasma: cleanData(reinoMiasma),
    };

    // Retornar dados mesmo que estejam vazios
    return NextResponse.json(anamneseData);

  } catch (error: any) {
    console.error('Erro ao buscar dados de anamnese:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados de anamnese', details: error.message },
      { status: 500 }
    );
  }
}

