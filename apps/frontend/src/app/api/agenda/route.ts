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

    // Buscar consultas do mês
    const { data: rows, error } = await supabase
      .from('consultations')
      .select('id, patient_name, consultation_type, status, duration, created_at')
      .eq('doctor_id', medico.id)
      .gte('created_at', startUtc.toISOString())
      .lte('created_at', endUtc.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map para o front
    const items = (rows || []).map((c) => ({
      id: c.id,
      patient: c.patient_name,
      consultation_type: c.consultation_type,
      status: c.status,
      duration: c.duration,
      created_at: c.created_at
    }));

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


