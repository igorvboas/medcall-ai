import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/diagnostico/[consultaId] - Buscar dados de diagnóstico
export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    console.log('=== GET /api/diagnostico/[consultaId] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;
    const doctorAuthId = user.id;
    const consultaId = params.consultaId;
    
    console.log('🔍 Usuário autenticado:', { doctorAuthId, consultaId });

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    console.log('👨‍⚕️ Médico encontrado:', { medico, medicoError });
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    // Buscar dados de diagnóstico das 5 tabelas
    const userId = medico.id;
    console.log('🔍 Buscando dados de diagnóstico para:', { userId, consultaId });

    // Buscar todos os dados em paralelo para melhor performance
    // 1. Diagnóstico Principal
    const diagnosticoPromise = supabase
      .from('d_diagnostico_principal')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    
    // 2. Estado Geral
    const estadoGeralPromise = supabase
      .from('d_estado_geral')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // 3. Estado Mental
    const estadoMentalPromise = supabase
      .from('d_estado_mental')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // 4. Estado Fisiológico
    const estadoFisiologicoPromise = supabase
      .from('d_estado_fisiologico')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // 5. Integração Diagnóstica
    const integracaoPromise = supabase
      .from('d_agente_integracao_diagnostica')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // 6. Hábitos de Vida
    const habitosPromise = supabase
      .from('d_agente_habitos_vida_sistemica')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // Aguardar todas as queries em paralelo
    const [
      { data: diagnostico_principal, error: diagnosticoError },
      { data: estado_geral, error: estadoGeralError },
      { data: estado_mental, error: estadoMentalError },
      { data: estado_fisiologico, error: estadoFisiologicoError },
      { data: integracao_diagnostica, error: integracaoError },
      { data: habitos_vida, error: habitosError }
    ] = await Promise.all([
      diagnosticoPromise,
      estadoGeralPromise,
      estadoMentalPromise,
      estadoFisiologicoPromise,
      integracaoPromise,
      habitosPromise
    ]);
    
    // Log de erros (mas não falhar se alguma tabela não tiver dados)
    if (diagnosticoError) console.warn('⚠️ Erro ao buscar Diagnóstico Principal:', diagnosticoError);
    if (estadoGeralError) console.warn('⚠️ Erro ao buscar Estado Geral:', estadoGeralError);
    if (estadoMentalError) console.warn('⚠️ Erro ao buscar Estado Mental:', estadoMentalError);
    if (estadoFisiologicoError) console.warn('⚠️ Erro ao buscar Estado Fisiológico:', estadoFisiologicoError);
    if (integracaoError) console.warn('⚠️ Erro ao buscar Integração Diagnóstica:', integracaoError);
    if (habitosError) console.warn('⚠️ Erro ao buscar Hábitos de Vida:', habitosError);

    console.log('📊 Dados de diagnóstico carregados:', {
      diagnostico_principal: !!diagnostico_principal,
      estado_geral: !!estado_geral,
      estado_mental: !!estado_mental,
      estado_fisiologico: !!estado_fisiologico,
      integracao_diagnostica: !!integracao_diagnostica,
      habitos_vida: !!habitos_vida
    });

    const result = {
      diagnostico_principal,
      estado_geral,
      estado_mental,
      estado_fisiologico,
      integracao_diagnostica,
      habitos_vida
    };
    
    console.log('✅ Retornando dados de diagnóstico:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro no endpoint GET /api/diagnostico/[consultaId]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
