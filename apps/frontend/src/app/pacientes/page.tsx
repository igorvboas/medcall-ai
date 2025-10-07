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

  return (
    <div className="patients-page">
      {/* Lista de Pacientes - Design da Imagem */}
      <div className="patients-list-design">
        <h1 className="patients-list-title">Lista de Pacientes</h1>
        
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
              Você ainda não possui pacientes cadastrados.
            </p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <Plus className="btn-icon" />
              Cadastrar Primeiro Paciente
            </button>
          </div>
        ) : (
          <>
            {patients.map((patient) => (
              <div 
                key={patient.id} 
                className="patient-item"
                onClick={() => setEditingPatient(patient)}
                style={{ cursor: 'pointer' }}
              >
                <div className="patient-avatar">
                  {patient.name.charAt(0).toUpperCase()}
                </div>
                <div className="patient-info">
                  <div className="patient-details">
                    <div className="patient-name">{patient.name}</div>
                    <div className="patient-condition">{patient.medical_history || 'Infectious disease'}</div>
                  </div>
                  <div className="patient-date">
                    {patient.created_at ? new Date(patient.created_at).toLocaleDateString('pt-BR', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'N/A'}
                  </div>
                  <div className="patient-specialty">{(patient as any).specialty || 'Geriatrician'}</div>
                  <div className="patient-actions">
                    <button 
                      className="patient-menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Aqui você pode implementar um dropdown menu se necessário
                        console.log('Menu clicked for patient:', patient.name);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
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
          </>
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