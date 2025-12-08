'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Calendar as CalendarIcon, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Plus,
  Eye,
  Stethoscope,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';
import './dashboard.css';
import Chart3D from '../../../components/Chart3D';
import BarChart3D from '../../../components/BarChart3D';
import { Calendar } from '../../../components/Calendar';
import { StatusBadge, mapBackendStatus } from '../../../components/StatusBadge';
import { ConsultationStatusChart } from '../../../components/ConsultationStatusChart';
import { LoadingScreen } from '../../../components/shared/LoadingScreen';
import { ActiveConsultationBanner } from '../../../components/dashboard/ActiveConsultationBanner';
import '../../../components/Calendar.css';

interface DashboardData {
  medico: {
    id: string;
    name: string;
    specialty?: string;
    crm?: string;
    subscription_type: string;
  };
  estatisticas: {
    totalPacientes: number;
    consultasHoje: number;
    consultasConcluidasMes: number;
    duracaoMediaSegundos: number;
    taxaSucesso: number;
  };
  distribuicoes: {
    porStatus: Record<string, number>;
    porTipo: Record<string, number>;
  };
  atividades: {
    ultimasConsultas: Array<{
      id: string;
      patient_name: string;
      consultation_type: string;
      status: string;
      duration?: number;
      created_at: string;
      patients?: {
        name: string;
        email?: string;
      };
    }>;
    proximasConsultas: Array<{
      id: string;
      patient_name: string;
      consultation_type: string;
      created_at: string;
      patients?: {
        name: string;
        email?: string;
      };
    }>;
  };
  graficos: {
    consultasPorDia: Array<{
      date: string;
      total: number;
      presencial: number;
      telemedicina: number;
      concluidas: number;
    }>;
  };
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicoName, setMedicoName] = useState<string>('');

  // Função para gerar saudação dinâmica
  const getGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('7d');
  const [chartPeriodType, setChartPeriodType] = useState<'day' | 'week' | 'month' | 'year'>('year');
  const [chartSelectedDate, setChartSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [chartSelectedMonth, setChartSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const isMock = process.env.NEXT_PUBLIC_MOCK === 'true' || process.env.MOCK_MODE === 'true';
  const [consultationDates, setConsultationDates] = useState<Date[]>([]);

  // Atualizar nome do médico e datas quando os dados do dashboard forem carregados
  useEffect(() => {
    if (dashboardData?.medico?.name) {
      setMedicoName(dashboardData.medico.name);
    }
    // Extrair datas únicas de consultas para destacar no calendário (usar toda a série)
    if (dashboardData?.graficos?.consultasPorDia) {
      const dates = new Set<string>();
      dashboardData.graficos.consultasPorDia.forEach((d) => {
        // d.date no formato 'YYYY-MM-DD' (sem TZ) → construir Date local para evitar deslocamento
        const [yyyy, mm, dd] = d.date.split('-').map(Number);
        const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1);
        dates.add(localDate.toDateString());
      });
      const uniqueDates = Array.from(dates).map((s) => new Date(s));
      setConsultationDates(uniqueDates);
    }
  }, [dashboardData]);

  // Carregar dados iniciais do dashboard
  useEffect(() => {
    if (isMock) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDashboardData({
        medico: {
          id: 'mock-medico-1',
          name: 'Dra. Mock',
          specialty: 'Clínico Geral',
          crm: '000000-MOCK',
          subscription_type: 'PRO',
        },
        estatisticas: {
          totalPacientes: 3,
          consultasHoje: 1,
          consultasConcluidasMes: 5,
          duracaoMediaSegundos: 900,
          taxaSucesso: 80,
        },
        distribuicoes: {
          porStatus: { CREATED: 1, COMPLETED: 5, PROCESSING: 0 },
          porTipo: { PRESENCIAL: 3, TELEMEDICINA: 3 },
        },
        atividades: {
          ultimasConsultas: [
            { id: 'c1', patient_name: 'MOC - João Silva', consultation_type: 'PRESENCIAL', status: 'COMPLETED', duration: 1200, created_at: today.toISOString(), patients: { name: 'MOC - João Silva', email: 'joao@email' } },
          ],
          proximasConsultas: [
            { id: 'c2', patient_name: 'MOC - Maria Santos', consultation_type: 'TELEMEDICINA', created_at: tomorrow.toISOString(), patients: { name: 'MOC - Maria Santos', email: 'maria@email' } },
          ],
        },
        graficos: {
          consultasPorDia: [
            { date: new Date().toISOString().split('T')[0], total: 2, presencial: 1, telemedicina: 1, concluidas: 1 },
          ],
        },
      });
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [isMock, selectedYear, selectedPeriod]);

  // Função para atualizar apenas os dados do gráfico sem recarregar toda a página
  const fetchChartData = useCallback(async () => {
    if (!dashboardData) return;
    
    try {
      // Construir parâmetros para o gráfico de Presencial/Telemedicina
      let chartParams = '';
      if (chartPeriodType === 'day') {
        chartParams = `&chartPeriod=day&chartDate=${encodeURIComponent(chartSelectedDate)}`;
      } else if (chartPeriodType === 'week') {
        chartParams = `&chartPeriod=week&chartDate=${encodeURIComponent(chartSelectedDate)}`;
      } else if (chartPeriodType === 'month') {
        chartParams = `&chartPeriod=month&chartMonth=${encodeURIComponent(chartSelectedMonth)}`;
      } else {
        chartParams = `&chartPeriod=year&chartYear=${encodeURIComponent(selectedYear)}`;
      }
      
      const response = await fetch(`/api/dashboard?year=${encodeURIComponent(selectedYear)}&period=${encodeURIComponent(selectedPeriod)}${chartParams}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do gráfico');
      }
      
      const data = await response.json();
      
      // Atualizar apenas os dados do gráfico, mantendo o resto dos dados
      setDashboardData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          graficos: {
            ...prev.graficos,
            consultasPorDia: data.graficos?.consultasPorDia || prev.graficos.consultasPorDia
          }
        };
      });
    } catch (err) {
      console.error('Erro ao atualizar gráfico:', err);
      // Não mostrar erro global, apenas logar
    }
  }, [dashboardData, chartPeriodType, chartSelectedDate, chartSelectedMonth, selectedYear, selectedPeriod]);

  // Atualizar apenas o gráfico quando os filtros do gráfico mudarem
  useEffect(() => {
    if (isMock || !dashboardData) return;
    
    // Usar um pequeno delay para evitar múltiplas chamadas rápidas
    const timeoutId = setTimeout(() => {
      fetchChartData();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [fetchChartData, isMock]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Construir parâmetros para o gráfico de Presencial/Telemedicina
      let chartParams = '';
      if (chartPeriodType === 'day') {
        chartParams = `&chartPeriod=day&chartDate=${encodeURIComponent(chartSelectedDate)}`;
      } else if (chartPeriodType === 'week') {
        chartParams = `&chartPeriod=week&chartDate=${encodeURIComponent(chartSelectedDate)}`;
      } else if (chartPeriodType === 'month') {
        chartParams = `&chartPeriod=month&chartMonth=${encodeURIComponent(chartSelectedMonth)}`;
      } else {
        chartParams = `&chartPeriod=year&chartYear=${encodeURIComponent(selectedYear)}`;
      }
      
      const response = await fetch(`/api/dashboard?year=${encodeURIComponent(selectedYear)}&period=${encodeURIComponent(selectedPeriod)}${chartParams}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do dashboard');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };


  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };


  const getTypeIcon = (type: string) => {
    return type === 'PRESENCIAL' ? <Stethoscope className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  // Processa dados da semana a partir dos dados de consultas
  const getWeeklyData = () => {
    if (!dashboardData?.graficos?.consultasPorDia) {
      return {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        values: [0, 0, 0, 0, 0, 0],
        colors: ['#ff6b35', '#e91e63', '#ffc107', '#4caf50', '#f44336', '#9e9e9e']
      };
    }

    // Últimos 7 dias
    const last7Days: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Segunda a Sábado
    
    dashboardData.graficos.consultasPorDia.forEach(item => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      
      // Mapear: 1=Segunda, 2=Terça, ..., 6=Sábado (ignoramos domingo)
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        last7Days[dayOfWeek] = (last7Days[dayOfWeek] || 0) + item.total;
      }
    });

    return {
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      values: [last7Days[1] || 0, last7Days[2] || 0, last7Days[3] || 0, last7Days[4] || 0, last7Days[5] || 0, last7Days[6] || 0],
      colors: ['#ff6b35', '#e91e63', '#ffc107', '#4caf50', '#f44336', '#9e9e9e']
    };
  };

  if (loading) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  if (error || !dashboardData) {
    return (
      <div className="dashboard-exact">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          gap: '20px',
          padding: '40px'
        }}>
          <AlertCircle size={64} style={{ color: '#f44336' }} />
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff' }}>
            {error || 'Erro ao carregar dados do dashboard'}
          </h2>
          <p style={{ color: '#888', textAlign: 'center', maxWidth: '500px' }}>
            Não foi possível carregar as informações do dashboard. Verifique sua conexão e tente novamente.
          </p>
          <button 
            onClick={fetchDashboardData}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-exact">
      {/* Banner de consulta em andamento */}
      <ActiveConsultationBanner />
      
      {/* Layout principal: conteúdo + painel direito */}
      <div className="dashboard-layout">
        {/* Conteúdo principal */}
        <div className="main-content">
          {/* Saudação do dashboard */}
          <div className="dashboard-greeting-section">
            <h1 className="dashboard-title">
              {getGreeting()}, Dr {medicoName || 'Carregando...'}
            </h1>
          </div>

          {/* Linha dos KPIs conectados */}
          <div className="kpi-row">
            <div className="kpi kpi--cyan">
              <div className="title">Consultas Hoje</div>
              <div className="value">{dashboardData.estatisticas.consultasHoje}</div>
            </div>
            <div className="kpi kpi--amber">
              <div className="title">Total de Atendimentos</div>
              <div className="value">{dashboardData.estatisticas.consultasConcluidasMes}</div>
            </div>
            <div className="kpi kpi--lilac">
              <div className="title">Total de Paciente</div>
              <div className="value">{dashboardData.estatisticas.totalPacientes}</div>
            </div>
          </div>

          {/* Linha dos gráficos + calendário */}
          <div className="data-row">
            <div className="card-dark chart-card">
              <div className="card-header">
                <div className="card-title">Atendimentos Presencial/Telemedicina</div>
                <div className="card-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select 
                    className="year-select"
                    value={chartPeriodType}
                    onChange={(e) => setChartPeriodType(e.target.value as 'day' | 'week' | 'month' | 'year')}
                    style={{ minWidth: '100px' }}
                  >
                    <option value="day">Dia</option>
                    <option value="week">Semana</option>
                    <option value="month">Mês</option>
                    <option value="year">Ano</option>
                  </select>
                  
                  {chartPeriodType === 'day' && (
                    <input
                      type="date"
                      className="year-select"
                      value={chartSelectedDate}
                      onChange={(e) => setChartSelectedDate(e.target.value)}
                      style={{ minWidth: '140px' }}
                    />
                  )}
                  
                  {chartPeriodType === 'week' && (
                    <input
                      type="date"
                      className="year-select"
                      value={chartSelectedDate}
                      onChange={(e) => setChartSelectedDate(e.target.value)}
                      style={{ minWidth: '140px' }}
                    />
                  )}
                  
                  {chartPeriodType === 'month' && (
                    <input
                      type="month"
                      className="year-select"
                      value={chartSelectedMonth}
                      onChange={(e) => setChartSelectedMonth(e.target.value)}
                      style={{ minWidth: '140px' }}
                    />
                  )}
                  
                  {chartPeriodType === 'year' && (
                    <select 
                      className="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      style={{ minWidth: '100px' }}
                    >
                      <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                      <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                    </select>
                  )}
                  {/* download button removed */}
                </div>
              </div>
              <div className="chart-content">
                <div className="line-chart">
                  <div className="chart-legend-top">
                    <div className="legend-item">
                      <div className="legend-line presencial"></div>
                      <span>Presencial</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-line telemedicina"></div>
                      <span>Telemedicina</span>
                    </div>
                  </div>
                  <div className="chart-area">
                    <Chart3D 
                      data={{
                        presencial: dashboardData?.graficos?.consultasPorDia?.map(d => d.presencial) || [],
                        telemedicina: dashboardData?.graficos?.consultasPorDia?.map(d => d.telemedicina) || [],
                        labels: dashboardData?.graficos?.consultasPorDia?.map(d => {
                          // d.date vem como 'YYYY-MM-DD' (sem timezone). Para não deslocar o dia,
                          // construímos a data usando Date(year, monthIndex, day) (TZ local)
                          const [yyyy, mm, dd] = d.date.split('-').map(Number);
                          const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1);
                          return localDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                        }) || []
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card-dark calendar-card">
              <div className="card-header">
                <div className="card-title">Calendário</div>
                <div className="card-actions">
                  <Link href="/agenda" className="view-btn">
                    Ver Agenda
                  </Link>
                </div>
              </div>
              <div className="calendar-content">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  highlightedDates={consultationDates}
                  className="dashboard-calendar"
                />
              </div>
            </div>
          </div>

          {/* Linha de atendimentos e consultas */}
          <div className="bottom-row">
            <div className="card-dark weekly-chart">
              <div className="card-title">Atendimentos na Semana</div>
              <BarChart3D
                useCSS3D={true}
                data={getWeeklyData()}
              />
            </div>
            
            <div className="card-dark consultations-table">
              <div className="card-header">
                <div className="card-title">Consultas</div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Id</th>
                      <th>Paciente</th>
                      <th>Data</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.atividades?.ultimasConsultas && dashboardData.atividades.ultimasConsultas.length > 0 ? (
                      dashboardData.atividades.ultimasConsultas.slice(0, 5).map((consulta) => (
                        <tr key={consulta.id}>
                          <td>{consulta.id.substring(0, 8)}</td>
                          <td>{consulta.patients?.name || consulta.patient_name}</td>
                          <td>{new Date(consulta.created_at).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <StatusBadge 
                              status={mapBackendStatus(consulta.status)} 
                              size="sm" 
                              showIcon={true}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                          Nenhuma consulta encontrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Painel lateral direito - MELHORADO */}
        <aside className="right-panel">
          <ConsultationStatusChart 
            data={{
              created: dashboardData?.distribuicoes?.porStatus?.CREATED || 0,
              inProgress: dashboardData?.distribuicoes?.porStatus?.PROCESSING || 0,
              completed: dashboardData?.distribuicoes?.porStatus?.COMPLETED || 0,
              cancelled: dashboardData?.distribuicoes?.porStatus?.CANCELLED || 0
            }}
            metrics={[
              { 
                label: 'Consultas Concluídas', 
                value: dashboardData?.estatisticas?.consultasConcluidasMes || 0, 
                change: 0, 
                isPositive: true 
              },
              { 
                label: 'Total de Pacientes', 
                value: dashboardData?.estatisticas?.totalPacientes || 0, 
                change: 0, 
                isPositive: true 
              }
            ]}
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period: string) => setSelectedPeriod(period)}
          />
          
          <div className="unified-card" style={{ marginTop: '16px' }}>
            {/* Duração e Taxa */}
            <div className="duration-section">
              <div className="duration-item">
                <div className="duration-label">Duração Média</div>
                <div className="duration-value">
                  {formatDuration(dashboardData?.estatisticas?.duracaoMediaSegundos || 0)}
                </div>
                <div className="progress-bar">
                  <div className="progress-fill progress-purple" style={{
                    width: `${Math.min(((dashboardData?.estatisticas?.duracaoMediaSegundos || 0) / 5400) * 100, 100)}%`
                  }}></div>
                </div>
              </div>
              <div className="duration-item">
                <div className="duration-label">Taxa de Finalização</div>
                <div className="duration-value">
                  {Math.round(dashboardData?.estatisticas?.taxaSucesso || 0)}%
                </div>
                <div className="progress-bar">
                  <div className="progress-fill progress-blue" style={{
                    width: `${dashboardData?.estatisticas?.taxaSucesso || 0}%`
                  }}></div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}