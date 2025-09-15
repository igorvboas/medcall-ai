'use client';

import { useState, useEffect } from 'react';
import { Search, MoreVertical, Eye, Calendar, Clock, User, Phone, Video, Mic, FileText, Grid3X3, List, Plus } from 'lucide-react';
import { ConsultaModal } from '@/components/consultas/ConsultaModal';
import Link from 'next/link';
import './consultas.css';

// Tipos locais para consultas
interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_context?: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  duration?: number;
  recording_url?: string;
  notes?: string;
  diagnosis?: string;
  treatment?: string;
  prescription?: string;
  next_appointment?: string;
  created_at: string;
  updated_at: string;
  patients?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

interface ConsultationsResponse {
  consultations: Consultation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ConsultasPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedConsulta, setSelectedConsulta] = useState<Consultation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchConsultations();
  }, [searchTerm, statusFilter, typeFilter, pagination.page]);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const response = await fetch(`/api/consultations?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar consultas');
      }
      
      const data: ConsultationsResponse = await response.json();
      setConsultations(data.consultations);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchConsultations();
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'status') {
      setStatusFilter(value);
    } else if (filterType === 'type') {
      setTypeFilter(value);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewConsulta = (consulta: Consultation) => {
    setSelectedConsulta(consulta);
    setModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
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
    return type === 'PRESENCIAL' ? <User className="w-4 h-4" /> : <Video className="w-4 h-4" />;
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  if (loading && consultations.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Consultas</h1>
          <p className="page-subtitle">Gerenciando suas consultas médicas</p>
        </div>
        
        <div className="loading-indicator">
          <div className="loading-icon"></div>
          <span>Carregando consultas...</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Consultas</h1>
            <p className="page-subtitle">Gerenciando suas consultas médicas</p>
          </div>
          <Link href="/consulta/nova" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Nova Consulta
          </Link>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="filters-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-container">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por paciente, contexto ou notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </form>

        <div className="filters-row">
          <div className="filter-group">
            <label htmlFor="status-filter" className="filter-label">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os status</option>
              <option value="CREATED">Criada</option>
              <option value="RECORDING">Gravando</option>
              <option value="PROCESSING">Processando</option>
              <option value="COMPLETED">Concluída</option>
              <option value="ERROR">Erro</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type-filter" className="filter-label">Tipo</label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os tipos</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="TELEMEDICINA">Telemedicina</option>
            </select>
          </div>

          <div className="view-controls">
            <button
              onClick={() => setViewMode('list')}
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              title="Visualização em lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              title="Visualização em grade"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Consultas */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {consultations.length === 0 && !loading ? (
        <div className="empty-state">
          <Calendar className="empty-icon" />
          <h3>Nenhuma consulta encontrada</h3>
          <p>Não há consultas que correspondam aos filtros aplicados.</p>
        </div>
      ) : (
        <div className={`consultations-container ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
          {consultations.map((consulta) => (
            <div key={consulta.id} className="consulta-card">
              <div className="consulta-header">
                <div className="consulta-info">
                  <h3 className="consulta-patient">{consulta.patient_name}</h3>
                  <div className="consulta-meta">
                    <span className="consulta-type">
                      {getTypeIcon(consulta.consultation_type)}
                      {getTypeText(consulta.consultation_type)}
                    </span>
                    <span className="consulta-date">
                      <Calendar className="w-4 h-4" />
                      {formatDate(consulta.created_at)}
                    </span>
                  </div>
                </div>
                <div className="consulta-actions">
                  <span className={`status-badge ${getStatusColor(consulta.status)}`}>
                    {getStatusText(consulta.status)}
                  </span>
                  <button
                    onClick={() => handleViewConsulta(consulta)}
                    className="action-button"
                    title="Ver detalhes"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {consulta.patient_context && (
                <div className="consulta-context">
                  <p>{consulta.patient_context}</p>
                </div>
              )}

              <div className="consulta-footer">
                <div className="consulta-stats">
                  {consulta.duration && (
                    <span className="stat">
                      <Clock className="w-4 h-4" />
                      {formatDuration(consulta.duration)}
                    </span>
                  )}
                  {consulta.recording_url && (
                    <span className="stat">
                      <Mic className="w-4 h-4" />
                      Áudio
                    </span>
                  )}
                  {consulta.notes && (
                    <span className="stat">
                      <FileText className="w-4 h-4" />
                      Notas
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="pagination-button"
          >
            Anterior
          </button>
          
          <span className="pagination-info">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="pagination-button"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalOpen && selectedConsulta && (
        <ConsultaModal
          consulta={selectedConsulta}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedConsulta(null);
          }}
        />
      )}
    </>
  );
}
