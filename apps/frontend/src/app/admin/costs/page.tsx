'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  DollarSign,
  Activity,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  XCircle,
  Clock,
  Zap,
  Shield,
  Play,
  Square,
  BarChart3,
  Cpu,
  AlertCircle,
  CheckCircle,
  Loader2,
  Phone,
  PhoneOff
} from 'lucide-react';
import './costs.css';

interface CostStats {
  total: number;
  totalTester: number;
  totalProduction: number;
  byModel: Record<string, { count: number; cost: number; tokens: number }>;
  byEtapa: Record<string, { count: number; cost: number }>;
  byDay: Record<string, { count: number; cost: number }>;
  byHour: Record<string, { count: number; cost: number }>;
  recentRecords: any[];
  totalRecords: number;
}

interface ActiveConsultation {
  id: string;
  status: string;
  room_id: string | null;
  created_at: string;
  consulta_inicio: string | null;
  patients: { name: string };
  medicos: { name: string; email: string } | null;
}

interface ActiveSession {
  id: string;
  consultation_id: string;
  room_id: string;
  status: string;
  created_at: string;
}

export default function CostsMonitorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState<CostStats | null>(null);
  const [activeConsultations, setActiveConsultations] = useState<ActiveConsultation[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Verificar admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('admin')
          .eq('user_auth', user.id)
          .maybeSingle();

        setIsAdmin(data?.admin === true);
      } catch {
        setIsAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user?.id, authLoading]);

  // Buscar dados
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`/api/admin/costs?period=${period}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Erro ao buscar dados');
      }

      const data = await response.json();
      setStats(data.stats);
      setActiveConsultations(data.activeConsultations || []);
      setActiveSessions(data.activeSessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, router]);

  useEffect(() => {
    if (isAdmin === true) {
      fetchData();
    } else if (isAdmin === false) {
      setLoading(false);
    }
  }, [isAdmin, fetchData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || isAdmin !== true) return;

    const interval = setInterval(fetchData, 10000); // 10 segundos
    return () => clearInterval(interval);
  }, [autoRefresh, isAdmin, fetchData]);

  // Fechar consulta
  const handleCloseConsultation = async (consultationId: string) => {
    if (!confirm('Tem certeza que deseja forçar o encerramento desta consulta?')) {
      return;
    }

    setClosingId(consultationId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_close_consultation',
          consultationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fechar consulta');
      }

      setSuccess('Consulta encerrada com sucesso');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar consulta');
    } finally {
      setClosingId(null);
    }
  };

  // Fechar TODAS as consultas RECORDING
  const handleCloseAllRecording = async () => {
    const count = activeConsultations.length;
    if (!confirm(`Tem certeza que deseja ENCERRAR TODAS as ${count} consulta(s) em andamento?\n\nIsso encerrará TODAS as conexões com a OpenAI e pode interromper consultas legítimas.`)) {
      return;
    }

    setClosingId('all');
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_all_recording' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fechar consultas');
      }

      setSuccess(data.message);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar consultas');
    } finally {
      setClosingId(null);
    }
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Calcular duração
  const getDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}min`;
    }
    return `${diffMins}min`;
  };

  // Loading
  if (authLoading || loading) {
    return (
      <div className="costs-page">
        <div className="costs-loading">
          <Loader2 className="spinner" />
          <p>Carregando monitor de custos...</p>
        </div>
      </div>
    );
  }

  // Não autorizado
  if (isAdmin === false) {
    return (
      <div className="costs-page">
        <div className="costs-error-container">
          <AlertCircle size={48} />
          <h2>Acesso Negado</h2>
          <p>Você não tem permissão para acessar o monitor de custos.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-back">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="costs-page">
      {/* Header */}
      <header className="costs-header">
        <div className="costs-title">
          <DollarSign size={32} />
          <div>
            <h1>Monitor de Custos IA</h1>
            <p>Acompanhe gastos com OpenAI e conexões ativas</p>
          </div>
        </div>
        <div className="costs-actions">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="period-select"
          >
            <option value="1d">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn-auto-refresh ${autoRefresh ? 'active' : ''}`}
            title={autoRefresh ? 'Desativar auto-refresh' : 'Ativar auto-refresh (10s)'}
          >
            {autoRefresh ? <Square size={16} /> : <Play size={16} />}
            Auto
          </button>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="btn-refresh"
          >
            <RefreshCw className={refreshing ? 'spinning' : ''} size={18} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      {/* Alertas */}
      {error && (
        <div className="costs-alert error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="costs-alert success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Consultas Ativas - IMPORTANTE! */}
      {activeConsultations.length > 0 && (
        <section className="costs-section danger">
          <div className="section-header">
            <div className="section-title">
              <AlertTriangle size={24} />
              <h2>⚠️ Consultas em Gravação ({activeConsultations.length})</h2>
            </div>
            <button
              onClick={handleCloseAllRecording}
              disabled={closingId !== null}
              className="btn-danger-action"
            >
              {closingId === 'all' ? (
                <Loader2 className="spinner" size={16} />
              ) : (
                <PhoneOff size={16} />
              )}
              Encerrar TODAS
            </button>
          </div>
          <p className="section-warning">
            Essas consultas estão usando a OpenAI Realtime API ($0.06/min input + $0.24/min output).
            Se não houver atividade real, podem ser conexões órfãs gerando custos!
          </p>
          <div className="active-consultations-grid">
            {activeConsultations.map((consultation) => (
              <div key={consultation.id} className="consultation-card danger">
                <div className="card-header">
                  <div className="card-status recording">
                    <Activity size={14} />
                    RECORDING
                  </div>
                  <span className="card-duration">
                    <Clock size={14} />
                    {getDuration(consultation.consulta_inicio || consultation.created_at)}
                  </span>
                </div>
                <div className="card-body">
                  <p><strong>Paciente:</strong> {consultation.patients?.name || 'N/A'}</p>
                  <p><strong>Médico:</strong> {consultation.medicos?.name || consultation.medicos?.email || 'N/A'}</p>
                  <p><strong>Room:</strong> <code>{consultation.room_id?.slice(0, 15) || 'N/A'}...</code></p>
                  <p><strong>Início:</strong> {formatDate(consultation.consulta_inicio || consultation.created_at)}</p>
                </div>
                <div className="card-footer">
                  <button
                    onClick={() => handleCloseConsultation(consultation.id)}
                    disabled={closingId !== null}
                    className="btn-close-consultation"
                  >
                    {closingId === consultation.id ? (
                      <Loader2 className="spinner" size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    Encerrar Consulta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cards de resumo */}
      <section className="costs-summary">
        <div className="summary-card total">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">Custo Total</span>
            <span className="card-value">{formatCurrency(stats?.total || 0)}</span>
          </div>
        </div>
        <div className="summary-card production">
          <div className="card-icon">
            <Zap size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">Produção</span>
            <span className="card-value">{formatCurrency(stats?.totalProduction || 0)}</span>
          </div>
        </div>
        <div className="summary-card tester">
          <div className="card-icon">
            <Shield size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">Tester</span>
            <span className="card-value">{formatCurrency(stats?.totalTester || 0)}</span>
          </div>
        </div>
        <div className="summary-card records">
          <div className="card-icon">
            <BarChart3 size={24} />
          </div>
          <div className="card-content">
            <span className="card-label">Registros</span>
            <span className="card-value">{stats?.totalRecords || 0}</span>
          </div>
        </div>
      </section>

      {/* Custos por Modelo */}
      <section className="costs-section">
        <div className="section-header">
          <div className="section-title">
            <Cpu size={24} />
            <h2>Custos por Modelo</h2>
          </div>
        </div>
        <div className="model-grid">
          {Object.entries(stats?.byModel || {})
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([model, data]) => (
              <div key={model} className={`model-card ${model.includes('realtime') ? 'highlight' : ''}`}>
                <div className="model-name">{model}</div>
                <div className="model-stats">
                  <div className="model-stat">
                    <span className="stat-label">Custo</span>
                    <span className="stat-value cost">{formatCurrency(data.cost)}</span>
                  </div>
                  <div className="model-stat">
                    <span className="stat-label">Chamadas</span>
                    <span className="stat-value">{data.count}</span>
                  </div>
                  <div className="model-stat">
                    <span className="stat-label">
                      {model.includes('realtime') || model.includes('whisper') ? 'Minutos' : 'Tokens'}
                    </span>
                    <span className="stat-value">
                      {model.includes('realtime') || model.includes('whisper') 
                        ? data.tokens.toFixed(2) 
                        : data.tokens.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Custos por Etapa */}
      <section className="costs-section">
        <div className="section-header">
          <div className="section-title">
            <TrendingUp size={24} />
            <h2>Custos por Etapa</h2>
          </div>
        </div>
        <div className="etapa-grid">
          {Object.entries(stats?.byEtapa || {})
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([etapa, data]) => (
              <div key={etapa} className="etapa-card">
                <div className="etapa-name">{etapa.replace(/_/g, ' ')}</div>
                <div className="etapa-cost">{formatCurrency(data.cost)}</div>
                <div className="etapa-count">{data.count} chamadas</div>
              </div>
            ))}
        </div>
      </section>

      {/* Custos por Dia */}
      <section className="costs-section">
        <div className="section-header">
          <div className="section-title">
            <Clock size={24} />
            <h2>Histórico por Dia</h2>
          </div>
        </div>
        <div className="day-table-container">
          <table className="day-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Custo</th>
                <th>Chamadas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats?.byDay || {})
                .sort(([a], [b]) => b.localeCompare(a))
                .slice(0, 14)
                .map(([day, data]) => (
                  <tr key={day}>
                    <td>{new Date(day).toLocaleDateString('pt-BR')}</td>
                    <td className="cost-cell">{formatCurrency(data.cost)}</td>
                    <td>{data.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registros Recentes */}
      <section className="costs-section">
        <div className="section-header">
          <div className="section-title">
            <Activity size={24} />
            <h2>Registros Recentes</h2>
          </div>
        </div>
        <div className="records-table-container">
          <table className="records-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Modelo</th>
                <th>Etapa</th>
                <th>Token/Min</th>
                <th>Custo</th>
                <th>Tester</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentRecords.map((record) => (
                <tr key={record.id} className={record.tester ? 'tester-row' : ''}>
                  <td>{formatDate(record.created_at)}</td>
                  <td>
                    <code className={record.LLM?.includes('realtime') ? 'highlight' : ''}>
                      {record.LLM}
                    </code>
                  </td>
                  <td>{record.etapa}</td>
                  <td>
                    {record.LLM?.includes('realtime') || record.LLM?.includes('whisper')
                      ? `${record.token?.toFixed(2)} min`
                      : record.token?.toLocaleString()}
                  </td>
                  <td className="cost-cell">{formatCurrency(record.price || 0)}</td>
                  <td>
                    {record.tester ? (
                      <span className="badge tester">Sim</span>
                    ) : (
                      <span className="badge prod">Não</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

