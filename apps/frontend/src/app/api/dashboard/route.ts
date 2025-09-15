import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/dashboard - Buscar estatísticas do dashboard
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/dashboard ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session } = authResult;
    const doctorAuthId = session.user.id;

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

    // Consultas dos últimos 30 dias para gráfico
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const { data: consultasUltimos30Dias } = await supabase
      .from('consultations')
      .select('created_at, status, consultation_type')
      .eq('doctor_id', medico.id)
      .gte('created_at', trintaDiasAtras.toISOString())
      .order('created_at', { ascending: true });

    // Agrupar por dia
    const consultasPorDia = consultasUltimos30Dias?.reduce((acc, c) => {
      const date = new Date(c.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, presencial: 0, telemedicina: 0, concluidas: 0 };
      }
      acc[date].total += 1;
      if (c.consultation_type === 'PRESENCIAL') {
        acc[date].presencial += 1;
      } else {
        acc[date].telemedicina += 1;
      }
      if (c.status === 'COMPLETED') {
        acc[date].concluidas += 1;
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

  } catch (error) {
    console.error('Erro no endpoint GET /api/dashboard:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
