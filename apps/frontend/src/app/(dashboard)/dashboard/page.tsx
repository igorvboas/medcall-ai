'use client';

import { useState, useEffect } from 'react';
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
  const isMock = process.env.NEXT_PUBLIC_MOCK === 'true' || process.env.MOCK_MODE === 'true';
  
  // Datas com consultas (exemplo)
  const consultationDates = [
    new Date(2024, 9, 15), // 15 de outubro
    new Date(2024, 9, 18), // 18 de outubro
    new Date(2024, 9, 22), // 22 de outubro
    new Date(2024, 9, 25), // 25 de outubro
    new Date(2024, 9, 28), // 28 de outubro
  ];

  // Atualizar nome do médico quando os dados do dashboard forem carregados
  useEffect(() => {
    if (dashboardData?.medico?.name) {
      setMedicoName(dashboardData.medico.name);
    }
  }, [dashboardData]);

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
  }, [isMock]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do dashboard');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      // Fallback: em qualquer erro, popular com MOCK local
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
      setError(null);
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

  if (loading) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  if (error || !dashboardData) {
    return (
      <div className="error-message">
        {error || 'Erro ao carregar dados do dashboard'}
      </div>
    );
  }

  return (
    <div className="dashboard-exact">
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
                <div className="card-actions">
                  <select className="year-select">
                    <option>2022</option>
                  </select>
                  <button className="btn-download">
                    📥 Download
                  </button>
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
                        presencial: [480, 520, 540, 530, 535, 525, 515, 510, 505],
                        telemedicina: [360, 390, 410, 400, 405, 395, 385, 380, 375],
                        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']
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
                data={{
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                  values: [120, 80, 95, 70, 140, 55],
                  colors: ['#ff6b35', '#e91e63', '#ffc107', '#4caf50', '#f44336', '#9e9e9e']
                }}
              />
            </div>
            
            <div className="card-dark consultations-table">
              <div className="card-header">
                <div className="card-title">Consultas</div>
                <div className="card-actions">
                  <button className="btn-filter">🔽 Filter</button>
                  <button className="btn-download">📥 Download</button>
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Id</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>RZ17308</td>
                      <td>Marcos Paulo</td>
                      <td>13/01/2022</td>
                      <td>
                        <StatusBadge 
                          status="created" 
                          size="sm" 
                          showIcon={true}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>RZ8308</td>
                      <td>Thiago Nascimento</td>
                      <td>13/01/2022</td>
                      <td>
                        <StatusBadge 
                          status="in-progress" 
                          size="sm" 
                          showIcon={true}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>RZ8765</td>
                      <td>Daniel Cutrim</td>
                      <td>13/01/2022</td>
                      <td>
                        <StatusBadge 
                          status="completed" 
                          size="sm" 
                          showIcon={true}
                        />
                      </td>
                    </tr>
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
              created: dashboardData?.distribuicoes?.porStatus?.CREATED || 8,
              inProgress: dashboardData?.distribuicoes?.porStatus?.PROCESSING || 5,
              completed: dashboardData?.distribuicoes?.porStatus?.COMPLETED || 12,
              cancelled: 2
            }}
            metrics={[
              { 
                label: 'Consultas Criadas', 
                value: dashboardData?.estatisticas?.consultasConcluidasMes || 25, 
                change: 5, 
                isPositive: true 
              },
              { 
                label: 'Novos Pacientes', 
                value: dashboardData?.estatisticas?.totalPacientes || 30, 
                change: 50, 
                isPositive: true 
              }
            ]}
            selectedPeriod="custom"
            onPeriodChange={(period: string) => console.log('Period changed:', period)}
          />
          
          <div className="unified-card" style={{ marginTop: '16px' }}>
            {/* Duração e Taxa */}
            <div className="duration-section">
              <div className="duration-item">
                <div className="duration-label">Duração Média</div>
                <div className="duration-value">1h 30m</div>
                <div className="progress-bar">
                  <div className="progress-fill progress-purple" style={{width: '60%'}}></div>
                </div>
              </div>
              <div className="duration-item">
                <div className="duration-label">Taxa de Finalização</div>
                <div className="duration-value">80%</div>
                <div className="progress-bar">
                  <div className="progress-fill progress-blue" style={{width: '80%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}