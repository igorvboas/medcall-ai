'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
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
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import './dashboard.css';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'RECORDING': return 'status-recording';
      case 'PROCESSING': return 'status-processing';
      case 'ERROR': return 'status-error';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'status-created';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return 'Criada';
      case 'RECORDING': return 'Gravando';
      case 'PROCESSING': return 'Processando';
      case 'COMPLETED': return 'Concluída';
      case 'ERROR': return 'Erro';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'PRESENCIAL' ? <Stethoscope className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral da sua prática médica</p>
        </div>
        
        <div className="loading-indicator">
          <div className="loading-icon"></div>
          <span>Carregando dashboard...</span>
        </div>
      </>
    );
  }

  if (error || !dashboardData) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral da sua prática médica</p>
        </div>
        
        <div className="error-message">
          {error || 'Erro ao carregar dados do dashboard'}
        </div>
      </>
    );
  }

  return (
    <>

      {/* Cards de Estatísticas Principais */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Users className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">{dashboardData.estatisticas.totalPacientes}</h3>
            <p className="stat-label">Total de Pacientes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">{dashboardData.estatisticas.consultasHoje}</h3>
            <p className="stat-label">Consultas Hoje</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">{dashboardData.estatisticas.consultasConcluidasMes}</h3>
            <p className="stat-label">Concluídas este Mês</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">
              {formatDuration(dashboardData.estatisticas.duracaoMediaSegundos)}
            </h3>
            <p className="stat-label">Duração Média</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">{dashboardData.estatisticas.taxaSucesso}%</h3>
            <p className="stat-label">Taxa de Sucesso</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3 className="stat-value">
              {Object.values(dashboardData.distribuicoes.porTipo).reduce((a, b) => a + b, 0)}
            </h3>
            <p className="stat-label">Total de Consultas</p>
          </div>
        </div>
      </div>

      {/* Gráficos e Visualizações */}
      <div className="dashboard-charts">
        <DashboardCharts 
          consultasPorDia={dashboardData.graficos.consultasPorDia}
          distribuicoes={dashboardData.distribuicoes}
        />
      </div>

      {/* Atividades e Listas */}
      <div className="dashboard-activities">
        <div className="activities-grid">
          {/* Últimas Consultas */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">
                <Clock className="w-5 h-5" />
                Últimas Consultas
              </h3>
              <Link href="/consultas" className="activity-link">
                <Eye className="w-4 h-4" />
                Ver Todas
              </Link>
            </div>
            <div className="activity-list">
              {dashboardData.atividades.ultimasConsultas.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma consulta encontrada</p>
                </div>
              ) : (
                dashboardData.atividades.ultimasConsultas.map((consulta) => (
                  <div key={consulta.id} className="activity-item">
                    <div className="activity-item-content">
                      <div className="activity-patient">
                        {consulta.patients?.name || consulta.patient_name}
                      </div>
                      <div className="activity-meta">
                        <span className="activity-type">
                          {getTypeIcon(consulta.consultation_type)}
                          {getTypeText(consulta.consultation_type)}
                        </span>
                        <span className="activity-date">
                          {new Date(consulta.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <span className={`status-badge ${getStatusColor(consulta.status)}`}>
                      {getStatusText(consulta.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Próximas Consultas */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">
                <Calendar className="w-5 h-5" />
                Próximas Consultas
              </h3>
              <Link href="/consultas" className="activity-link">
                <Eye className="w-4 h-4" />
                Ver Todas
              </Link>
            </div>
            <div className="activity-list">
              {dashboardData.atividades.proximasConsultas.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma consulta agendada para hoje</p>
                </div>
              ) : (
                dashboardData.atividades.proximasConsultas.map((consulta) => (
                  <div key={consulta.id} className="activity-item">
                    <div className="activity-item-content">
                      <div className="activity-patient">
                        {consulta.patients?.name || consulta.patient_name}
                      </div>
                      <div className="activity-meta">
                        <span className="activity-type">
                          {getTypeIcon(consulta.consultation_type)}
                          {getTypeText(consulta.consultation_type)}
                        </span>
                        <span className="activity-time">
                          {new Date(consulta.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}