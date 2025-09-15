'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin, Calendar, Grid3X3, List } from 'lucide-react';
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

      const response = await fetch(`/api/patients?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar pacientes');
      }

      const data: PatientsResponse = await response.json();
      setPatients(data.patients);
      setPagination(data.pagination);
    } catch (err) {
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

  return (
    <div className="patients-page">
      {/* Header da Página */}
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-title-section">
            <h1 className="page-title">Pacientes</h1>
            <p className="page-subtitle">
              Gerencie seus pacientes e suas informações médicas
            </p>
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <Plus className="btn-icon" />
            Novo Paciente
          </button>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar pacientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-right">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="archived">Arquivados</option>
          </select>

          <div className="view-toggle">
            <button
              onClick={() => setViewMode('cards')}
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              title="Visualização em cards"
            >
              <Grid3X3 className="view-icon" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="Visualização em lista"
            >
              <List className="view-icon" />
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="content-area">
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
            <div className="empty-icon">
              <Plus className="empty-icon-svg" />
            </div>
            <h3 className="empty-title">Nenhum Paciente Registrado</h3>
            <p className="empty-description">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nenhum paciente encontrado com os filtros aplicados. Tente ajustar os critérios de busca.'
                : 'Você ainda não possui pacientes cadastrados. Comece adicionando seu primeiro paciente para gerenciar suas consultas.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button 
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                <Plus className="btn-icon" />
                Cadastrar Primeiro Paciente
              </button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="patients-grid">
            {patients.map((patient) => {
              const age = calculateAge(patient.birth_date);
              
              return (
                <div key={patient.id} className="patient-card">
                  {/* Header do Card */}
                  <div className="card-header">
                    <div className="patient-info">
                      <h3 className="patient-name">
                        {patient.name}
                      </h3>
                      <div className="patient-meta">
                        {patient.gender && (
                          <span className="meta-item">
                            {patient.gender === 'M' ? 'Masculino' : 
                             patient.gender === 'F' ? 'Feminino' : 'Outro'}
                          </span>
                        )}
                        {age && (
                          <span className="meta-item">{age} anos</span>
                        )}
                        {patient.city && (
                          <span className="meta-item location">
                            <MapPin className="meta-icon" />
                            {patient.city}{patient.state && `, ${patient.state}`}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="card-actions">
                      <span className={`status-badge status-${patient.status}`}>
                        {getStatusText(patient.status)}
                      </span>
                      
                      <div className="action-menu">
                        <button className="menu-trigger">
                          <MoreVertical className="menu-icon" />
                        </button>
                        <div className="menu-dropdown">
                          <button 
                            onClick={() => setEditingPatient(patient)}
                            className="menu-item"
                          >
                            <Edit className="menu-item-icon" />
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeletePatient(patient.id)}
                            className="menu-item delete"
                          >
                            <Trash2 className="menu-item-icon" />
                            Deletar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contatos */}
                  <div className="patient-contacts">
                    {patient.phone && (
                      <div className="contact-item">
                        <Phone className="contact-icon" />
                        <span>{patient.phone}</span>
                      </div>
                    )}
                    {patient.email && (
                      <div className="contact-item">
                        <Mail className="contact-icon" />
                        <span>{patient.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Informações Médicas */}
                  {(patient.medical_history || patient.allergies) && (
                    <div className="medical-info">
                      {patient.medical_history && (
                        <div className="info-section">
                          <h4 className="info-title">Histórico Médico</h4>
                          <p className="info-content">{patient.medical_history}</p>
                        </div>
                      )}

                      {patient.allergies && (
                        <div className="info-section">
                          <h4 className="info-title">Alergias</h4>
                          <p className="info-content">{patient.allergies}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="card-footer">
                    <div className="patient-date">
                      <Calendar className="date-icon" />
                      <span>Cadastrado em {new Date(patient.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="patients-list">
            <div className="list-header">
              <div className="list-cell name">Nome</div>
              <div className="list-cell contact">Contato</div>
              <div className="list-cell location">Localização</div>
              <div className="list-cell status">Status</div>
              <div className="list-cell date">Data</div>
              <div className="list-cell actions">Ações</div>
            </div>
            {patients.map((patient) => {
              const age = calculateAge(patient.birth_date);
              
              return (
                <div key={patient.id} className="list-row">
                  <div className="list-cell name">
                    <div className="patient-name-list">
                      <h4>{patient.name}</h4>
                      <div className="patient-meta-list">
                        {patient.gender && (
                          <span className="meta-item">
                            {patient.gender === 'M' ? 'Masculino' : 
                             patient.gender === 'F' ? 'Feminino' : 'Outro'}
                          </span>
                        )}
                        {age && (
                          <span className="meta-item">{age} anos</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="list-cell contact">
                    <div className="contact-list">
                      {patient.phone && (
                        <div className="contact-item-list">
                          <Phone className="contact-icon" />
                          <span>{patient.phone}</span>
                        </div>
                      )}
                      {patient.email && (
                        <div className="contact-item-list">
                          <Mail className="contact-icon" />
                          <span>{patient.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="list-cell location">
                    {patient.city && (
                      <div className="location-list">
                        <MapPin className="location-icon" />
                        <span>{patient.city}{patient.state && `, ${patient.state}`}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="list-cell status">
                    <span className={`status-badge status-${patient.status}`}>
                      {getStatusText(patient.status)}
                    </span>
                  </div>
                  
                  <div className="list-cell date">
                    <Calendar className="date-icon" />
                    <span>{new Date(patient.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  
                  <div className="list-cell actions">
                    <div className="action-menu">
                      <button className="menu-trigger">
                        <MoreVertical className="menu-icon" />
                      </button>
                      <div className="menu-dropdown">
                        <button 
                          onClick={() => setEditingPatient(patient)}
                          className="menu-item"
                        >
                          <Edit className="menu-item-icon" />
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeletePatient(patient.id)}
                          className="menu-item delete"
                        >
                          <Trash2 className="menu-item-icon" />
                          Deletar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => fetchPatients(pagination.page - 1, searchTerm, statusFilter)}
              disabled={pagination.page === 1}
              className="btn btn-secondary"
            >
              Anterior
            </button>
            
            <span className="pagination-info">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            
            <button
              onClick={() => fetchPatients(pagination.page + 1, searchTerm, statusFilter)}
              disabled={pagination.page === pagination.totalPages}
              className="btn btn-secondary"
            >
              Próxima
            </button>
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