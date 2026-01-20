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

    // Período alvo - MOVER PARA O INÍCIO para poder usar nas consultas
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const periodParam = searchParams.get('period'); // 'hoje' | '7d' | '15d' | '30d'
    const targetYear = yearParam ? Number(yearParam) : new Date().getFullYear();

    // Calcular período para filtros de estatísticas
    let startDateRange: Date;
    let endDateRange: Date;

    if (periodParam === 'hoje') {
      // Filtrar apenas o dia atual
      const hoje = new Date();
      startDateRange = new Date(hoje);
      startDateRange.setHours(0, 0, 0, 0);
      endDateRange = new Date(hoje);
      endDateRange.setHours(23, 59, 59, 999);
    } else if (periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      const days = Number(periodParam.replace('d', ''));
      endDateRange = new Date();
      startDateRange = new Date();
      startDateRange.setDate(startDateRange.getDate() - days + 1);
      startDateRange.setHours(0, 0, 0, 0);
      endDateRange.setHours(23, 59, 59, 999);
    } else {
      // fallback por ano
      startDateRange = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
      endDateRange = targetYear === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
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

    // Consultas concluídas (filtradas por período se informado, senão no mês atual)
    let consultasConcluidasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .eq('status', 'COMPLETED');
    
    if (periodParam === 'hoje' || periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      // Se período informado, usar o período selecionado
      consultasConcluidasQuery = consultasConcluidasQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
      
      console.log('📅 [DASHBOARD] Filtrando consultas concluídas por período:', {
        periodParam,
        startDate: startDateRange.toISOString(),
        endDate: endDateRange.toISOString()
      });
    } else {
      // Senão, usar mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      consultasConcluidasQuery = consultasConcluidasQuery
        .gte('created_at', inicioMes.toISOString());
    }
    
    const { count: consultasConcluidasMes, error: errorConcluidas } = await consultasConcluidasQuery;
    
    if (errorConcluidas) {
      console.error('❌ [DASHBOARD] Erro ao buscar consultas concluídas:', errorConcluidas);
    }

    // Duração média das consultas (geral e por tipo) - filtradas por período se informado
    // Buscar consultas finalizadas (COMPLETED) ou em processamento (PROCESSING) que tenham duração
    // Também calcular duração a partir de consulta_inicio e consulta_fim se não houver duration/duracao
    let consultasComDuracaoQuery = supabase
      .from('consultations')
      .select('id, duration, duracao, consultation_type, created_at, consulta_inicio, consulta_fim, status')
      .eq('doctor_id', medico.id)
      .in('status', ['COMPLETED', 'PROCESSING', 'VALID_SOLUCAO']);
    
    // Aplicar filtro de período se fornecido
    if (periodParam === 'hoje' || periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      consultasComDuracaoQuery = consultasComDuracaoQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: todasConsultas, error: errorDuracao } = await consultasComDuracaoQuery;

    if (errorDuracao) {
      console.error('❌ [DASHBOARD] Erro ao buscar consultas com duração:', errorDuracao);
    }

    // Filtrar e calcular duração: considerar duration, duracao ou calcular a partir de consulta_inicio/consulta_fim
    const calcularDuracaoEmSegundos = (c: any) => {
      // Prioridade 1: usar duration (em segundos)
      if (c.duration != null && c.duration !== undefined && c.duration > 0) {
        return Number(c.duration);
      }
      
      // Prioridade 2: usar duracao (pode estar em segundos ou minutos)
      if (c.duracao != null && c.duracao !== undefined && c.duracao > 0) {
        const duracaoValue = Number(c.duracao);
        // Se o valor for muito pequeno (menos de 60), pode estar em minutos, converter
        return duracaoValue < 60 && duracaoValue > 0 ? duracaoValue * 60 : duracaoValue;
      }
      
      // Prioridade 3: calcular a partir de consulta_inicio e consulta_fim
      if (c.consulta_inicio && c.consulta_fim) {
        const inicio = new Date(c.consulta_inicio).getTime();
        const fim = new Date(c.consulta_fim).getTime();
        const diffSegundos = Math.max(0, Math.round((fim - inicio) / 1000));
        if (diffSegundos > 0) {
          return diffSegundos;
        }
      }
      
      return 0;
    };

    // Filtrar apenas consultas que têm duração válida (> 0)
    const consultasComDuracao = todasConsultas?.filter(c => {
      const duracao = calcularDuracaoEmSegundos(c);
      return duracao > 0;
    }) || [];

    const duracaoMedia = consultasComDuracao.length > 0
      ? consultasComDuracao.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasComDuracao.length
      : 0;
    
    console.log('⏱️ [DASHBOARD] Duração média calculada:', {
      periodParam,
      totalConsultasEncontradas: todasConsultas?.length || 0,
      totalConsultasComDuracao: consultasComDuracao.length,
      duracaoMediaSegundos: Math.round(duracaoMedia),
      duracaoMediaMinutos: Math.round(duracaoMedia / 60),
        amostras: consultasComDuracao.slice(0, 5).map(c => ({
        id: c.id || 'N/A',
        duration: c.duration,
        duracao: c.duracao,
        calculada: calcularDuracaoEmSegundos(c),
        status: c.status
      })) // Primeiras 5 para debug
    });

    // Calcular duração média por tipo
    const consultasPresencial = consultasComDuracao?.filter(c => c.consultation_type === 'PRESENCIAL') || [];
    const consultasTelemedicina = consultasComDuracao?.filter(c => c.consultation_type === 'TELEMEDICINA') || [];
    
    const duracaoMediaPresencial = consultasPresencial.length > 0
      ? consultasPresencial.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasPresencial.length
      : 0;
    
    const duracaoMediaTelemedicina = consultasTelemedicina.length > 0
      ? consultasTelemedicina.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasTelemedicina.length
      : 0;

    // Consultas por status (filtradas por período se informado)
    let consultasPorStatusQuery = supabase
      .from('consultations')
      .select('status')
      .eq('doctor_id', medico.id);
    
    // Aplicar filtro de período se fornecido
    if (periodParam === 'hoje' || periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      consultasPorStatusQuery = consultasPorStatusQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: consultasPorStatus } = await consultasPorStatusQuery;

    const statusCounts = consultasPorStatus?.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Consultas por tipo (filtradas por período se informado)
    let consultasPorTipoQuery = supabase
      .from('consultations')
      .select('consultation_type')
      .eq('doctor_id', medico.id);
    
    // Aplicar filtro de período se fornecido
    if (periodParam === 'hoje' || periodParam === '7d' || periodParam === '15d' || periodParam === '30d') {
      consultasPorTipoQuery = consultasPorTipoQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: consultasPorTipo } = await consultasPorTipoQuery;

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
        duracao,
        created_at,
        consulta_inicio,
        consulta_fim,
        patients:patient_id (
          name,
          email
        ),
        medicos:doctor_id (
          name
        )
      `)
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false })
      .limit(5);

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

    // Taxa de sucesso (baseada nas consultas do período filtrado)
    // Considerar como finalizadas: COMPLETED e VALID_SOLUCAO
    const totalConsultas = Object.values(statusCounts).reduce((acc, count) => acc + count, 0);
    const consultasCompletas = (statusCounts.COMPLETED || 0) + (statusCounts.VALID_SOLUCAO || 0);
    const taxaSucesso = totalConsultas > 0 
      ? (consultasCompletas / totalConsultas) * 100 
      : 0;
    
    console.log('📊 [DASHBOARD] Estatísticas calculadas:', {
      periodParam,
      periodoFiltrado: {
        inicio: startDateRange.toISOString(),
        fim: endDateRange.toISOString()
      },
      totalConsultas,
      consultasCompletas,
      consultasCOMPLETED: statusCounts.COMPLETED || 0,
      consultasVALID_SOLUCAO: statusCounts.VALID_SOLUCAO || 0,
      taxaSucesso: taxaSucesso.toFixed(2) + '%',
      consultasConcluidasMes,
      duracaoMediaSegundos: Math.round(duracaoMedia),
      duracaoMediaMinutos: Math.round(duracaoMedia / 60),
      statusCounts
    });

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
        duracaoMediaPresencialSegundos: Math.round(duracaoMediaPresencial),
        duracaoMediaTelemedicinaSegundos: Math.round(duracaoMediaTelemedicina),
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
