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

    // Buscar dados de Mentalidade
    const { data: mentalidade_data } = await supabase
      .from('s_agente_mentalidade_do_paciente')
      .select('*')
      .eq('user_id', userId)
      .eq('consulta_id', consultaId)
      .single();

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

