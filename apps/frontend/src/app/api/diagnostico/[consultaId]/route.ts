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

    // 1. Diagnóstico Principal
    const { data: diagnostico_principal, error: diagnosticoError } = await supabase
      .from('d_diagnostico_principal')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    
    console.log('📊 Diagnóstico Principal:', { diagnostico_principal, diagnosticoError });

    // 2. Estado Geral
    const { data: estado_geral, error: estadoGeralError } = await supabase
      .from('d_estado_geral')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    console.log('📊 Estado Geral:', { estado_geral, estadoGeralError });

    // 3. Estado Mental
    const { data: estado_mental, error: estadoMentalError } = await supabase
      .from('d_estado_mental')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    console.log('📊 Estado Mental:', { estado_mental, estadoMentalError });

    // 4. Estado Fisiológico
    const { data: estado_fisiologico, error: estadoFisiologicoError } = await supabase
      .from('d_estado_fisiologico')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    console.log('📊 Estado Fisiológico:', { estado_fisiologico, estadoFisiologicoError });

    // 5. Integração Diagnóstica
    const { data: integracao_diagnostica, error: integracaoError } = await supabase
      .from('d_agente_integracao_diagnostica')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    console.log('📊 Integração Diagnóstica:', { integracao_diagnostica, integracaoError });

    // 6. Hábitos de Vida
    const { data: habitos_vida, error: habitosError } = await supabase
      .from('d_agente_habitos_vida_sistemica')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();
    console.log('📊 Hábitos de Vida:', { habitos_vida, habitosError });

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
