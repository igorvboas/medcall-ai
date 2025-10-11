'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin, Calendar, Grid3X3, List, Link2 } from 'lucide-react';
import { PatientForm } from '@/components/patients/PatientForm';
import './pacientes.css';

// Tipos locais para pacientes
interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
}

interface CreatePatientData {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
}

interface PatientsResponse {
  patients: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });


  // Buscar pacientes
  const fetchPatients = async (page = 1, search = '', status = 'all') => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);

      console.log('🔍 Buscando pacientes...', `/api/patients?${params}`);

      const response = await fetch(`/api/patients?${params}`, {
        credentials: 'include',
      });
      
      console.log('📡 Resposta da API:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar pacientes');
      }

      const data: PatientsResponse = await response.json();
      console.log('📋 Dados recebidos:', data);
      setPatients(data.patients);
      setPagination(data.pagination);
    } catch (err) {
      console.error('❌ Erro ao buscar pacientes:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar pacientes na montagem do componente
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fechar modal com tecla ESC
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showForm) {
          setShowForm(false);
        }
        if (editingPatient) {
          setEditingPatient(null);
        }
      }
    };

    if (showForm || editingPatient) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevenir scroll do body quando modal está aberto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showForm, editingPatient]);

  // Buscar pacientes quando filtros mudarem
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPatients(1, searchTerm, statusFilter);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  // Criar novo paciente
  const handleCreatePatient = async (patientData: CreatePatientData) => {
    try {
      console.log('📤 Enviando dados do paciente:', patientData);
      
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(patientData),
      });

      console.log('📥 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Paciente criado com sucesso:', result);

      setShowForm(false);
      fetchPatients(pagination.page, searchTerm, statusFilter);
    } catch (err) {
      console.error('❌ Erro ao criar paciente:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar paciente');
    }
  };

  // Atualizar paciente
  const handleUpdatePatient = async (patientData: CreatePatientData) => {
    if (!editingPatient) return;

    try {
      const response = await fetch(`/api/patients/${editingPatient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar paciente');
      }

      setEditingPatient(null);
      fetchPatients(pagination.page, searchTerm, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar paciente');
    }
  };

  // Deletar paciente
  const handleDeletePatient = async (patientId: string) => {
    if (!confirm('Tem certeza que deseja deletar este paciente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar paciente');
      }

      fetchPatients(pagination.page, searchTerm, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar paciente');
    }
  };

  // Calcular idade
  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  // Copiar link da anamnese personalizada
  const handleCopyAnamneseLink = async (patientId: string) => {
    const link = `${window.location.origin}/anamnese-personalizada?paciente_id=${patientId}`;
    try {
      await navigator.clipboard.writeText(link);
      // TODO: Adicionar feedback visual de sucesso (toast/notification)
      alert('Link da anamnesecopiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao copiar link. Tente novamente.');
    }
  };

  return (
    <div className="patients-page">
      <div className="patients-container">
        {/* Header */}
        <div className="patients-header">
          <h1 className="patients-title">Lista de Pacientes</h1>
          <p className="patients-subtitle">Gerencie seus pacientes de forma eficiente</p>
        </div>
        
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Carregando pacientes...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-content">
              <p className="error-title">Erro ao buscar pacientes</p>
              <p className="error-message">{error}</p>
            </div>
            <button 
              onClick={() => fetchPatients()}
              className="btn btn-secondary"
            >
              Tentar Novamente
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum paciente encontrado</h3>
            <p>Comece cadastrando seu primeiro paciente para gerenciar suas consultas.</p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <Plus className="btn-icon" />
              Cadastrar Primeiro Paciente
            </button>
          </div>
        ) : (
          <div className="patients-cards-container">
            {/* Filtros */}
            <div className="filters-section">
              <div className="search-container">
                <Search className="search-icon" size={20} />
                <input
                  type="text"
                  placeholder="Buscar pacientes..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    fetchPatients(1, e.target.value, statusFilter);
                  }}
                  className="search-input"
                />
              </div>
              
              <div className="filters-right">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const newStatus = e.target.value as 'all' | 'active' | 'inactive' | 'archived';
                    setStatusFilter(newStatus);
                    fetchPatients(1, searchTerm, newStatus);
                  }}
                  className="status-filter"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="archived">Arquivados</option>
                </select>
                <button 
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  <Plus className="btn-icon" />
                  Novo Paciente
                </button>
              </div>
            </div>

            {/* Grid de Cards */}
            <div className="patients-grid">
              {patients.map((patient) => (
                <div key={patient.id} className="patient-card">
                  <div className="patient-card-header">
                    <div className="patient-info">
                      <h3 className="patient-name">{patient.name}</h3>
                      <span className={`patient-status ${patient.status}`}>
                        {getStatusText(patient.status)}
                      </span>
                    </div>
                    <div className="patient-actions">
                      <button 
                        className="action-btn copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAnamneseLink(patient.id);
                        }}
                        title="Copiar link da anamnese personalizada"
                      >
                        <Link2 size={12} />
                      </button>
                      <button 
                        className="action-btn edit"
                        onClick={() => setEditingPatient(patient)}
                        title="Editar paciente"
                      >
                        <Edit size={12} />
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Implementar confirmação de exclusão
                          console.log('Delete patient:', patient.name);
                        }}
                        title="Excluir paciente"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="patient-details">
                    {patient.email && (
                      <div className="detail-item">
                        <Mail size={16} />
                        <span className="detail-value">{patient.email}</span>
                      </div>
                    )}
                    {patient.phone && (
                      <div className="detail-item">
                        <Phone size={16} />
                        <span className="detail-value">{patient.phone}</span>
                      </div>
                    )}
                    {(patient.city || patient.state) && (
                      <div className="detail-item">
                        <MapPin size={16} />
                        <span className="detail-value">
                          {[patient.city, patient.state].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {patient.birth_date && (
                      <div className="detail-item">
                        <Calendar size={16} />
                        <span className="detail-value">
                          {new Date(patient.birth_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Paginação */}
            {pagination.totalPages > 1 && (
              <div className="pagination-design">
                <button 
                  className="pagination-btn" 
                  disabled={pagination.page === 1}
                  onClick={() => fetchPatients(pagination.page - 1, searchTerm, statusFilter)}
                >
                  <span>‹</span>
                </button>
                
                {/* Primeira página */}
                {pagination.page > 3 && (
                  <>
                    <button 
                      className="pagination-number"
                      onClick={() => fetchPatients(1, searchTerm, statusFilter)}
                    >
                      1
                    </button>
                    {pagination.page > 4 && <span className="pagination-dots">...</span>}
                  </>
                )}
                
                {/* Páginas ao redor da atual */}
                {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.totalPages - 2, pagination.page - 1)) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button 
                      key={pageNum}
                      className={`pagination-number ${pageNum === pagination.page ? 'active' : ''}`}
                      onClick={() => fetchPatients(pageNum, searchTerm, statusFilter)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {/* Última página */}
                {pagination.page < pagination.totalPages - 2 && (
                  <>
                    {pagination.page < pagination.totalPages - 3 && <span className="pagination-dots">...</span>}
                    <button 
                      className="pagination-number"
                      onClick={() => fetchPatients(pagination.totalPages, searchTerm, statusFilter)}
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}
                
                <button 
                  className="pagination-btn"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => fetchPatients(pagination.page + 1, searchTerm, statusFilter)}
                >
                  <span>›</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Modal de Formulário */}
      {showForm && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal-content">
            <PatientForm
              onSubmit={handleCreatePatient}
              onCancel={() => setShowForm(false)}
              title="Novo Paciente"
            />
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingPatient && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingPatient(null);
            }
          }}
        >
          <div className="modal-content">
            <PatientForm
              patient={editingPatient}
              onSubmit={handleUpdatePatient}
              onCancel={() => setEditingPatient(null)}
              title="Editar Paciente"
            />
          </div>
        </div>
      )}
    </div>
  );
}