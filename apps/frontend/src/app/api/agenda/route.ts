import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/agenda?year=YYYY&month=MM (1-12)
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSession();
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { supabase, user } = authResult;
    const doctorAuthId = user.id;

    // Resolve médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return NextResponse.json({ error: 'Médico não encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = Number(searchParams.get('year') || new Date().getFullYear());
    const monthParam = Number(searchParams.get('month') || (new Date().getMonth() + 1)); // 1-12

    // Período do mês na TZ de São Paulo
    const startUtc = new Date(Date.UTC(yearParam, monthParam - 1, 1, 0, 0, 0));
    const endUtc = new Date(Date.UTC(yearParam, monthParam, 0, 23, 59, 59));

    // Buscar consultas do mês (usando consulta_inicio se disponível, senão created_at)
    // Primeiro, buscar por created_at no período
    const { data: rowsByCreated, error: error1 } = await supabase
      .from('consultations')
      .select('id, patient_id, patient_name, consultation_type, status, duration, created_at, consulta_inicio')
      .eq('doctor_id', medico.id)
      .gte('created_at', startUtc.toISOString())
      .lte('created_at', endUtc.toISOString());

    // Depois, buscar por consulta_inicio no período (para agendamentos)
    const { data: rowsByAgendamento, error: error2 } = await supabase
      .from('consultations')
      .select('id, patient_id, patient_name, consultation_type, status, duration, created_at, consulta_inicio')
      .eq('doctor_id', medico.id)
      .not('consulta_inicio', 'is', null)
      .gte('consulta_inicio', startUtc.toISOString())
      .lte('consulta_inicio', endUtc.toISOString());

    const error = error1 || error2;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Combinar resultados e remover duplicatas
    const allRows = [...(rowsByCreated || []), ...(rowsByAgendamento || [])];
    const uniqueRows = allRows.filter((row, index, self) => 
      index === self.findIndex((r) => r.id === row.id)
    );

    // Ordenar por data (consulta_inicio se disponível, senão created_at)
    uniqueRows.sort((a, b) => {
      const dateA = new Date(a.consulta_inicio || a.created_at);
      const dateB = new Date(b.consulta_inicio || b.created_at);
      return dateA.getTime() - dateB.getTime();
    });

    // Map para o front
    const items = uniqueRows.map((c) => ({
      id: c.id,
      patient: c.patient_name,
      patient_id: c.patient_id,
      consultation_type: c.consultation_type,
      status: c.status, // Status real do banco
      duration: c.duration,
      created_at: c.created_at,
      consulta_inicio: c.consulta_inicio
    }));

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


