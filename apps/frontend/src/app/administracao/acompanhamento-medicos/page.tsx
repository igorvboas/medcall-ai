'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { Loader2, Check, X, ChevronRight, Search, Download, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import './acompanhamento-medicos.css';

interface DoctorFunnel {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  crm: string | null;
  created_at: string;
  liberado_plataforma: boolean;
  notificado_whatsapp: boolean;
  criou_conta: boolean;
  verificou_email: boolean;
  fez_login: boolean;
  primeira_consulta_iniciada: boolean;
  primeira_consulta_finalizada: boolean;
  data_liberacao: string | null;
  data_criacao_conta: string | null;
  data_verificacao_email: string | null;
  data_primeiro_login: string | null;
  data_primeira_consulta: string | null;
  data_consulta_finalizada: string | null;
}

interface TrackingData {
  summary: {
    total_liberados: number;
    total_notificados: number;
    total_criaram_conta: number;
    total_verificaram_email: number;
    total_fizeram_login: number;
    total_primeira_consulta: number;
    total_consulta_finalizada: number;
  };
  doctors: DoctorFunnel[];
}

type FunnelFilter = null | 'liberado' | 'notificado' | 'conta' | 'email_verificado' | 'login' | 'consulta_iniciada' | 'consulta_finalizada';

export default function AcompanhamentoMedicosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrackingData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'not-done'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gatewayClient.get('/admin/doctor-tracking');
      if (response.success) {
        setData({
          summary: response.summary,
          doctors: response.doctors,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const filteredDoctors = data?.doctors.filter((d) => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !d.name.toLowerCase().includes(term) &&
        !d.email.toLowerCase().includes(term) &&
        !(d.phone || '').includes(term)
      ) {
        return false;
      }
    }

    // Email search filter
    if (emailSearch) {
      if (!d.email.toLowerCase().includes(emailSearch.toLowerCase())) {
        return false;
      }
    }

    // Date range filter (based on data_liberacao)
    if (dateFrom) {
      const from = new Date(dateFrom);
      const docDate = d.data_liberacao ? new Date(d.data_liberacao) : null;
      if (!docDate || docDate < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      const docDate = d.data_liberacao ? new Date(d.data_liberacao) : null;
      if (!docDate || docDate > to) return false;
    }

    // Funnel step filter
    if (funnelFilter) {
      const stepValue = getStepValue(d, funnelFilter);
      if (statusFilter === 'done' && !stepValue) return false;
      if (statusFilter === 'not-done' && stepValue) return false;
    }

    return true;
  }) || [];

  function getStepValue(d: DoctorFunnel, step: FunnelFilter): boolean {
    switch (step) {
      case 'liberado': return d.liberado_plataforma;
      case 'notificado': return d.notificado_whatsapp;
      case 'conta': return d.criou_conta;
      case 'email_verificado': return d.verificou_email;
      case 'login': return d.fez_login;
      case 'consulta_iniciada': return d.primeira_consulta_iniciada;
      case 'consulta_finalizada': return d.primeira_consulta_finalizada;
      default: return false;
    }
  }

  function handleFunnelClick(step: FunnelFilter) {
    if (funnelFilter === step) {
      setFunnelFilter(null);
      setStatusFilter('all');
    } else {
      setFunnelFilter(step);
      setStatusFilter('all');
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function exportCSV() {
    if (!filteredDoctors.length) return;

    const headers = [
      'Nome',
      'Email',
      'Telefone',
      'CRM',
      'Liberado na Plataforma',
      'Data Liberação',
      'Notificado WhatsApp',
      'Criou Conta',
      'Data Criação Conta',
      'Verificou Email',
      'Data Verificação Email',
      'Fez Login',
      'Data Primeiro Login',
      'Primeira Consulta Iniciada',
      'Data Primeira Consulta',
      'Consulta Finalizada',
      'Data Consulta Finalizada',
    ];

    const rows = filteredDoctors.map((d) => [
      d.name,
      d.email,
      d.phone || '',
      d.crm || '',
      d.liberado_plataforma ? 'Sim' : 'Não',
      formatDate(d.data_liberacao),
      d.notificado_whatsapp ? 'Sim' : 'Não',
      d.criou_conta ? 'Sim' : 'Não',
      formatDate(d.data_criacao_conta),
      d.verificou_email ? 'Sim' : 'Não',
      formatDate(d.data_verificacao_email),
      d.fez_login ? 'Sim' : 'Não',
      formatDate(d.data_primeiro_login),
      d.primeira_consulta_iniciada ? 'Sim' : 'Não',
      formatDate(d.data_primeira_consulta),
      d.primeira_consulta_finalizada ? 'Sim' : 'Não',
      formatDate(d.data_consulta_finalizada),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acompanhamento-medicos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;

  return (
    <div className="acompanhamento-page">
      <div className="acompanhamento-header">
        <h1>Acompanhamento de Médicos</h1>
        <p>Funil de navegação dos leads na plataforma</p>
      </div>

      {loading ? (
        <div className="loading-container">
          <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
          <p>Carregando dados...</p>
        </div>
      ) : (
        <>
          {/* Funnel Summary */}
          <div className="funnel-summary">
            <div
              className={`funnel-step step-1 ${funnelFilter === 'liberado' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('liberado')}
            >
              <div className="funnel-step-number">{summary?.total_liberados || 0}</div>
              <div className="funnel-step-label">Liberados na Plataforma</div>
              <div className="funnel-step-bar" style={{ width: '100%' }} />
              <div className="funnel-step-percentage">100%</div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-2 ${funnelFilter === 'notificado' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('notificado')}
            >
              <div className="funnel-step-number">{summary?.total_notificados || 0}</div>
              <div className="funnel-step-label">Notificados WhatsApp</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_notificados || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_notificados || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-3 ${funnelFilter === 'conta' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('conta')}
            >
              <div className="funnel-step-number">{summary?.total_criaram_conta || 0}</div>
              <div className="funnel-step-label">Criaram Conta</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_criaram_conta || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_criaram_conta || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-4 ${funnelFilter === 'email_verificado' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('email_verificado')}
            >
              <div className="funnel-step-number">{summary?.total_verificaram_email || 0}</div>
              <div className="funnel-step-label">Verificou Email</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_verificaram_email || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_verificaram_email || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-5 ${funnelFilter === 'login' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('login')}
            >
              <div className="funnel-step-number">{summary?.total_fizeram_login || 0}</div>
              <div className="funnel-step-label">Fez Login</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_fizeram_login || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_fizeram_login || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-6 ${funnelFilter === 'consulta_iniciada' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('consulta_iniciada')}
            >
              <div className="funnel-step-number">{summary?.total_primeira_consulta || 0}</div>
              <div className="funnel-step-label">Primeira Consulta</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_primeira_consulta || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_primeira_consulta || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>

            <div className="funnel-arrow"><ChevronRight size={20} /></div>

            <div
              className={`funnel-step step-7 ${funnelFilter === 'consulta_finalizada' ? 'active-filter' : ''}`}
              onClick={() => handleFunnelClick('consulta_finalizada')}
            >
              <div className="funnel-step-number">{summary?.total_consulta_finalizada || 0}</div>
              <div className="funnel-step-label">Consulta Finalizada</div>
              <div className="funnel-step-bar" style={{ width: summary?.total_liberados ? `${((summary?.total_consulta_finalizada || 0) / summary.total_liberados * 100)}%` : '0%' }} />
              <div className="funnel-step-percentage">
                {summary?.total_liberados ? `${((summary?.total_consulta_finalizada || 0) / summary.total_liberados * 100).toFixed(0)}%` : '0%'}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <div className="filter-row">
              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por email..."
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </div>
              <div className="date-filter">
                <Calendar size={16} className="date-icon" />
                <input
                  type="date"
                  className="date-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="Data início"
                />
                <span className="date-separator">até</span>
                <input
                  type="date"
                  className="date-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="Data fim"
                />
              </div>
              {funnelFilter && (
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'done' | 'not-done')}
                >
                  <option value="all">Todos</option>
                  <option value="done">Concluído</option>
                  <option value="not-done">Pendente</option>
                </select>
              )}
              <button className="export-btn" onClick={exportCSV} disabled={filteredDoctors.length === 0}>
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="doctors-table-container">
            {filteredDoctors.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum médico encontrado</p>
              </div>
            ) : (
              <>
                <table className="doctors-table">
                  <thead>
                    <tr>
                      <th>Médico</th>
                      <th>Liberado</th>
                      <th>Notificado</th>
                      <th>Criou Conta</th>
                      <th>Verificou Email</th>
                      <th>Fez Login</th>
                      <th>1a Consulta</th>
                      <th>Consulta Finalizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((doctor) => (
                      <tr key={doctor.id}>
                        <td>
                          <div className="doctor-name">{doctor.name}</div>
                          <div className="doctor-email">{doctor.email}</div>
                        </td>
                        <td>
                          <StatusBadge done={doctor.liberado_plataforma} date={doctor.data_liberacao} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.notificado_whatsapp} date={null} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.criou_conta} date={doctor.data_criacao_conta} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.verificou_email} date={doctor.data_verificacao_email} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.fez_login} date={doctor.data_primeiro_login} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.primeira_consulta_iniciada} date={doctor.data_primeira_consulta} formatDate={formatDate} />
                        </td>
                        <td>
                          <StatusBadge done={doctor.primeira_consulta_finalizada} date={doctor.data_consulta_finalizada} formatDate={formatDate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-footer">
                  <span>{filteredDoctors.length} de {data?.doctors.length || 0} médicos</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ done, date, formatDate }: { done: boolean; date: string | null; formatDate: (d: string | null) => string }) {
  if (done) {
    return (
      <span className="status-badge done" title={date ? formatDate(date) : ''}>
        <Check size={14} />
        {date ? formatDate(date) : 'Sim'}
      </span>
    );
  }
  return (
    <span className="status-badge not-done">
      <X size={14} />
      Não
    </span>
  );
}
