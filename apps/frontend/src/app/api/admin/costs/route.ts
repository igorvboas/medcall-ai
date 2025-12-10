import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// GET: Buscar custos de AI
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .maybeSingle();

    if (medicoError || !medico?.admin) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 });
    }

    // Buscar parâmetros de query
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d, all
    const groupBy = searchParams.get('groupBy') || 'day'; // day, hour, model, etapa

    // Calcular data de início baseada no período
    let startDate: Date | null = null;
    if (period !== 'all') {
      const days = parseInt(period.replace('d', ''));
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Query base para custos
    let query = supabase
      .from('ai_pricing')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data: pricingData, error: pricingError } = await query;

    if (pricingError) {
      console.error('Erro ao buscar ai_pricing:', pricingError);
      return NextResponse.json({ error: 'Erro ao buscar dados de custo' }, { status: 500 });
    }

    // Processar dados para estatísticas
    const stats = {
      total: 0,
      totalTester: 0,
      totalProduction: 0,
      byModel: {} as Record<string, { count: number; cost: number; tokens: number }>,
      byEtapa: {} as Record<string, { count: number; cost: number }>,
      byDay: {} as Record<string, { count: number; cost: number }>,
      byHour: {} as Record<string, { count: number; cost: number }>,
      recentRecords: [] as any[],
      totalRecords: pricingData?.length || 0,
    };

    for (const record of pricingData || []) {
      const price = record.price || 0;
      stats.total += price;

      if (record.tester) {
        stats.totalTester += price;
      } else {
        stats.totalProduction += price;
      }

      // Por modelo
      if (record.LLM) {
        if (!stats.byModel[record.LLM]) {
          stats.byModel[record.LLM] = { count: 0, cost: 0, tokens: 0 };
        }
        stats.byModel[record.LLM].count++;
        stats.byModel[record.LLM].cost += price;
        stats.byModel[record.LLM].tokens += record.token || 0;
      }

      // Por etapa
      if (record.etapa) {
        if (!stats.byEtapa[record.etapa]) {
          stats.byEtapa[record.etapa] = { count: 0, cost: 0 };
        }
        stats.byEtapa[record.etapa].count++;
        stats.byEtapa[record.etapa].cost += price;
      }

      // Por dia
      if (record.created_at) {
        const day = new Date(record.created_at).toISOString().split('T')[0];
        if (!stats.byDay[day]) {
          stats.byDay[day] = { count: 0, cost: 0 };
        }
        stats.byDay[day].count++;
        stats.byDay[day].cost += price;

        // Por hora (últimas 24 horas)
        const hour = new Date(record.created_at).toISOString().slice(0, 13);
        if (!stats.byHour[hour]) {
          stats.byHour[hour] = { count: 0, cost: 0 };
        }
        stats.byHour[hour].count++;
        stats.byHour[hour].cost += price;
      }
    }

    // Pegar os últimos 50 registros para exibição detalhada
    stats.recentRecords = (pricingData || []).slice(0, 50).map(record => ({
      id: record.id,
      consulta_id: record.consulta_id,
      LLM: record.LLM,
      token: record.token,
      price: record.price,
      tester: record.tester,
      etapa: record.etapa,
      created_at: record.created_at,
    }));

    // Buscar consultas com status RECORDING (possíveis conexões ativas)
    const { data: activeConsultations, error: consultationsError } = await supabase
      .from('consultations')
      .select(`
        id,
        status,
        room_id,
        created_at,
        consulta_inicio,
        patients!inner(name),
        medicos!consultations_doctor_id_fkey(name, email)
      `)
      .eq('status', 'RECORDING')
      .order('created_at', { ascending: false });

    if (consultationsError) {
      console.error('Erro ao buscar consultas ativas:', consultationsError);
    }

    // Buscar sessões de call ativas
    const { data: activeSessions, error: sessionsError } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Erro ao buscar sessões ativas:', sessionsError);
    }

    return NextResponse.json({
      success: true,
      stats,
      activeConsultations: activeConsultations || [],
      activeSessions: activeSessions || [],
      period,
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST: Ações administrativas (forçar encerramento de conexões)
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .maybeSingle();

    if (medicoError || !medico?.admin) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { action, consultationId, sessionId } = body;

    if (action === 'force_close_consultation') {
      // Forçar fechamento de uma consulta
      const { error: updateError } = await supabase
        .from('consultations')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', consultationId);

      if (updateError) {
        return NextResponse.json({ error: 'Erro ao fechar consulta' }, { status: 500 });
      }

      // Tentar chamar o gateway para encerrar a sala
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3333';
      try {
        const { data: consultation } = await supabase
          .from('consultations')
          .select('room_id')
          .eq('id', consultationId)
          .single();

        if (consultation?.room_id) {
          await fetch(`${gatewayUrl}/api/rooms/${consultation.room_id}/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Encerrado pelo administrador (monitor de custos)' }),
          });
        }
      } catch (e) {
        console.warn('Não foi possível notificar o gateway:', e);
      }

      return NextResponse.json({ success: true, message: 'Consulta fechada com sucesso' });
    }

    if (action === 'force_close_session') {
      // Forçar fechamento de uma sessão
      const { error: updateError } = await supabase
        .from('call_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        return NextResponse.json({ error: 'Erro ao fechar sessão' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Sessão fechada com sucesso' });
    }

    if (action === 'close_all_recording') {
      // Fechar TODAS as consultas em status RECORDING
      const { data: recordingConsultations, error: fetchError } = await supabase
        .from('consultations')
        .select('id, room_id')
        .eq('status', 'RECORDING');

      if (fetchError) {
        return NextResponse.json({ error: 'Erro ao buscar consultas' }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from('consultations')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'RECORDING');

      if (updateError) {
        return NextResponse.json({ error: 'Erro ao fechar consultas' }, { status: 500 });
      }

      // Tentar notificar o gateway para cada sala
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3333';
      for (const consultation of recordingConsultations || []) {
        if (consultation.room_id) {
          try {
            await fetch(`${gatewayUrl}/api/rooms/${consultation.room_id}/end`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Encerrado pelo administrador (fechamento em massa)' }),
            });
          } catch (e) {
            console.warn(`Não foi possível notificar o gateway para sala ${consultation.room_id}:`, e);
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `${recordingConsultations?.length || 0} consulta(s) fechada(s)` 
      });
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

