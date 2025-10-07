'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play
} from 'lucide-react';
import { StatusBadge, mapBackendStatus } from '../../components/StatusBadge';
import './consultas.css';

// Tipos para consultas da API
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
    birth_date?: string;
    gender?: string;
    cpf?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    medical_history?: string;
    allergies?: string;
    current_medications?: string;
  };
  transcription?: {
    id: string;
    raw_text: string;
    summary?: string;
    key_points?: string[];
    diagnosis?: string;
    treatment?: string;
    observations?: string;
    confidence?: number;
    processing_time?: number;
    language?: string;
    model_used?: string;
    created_at: string;
  };
  audioFiles?: Array<{
    id: string;
    filename: string;
    original_name?: string;
    mime_type: string;
    size: number;
    duration?: number;
    storage_path: string;
    storage_bucket: string;
    is_processed: boolean;
    processing_status: string;
    uploaded_at: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    content?: string;
    type: string;
    format: string;
    storage_path?: string;
    storage_bucket?: string;
    created_at: string;
  }>;
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

// Função para buscar consultas da API
async function fetchConsultations(page: number = 1, limit: number = 20): Promise<ConsultationsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`/api/consultations?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao buscar consultas');
  }

  return response.json();
}

function ConsultasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultaId = searchParams.get('consulta_id');

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  
  // Estados para visualização de detalhes
  const [consultaDetails, setConsultaDetails] = useState<Consultation | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Carregar consultas ao montar o componente
  useEffect(() => {
    if (!consultaId) {
      loadConsultations();
    }
  }, [currentPage, consultaId]);

  // Carregar detalhes quando houver consulta_id na URL
  useEffect(() => {
    if (consultaId) {
      fetchConsultaDetails(consultaId);
    } else {
      setConsultaDetails(null);
    }
  }, [consultaId]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchConsultations(currentPage, 20);
      
      setConsultations(response.consultations);
      setTotalPages(response.pagination.totalPages);
      setTotalConsultations(response.pagination.total);
    } catch (err) {
      console.error('Erro ao carregar consultas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultaDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      setError(null);
      const response = await fetch(`/api/consultations/${id}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes da consulta');
      }
      
      const data = await response.json();
      setConsultaDetails(data.consultation);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes da consulta');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConsultationClick = (consultation: Consultation) => {
    router.push(`/consultas?consulta_id=${consultation.id}`);
  };

  const handleBackToList = () => {
    router.push('/consultas');
  };

  // Funções de formatação para lista
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Hoje, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 2) {
      return 'Ontem, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // Funções de formatação para detalhes
  const formatFullDate = (dateString: string) => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getTypeIcon = (type: string) => {
    return type === 'TELEMEDICINA' ? <Video className="type-icon" /> : <User className="type-icon" />;
  };

  const generateAvatar = (name: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const colorIndex = name.length % colors.length;
    
    return (
      <div 
        className="avatar-placeholder" 
        style={{ backgroundColor: colors[colorIndex] }}
      >
        {initials}
      </div>
    );
  };

  // Renderizar loading
  if (loading || loadingDetails) {
    return (
      <div className="consultas-container">
        <div className="consultas-header">
          <h1 className="consultas-title">
            {consultaId ? 'Detalhes da Consulta' : 'Lista de Consultas'}
          </h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{consultaId ? 'Carregando detalhes...' : 'Carregando consultas...'}</p>
        </div>
      </div>
    );
  }

  // Renderizar erro
  if (error) {
    return (
      <div className="consultas-container">
        <div className="consultas-header">
          <h1 className="consultas-title">
            {consultaId ? 'Detalhes da Consulta' : 'Lista de Consultas'}
          </h1>
        </div>
        <div className="error-container">
          <AlertCircle className="error-icon" />
          <h3>{consultaId ? 'Erro ao carregar detalhes' : 'Erro ao carregar consultas'}</h3>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => consultaId ? fetchConsultaDetails(consultaId) : loadConsultations()}
          >
            Tentar novamente
          </button>
          {consultaId && (
            <button 
              className="back-button"
              onClick={handleBackToList}
              style={{ marginTop: '10px' }}
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
              Voltar para lista
            </button>
          )}
        </div>
      </div>
    );
  }

  // Renderizar detalhes da consulta
  if (consultaId && consultaDetails) {
    return (
      <div className="consultas-container">
        <div className="consultas-header">
          <button 
            className="back-button"
            onClick={handleBackToList}
            style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="consultas-title">Detalhes da Consulta</h1>
        </div>

        <div className="modal-body">
          {/* Informações Básicas */}
          <div className="modal-section">
            <h3 className="section-title">
              <Calendar className="w-5 h-5" />
              Informações da Consulta
            </h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Paciente:</span>
                <span className="info-value">{consultaDetails.patient_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Tipo:</span>
                <span className="info-value">
                  {consultaDetails.consultation_type === 'PRESENCIAL' ? (
                    <><User className="w-4 h-4 inline mr-1" /> Presencial</>
                  ) : (
                    <><Video className="w-4 h-4 inline mr-1" /> Telemedicina</>
                  )}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`status-badge ${getStatusColor(consultaDetails.status)}`}>
                  {getStatusText(consultaDetails.status)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Data/Hora:</span>
                <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Duração:</span>
                <span className="info-value">
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatDuration(consultaDetails.duration)}
                </span>
              </div>
              {consultaDetails.next_appointment && (
                <div className="info-item">
                  <span className="info-label">Próxima Consulta:</span>
                  <span className="info-value">{formatFullDate(consultaDetails.next_appointment)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contexto do Paciente */}
          {consultaDetails.patient_context && (
            <div className="modal-section">
              <h3 className="section-title">
                <User className="w-5 h-5" />
                Contexto do Paciente
              </h3>
              <div className="section-content">
                <p>{consultaDetails.patient_context}</p>
              </div>
            </div>
          )}

          {/* Informações do Paciente */}
          {consultaDetails.patients && (
            <div className="modal-section">
              <h3 className="section-title">
                <User className="w-5 h-5" />
                Dados do Paciente
              </h3>
              <div className="info-grid">
                {consultaDetails.patients.email && (
                  <div className="info-item">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{consultaDetails.patients.email}</span>
                  </div>
                )}
                {consultaDetails.patients.phone && (
                  <div className="info-item">
                    <span className="info-label">Telefone:</span>
                    <span className="info-value">{consultaDetails.patients.phone}</span>
                  </div>
                )}
                {consultaDetails.patients.birth_date && (
                  <div className="info-item">
                    <span className="info-label">Data de Nascimento:</span>
                    <span className="info-value">{formatFullDate(consultaDetails.patients.birth_date)}</span>
                  </div>
                )}
                {consultaDetails.patients.gender && (
                  <div className="info-item">
                    <span className="info-label">Gênero:</span>
                    <span className="info-value">{consultaDetails.patients.gender}</span>
                  </div>
                )}
                {consultaDetails.patients.cpf && (
                  <div className="info-item">
                    <span className="info-label">CPF:</span>
                    <span className="info-value">{consultaDetails.patients.cpf}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transcrição */}
          {consultaDetails.transcription && (
            <div className="modal-section">
              <h3 className="section-title">
                <FileText className="w-5 h-5" />
                Transcrição
              </h3>
              <div className="section-content">
                {consultaDetails.transcription.summary && (
                  <div className="transcription-summary">
                    <h4>Resumo:</h4>
                    <p>{consultaDetails.transcription.summary}</p>
                  </div>
                )}
                
                {consultaDetails.transcription.key_points && consultaDetails.transcription.key_points.length > 0 && (
                  <div className="key-points">
                    <h4>Pontos Principais:</h4>
                    <ul>
                      {consultaDetails.transcription.key_points.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {consultaDetails.transcription.raw_text && (
                  <div className="raw-transcription">
                    <h4>Transcrição Completa:</h4>
                    <p>{consultaDetails.transcription.raw_text}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Diagnóstico e Tratamento */}
          {(consultaDetails.diagnosis || consultaDetails.treatment || consultaDetails.prescription) && (
            <div className="modal-section">
              <h3 className="section-title">
                <Stethoscope className="w-5 h-5" />
                Diagnóstico e Tratamento
              </h3>
              <div className="section-content">
                {consultaDetails.diagnosis && (
                  <div className="medical-info">
                    <h4>Diagnóstico:</h4>
                    <p>{consultaDetails.diagnosis}</p>
                  </div>
                )}
                
                {consultaDetails.treatment && (
                  <div className="medical-info">
                    <h4>Tratamento:</h4>
                    <p>{consultaDetails.treatment}</p>
                  </div>
                )}
                
                {consultaDetails.prescription && (
                  <div className="medical-info">
                    <h4>Prescrição:</h4>
                    <p>{consultaDetails.prescription}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notas */}
          {consultaDetails.notes && (
            <div className="modal-section">
              <h3 className="section-title">
                <FileText className="w-5 h-5" />
                Notas
              </h3>
              <div className="section-content">
                <p>{consultaDetails.notes}</p>
              </div>
            </div>
          )}

          {/* Arquivos de Áudio */}
          {consultaDetails.audioFiles && consultaDetails.audioFiles.length > 0 && (
            <div className="modal-section">
              <h3 className="section-title">
                <Mic className="w-5 h-5" />
                Arquivos de Áudio
              </h3>
              <div className="audio-files">
                {consultaDetails.audioFiles.map((file) => (
                  <div key={file.id} className="audio-file">
                    <div className="file-info">
                      <span className="file-name">{file.original_name || file.filename}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      {file.duration && (
                        <span className="file-duration">{formatDuration(file.duration)}</span>
                      )}
                    </div>
                    <div className="file-actions">
                      <button className="action-button" title="Reproduzir">
                        <Play className="w-4 h-4" />
                      </button>
                      <button className="action-button" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documentos */}
          {consultaDetails.documents && consultaDetails.documents.length > 0 && (
            <div className="modal-section">
              <h3 className="section-title">
                <FileText className="w-5 h-5" />
                Documentos
              </h3>
              <div className="documents">
                {consultaDetails.documents.map((doc) => (
                  <div key={doc.id} className="document">
                    <div className="document-info">
                      <span className="document-title">{doc.title}</span>
                      <span className="document-type">{doc.type}</span>
                    </div>
                    <div className="document-actions">
                      <button className="action-button" title="Visualizar">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button className="action-button" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Renderizar lista de consultas
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <h1 className="consultas-title">Lista de Consultas</h1>
        <div className="consultas-stats">
          <span>{totalConsultations} consultas encontradas</span>
        </div>
      </div>

      <div className="consultas-table-container">
        <div className="consultas-table">
          {/* Header da tabela */}
          <div className="table-header">
            <div className="header-cell patient-header">Paciente</div>
            <div className="header-cell date-header">Data Consulta</div>
            <div className="header-cell type-header">Tipo de Consulta</div>
            <div className="header-cell status-header">Status</div>
            <div className="header-cell actions-header"></div>
          </div>

          {/* Linhas da tabela */}
          <div className="table-body">
            {consultations.length === 0 ? (
              <div className="empty-state">
                <Calendar className="empty-icon" />
                <h3>Nenhuma consulta encontrada</h3>
                <p>Você ainda não possui consultas cadastradas.</p>
              </div>
            ) : (
              consultations.map((consultation) => (
                <div 
                  key={consultation.id} 
                  className="table-row"
                  onClick={() => handleConsultationClick(consultation)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="table-cell patient-cell">
                    <div className="patient-info">
                      {generateAvatar(consultation.patient_name)}
                      <div className="patient-details">
                        <div className="patient-name">{consultation.patient_name}</div>
                        <div className="patient-condition">
                          {consultation.patient_context || 'Consulta médica'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="table-cell date-cell">
                    {formatDate(consultation.created_at)}
                  </div>
                  
                  <div className="table-cell type-cell">
                    <div className="consultation-type">
                      {getTypeIcon(consultation.consultation_type)}
                      <span>{mapConsultationType(consultation.consultation_type)}</span>
                    </div>
                  </div>
                  
                  <div className="table-cell status-cell">
                    <StatusBadge 
                      status={mapBackendStatus(consultation.status)}
                      size="md"
                      showIcon={true}
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' ? 'outlined' : 'default'}
                    />
                  </div>
                  
                  <div className="table-cell actions-cell">
                    <button className="actions-button" onClick={(e) => { e.stopPropagation(); }}>
                      <MoreVertical className="actions-icon" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <button 
            className="pagination-arrow"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          
          {/* Primeira página */}
          {currentPage > 3 && (
            <>
              <button 
                className="pagination-number"
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
              {currentPage > 4 && <span className="pagination-dots">...</span>}
            </>
          )}
          
          {/* Páginas ao redor da atual */}
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
            if (pageNum > totalPages) return null;
            
            return (
              <button 
                key={pageNum}
                className={`pagination-number ${pageNum === currentPage ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          
          {/* Última página */}
          {currentPage < totalPages - 2 && (
            <>
              {currentPage < totalPages - 3 && <span className="pagination-dots">...</span>}
              <button 
                className="pagination-number"
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
          
          <button 
            className="pagination-arrow"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      )}

    </div>
  );
}

// Loading component para o Suspense
function ConsultasPageLoading() {
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <h1 className="consultas-title">Lista de Consultas</h1>
      </div>
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    </div>
  );
}

// Wrapper com Suspense
export default function ConsultasPage() {
  return (
    <Suspense fallback={<ConsultasPageLoading />}>
      <ConsultasPageContent />
    </Suspense>
  );
}