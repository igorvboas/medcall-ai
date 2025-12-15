import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;

    // Verificar se é admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .single();

    if (!medico?.admin) {
      return NextResponse.json({ error: 'Acesso negado - apenas administradores' }, { status: 403 });
    }

    // Pegar parâmetros de filtro da query
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'semana'; // hoje, semana, mes, personalizado
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipoConsulta = searchParams.get('tipoConsulta'); // PRESENCIAL, TELEMEDICINA, ou null para todas

    // Calcular datas baseado no período
    const hoje = new Date();
    let startDate: Date;
    let endDate: Date = hoje;

    switch (periodo) {
      case 'hoje':
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        break;
      case 'semana':
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 7);
        break;
      case 'mes':
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 30);
        break;
      case 'personalizado':
        startDate = dataInicio ? new Date(dataInicio) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        endDate = dataFim ? new Date(dataFim) : hoje;
        break;
      default:
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 7);
    }

    // 1. Total de Consultas (período atual)
    let consultasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      consultasQuery = consultasQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { count: totalConsultas } = await consultasQuery;

    // Calcular período anterior para comparação (mesma duração, período imediatamente anterior)
    const diffTime = endDate.getTime() - startDate.getTime();
    const periodoAnteriorEnd = new Date(startDate.getTime() - 1); // 1ms antes do início do período atual
    const periodoAnteriorStart = new Date(periodoAnteriorEnd.getTime() - diffTime); // Mesma duração para trás

    // Total de Consultas (período anterior)
    let consultasAnterioresQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', periodoAnteriorStart.toISOString())
      .lte('created_at', periodoAnteriorEnd.toISOString());
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      consultasAnterioresQuery = consultasAnterioresQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { count: totalConsultasAnterior } = await consultasAnterioresQuery;
    
    // Calcular variação de consultas (diferença entre período atual e anterior)
    const variacaoConsultas = (totalConsultasAnterior !== null && totalConsultasAnterior !== undefined) 
      ? (totalConsultas || 0) - (totalConsultasAnterior || 0)
      : (totalConsultas || 0); // Se não houver período anterior, mostra o total atual como variação positiva

    // 2. Total de Pacientes (ativos atualmente)
    const { count: totalPacientes } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Calcular variação de pacientes (baseado em novos cadastros no período atual)
    const { count: pacientesNovosPeriodoAtual } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'active');
    
    const variacaoPacientes = pacientesNovosPeriodoAtual || 0;

    // 3. Tempo médio de consulta (usando campo duracao que já está em minutos)
    let duracaoQuery = supabase
      .from('consultations')
      .select('duracao, consultation_type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('duracao', 'is', null);
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      duracaoQuery = duracaoQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { data: consultasComDuracao } = await duracaoQuery;

    const duracoes = consultasComDuracao?.map(c => c.duracao || 0) || [];
    const tempoMedioMinutos = duracoes.length > 0 
      ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
      : 0;

    // 4. Taxa de No-show (consultas canceladas)
    let canceladasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CANCELLED')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      canceladasQuery = canceladasQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { count: consultasCanceladas } = await canceladasQuery;

    const taxaNoShow = totalConsultas && totalConsultas > 0
      ? ((consultasCanceladas || 0) / totalConsultas * 100).toFixed(1)
      : '0';

    // 5. Consultas por tipo (Presencial vs Telemedicina) ao longo do tempo
    let porTipoQuery = supabase
      .from('consultations')
      .select('created_at, consultation_type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      porTipoQuery = porTipoQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { data: consultasPorTipo } = await porTipoQuery;

    // Agrupar por data
    const consultasPorDia: Record<string, { presencial: number; telemedicina: number }> = {};
    consultasPorTipo?.forEach(c => {
      const data = new Date(c.created_at).toLocaleDateString('pt-BR');
      if (!consultasPorDia[data]) {
        consultasPorDia[data] = { presencial: 0, telemedicina: 0 };
      }
      if (c.consultation_type === 'PRESENCIAL') {
        consultasPorDia[data].presencial++;
      } else {
        consultasPorDia[data].telemedicina++;
      }
    });

    // 6. Consultas por profissional
    let porMedicoQuery = supabase
      .from('consultations')
      .select(`
        doctor_id,
        consultation_type,
        medicos!inner(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      porMedicoQuery = porMedicoQuery.eq('consultation_type', tipoConsulta);
    }
    
    const { data: consultasPorMedico } = await porMedicoQuery;

    const medicosCount: Record<string, { nome: string; count: number }> = {};
    consultasPorMedico?.forEach((c: any) => {
      const medicoNome = c.medicos?.name || 'Desconhecido';
      if (!medicosCount[medicoNome]) {
        medicosCount[medicoNome] = { nome: medicoNome, count: 0 };
      }
      medicosCount[medicoNome].count++;
    });

    const consultasPorProfissional = Object.values(medicosCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 7. Consultas ativas (em andamento)
    const { data: consultasAtivas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        consulta_inicio,
        duration,
        medicos!inner(name)
      `)
      .eq('status', 'RECORDING')
      .order('consulta_inicio', { ascending: false })
      .limit(10);

    // 8. Status das consultas
    const { data: consultasPorStatus } = await supabase
      .from('consultations')
      .select('status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const statusCount: Record<string, number> = {};
    consultasPorStatus?.forEach(c => {
      statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    });

    // 9. Situação das consultas (por etapa)
    const { data: consultasPorEtapa } = await supabase
      .from('consultations')
      .select('etapa')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('etapa', 'is', null);

    const etapaCount: Record<string, number> = {};
    consultasPorEtapa?.forEach(c => {
      if (c.etapa) {
        etapaCount[c.etapa] = (etapaCount[c.etapa] || 0) + 1;
      }
    });

    // 10. Próximas consultas agendadas
    const { data: proximasConsultas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consulta_inicio,
        consultation_type
      `)
      .eq('status', 'AGENDAMENTO')
      .gte('consulta_inicio', hoje.toISOString())
      .order('consulta_inicio', { ascending: true })
      .limit(10);

    // 11. Consultas para o calendário (busca consultas do mês inteiro para suportar visualização de semana/dia)
    const mesCalendarioParam = searchParams.get('mesCalendario');
    const dataCalendario = mesCalendarioParam ? new Date(mesCalendarioParam) : hoje;
    // Buscar do primeiro dia do mês até o último dia, para incluir semanas que atravessam meses
    const primeiroDiaMes = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth(), 1);
    const ultimoDiaMes = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth() + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999); // Fim do último dia do mês
    
    const { data: consultasMes } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consulta_inicio,
        consultation_type,
        status,
        medicos!inner(name)
      `)
      .gte('consulta_inicio', primeiroDiaMes.toISOString())
      .lte('consulta_inicio', ultimoDiaMes.toISOString());

    // Agrupar consultas por dia
    const consultasPorDiaCalendario: Record<string, { agendadas: any[]; canceladas: any[] }> = {};
    consultasMes?.forEach((c: any) => {
      if (!c.consulta_inicio) return;
      const dataConsulta = new Date(c.consulta_inicio);
      const diaKey = `${dataConsulta.getFullYear()}-${String(dataConsulta.getMonth() + 1).padStart(2, '0')}-${String(dataConsulta.getDate()).padStart(2, '0')}`;
      
      if (!consultasPorDiaCalendario[diaKey]) {
        consultasPorDiaCalendario[diaKey] = { agendadas: [], canceladas: [] };
      }
      
      const consultaInfo = {
        id: c.id,
        paciente: c.patient_name,
        medico: c.medicos?.name || 'Desconhecido',
        tipo: c.consultation_type,
        horario: new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        data: new Date(c.consulta_inicio)
      };
      
      if (c.status === 'CANCELLED') {
        consultasPorDiaCalendario[diaKey].canceladas.push(consultaInfo);
      } else {
        consultasPorDiaCalendario[diaKey].agendadas.push(consultaInfo);
      }
    });

    // Retornar todos os dados
    return NextResponse.json({
      estatisticas: {
        totalConsultas: totalConsultas || 0,
        totalPacientes: totalPacientes || 0,
        tempoMedioMinutos,
        taxaNoShow,
        variacaoConsultas: variacaoConsultas || 0,
        variacaoPacientes: variacaoPacientes || 0
      },
      graficos: {
        consultasPorDia: Object.entries(consultasPorDia).map(([data, valores]) => ({
          data,
          ...valores
        })),
        consultasPorProfissional,
        statusCount,
        etapaCount
      },
      consultasAtivas: consultasAtivas?.map((c: any) => ({
        id: c.id,
        medico: c.medicos?.name || 'Desconhecido',
        tipo: c.consultation_type,
        paciente: c.patient_name,
        inicio: c.consulta_inicio ? new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
        duracao: c.duration ? `${Math.round(c.duration / 60)} min` : '-',
        sala: c.consultation_type === 'PRESENCIAL' ? 'Consultório' : 'Sala virtual'
      })) || [],
      proximasConsultas: proximasConsultas?.map(c => ({
        id: c.id,
        paciente: c.patient_name,
        tipo: 'Agendamento',
        horario: c.consulta_inicio ? new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
        iniciais: c.patient_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
      })) || [],
      consultasCalendario: consultasPorDiaCalendario
    });

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard admin:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do dashboard' },
      { status: 500 }
    );
  }
}

