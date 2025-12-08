import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/dashboard - Buscar estatísticas do dashboard
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/dashboard ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name, specialty, crm, subscription_type')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Estatísticas de Pacientes
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id);

    // Consultas do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: consultasHoje } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    // Consultas concluídas no mês
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count: consultasConcluidasMes } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .eq('status', 'COMPLETED')
      .gte('created_at', inicioMes.toISOString());

    // Duração média das consultas
    const { data: consultasComDuracao } = await supabase
      .from('consultations')
      .select('duration')
      .eq('doctor_id', medico.id)
      .eq('status', 'COMPLETED')
      .not('duration', 'is', null);

    const duracaoMedia = consultasComDuracao && consultasComDuracao.length > 0
      ? consultasComDuracao.reduce((acc, c) => acc + (c.duration || 0), 0) / consultasComDuracao.length
      : 0;

    // Consultas por status
    const { data: consultasPorStatus } = await supabase
      .from('consultations')
      .select('status')
      .eq('doctor_id', medico.id);

    const statusCounts = consultasPorStatus?.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Consultas por tipo
    const { data: consultasPorTipo } = await supabase
      .from('consultations')
      .select('consultation_type')
      .eq('doctor_id', medico.id);

    const tipoCounts = consultasPorTipo?.reduce((acc, c) => {
      acc[c.consultation_type] = (acc[c.consultation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Últimas 5 consultas
    const { data: ultimasConsultas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        status,
        duration,
        created_at,
        patients:patient_id (
          name,
          email
        )
      `)
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Período alvo
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const periodParam = searchParams.get('period'); // '7d' | '15d' | '30d'
    const targetYear = yearParam ? Number(yearParam) : new Date().getFullYear();

    // Parâmetros específicos para o gráfico de Presencial/Telemedicina
    const chartPeriodParam = searchParams.get('chartPeriod'); // 'day' | 'week' | 'month' | 'year'
    const chartDateParam = searchParams.get('chartDate'); // 'YYYY-MM-DD'
    const chartMonthParam = searchParams.get('chartMonth'); // 'YYYY-MM'
    const chartYearParam = searchParams.get('chartYear'); // 'YYYY'

    // Calcular período para o gráfico de Presencial/Telemedicina
    let chartStartDate: Date;
    let chartEndDate: Date;

    if (chartPeriodParam === 'day' && chartDateParam) {
      // Dia específico
      const selectedDate = new Date(chartDateParam + 'T00:00:00');
      chartStartDate = new Date(selectedDate);
      chartStartDate.setHours(0, 0, 0, 0);
      chartEndDate = new Date(selectedDate);
      chartEndDate.setHours(23, 59, 59, 999);
    } else if (chartPeriodParam === 'week' && chartDateParam) {
      // Semana (segunda a domingo) que contém a data selecionada
      const selectedDate = new Date(chartDateParam + 'T00:00:00');
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajustar para segunda-feira
      chartStartDate = new Date(selectedDate);
      chartStartDate.setDate(selectedDate.getDate() + diff);
      chartStartDate.setHours(0, 0, 0, 0);
      chartEndDate = new Date(chartStartDate);
      chartEndDate.setDate(chartStartDate.getDate() + 6);
      chartEndDate.setHours(23, 59, 59, 999);
    } else if (chartPeriodParam === 'month' && chartMonthParam) {
      // Mês específico
      const [year, month] = chartMonthParam.split('-').map(Number);
      chartStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const lastDay = new Date(year, month, 0).getDate();
      chartEndDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59));
    } else if (chartPeriodParam === 'year' && chartYearParam) {
      // Ano específico
      const year = Number(chartYearParam);
      chartStartDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
      chartEndDate = year === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    } else {
      // Fallback: usar o período padrão (ano atual)
      chartStartDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
      chartEndDate = targetYear === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
    }

    // Se ano informado, buscamos do início do ano até hoje (ou final do ano se for passado)
    let startDateRange: Date;
    let endDateRange: Date;

    if (periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      const days = Number(periodParam.replace('d', ''));
      endDateRange = new Date();
      startDateRange = new Date();
      startDateRange.setDate(startDateRange.getDate() - days + 1);
    } else {
      // fallback por ano
      startDateRange = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
      endDateRange = targetYear === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
    }

    // Buscar consultas para o gráfico de Presencial/Telemedicina usando o período específico
    const { data: consultasUltimos30Dias } = await supabase
      .from('consultations')
      .select('created_at, status, consultation_type')
      .eq('doctor_id', medico.id)
      .gte('created_at', chartStartDate.toISOString())
      .lte('created_at', chartEndDate.toISOString())
      .order('created_at', { ascending: true });

    // Agrupar por dia (considerando fuso horário de São Paulo para não "trocar" o dia)
    const TIMEZONE = 'America/Sao_Paulo';
    const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const consultasPorDia = consultasUltimos30Dias?.reduce((acc, c) => {
      const dateKey = dayKeyFormatter.format(new Date(c.created_at)); // yyyy-mm-dd na TZ de SP
      if (!acc[dateKey]) {
        acc[dateKey] = { total: 0, presencial: 0, telemedicina: 0, concluidas: 0 };
      }
      acc[dateKey].total += 1;
      if (c.consultation_type === 'PRESENCIAL') {
        acc[dateKey].presencial += 1;
      } else {
        acc[dateKey].telemedicina += 1;
      }
      if (c.status === 'COMPLETED') {
        acc[dateKey].concluidas += 1;
      }
      return acc;
    }, {} as Record<string, any>) || {};

    // Transformar em array para o gráfico
    const graficoConsultas = Object.entries(consultasPorDia).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Taxa de sucesso
    const totalConsultas = Object.values(statusCounts).reduce((acc, count) => acc + count, 0);
    const taxaSucesso = totalConsultas > 0 
      ? ((statusCounts.COMPLETED || 0) / totalConsultas) * 100 
      : 0;

    // Próximas consultas (hoje e amanhã)
    const { data: proximasConsultas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        created_at,
        patients:patient_id (
          name,
          email
        )
      `)
      .eq('doctor_id', medico.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: true })
      .limit(5);

    return NextResponse.json({
      medico: {
        id: medico.id,
        name: medico.name,
        specialty: medico.specialty,
        crm: medico.crm,
        subscription_type: medico.subscription_type
      },
      estatisticas: {
        totalPacientes: totalPatients || 0,
        consultasHoje: consultasHoje || 0,
        consultasConcluidasMes: consultasConcluidasMes || 0,
        duracaoMediaSegundos: Math.round(duracaoMedia),
        taxaSucesso: Math.round(taxaSucesso * 100) / 100
      },
      distribuicoes: {
        porStatus: statusCounts,
        porTipo: tipoCounts
      },
      atividades: {
        ultimasConsultas: ultimasConsultas || [],
        proximasConsultas: proximasConsultas || []
      },
      graficos: {
        consultasPorDia: graficoConsultas
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Erro no endpoint GET /api/dashboard:', message);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: message },
      { status: 500 }
    );
  }
}
