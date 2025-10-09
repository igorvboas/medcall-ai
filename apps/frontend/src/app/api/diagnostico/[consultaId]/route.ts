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

    // Buscar dados de diagnóstico das 5 tabelas
    const userId = medico.id;

    // 1. Diagnóstico Principal
    const { data: diagnostico_principal } = await supabase
      .from('d_diagnostico_principal')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    // 2. Estado Geral
    const { data: estado_geral } = await supabase
      .from('d_estado_geral')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    // 3. Estado Mental
    const { data: estado_mental } = await supabase
      .from('d_estado_mental')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    // 4. Estado Fisiológico
    const { data: estado_fisiologico } = await supabase
      .from('d_estado_fisiologico')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    // 5. Integração Diagnóstica
    const { data: integracao_diagnostica } = await supabase
      .from('d_agente_integracao_diagnostica')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    // 6. Hábitos de Vida
    const { data: habitos_vida } = await supabase
      .from('d_agente_habitos_vida_sistemica')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

    return NextResponse.json({
      diagnostico_principal,
      estado_geral,
      estado_mental,
      estado_fisiologico,
      integracao_diagnostica,
      habitos_vida
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/diagnostico/[consultaId]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
