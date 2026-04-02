'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Save, X, Sparkles, Edit, Plus, Trash2, Pencil, ArrowRight, Search, Send,
  Dna, Brain, Apple, Pill, Dumbbell, Leaf, LogIn, Scale, Ruler, Droplet, FolderOpen, AlertTriangle, FileDown, ChevronRight, Copy, Loader2, ClipboardCheck, CheckCircle
} from 'lucide-react';
import Image from 'next/image';
import { StatusBadge, mapBackendStatus } from '../../components/StatusBadge';
import ExamesUploadSection from '../../components/ExamesUploadSection';
import SolutionsViewer from '../../components/solutions/SolutionsViewer';
import EvolucaoSection from '../../components/evolucao/EvolucaoSection';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import { downloadSolutionsDocxPremium } from '@/lib/solutionsToDocx';
import { fetchSolutionsFromGateway } from '@/lib/fetchSolutions';
import { useAuth } from '@/hooks/useAuth';
import './consultas.css';
import '../../components/solutions/solutions.css';
import { TutorialPopup } from '@/components/dashboard/TutorialPopup';
import { CONSULTAS_STEPS } from '@/components/dashboard/tutorialSteps';

// Tipos para exercícios físicos
interface ExercicioFisico {
  id: number;
  consulta_id: string;
  paciente_id: string;
  user_id?: string;
  thread_id?: string;
  tipo_treino?: string;
  grupo_muscular?: string;
  nome_exercicio?: string;
  series?: string;
  repeticoes?: string;
  descanso?: string;
  observacoes?: string;
  treino_atual?: number;
  proximo_treino?: number;
  ultimo_treino?: boolean;
  alertas_importantes?: string;
  nome_treino?: string;
  created_at?: string;
}

// Tipos para consultas da API
interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_context?: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'ERROR' | 'CANCELLED' | 'COMPLETED' | 'AGENDAMENTO';
  from?: string | null;
  doctor_name?: string | null;
  doctor_email?: string | null;
  etapa?: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO';
  solucao_etapa?: 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA';
  duration?: number;
  recording_url?: string;
  notes?: string;
  diagnosis?: string;
  treatment?: string;
  patients?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    profile_pic?: string;
  };
  prescription?: string;
  next_appointment?: string;
  consulta_inicio?: string;
  consulta_fim?: string;
  created_at: string;
  updated_at: string;
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

// Tipos para dados de anamnese
interface AnamneseData {
  cadastro_prontuario: any;
  objetivos_queixas: any;
  historico_risco: any;
  observacao_clinica_lab: any;
  historia_vida: any;
  setenios_eventos: any;
  ambiente_contexto: any;
  sensacao_emocoes: any;
  preocupacoes_crencas: any;
  reino_miasma: any;
}

// Função para buscar consultas da API
async function fetchConsultations(
  page: number = 1,
  limit: number = 20,
  search: string = '',
  status: string = 'all',
  dateFilter?: { type: 'day' | 'week' | 'month', date: string },
  doctorId?: string | null
): Promise<ConsultationsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  if (dateFilter) {
    params.append('dateFilter', dateFilter.type);
    params.append('date', dateFilter.date);
  }
  if (doctorId) params.append('doctor_id', doctorId);

  const queryParams: Record<string, string | number | boolean> = {};
  params.forEach((value, key) => {
    queryParams[key] = value;
  });

  const response = await gatewayClient.get<ConsultationsResponse>('/consultations', { queryParams });

  if (!response.success) {
    throw new Error(response.error || 'Erro ao buscar consultas');
  }

  return response;
}

// Função para buscar uma consulta específica
async function fetchConsultationById(id: string): Promise<any> {
  const response = await gatewayClient.get<any>(`/consultations/${id}`);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao buscar consulta');
  }

  return response;
}

// Função para atualizar uma consulta
async function updateConsultationData(id: string, data: any): Promise<any> {
  const response = await gatewayClient.patch<any>(`/consultations/${id}`, data);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao atualizar consulta');
  }

  return response;
}

// Função para deletar uma consulta
async function deleteConsultationData(id: string): Promise<any> {
  const response = await gatewayClient.delete<any>(`/consultations/${id}`);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao deletar consulta');
  }

  return response;
}

// Componente de Seção Colapsável
function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Atualizar estado quando defaultOpen mudar (para suportar activeTab)
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="collapsible-section">
      <button
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="collapsible-title">{title}</span>
        <ArrowLeft
          className={`collapsible-icon ${isOpen ? 'open' : ''}`}
          style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(180deg)' }}
        />
      </button>
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

// Componente para renderizar campo de dados (agora editável)
function DataField({
  label,
  value,
  fieldPath,
  consultaId,
  onSave,
  onAIEdit,
  readOnly = false,
  hideActions = false
}: {
  label: string;
  value: any;
  fieldPath?: string;
  consultaId?: string;
  onSave?: (fieldPath: string, newValue: string, consultaId: string) => Promise<void>;
  onAIEdit?: (fieldPath: string, label: string) => void;
  readOnly?: boolean;
  /** Oculta botões Editar com IA e Editar manualmente (ex.: aba Síntese) */
  hideActions?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    if (!fieldPath || !consultaId || !onSave) return;
    setEditValue(String(value || ''));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!fieldPath || !consultaId || !onSave) return;

    if (editValue === String(value || '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fieldPath, editValue, consultaId);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      // Aqui você pode adicionar uma notificação de erro
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const renderValue = () => {
    // Função auxiliar para verificar se o valor é vazio/null
    const isEmptyValue = (val: any): boolean => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && (val.trim() === '' || val.toLowerCase() === 'null')) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    };

    // Se não houver valor ou for "null" como string: CSS .data-value-empty::before exibe "Não informado"
    if (isEmptyValue(value)) {
      return <p className="data-value data-value-empty"></p>;
    }

    // Se for array, renderizar lista
    if (Array.isArray(value)) {
      return (
        <ul className="data-list">
          {value.map((item, index) => {
            // Verificar se cada item do array também não é null
            const displayItem = isEmptyValue(item) ? 'Não informado' : String(item);
            return <li key={index}>{displayItem}</li>;
          })}
        </ul>
      );
    }

    // Converter para string e verificar se é "null"
    const stringValue = String(value);
    const displayValue = (stringValue.toLowerCase() === 'null' || stringValue.trim() === '')
      ? 'Não informado'
      : stringValue;

    // Se o texto contém quebras de linha, renderizar preservando as quebras
    if (displayValue.includes('\n')) {
      return (
        <div className="data-value">
          {displayValue.split('\n').map((line, idx) => (
            <div key={idx} style={{ marginBottom: idx < displayValue.split('\n').length - 1 ? '8px' : '0' }}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      );
    }

    // Renderizar valor normal
    return <p className="data-value">{displayValue}</p>;
  };

  return (
    <>
      <div className="data-field">
        <div className="data-field-header">
          <label className="data-label">{label}:</label>
          {!readOnly && !hideActions && (
            <div className="field-actions">
              {fieldPath && consultaId && onAIEdit && (
                <button
                  className="ai-button"
                  onClick={() => onAIEdit(fieldPath, label)}
                  title="Editar com IA"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
              {fieldPath && consultaId && onSave && (
                <button
                  className="edit-button"
                  onClick={handleEdit}
                  title="Editar campo manualmente"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        {renderValue()}
      </div>

      {isEditing && (
        <div className="edit-modal-overlay" onClick={handleCancel}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3 className="edit-modal-title">Editar: {label}</h3>
              <button
                className="edit-modal-close"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="edit-modal-body">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="edit-modal-input"
                placeholder="Digite o novo valor..."
                autoFocus
              />
            </div>
            <div className="edit-modal-actions">
              <button
                className="cancel-button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                className="save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="loading-spinner-small"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Componente para renderizar campo do cadastro de anamnese (a_cadastro_anamnese)
function CadastroDataField({
  label,
  value,
  fieldName,
  onSave,
  readOnly = false,
  mask
}: {
  label: string;
  value: any;
  fieldName: string;
  onSave: (fieldName: string, newValue: string) => Promise<void>;
  readOnly?: boolean;
  mask?: 'date';
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const applyDateMask = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const formatDisplayDate = (val: string) => {
    if (!val) return val;
    // Already formatted
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;
    // Raw digits like "02052001"
    const digits = val.replace(/\D/g, '');
    if (digits.length === 8) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    return val;
  };

  const handleEdit = () => {
    const raw = String(value || '');
    setEditValue(mask === 'date' ? applyDateMask(raw) : raw);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue === String(value || '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fieldName, editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar campo do cadastro:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const renderValue = () => {
    const isEmpty = !value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      return <p className="data-value data-value-empty"></p>;
    }

    if (Array.isArray(value)) {
      return (
        <ul className="data-list">
          {value.map((item, index) => (
            <li key={index}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
          ))}
        </ul>
      );
    }

    const displayVal = mask === 'date' ? formatDisplayDate(String(value)) : String(value);
    return <p className="data-value">{displayVal}</p>;
  };

  return (
    <div className="data-field">
      <div className="data-field-header">
        <label className="data-label">{label}:</label>
        {!readOnly && !isEditing && (
          <button
            className="edit-button-small"
            onClick={handleEdit}
            title="Editar campo"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="edit-field">
          {mask === 'date' ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(applyDateMask(e.target.value))}
              className="edit-input"
              placeholder="DD/MM/AAAA"
              maxLength={10}
            />
          ) : (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="edit-input"
              rows={3}
              placeholder="Digite o novo valor..."
            />
          )}
          <div className="edit-actions">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="loading-spinner-small"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        renderValue()
      )}
    </div>
  );
}

// Tipos para mensagens do chat
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Limpar texto com barras escapadas (ex: \" \n \\ vindos do JSON)
function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  // Remover barras escapadas comuns de JSON stringificado
  s = s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, ' ').replace(/\\r/g, '');
  // Remover aspas duplas no início/fim se o texto inteiro está entre aspas
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}

// Componente da seção de Anamnese
function AnamneseSection({
  consultaId,
  patientId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange,
  readOnly = false,
  consultaStatus,
  consultaEtapa,
  renderViewSolutionsButton,
  activeTab
}: {
  consultaId: string;
  patientId?: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
  readOnly?: boolean;
  consultaStatus?: string;
  consultaEtapa?: string;
  renderViewSolutionsButton?: () => JSX.Element;
  activeTab?: string;
}) {
  console.log('🔍 [AnamneseSection] Componente renderizado com consultaId:', consultaId, 'patientId:', patientId);

  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  //console.log('🔍 AnamneseSection readOnly:', readOnly);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinteseAnalitica, setSinteseAnalitica] = useState<any>(null);
  const [loadingSintese, setLoadingSintese] = useState(false);
  const [cadastroAnamnese, setCadastroAnamnese] = useState<any>(null);
  const [loadingCadastro, setLoadingCadastro] = useState(false);
  const [viewPopupSection, setViewPopupSection] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Função para selecionar campo para edição com IA
  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  // Função para salvar campo editado
  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // 1. Atualizar no Gateway
      const response = await gatewayClient.post(`/anamnese/${consultaId}/update-field`, {
        [fieldPath]: newValue,
      });

      if (!response.success) {
        throw new Error(response.error || "Erro na requisição");
      }

      const result = response;

      // Obter dados da resposta da API
      console.log('📦 Dados retornados pela API:', result);

      // 2. Fazer requisição para o webhook (não bloqueante)
      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();

      fetch(webhookEndpoints.edicaoAnamnese, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          fieldPath,
          value: newValue,
          consultaId,
          origem: 'manual',
        }),
      }).catch(err => {
        console.warn('Webhook falhou, mas campo foi salvo no Gateway', err);
      });

      // 3. Atualizar o estado local usando os dados da API
      const responseData = result.anamnese || result.data || result.diagnostico || result.solucao;
      if (result.success && responseData) {
        console.log('🔄 Atualizando interface com dados da API:', responseData);

        // Determinar qual seção da anamnese atualizar baseado no fieldPath
        const pathParts = fieldPath.split('.');
        const tableName = pathParts[0];

        // Mapear nome da tabela para a chave do estado
        const stateKeyMap: { [key: string]: string } = {
          'a_cadastro_prontuario': 'cadastro_prontuario',
          'a_objetivos_queixas': 'objetivos_queixas',
          'a_historico_risco': 'historico_risco',
          'a_observacao_clinica_lab_2': 'observacao_clinica_lab',
          'a_historia_vida': 'historia_vida',
          'a_setenios_eventos': 'setenios_eventos',
          'a_ambiente_contexto': 'ambiente_contexto',
          'a_sensacao_emocoes': 'sensacao_emocoes',
          'a_preocupacoes_crencas': 'preocupacoes_crencas',
          'a_reino_miasma': 'reino_miasma',
        };

        const stateKey = stateKeyMap[tableName];
        if (stateKey && anamneseData) {
          // Atualizar a seção específica com os dados completos da API
          setAnamneseData(prev => ({
            ...prev!,
            [stateKey]: responseData
          }));
          console.log('✅ Interface atualizada com dados da API');
        } else if (tableName === 'a_sintese_analitica') {
          // Se for síntese analítica, atualizar o estado específico
          fetchSinteseAnalitica();
          console.log('✅ Síntese analítica atualizada');
        } else {
          console.warn('⚠️ Não foi possível mapear a tabela para o estado:', tableName);
        }
      } else {
        console.warn('⚠️ Resposta da API não contém dados válidos:', result);
      }

    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const fetchAnamneseData = async () => {
    try {
      if (!consultaId) {
        console.warn('⚠️ consultaId é null, não carregando anamnese');
        return;
      }

      setLoadingDetails(true);
      setError(null);

      // Buscar dados de todas as tabelas de anamnese
      console.log('🔍 Buscando anamnese para consulta_id:', consultaId);
      const response = await gatewayClient.get<AnamneseData>(`/anamnese/${consultaId}`);

      console.log('📡 Status da resposta:', response.status);

      if (!response.success) {
        console.error('❌ Erro da API:', response.error);
        throw new Error(response.error || 'Erro ao carregar dados da anamnese');
      }

      const data = response;
      console.log('✅ Dados da anamnese recebidos:', data);
      console.log('🔍 Estrutura dos dados:', {
        type: typeof data,
        keys: Object.keys(data || {}),
        hasData: !!data
      });
      setAnamneseData(data);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    } catch (err) {
      console.error('❌ Erro ao carregar anamnese:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese');
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading em caso de erro
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchSinteseAnalitica = async () => {
    try {
      if (!consultaId) {
        console.warn('⚠️ consultaId é null, não carregando síntese analítica');
        setSinteseAnalitica(null);
        return;
      }

      setLoadingSintese(true);
      console.log('🔍 Carregando síntese analítica para consultaId:', consultaId);

      const response = await gatewayClient.get<any>(`/sintese-analitica/${consultaId}`);

      if (!response.success) {
        // Se não encontrar, retornar null (não é erro)
        if (response.status === 404) {
          console.log('ℹ️ Síntese analítica não encontrada (404)');
          setSinteseAnalitica(null);
          return;
        }
        throw new Error(response.error || 'Erro ao carregar síntese analítica');
      }

      const sintese = response.data || response;
      console.log('✅ Síntese analítica carregada:', sintese);
      setSinteseAnalitica(sintese);
    } catch (err) {
      console.error('❌ Erro ao carregar síntese analítica:', err);
      setSinteseAnalitica(null);
    } finally {
      setLoadingSintese(false);
    }
  };

  useEffect(() => {
    console.log('🔍 [AnamneseSection] useEffect disparado - consultaId:', consultaId);
    if (consultaId) {
      console.log('✅ [AnamneseSection] consultaId válido, chamando fetch...');
      fetchAnamneseData();
      fetchSinteseAnalitica();
    } else {
      console.warn('⚠️ [AnamneseSection] consultaId é null/undefined, não carregando dados');
    }
  }, [consultaId]);

  // Buscar dados do cadastro de anamnese quando tiver patientId
  useEffect(() => {
    if (patientId) {
      fetchCadastroAnamnese();
    }
  }, [patientId]);

  // Listener para recarregar dados de anamnese e síntese analítica quando a IA processar (edição na Análise)
  useEffect(() => {
    const handleAnamneseRefresh = () => {
      fetchAnamneseData();
      fetchSinteseAnalitica(); // Atualiza também a Síntese Analítica após edição com IA na tela de Análise
    };

    window.addEventListener('force-anamnese-refresh', handleAnamneseRefresh);

    return () => {
      window.removeEventListener('force-anamnese-refresh', handleAnamneseRefresh);
    };
  }, []);

  // Função para buscar dados do cadastro de anamnese (a_cadastro_anamnese)
  const fetchCadastroAnamnese = async () => {
    if (!patientId) return;

    try {
      setLoadingCadastro(true);
      console.log('🔍 Buscando cadastro anamnese para paciente_id:', patientId);

      const response = await gatewayClient.get<any>(`/cadastro-anamnese/${patientId}`);

      if (!response.success) {
        if (response.status === 404) {
          setCadastroAnamnese(null);
          return;
        }
        throw new Error('Erro ao buscar cadastro de anamnese');
      }

      const data = response.cadastro || response.data?.cadastro || response;  // Extrair cadastro
      console.log('✅ Dados do cadastro anamnese recebidos:', data);
      setCadastroAnamnese(data);
    } catch (err) {
      console.error('❌ Erro ao carregar cadastro anamnese:', err);
      setCadastroAnamnese(null);
    } finally {
      setLoadingCadastro(false);
    }
  };

  // Função para salvar campo do cadastro de anamnese
  const handleSaveCadastroField = async (fieldName: string, newValue: string) => {
    if (!patientId) return;

    try {
      const response = await gatewayClient.post(`/cadastro-anamnese/${patientId}`, {
        [fieldName]: newValue,
      });

      if (!response.success) {
        throw new Error(response.error || "Erro na requisição");
      }

      const result = response;
      console.log('✅ Campo do cadastro atualizado:', result);

      // Atualizar estado local
      if (result.success && result.cadastro) {
        setCadastroAnamnese(result.cadastro);
      }
    } catch (error) {
      console.error('Erro ao salvar campo do cadastro:', error);
      throw error;
    }
  };

  // Extrair dados (podem ser null) - sempre renderizar campos mesmo com erro
  const {
    cadastro_prontuario,
    objetivos_queixas,
    historico_risco,
    observacao_clinica_lab,
    historia_vida,
    setenios_eventos,
    ambiente_contexto,
    sensacao_emocoes,
    preocupacoes_crencas,
    reino_miasma
  } = anamneseData || {};

  // Mapear activeTab para o título da seção
  const getSectionTitle = (tab: string) => {
    const map: { [key: string]: string } = {
      'Síntese': 'Síntese',
      'Dados do Paciente': 'Dados do Paciente',
      'Objetivos e Queixas': 'Objetivos e Queixas',
      'Histórico de Risco': 'Histórico de Risco',
      'Observação Clínica e Laboratorial': 'Observação Clínica e Laboratorial',
      'História de vida': 'História de Vida',
      'Setênios e Eventos': 'Setênios e Eventos',
      'Ambiente e Contexto': 'Ambiente e Contexto',
      'Sensação e Emoções': 'Sensação e Emoções',
      'Preocupações e Crenças': 'Preocupações e Crenças',
      'Reino e Miasma': 'Reino e Miasma'
    };
    return map[tab] || tab;
  };

  const shouldShowSection = (sectionTitle: string): boolean => {
    if (!activeTab) {
      return true; // Se não há tab ativa, mostrar todas
    }
    const mappedTitle = getSectionTitle(activeTab);
    const shouldShow = mappedTitle === sectionTitle;
    return shouldShow;
  };

  // Mostrar loading apenas no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando anamnese...</p>
      </div>
    );
  }

  console.log('🔍 AnamneseSection - Renderizando com dados:', {
    loading,
    error,
    hasAnamneseData: !!anamneseData,
    anamneseDataKeys: anamneseData ? Object.keys(anamneseData) : []
  });

  return (
    <div className="anamnese-sections">
      {/* Alerta de erro discreto - não bloqueia a visualização */}
      {error && (
        <div className="anamnese-warning-banner">
          <AlertCircle className="w-5 h-5" />
          <div>
            <strong>Atenção:</strong> {error}. Os campos estão sendo exibidos vazios.
          </div>
        </div>
      )}

      {/* Síntese Analítica - Agora dentro do menu */}
      {shouldShowSection('Síntese') && sinteseAnalitica && (
        <CollapsibleSection title="Sintese Analitica" defaultOpen={activeTab === 'Síntese' || !activeTab}>
          <div onClick={() => setViewPopupSection('sintese')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const s = sinteseAnalitica;
              const fields = [
                { label: 'Sintese', value: s.sintese },
                { label: 'Tres Linhas', value: s.tres_linhas },
                { label: 'Eixo Causal Principal', value: s.eixo_causal_principal },
                { label: 'Perpetuadores', value: s.perpetuadores },
                { label: 'Achados Urgentes', value: s.achados_criticos_urgentes },
                { label: 'Achados Importantes', value: s.achados_criticos_importantes },
                { label: 'Psicoemocional', value: s.psicoemocional },
                { label: 'Intervencao Imediata', value: s.intervencao_imediata },
                { label: 'Proximas Etapas', value: s.proximas_etapas },
                { label: 'Exames Faltantes', value: s.exames_faltantes },
                { label: 'Encaminhar', value: s.encaminhar },
                { label: 'Pontos de Atencao', value: s.pontos_atencao },
                { label: 'Prognostico', value: s.prognostico },
                { label: 'Complexidade', value: s.complexidade },
                { label: 'Urgencia', value: s.urgencia },
                { label: 'Prontidao para Mudanca', value: s.prontidao_mudanca },
                { label: 'Confiabilidade', value: s.confiabilidade },
              ].filter(f => f.value);
              return (<>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>Sintese Analitica</div>
                {fields.map((f, i) => (
                  <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                    <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                    <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                  </div>
                ))}
              </>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Dados do Paciente - Cadastro Anamnese */}
      {shouldShowSection('Dados do Paciente') && (
        <CollapsibleSection title="Dados do Paciente" defaultOpen={true}>
          {loadingCadastro ? (
            <div className="anamnese-loading" style={{ padding: '20px', textAlign: 'center' }}>
              <div className="loading-spinner"></div>
              <p>Carregando dados do paciente...</p>
            </div>
          ) : cadastroAnamnese ? (
            <div onClick={() => setViewPopupSection('dados_paciente')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
                <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Expandir e Editar
                </span>
              </div>
              {(() => {
                const c = cadastroAnamnese;
                const sections = [
                  { title: 'Identificacao', fields: [
                    { label: 'Nome', value: c.nome_completo }, { label: 'Data Nasc.', value: c.data_nascimento },
                    { label: 'CPF', value: c.cpf }, { label: 'Estado Civil', value: c.estado_civil },
                    { label: 'Email', value: c.email }, { label: 'Profissao', value: c.profissao },
                    { label: 'Genero', value: c.genero },
                  ]},
                  { title: 'Dados Fisicos', fields: [
                    { label: 'Altura', value: c.altura }, { label: 'Peso Atual', value: c.peso_atual },
                    { label: 'Peso Antigo', value: c.peso_antigo }, { label: 'Peso Desejado', value: c.peso_desejado },
                  ]},
                  { title: 'Objetivos', fields: [
                    { label: 'Objetivo Principal', value: c.objetivo_principal },
                    { label: 'Pratica Atividade', value: c.patrica_atividade_fisica },
                    { label: 'Frequencia Treino', value: c.frequencia_deseja_treinar },
                    { label: 'Restricao', value: c.restricao_movimento },
                  ]},
                ];
                return (<>
                  {sections.map((section) => {
                    const vf = section.fields.filter(f => f.value);
                    if (vf.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>
                        {vf.map((f, i) => (
                          <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                            <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                            <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  </>);
              })()}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              <p>Nenhum dado de cadastro encontrado.</p>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Objetivos e Queixas */}
      {shouldShowSection('Objetivos e Queixas') && (
        <CollapsibleSection title="Objetivos e Queixas" defaultOpen={true}>
          {/* Texto corrido completo - clique para expandir e editar */}
          <div
            onClick={() => setViewPopupSection('objetivos_queixas')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = objetivos_queixas;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Saude Geral Percebida', fields: [
                  { label: 'Como Descreve a Saude', value: q.saude_geral_percebida_como_descreve_saude },
                  { label: 'Como Define Bem-Estar', value: q.saude_geral_percebida_como_define_bem_estar },
                  { label: 'Saude Emocional/Mental', value: q.saude_geral_percebida_avaliacao_saude_emocional_mental },
                ]},
                { title: 'Queixas', fields: [
                  { label: 'Queixa Principal', value: q.queixa_principal },
                  { label: 'Sub-queixas', value: q.sub_queixas },
                ]},
                { title: 'Impacto das Queixas', fields: [
                  { label: 'Vida Diaria', value: q.impacto_queixas_vida_como_afeta_vida_diaria },
                  { label: 'Limitacoes', value: q.impacto_queixas_vida_limitacoes_causadas },
                  { label: 'Areas Impactadas', value: q.impacto_queixas_vida_areas_impactadas },
                ]},
                { title: 'Objetivos e Expectativas', fields: [
                  { label: 'Problemas a Resolver', value: q.problemas_deseja_resolver },
                  { label: 'Expectativa', value: q.expectativas_tratamento_expectativa_especifica },
                  { label: 'Tratamentos Anteriores', value: q.expectativas_tratamento_quais_tratamentos_anteriores },
                ]},
                { title: 'Compreensao sobre a Causa', fields: [
                  { label: 'Compreensao do Paciente', value: q.compreensao_sobre_causa_compreensao_paciente },
                  { label: 'Fatores Externos', value: q.compreensao_sobre_causa_fatores_externos_influenciando },
                ]},
                { title: 'Projeto de Vida', fields: [
                  { label: 'Corporal', value: q.projeto_de_vida_corporal },
                  { label: 'Espiritual', value: q.projeto_de_vida_espiritual },
                  { label: 'Familiar', value: q.projeto_de_vida_familiar },
                  { label: 'Profissional', value: q.projeto_de_vida_profissional },
                  { label: 'Sonhos', value: q.projeto_de_vida_sonhos },
                ]},
                { title: 'Motivacao e Mudanca', fields: [
                  { label: 'Nivel de Motivacao', value: q.nivel_motivacao },
                  { label: 'Prontidao', value: q.prontidao_para_mudanca },
                  { label: 'Mudancas Necessarias', value: q.mudancas_considera_necessarias },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Histórico de Risco */}
      {shouldShowSection('Histórico de Risco') && (
        <CollapsibleSection title="Histórico de Risco" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('historico_risco')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = historico_risco;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Doencas Atuais e Passadas', fields: [
                  { label: 'Doencas Atuais Confirmadas', value: q.doencas_atuais_confirmadas },
                  { label: 'Doencas na Infancia/Adolescencia', value: q.doencas_infancia_adolescencia },
                ]},
                { title: 'Antecedentes Familiares', fields: [
                  { label: 'Pai', value: q.antecedentes_familiares_pai },
                  { label: 'Mae', value: q.antecedentes_familiares_mae },
                  { label: 'Irmaos', value: q.antecedentes_familiares_irmaos },
                  { label: 'Avos Paternos', value: q.antecedentes_familiares_avos_paternos },
                  { label: 'Avos Maternos', value: q.antecedentes_familiares_avos_maternos },
                  { label: 'Causas de Morte dos Avos', value: q.antecedentes_familiares_causas_morte_avos },
                ]},
                { title: 'Condicoes e Tratamentos', fields: [
                  { label: 'Condicoes Geneticas Conhecidas', value: q.condicoes_geneticas_conhecidas },
                  { label: 'Cirurgias/Procedimentos', value: q.cirurgias_procedimentos },
                  { label: 'Medicacoes Atuais', value: q.medicacoes_atuais },
                  { label: 'Medicacoes Continuas', value: q.medicacoes_continuas },
                  { label: 'Ja Usou Corticoides', value: q.ja_usou_corticoides },
                ]},
                { title: 'Alergias e Exposicoes', fields: [
                  { label: 'Alergias/Intolerancias Conhecidas', value: q.alergias_intolerancias_conhecidas },
                  { label: 'Alergias/Intolerancias Suspeitas', value: q.alergias_intolerancias_suspeitas },
                  { label: 'Exposicao Toxica', value: q.exposicao_toxica },
                ]},
                { title: 'Historico de Peso', fields: [
                  { label: 'Variacao ao Longo da Vida', value: q.historico_peso_variacao_ao_longo_vida },
                  { label: 'Peso Maximo Atingido', value: q.historico_peso_peso_maximo_atingido },
                  { label: 'Peso Minimo Atingido', value: q.historico_peso_peso_minimo_atingido },
                ]},
                { title: 'Tratamentos Anteriores', fields: [
                  { label: 'Tentativas de Tratamento Anteriores', value: q.tentativas_tratamento_anteriores },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Observação Clínica e Laboratorial */}
      {shouldShowSection('Observação Clínica e Laboratorial') && (
        <CollapsibleSection title="Observação Clínica e Laboratorial" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('observacao_clinica_lab')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = observacao_clinica_lab;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Sintomas e Padroes', fields: [
                  { label: 'Quando os Sintomas Comecaram', value: q.quando_sintomas_comecaram },
                  { label: 'Padrao Temporal', value: q.ha_algum_padrao_temporal },
                  { label: 'Eventos que Agravaram', value: q.eventos_que_agravaram },
                  { label: 'Intensidade de Dor/Desconforto', value: q.intensidade_dor_desconforto },
                  { label: 'Nivel de Energia Diaria', value: q.nivel_energia_diaria },
                ]},
                { title: 'Sistema Gastrointestinal', fields: [
                  { label: 'Intestino', value: q.sistema_gastrointestinal_intestino },
                  { label: 'Habito Intestinal', value: q.sistema_gastrointestinal_habito_intestinal },
                  { label: 'Disbiose', value: q.sistema_gastrointestinal_disbiose },
                  { label: 'Lingua', value: q.sistema_gastrointestinal_lingua },
                  { label: 'Digestao', value: q.sistema_gastrointestinal_digestao },
                  { label: 'Gases', value: q.sistema_gastrointestinal_gases },
                  { label: 'Suspeita de Disbiose', value: q.sistema_gastrointestinal_suspeita_disbiose },
                ]},
                { title: 'Sistema Musculoesqueletico', fields: [
                  { label: 'Dores', value: q.sistema_musculoesqueletico_dores },
                  { label: 'Localizacao', value: q.sistema_musculoesqueletico_localizacao },
                  { label: 'Postura', value: q.sistema_musculoesqueletico_postura },
                  { label: 'Tonus Muscular', value: q.sistema_musculoesqueletico_tono_muscular },
                  { label: 'Mobilidade', value: q.sistema_musculoesqueletico_mobilidade },
                ]},
                { title: 'Pele e Faneros', fields: [
                  { label: 'Pele', value: q.pele_faneros_pele },
                  { label: 'Cabelo', value: q.pele_faneros_cabelo },
                  { label: 'Unhas', value: q.pele_faneros_unhas },
                  { label: 'Hidratacao', value: q.pele_faneros_hidratacao },
                  { label: 'Ingestao de Agua (ml/dia)', value: q.pele_faneros_ingestao_agua_ml_dia },
                ]},
                { title: 'Sistema Neurologico/Mental', fields: [
                  { label: 'Memoria', value: q.sistema_neurologico_mental_memoria },
                  { label: 'Concentracao', value: q.sistema_neurologico_mental_concentracao },
                  { label: 'Qualidade do Sono', value: q.sistema_neurologico_mental_sono_qualidade },
                  { label: 'Latencia do Sono', value: q.sistema_neurologico_mental_sono_latencia },
                  { label: 'Manutencao do Sono', value: q.sistema_neurologico_mental_sono_manutencao },
                  { label: 'Profundidade do Sono', value: q.sistema_neurologico_mental_sono_profundidade },
                  { label: 'Duracao do Sono (horas)', value: q.sistema_neurologico_mental_sono_duracao_horas },
                  { label: 'Despertar', value: q.sistema_neurologico_mental_sono_despertar },
                  { label: 'Acorda Quantas Vezes', value: q.sistema_neurologico_mental_sono_acorda_quantas_vezes },
                  { label: 'Acorda para Urinar', value: q.sistema_neurologico_mental_sono_acorda_para_urinar },
                  { label: 'Energia', value: q.sistema_neurologico_mental_energia },
                ]},
                { title: 'Sistema Endocrino', fields: [
                  { label: 'TSH', value: q.sistema_endocrino_tireoide_tsh },
                  { label: 'Anti-TPO', value: q.sistema_endocrino_tireoide_anti_tpo },
                  { label: 'T3 Livre', value: q.sistema_endocrino_tireoide_t3_livre },
                  { label: 'T4 Livre', value: q.sistema_endocrino_tireoide_t4_livre },
                  { label: 'Suspeita Tireoide', value: q.sistema_endocrino_tireoide_suspeita },
                  { label: 'Insulina Valor', value: q.sistema_endocrino_insulina_valor },
                  { label: 'Glicemia', value: q.sistema_endocrino_insulina_glicemia },
                  { label: 'Hemoglobina Glicada', value: q.sistema_endocrino_insulina_hemoglobina_glicada },
                  { label: 'HOMA-IR', value: q.sistema_endocrino_insulina_homa_ir },
                  { label: 'Diagnostico Insulina', value: q.sistema_endocrino_insulina_diagnostico },
                  { label: 'Cortisol', value: q.sistema_endocrino_cortisol },
                  { label: 'Estrogenio', value: q.sistema_endocrino_hormonios_sexuais_estrogeno },
                  { label: 'Progesterona', value: q.sistema_endocrino_hormonios_sexuais_progesterona },
                  { label: 'Testosterona', value: q.sistema_endocrino_hormonios_sexuais_testosterona },
                  { label: 'Impacto Hormonios', value: q.sistema_endocrino_hormonios_sexuais_impacto },
                ]},
                { title: 'Medidas Antropometricas', fields: [
                  { label: 'Peso Atual', value: q.medidas_antropometricas_peso_atual },
                  { label: 'Altura', value: q.medidas_antropometricas_altura },
                  { label: 'IMC', value: q.medidas_antropometricas_imc },
                  { label: 'Cintura', value: q.medidas_antropometricas_circunferencias_cintura },
                  { label: 'Quadril', value: q.medidas_antropometricas_circunferencias_quadril },
                  { label: 'Pescoco', value: q.medidas_antropometricas_circunferencias_pescoco },
                  { label: 'Relacao Cintura/Quadril', value: q.medidas_antropometricas_relacao_cintura_quadril },
                  { label: 'Gordura (%)', value: q.medidas_antropometricas_bioimpedancia_gordura_percentual },
                  { label: 'Massa Muscular', value: q.medidas_antropometricas_bioimpedancia_massa_muscular },
                  { label: 'Agua Corporal', value: q.medidas_antropometricas_bioimpedancia_agua_corporal },
                  { label: 'Gordura Visceral (Bio)', value: q.medidas_antropometricas_bioimpedancia_gordura_visceral },
                  { label: 'Gordura Visceral', value: q.medidas_antropometricas_gordura_visceral },
                  { label: 'Esteatose Hepatica', value: q.medidas_antropometricas_esteatose_hepatica },
                  { label: 'Pressao Arterial', value: q.medidas_antropometricas_pressao_arterial },
                ]},
                { title: 'Sinais Vitais Relatados', fields: [
                  { label: 'Disposicao ao Acordar', value: q.sinais_vitais_relatados_disposicao_ao_acordar },
                  { label: 'Disposicao ao Longo do Dia', value: q.sinais_vitais_relatados_disposicao_ao_longo_dia },
                  { label: 'Libido', value: q.sinais_vitais_relatados_libido },
                  { label: 'Regulacao Termica', value: q.sinais_vitais_relatados_regulacao_termica },
                ]},
                { title: 'Habitos Alimentares', fields: [
                  { label: 'Recordatorio 24h', value: q.habitos_alimentares_recordatorio_24h },
                  { label: 'Frequencia de Ultraprocessados', value: q.habitos_alimentares_frequencia_ultraprocessados },
                  { label: 'Horarios das Refeicoes', value: q.habitos_alimentares_horarios_refeicoes },
                  { label: 'Come Assistindo TV/Trabalhando', value: q.habitos_alimentares_come_assistindo_tv_trabalhando },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* História de Vida */}
      {shouldShowSection('História de Vida') && (
        <CollapsibleSection title="História de vida" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('historia_vida')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = historia_vida;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Narrativa e Eventos', fields: [
                  { label: 'Sintese da Narrativa', value: q.narrativa_sintese },
                  { label: 'Eventos de Vida Marcantes', value: q.eventos_vida_marcantes },
                  { label: 'Episodios de Estresse Extremo/Trauma', value: q.episodios_estresse_extremo_trauma },
                ]},
                { title: 'Trilha do Conflito', fields: [
                  { label: 'Concepcao/Gestacao', value: q.trilha_do_conflito_concepcao_gestacao },
                  { label: '0-7 anos', value: q.trilha_do_conflito_0_7_anos },
                  { label: '7-14 anos', value: q.trilha_do_conflito_7_14_anos },
                  { label: '14-21 anos', value: q.trilha_do_conflito_14_21_anos },
                  { label: '21-28 anos', value: q.trilha_do_conflito_21_28_anos },
                  { label: '28+ anos', value: q.trilha_do_conflito_28_mais_anos },
                ]},
                { title: 'Padroes e Traumas', fields: [
                  { label: 'Pontos Traumaticos', value: q.pontos_traumaticos },
                  { label: 'Padroes Repetitivos', value: q.padroes_repetitivos },
                  { label: 'Saude da Mae na Gestacao', value: q.saude_mae_gestacao },
                  { label: 'Tracos/Comportamentos Repetitivos', value: q.tracos_comportamentos_repetitivos_ao_longo_vida },
                ]},
                { title: 'Superacao e Identidade', fields: [
                  { label: 'Experiencia de Virada', value: q.experiencia_considera_virada },
                  { label: 'Identifica com Superacao ou Defesa', value: q.identifica_com_superacao_ou_defesa },
                  { label: 'Conexao com Identidade e Proposito', value: q.conexao_identidade_proposito },
                  { label: 'Algo da Infancia que Lembra com Emocao Intensa', value: q.algo_infancia_lembra_com_emocao_intensa },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Setênios e Eventos */}
      {shouldShowSection('Setênios e Eventos') && (
        <CollapsibleSection title="Setênios e Eventos" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('setenios_eventos')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = setenios_eventos;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Concepcao e Gestacao', fields: [
                  { label: 'Planejamento', value: q.concepcao_gestacao_planejamento },
                  { label: 'Ambiente Gestacional', value: q.concepcao_gestacao_ambiente_gestacional },
                  { label: 'Saude da Mae', value: q.concepcao_gestacao_saude_mae_gestacao },
                  { label: 'Tipo de Parto', value: q.concepcao_gestacao_parto },
                  { label: 'Houve Trauma de Parto', value: q.concepcao_gestacao_houve_trauma_parto },
                  { label: 'Foi Desejada/Planejada', value: q.concepcao_gestacao_foi_desejada_planejada },
                  { label: 'Impacto', value: q.concepcao_gestacao_impacto },
                ]},
                { title: 'Primeiro Setenio (0-7 anos)', fields: [
                  { label: 'Ambiente', value: q.primeiro_setenio_0_7_ambiente },
                  { label: 'Figuras Parentais - Pai', value: q.primeiro_setenio_0_7_figuras_parentais_pai },
                  { label: 'Figuras Parentais - Mae', value: q.primeiro_setenio_0_7_figuras_parentais_mae },
                  { label: 'Aprendizados', value: q.primeiro_setenio_0_7_aprendizados },
                  { label: 'Trauma Central', value: q.primeiro_setenio_0_7_trauma_central },
                ]},
                { title: 'Segundo Setenio (7-14 anos)', fields: [
                  { label: 'Eventos', value: q.segundo_setenio_7_14_eventos },
                  { label: 'Desenvolvimento', value: q.segundo_setenio_7_14_desenvolvimento },
                  { label: 'Corpo Fisico', value: q.segundo_setenio_7_14_corpo_fisico },
                  { label: 'Impacto', value: q.segundo_setenio_7_14_impacto },
                ]},
                { title: 'Terceiro Setenio (14-21 anos)', fields: [
                  { label: 'Escolhas', value: q.terceiro_setenio_14_21_escolhas },
                  { label: 'Motivacao', value: q.terceiro_setenio_14_21_motivacao },
                  { label: 'Cumeeira da Casa', value: q.terceiro_setenio_14_21_cumeeira_da_casa },
                ]},
                { title: 'Quarto Setenio (21-28 anos)', fields: [
                  { label: 'Eventos Significativos', value: q.quarto_setenio_21_28_eventos_significativos },
                  { label: 'Formacao Profissional', value: q.quarto_setenio_21_28_formacao_profissional },
                ]},
                { title: 'Decenios (28-40+ anos)', fields: [
                  { label: 'Climaterio/Menopausa', value: q.decenios_28_40_mais_climaterio_menopausa },
                  { label: 'Pausas Hormonais', value: q.decenios_28_40_mais_pausas_hormonais },
                  { label: 'Acumulacao', value: q.decenios_28_40_mais_acumulacao },
                  { label: 'Estado Atual', value: q.decenios_28_40_mais_estado_atual },
                  { label: 'Episodios de Estresse Extremo', value: q.decenios_28_40_mais_episodios_estresse_extremo },
                ]},
                { title: 'Observacoes Gerais', fields: [
                  { label: 'Eventos Criticos Identificados', value: q.eventos_criticos_identificados },
                  { label: 'Experiencia de Virada', value: q.experiencia_considera_virada },
                  { label: 'Diferencas Sazonais/Climaticas nos Sintomas', value: q.diferencas_sazonais_climaticas_sintomas },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Ambiente e Contexto */}
      {shouldShowSection('Ambiente e Contexto') && (
        <CollapsibleSection title="Ambiente e Contexto" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('ambiente_contexto')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = ambiente_contexto;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Contexto Familiar', fields: [
                  { label: 'Estado Civil', value: q.contexto_familiar_estado_civil },
                  { label: 'Filhos', value: q.contexto_familiar_filhos },
                  { label: 'Dinamica Familiar', value: q.contexto_familiar_dinamica_familiar },
                  { label: 'Suporte Familiar', value: q.contexto_familiar_suporte_familiar },
                  { label: 'Relacionamento Conjugal', value: q.contexto_familiar_relacionamento_conjugal },
                  { label: 'Divisao de Tarefas Domesticas', value: q.contexto_familiar_divisao_tarefas_domesticas },
                  { label: 'Vida Sexual Ativa', value: q.contexto_familiar_vida_sexual_ativa },
                  { label: 'Dialogo sobre Sobrecarga', value: q.contexto_familiar_dialogo_sobre_sobrecarga },
                ]},
                { title: 'Contexto Profissional', fields: [
                  { label: 'Area', value: q.contexto_profissional_area },
                  { label: 'Carga Horaria', value: q.contexto_profissional_carga_horaria },
                  { label: 'Nivel de Estresse', value: q.contexto_profissional_nivel_estresse },
                  { label: 'Satisfacao', value: q.contexto_profissional_satisfacao },
                ]},
                { title: 'Ambiente Fisico', fields: [
                  { label: 'Sedentarismo', value: q.ambiente_fisico_sedentarismo },
                  { label: 'Exposicao ao Sol', value: q.ambiente_fisico_exposicao_sol },
                  { label: 'Pratica Atividade Fisica', value: q.ambiente_fisico_atividade_fisica_pratica },
                  { label: 'Tipo de Atividade', value: q.ambiente_fisico_atividade_fisica_tipo },
                  { label: 'Frequencia', value: q.ambiente_fisico_atividade_fisica_frequencia },
                  { label: 'Intensidade', value: q.ambiente_fisico_atividade_fisica_intensidade },
                  { label: 'Tem Acompanhamento Profissional', value: q.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona },
                ]},
                { title: 'Habitos de Vida', fields: [
                  { label: 'Sono', value: q.habitos_vida_sono },
                  { label: 'Alimentacao', value: q.habitos_vida_alimentacao },
                  { label: 'Lazer', value: q.habitos_vida_lazer },
                  { label: 'Espiritualidade', value: q.habitos_vida_espiritualidade },
                ]},
                { title: 'Suporte Social', fields: [
                  { label: 'Tem Rede de Apoio', value: q.suporte_social_tem_rede_apoio },
                  { label: 'Participa de Grupos Sociais', value: q.suporte_social_participa_grupos_sociais },
                  { label: 'Tem com Quem Desabafar', value: q.suporte_social_tem_com_quem_desabafar },
                ]},
                { title: 'Fatores de Risco', fields: [
                  { label: 'Fatores Estressores', value: q.fatores_estressores },
                  { label: 'Fatores Externos a Saude', value: q.fatores_externos_saude },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Sensação e Emoções */}
      {shouldShowSection('Sensação e Emoções') && (
        <CollapsibleSection title="Sensação e Emoções" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('sensacao_emocoes')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = sensacao_emocoes;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Emocoes e Sensacoes', fields: [
                  { label: 'Emocoes Predominantes', value: q.emocoes_predominantes },
                  { label: 'Sensacoes Corporais', value: q.sensacoes_corporais },
                  { label: 'Palavras-chave Emocionais', value: q.palavras_chave_emocionais },
                  { label: 'Intensidade Emocional', value: q.intensidade_emocional },
                ]},
                { title: 'Gatilhos Emocionais', fields: [
                  { label: 'Consegue Identificar Gatilhos', value: q.consegue_identificar_gatilhos_emocionais },
                  { label: 'Gatilhos Identificados', value: q.gatilhos_identificados },
                ]},
                { title: 'Regulacao Emocional', fields: [
                  { label: 'Capacidade de Regulacao', value: q.regulacao_emocional_capacidade_regulacao },
                  { label: 'Forma de Expressao', value: q.regulacao_emocional_forma_expressao },
                  { label: 'Como Gerencia Estresse/Ansiedade', value: q.regulacao_emocional_como_gerencia_estresse_ansiedade },
                  { label: 'Memoria Afetiva', value: q.memoria_afetiva },
                ]},
                { title: 'Sensacoes Especificas do Reino', fields: [
                  { label: 'Usa Palavras Como', value: q.sensacoes_especificas_reino_usa_palavras_como },
                  { label: 'Descreve Sensacoes Como', value: q.sensacoes_especificas_reino_descreve_sensacoes_como },
                  { label: 'Padroes de Discurso', value: q.sensacoes_especificas_reino_padroes_discurso },
                ]},
                { title: 'Conexao Corpo-Mente', fields: [
                  { label: 'Percebe Manifestacoes Corporais das Emocoes', value: q.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes },
                  { label: 'Exemplos', value: q.conexao_corpo_mente_exemplos },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Preocupações e Crenças */}
      {shouldShowSection('Preocupações e Crenças') && (
        <CollapsibleSection title="Preocupações e Crenças" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('preocupacoes_crencas')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = preocupacoes_crencas;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Percepcao do Problema', fields: [
                  { label: 'Como Percebe o Problema', value: q.como_percebe_problema },
                  { label: 'Compreensao sobre Causa dos Sintomas', value: q.compreensao_sobre_causa_sintomas },
                ]},
                { title: 'Crencas e Preocupacoes', fields: [
                  { label: 'Crencas Limitantes', value: q.crencas_limitantes },
                  { label: 'Preocupacoes Explicitas', value: q.preocupacoes_explicitas },
                  { label: 'Preocupacoes Implicitas', value: q.preocupacoes_implicitas },
                  { label: 'Ganhos Secundarios', value: q.ganhos_secundarios },
                  { label: 'Resistencias Possiveis', value: q.resistencias_possiveis },
                ]},
                { title: 'Expectativas e Insight', fields: [
                  { label: 'Condicoes Geneticas na Familia', value: q.condicoes_geneticas_familia },
                  { label: 'Expectativas Irrealistas', value: q.expectativas_irrealistas },
                  { label: 'Nivel de Insight/Autoconsciencia', value: q.nivel_insight_autoconsciencia },
                  { label: 'Abertura para Mudanca', value: q.abertura_para_mudanca },
                ]},
                { title: 'Barreiras e Desafios', fields: [
                  { label: 'Barreiras Percebidas ao Tratamento', value: q.barreiras_percebidas_tratamento },
                  { label: 'Aspectos do Plano que Parecem Desafiadores', value: q.aspectos_plano_parecem_desafiadores },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Reino e Miasma */}
      {shouldShowSection('Reino e Miasma') && (
        <CollapsibleSection title="Reino e Miasma" defaultOpen={true}>
          <div
            onClick={() => setViewPopupSection('reino_miasma')}
            style={{
              cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9,
              padding: '20px 24px', background: '#FFFFFF', borderRadius: 12,
              border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s',
              maxHeight: 500, overflowY: 'auto', position: 'relative' as any,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = reino_miasma;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Reino Predominante', fields: [
                  { label: 'Reino Predominante', value: q.reino_predominante },
                  { label: 'Justificativa do Reino', value: q.justificativa_reino },
                  { label: 'Caracteristicas Identificadas', value: q.caracteristicas_identificadas },
                ]},
                { title: 'Miasma', fields: [
                  { label: 'Miasma Principal', value: q.miasma_principal },
                  { label: 'Justificativa do Miasma', value: q.justificativa_miasma },
                  { label: 'Analise Miasma - Energia', value: q.analise_miasma_energia },
                  { label: 'Analise Miasma - Luta', value: q.analise_miasma_luta },
                ]},
                { title: 'Analise Detalhada - Reino Animal', fields: [
                  { label: 'Palavras Usadas', value: q.analise_detalhada_reino_animal_palavras_usadas },
                  { label: 'Descreve Sensacoes Como', value: q.analise_detalhada_reino_animal_descreve_sensacoes_como },
                ]},
                { title: 'Implicacoes Terapeuticas', fields: [
                  { label: 'Comunicacao', value: q.implicacoes_terapeuticas_comunicacao },
                  { label: 'Abordagem', value: q.implicacoes_terapeuticas_abordagem },
                  { label: 'Outras Terapias Alinhadas', value: q.implicacoes_terapeuticas_outras_terapias_alinhadas },
                ]},
                { title: 'Observacoes Comportamentais', fields: [
                  { label: 'Padrao de Discurso', value: q.padrao_discurso },
                ]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (
                <>
                  {sections.map((section) => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>
                          {section.title}
                        </div>
                        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
                          {validFields.map((f, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}>
                              <strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong>
                              <div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Clique para expandir e editar campos individualmente
                  </div>
                </>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Popup de Visualizacao */}
      {viewPopupSection === 'objetivos_queixas' && objetivos_queixas && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800,
            maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Objetivos e Queixas</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: '#F1F5F9', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#64748B',
              }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Saude Geral Percebida', fields: [
                  { label: 'Como Descreve a Saude', key: 'saude_geral_percebida_como_descreve_saude', path: 'a_objetivos_queixas.saude_geral_percebida_como_descreve_saude' },
                  { label: 'Como Define Bem-Estar', key: 'saude_geral_percebida_como_define_bem_estar', path: 'a_objetivos_queixas.saude_geral_percebida_como_define_bem_estar' },
                  { label: 'Avaliacao da Saude Emocional/Mental', key: 'saude_geral_percebida_avaliacao_saude_emocional_mental', path: 'a_objetivos_queixas.saude_geral_percebida_avaliacao_saude_emocional_mental' },
                ]},
                { title: 'Queixas', fields: [
                  { label: 'Queixa Principal', key: 'queixa_principal', path: 'a_objetivos_queixas.queixa_principal' },
                  { label: 'Sub-queixas', key: 'sub_queixas', path: 'a_objetivos_queixas.sub_queixas' },
                ]},
                { title: 'Impacto das Queixas na Vida', fields: [
                  { label: 'Como Afeta a Vida Diaria', key: 'impacto_queixas_vida_como_afeta_vida_diaria', path: 'a_objetivos_queixas.impacto_queixas_vida_como_afeta_vida_diaria' },
                  { label: 'Limitacoes Causadas', key: 'impacto_queixas_vida_limitacoes_causadas', path: 'a_objetivos_queixas.impacto_queixas_vida_limitacoes_causadas' },
                  { label: 'Areas Impactadas', key: 'impacto_queixas_vida_areas_impactadas', path: 'a_objetivos_queixas.impacto_queixas_vida_areas_impactadas' },
                ]},
                { title: 'Objetivos e Expectativas', fields: [
                  { label: 'Problemas Deseja Resolver', key: 'problemas_deseja_resolver', path: 'a_objetivos_queixas.problemas_deseja_resolver' },
                  { label: 'Expectativa Especifica', key: 'expectativas_tratamento_expectativa_especifica', path: 'a_objetivos_queixas.expectativas_tratamento_expectativa_especifica' },
                  { label: 'Ja Buscou Tratamentos Similares', key: 'expectativas_tratamento_ja_buscou_tratamentos_similares', path: 'a_objetivos_queixas.expectativas_tratamento_ja_buscou_tratamentos_similares' },
                  { label: 'Tratamentos Anteriores', key: 'expectativas_tratamento_quais_tratamentos_anteriores', path: 'a_objetivos_queixas.expectativas_tratamento_quais_tratamentos_anteriores' },
                ]},
                { title: 'Compreensao sobre a Causa', fields: [
                  { label: 'Compreensao do Paciente', key: 'compreensao_sobre_causa_compreensao_paciente', path: 'a_objetivos_queixas.compreensao_sobre_causa_compreensao_paciente' },
                  { label: 'Fatores Externos Influenciando', key: 'compreensao_sobre_causa_fatores_externos_influenciando', path: 'a_objetivos_queixas.compreensao_sobre_causa_fatores_externos_influenciando' },
                ]},
                { title: 'Projeto de Vida', fields: [
                  { label: 'Corporal', key: 'projeto_de_vida_corporal', path: 'a_objetivos_queixas.projeto_de_vida_corporal' },
                  { label: 'Espiritual', key: 'projeto_de_vida_espiritual', path: 'a_objetivos_queixas.projeto_de_vida_espiritual' },
                  { label: 'Familiar', key: 'projeto_de_vida_familiar', path: 'a_objetivos_queixas.projeto_de_vida_familiar' },
                  { label: 'Profissional', key: 'projeto_de_vida_profissional', path: 'a_objetivos_queixas.projeto_de_vida_profissional' },
                  { label: 'Sonhos', key: 'projeto_de_vida_sonhos', path: 'a_objetivos_queixas.projeto_de_vida_sonhos' },
                ]},
                { title: 'Motivacao e Mudanca', fields: [
                  { label: 'Nivel de Motivacao', key: 'nivel_motivacao', path: 'a_objetivos_queixas.nivel_motivacao' },
                  { label: 'Prontidao para Mudanca', key: 'prontidao_para_mudanca', path: 'a_objetivos_queixas.prontidao_para_mudanca' },
                  { label: 'Mudancas Considera Necessarias', key: 'mudancas_considera_necessarias', path: 'a_objetivos_queixas.mudancas_considera_necessarias' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => objetivos_queixas[f.key]);
                if (!hasData) return null;
                return (
                  <div key={section.title} style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>
                      {section.title}
                    </h4>
                    <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>
                      {section.fields.map((field) => {
                        const value = objetivos_queixas[field.key];
                        if (!value) return null;
                        const isEditing = editingField === field.path;
                        return (
                          <div key={field.key} style={{ marginBottom: 8 }}>
                            {isEditing ? (
                              <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div>
                                <textarea
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Escape') setEditingField(null);
                                  }}
                                  style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingField(null)}
                                    style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                                  <button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }}
                                    style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }}
                                onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }}
                                title={`Editar: ${field.label}`}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div>
                                <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Historico de Risco */}
      {viewPopupSection === 'historico_risco' && historico_risco && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800,
            maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Historico de Risco</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: '#F1F5F9', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#64748B',
              }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Doencas Atuais e Passadas', fields: [
                  { label: 'Doencas Atuais Confirmadas', key: 'doencas_atuais_confirmadas', path: 'a_historico_risco.doencas_atuais_confirmadas' },
                  { label: 'Doencas na Infancia/Adolescencia', key: 'doencas_infancia_adolescencia', path: 'a_historico_risco.doencas_infancia_adolescencia' },
                ]},
                { title: 'Antecedentes Familiares', fields: [
                  { label: 'Pai', key: 'antecedentes_familiares_pai', path: 'a_historico_risco.antecedentes_familiares_pai' },
                  { label: 'Mae', key: 'antecedentes_familiares_mae', path: 'a_historico_risco.antecedentes_familiares_mae' },
                  { label: 'Irmaos', key: 'antecedentes_familiares_irmaos', path: 'a_historico_risco.antecedentes_familiares_irmaos' },
                  { label: 'Avos Paternos', key: 'antecedentes_familiares_avos_paternos', path: 'a_historico_risco.antecedentes_familiares_avos_paternos' },
                  { label: 'Avos Maternos', key: 'antecedentes_familiares_avos_maternos', path: 'a_historico_risco.antecedentes_familiares_avos_maternos' },
                  { label: 'Causas de Morte dos Avos', key: 'antecedentes_familiares_causas_morte_avos', path: 'a_historico_risco.antecedentes_familiares_causas_morte_avos' },
                ]},
                { title: 'Condicoes e Tratamentos', fields: [
                  { label: 'Condicoes Geneticas Conhecidas', key: 'condicoes_geneticas_conhecidas', path: 'a_historico_risco.condicoes_geneticas_conhecidas' },
                  { label: 'Cirurgias/Procedimentos', key: 'cirurgias_procedimentos', path: 'a_historico_risco.cirurgias_procedimentos' },
                  { label: 'Medicacoes Atuais', key: 'medicacoes_atuais', path: 'a_historico_risco.medicacoes_atuais' },
                  { label: 'Medicacoes Continuas', key: 'medicacoes_continuas', path: 'a_historico_risco.medicacoes_continuas' },
                  { label: 'Ja Usou Corticoides', key: 'ja_usou_corticoides', path: 'a_historico_risco.ja_usou_corticoides' },
                ]},
                { title: 'Alergias e Exposicoes', fields: [
                  { label: 'Alergias/Intolerancias Conhecidas', key: 'alergias_intolerancias_conhecidas', path: 'a_historico_risco.alergias_intolerancias_conhecidas' },
                  { label: 'Alergias/Intolerancias Suspeitas', key: 'alergias_intolerancias_suspeitas', path: 'a_historico_risco.alergias_intolerancias_suspeitas' },
                  { label: 'Exposicao Toxica', key: 'exposicao_toxica', path: 'a_historico_risco.exposicao_toxica' },
                ]},
                { title: 'Historico de Peso', fields: [
                  { label: 'Variacao ao Longo da Vida', key: 'historico_peso_variacao_ao_longo_vida', path: 'a_historico_risco.historico_peso_variacao_ao_longo_vida' },
                  { label: 'Peso Maximo Atingido', key: 'historico_peso_peso_maximo_atingido', path: 'a_historico_risco.historico_peso_peso_maximo_atingido' },
                  { label: 'Peso Minimo Atingido', key: 'historico_peso_peso_minimo_atingido', path: 'a_historico_risco.historico_peso_peso_minimo_atingido' },
                ]},
                { title: 'Tratamentos Anteriores', fields: [
                  { label: 'Tentativas de Tratamento Anteriores', key: 'tentativas_tratamento_anteriores', path: 'a_historico_risco.tentativas_tratamento_anteriores' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => historico_risco[f.key]);
                if (!hasData) return null;
                return (
                  <div key={section.title} style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>
                      {section.title}
                    </h4>
                    <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>
                      {section.fields.map((field) => {
                        const value = historico_risco[field.key];
                        if (!value) return null;
                        const isEditing = editingField === field.path;
                        return (
                          <div key={field.key} style={{ marginBottom: 8 }}>
                            {isEditing ? (
                              <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div>
                                <textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }}
                                  style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                                  <button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                                </div>
                              </div>
                            ) : (
                              <span style={{ cursor: 'pointer', borderRadius: 4, padding: '1px 3px', transition: 'background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }}
                                title={`Editar: ${field.label}`}>
                                <strong style={{ color: '#1B4266', fontSize: 12 }}>{field.label}: </strong>
                                {cleanText(value)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Observacao Clinica e Laboratorial */}
      {viewPopupSection === 'observacao_clinica_lab' && observacao_clinica_lab && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Observacao Clinica e Laboratorial</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Sintomas e Padroes', fields: [
                  { label: 'Quando os Sintomas Comecaram', key: 'quando_sintomas_comecaram', path: 'a_observacao_clinica_lab_2.quando_sintomas_comecaram' },
                  { label: 'Padrao Temporal', key: 'ha_algum_padrao_temporal', path: 'a_observacao_clinica_lab_2.ha_algum_padrao_temporal' },
                  { label: 'Eventos que Agravaram', key: 'eventos_que_agravaram', path: 'a_observacao_clinica_lab_2.eventos_que_agravaram' },
                  { label: 'Intensidade de Dor/Desconforto', key: 'intensidade_dor_desconforto', path: 'a_observacao_clinica_lab_2.intensidade_dor_desconforto' },
                  { label: 'Nivel de Energia Diaria', key: 'nivel_energia_diaria', path: 'a_observacao_clinica_lab_2.nivel_energia_diaria' },
                ]},
                { title: 'Sistema Gastrointestinal', fields: [
                  { label: 'Intestino', key: 'sistema_gastrointestinal_intestino', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_intestino' },
                  { label: 'Habito Intestinal', key: 'sistema_gastrointestinal_habito_intestinal', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_habito_intestinal' },
                  { label: 'Disbiose', key: 'sistema_gastrointestinal_disbiose', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_disbiose' },
                  { label: 'Lingua', key: 'sistema_gastrointestinal_lingua', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_lingua' },
                  { label: 'Digestao', key: 'sistema_gastrointestinal_digestao', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_digestao' },
                  { label: 'Gases', key: 'sistema_gastrointestinal_gases', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_gases' },
                  { label: 'Suspeita de Disbiose', key: 'sistema_gastrointestinal_suspeita_disbiose', path: 'a_observacao_clinica_lab_2.sistema_gastrointestinal_suspeita_disbiose' },
                ]},
                { title: 'Sistema Musculoesqueletico', fields: [
                  { label: 'Dores', key: 'sistema_musculoesqueletico_dores', path: 'a_observacao_clinica_lab_2.sistema_musculoesqueletico_dores' },
                  { label: 'Localizacao', key: 'sistema_musculoesqueletico_localizacao', path: 'a_observacao_clinica_lab_2.sistema_musculoesqueletico_localizacao' },
                  { label: 'Postura', key: 'sistema_musculoesqueletico_postura', path: 'a_observacao_clinica_lab_2.sistema_musculoesqueletico_postura' },
                  { label: 'Tonus Muscular', key: 'sistema_musculoesqueletico_tono_muscular', path: 'a_observacao_clinica_lab_2.sistema_musculoesqueletico_tono_muscular' },
                  { label: 'Mobilidade', key: 'sistema_musculoesqueletico_mobilidade', path: 'a_observacao_clinica_lab_2.sistema_musculoesqueletico_mobilidade' },
                ]},
                { title: 'Pele e Faneros', fields: [
                  { label: 'Pele', key: 'pele_faneros_pele', path: 'a_observacao_clinica_lab_2.pele_faneros_pele' },
                  { label: 'Cabelo', key: 'pele_faneros_cabelo', path: 'a_observacao_clinica_lab_2.pele_faneros_cabelo' },
                  { label: 'Unhas', key: 'pele_faneros_unhas', path: 'a_observacao_clinica_lab_2.pele_faneros_unhas' },
                  { label: 'Hidratacao', key: 'pele_faneros_hidratacao', path: 'a_observacao_clinica_lab_2.pele_faneros_hidratacao' },
                  { label: 'Ingestao de Agua (ml/dia)', key: 'pele_faneros_ingestao_agua_ml_dia', path: 'a_observacao_clinica_lab_2.pele_faneros_ingestao_agua_ml_dia' },
                ]},
                { title: 'Sistema Neurologico/Mental', fields: [
                  { label: 'Memoria', key: 'sistema_neurologico_mental_memoria', path: 'a_observacao_clinica_lab_2.sistema_neurologico_mental_memoria' },
                  { label: 'Concentracao', key: 'sistema_neurologico_mental_concentracao', path: 'a_observacao_clinica_lab_2.sistema_neurologico_mental_concentracao' },
                  { label: 'Qualidade do Sono', key: 'sistema_neurologico_mental_sono_qualidade', path: 'a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_qualidade' },
                  { label: 'Energia', key: 'sistema_neurologico_mental_energia', path: 'a_observacao_clinica_lab_2.sistema_neurologico_mental_energia' },
                ]},
                { title: 'Sistema Endocrino', fields: [
                  { label: 'TSH', key: 'sistema_endocrino_tireoide_tsh', path: 'a_observacao_clinica_lab_2.sistema_endocrino_tireoide_tsh' },
                  { label: 'Anti-TPO', key: 'sistema_endocrino_tireoide_anti_tpo', path: 'a_observacao_clinica_lab_2.sistema_endocrino_tireoide_anti_tpo' },
                  { label: 'T3 Livre', key: 'sistema_endocrino_tireoide_t3_livre', path: 'a_observacao_clinica_lab_2.sistema_endocrino_tireoide_t3_livre' },
                  { label: 'T4 Livre', key: 'sistema_endocrino_tireoide_t4_livre', path: 'a_observacao_clinica_lab_2.sistema_endocrino_tireoide_t4_livre' },
                  { label: 'Cortisol', key: 'sistema_endocrino_cortisol', path: 'a_observacao_clinica_lab_2.sistema_endocrino_cortisol' },
                ]},
                { title: 'Medidas Antropometricas', fields: [
                  { label: 'Peso Atual', key: 'medidas_antropometricas_peso_atual', path: 'a_observacao_clinica_lab_2.medidas_antropometricas_peso_atual' },
                  { label: 'Altura', key: 'medidas_antropometricas_altura', path: 'a_observacao_clinica_lab_2.medidas_antropometricas_altura' },
                  { label: 'IMC', key: 'medidas_antropometricas_imc', path: 'a_observacao_clinica_lab_2.medidas_antropometricas_imc' },
                  { label: 'Pressao Arterial', key: 'medidas_antropometricas_pressao_arterial', path: 'a_observacao_clinica_lab_2.medidas_antropometricas_pressao_arterial' },
                ]},
                { title: 'Sinais Vitais Relatados', fields: [
                  { label: 'Disposicao ao Acordar', key: 'sinais_vitais_relatados_disposicao_ao_acordar', path: 'a_observacao_clinica_lab_2.sinais_vitais_relatados_disposicao_ao_acordar' },
                  { label: 'Disposicao ao Longo do Dia', key: 'sinais_vitais_relatados_disposicao_ao_longo_dia', path: 'a_observacao_clinica_lab_2.sinais_vitais_relatados_disposicao_ao_longo_dia' },
                  { label: 'Libido', key: 'sinais_vitais_relatados_libido', path: 'a_observacao_clinica_lab_2.sinais_vitais_relatados_libido' },
                  { label: 'Regulacao Termica', key: 'sinais_vitais_relatados_regulacao_termica', path: 'a_observacao_clinica_lab_2.sinais_vitais_relatados_regulacao_termica' },
                ]},
                { title: 'Habitos Alimentares', fields: [
                  { label: 'Recordatorio 24h', key: 'habitos_alimentares_recordatorio_24h', path: 'a_observacao_clinica_lab_2.habitos_alimentares_recordatorio_24h' },
                  { label: 'Frequencia de Ultraprocessados', key: 'habitos_alimentares_frequencia_ultraprocessados', path: 'a_observacao_clinica_lab_2.habitos_alimentares_frequencia_ultraprocessados' },
                  { label: 'Horarios das Refeicoes', key: 'habitos_alimentares_horarios_refeicoes', path: 'a_observacao_clinica_lab_2.habitos_alimentares_horarios_refeicoes' },
                  { label: 'Come Assistindo TV/Trabalhando', key: 'habitos_alimentares_come_assistindo_tv_trabalhando', path: 'a_observacao_clinica_lab_2.habitos_alimentares_come_assistindo_tv_trabalhando' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => observacao_clinica_lab[f.key]);
                if (!hasData) return null;
                return (
                  <div key={section.title} style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4>
                    <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>
                      {section.fields.map((field) => {
                        const value = observacao_clinica_lab[field.key];
                        if (!value) return null;
                        const isEditing = editingField === field.path;
                        return (
                          <div key={field.key} style={{ marginBottom: 8 }}>
                            {isEditing ? (
                              <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div>
                                <textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }}
                                  style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                                  <button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                                </div>
                              </div>
                            ) : (
                              <span style={{ cursor: 'pointer', borderRadius: 4, padding: '1px 3px', transition: 'background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}>
                                <strong style={{ color: '#1B4266', fontSize: 12 }}>{field.label}: </strong>{cleanText(value)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Historia de Vida */}
      {viewPopupSection === 'historia_vida' && historia_vida && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Historia de Vida</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Narrativa e Eventos', fields: [
                  { label: 'Sintese da Narrativa', key: 'narrativa_sintese', path: 'a_historia_vida.narrativa_sintese' },
                  { label: 'Eventos de Vida Marcantes', key: 'eventos_vida_marcantes', path: 'a_historia_vida.eventos_vida_marcantes' },
                  { label: 'Episodios de Estresse Extremo/Trauma', key: 'episodios_estresse_extremo_trauma', path: 'a_historia_vida.episodios_estresse_extremo_trauma' },
                ]},
                { title: 'Trilha do Conflito', fields: [
                  { label: 'Concepcao/Gestacao', key: 'trilha_do_conflito_concepcao_gestacao', path: 'a_historia_vida.trilha_do_conflito_concepcao_gestacao' },
                  { label: '0-7 anos', key: 'trilha_do_conflito_0_7_anos', path: 'a_historia_vida.trilha_do_conflito_0_7_anos' },
                  { label: '7-14 anos', key: 'trilha_do_conflito_7_14_anos', path: 'a_historia_vida.trilha_do_conflito_7_14_anos' },
                  { label: '14-21 anos', key: 'trilha_do_conflito_14_21_anos', path: 'a_historia_vida.trilha_do_conflito_14_21_anos' },
                  { label: '21-28 anos', key: 'trilha_do_conflito_21_28_anos', path: 'a_historia_vida.trilha_do_conflito_21_28_anos' },
                  { label: '28+ anos', key: 'trilha_do_conflito_28_mais_anos', path: 'a_historia_vida.trilha_do_conflito_28_mais_anos' },
                ]},
                { title: 'Padroes e Traumas', fields: [
                  { label: 'Pontos Traumaticos', key: 'pontos_traumaticos', path: 'a_historia_vida.pontos_traumaticos' },
                  { label: 'Padroes Repetitivos', key: 'padroes_repetitivos', path: 'a_historia_vida.padroes_repetitivos' },
                  { label: 'Saude da Mae na Gestacao', key: 'saude_mae_gestacao', path: 'a_historia_vida.saude_mae_gestacao' },
                  { label: 'Tracos/Comportamentos Repetitivos', key: 'tracos_comportamentos_repetitivos_ao_longo_vida', path: 'a_historia_vida.tracos_comportamentos_repetitivos_ao_longo_vida' },
                ]},
                { title: 'Superacao e Identidade', fields: [
                  { label: 'Experiencia de Virada', key: 'experiencia_considera_virada', path: 'a_historia_vida.experiencia_considera_virada' },
                  { label: 'Identifica com Superacao ou Defesa', key: 'identifica_com_superacao_ou_defesa', path: 'a_historia_vida.identifica_com_superacao_ou_defesa' },
                  { label: 'Conexao com Identidade e Proposito', key: 'conexao_identidade_proposito', path: 'a_historia_vida.conexao_identidade_proposito' },
                  { label: 'Algo da Infancia que Lembra com Emocao Intensa', key: 'algo_infancia_lembra_com_emocao_intensa', path: 'a_historia_vida.algo_infancia_lembra_com_emocao_intensa' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => historia_vida[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = historia_vida[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Setenios e Eventos */}
      {viewPopupSection === 'setenios_eventos' && setenios_eventos && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Setenios e Eventos</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Concepcao e Gestacao', fields: [
                  { label: 'Planejamento', key: 'concepcao_gestacao_planejamento', path: 'a_setenios_eventos.concepcao_gestacao_planejamento' },
                  { label: 'Ambiente Gestacional', key: 'concepcao_gestacao_ambiente_gestacional', path: 'a_setenios_eventos.concepcao_gestacao_ambiente_gestacional' },
                  { label: 'Saude da Mae', key: 'concepcao_gestacao_saude_mae_gestacao', path: 'a_setenios_eventos.concepcao_gestacao_saude_mae_gestacao' },
                  { label: 'Tipo de Parto', key: 'concepcao_gestacao_parto', path: 'a_setenios_eventos.concepcao_gestacao_parto' },
                  { label: 'Houve Trauma de Parto', key: 'concepcao_gestacao_houve_trauma_parto', path: 'a_setenios_eventos.concepcao_gestacao_houve_trauma_parto' },
                  { label: 'Foi Desejada/Planejada', key: 'concepcao_gestacao_foi_desejada_planejada', path: 'a_setenios_eventos.concepcao_gestacao_foi_desejada_planejada' },
                  { label: 'Impacto', key: 'concepcao_gestacao_impacto', path: 'a_setenios_eventos.concepcao_gestacao_impacto' },
                ]},
                { title: 'Primeiro Setenio (0-7 anos)', fields: [
                  { label: 'Ambiente', key: 'primeiro_setenio_0_7_ambiente', path: 'a_setenios_eventos.primeiro_setenio_0_7_ambiente' },
                  { label: 'Figuras Parentais - Pai', key: 'primeiro_setenio_0_7_figuras_parentais_pai', path: 'a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_pai' },
                  { label: 'Figuras Parentais - Mae', key: 'primeiro_setenio_0_7_figuras_parentais_mae', path: 'a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_mae' },
                  { label: 'Aprendizados', key: 'primeiro_setenio_0_7_aprendizados', path: 'a_setenios_eventos.primeiro_setenio_0_7_aprendizados' },
                  { label: 'Trauma Central', key: 'primeiro_setenio_0_7_trauma_central', path: 'a_setenios_eventos.primeiro_setenio_0_7_trauma_central' },
                ]},
                { title: 'Segundo Setenio (7-14 anos)', fields: [
                  { label: 'Eventos', key: 'segundo_setenio_7_14_eventos', path: 'a_setenios_eventos.segundo_setenio_7_14_eventos' },
                  { label: 'Desenvolvimento', key: 'segundo_setenio_7_14_desenvolvimento', path: 'a_setenios_eventos.segundo_setenio_7_14_desenvolvimento' },
                  { label: 'Corpo Fisico', key: 'segundo_setenio_7_14_corpo_fisico', path: 'a_setenios_eventos.segundo_setenio_7_14_corpo_fisico' },
                  { label: 'Impacto', key: 'segundo_setenio_7_14_impacto', path: 'a_setenios_eventos.segundo_setenio_7_14_impacto' },
                ]},
                { title: 'Terceiro Setenio (14-21 anos)', fields: [
                  { label: 'Escolhas', key: 'terceiro_setenio_14_21_escolhas', path: 'a_setenios_eventos.terceiro_setenio_14_21_escolhas' },
                  { label: 'Motivacao', key: 'terceiro_setenio_14_21_motivacao', path: 'a_setenios_eventos.terceiro_setenio_14_21_motivacao' },
                  { label: 'Cumeeira da Casa', key: 'terceiro_setenio_14_21_cumeeira_da_casa', path: 'a_setenios_eventos.terceiro_setenio_14_21_cumeeira_da_casa' },
                ]},
                { title: 'Quarto Setenio (21-28 anos)', fields: [
                  { label: 'Eventos Significativos', key: 'quarto_setenio_21_28_eventos_significativos', path: 'a_setenios_eventos.quarto_setenio_21_28_eventos_significativos' },
                  { label: 'Formacao Profissional', key: 'quarto_setenio_21_28_formacao_profissional', path: 'a_setenios_eventos.quarto_setenio_21_28_formacao_profissional' },
                ]},
                { title: 'Decenios (28-40+ anos)', fields: [
                  { label: 'Climaterio/Menopausa', key: 'decenios_28_40_mais_climaterio_menopausa', path: 'a_setenios_eventos.decenios_28_40_mais_climaterio_menopausa' },
                  { label: 'Pausas Hormonais', key: 'decenios_28_40_mais_pausas_hormonais', path: 'a_setenios_eventos.decenios_28_40_mais_pausas_hormonais' },
                  { label: 'Acumulacao', key: 'decenios_28_40_mais_acumulacao', path: 'a_setenios_eventos.decenios_28_40_mais_acumulacao' },
                  { label: 'Estado Atual', key: 'decenios_28_40_mais_estado_atual', path: 'a_setenios_eventos.decenios_28_40_mais_estado_atual' },
                  { label: 'Episodios de Estresse Extremo', key: 'decenios_28_40_mais_episodios_estresse_extremo', path: 'a_setenios_eventos.decenios_28_40_mais_episodios_estresse_extremo' },
                ]},
                { title: 'Observacoes Gerais', fields: [
                  { label: 'Eventos Criticos Identificados', key: 'eventos_criticos_identificados', path: 'a_setenios_eventos.eventos_criticos_identificados' },
                  { label: 'Experiencia de Virada', key: 'experiencia_considera_virada', path: 'a_setenios_eventos.experiencia_considera_virada' },
                  { label: 'Diferencas Sazonais/Climaticas nos Sintomas', key: 'diferencas_sazonais_climaticas_sintomas', path: 'a_setenios_eventos.diferencas_sazonais_climaticas_sintomas' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => setenios_eventos[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = setenios_eventos[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Ambiente e Contexto */}
      {viewPopupSection === 'ambiente_contexto' && ambiente_contexto && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Ambiente e Contexto</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Contexto Familiar', fields: [
                  { label: 'Estado Civil', key: 'contexto_familiar_estado_civil', path: 'a_ambiente_contexto.contexto_familiar_estado_civil' },
                  { label: 'Filhos', key: 'contexto_familiar_filhos', path: 'a_ambiente_contexto.contexto_familiar_filhos' },
                  { label: 'Dinamica Familiar', key: 'contexto_familiar_dinamica_familiar', path: 'a_ambiente_contexto.contexto_familiar_dinamica_familiar' },
                  { label: 'Suporte Familiar', key: 'contexto_familiar_suporte_familiar', path: 'a_ambiente_contexto.contexto_familiar_suporte_familiar' },
                  { label: 'Relacionamento Conjugal', key: 'contexto_familiar_relacionamento_conjugal', path: 'a_ambiente_contexto.contexto_familiar_relacionamento_conjugal' },
                  { label: 'Divisao de Tarefas Domesticas', key: 'contexto_familiar_divisao_tarefas_domesticas', path: 'a_ambiente_contexto.contexto_familiar_divisao_tarefas_domesticas' },
                  { label: 'Vida Sexual Ativa', key: 'contexto_familiar_vida_sexual_ativa', path: 'a_ambiente_contexto.contexto_familiar_vida_sexual_ativa' },
                  { label: 'Dialogo sobre Sobrecarga', key: 'contexto_familiar_dialogo_sobre_sobrecarga', path: 'a_ambiente_contexto.contexto_familiar_dialogo_sobre_sobrecarga' },
                ]},
                { title: 'Contexto Profissional', fields: [
                  { label: 'Area', key: 'contexto_profissional_area', path: 'a_ambiente_contexto.contexto_profissional_area' },
                  { label: 'Carga Horaria', key: 'contexto_profissional_carga_horaria', path: 'a_ambiente_contexto.contexto_profissional_carga_horaria' },
                  { label: 'Nivel de Estresse', key: 'contexto_profissional_nivel_estresse', path: 'a_ambiente_contexto.contexto_profissional_nivel_estresse' },
                  { label: 'Satisfacao', key: 'contexto_profissional_satisfacao', path: 'a_ambiente_contexto.contexto_profissional_satisfacao' },
                ]},
                { title: 'Ambiente Fisico', fields: [
                  { label: 'Sedentarismo', key: 'ambiente_fisico_sedentarismo', path: 'a_ambiente_contexto.ambiente_fisico_sedentarismo' },
                  { label: 'Exposicao ao Sol', key: 'ambiente_fisico_exposicao_sol', path: 'a_ambiente_contexto.ambiente_fisico_exposicao_sol' },
                  { label: 'Pratica Atividade Fisica', key: 'ambiente_fisico_atividade_fisica_pratica', path: 'a_ambiente_contexto.ambiente_fisico_atividade_fisica_pratica' },
                  { label: 'Tipo de Atividade', key: 'ambiente_fisico_atividade_fisica_tipo', path: 'a_ambiente_contexto.ambiente_fisico_atividade_fisica_tipo' },
                  { label: 'Frequencia', key: 'ambiente_fisico_atividade_fisica_frequencia', path: 'a_ambiente_contexto.ambiente_fisico_atividade_fisica_frequencia' },
                  { label: 'Intensidade', key: 'ambiente_fisico_atividade_fisica_intensidade', path: 'a_ambiente_contexto.ambiente_fisico_atividade_fisica_intensidade' },
                ]},
                { title: 'Habitos de Vida', fields: [
                  { label: 'Sono', key: 'habitos_vida_sono', path: 'a_ambiente_contexto.habitos_vida_sono' },
                  { label: 'Alimentacao', key: 'habitos_vida_alimentacao', path: 'a_ambiente_contexto.habitos_vida_alimentacao' },
                  { label: 'Lazer', key: 'habitos_vida_lazer', path: 'a_ambiente_contexto.habitos_vida_lazer' },
                  { label: 'Espiritualidade', key: 'habitos_vida_espiritualidade', path: 'a_ambiente_contexto.habitos_vida_espiritualidade' },
                ]},
                { title: 'Suporte Social', fields: [
                  { label: 'Tem Rede de Apoio', key: 'suporte_social_tem_rede_apoio', path: 'a_ambiente_contexto.suporte_social_tem_rede_apoio' },
                  { label: 'Participa de Grupos Sociais', key: 'suporte_social_participa_grupos_sociais', path: 'a_ambiente_contexto.suporte_social_participa_grupos_sociais' },
                  { label: 'Tem com Quem Desabafar', key: 'suporte_social_tem_com_quem_desabafar', path: 'a_ambiente_contexto.suporte_social_tem_com_quem_desabafar' },
                ]},
                { title: 'Fatores de Risco', fields: [
                  { label: 'Fatores Estressores', key: 'fatores_estressores', path: 'a_ambiente_contexto.fatores_estressores' },
                  { label: 'Fatores Externos a Saude', key: 'fatores_externos_saude', path: 'a_ambiente_contexto.fatores_externos_saude' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => ambiente_contexto[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = ambiente_contexto[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Sensacao e Emocoes */}
      {viewPopupSection === 'sensacao_emocoes' && sensacao_emocoes && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Sensacao e Emocoes</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Emocoes e Sensacoes', fields: [
                  { label: 'Emocoes Predominantes', key: 'emocoes_predominantes', path: 'a_sensacao_emocoes.emocoes_predominantes' },
                  { label: 'Sensacoes Corporais', key: 'sensacoes_corporais', path: 'a_sensacao_emocoes.sensacoes_corporais' },
                  { label: 'Palavras-chave Emocionais', key: 'palavras_chave_emocionais', path: 'a_sensacao_emocoes.palavras_chave_emocionais' },
                  { label: 'Intensidade Emocional', key: 'intensidade_emocional', path: 'a_sensacao_emocoes.intensidade_emocional' },
                ]},
                { title: 'Gatilhos Emocionais', fields: [
                  { label: 'Consegue Identificar Gatilhos', key: 'consegue_identificar_gatilhos_emocionais', path: 'a_sensacao_emocoes.consegue_identificar_gatilhos_emocionais' },
                  { label: 'Gatilhos Identificados', key: 'gatilhos_identificados', path: 'a_sensacao_emocoes.gatilhos_identificados' },
                ]},
                { title: 'Regulacao Emocional', fields: [
                  { label: 'Capacidade de Regulacao', key: 'regulacao_emocional_capacidade_regulacao', path: 'a_sensacao_emocoes.regulacao_emocional_capacidade_regulacao' },
                  { label: 'Forma de Expressao', key: 'regulacao_emocional_forma_expressao', path: 'a_sensacao_emocoes.regulacao_emocional_forma_expressao' },
                  { label: 'Como Gerencia Estresse/Ansiedade', key: 'regulacao_emocional_como_gerencia_estresse_ansiedade', path: 'a_sensacao_emocoes.regulacao_emocional_como_gerencia_estresse_ansiedade' },
                  { label: 'Memoria Afetiva', key: 'memoria_afetiva', path: 'a_sensacao_emocoes.memoria_afetiva' },
                ]},
                { title: 'Sensacoes Especificas do Reino', fields: [
                  { label: 'Usa Palavras Como', key: 'sensacoes_especificas_reino_usa_palavras_como', path: 'a_sensacao_emocoes.sensacoes_especificas_reino_usa_palavras_como' },
                  { label: 'Descreve Sensacoes Como', key: 'sensacoes_especificas_reino_descreve_sensacoes_como', path: 'a_sensacao_emocoes.sensacoes_especificas_reino_descreve_sensacoes_como' },
                  { label: 'Padroes de Discurso', key: 'sensacoes_especificas_reino_padroes_discurso', path: 'a_sensacao_emocoes.sensacoes_especificas_reino_padroes_discurso' },
                ]},
                { title: 'Conexao Corpo-Mente', fields: [
                  { label: 'Percebe Manifestacoes Corporais das Emocoes', key: 'conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes', path: 'a_sensacao_emocoes.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes' },
                  { label: 'Exemplos', key: 'conexao_corpo_mente_exemplos', path: 'a_sensacao_emocoes.conexao_corpo_mente_exemplos' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => sensacao_emocoes[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = sensacao_emocoes[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Preocupacoes e Crencas */}
      {viewPopupSection === 'preocupacoes_crencas' && preocupacoes_crencas && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Preocupacoes e Crencas</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Percepcao do Problema', fields: [
                  { label: 'Como Percebe o Problema', key: 'como_percebe_problema', path: 'a_preocupacoes_crencas.como_percebe_problema' },
                  { label: 'Compreensao sobre Causa dos Sintomas', key: 'compreensao_sobre_causa_sintomas', path: 'a_preocupacoes_crencas.compreensao_sobre_causa_sintomas' },
                ]},
                { title: 'Crencas e Preocupacoes', fields: [
                  { label: 'Crencas Limitantes', key: 'crencas_limitantes', path: 'a_preocupacoes_crencas.crencas_limitantes' },
                  { label: 'Preocupacoes Explicitas', key: 'preocupacoes_explicitas', path: 'a_preocupacoes_crencas.preocupacoes_explicitas' },
                  { label: 'Preocupacoes Implicitas', key: 'preocupacoes_implicitas', path: 'a_preocupacoes_crencas.preocupacoes_implicitas' },
                  { label: 'Ganhos Secundarios', key: 'ganhos_secundarios', path: 'a_preocupacoes_crencas.ganhos_secundarios' },
                  { label: 'Resistencias Possiveis', key: 'resistencias_possiveis', path: 'a_preocupacoes_crencas.resistencias_possiveis' },
                ]},
                { title: 'Expectativas e Insight', fields: [
                  { label: 'Condicoes Geneticas na Familia', key: 'condicoes_geneticas_familia', path: 'a_preocupacoes_crencas.condicoes_geneticas_familia' },
                  { label: 'Expectativas Irrealistas', key: 'expectativas_irrealistas', path: 'a_preocupacoes_crencas.expectativas_irrealistas' },
                  { label: 'Nivel de Insight/Autoconsciencia', key: 'nivel_insight_autoconsciencia', path: 'a_preocupacoes_crencas.nivel_insight_autoconsciencia' },
                  { label: 'Abertura para Mudanca', key: 'abertura_para_mudanca', path: 'a_preocupacoes_crencas.abertura_para_mudanca' },
                ]},
                { title: 'Barreiras e Desafios', fields: [
                  { label: 'Barreiras Percebidas ao Tratamento', key: 'barreiras_percebidas_tratamento', path: 'a_preocupacoes_crencas.barreiras_percebidas_tratamento' },
                  { label: 'Aspectos do Plano que Parecem Desafiadores', key: 'aspectos_plano_parecem_desafiadores', path: 'a_preocupacoes_crencas.aspectos_plano_parecem_desafiadores' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => preocupacoes_crencas[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = preocupacoes_crencas[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Reino e Miasma */}
      {viewPopupSection === 'reino_miasma' && reino_miasma && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Reino e Miasma</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Reino Predominante', fields: [
                  { label: 'Reino Predominante', key: 'reino_predominante', path: 'a_reino_miasma.reino_predominante' },
                  { label: 'Justificativa do Reino', key: 'justificativa_reino', path: 'a_reino_miasma.justificativa_reino' },
                  { label: 'Caracteristicas Identificadas', key: 'caracteristicas_identificadas', path: 'a_reino_miasma.caracteristicas_identificadas' },
                ]},
                { title: 'Miasma', fields: [
                  { label: 'Miasma Principal', key: 'miasma_principal', path: 'a_reino_miasma.miasma_principal' },
                  { label: 'Justificativa do Miasma', key: 'justificativa_miasma', path: 'a_reino_miasma.justificativa_miasma' },
                  { label: 'Analise Miasma - Energia', key: 'analise_miasma_energia', path: 'a_reino_miasma.analise_miasma_energia' },
                  { label: 'Analise Miasma - Luta', key: 'analise_miasma_luta', path: 'a_reino_miasma.analise_miasma_luta' },
                ]},
                { title: 'Analise Detalhada - Reino Animal', fields: [
                  { label: 'Palavras Usadas', key: 'analise_detalhada_reino_animal_palavras_usadas', path: 'a_reino_miasma.analise_detalhada_reino_animal_palavras_usadas' },
                  { label: 'Descreve Sensacoes Como', key: 'analise_detalhada_reino_animal_descreve_sensacoes_como', path: 'a_reino_miasma.analise_detalhada_reino_animal_descreve_sensacoes_como' },
                ]},
                { title: 'Implicacoes Terapeuticas', fields: [
                  { label: 'Comunicacao', key: 'implicacoes_terapeuticas_comunicacao', path: 'a_reino_miasma.implicacoes_terapeuticas_comunicacao' },
                  { label: 'Abordagem', key: 'implicacoes_terapeuticas_abordagem', path: 'a_reino_miasma.implicacoes_terapeuticas_abordagem' },
                  { label: 'Outras Terapias Alinhadas', key: 'implicacoes_terapeuticas_outras_terapias_alinhadas', path: 'a_reino_miasma.implicacoes_terapeuticas_outras_terapias_alinhadas' },
                ]},
                { title: 'Observacoes Comportamentais', fields: [
                  { label: 'Padrao de Discurso', key: 'padrao_discurso', path: 'a_reino_miasma.padrao_discurso' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => reino_miasma[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = reino_miasma[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={`Editar: ${field.label}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Sintese Analitica */}
      {viewPopupSection === 'sintese' && sinteseAnalitica && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Sintese Analitica</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Sintese Analitica', fields: [
                  { label: 'Sintese', key: 'sintese', path: 'a_sintese_analitica.sintese' },
                  { label: 'Tres Linhas', key: 'tres_linhas', path: 'a_sintese_analitica.tres_linhas' },
                  { label: 'Eixo Causal Principal', key: 'eixo_causal_principal', path: 'a_sintese_analitica.eixo_causal_principal' },
                  { label: 'Perpetuadores', key: 'perpetuadores', path: 'a_sintese_analitica.perpetuadores' },
                  { label: 'Achados Urgentes', key: 'achados_criticos_urgentes', path: 'a_sintese_analitica.achados_criticos_urgentes' },
                  { label: 'Achados Importantes', key: 'achados_criticos_importantes', path: 'a_sintese_analitica.achados_criticos_importantes' },
                  { label: 'Psicoemocional', key: 'psicoemocional', path: 'a_sintese_analitica.psicoemocional' },
                  { label: 'Intervencao Imediata', key: 'intervencao_imediata', path: 'a_sintese_analitica.intervencao_imediata' },
                  { label: 'Proximas Etapas', key: 'proximas_etapas', path: 'a_sintese_analitica.proximas_etapas' },
                  { label: 'Exames Faltantes', key: 'exames_faltantes', path: 'a_sintese_analitica.exames_faltantes' },
                  { label: 'Encaminhar', key: 'encaminhar', path: 'a_sintese_analitica.encaminhar' },
                  { label: 'Pontos de Atencao', key: 'pontos_atencao', path: 'a_sintese_analitica.pontos_atencao' },
                  { label: 'Prognostico', key: 'prognostico', path: 'a_sintese_analitica.prognostico' },
                  { label: 'Complexidade', key: 'complexidade', path: 'a_sintese_analitica.complexidade' },
                  { label: 'Urgencia', key: 'urgencia', path: 'a_sintese_analitica.urgencia' },
                  { label: 'Prontidao para Mudanca', key: 'prontidao_mudanca', path: 'a_sintese_analitica.prontidao_mudanca' },
                  { label: 'Confiabilidade', key: 'confiabilidade', path: 'a_sintese_analitica.confiabilidade' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => sinteseAnalitica[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = sinteseAnalitica[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Dados do Paciente */}
      {viewPopupSection === 'dados_paciente' && cadastroAnamnese && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Dados do Paciente</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Identificacao', fields: [
                  { label: 'Nome', key: 'nome_completo', path: 'a_cadastro_anamnese.nome_completo' },
                  { label: 'Data Nasc.', key: 'data_nascimento', path: 'a_cadastro_anamnese.data_nascimento' },
                  { label: 'CPF', key: 'cpf', path: 'a_cadastro_anamnese.cpf' },
                  { label: 'Estado Civil', key: 'estado_civil', path: 'a_cadastro_anamnese.estado_civil' },
                  { label: 'Email', key: 'email', path: 'a_cadastro_anamnese.email' },
                  { label: 'Profissao', key: 'profissao', path: 'a_cadastro_anamnese.profissao' },
                  { label: 'Genero', key: 'genero', path: 'a_cadastro_anamnese.genero' },
                ]},
                { title: 'Dados Fisicos', fields: [
                  { label: 'Altura', key: 'altura', path: 'a_cadastro_anamnese.altura' },
                  { label: 'Peso Atual', key: 'peso_atual', path: 'a_cadastro_anamnese.peso_atual' },
                  { label: 'Peso Antigo', key: 'peso_antigo', path: 'a_cadastro_anamnese.peso_antigo' },
                  { label: 'Peso Desejado', key: 'peso_desejado', path: 'a_cadastro_anamnese.peso_desejado' },
                ]},
                { title: 'Objetivos', fields: [
                  { label: 'Objetivo Principal', key: 'objetivo_principal', path: 'a_cadastro_anamnese.objetivo_principal' },
                  { label: 'Pratica Atividade', key: 'patrica_atividade_fisica', path: 'a_cadastro_anamnese.patrica_atividade_fisica' },
                  { label: 'Frequencia Treino', key: 'frequencia_deseja_treinar', path: 'a_cadastro_anamnese.frequencia_deseja_treinar' },
                  { label: 'Restricao', key: 'restricao_movimento', path: 'a_cadastro_anamnese.restricao_movimento' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => cadastroAnamnese[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = cadastroAnamnese[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente da seção de Diagnóstico
function DiagnosticoSection({
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange,
  activeTab,
  consultaDetails
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
  activeTab?: string;
  consultaDetails?: any;
}) {
  const { user } = useAuth();
  const [diagnosticoData, setDiagnosticoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewPopupSection, setViewPopupSection] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    loadDiagnosticoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadDiagnosticoData();
    };

    window.addEventListener('diagnostico-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('diagnostico-data-refresh', handleRefresh);
    };
  }, []);

  const loadDiagnosticoData = async () => {
    try {
      setLoadingDetails(true);
      console.log('🔍 Carregando dados de diagnóstico para consulta:', consultaId);
      const response = await gatewayClient.get(`/diagnostico/${consultaId}`);
      console.log('📡 Response status:', response.status);
      if (response.success) {
        const data = response;
        console.log('✅ Dados de diagnóstico carregados:', data);
        console.log('🔍 Estrutura dos dados de diagnóstico:', {
          type: typeof data,
          keys: Object.keys(data || {}),
          hasData: !!data
        });
        setDiagnosticoData(data);
        setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
      } else {
        const errorData = await response.text();
        setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading mesmo em caso de erro
      }
    } catch (error) {
      // Erro ao carregar dados
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading em caso de erro
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await gatewayClient.post(`/diagnostico/${consultaId}/update-field`, {
        fieldPath,
        value: newValue
      });

      if (!response.success) throw new Error('Erro ao atualizar campo no Supabase');

      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();

        gatewayClient.post('/ai/edit', {
          webhookUrl: webhookEndpoints.edicaoDiagnostico,
          origem: 'MANUAL',
          fieldPath,
          texto: newValue,
          consultaId,
          paciente_id: consultaDetails?.patient_id || (consultaDetails as any)?.paciente_id || null,
          user_id: user?.id || null,
          msg_edicao: null, // Edição manual não tem prompt de IA
          table: fieldPath.split('.')[0] || 'd_diagnostico_principal',
          query: null
        }).catch(webhookError => {
          console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
        });
      } catch (webhookError) {
        console.warn('Aviso: Erro ao preparar webhook:', webhookError);
      }

      // Recarregar dados após salvar
      await loadDiagnosticoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    console.log('🔍 DiagnosticoSection - Mostrando loading...');
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de diagnóstico...</p>
      </div>
    );
  }

  const {
    estado_geral,
    estado_mental,
    estado_fisiologico,
    diagnostico_principal,
    agente_integracao_diagnostica: integracao_diagnostica,
    agente_habitos_vida_sistemica: habitos_vida
  } = diagnosticoData || {};

  console.log('🔍 DiagnosticoSection - dados recebidos:', diagnosticoData);
  console.log('🔍 DiagnosticoSection - Renderizando componente com dados:', {
    loading,
    hasDiagnosticoData: !!diagnosticoData,
    diagnosticoDataKeys: diagnosticoData ? Object.keys(diagnosticoData) : [],
    diagnostico_principal: !!diagnostico_principal,
    estado_geral: !!estado_geral,
    estado_mental: !!estado_mental,
    estado_fisiologico: !!estado_fisiologico,
    integracao_diagnostica: !!integracao_diagnostica,
    habitos_vida: !!habitos_vida
  });

  // Verificar se há dados em alguma seção
  const hasAnyData = diagnostico_principal || estado_geral || estado_mental ||
    estado_fisiologico || integracao_diagnostica || habitos_vida;

  // Função para mapear nomes de tabs para títulos de seções
  const getSectionTitle = (tab: string): string => {
    const map: { [key: string]: string } = {
      'Diagnóstico Principal': '1. Diagnóstico Principal',
      'Estado Geral': '2. Estado Geral',
      'Estado Mental': '3. Estado Mental',
      'Estado Fisiológico': '4. Estado Fisiológico (Resumo - devido ao volume de campos)',
      'Integração Diagnóstica': '5. Integração Diagnóstica',
      'Hábitos de Vida': '6. Hábitos de Vida (Resumo dos 5 Pilares)'
    };
    return map[tab] || tab;
  };

  const shouldShowSection = (sectionTitle: string): boolean => {
    if (!activeTab) {
      return true; // Se não há tab ativa, mostrar todas
    }
    const mappedTitle = getSectionTitle(activeTab);
    const shouldShow = mappedTitle === sectionTitle;
    console.log('🔍 [Diagnóstico] shouldShowSection:', { activeTab, sectionTitle, mappedTitle, shouldShow });
    return shouldShow;
  };

  console.log('🔍 [Diagnóstico] Renderizando com:', {
    activeTab,
    hasAnyData,
    loading,
    diagnostico_principal: !!diagnostico_principal,
    estado_geral: !!estado_geral,
    estado_mental: !!estado_mental,
    estado_fisiologico: !!estado_fisiologico,
    integracao_diagnostica: !!integracao_diagnostica,
    habitos_vida: !!habitos_vida
  });

  return (
    <div className="anamnese-sections">
      {/* ==================== DIAGNÓSTICO PRINCIPAL ==================== */}
      {shouldShowSection('1. Diagnóstico Principal') && (
        <CollapsibleSection title="1. Diagnóstico Principal" defaultOpen={activeTab === 'Diagnóstico Principal' || !activeTab}>
          <div onClick={() => setViewPopupSection('diagnostico_principal')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = diagnostico_principal;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'CID e Diagnosticos', fields: [{ label: 'CID Principal', value: q.cid_principal },{ label: 'Diagnosticos Associados (CID)', value: q.diagnosticos_associados_cid }]},
                { title: 'Avaliacao Diagnostica Sistematica (ADS)', fields: [{ label: 'Sintese', value: q.ads_sintese },{ label: 'Biologico', value: q.ads_biologico },{ label: 'Psicologico', value: q.ads_psicologico },{ label: 'Emocional', value: q.ads_emocional },{ label: 'Social', value: q.ads_social },{ label: 'Espiritual', value: q.ads_espiritual },{ label: 'Trilha Causal Sintetica', value: q.ads_trilha_causal_sintetica },{ label: 'Tipo de Sindrome', value: q.ads_tipo_sindrome }]},
                { title: 'Gravidade', fields: [{ label: 'Nivel de Gravidade', value: q.grav_nivel },{ label: 'Justificativa', value: q.grav_justificativa },{ label: 'Janela de Intervencao', value: q.grav_janela_intervencao },{ label: 'Risco Iminente', value: q.grav_risco_iminente }]},
                { title: 'Homeopatia', fields: [{ label: 'Reino Predominante', value: q.reino_predominante },{ label: 'Caracteristicas do Reino', value: q.reino_caracteristicas },{ label: 'Medicamento Principal', value: q.homeo_medicamento_principal },{ label: 'Justificativa', value: q.homeo_justificativa },{ label: 'Potencia Inicial', value: q.homeo_potencia_inicial },{ label: 'Frequencia', value: q.homeo_frequencia },{ label: 'Medicamentos Complementares', value: q.medicamentos_complementares }]},
                { title: 'Florais de Bach', fields: [{ label: 'Florais Indicados', value: q.florais_bach_indicados },{ label: 'Formula Floral Sugerida', value: q.formula_floral_sugerida }]},
                { title: 'Prognostico', fields: [{ label: 'Fatores Favoraveis', value: q.prognostico_fatores_favoraveis },{ label: 'Fatores Desfavoraveis', value: q.prognostico_fatores_desfavoraveis },{ label: 'Prob. Sucesso (Adesao Total)', value: q.prob_sucesso_adesao_total },{ label: 'Prob. Sucesso (Adesao Parcial)', value: q.prob_sucesso_adesao_parcial },{ label: 'Prob. Sucesso (Sem Adesao)', value: q.prob_sucesso_sem_adesao }]},
                { title: 'Alertas', fields: [{ label: 'Alertas Criticos', value: q.alertas_criticos }]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (<>{sections.map((section) => { const validFields = section.fields.filter(f => f.value); if (validFields.length === 0) return null; return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{validFields.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>); })}</>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== ESTADO GERAL ==================== */}
      {shouldShowSection('2. Estado Geral') && (
        <CollapsibleSection title="2. Estado Geral" defaultOpen={activeTab === 'Estado Geral' || !activeTab}>
          <div onClick={() => setViewPopupSection('estado_geral')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = estado_geral;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Avaliacao Global', fields: [{ label: 'Estado Geral', value: q.avaliacao_estado },{ label: 'Score de Vitalidade', value: q.avaliacao_score_vitalidade },{ label: 'Tendencia', value: q.avaliacao_tendencia },{ label: 'Reserva Fisiologica', value: q.avaliacao_reserva_fisiologica }]},
                { title: 'Energia Vital', fields: [{ label: 'Nivel', value: q.energia_vital_nivel },{ label: 'Descricao', value: q.energia_vital_descricao },{ label: 'Manifestacao', value: q.energia_vital_manifestacao },{ label: 'Impacto', value: q.energia_vital_impacto }]},
                { title: 'Adaptacao ao Stress', fields: [{ label: 'Nivel', value: q.adapt_stress_nivel },{ label: 'Descricao', value: q.adapt_stress_descricao },{ label: 'Reserva Adaptativa', value: q.adapt_stress_reserva_adaptativa },{ label: 'Manifestacao', value: q.adapt_stress_manifestacao }]},
                { title: 'Resiliencia', fields: [{ label: 'Nivel', value: q.resiliencia_nivel },{ label: 'Descricao', value: q.resiliencia_descricao },{ label: 'Elasticidade', value: q.resiliencia_elasticidade },{ label: 'Tempo de Recuperacao', value: q.resiliencia_tempo_recuperacao }]},
                { title: 'Observacao Clinica', fields: [{ label: 'Facies', value: q.obs_facies },{ label: 'Postura', value: q.obs_postura },{ label: 'Marcha', value: q.obs_marcha },{ label: 'Tonus Muscular', value: q.obs_tonus_muscular },{ label: 'Aparencia Geral', value: q.obs_aparencia_geral },{ label: 'Contato Visual', value: q.obs_contato_visual },{ label: 'Voz', value: q.obs_voz }]},
                { title: 'AVD', fields: [{ label: 'Autocuidado Basico', value: q.avd_autocuidado_basico },{ label: 'Trabalho Profissional', value: q.avd_trabalho_profissional },{ label: 'Cuidado com Filhos', value: q.avd_cuidado_filhos },{ label: 'Tarefas Domesticas', value: q.avd_tarefas_domesticas },{ label: 'Lazer e Social', value: q.avd_lazer_social },{ label: 'Autocuidado Ampliado', value: q.avd_autocuidado_ampliado }]},
                { title: 'Funcionalidade e Qualidade de Vida', fields: [{ label: 'Score Karnofsky', value: q.funcionalidade_score_karnofsky },{ label: 'Limitacoes Funcionais', value: q.limitacoes_funcionais_especificas },{ label: 'WHOQOL Score Geral', value: q.whoqol_score_geral }]},
                { title: 'Sinais de Alerta e Evolucao', fields: [{ label: 'Sinais de Alerta', value: q.sinais_alerta_deterioracao },{ label: 'Atual', value: q.evo_atual },{ label: 'Projecao 6 Meses (Sem Intervencao)', value: q.projecao_6_meses_sem_intervencao }]},
                { title: 'Impacto', fields: [{ label: 'Profissional', value: q.impacto_profissional },{ label: 'Familiar', value: q.impacto_familiar },{ label: 'Social', value: q.impacto_social },{ label: 'Pessoal', value: q.impacto_pessoal },{ label: 'Saude', value: q.impacto_saude }]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (<>{sections.map((section) => { const validFields = section.fields.filter(f => f.value); if (validFields.length === 0) return null; return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{validFields.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>); })}</>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* ====================ESTADO MENTAL ==================== */}
      {shouldShowSection('3. Estado Mental') && (
        <CollapsibleSection title="3. Estado Mental" defaultOpen={activeTab === 'Estado Mental' || !activeTab}>
          <div onClick={() => setViewPopupSection('estado_mental')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = estado_mental;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              const sections = [
                { title: 'Memoria', fields: [{ label: 'Curto Prazo', value: q.memoria_curto_prazo },{ label: 'Longo Prazo', value: q.memoria_longo_prazo },{ label: 'De Trabalho', value: q.memoria_de_trabalho },{ label: 'Score', value: q.memoria_score }]},
                { title: 'Atencao', fields: [{ label: 'Sustentada', value: q.atencao_sustentada },{ label: 'Seletiva', value: q.atencao_seletiva },{ label: 'Score', value: q.atencao_score }]},
                { title: 'Funcoes Executivas', fields: [{ label: 'Planejamento', value: q.exec_planejamento },{ label: 'Organizacao', value: q.exec_organizacao },{ label: 'Tomada de Decisao', value: q.exec_tomada_decisao },{ label: 'Score', value: q.exec_score }]},
                { title: 'Humor e Afeto', fields: [{ label: 'Tipo de Humor', value: q.humor_tipo },{ label: 'Intensidade', value: q.humor_intensidade },{ label: 'Variabilidade', value: q.humor_variabilidade },{ label: 'Expressao do Afeto', value: q.afeto_expressao }]},
                { title: 'Ansiedade', fields: [{ label: 'Nivel', value: q.ansiedade_nivel },{ label: 'Tipo Predominante', value: q.ansiedade_tipo_predominante },{ label: 'Score GAD-7', value: q.ansiedade_score_gad7_estimado }]},
                { title: 'PHQ-9 (Depressao)', fields: [{ label: 'Humor Deprimido', value: q.phq9_humor_deprimido },{ label: 'Anedonia', value: q.phq9_anedonia },{ label: 'Fadiga', value: q.phq9_fadiga },{ label: 'Score PHQ-9', value: q.phq9_score_estimado }]},
                { title: 'Autoestima', fields: [{ label: 'Autoestima Global', value: q.autoestima_global },{ label: 'Autopercepcao', value: q.autopercepcao },{ label: 'Autoeficacia', value: q.autoeficacia }]},
                { title: 'Risco de Suicidio', fields: [{ label: 'Nivel de Risco', value: q.risco_nivel },{ label: 'Ideacao', value: q.risco_ideacao },{ label: 'Acao Requerida', value: q.risco_acao_requerida }]},
                { title: 'Diagnosticos e Intervencoes', fields: [{ label: 'Diagnosticos DSM-5', value: q.diagnosticos_mentais_dsm5_sugeridos },{ label: 'Psicoterapia', value: q.intervencao_psicoterapia },{ label: 'Psiquiatria', value: q.intervencao_psiquiatria }]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para visualizar.</span>;
              return (<>{sections.map((section) => { const validFields = section.fields.filter(f => f.value); if (validFields.length === 0) return null; return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{validFields.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>); })}</>);
            })()}
          </div>
        </CollapsibleSection>
      )}


      {/* ==================== ESTADO FISIOLÓGICO ==================== */}
      {shouldShowSection('4. Estado Fisiológico (Resumo - devido ao volume de campos)') && (
        <CollapsibleSection title="4. Estado Fisiologico" defaultOpen={activeTab === 'Estado Fisiológico' || !activeTab}>
          <div onClick={() => setViewPopupSection('estado_fisiologico')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = estado_fisiologico;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              const sections = [{ title: "Tireoide", fields: [{ label: "Status", value: estado_fisiologico?.end_tireo_status },{ label: "Diagnostico", value: estado_fisiologico?.end_tireo_diagnostico },{ label: "Acao", value: estado_fisiologico?.end_tireo_acao_terapeutica }] },
                { title: "Insulina/Glicose", fields: [{ label: "Status", value: estado_fisiologico?.end_insgl_status },{ label: "Diagnostico", value: estado_fisiologico?.end_insgl_diagnostico },{ label: "Acao", value: estado_fisiologico?.end_insgl_acao_terapeutica }] },
                { title: "Intestino", fields: [{ label: "Status", value: estado_fisiologico?.gi_int_status },{ label: "Diagnostico", value: estado_fisiologico?.gi_int_diagnostico },{ label: "Acao", value: estado_fisiologico?.gi_int_acao_prioritaria }] },
                { title: "Cardiovascular", fields: [{ label: "Status", value: estado_fisiologico?.cv_status },{ label: "Pressao", value: estado_fisiologico?.cv_pressao_arterial },{ label: "Acao", value: estado_fisiologico?.cv_acao }] },
                { title: "Inflamacao", fields: [{ label: "Nivel Inflamacao", value: estado_fisiologico?.infl_sist_nivel },{ label: "Causas", value: estado_fisiologico?.infl_sist_causas },{ label: "Estresse Oxidativo", value: estado_fisiologico?.oxi_nivel }] },
                { title: "Exames", fields: [{ label: "Urgente", value: estado_fisiologico?.exames_urgente_0_15_dias },{ label: "Alta Prioridade", value: estado_fisiologico?.exames_alta_prioridade_30_dias },{ label: "Media Prioridade", value: estado_fisiologico?.exames_media_prioridade_60_90_dias }] },
                ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              return (<>
                {sections.map((section) => {
                  const validFields = section.fields.filter(f => f.value);
                  if (validFields.length === 0) return null;
                  return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{validFields.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>);
                })}
                <div style={{ marginTop: 8, fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Clique para expandir e editar
                </div>
              </>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== INTEGRAÇÃO DIAGNÓSTICA ==================== */}
      {shouldShowSection('5. Integração Diagnóstica') && (
        <CollapsibleSection title="5. Integracao Diagnostica" defaultOpen={activeTab === 'Integração Diagnóstica' || !activeTab}>
          <div onClick={() => setViewPopupSection('integracao_diagnostica')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = integracao_diagnostica;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              const sections = [
                { title: 'Diagnostico Integrado', fields: [{ label: 'Titulo', value: q.diagnostico_titulo },{ label: 'CID Primario', value: q.diagnostico_cid_primario },{ label: 'CIDs Associados', value: q.diagnostico_cids_associados },{ label: 'Sintese Executiva', value: q.diagnostico_sintese_executiva }]},
                { title: 'Metafora da Casa', fields: [{ label: 'Fundacao Status', value: q.fundacao_status },{ label: 'Fundacao Eventos', value: q.fundacao_eventos },{ label: 'Colunas Status', value: q.colunas_status },{ label: 'Colunas Eventos', value: q.colunas_eventos },{ label: 'Cumeeira Status', value: q.cumeeira_status },{ label: 'Cumeeira Eventos', value: q.cumeeira_eventos }]},
                { title: 'Diagnosticos Especificos', fields: [{ label: 'Biologico', value: q.diagnostico_biologico },{ label: 'Emocional', value: q.diagnostico_emocional },{ label: 'Social', value: q.diagnostico_social },{ label: 'Energetico', value: q.diagnostico_energetico },{ label: 'Espiritual', value: q.diagnostico_espiritual }]},
                { title: 'Confianca', fields: [{ label: 'Nivel', value: q.nivel_confianca_diagnostico }]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              return (<>
                {sections.map((section) => { const vf = section.fields.filter(f => f.value); if (vf.length === 0) return null; return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{vf.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>); })}
                
              </>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== HÁBITOS DE VIDA ==================== */}
      {shouldShowSection('6. Hábitos de Vida (Resumo dos 5 Pilares)') && (
        <CollapsibleSection title="6. Habitos de Vida (5 Pilares)" defaultOpen={activeTab === 'Hábitos de Vida' || !activeTab}>
          <div onClick={() => setViewPopupSection('habitos_vida')} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
            {(() => {
              const q = habitos_vida;
              if (!q) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              const sections = [
                { title: 'Alimentacao', fields: [{ label: 'Status', value: q.pilar1_alimentacao_status_global },{ label: 'Score', value: q.pilar1_alimentacao_score_qualidade },{ label: 'Problemas', value: q.pilar1_alimentacao_problemas_identificados },{ label: 'Intervencao', value: q.pilar1_intervencao_requerida_nutricional }]},
                { title: 'Atividade Fisica', fields: [{ label: 'Status', value: q.pilar2_atividade_fisica_status_global },{ label: 'Score', value: q.pilar2_atividade_fisica_score },{ label: 'Padrao', value: q.pilar2_padrao_pratica_exercicio },{ label: 'Prescricao', value: q.pilar2_prescricao_fase1_objetivo }]},
                { title: 'Sono', fields: [{ label: 'Status', value: q.pilar3_sono_status_global },{ label: 'Score', value: q.pilar3_sono_score },{ label: 'Qualidade', value: q.pilar3_padrao_qualidade_subjetiva },{ label: 'Intervencao', value: q.pilar3_intervencao_prioridade }]},
                { title: 'Gestao de Stress', fields: [{ label: 'Status', value: q.pilar4_stress_status_global },{ label: 'Score', value: q.pilar4_stress_score },{ label: 'Nivel', value: q.pilar4_stress_nivel_atual },{ label: 'Fontes', value: q.pilar4_fontes_stress_profissional }]},
                { title: 'Espiritualidade', fields: [{ label: 'Status', value: q.pilar5_espiritualidade_status_global },{ label: 'Score', value: q.pilar5_espiritualidade_score },{ label: 'Praticas', value: q.pilar5_espiritualidade_praticas_atuais }]},
                { title: 'Ritmo Circadiano', fields: [{ label: 'Status', value: q.ritmo_circadiano_status },{ label: 'Problemas', value: q.ritmo_circadiano_problemas },{ label: 'Impacto', value: q.ritmo_circadiano_impacto }]},
                { title: 'Resumo', fields: [{ label: 'Score Geral', value: q.score_habitos_vida_geral },{ label: 'Prioridades', value: q.prioridades_intervencao_habitos }]},
              ];
              const hasSomething = sections.some(s => s.fields.some(f => f.value));
              if (!hasSomething) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>;
              return (<>
                {sections.map((section) => { const vf = section.fields.filter(f => f.value); if (vf.length === 0) return null; return (<div key={section.title} style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>{section.title}</div>{vf.map((f, i) => (<div key={i} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid #E2E8F0' }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong><div style={{ color: '#0F172A', marginTop: 2 }}>{cleanText(f.value)}</div></div>))}</div>); })}
                
              </>);
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Popup Diagnostico Principal */}
      {viewPopupSection === 'diagnostico_principal' && diagnostico_principal && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>1. Diagnostico Principal</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'CID e Diagnosticos', fields: [
                  { label: 'CID Principal', key: 'cid_principal', path: 'd_diagnostico_principal.cid_principal' },
                  { label: 'Diagnosticos Associados (CID)', key: 'diagnosticos_associados_cid', path: 'd_diagnostico_principal.diagnosticos_associados_cid' },
                ]},
                { title: 'Avaliacao Diagnostica Sistematica (ADS)', fields: [
                  { label: 'Sintese', key: 'ads_sintese', path: 'd_diagnostico_principal.ads_sintese' },
                  { label: 'Biologico', key: 'ads_biologico', path: 'd_diagnostico_principal.ads_biologico' },
                  { label: 'Psicologico', key: 'ads_psicologico', path: 'd_diagnostico_principal.ads_psicologico' },
                  { label: 'Emocional', key: 'ads_emocional', path: 'd_diagnostico_principal.ads_emocional' },
                  { label: 'Social', key: 'ads_social', path: 'd_diagnostico_principal.ads_social' },
                  { label: 'Espiritual', key: 'ads_espiritual', path: 'd_diagnostico_principal.ads_espiritual' },
                  { label: 'Trilha Causal Sintetica', key: 'ads_trilha_causal_sintetica', path: 'd_diagnostico_principal.ads_trilha_causal_sintetica' },
                  { label: 'Tipo de Sindrome', key: 'ads_tipo_sindrome', path: 'd_diagnostico_principal.ads_tipo_sindrome' },
                ]},
                { title: 'Gravidade', fields: [
                  { label: 'Nivel de Gravidade', key: 'grav_nivel', path: 'd_diagnostico_principal.grav_nivel' },
                  { label: 'Justificativa', key: 'grav_justificativa', path: 'd_diagnostico_principal.grav_justificativa' },
                  { label: 'Janela de Intervencao', key: 'grav_janela_intervencao', path: 'd_diagnostico_principal.grav_janela_intervencao' },
                  { label: 'Risco Iminente', key: 'grav_risco_iminente', path: 'd_diagnostico_principal.grav_risco_iminente' },
                ]},
                { title: 'Homeopatia', fields: [
                  { label: 'Reino Predominante', key: 'reino_predominante', path: 'd_diagnostico_principal.reino_predominante' },
                  { label: 'Caracteristicas do Reino', key: 'reino_caracteristicas', path: 'd_diagnostico_principal.reino_caracteristicas' },
                  { label: 'Medicamento Principal', key: 'homeo_medicamento_principal', path: 'd_diagnostico_principal.homeo_medicamento_principal' },
                  { label: 'Justificativa', key: 'homeo_justificativa', path: 'd_diagnostico_principal.homeo_justificativa' },
                  { label: 'Potencia Inicial', key: 'homeo_potencia_inicial', path: 'd_diagnostico_principal.homeo_potencia_inicial' },
                  { label: 'Frequencia', key: 'homeo_frequencia', path: 'd_diagnostico_principal.homeo_frequencia' },
                  { label: 'Medicamentos Complementares', key: 'medicamentos_complementares', path: 'd_diagnostico_principal.medicamentos_complementares' },
                ]},
                { title: 'Florais de Bach', fields: [
                  { label: 'Florais Indicados', key: 'florais_bach_indicados', path: 'd_diagnostico_principal.florais_bach_indicados' },
                  { label: 'Formula Floral Sugerida', key: 'formula_floral_sugerida', path: 'd_diagnostico_principal.formula_floral_sugerida' },
                ]},
                { title: 'Prognostico', fields: [
                  { label: 'Fatores Favoraveis', key: 'prognostico_fatores_favoraveis', path: 'd_diagnostico_principal.prognostico_fatores_favoraveis' },
                  { label: 'Fatores Desfavoraveis', key: 'prognostico_fatores_desfavoraveis', path: 'd_diagnostico_principal.prognostico_fatores_desfavoraveis' },
                  { label: 'Prob. Sucesso (Adesao Total)', key: 'prob_sucesso_adesao_total', path: 'd_diagnostico_principal.prob_sucesso_adesao_total' },
                  { label: 'Prob. Sucesso (Adesao Parcial)', key: 'prob_sucesso_adesao_parcial', path: 'd_diagnostico_principal.prob_sucesso_adesao_parcial' },
                  { label: 'Prob. Sucesso (Sem Adesao)', key: 'prob_sucesso_sem_adesao', path: 'd_diagnostico_principal.prob_sucesso_sem_adesao' },
                ]},
                { title: 'Alertas', fields: [
                  { label: 'Alertas Criticos', key: 'alertas_criticos', path: 'd_diagnostico_principal.alertas_criticos' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => diagnostico_principal[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = diagnostico_principal[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Estado Geral */}
      {viewPopupSection === 'estado_geral' && estado_geral && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>2. Estado Geral</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Avaliacao Global', fields: [
                  { label: 'Estado Geral', key: 'avaliacao_estado', path: 'd_estado_geral.avaliacao_estado' },
                  { label: 'Score de Vitalidade', key: 'avaliacao_score_vitalidade', path: 'd_estado_geral.avaliacao_score_vitalidade' },
                  { label: 'Tendencia', key: 'avaliacao_tendencia', path: 'd_estado_geral.avaliacao_tendencia' },
                  { label: 'Reserva Fisiologica', key: 'avaliacao_reserva_fisiologica', path: 'd_estado_geral.avaliacao_reserva_fisiologica' },
                ]},
                { title: 'Energia Vital', fields: [
                  { label: 'Nivel', key: 'energia_vital_nivel', path: 'd_estado_geral.energia_vital_nivel' },
                  { label: 'Descricao', key: 'energia_vital_descricao', path: 'd_estado_geral.energia_vital_descricao' },
                  { label: 'Manifestacao', key: 'energia_vital_manifestacao', path: 'd_estado_geral.energia_vital_manifestacao' },
                  { label: 'Impacto', key: 'energia_vital_impacto', path: 'd_estado_geral.energia_vital_impacto' },
                ]},
                { title: 'Adaptacao ao Stress', fields: [
                  { label: 'Nivel', key: 'adapt_stress_nivel', path: 'd_estado_geral.adapt_stress_nivel' },
                  { label: 'Descricao', key: 'adapt_stress_descricao', path: 'd_estado_geral.adapt_stress_descricao' },
                  { label: 'Reserva Adaptativa', key: 'adapt_stress_reserva_adaptativa', path: 'd_estado_geral.adapt_stress_reserva_adaptativa' },
                  { label: 'Manifestacao', key: 'adapt_stress_manifestacao', path: 'd_estado_geral.adapt_stress_manifestacao' },
                ]},
                { title: 'Resiliencia', fields: [
                  { label: 'Nivel', key: 'resiliencia_nivel', path: 'd_estado_geral.resiliencia_nivel' },
                  { label: 'Descricao', key: 'resiliencia_descricao', path: 'd_estado_geral.resiliencia_descricao' },
                  { label: 'Elasticidade', key: 'resiliencia_elasticidade', path: 'd_estado_geral.resiliencia_elasticidade' },
                  { label: 'Tempo de Recuperacao', key: 'resiliencia_tempo_recuperacao', path: 'd_estado_geral.resiliencia_tempo_recuperacao' },
                ]},
                { title: 'Observacao Clinica', fields: [
                  { label: 'Facies', key: 'obs_facies', path: 'd_estado_geral.obs_facies' },
                  { label: 'Postura', key: 'obs_postura', path: 'd_estado_geral.obs_postura' },
                  { label: 'Marcha', key: 'obs_marcha', path: 'd_estado_geral.obs_marcha' },
                  { label: 'Tonus Muscular', key: 'obs_tonus_muscular', path: 'd_estado_geral.obs_tonus_muscular' },
                  { label: 'Aparencia Geral', key: 'obs_aparencia_geral', path: 'd_estado_geral.obs_aparencia_geral' },
                  { label: 'Contato Visual', key: 'obs_contato_visual', path: 'd_estado_geral.obs_contato_visual' },
                  { label: 'Voz', key: 'obs_voz', path: 'd_estado_geral.obs_voz' },
                ]},
                { title: 'AVD', fields: [
                  { label: 'Autocuidado Basico', key: 'avd_autocuidado_basico', path: 'd_estado_geral.avd_autocuidado_basico' },
                  { label: 'Trabalho Profissional', key: 'avd_trabalho_profissional', path: 'd_estado_geral.avd_trabalho_profissional' },
                  { label: 'Cuidado com Filhos', key: 'avd_cuidado_filhos', path: 'd_estado_geral.avd_cuidado_filhos' },
                  { label: 'Tarefas Domesticas', key: 'avd_tarefas_domesticas', path: 'd_estado_geral.avd_tarefas_domesticas' },
                  { label: 'Lazer e Social', key: 'avd_lazer_social', path: 'd_estado_geral.avd_lazer_social' },
                  { label: 'Autocuidado Ampliado', key: 'avd_autocuidado_ampliado', path: 'd_estado_geral.avd_autocuidado_ampliado' },
                ]},
                { title: 'Funcionalidade e Qualidade de Vida', fields: [
                  { label: 'Score Karnofsky', key: 'funcionalidade_score_karnofsky', path: 'd_estado_geral.funcionalidade_score_karnofsky' },
                  { label: 'Limitacoes Funcionais', key: 'limitacoes_funcionais_especificas', path: 'd_estado_geral.limitacoes_funcionais_especificas' },
                  { label: 'WHOQOL Score Geral', key: 'whoqol_score_geral', path: 'd_estado_geral.whoqol_score_geral' },
                ]},
                { title: 'Sinais de Alerta e Evolucao', fields: [
                  { label: 'Sinais de Alerta', key: 'sinais_alerta_deterioracao', path: 'd_estado_geral.sinais_alerta_deterioracao' },
                  { label: 'Atual', key: 'evo_atual', path: 'd_estado_geral.evo_atual' },
                  { label: 'Projecao 6 Meses (Sem Intervencao)', key: 'projecao_6_meses_sem_intervencao', path: 'd_estado_geral.projecao_6_meses_sem_intervencao' },
                ]},
                { title: 'Impacto', fields: [
                  { label: 'Profissional', key: 'impacto_profissional', path: 'd_estado_geral.impacto_profissional' },
                  { label: 'Familiar', key: 'impacto_familiar', path: 'd_estado_geral.impacto_familiar' },
                  { label: 'Social', key: 'impacto_social', path: 'd_estado_geral.impacto_social' },
                  { label: 'Pessoal', key: 'impacto_pessoal', path: 'd_estado_geral.impacto_pessoal' },
                  { label: 'Saude', key: 'impacto_saude', path: 'd_estado_geral.impacto_saude' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => estado_geral[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = estado_geral[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Estado Mental */}
      {viewPopupSection === 'estado_mental' && estado_mental && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>3. Estado Mental</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Memoria', fields: [
                  { label: 'Curto Prazo', key: 'memoria_curto_prazo', path: 'd_estado_mental.memoria_curto_prazo' },
                  { label: 'Longo Prazo', key: 'memoria_longo_prazo', path: 'd_estado_mental.memoria_longo_prazo' },
                  { label: 'De Trabalho', key: 'memoria_de_trabalho', path: 'd_estado_mental.memoria_de_trabalho' },
                  { label: 'Score', key: 'memoria_score', path: 'd_estado_mental.memoria_score' },
                ]},
                { title: 'Atencao', fields: [
                  { label: 'Sustentada', key: 'atencao_sustentada', path: 'd_estado_mental.atencao_sustentada' },
                  { label: 'Seletiva', key: 'atencao_seletiva', path: 'd_estado_mental.atencao_seletiva' },
                  { label: 'Score', key: 'atencao_score', path: 'd_estado_mental.atencao_score' },
                ]},
                { title: 'Funcoes Executivas', fields: [
                  { label: 'Planejamento', key: 'exec_planejamento', path: 'd_estado_mental.exec_planejamento' },
                  { label: 'Organizacao', key: 'exec_organizacao', path: 'd_estado_mental.exec_organizacao' },
                  { label: 'Tomada de Decisao', key: 'exec_tomada_decisao', path: 'd_estado_mental.exec_tomada_decisao' },
                  { label: 'Score', key: 'exec_score', path: 'd_estado_mental.exec_score' },
                ]},
                { title: 'Humor e Afeto', fields: [
                  { label: 'Tipo de Humor', key: 'humor_tipo', path: 'd_estado_mental.humor_tipo' },
                  { label: 'Intensidade', key: 'humor_intensidade', path: 'd_estado_mental.humor_intensidade' },
                  { label: 'Variabilidade', key: 'humor_variabilidade', path: 'd_estado_mental.humor_variabilidade' },
                  { label: 'Expressao do Afeto', key: 'afeto_expressao', path: 'd_estado_mental.afeto_expressao' },
                ]},
                { title: 'Ansiedade', fields: [
                  { label: 'Nivel', key: 'ansiedade_nivel', path: 'd_estado_mental.ansiedade_nivel' },
                  { label: 'Tipo Predominante', key: 'ansiedade_tipo_predominante', path: 'd_estado_mental.ansiedade_tipo_predominante' },
                  { label: 'Score GAD-7', key: 'ansiedade_score_gad7_estimado', path: 'd_estado_mental.ansiedade_score_gad7_estimado' },
                ]},
                { title: 'PHQ-9 (Depressao)', fields: [
                  { label: 'Humor Deprimido', key: 'phq9_humor_deprimido', path: 'd_estado_mental.phq9_humor_deprimido' },
                  { label: 'Anedonia', key: 'phq9_anedonia', path: 'd_estado_mental.phq9_anedonia' },
                  { label: 'Fadiga', key: 'phq9_fadiga', path: 'd_estado_mental.phq9_fadiga' },
                  { label: 'Score PHQ-9', key: 'phq9_score_estimado', path: 'd_estado_mental.phq9_score_estimado' },
                ]},
                { title: 'Autoestima', fields: [
                  { label: 'Autoestima Global', key: 'autoestima_global', path: 'd_estado_mental.autoestima_global' },
                  { label: 'Autopercepcao', key: 'autopercepcao', path: 'd_estado_mental.autopercepcao' },
                  { label: 'Autoeficacia', key: 'autoeficacia', path: 'd_estado_mental.autoeficacia' },
                ]},
                { title: 'Risco de Suicidio', fields: [
                  { label: 'Nivel de Risco', key: 'risco_nivel', path: 'd_estado_mental.risco_nivel' },
                  { label: 'Ideacao', key: 'risco_ideacao', path: 'd_estado_mental.risco_ideacao' },
                  { label: 'Acao Requerida', key: 'risco_acao_requerida', path: 'd_estado_mental.risco_acao_requerida' },
                ]},
                { title: 'Diagnosticos e Intervencoes', fields: [
                  { label: 'Diagnosticos DSM-5', key: 'diagnosticos_mentais_dsm5_sugeridos', path: 'd_estado_mental.diagnosticos_mentais_dsm5_sugeridos' },
                  { label: 'Psicoterapia', key: 'intervencao_psicoterapia', path: 'd_estado_mental.intervencao_psicoterapia' },
                  { label: 'Psiquiatria', key: 'intervencao_psiquiatria', path: 'd_estado_mental.intervencao_psiquiatria' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => estado_mental[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = estado_mental[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Estado Fisiologico */}
      {viewPopupSection === 'estado_fisiologico' && estado_fisiologico && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>4. Estado Fisiologico</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Tireoide', fields: [
                  { label: 'Status', key: 'end_tireo_status', path: 'd_estado_fisiologico.end_tireo_status' },
                  { label: 'Diagnostico', key: 'end_tireo_diagnostico', path: 'd_estado_fisiologico.end_tireo_diagnostico' },
                  { label: 'Acao', key: 'end_tireo_acao_terapeutica', path: 'd_estado_fisiologico.end_tireo_acao_terapeutica' },
                ]},
                { title: 'Insulina/Glicose', fields: [
                  { label: 'Status', key: 'end_insgl_status', path: 'd_estado_fisiologico.end_insgl_status' },
                  { label: 'Diagnostico', key: 'end_insgl_diagnostico', path: 'd_estado_fisiologico.end_insgl_diagnostico' },
                  { label: 'Acao', key: 'end_insgl_acao_terapeutica', path: 'd_estado_fisiologico.end_insgl_acao_terapeutica' },
                ]},
                { title: 'Intestino', fields: [
                  { label: 'Status', key: 'gi_int_status', path: 'd_estado_fisiologico.gi_int_status' },
                  { label: 'Diagnostico', key: 'gi_int_diagnostico', path: 'd_estado_fisiologico.gi_int_diagnostico' },
                  { label: 'Acao', key: 'gi_int_acao_prioritaria', path: 'd_estado_fisiologico.gi_int_acao_prioritaria' },
                ]},
                { title: 'Cardiovascular', fields: [
                  { label: 'Status', key: 'cv_status', path: 'd_estado_fisiologico.cv_status' },
                  { label: 'Pressao', key: 'cv_pressao_arterial', path: 'd_estado_fisiologico.cv_pressao_arterial' },
                  { label: 'Acao', key: 'cv_acao', path: 'd_estado_fisiologico.cv_acao' },
                ]},
                { title: 'Inflamacao', fields: [
                  { label: 'Nivel Inflamacao', key: 'infl_sist_nivel', path: 'd_estado_fisiologico.infl_sist_nivel' },
                  { label: 'Causas', key: 'infl_sist_causas', path: 'd_estado_fisiologico.infl_sist_causas' },
                  { label: 'Estresse Oxidativo', key: 'oxi_nivel', path: 'd_estado_fisiologico.oxi_nivel' },
                ]},
                { title: 'Exames', fields: [
                  { label: 'Urgente', key: 'exames_urgente_0_15_dias', path: 'd_estado_fisiologico.exames_urgente_0_15_dias' },
                  { label: 'Alta Prioridade', key: 'exames_alta_prioridade_30_dias', path: 'd_estado_fisiologico.exames_alta_prioridade_30_dias' },
                  { label: 'Media Prioridade', key: 'exames_media_prioridade_60_90_dias', path: 'd_estado_fisiologico.exames_media_prioridade_60_90_dias' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => estado_fisiologico[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = estado_fisiologico[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Integracao Diagnostica */}
      {viewPopupSection === 'integracao_diagnostica' && integracao_diagnostica && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>5. Integracao Diagnostica</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Diagnostico Integrado', fields: [
                  { label: 'Titulo', key: 'diagnostico_titulo', path: 'd_agente_integracao_diagnostica.diagnostico_titulo' },
                  { label: 'CID Primario', key: 'diagnostico_cid_primario', path: 'd_agente_integracao_diagnostica.diagnostico_cid_primario' },
                  { label: 'CIDs Associados', key: 'diagnostico_cids_associados', path: 'd_agente_integracao_diagnostica.diagnostico_cids_associados' },
                  { label: 'Sintese Executiva', key: 'diagnostico_sintese_executiva', path: 'd_agente_integracao_diagnostica.diagnostico_sintese_executiva' },
                ]},
                { title: 'Metafora da Casa', fields: [
                  { label: 'Fundacao Status', key: 'fundacao_status', path: 'd_agente_integracao_diagnostica.fundacao_status' },
                  { label: 'Fundacao Eventos', key: 'fundacao_eventos', path: 'd_agente_integracao_diagnostica.fundacao_eventos' },
                  { label: 'Colunas Status', key: 'colunas_status', path: 'd_agente_integracao_diagnostica.colunas_status' },
                  { label: 'Colunas Eventos', key: 'colunas_eventos', path: 'd_agente_integracao_diagnostica.colunas_eventos' },
                  { label: 'Cumeeira Status', key: 'cumeeira_status', path: 'd_agente_integracao_diagnostica.cumeeira_status' },
                  { label: 'Cumeeira Eventos', key: 'cumeeira_eventos', path: 'd_agente_integracao_diagnostica.cumeeira_eventos' },
                ]},
                { title: 'Diagnosticos Especificos', fields: [
                  { label: 'Biologico', key: 'diagnostico_biologico', path: 'd_agente_integracao_diagnostica.diagnostico_biologico' },
                  { label: 'Emocional', key: 'diagnostico_emocional', path: 'd_agente_integracao_diagnostica.diagnostico_emocional' },
                  { label: 'Social', key: 'diagnostico_social', path: 'd_agente_integracao_diagnostica.diagnostico_social' },
                  { label: 'Energetico', key: 'diagnostico_energetico', path: 'd_agente_integracao_diagnostica.diagnostico_energetico' },
                  { label: 'Espiritual', key: 'diagnostico_espiritual', path: 'd_agente_integracao_diagnostica.diagnostico_espiritual' },
                ]},
                { title: 'Confianca', fields: [
                  { label: 'Nivel', key: 'nivel_confianca_diagnostico', path: 'd_agente_integracao_diagnostica.nivel_confianca_diagnostico' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => integracao_diagnostica[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = integracao_diagnostica[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}

      {/* Popup Habitos de Vida */}
      {viewPopupSection === 'habitos_vida' && habitos_vida && (
        <div onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>6. Habitos de Vida (5 Pilares)</h3>
              </div>
              <button onClick={() => { setViewPopupSection(null); setEditingField(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {[
                { title: 'Alimentacao', fields: [
                  { label: 'Status', key: 'pilar1_alimentacao_status_global', path: 'd_agente_habitos_vida_sistemica.pilar1_alimentacao_status_global' },
                  { label: 'Score', key: 'pilar1_alimentacao_score_qualidade', path: 'd_agente_habitos_vida_sistemica.pilar1_alimentacao_score_qualidade' },
                  { label: 'Problemas', key: 'pilar1_alimentacao_problemas_identificados', path: 'd_agente_habitos_vida_sistemica.pilar1_alimentacao_problemas_identificados' },
                  { label: 'Intervencao', key: 'pilar1_intervencao_requerida_nutricional', path: 'd_agente_habitos_vida_sistemica.pilar1_intervencao_requerida_nutricional' },
                ]},
                { title: 'Atividade Fisica', fields: [
                  { label: 'Status', key: 'pilar2_atividade_fisica_status_global', path: 'd_agente_habitos_vida_sistemica.pilar2_atividade_fisica_status_global' },
                  { label: 'Score', key: 'pilar2_atividade_fisica_score', path: 'd_agente_habitos_vida_sistemica.pilar2_atividade_fisica_score' },
                  { label: 'Padrao', key: 'pilar2_padrao_pratica_exercicio', path: 'd_agente_habitos_vida_sistemica.pilar2_padrao_pratica_exercicio' },
                  { label: 'Prescricao', key: 'pilar2_prescricao_fase1_objetivo', path: 'd_agente_habitos_vida_sistemica.pilar2_prescricao_fase1_objetivo' },
                ]},
                { title: 'Sono', fields: [
                  { label: 'Status', key: 'pilar3_sono_status_global', path: 'd_agente_habitos_vida_sistemica.pilar3_sono_status_global' },
                  { label: 'Score', key: 'pilar3_sono_score', path: 'd_agente_habitos_vida_sistemica.pilar3_sono_score' },
                  { label: 'Qualidade', key: 'pilar3_padrao_qualidade_subjetiva', path: 'd_agente_habitos_vida_sistemica.pilar3_padrao_qualidade_subjetiva' },
                  { label: 'Intervencao', key: 'pilar3_intervencao_prioridade', path: 'd_agente_habitos_vida_sistemica.pilar3_intervencao_prioridade' },
                ]},
                { title: 'Gestao de Stress', fields: [
                  { label: 'Status', key: 'pilar4_stress_status_global', path: 'd_agente_habitos_vida_sistemica.pilar4_stress_status_global' },
                  { label: 'Score', key: 'pilar4_stress_score', path: 'd_agente_habitos_vida_sistemica.pilar4_stress_score' },
                  { label: 'Nivel', key: 'pilar4_stress_nivel_atual', path: 'd_agente_habitos_vida_sistemica.pilar4_stress_nivel_atual' },
                  { label: 'Fontes', key: 'pilar4_fontes_stress_profissional', path: 'd_agente_habitos_vida_sistemica.pilar4_fontes_stress_profissional' },
                ]},
                { title: 'Espiritualidade', fields: [
                  { label: 'Status', key: 'pilar5_espiritualidade_status_global', path: 'd_agente_habitos_vida_sistemica.pilar5_espiritualidade_status_global' },
                  { label: 'Score', key: 'pilar5_espiritualidade_score', path: 'd_agente_habitos_vida_sistemica.pilar5_espiritualidade_score' },
                  { label: 'Praticas', key: 'pilar5_espiritualidade_praticas_atuais', path: 'd_agente_habitos_vida_sistemica.pilar5_espiritualidade_praticas_atuais' },
                ]},
                { title: 'Ritmo Circadiano', fields: [
                  { label: 'Status', key: 'ritmo_circadiano_status', path: 'd_agente_habitos_vida_sistemica.ritmo_circadiano_status' },
                  { label: 'Problemas', key: 'ritmo_circadiano_problemas', path: 'd_agente_habitos_vida_sistemica.ritmo_circadiano_problemas' },
                  { label: 'Impacto', key: 'ritmo_circadiano_impacto', path: 'd_agente_habitos_vida_sistemica.ritmo_circadiano_impacto' },
                ]},
                { title: 'Resumo', fields: [
                  { label: 'Score Geral', key: 'score_habitos_vida_geral', path: 'd_agente_habitos_vida_sistemica.score_habitos_vida_geral' },
                  { label: 'Prioridades', key: 'prioridades_intervencao_habitos', path: 'd_agente_habitos_vida_sistemica.prioridades_intervencao_habitos' },
                ]},
              ].map((section) => {
                const hasData = section.fields.some(f => habitos_vida[f.key]);
                if (!hasData) return null;
                return (<div key={section.title} style={{ marginBottom: 24 }}><h4 style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', textAlign: 'center' as const }}>{section.title}</h4><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.8 }}>{section.fields.map((field) => { const value = habitos_vida[field.key]; if (!value) return null; const isEditing = editingField === field.path; return (<div key={field.key} style={{ marginBottom: 8 }}>{isEditing ? (<div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div><textarea value={editingValue} onChange={e => setEditingValue(e.target.value)} autoFocus onKeyDown={async (e) => { if (e.key === 'Escape') setEditingField(null); }} style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }} /><div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}><button onClick={() => setEditingField(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button><button onClick={async () => { await handleSaveField(field.path, editingValue, consultaId); setEditingField(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button></div></div>) : (<div style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', transition: 'background 0.15s', borderLeft: '2px solid #E2E8F0' }} onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; e.currentTarget.style.borderLeftColor = '#1B4266'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = '#E2E8F0'; }} onClick={() => { setEditingField(field.path); setEditingValue(String(value || '')); }} title={'Editar: ' + field.label}><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div><div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{cleanText(value)}</div></div>)}</div>); })}</div></div>);
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Interface para Higiene e Sono
interface HigieneSono {
  horario_dormir_recomendado: string;
  horario_acordar_recomendado: string;
  duracao_alvo: string;
  janela_sono_semana: string;
  janela_sono_fds: string;
  consistencia_horario: string;
  rotina_pre_sono: string[];
  gatilhos_evitar: string[];
  progressao_ajuste: string;
  observacoes_clinicas: string;
}

// Interface para Padrão Mental/Emocional
interface OrientacaoTransformacao {
  nome: string;
  passo: number;
  como_fazer: string;
  o_que_fazer: string;
  porque_funciona: string;
}

interface PadraoItem {
  padrao: string;
  categorias: string[];
  prioridade: number;
  areas_impacto: string[];
  origem_estimada: {
    periodo: string;
    contexto_provavel: string;
  };
  conexoes_padroes: {
    raiz_de: string[];
    explicacao: string;
    alimentado_por: string[];
    relacionado_com: string[];
  };
  manifestacoes_atuais: string[];
  orientacoes_transformacao: OrientacaoTransformacao[];
}

// Componente da seção de Solução Livro da Vida
function MentalidadeSection({
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange,
  mentalidadeData
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
  mentalidadeData?: any;
}) {
  const { showError } = useNotifications();

  // Estados para carregamento dinâmico
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados ao montar o componente
  useEffect(() => {
    loadMentalidadeData();
  }, [consultaId]);

  // Sync com a prop vinda do pai
  useEffect(() => {
    if (mentalidadeData) {
      console.log('🔄 [MentalidadeSection] Atualizando com dados da prop:', mentalidadeData);
      const data = mentalidadeData.mentalidade_data || mentalidadeData;

      setLivroVidaData({
        resumo_executivo: data.resumo_executivo || '',
        higiene_sono: data.higiene_sono || null,
        padrao_01: data.padrao_01 || null,
        padrao_02: data.padrao_02 || null,
        padrao_03: data.padrao_03 || null,
        padrao_04: data.padrao_04 || null,
        padrao_05: data.padrao_05 || null,
        padrao_06: data.padrao_06 || null,
        padrao_07: data.padrao_07 || null,
        padrao_08: data.padrao_08 || null,
        padrao_09: data.padrao_09 || null,
        padrao_10: data.padrao_10 || null
      });
      setLoading(false);
      setLoadingDetails(false);
    }
  }, [mentalidadeData]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadMentalidadeData();
    };

    window.addEventListener('mentalidade-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('mentalidade-data-refresh', handleRefresh);
    };
  }, []);

  const loadMentalidadeData = async () => {
    try {
      setLoadingDetails(true);
      setError(null);

      console.log('🔍 [FRONTEND-LTV] Carregando dados de mentalidade para consulta:', consultaId);

      const response = await gatewayClient.get(`/solucao-mentalidade/${consultaId}`);

      console.log('📡 [FRONTEND-LTV] Response status:', response.status);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar dados de mentalidade');
      }

      const data = response;
      console.log('✅ [FRONTEND-LTV] Dados recebidos:', data);

      if (data.mentalidade_data) {
        setLivroVidaData({
          resumo_executivo: data.mentalidade_data.resumo_executivo || '',
          higiene_sono: data.mentalidade_data.higiene_sono || null,
          padrao_01: data.mentalidade_data.padrao_01 || null,
          padrao_02: data.mentalidade_data.padrao_02 || null,
          padrao_03: data.mentalidade_data.padrao_03 || null,
          padrao_04: data.mentalidade_data.padrao_04 || null,
          padrao_05: data.mentalidade_data.padrao_05 || null,
          padrao_06: data.mentalidade_data.padrao_06 || null,
          padrao_07: data.mentalidade_data.padrao_07 || null,
          padrao_08: data.mentalidade_data.padrao_08 || null,
          padrao_09: data.mentalidade_data.padrao_09 || null,
          padrao_10: data.mentalidade_data.padrao_10 || null
        });
      }
      setLoading(false);
    } catch (err) {
      console.error('❌ [FRONTEND-LTV] Erro ao carregar mentalidade:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar mentalidade');
      setLoading(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Dados mockados como fallback (mantido para compatibilidade)
  const mockData: any = {};;

  // Parsear os dados mockados - os padrões 03-08 vêm do JSON fornecido

  // @ts-ignore - mockData will be replaced by dynamic data from API
  const [livroVidaData, setLivroVidaData] = useState<{
    resumo_executivo: string;
    higiene_sono: HigieneSono;
    padrao_01: PadraoItem | null;
    padrao_02: PadraoItem | null;
    padrao_03: PadraoItem | null;
    padrao_04: PadraoItem | null;
    padrao_05: PadraoItem | null;
    padrao_06: PadraoItem | null;
    padrao_07: PadraoItem | null;
    padrao_08: PadraoItem | null;
    padrao_09: PadraoItem | null;
    padrao_10: PadraoItem | null;
  }>({
    resumo_executivo: '',
    higiene_sono: { horario_dormir_recomendado: '', horario_acordar_recomendado: '', duracao_alvo: '', janela_sono_semana: '', janela_sono_fds: '', consistencia_horario: '', rotina_pre_sono: [], gatilhos_evitar: [], progressao_ajuste: '', observacoes_clinicas: '' },
    padrao_01: null,
    padrao_02: null,
    padrao_03: null,
    padrao_04: null,
    padrao_05: null,
    padrao_06: null,
    padrao_07: null,
    padrao_08: null,
    padrao_09: null,
    padrao_10: null
  });

  const [viewLivroPopup, setViewLivroPopup] = useState<{ type: 'resumo' | 'higiene_sono' | 'padrao'; padraoNum?: number } | null>(null);
  const [livroEditingPath, setLivroEditingPath] = useState<string | null>(null);
  const [livroEditingValue, setLivroEditingValue] = useState('');

  // Estados para edição (mantidos temporariamente para compatibilidade com renderEditableField)
  const [editingField, setEditingField] = useState<{
    type: 'resumo' | 'higiene_sono' | 'padrao';
    padraoNum?: number;
    fieldPath?: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Função para salvar campo editado
  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Atualizar no Gateway
      const response = await gatewayClient.post(`/solucao-mentalidade/${consultaId}/update-field`, {
        fieldPath,
        value: newValue,
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarregar dados após salvar
      await loadMentalidadeData();
    } catch (error) {
      console.error('❌ Erro ao salvar campo:', error);
      showError('Erro ao salvar alteração. Tente novamente.', 'Erro');
      throw error;
    }
  };

  // Função para editar com IA
  const handleAIEdit = (fieldPath: string, label: string) => {
    if (onFieldSelect) {
      onFieldSelect(fieldPath, label);
    }
  };

  // Função auxiliar para formatar valor para DataField
  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Função auxiliar para obter valor de campo aninhado (mantida para compatibilidade durante refatoração)
  const getNestedValue = (obj: any, path: string): any => {
    if (path.includes('.')) {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return null;
        }
        // Verificar se é um índice de array
        const arrayIndex = parseInt(part);
        if (!isNaN(arrayIndex) && Array.isArray(current)) {
          current = current[arrayIndex];
        } else if (typeof current === 'object') {
          current = current[part];
        } else {
          return null;
        }
      }
      return current;
    }
    return obj ? obj[path] : null;
  };

  // Função para iniciar edição
  const handleStartEdit = (type: 'resumo' | 'higiene_sono' | 'padrao', padraoNum?: number, fieldPath?: string) => {
    setEditingField({ type, padraoNum, fieldPath });
    if (type === 'resumo') {
      setEditValue(livroVidaData.resumo_executivo);
    } else if (type === 'higiene_sono' && fieldPath) {
      const value = getNestedValue(livroVidaData.higiene_sono, fieldPath);
      setEditValue(value === null || value === undefined ? '' :
        typeof value === 'string' ? value :
          Array.isArray(value) ? value.join('\n') :
            JSON.stringify(value, null, 2));
    } else if (padraoNum && fieldPath) {
      const padrao = livroVidaData[`padrao_${String(padraoNum).padStart(2, '0')}` as keyof typeof livroVidaData] as PadraoItem | null;
      if (padrao) {
        const value = getNestedValue(padrao, fieldPath);
        setEditValue(value === null || value === undefined ? '' :
          typeof value === 'string' ? value :
            typeof value === 'number' ? value.toString() :
              Array.isArray(value) ? value.join('\n') :
                JSON.stringify(value, null, 2));
      }
    }
  };

  // Função para definir valor em campo aninhado
  const setNestedValue = (obj: any, path: string, value: any): void => {
    if (path.includes('.')) {
      // @ts-ignore
      const parts = path.split('.');
      const lastPart = parts.pop()!;
      let current = obj;
      for (const part of parts) {
        // Verificar se é um índice de array
        const arrayIndex = parseInt(part);
        if (!isNaN(arrayIndex)) {
          if (!Array.isArray(current)) {
            current = [];
          }
          if (!current[arrayIndex]) {
            current[arrayIndex] = {};
          }
          current = current[arrayIndex];
        } else {
          if (!current[part] || (typeof current[part] !== 'object' && !Array.isArray(current[part]))) {
            current[part] = {};
          }
          current = current[part];
        }
      }
      // Verificar se o último parte é um número (índice de array)
      const lastArrayIndex = parseInt(lastPart);
      if (!isNaN(lastArrayIndex) && Array.isArray(current)) {
        current[lastArrayIndex] = value;
      } else {
        current[lastPart] = value;
      }
    } else {
      obj[path] = value;
    }
  };

  // Função para salvar edição
  const handleSaveEdit = async () => {
    if (!editingField) return;

    try {
      setLoadingDetails(true);

      const newData = { ...livroVidaData };
      let fieldName = '';
      let valueToSave: any = editValue;

      if (editingField.type === 'resumo') {
        fieldName = 'resumo_executivo';
        valueToSave = editValue;
        newData.resumo_executivo = editValue;
      } else if (editingField.type === 'higiene_sono' && editingField.fieldPath) {
        const fieldPath = editingField.fieldPath;
        let finalValue: any = editValue;

        // Verificar se o campo original era array
        const originalValue = getNestedValue(newData.higiene_sono, fieldPath);
        if (Array.isArray(originalValue)) {
          finalValue = editValue.split('\n').filter((line: string) => line.trim());
        }

        // Atualizar estado local
        setNestedValue(newData.higiene_sono, fieldPath, finalValue);

        // Definir caminho específico para salvar apenas este campo
        fieldName = `higiene_sono.${fieldPath}`;
        valueToSave = finalValue;
      } else if (editingField.padraoNum && editingField.fieldPath) {
        const padraoNum = editingField.padraoNum;
        const padraoKeyPart = `padrao_${String(padraoNum).padStart(2, '0')}`;
        const padraoKey = padraoKeyPart as keyof typeof newData;
        const padrao = { ...(newData[padraoKey] as PadraoItem) };

        if (padrao) {
          const fieldPath = editingField.fieldPath;
          let finalValue: any = editValue;

          // Verificar se o campo original era array
          const originalValue = getNestedValue(padrao, fieldPath);
          if (Array.isArray(originalValue)) {
            finalValue = editValue.split('\n').filter((line: string) => line.trim());
          } else if (typeof originalValue === 'number') {
            finalValue = parseFloat(editValue) || 0;
          }

          // Atualizar estado local
          setNestedValue(padrao, fieldPath, finalValue);
          (newData as any)[padraoKey] = padrao;

          // Definir caminho específico para salvar apenas este campo
          fieldName = `${padraoKeyPart}.${fieldPath}`;
          valueToSave = finalValue;
        }
      }

      // Atualizar estado local primeiro (UX responsivo)
      setLivroVidaData(newData);
      setEditingField(null);
      setEditValue('');

      // Salvar no Gateway
      console.log('💾 [FRONTEND-LTV] Salvando campo:', { fieldName, valueToSave });

      const response = await gatewayClient.post(`/solucao-mentalidade/${consultaId}/update-field`, {
        fieldPath: `mentalidade_data.${fieldName}`,
        value: valueToSave
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar alteração');
      }

      console.log('✅ [FRONTEND-LTV] Campo salvo com sucesso no banco');

    } catch (error) {
      console.error('❌ [FRONTEND-LTV] Erro ao salvar campo:', error);
      showError('Erro ao salvar alteração. Tente novamente.', 'Erro');

      // Recarregar dados para sincronizar com o banco
      await loadMentalidadeData();
    } finally {
      setLoadingDetails(false);
    }
  };

  // Função para cancelar edição
  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Função para renderizar campo editável
  const renderEditableField = (
    label: string,
    value: string | string[] | object | null,
    type: 'resumo' | 'higiene_sono' | 'padrao',
    padraoNum?: number,
    fieldPath?: string
  ) => {
    const isEditing = editingField?.type === type &&
      editingField?.padraoNum === padraoNum &&
      editingField?.fieldPath === fieldPath;

    // Função auxiliar para verificar se o valor é vazio/null
    const isEmptyValue = (val: any): boolean => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && (val.trim() === '' || val.toLowerCase() === 'null')) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    };

    let displayValue: string;
    if (isEmptyValue(value)) {
      displayValue = 'Não informado';
    } else if (Array.isArray(value)) {
      // Filtrar valores null/vazios do array e substituir por "Não informado"
      displayValue = value.map(item => isEmptyValue(item) ? 'Não informado' : String(item)).join(', ');
    } else if (typeof value === 'object') {
      displayValue = JSON.stringify(value, null, 2);
    } else {
      const stringValue = String(value);
      displayValue = (stringValue.toLowerCase() === 'null' || stringValue.trim() === '')
        ? 'Não informado'
        : stringValue;
    }

    if (isEditing) {
      return (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{label}</label>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={loadingDetails}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              opacity: loadingDetails ? 0.6 : 1
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={handleSaveEdit}
              disabled={loadingDetails}
              style={{
                padding: '8px 16px',
                background: loadingDetails ? '#9ca3af' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingDetails ? 'not-allowed' : 'pointer',
                opacity: loadingDetails ? 0.7 : 1
              }}
            >
              {loadingDetails ? (
                <>
                  <div className="loading-spinner-small" style={{ display: 'inline-block', marginRight: '5px' }}></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 inline mr-1" />
                  Salvar
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={loadingDetails}
              style={{
                padding: '8px 16px',
                background: loadingDetails ? '#9ca3af' : '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingDetails ? 'not-allowed' : 'pointer',
                opacity: loadingDetails ? 0.7 : 1
              }}
            >
              <X className="w-4 h-4 inline mr-1" />
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    // Construir o fieldPath completo para o webhook
    let fullFieldPath = '';
    if (type === 'resumo') {
      fullFieldPath = 'mentalidade_data.resumo_executivo';
    } else if (type === 'higiene_sono' && fieldPath) {
      fullFieldPath = `mentalidade_data.higiene_sono.${fieldPath}`;
    } else if (type === 'padrao' && padraoNum && fieldPath) {
      fullFieldPath = `mentalidade_data.padrao_${String(padraoNum).padStart(2, '0')}.${fieldPath}`;
    }

    return (
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{label}</label>
          <div style={{
            padding: '10px',
            background: '#f9f9f9',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {displayValue}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '25px' }}>
          {onFieldSelect && fullFieldPath && (
            <button
              onClick={() => onFieldSelect(fullFieldPath, label)}
              style={{
                padding: '5px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#666'
              }}
              title="Editar com IA"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleStartEdit(type, padraoNum, fieldPath)}
            style={{
              padding: '5px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#666'
            }}
            title="Editar manualmente"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Função para renderizar seção de Higiene e Sono - texto corrido
  const renderHigieneSono = () => {
    const h = livroVidaData.higiene_sono;
    const fields = [
      { label: 'Dormir', value: h.horario_dormir_recomendado },
      { label: 'Acordar', value: h.horario_acordar_recomendado },
      { label: 'Duracao', value: h.duracao_alvo },
      { label: 'Semana', value: h.janela_sono_semana },
      { label: 'Fins de Semana', value: h.janela_sono_fds },
      { label: 'Consistencia', value: h.consistencia_horario },
      { label: 'Rotina Pre-Sono', value: formatValueForDataField(h.rotina_pre_sono) },
      { label: 'Gatilhos a Evitar', value: formatValueForDataField(h.gatilhos_evitar) },
      { label: 'Progressao', value: h.progressao_ajuste },
      { label: 'Observacoes', value: h.observacoes_clinicas },
    ].filter(f => f.value);

    return (
      <CollapsibleSection title="Higiene e Sono" defaultOpen={true}>
        <div onClick={() => setViewLivroPopup({ type: 'higiene_sono' })} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
          {fields.length > 0 ? (
            <>
              {fields.map((f, i) => (
                <div key={i} style={{ marginBottom: 6 }}><strong style={{ color: '#1B4266', fontSize: 12 }}>{f.label}:</strong> {cleanText(f.value)}</div>
              ))}
              
            </>
          ) : (
            <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel.</span>
          )}
        </div>
      </CollapsibleSection>
    );
  };

  // Funcao para renderizar um padrao - texto corrido
  const renderPadrao = (padrao: PadraoItem | null, numero: number) => {
    if (!padrao) return null;

    const padraoKey = `padrao_${String(numero).padStart(2, '0')}`;

    const allFields = [
      { label: 'Padrao', value: padrao.padrao },
      { label: 'Categorias', value: formatValueForDataField(padrao.categorias) },
      { label: 'Prioridade', value: padrao.prioridade },
      { label: 'Areas de Impacto', value: formatValueForDataField(padrao.areas_impacto) },
      { label: 'Periodo', value: padrao.origem_estimada?.periodo },
      { label: 'Contexto', value: padrao.origem_estimada?.contexto_provavel },
      { label: 'Raiz de', value: formatValueForDataField(padrao.conexoes_padroes?.raiz_de) },
      { label: 'Explicacao', value: padrao.conexoes_padroes?.explicacao },
      { label: 'Alimentado por', value: formatValueForDataField(padrao.conexoes_padroes?.alimentado_por) },
      { label: 'Manifestacoes', value: formatValueForDataField(padrao.manifestacoes_atuais) },
    ].filter(f => f.value);

    const orientacoes = padrao.orientacoes_transformacao || [];

    return (
      <CollapsibleSection title={`Padrao ${numero}: ${padrao.padrao}`} defaultOpen={numero <= 2}>
        <div onClick={() => setViewLivroPopup({ type: 'padrao', padraoNum: numero })} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 600, overflowY: 'auto' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
          {/* Info basica */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>Informacoes e Origem</div>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
              {allFields.map((f, i) => (
                <div key={i} style={{ marginBottom: 8 }}><strong style={{ color: '#0F172A' }}>{f.label}:</strong> {cleanText(f.value)}</div>
              ))}
            </div>
          </div>

          {/* Orientacoes */}
          {orientacoes.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, textAlign: 'center' as const, paddingBottom: 8, borderBottom: '2px solid #EBF3F6' }}>Orientacoes de Transformacao</div>
              {orientacoes.map((o, idx) => (
                <div key={idx} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid #E2E8F0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Passo {o.passo}: {o.nome}</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                    {o.o_que_fazer && <><strong>O que fazer:</strong> {o.o_que_fazer} </>}
                    {o.como_fazer && <><strong>Como fazer:</strong> {o.como_fazer} </>}
                    {o.porque_funciona && <><strong>Por que funciona:</strong> {o.porque_funciona}</>}
                  </div>
                </div>
              ))}
            </div>
          )}

          
        </div>
      </CollapsibleSection>
    );
  };

  // Mostrar loading no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados do Livro da Vida...</p>
      </div>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="anamnese-error">
        <p style={{ color: '#f44336' }}>❌ {error}</p>
        <button
          onClick={loadMentalidadeData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!livroVidaData) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados do Livro da Vida...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* Resumo Executivo */}
      <CollapsibleSection title="Resumo Executivo" defaultOpen={true}>
        <div onClick={() => setViewLivroPopup({ type: 'resumo' })} style={{ cursor: 'pointer', fontSize: 14, color: '#0F172A', lineHeight: 1.9, padding: '20px 24px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #E2E8F0', transition: 'border-color 0.2s', maxHeight: 500, overflowY: 'auto', position: 'relative' as any }} onMouseEnter={e => e.currentTarget.style.borderColor = '#1B4266'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky' as any, top: 0, zIndex: 10, background: 'transparent', paddingTop: 2, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#1B4266', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#EBF3F6', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Expandir e Editar
              </span>
            </div>
          {livroVidaData.resumo_executivo ? (
            <>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>{livroVidaData.resumo_executivo}</div>
              
            </>
          ) : (
            <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado disponivel. Clique para editar.</span>
          )}
        </div>
      </CollapsibleSection>

      {/* Higiene e Sono */}
      {renderHigieneSono()}

      {/* Padrões */}
      {renderPadrao(livroVidaData.padrao_01, 1)}
      {renderPadrao(livroVidaData.padrao_02, 2)}
      {renderPadrao(livroVidaData.padrao_03, 3)}
      {renderPadrao(livroVidaData.padrao_04, 4)}
      {renderPadrao(livroVidaData.padrao_05, 5)}
      {renderPadrao(livroVidaData.padrao_06, 6)}
      {renderPadrao(livroVidaData.padrao_07, 7)}
      {renderPadrao(livroVidaData.padrao_08, 8)}
      {renderPadrao(livroVidaData.padrao_09, 9)}
      {renderPadrao(livroVidaData.padrao_10, 10)}

      {/* Popup de visualizacao/edicao do Livro da Vida */}
      {viewLivroPopup && (
        <div onClick={() => { setViewLivroPopup(null); setLivroEditingPath(null); }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 800,
            maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {viewLivroPopup.type === 'resumo' ? 'Resumo Executivo' : viewLivroPopup.type === 'higiene_sono' ? 'Higiene e Sono' : `Padrao ${viewLivroPopup.padraoNum}`}
              </h3>
              <button onClick={() => { setViewLivroPopup(null); setLivroEditingPath(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {(() => {
                // Build fields based on type
                let fields: Array<{ label: string; value: any; path: string }> = [];

                if (viewLivroPopup.type === 'resumo') {
                  fields = [{ label: 'Resumo Executivo', value: livroVidaData.resumo_executivo, path: 'mentalidade_data.resumo_executivo' }];
                } else if (viewLivroPopup.type === 'higiene_sono') {
                  const h = livroVidaData.higiene_sono;
                  fields = [
                    { label: 'Horario de Dormir', value: h.horario_dormir_recomendado, path: 'mentalidade_data.higiene_sono.horario_dormir_recomendado' },
                    { label: 'Horario de Acordar', value: h.horario_acordar_recomendado, path: 'mentalidade_data.higiene_sono.horario_acordar_recomendado' },
                    { label: 'Duracao Alvo', value: h.duracao_alvo, path: 'mentalidade_data.higiene_sono.duracao_alvo' },
                    { label: 'Janela Semana', value: h.janela_sono_semana, path: 'mentalidade_data.higiene_sono.janela_sono_semana' },
                    { label: 'Janela FDS', value: h.janela_sono_fds, path: 'mentalidade_data.higiene_sono.janela_sono_fds' },
                    { label: 'Consistencia', value: h.consistencia_horario, path: 'mentalidade_data.higiene_sono.consistencia_horario' },
                    { label: 'Rotina Pre-Sono', value: formatValueForDataField(h.rotina_pre_sono), path: 'mentalidade_data.higiene_sono.rotina_pre_sono' },
                    { label: 'Gatilhos a Evitar', value: formatValueForDataField(h.gatilhos_evitar), path: 'mentalidade_data.higiene_sono.gatilhos_evitar' },
                    { label: 'Progressao', value: h.progressao_ajuste, path: 'mentalidade_data.higiene_sono.progressao_ajuste' },
                    { label: 'Observacoes', value: h.observacoes_clinicas, path: 'mentalidade_data.higiene_sono.observacoes_clinicas' },
                  ];
                } else if (viewLivroPopup.type === 'padrao' && viewLivroPopup.padraoNum) {
                  const key = `padrao_${String(viewLivroPopup.padraoNum).padStart(2, '0')}` as keyof typeof livroVidaData;
                  const p = livroVidaData[key] as PadraoItem | null;
                  if (p) {
                    const bp = `mentalidade_data.${key}`;
                    fields = [
                      { label: 'Padrao', value: p.padrao, path: `${bp}.padrao` },
                      { label: 'Categorias', value: formatValueForDataField(p.categorias), path: `${bp}.categorias` },
                      { label: 'Prioridade', value: p.prioridade, path: `${bp}.prioridade` },
                      { label: 'Areas de Impacto', value: formatValueForDataField(p.areas_impacto), path: `${bp}.areas_impacto` },
                      { label: 'Periodo', value: p.origem_estimada?.periodo, path: `${bp}.origem_estimada.periodo` },
                      { label: 'Contexto', value: p.origem_estimada?.contexto_provavel, path: `${bp}.origem_estimada.contexto_provavel` },
                      { label: 'Raiz de', value: formatValueForDataField(p.conexoes_padroes?.raiz_de), path: `${bp}.conexoes_padroes.raiz_de` },
                      { label: 'Explicacao', value: p.conexoes_padroes?.explicacao, path: `${bp}.conexoes_padroes.explicacao` },
                      { label: 'Alimentado por', value: formatValueForDataField(p.conexoes_padroes?.alimentado_por), path: `${bp}.conexoes_padroes.alimentado_por` },
                      { label: 'Relacionado com', value: formatValueForDataField(p.conexoes_padroes?.relacionado_com), path: `${bp}.conexoes_padroes.relacionado_com` },
                      { label: 'Manifestacoes', value: formatValueForDataField(p.manifestacoes_atuais), path: `${bp}.manifestacoes_atuais` },
                    ];
                    // Add orientacoes
                    (p.orientacoes_transformacao || []).forEach((o, idx) => {
                      fields.push({ label: `Passo ${o.passo}: ${o.nome} - O que fazer`, value: o.o_que_fazer, path: `${bp}.orientacoes_transformacao.${idx}.o_que_fazer` });
                      fields.push({ label: `Passo ${o.passo}: ${o.nome} - Como fazer`, value: o.como_fazer, path: `${bp}.orientacoes_transformacao.${idx}.como_fazer` });
                      fields.push({ label: `Passo ${o.passo}: ${o.nome} - Por que funciona`, value: o.porque_funciona, path: `${bp}.orientacoes_transformacao.${idx}.porque_funciona` });
                    });
                  }
                }

                const validFields = fields.filter(f => f.value);

                return validFields.map((field) => {
                  const isEditing = livroEditingPath === field.path;
                  return (
                    <div key={field.path} style={{ marginBottom: 10 }}>
                      {isEditing ? (
                        <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, border: '2px solid #1B4266' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', marginBottom: 6 }}>{field.label}</div>
                          <textarea
                            value={livroEditingValue}
                            onChange={e => setLivroEditingValue(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Escape') setLivroEditingPath(null); }}
                            style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' as const }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setLivroEditingPath(null)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={async () => { await handleSaveField(field.path, livroEditingValue, consultaId); setLivroEditingPath(null); await loadMentalidadeData(); }} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1B4266', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{ cursor: 'pointer', borderRadius: 6, padding: '8px 10px', transition: 'background 0.15s', borderBottom: '1px solid #F1F5F9' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#EBF3F6'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          onClick={() => { setLivroEditingPath(field.path); setLivroEditingValue(String(field.value || '')); }}
                          title={`Editar: ${field.label}`}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4266', marginBottom: 2 }}>{field.label}</div>
                          <div style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.6 }}>{String(field.value)}</div>
                        </div>
                      )}
                      {!isEditing && ' '}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente da seção de Solução Suplementação
// Interface para itens de suplementação
interface SuplementacaoItem {
  nome: string;
  objetivo: string;
  dosagem: string;
  horario: string;
  inicio: string;
  termino: string;
}

// Painel de favoritos do Cadastro - mostra itens favoritados para adicao rapida
function FavoritesPanel({
  type,
  onSelect
}: {
  type: 'refeicoes' | 'treinos' | 'suplementos' | 'fitoterapicos';
  onSelect: (item: any) => void;
}) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Buscar favoritos do banco via API
    const loadFavorites = async () => {
      try {
        const apiType = type === 'fitoterapicos' ? 'suplementos' : type === 'refeicoes' ? 'alimentos' : type;
        const params = new URLSearchParams({ favorito: 'true' });
        if (type === 'fitoterapicos') params.set('tipo_suplemento', 'fitoterapico');
        const res = await gatewayClient.get(`/cadastro/${apiType}?${params.toString()}`);
        if (res.success) {
          setFavorites(res.data || []);
        }
      } catch (e) {
        console.error('Erro ao carregar favoritos:', e);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem('cadastro_data');
          if (stored) {
            const allData = JSON.parse(stored);
            const items = allData[type] || [];
            setFavorites(items.filter((item: any) => item.favorito));
          }
        } catch {}
      }
    };
    loadFavorites();
  }, [type]);

  if (favorites.length === 0) return null;

  return (
    <div style={{
      marginBottom: '16px',
      border: '1.5px solid #E2E8F0',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#F8FAFC',
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1A3D61',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Meus Favoritos ({favorites.length})
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {favorites.map((item: any) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px',
                border: '1.5px solid #E2E8F0', background: '#ffffff',
                fontSize: '12px', fontWeight: 600, color: '#1A3D61',
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A3D61'; e.currentTarget.style.background = 'rgba(26,61,97,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#ffffff'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              {item.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SuplemementacaoSection({
  consultaId,
  userId,
  patientName,
}: {
  consultaId: string;
  userId?: string;
  patientName?: string;
}) {
  const { showError } = useNotifications();

  const [suplementacaoData, setSuplementacaoData] = useState<{
    suplementos: SuplementacaoItem[];
    fitoterapicos: SuplementacaoItem[];
    homeopatia: SuplementacaoItem[];
    florais_bach: SuplementacaoItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState<'suplementos' | 'fitoterapicos' | false>(false);
  const [supSearchQuery, setSupSearchQuery] = useState('');
  const [supSearchResults, setSupSearchResults] = useState<any[]>([]);
  const [supSearchLoading, setSupSearchLoading] = useState(false);
  const [favSupplementos, setFavSupplementos] = useState<any[]>([]);
  const [favFitoterapicos, setFavFitoterapicos] = useState<any[]>([]);
  const [showManualSup, setShowManualSup] = useState(false);
  const [manualSupForm, setManualSupForm] = useState({ nome: '', dosagem: '', horario: '', objetivo: '' });
  const { showSuccess } = useNotifications();

  const handleAddItem = async (category: 'suplementos' | 'fitoterapicos' | 'homeopatia' | 'florais_bach') => {
    try {
      setAddingCategory(category);
      setError(null);
      const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/add-item`, { category });
      if (!response.success) {
        throw new Error((response as { error?: string }).error || 'Erro ao adicionar item');
      }
      await loadSuplementacaoData();
    } catch (err) {
      console.error('Erro ao adicionar item:', err);
      showError(err instanceof Error ? err.message : 'Erro ao adicionar item', 'Erro');
    } finally {
      setAddingCategory(null);
    }
  };

  const handleDeleteItem = async (category: 'suplementos' | 'fitoterapicos' | 'homeopatia' | 'florais_bach', index: number) => {
    const key = `${category}-${index}`;
    try {
      setDeletingItem(key);
      const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/delete-item`, { category, index });
      if (!response.success) {
        throw new Error((response as { error?: string }).error || 'Erro ao excluir item');
      }
      showSuccess('Item excluído!');
      await loadSuplementacaoData();
    } catch (err) {
      console.error('Erro ao excluir item:', err);
      showError(err instanceof Error ? err.message : 'Erro ao excluir item', 'Erro');
    } finally {
      setDeletingItem(null);
    }
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    loadSuplementacaoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadSuplementacaoData();
    };

    window.addEventListener('suplementacao-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('suplementacao-data-refresh', handleRefresh);
    };
  }, []);

  const loadSuplementacaoData = async () => {
    try {
      setLoadingDetails(true);
      setError(null);

      console.log('🔍 Carregando dados de suplementação para consulta:', consultaId);

      const response = await gatewayClient.get(`/solucao-suplementacao/${consultaId}`);

      console.log('📡 Response status:', response.status);

      if (!response.success) {
        console.error('❌ Erro na resposta:', response.error);
        throw new Error(response.error || 'Erro ao carregar dados de suplementação');
      }

      const data = response;
      console.log('✅ Dados de suplementação recebidos:', data);
      console.log('📊 Estrutura suplementacao_data:', {
        hasData: !!data.suplementacao_data,
        suplementos: data.suplementacao_data?.suplementos?.length || 0,
        fitoterapicos: data.suplementacao_data?.fitoterapicos?.length || 0,
        homeopatia: data.suplementacao_data?.homeopatia?.length || 0,
        florais_bach: data.suplementacao_data?.florais_bach?.length || 0
      });

      setSuplementacaoData(data.suplementacao_data);
      setLoading(false);
    } catch (err) {
      console.error('❌ Erro ao carregar suplementação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar suplementação');
      setLoading(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Buscar favoritos de suplementos e fitoterapicos
  useEffect(() => {
    const loadFavs = async () => {
      try {
        const [supRes, fitoRes] = await Promise.all([
          gatewayClient.get('/cadastro/suplementos?favorito=true&limit=50'),
          gatewayClient.get('/cadastro/suplementos?favorito=true&tipo_suplemento=Fitoterápico&limit=50')
        ]);
        if (supRes.success) setFavSupplementos((supRes.data || []).filter((s: any) => s.tipo !== 'Fitoterápico'));
        if (fitoRes.success) setFavFitoterapicos(fitoRes.data || []);
      } catch (e) { console.error(e); }
    };
    loadFavs();
  }, []);

  // Busca de suplementos/fitoterapicos
  useEffect(() => {
    if (!showAddPanel) { setSupSearchResults([]); return; }
    const searchVal = supSearchQuery.trim();
    const timeout = setTimeout(async () => {
      setSupSearchLoading(true);
      try {
        const params = new URLSearchParams({ limit: '15' });
        if (searchVal) params.set('search', searchVal);
        if (showAddPanel === 'fitoterapicos') {
          params.set('tipo_suplemento', 'Fitoterápico');
        }
        const res = await gatewayClient.get(`/cadastro/suplementos?${params}`);
        let items = res.success ? (res.data || []) : [];
        // Filtrar no frontend para garantir separacao
        if (showAddPanel === 'suplementos') {
          items = items.filter((s: any) => s.tipo !== 'Fitoterápico');
        }
        setSupSearchResults(items);
      } catch (e) { console.error(e); setSupSearchResults([]); }
      finally { setSupSearchLoading(false); }
    }, searchVal ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [supSearchQuery, showAddPanel]);

  // Mostrar loading no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de suplementação...</p>
      </div>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="anamnese-error">
        <p style={{ color: '#f44336' }}>❌ {error}</p>
        <button
          onClick={loadSuplementacaoData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const effectiveSuplementacaoData = suplementacaoData ?? {
    suplementos: [] as SuplementacaoItem[],
    fitoterapicos: [] as SuplementacaoItem[],
    homeopatia: [] as SuplementacaoItem[],
    florais_bach: [] as SuplementacaoItem[]
  };

  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const isAddingCategory = (cat: string) => addingCategory === cat;

  // Função para renderizar categoria usando DataField
  const renderCategoryTable = (
    title: string,
    category: 'suplementos' | 'fitoterapicos' | 'homeopatia' | 'florais_bach',
    items: SuplementacaoItem[]
  ) => {
    const addButton = (
      <button
        type="button"
        onClick={() => handleAddItem(category)}
        disabled={!!addingCategory}
        className="suplementacao-add-item-btn"
        style={{
          marginTop: '8px',
          padding: '4px 0',
          fontSize: '13px',
          fontWeight: 500,
          background: 'none',
          color: 'var(--text-secondary, #6b7280)',
          border: 'none',
          cursor: addingCategory ? 'not-allowed' : 'pointer',
          opacity: isAddingCategory(category) ? 0.6 : 1,
          textDecoration: 'none'
        }}
      >
        {isAddingCategory(category) ? 'Adicionando…' : '+ Adicionar item'}
      </button>
    );

    if (items.length === 0) {
      return null;
    }

    return (
      <CollapsibleSection title={title} defaultOpen={true}>
        <div className="anamnese-subsection">
          {items.map((item, index) => (
            <div key={index} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 className="suplementacao-item-title" style={{ margin: 0 }}>
                  Item {index + 1}
                </h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={async () => {
                      try {
                        const { gerarReceitaItemPdf } = await import('@/lib/receitaPdf');
                        const { data: medicoData } = await supabase
                          .from('medicos')
                          .select('name, crm, specialty, phone, email, logo_url')
                          .eq('user_auth', userId || '')
                          .maybeSingle();
                        await gerarReceitaItemPdf({
                          item,
                          category,
                          medico: {
                            nome: medicoData?.name || '',
                            crm: medicoData?.crm || '',
                            especialidade: medicoData?.specialty || '',
                            telefone: medicoData?.phone || '',
                            email: medicoData?.email || '',
                            logo_url: medicoData?.logo_url || '',
                          },
                          paciente: { nome: patientName || '' },
                        });
                      } catch (err) { console.error('Erro ao gerar PDF:', err); }
                    }}
                    title="Baixar prescricao deste item"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1.5px solid #E2E8F0', background: 'transparent',
                      color: '#94A3B8', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A3D61'; e.currentTarget.style.color = '#1A3D61'; e.currentTarget.style.background = '#F1F5F9'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                  </button>
                  <button
                    onClick={() => handleDeleteItem(category, index)}
                    disabled={deletingItem === `${category}-${index}`}
                    title="Excluir item"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1.5px solid #E2E8F0', background: 'transparent',
                      color: '#94A3B8', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div className="anamnese-subsection">
                <DataField
                  label="Nome"
                  value={formatValueForDataField(item.nome)}
                  fieldPath={`suplementacao_data.${category}.${index}.nome`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'nome',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
                <DataField
                  label="Objetivo"
                  value={formatValueForDataField(item.objetivo)}
                  fieldPath={`suplementacao_data.${category}.${index}.objetivo`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'objetivo',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
                <DataField
                  label="Dosagem"
                  value={formatValueForDataField(item.dosagem)}
                  fieldPath={`suplementacao_data.${category}.${index}.dosagem`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'dosagem',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
                <DataField
                  label="Horário"
                  value={formatValueForDataField(item.horario)}
                  fieldPath={`suplementacao_data.${category}.${index}.horario`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'horario',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
                <DataField
                  label="Início"
                  value={formatValueForDataField(item.inicio)}
                  fieldPath={`suplementacao_data.${category}.${index}.inicio`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'inicio',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
                <DataField
                  label="Término"
                  value={formatValueForDataField(item.termino)}
                  fieldPath={`suplementacao_data.${category}.${index}.termino`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'termino',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  };

  // Adicionar suplemento manual
  const handleAddManualSup = async (category: 'suplementos' | 'fitoterapicos') => {
    if (!manualSupForm.nome.trim()) { showError('Nome é obrigatório.'); return; }
    try {
      setAddingCategory(category);
      await gatewayClient.post(`/solucao-suplementacao/${consultaId}/add-item`, {
        category,
        item: manualSupForm,
      });
      showSuccess('Item adicionado!');
      setShowManualSup(false);
      setShowAddPanel(false);
      setManualSupForm({ nome: '', dosagem: '', horario: '', objetivo: '' });
      await loadSuplementacaoData();
    } catch (err) { showError('Erro ao adicionar.'); }
    finally { setAddingCategory(null); }
  };

  const handleAddFromFavoriteOrSearch = async (item: any, category: 'suplementos' | 'fitoterapicos') => {
    try {
      setAddingCategory(category);
      const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/add-item`, {
        category,
        item: {
          nome: item.nome,
          dosagem: item.dosagem || '',
          horario: item.horario || '',
          objetivo: item.objetivo || '',
        }
      });
      if (response.success) {
        showSuccess('Item adicionado!');
        setShowAddPanel(false);
        setSupSearchQuery('');
        await loadSuplementacaoData();
      }
    } catch (err) {
      console.error('Erro ao adicionar:', err);
    } finally {
      setAddingCategory(null);
    }
  };

  const renderSupAddPanel = (category: 'suplementos' | 'fitoterapicos') => {
    const isSuplemento = category === 'suplementos';
    const label = isSuplemento ? 'Adicionar Suplemento' : 'Adicionar Fitoterápico';
    const favs = isSuplemento ? favSupplementos : favFitoterapicos;
    const borderColor = isSuplemento ? '#BAE6FD' : '#BBF7D0';
    const accentColor = isSuplemento ? '#1A3D61' : '#166534';
    const isOpen = showAddPanel === category;

    return (
      <div style={{ flex: 1 }}>
        <button
          onClick={() => { setShowAddPanel(isOpen ? false : category); setSupSearchQuery(''); setSupSearchResults([]); setShowManualSup(false); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 10,
            border: isOpen ? `2px solid ${accentColor}` : '1.5px dashed #94A3B8',
            background: isOpen ? (isSuplemento ? '#EFF6FF' : '#F0FDF4') : 'transparent',
            color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          {label}
        </button>
        {isOpen && (
          <div style={{ marginTop: 8, border: `1.5px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden', background: '#F8FAFC' }}>
            {/* Favoritos */}
            {favs.length > 0 && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Favoritos
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {favs.map((item: any) => (
                    <button key={item.id} onClick={() => handleAddFromFavoriteOrSearch(item, category)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1px solid ${borderColor}`, background: '#fff', fontSize: 12, fontWeight: 600, color: accentColor, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      {item.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Busca */}
            <div style={{ padding: '12px 16px' }}>
              <input type="text" placeholder={`Buscar ${isSuplemento ? 'suplemento' : 'fitoterápico'} cadastrado...`}
                value={supSearchQuery} onChange={e => setSupSearchQuery(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }} />
              {supSearchLoading && <div style={{ textAlign: 'center', padding: 8 }}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>}
              {supSearchResults.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', padding: '4px 0 6px' }}>
                    {supSearchQuery.trim() ? 'Resultados' : 'Meus Cadastrados'}
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {supSearchResults.map((item: any) => (
                      <div key={item.id} onClick={() => handleAddFromFavoriteOrSearch(item, category)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#fff', border: `1px solid ${borderColor}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.nome}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {item.dosagem || ''}{item.objetivo ? ` · ${item.objetivo}` : ''}
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {supSearchQuery.trim() && !supSearchLoading && supSearchResults.length === 0 && (
                <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: '4px 0' }}>Nenhum encontrado.</p>
              )}
              {/* Criar manual */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 4 }}>
                {!showManualSup ? (
                  <button onClick={() => setShowManualSup(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    Criar manualmente
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="text" placeholder="Nome *" value={manualSupForm.nome} onChange={e => setManualSupForm(p => ({ ...p, nome: e.target.value }))}
                      style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                    <input type="text" placeholder="Dosagem" value={manualSupForm.dosagem} onChange={e => setManualSupForm(p => ({ ...p, dosagem: e.target.value }))}
                      style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input type="text" placeholder="Horário" value={manualSupForm.horario} onChange={e => setManualSupForm(p => ({ ...p, horario: e.target.value }))}
                        style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                      <input type="text" placeholder="Objetivo" value={manualSupForm.objetivo} onChange={e => setManualSupForm(p => ({ ...p, objetivo: e.target.value }))}
                        style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowManualSup(false)}
                        style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => handleAddManualSup(category)}
                        style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: accentColor, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Adicionar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="anamnese-sections">
      {/* Botoes Adicionar Suplemento / Fitoterapico */}
      <div style={{ marginTop: 20, marginBottom: 16, display: 'flex', gap: 10 }}>
        {renderSupAddPanel('suplementos')}
        {renderSupAddPanel('fitoterapicos')}
      </div>
      {renderCategoryTable("1. Suplementos", "suplementos", effectiveSuplementacaoData.suplementos)}
      {renderCategoryTable("2. Fitoterápicos", "fitoterapicos", effectiveSuplementacaoData.fitoterapicos)}
      {renderCategoryTable("3. Homeopatia", "homeopatia", effectiveSuplementacaoData.homeopatia)}
      {renderCategoryTable("4. Florais de Bach", "florais_bach", effectiveSuplementacaoData.florais_bach)}
    </div>
  );
}

// Componente da seção de Solução Alimentação
function AlimentacaoSection({
  consultaId
}: {
  consultaId: string;
}) {
  const { showError, showSuccess } = useNotifications();

  const [alimentacaoData, setAlimentacaoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingMeal, setDeletingMeal] = useState<string | null>(null);
  const [showAddSearch, setShowAddSearch] = useState<'refeicao' | false>(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<any[]>([]);
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [addToMealId, setAddToMealId] = useState<string | null>(null);
  const [mealAlimentoSearch, setMealAlimentoSearch] = useState('');
  const [mealAlimentoResults, setMealAlimentoResults] = useState<any[]>([]);
  const [mealAlimentoLoading, setMealAlimentoLoading] = useState(false);
  const [favRefeicoes, setFavRefeicoes] = useState<any[]>([]);
  const [favAlimentos, setFavAlimentos] = useState<any[]>([]);
  // Criar refeição/alimento inline
  const [showCreateRefeicao, setShowCreateRefeicao] = useState(false);
  const [createRefeicaoNome, setCreateRefeicaoNome] = useState('');
  // Drag and drop reorder
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showCreateAlimento, setShowCreateAlimento] = useState<string | false>(false); // false or mealId
  const [createAlimentoNome, setCreateAlimentoNome] = useState('');
  const [createAlimentoPorcao, setCreateAlimentoPorcao] = useState('100');
  const [createAlimentoTacoResults, setCreateAlimentoTacoResults] = useState<any[]>([]);
  const [createAlimentoTacoLoading, setCreateAlimentoTacoLoading] = useState(false);
  const [createAlimentoTacoBase, setCreateAlimentoTacoBase] = useState<{ calorias: number; proteinas: number; carboidratos: number; gorduras: number; fibras: number } | null>(null);
  const [createAlimentoShowDropdown, setCreateAlimentoShowDropdown] = useState(false);
  const [createAlimentoCategoria, setCreateAlimentoCategoria] = useState('');

  useEffect(() => {
    loadAlimentacaoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadAlimentacaoData();
    };

    window.addEventListener('alimentacao-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('alimentacao-data-refresh', handleRefresh);
    };
  }, []);

  // Buscar favoritos de refeicoes e alimentos
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const [refRes, alRes] = await Promise.all([
          gatewayClient.get('/cadastro-refeicoes?favoritos=true&limit=50'),
          gatewayClient.get('/cadastro-alimentos?favoritos=true&limit=50')
        ]);
        if (refRes.success && refRes.refeicoes) {
          // Buscar detalhes de cada refeicao para ter os alimentos
          const detailedRefeicoes = await Promise.all(
            refRes.refeicoes.map(async (ref: any) => {
              try {
                const detail = await gatewayClient.get(`/cadastro-refeicoes/${ref.id}`);
                return detail.success ? detail.refeicao : ref;
              } catch { return ref; }
            })
          );
          setFavRefeicoes(detailedRefeicoes);
        }
        if (alRes.success) setFavAlimentos(alRes.alimentos || []);
      } catch (e) {
        console.error('Erro ao carregar favoritos:', e);
      }
    };
    loadFavorites();
  }, []);

  // Buscar alimentos e refeicoes para adicionar
  useEffect(() => {
    if (!showAddSearch || !addSearchQuery.trim()) { setAddSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      setAddSearchLoading(true);
      try {
        const results: any[] = [];

        // Buscar refeicoes se painel de refeicao
        if (showAddSearch === 'refeicao') {
          const refRes = await gatewayClient.get(`/cadastro-refeicoes?search=${encodeURIComponent(addSearchQuery)}&limit=10`);
          if (refRes.success && refRes.refeicoes) {
            const detailed = await Promise.all(
              refRes.refeicoes.map(async (r: any) => {
                try {
                  const detail = await gatewayClient.get(`/cadastro-refeicoes/${r.id}`);
                  return { ...(detail.success ? detail.refeicao : r), _type: 'refeicao' };
                } catch { return { ...r, _type: 'refeicao' }; }
              })
            );
            detailed.forEach((r: any) => results.push(r));
          }
        }

        setAddSearchResults(results);
      } catch (e) {
        console.error('Erro ao buscar:', e);
      } finally {
        setAddSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [addSearchQuery, showAddSearch]);

  // Adicionar refeicao/alimento ao protocolo de alimentacao da consulta
  const handleAddItemToProtocol = async (item: any) => {
    try {
      // Montar dados da refeicao no formato ref_X
      let principalItems: any[] = [];

      if (item._type === 'refeicao' && item.alimentos && item.alimentos.length > 0) {
        // Refeicao com alimentos cadastrados - cada alimento vira um item principal
        principalItems = item.alimentos.map((a: any) => {
          const al = a.cadastro_alimentos || a;
          return {
            alimento: al.nome || 'Item',
            gramas: parseFloat(a.porcao_customizada || al.porcao || '0') || 0,
            kcal: parseFloat(String(al.calorias || '0')) || 0,
            categoria: (al.categoria || '').toLowerCase(),
          };
        });
      } else {
        // Alimento individual
        principalItems = [{
          alimento: item.nome,
          gramas: parseFloat(item.porcao || '0') || 0,
          kcal: parseFloat(String(item.calorias || '0')) || 0,
          categoria: (item.categoria || '').toLowerCase(),
        }];
      }

      const refeicaoData = {
        principal: principalItems,
        substituicoes: {}
      };

      const resp = await gatewayClient.post(`/alimentacao/${consultaId}/add-refeicao`, {
        refeicaoData: JSON.stringify(refeicaoData),
        nome: item.nome
      });

      if (!resp.success) throw new Error(resp.error);

      showSuccess('Refeição adicionada ao protocolo!');
      setShowAddSearch(false);
      setAddSearchQuery('');
      setAddSearchResults([]);
      // Recarregar dados
      loadAlimentacaoData();
    } catch (err: any) {
      showError(err?.message || 'Erro ao adicionar item.');
      console.error(err);
    }
  };

  // Busca de alimentos para adicionar dentro de uma refeicao
  useEffect(() => {
    if (!addToMealId || !mealAlimentoSearch.trim()) { setMealAlimentoResults([]); return; }
    const timeout = setTimeout(async () => {
      setMealAlimentoLoading(true);
      try {
        const res = await gatewayClient.get(`/cadastro-alimentos?search=${encodeURIComponent(mealAlimentoSearch)}&limit=10`);
        setMealAlimentoResults(res.success && res.alimentos ? res.alimentos : []);
      } catch { setMealAlimentoResults([]); }
      finally { setMealAlimentoLoading(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [mealAlimentoSearch, addToMealId]);

  // Adicionar alimento dentro de uma refeicao existente
  const handleAddAlimentoToMeal = async (mealId: string, mealIndex: number, alimento: any) => {
    try {
      const resp = await gatewayClient.post(`/alimentacao/${consultaId}/add-alimento-to-meal`, {
        refId: mealId,
        alimento: {
          alimento: alimento.nome,
          gramas: parseFloat(alimento.porcao || '0') || 0,
          kcal: parseFloat(String(alimento.calorias || '0')) || 0,
          categoria: (alimento.categoria || '').toLowerCase(),
        }
      });
      if (!resp.success) throw new Error(resp.error);

      showSuccess('Alimento adicionado!');
      setAddToMealId(null);
      setMealAlimentoSearch('');
      setMealAlimentoResults([]);
      loadAlimentacaoData();
    } catch (err: any) {
      console.error('Erro ao adicionar alimento:', err);
      showError(err?.message || 'Erro ao adicionar alimento.');
    }
  };

  // TACO search for inline alimento creation
  useEffect(() => {
    if (!showCreateAlimento || !createAlimentoShowDropdown || createAlimentoNome.length < 2) { setCreateAlimentoTacoResults([]); return; }
    const t = setTimeout(async () => {
      setCreateAlimentoTacoLoading(true);
      try {
        const res = await gatewayClient.get(`/alimentos-nutricionais?search=${encodeURIComponent(createAlimentoNome)}&limit=10`);
        if (res.success) setCreateAlimentoTacoResults(res.alimentos || []);
      } catch {} finally { setCreateAlimentoTacoLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [createAlimentoNome, showCreateAlimento, createAlimentoShowDropdown]);

  const handleSelectTacoInline = (item: any) => {
    const base = {
      calorias: item.energia_kcal ? parseFloat(item.energia_kcal) : 0,
      proteinas: item.proteina_g ? parseFloat(item.proteina_g) : 0,
      carboidratos: item.carboidrato_g ? parseFloat(item.carboidrato_g) : 0,
      gorduras: item.lipideos_g ? parseFloat(item.lipideos_g) : 0,
      fibras: item.fibra_alimentar_g ? parseFloat(item.fibra_alimentar_g) : 0,
    };
    setCreateAlimentoTacoBase(base);
    setCreateAlimentoNome(item.nome);
    setCreateAlimentoCategoria(item.categoria || '');
    setCreateAlimentoPorcao('100');
    setCreateAlimentoShowDropdown(false);
    setCreateAlimentoTacoResults([]);
  };

  const getCalcAlimento = () => {
    if (!createAlimentoTacoBase) return { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 };
    const ratio = (parseFloat(createAlimentoPorcao) || 0) / 100;
    return {
      calorias: +(createAlimentoTacoBase.calorias * ratio).toFixed(1),
      proteinas: +(createAlimentoTacoBase.proteinas * ratio).toFixed(1),
      carboidratos: +(createAlimentoTacoBase.carboidratos * ratio).toFixed(1),
      gorduras: +(createAlimentoTacoBase.gorduras * ratio).toFixed(1),
      fibras: +(createAlimentoTacoBase.fibras * ratio).toFixed(1),
    };
  };

  // Criar alimento e adicionar à refeição
  const handleCreateAlimentoInline = async (mealId?: string, mealIndex?: number) => {
    if (!createAlimentoNome.trim()) { showError('Nome é obrigatório'); return; }
    try {
      const calc = getCalcAlimento();
      const payload = {
        nome: createAlimentoNome,
        categoria: createAlimentoCategoria || null,
        porcao: createAlimentoPorcao,
        calorias: calc.calorias || null,
        proteinas: calc.proteinas || null,
        carboidratos: calc.carboidratos || null,
        gorduras: calc.gorduras || null,
        fibras: calc.fibras || null,
      };
      const resp = await gatewayClient.post('/cadastro/alimentos', payload);
      if (!resp.success) throw new Error(resp.error);
      showSuccess('Alimento criado!');

      // Se tiver mealId, adicionar à refeição
      if (mealId && mealIndex !== undefined) {
        await handleAddAlimentoToMeal(mealId, mealIndex, { ...payload, id: resp.data?.id });
      }

      setShowCreateAlimento(false);
      setCreateAlimentoNome('');
      setCreateAlimentoPorcao('100');
      setCreateAlimentoTacoBase(null);
      setCreateAlimentoCategoria('');
    } catch (err: any) {
      showError(err?.message || 'Erro ao criar alimento');
    }
  };

  // Criar refeição vazia e adicionar ao protocolo
  const handleCreateRefeicaoInline = async () => {
    if (!createRefeicaoNome.trim()) { showError('Nome é obrigatório'); return; }
    try {
      const resp = await gatewayClient.post('/cadastro-refeicoes', { nome: createRefeicaoNome, descricao: '', tags: [] });
      if (!resp.success) throw new Error(resp.error);

      // Adicionar ao protocolo
      await handleAddItemToProtocol({ ...resp.refeicao, _type: 'refeicao', alimentos: [] });
      showSuccess('Refeição criada e adicionada!');
      setShowCreateRefeicao(false);
      setCreateRefeicaoNome('');
      setShowAddSearch(false);
    } catch (err: any) {
      showError(err?.message || 'Erro ao criar refeição');
    }
  };

  // Drag and drop reorder handler
  const handleDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const meals = Array.isArray(alimentacaoData) ? alimentacaoData : [];
    const fromMeal = meals[fromIdx];
    const toMeal = meals[toIdx];
    if (!fromMeal?.id || !toMeal?.id) return;
    try {
      // Optimistic UI update
      const newMeals = [...meals];
      [newMeals[fromIdx], newMeals[toIdx]] = [newMeals[toIdx], newMeals[fromIdx]];
      setAlimentacaoData(newMeals);

      const resp = await gatewayClient.post(`/alimentacao/${consultaId}/reorder-meals`, {
        fromId: fromMeal.id,
        toId: toMeal.id
      });
      if (!resp.success) throw new Error(resp.error);
      await loadAlimentacaoData();
    } catch (err: any) {
      showError('Erro ao reordenar');
      await loadAlimentacaoData(); // revert
    }
  };

  const loadAlimentacaoData = async () => {
    try {
      setLoadingDetails(true);
      console.log('🔍 [FRONTEND] Carregando dados de alimentação para consulta:', consultaId);

      const response = await gatewayClient.get(`/alimentacao/${consultaId}`);

      console.log('📡 [FRONTEND] Response status:', response.status);

      if (response.success) {
        const data = response;
        console.log('✅ [FRONTEND] Dados recebidos:', data);
        console.log('📊 [FRONTEND] Estrutura alimentacao_data:', {
          cafe_da_manha: data.alimentacao_data?.cafe_da_manha?.length || 0,
          almoco: data.alimentacao_data?.almoco?.length || 0,
          cafe_da_tarde: data.alimentacao_data?.cafe_da_tarde?.length || 0,
          jantar: data.alimentacao_data?.jantar?.length || 0
        });

        setAlimentacaoData(data.alimentacao_data);
      } else {
        console.error('❌ [FRONTEND] Erro na resposta:', response.error);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Erro ao carregar dados de Alimentação:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false);
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase via gateway
      const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
        fieldPath,
        value: newValue
      });

      if (!response.success) throw new Error(response.error || 'Erro ao atualizar campo no Supabase');

      // Depois, notificar o webhook (não bloqueante)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();

        fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            origem: 'MANUAL',
            fieldPath,
            texto: newValue,
            consultaId,
            solucao_etapa: 'ALIMENTACAO',
            paciente_id: null,
            user_id: null,
            msg_edicao: null,
            table: 's_gramaturas_alimentares',
            query: null
          }),
        }).catch(webhookError => {
          console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
        });
      } catch (webhookError) {
        console.warn('Aviso: Erro ao preparar webhook:', webhookError);
      }

      // Recarregar dados após salvar
      await loadAlimentacaoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    console.log('Edição com IA:', fieldPath, label);
  };

  const handleDeleteMeal = async (mealId: string, mealIndex: number) => {
    if (!confirm('Tem certeza que deseja excluir esta refeição?')) return;
    try {
      setDeletingMeal(mealId || `meal-${mealIndex}`);
      // mealId e 'ref_1', 'ref_2', etc.
      const response = await gatewayClient.post(`/alimentacao/${consultaId}/remove-refeicao`, {
        refId: mealId
      });
      if (response.success) {
        showSuccess('Refeição excluída!');
        await loadAlimentacaoData();
      }
    } catch (error) {
      console.error('Erro ao excluir refeicao:', error);
      showError('Erro ao excluir refeição.');
    } finally {
      setDeletingMeal(null);
    }
  };

  const handleDeletePrincipalItem = async (mealIndex: number, itemIndex: number) => {
    try {
      const currentMeals = Array.isArray(alimentacaoData) ? alimentacaoData : [];
      const meal = currentMeals[mealIndex];
      console.log('🗑️ Excluindo alimento:', { mealIndex, itemIndex, mealId: meal?.id, meal });
      if (!meal || !meal.id) {
        showError('Refeição não encontrada.');
        return;
      }

      const response = await gatewayClient.post(`/alimentacao/${consultaId}/remove-alimento-from-meal`, {
        refId: meal.id,
        itemIndex
      });
      console.log('🗑️ Response:', response);
      if (response.success) {
        showSuccess('Alimento excluído!');
        await loadAlimentacaoData();
      } else {
        showError(response.error || 'Erro ao excluir.');
      }
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      showError('Erro ao excluir alimento.');
    }
  };

  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };


  console.log('🔍 [FRONTEND] AlimentacaoSection - Estado atual:', {
    loading,
    hasData: !!alimentacaoData,
    dataStructure: alimentacaoData ? Object.keys(alimentacaoData) : []
  });

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de alimentação...</p>
      </div>
    );
  }

  if (!alimentacaoData) {
    return (
      <div className="anamnese-sections">
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Nenhum dado de alimentação encontrado para esta consulta.
        </p>
      </div>
    );
  }

  // Se os dados vierem no formato antigo (objeto com chaves das refeições), tentar converter ou usar como está para compatibilidade
  // Mas a nova estrutura é um array: [{ id: 'ref_1', nome: 'Refeição 1', data: "..." }, ...]
  const mealsToRender = Array.isArray(alimentacaoData)
    ? alimentacaoData.map((m: any) => {
      let parsedData = m.data;
      if (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (e) {
          console.error('Erro ao fazer parse dos dados da refeição:', e);
          parsedData = { principal: [], substituicoes: {} };
        }
      }
      return { ...m, data: parsedData };
    })
    : []; // Se não for array (null ou estrutura antiga não tratada aqui), retorna vazio por enquanto ou implemente fallback

  return (
    <div className="anamnese-sections">
      {/* Botao Adicionar Refeicao */}
      <div style={{ marginTop: '20px', marginBottom: '16px' }}>
        <button
          onClick={() => { setShowAddSearch(showAddSearch ? false : 'refeicao'); setAddSearchQuery(''); setAddSearchResults([]); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px 16px', borderRadius: '10px',
            border: showAddSearch ? '2px solid #1A3D61' : '1.5px dashed #94A3B8',
            background: showAddSearch ? '#EFF6FF' : 'transparent',
            color: '#1A3D61', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Adicionar Refeição
        </button>

        {showAddSearch && (
          <div style={{ marginTop: '8px', border: '1.5px solid #BAE6FD', borderRadius: '12px', overflow: 'hidden', background: '#F8FAFC' }}>
            {/* Favoritos de refeicao */}
            {favRefeicoes.length > 0 && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#1A3D61', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Favoritos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {favRefeicoes.map((item: any) => {
                    const alimentosNomes = item.alimentos?.map((a: any) => a.cadastro_alimentos?.nome || a.nome).filter(Boolean) || [];
                    return (
                      <button key={item.id} onClick={() => { handleAddItemToProtocol({ ...item, _type: 'refeicao' }); setShowAddSearch(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #BAE6FD', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A3D61" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{item.nome}</div>
                          {alimentosNomes.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alimentosNomes.join(', ')}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Busca de refeicao */}
            <div style={{ padding: '12px 16px' }}>
              <input
                type="text" placeholder="Buscar refeição cadastrada..."
                value={addSearchQuery} onChange={e => setAddSearchQuery(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
              />
              {addSearchLoading && <div style={{ textAlign: 'center', padding: '8px' }}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>}
              {addSearchResults.filter((r: any) => r._type === 'refeicao').length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {addSearchResults.filter((r: any) => r._type === 'refeicao').map((item: any) => (
                    <div key={item.id} onClick={() => { handleAddItemToProtocol(item); setShowAddSearch(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: '#fff', border: '1px solid #BAE6FD' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{item.nome}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{item.alimentos?.map((a: any) => a.cadastro_alimentos?.nome || a.nome).filter(Boolean).join(', ') || 'Refeição'}</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A3D61" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </div>
                  ))}
                </div>
              )}
              {addSearchQuery.trim() && !addSearchLoading && addSearchResults.filter((r: any) => r._type === 'refeicao').length === 0 && (
                <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '8px 0' }}>Nenhuma refeição encontrada.</p>
              )}
              {/* Criar Nova Refeição */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '8px' }}>
                {showCreateRefeicao ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" placeholder="Nome da refeição..." value={createRefeicaoNome} onChange={e => setCreateRefeicaoNome(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateRefeicaoInline(); }}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px' }} />
                    <button onClick={handleCreateRefeicaoInline}
                      style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#1A3D61', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Criar</button>
                    <button onClick={() => setShowCreateRefeicao(false)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowCreateRefeicao(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '6px', border: '1px dashed #1A3D61', background: 'transparent', color: '#1A3D61', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    Criar Nova Refeição
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {mealsToRender.length === 0 ? (
        <div className="anamnese-sections">
          <p style={{ color: '#666', fontStyle: 'italic', padding: '20px' }}>
            Nenhum dado de alimentação encontrado ou formato inválido.
          </p>
        </div>
      ) : (
        <div className="alimentacao-refeicoes-grid">
          {mealsToRender.map((meal: any, index: number) => {
            const principalItems = meal.data?.principal || [];
            const substituicoes = meal.data?.substituicoes || {};
            const hasSubstituicoes = Object.keys(substituicoes).length > 0;

            return (
              <div
                key={meal.id || index}
                className="alimentacao-meal-card"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={e => { e.preventDefault(); setDragOverIndex(index); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={e => { e.preventDefault(); if (dragIndex !== null) handleDrop(dragIndex, index); setDragIndex(null); setDragOverIndex(null); }}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                style={{
                  opacity: dragIndex === index ? 0.5 : 1,
                  borderTop: dragOverIndex === index && dragIndex !== index ? '3px solid #1A3D61' : undefined,
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="alimentacao-meal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#94A3B8', padding: '4px' }} title="Arrastar para reordenar">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                    </div>
                    <div className="alimentacao-meal-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>
                    </div>
                    <h3>{meal.nome || `Refeição ${index + 1}`}</h3>
                  </div>
                  <button
                    onClick={() => handleDeleteMeal(meal.id, index)}
                    disabled={deletingMeal === (meal.id || `meal-${index}`)}
                    title="Excluir refeicao"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '32px', height: '32px', borderRadius: '8px',
                      border: '1.5px solid #E2E8F0', background: 'transparent',
                      color: '#94A3B8', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>

                <div className="alimentacao-meal-body">
                  <div style={{ marginBottom: '20px' }}>
                    <h4 className="alimentacao-section-title">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                      Prato Principal
                    </h4>

                    {principalItems.length === 0 ? (
                      <p className="alimentacao-empty-msg">Nenhum item principal.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {principalItems.map((item: any, idx: number) => (
                          <div key={idx} className="alimentacao-principal-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span className="nome">{item.alimento}</span>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                {item.categoria && (
                                  <span className="badge">{item.categoria}</span>
                                )}
                                <button
                                  onClick={() => handleDeletePrincipalItem(index, idx)}
                                  title="Excluir item"
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '24px', height: '24px', borderRadius: '6px',
                                    border: '1px solid #E2E8F0', background: 'transparent',
                                    color: '#94A3B8', cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                              </div>
                            </div>
                            <div className="meta">
                              {item.gramas && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ⚖️ {Number(item.gramas).toFixed(0)}g
                                </span>
                              )}
                              {item.kcal && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  🔥 {Number(item.kcal).toFixed(0)} kcal
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botao adicionar alimento dentro da refeicao */}
                    <div style={{ marginTop: '10px' }}>
                      {addToMealId === meal.id ? (
                        <div style={{ border: '1.5px solid #BBF7D0', borderRadius: '10px', overflow: 'hidden', background: '#F8FAFC' }}>
                          {/* Favoritos de alimentos */}
                          {favAlimentos.length > 0 && (
                            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                Favoritos
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {favAlimentos.map((al: any) => (
                                  <button key={al.id} onClick={() => handleAddAlimentoToMeal(meal.id, index, al)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '16px', border: '1px solid #BBF7D0', background: '#fff', fontSize: '11px', fontWeight: 600, color: '#166534', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                    {al.nome}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Busca */}
                          <div style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <input
                                type="text" placeholder="Buscar alimento..."
                                value={mealAlimentoSearch} onChange={e => setMealAlimentoSearch(e.target.value)} autoFocus
                                style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px' }}
                              />
                              <button onClick={() => { setAddToMealId(null); setMealAlimentoSearch(''); setMealAlimentoResults([]); }}
                                style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </button>
                            </div>
                            {mealAlimentoLoading && (
                              <div style={{ textAlign: 'center', padding: '6px' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              </div>
                            )}
                            {mealAlimentoResults.length > 0 && (
                              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {mealAlimentoResults.map((al: any) => (
                                  <div key={al.id} onClick={() => handleAddAlimentoToMeal(meal.id, index, al)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', background: '#fff', border: '1px solid #E2E8F0' }}>
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{al.nome}</div>
                                      <div style={{ fontSize: '10px', color: '#64748B' }}>{al.categoria || ''}{al.calorias ? ` · ${al.calorias} kcal` : ''}</div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                  </div>
                                ))}
                              </div>
                            )}
                            {mealAlimentoSearch.trim() && !mealAlimentoLoading && mealAlimentoResults.length === 0 && (
                              <p style={{ fontSize: '11px', color: '#64748B', textAlign: 'center', padding: '4px 0' }}>Nenhum alimento encontrado.</p>
                            )}
                            {/* Criar Novo Alimento */}
                            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '6px' }}>
                              {showCreateAlimento === meal.id ? (
                                <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px' }}>
                                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                                    <input type="text" placeholder="Buscar na TACO ou digitar nome..." value={createAlimentoNome}
                                      onChange={e => { setCreateAlimentoNome(e.target.value); setCreateAlimentoShowDropdown(true); }}
                                      onFocus={() => { if (createAlimentoNome.length >= 2) setCreateAlimentoShowDropdown(true); }}
                                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                                    {createAlimentoShowDropdown && (createAlimentoTacoResults.length > 0 || createAlimentoTacoLoading) && (
                                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px', maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                                        {createAlimentoTacoLoading ? (
                                          <div style={{ padding: 8, textAlign: 'center', color: '#64748B', fontSize: 11 }}>Buscando...</div>
                                        ) : createAlimentoTacoResults.map((item: any) => (
                                          <div key={item.table_id} onClick={() => handleSelectTacoInline(item)}
                                            style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: 11 }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.nome}</div>
                                            <div style={{ color: '#64748B', marginTop: 1 }}>{item.energia_kcal && `${item.energia_kcal} kcal`} {item.proteina_g && `P:${item.proteina_g}g`} {item.carboidrato_g && `C:${item.carboidrato_g}g`} <span style={{ color: '#94A3B8' }}>(100g)</span></div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {createAlimentoTacoBase && (
                                    <div style={{ padding: '4px 8px', background: '#EBF3F6', borderRadius: 6, marginBottom: 8, fontSize: 10, color: '#1B4266' }}>
                                      {createAlimentoCategoria && <strong>{createAlimentoCategoria} · </strong>}
                                      TACO/100g: {createAlimentoTacoBase.calorias}kcal P:{createAlimentoTacoBase.proteinas}g C:{createAlimentoTacoBase.carboidratos}g G:{createAlimentoTacoBase.gorduras}g
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>Porção (g):</label>
                                    <input type="number" value={createAlimentoPorcao} onChange={e => setCreateAlimentoPorcao(e.target.value)}
                                      style={{ width: 70, padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px' }} />
                                    {createAlimentoTacoBase && (() => { const c = getCalcAlimento(); return <span style={{ fontSize: 10, color: '#64748B' }}>{c.calorias}kcal · P:{c.proteinas}g · C:{c.carboidratos}g · G:{c.gorduras}g</span>; })()}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => handleCreateAlimentoInline(meal.id, index)}
                                      style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: '#166534', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Criar e Adicionar</button>
                                    <button onClick={() => { setShowCreateAlimento(false); setCreateAlimentoNome(''); setCreateAlimentoPorcao('100'); setCreateAlimentoTacoBase(null); }}
                                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', color: '#64748B' }}>Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => { setShowCreateAlimento(meal.id); setCreateAlimentoNome(''); setCreateAlimentoPorcao('100'); setCreateAlimentoTacoBase(null); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', borderRadius: '6px', border: '1px dashed #166534', background: 'transparent', color: '#166534', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                  Criar Novo Alimento
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddToMealId(meal.id); setMealAlimentoSearch(''); setMealAlimentoResults([]); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                            borderRadius: '8px', border: '1px dashed #94A3B8', background: 'transparent',
                            color: '#64748B', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                          Adicionar alimento
                        </button>
                      )}
                    </div>
                  </div>

                  {hasSubstituicoes && (
                    <div>
                      <h4 className="alimentacao-section-title substituicoes">
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                        Substituições
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {Object.entries(substituicoes).map(([category, items]: [string, any], catIdx) => (
                          (items && items.length > 0) && (
                            <div key={catIdx}>
                              <h5 className="alimentacao-sub-cat">{category}</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                {items.slice(0, 4).map((subItem: any, subIdx: number) => (
                                  <div key={subIdx} className="alimentacao-sub-item">
                                    <div className="nome">{subItem.alimento}</div>
                                    <div className="gramas">
                                      {subItem.gramas ? `${Number(subItem.gramas).toFixed(0)}g` : 'Livre'}
                                    </div>
                                  </div>
                                ))}
                                {items.length > 4 && (
                                  <div className="alimentacao-more-opcoes">
                                    + {items.length - 4} opções...
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Componente da seção de Exames com dados do paciente
function ExamesSection({
  consultaDetails,
  consultaId,
  onBack
}: {
  consultaDetails: Consultation;
  consultaId: string;
  onBack: () => void;
}) {
  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (consulta: Consultation) => {
    // Tentar usar duration primeiro (em segundos)
    let durationInSeconds: number | null = null;

    // 1. Tentar campo duration (em segundos)
    if (consulta.duration && consulta.duration > 0) {
      durationInSeconds = consulta.duration;
    }
    // 2. Tentar campo duracao (pode estar em minutos)
    else if ((consulta as any).duracao && (consulta as any).duracao > 0) {
      // Se duracao está em minutos, converter para segundos
      const duracaoMinutos = Number((consulta as any).duracao);
      if (duracaoMinutos > 0 && duracaoMinutos < 1440) { // Máximo 24 horas em minutos
        durationInSeconds = Math.floor(duracaoMinutos * 60);
      }
    }
    // 3. Calcular a partir de consulta_inicio e consulta_fim
    else if (consulta.consulta_inicio && consulta.consulta_fim) {
      try {
        const inicio = new Date(consulta.consulta_inicio);
        const fim = new Date(consulta.consulta_fim);

        // Validar se as datas são válidas
        if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
          const diffMs = fim.getTime() - inicio.getTime();
          durationInSeconds = Math.floor(diffMs / 1000);

          // Validar se a duração é positiva e razoável (menos de 24 horas)
          if (durationInSeconds < 0 || durationInSeconds > 86400) {
            durationInSeconds = null;
          }
        }
      } catch (error) {
        console.error('Erro ao calcular duração:', error);
        durationInSeconds = null;
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'Criada';
      case 'AGENDAMENTO':
        return 'Agendada';
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALIDATION':
        return 'Validação';
      case 'VALID_ANAMNESE':
        return 'Validação Análise';
      case 'VALID_DIAGNOSTICO':
        return 'Diagnóstico Validado';
      case 'VALID_SOLUCAO':
        return 'Solução Validada';
      case 'COMPLETED':
        return 'Concluída';
      case 'ERROR':
        return 'Erro';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  // Avatar do paciente
  const patientsData = Array.isArray(consultaDetails.patients)
    ? consultaDetails.patients[0]
    : consultaDetails.patients;
  const patientAvatar = patientsData?.profile_pic || null;
  const patientInitials = (consultaDetails.patient_name || 'P')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="consultation-details-overview-container">
      {/* Header com botão voltar */}
      <div className="consultation-details-overview-header">
        <button
          className="back-button"
          onClick={onBack}
          style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="consultation-details-overview-title">Exames</h1>
      </div>

      {/* Cards de informações da consulta no topo */}
      <div className="consultation-details-cards-row">
        {/* Card Paciente */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-avatar">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={60}
                height={60}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder">
                {patientInitials}
              </div>
            )}
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Paciente</div>
            <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            {patientsData?.phone && (
              <div className="consultation-details-card-phone">{patientsData.phone}</div>
            )}
          </div>
        </div>

        {/* Card Data/Hora */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Calendar size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Data / Hora</div>
            <div className="consultation-details-card-value">
              {consultaDetails.consulta_inicio
                ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                : formatDateOnly(consultaDetails.created_at)}
            </div>
          </div>
        </div>

        {/* Card Tipo */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <FileText size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Tipo</div>
            <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
          </div>
        </div>

        {/* Card Duração */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Clock size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Duração</div>
            <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
          </div>
        </div>

        {/* Card Status */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <User size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Status</div>
            <div className="consultation-details-card-value">
              {getStatusLabel(consultaDetails.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Exames */}
      <div style={{ marginTop: '32px' }}>
        <ExamesUploadSection
          consultaId={consultaId}
          patientId={consultaDetails.patient_id}
          consultaStatus={consultaDetails.status}
          consultaEtapa={consultaDetails.etapa}
        />
      </div>
    </div>
  );
}

// Componente da tela intermediária de detalhes da consulta
function ConsultationDetailsOverview({
  consultaDetails,
  patientId,
  onNavigateToSection,
  onBack,
  hasAnamneseData,
  hasDiagnosticoData,
  hasSolucaoData
}: {
  consultaDetails: Consultation;
  patientId?: string;
  onNavigateToSection: (section: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCOES' | 'EXAMES' | 'EVOLUCAO') => void;
  onBack: () => void;
  hasAnamneseData: () => boolean;
  hasDiagnosticoData: () => boolean;
  hasSolucaoData: () => boolean;
}) {
  const [patientData, setPatientData] = useState<any>(null);
  const [loadingPatientData, setLoadingPatientData] = useState(false);

  // Função para calcular idade
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    try {
      const today = new Date();
      const birth = new Date(birthDate);

      // Verificar se a data é válida
      if (isNaN(birth.getTime())) {
        console.warn('⚠️ Data de nascimento inválida:', birthDate);
        return null;
      }

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      // Verificar se a idade é válida (não negativa e não muito grande)
      if (age < 0 || age > 150) {
        console.warn('⚠️ Idade calculada inválida:', age, 'para data:', birthDate);
        return null;
      }

      return age;
    } catch (error) {
      console.error('❌ Erro ao calcular idade:', error, 'para data:', birthDate);
      return null;
    }
  };

  // Buscar dados do paciente
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) {
        console.log('⚠️ ConsultationDetailsOverview: patientId não fornecido');
        return;
      }

      try {
        setLoadingPatientData(true);
        console.log('🔍 ConsultationDetailsOverview: Buscando dados do paciente:', patientId);
        const response = await gatewayClient.get(`/cadastro-anamnese/${patientId}`);

        if (response.success) {
          const data = response.cadastro || response.data?.cadastro || response;  // Extrair cadastro
          console.log('✅ ConsultationDetailsOverview: Dados do paciente recebidos:', data);
          console.log('✅ ConsultationDetailsOverview: data_nascimento:', data?.data_nascimento);
          console.log('✅ ConsultationDetailsOverview: idade:', data?.idade);
          console.log('✅ ConsultationDetailsOverview: tipo_saguineo:', data?.tipo_saguineo);
          console.log('✅ ConsultationDetailsOverview: tipo_sanguineo (variante):', data?.tipo_sanguineo);
          console.log('✅ ConsultationDetailsOverview: tipo_sangue (variante):', data?.tipo_sangue);
          setPatientData(data);
        } else {
          console.warn('⚠️ ConsultationDetailsOverview: Erro ao buscar dados do paciente:', response.status);
          setPatientData(null);
        }
      } catch (error) {
        console.error('❌ ConsultationDetailsOverview: Erro ao buscar dados do paciente:', error);
        setPatientData(null);
      } finally {
        setLoadingPatientData(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (consulta: Consultation) => {
    // Tentar usar duration primeiro (em segundos)
    let durationInSeconds: number | null = null;

    // 1. Tentar campo duration (em segundos)
    if (consulta.duration && consulta.duration > 0) {
      durationInSeconds = consulta.duration;
    }
    // 2. Tentar campo duracao (pode estar em minutos)
    else if ((consulta as any).duracao && (consulta as any).duracao > 0) {
      // Se duracao está em minutos, converter para segundos
      const duracaoMinutos = Number((consulta as any).duracao);
      if (duracaoMinutos > 0 && duracaoMinutos < 1440) { // Máximo 24 horas em minutos
        durationInSeconds = Math.floor(duracaoMinutos * 60);
      }
    }
    // 3. Calcular a partir de consulta_inicio e consulta_fim
    else if (consulta.consulta_inicio && consulta.consulta_fim) {
      try {
        const inicio = new Date(consulta.consulta_inicio);
        const fim = new Date(consulta.consulta_fim);

        // Validar se as datas são válidas
        if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
          const diffMs = fim.getTime() - inicio.getTime();
          durationInSeconds = Math.floor(diffMs / 1000);

          // Validar se a duração é positiva e razoável (menos de 24 horas)
          if (durationInSeconds < 0 || durationInSeconds > 86400) {
            durationInSeconds = null;
          }
        }
      } catch (error) {
        console.error('Erro ao calcular duração:', error);
        durationInSeconds = null;
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'Criada';
      case 'AGENDAMENTO':
        return 'Agendada';
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALIDATION':
        return 'Validação';
      case 'VALID_ANAMNESE':
        return 'Validação Análise';
      case 'VALID_DIAGNOSTICO':
        return 'Diagnóstico Validado';
      case 'VALID_SOLUCAO':
        return 'Solução Validada';
      case 'COMPLETED':
        return 'Concluída';
      case 'ERROR':
        return 'Erro';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getPatientAge = () => {
    // Prioridade 1: usar campo idade da anamnese se existir
    if (patientData?.idade) {
      const idade = typeof patientData.idade === 'string'
        ? parseInt(patientData.idade.trim(), 10)
        : patientData.idade;
      if (!isNaN(idade) && idade > 0 && idade <= 150) {
        return idade;
      }
    }
    // Prioridade 2: calcular a partir de data_nascimento
    if (patientData?.data_nascimento) {
      const age = calculateAge(patientData.data_nascimento);
      // Verificar se a idade é válida (não é NaN)
      if (age !== null && !isNaN(age) && age >= 0) {
        return age;
      }
    }
    // Tentar buscar de outras fontes ou retornar null para mostrar card vazio
    return null;
  };

  const getPatientWeight = () => {
    return patientData?.peso_atual || null;
  };

  const getPatientHeight = () => {
    const altura = patientData?.altura;
    if (!altura) return null;
    // Se altura já está formatada (contém "cm"), retornar como está
    if (typeof altura === 'string' && altura.includes('cm')) {
      return altura;
    }
    // Se contém "m" mas não "cm", converter para cm
    if (typeof altura === 'string' && altura.includes('m')) {
      const num = parseFloat(altura.replace(',', '.').replace('m', '').trim());
      if (!isNaN(num) && num < 10) {
        return `${Math.round(num * 100)} cm`;
      }
      return altura;
    }
    const num = typeof altura === 'number' ? altura : parseFloat(altura);
    if (!isNaN(num)) {
      // Valores < 10 estão em metros (ex: 1.75), converter para cm
      if (num < 10) {
        return `${Math.round(num * 100)} cm`;
      }
      // Valores >= 10 já estão em cm
      return `${Math.round(num)} cm`;
    }
    return altura;
  };

  const getPatientBloodType = () => {
    // Prioridade: usar tipo_saguineo (com 'g') da anamnese - nome correto da coluna no banco
    // Também verificar variações comuns caso ainda existam
    return patientData?.tipo_saguineo || patientData?.tipo_sanguineo || patientData?.tipo_sangue || null;
  };

  const patientAge = getPatientAge();
  const patientWeight = getPatientWeight();
  const patientHeight = getPatientHeight();
  const patientBloodType = getPatientBloodType();

  // Avatar do paciente - verificar se patients é array ou objeto
  const patientsData = Array.isArray(consultaDetails.patients)
    ? consultaDetails.patients[0]
    : consultaDetails.patients;
  console.log('🔍 ConsultationDetailsOverview: patientsData:', patientsData);
  const patientAvatar = patientsData?.profile_pic || null;
  console.log('🔍 ConsultationDetailsOverview: patientAvatar:', patientAvatar);
  const patientInitials = (consultaDetails.patient_name || 'P')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="consultation-details-overview-container">
      {/* Header com botão voltar */}
      <div className="consultation-details-overview-header">
        <button
          className="back-button"
          onClick={onBack}
          style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="consultation-details-overview-title">Detalhes da Consulta</h1>
      </div>

      {/* Cards de informações da consulta no topo */}
      <div className="consultation-details-cards-row">
        {/* Card Paciente */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-avatar">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={60}
                height={60}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder">
                {patientInitials}
              </div>
            )}
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Paciente</div>
            <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            {patientsData?.phone && (
              <div className="consultation-details-card-phone">{patientsData.phone}</div>
            )}
          </div>
        </div>

        {/* Card Data/Hora */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Calendar size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Data / Hora</div>
            <div className="consultation-details-card-value">
              {consultaDetails.consulta_inicio
                ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                : formatDateOnly(consultaDetails.created_at)}
            </div>
          </div>
        </div>

        {/* Card Tipo */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <FileText size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Tipo</div>
            <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
          </div>
        </div>

        {/* Card Duração */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Clock size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Duração</div>
            <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
          </div>
        </div>

        {/* Card Status */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <User size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Status</div>
            <div className="consultation-details-card-value">
              {getStatusLabel(consultaDetails.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de detalhes do paciente e ações */}
      <div className="consultation-details-main-content">
        {/* Card esquerdo - Detalhes do Paciente */}
        <div className="consultation-details-patient-card">
          <div className="consultation-details-patient-avatar-large">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={155}
                height={155}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder-large">
                {patientInitials}
              </div>
            )}
          </div>

          {loadingPatientData ? (
            <div className="consultation-details-loading">Carregando dados do paciente...</div>
          ) : (
            <div className="consultation-details-patient-data-grid">
              {/* Idade */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Clock size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Idade</div>
                  <div className="consultation-details-data-value">
                    {patientAge !== null ? `${patientAge} anos` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Peso */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Scale size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Peso</div>
                  <div className="consultation-details-data-value">
                    {patientWeight ? `${patientWeight} kg` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Altura */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Ruler size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Altura</div>
                  <div className="consultation-details-data-value">
                    {patientHeight || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tipo Sanguíneo */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Droplet size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Tipo sanguíneo</div>
                  <div className="consultation-details-data-value">
                    {patientBloodType || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card direito - Ações */}
        <div className="consultation-details-actions-card">
          <div className="consultation-details-actions-icon">
            <FolderOpen size={84} style={{ color: '#1B4266' }} />
          </div>

          <div className="consultation-details-actions-buttons">
            {/* Botão Análise */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('ANAMNESE')}
            >
              <Plus size={18} />
              <span>Análise</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Diagnóstico */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('DIAGNOSTICO')}
              disabled={!hasDiagnosticoData()}
              style={{
                opacity: !hasDiagnosticoData() ? 0.5 : 1,
                cursor: !hasDiagnosticoData() ? 'not-allowed' : 'pointer'
              }}
            >
              <Plus size={18} />
              <span>Diagnóstico</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Soluções */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('SOLUCOES')}
              disabled={!hasSolucaoData()}
              style={{
                opacity: !hasSolucaoData() ? 0.5 : 1,
                cursor: !hasSolucaoData() ? 'not-allowed' : 'pointer'
              }}
            >
              <Plus size={18} />
              <span>Soluções</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Exames */}
            <button
              className="consultation-details-action-button consultation-details-action-button-outline"
              onClick={() => onNavigateToSection('EXAMES')}
            >
              <Plus size={18} />
              <span>Exames</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Evolução */}
            <button
              className="consultation-details-action-button consultation-details-action-button-outline"
              onClick={() => onNavigateToSection('EVOLUCAO')}
            >
              <Plus size={18} />
              <span>Evolução</span>
              <ArrowRight size={18} />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function ConsultasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultaId = searchParams.get('consulta_id');
  const sectionParam = searchParams.get('section');
  const { showError, showSuccess, showWarning } = useNotifications();
  const { user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [doctors, setDoctors] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [cssLoaded, setCssLoaded] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilterType, setDateFilterType] = useState<'day' | 'week' | 'month' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const isInitialMount = useRef(true);

  // Estados para visualização de detalhes
  const [consultaDetails, setConsultaDetails] = useState<Consultation | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSolutionsViewer, setShowSolutionsViewer] = useState(false);
  const [forceRender, setForceRender] = useState(0); // Para forçar re-render

  const [selectedSection, setSelectedSection] = useState<'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCOES' | 'EXAMES' | 'EVOLUCAO' | null>(null);
  const [forceShowSolutionSelection, setForceShowSolutionSelection] = useState(false);

  // Estados para anamnese na lista de consultas
  const [consultaAnamneseStatus, setConsultaAnamneseStatus] = useState<Record<string, string>>({});
  const [firstConsultaByPatient, setFirstConsultaByPatient] = useState<Record<string, string>>({});
  const [sendingAnamneseId, setSendingAnamneseId] = useState<string | null>(null);
  const [copiedAnamneseId, setCopiedAnamneseId] = useState<string | null>(null);
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  // Verificar se o usuário é admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('medicos')
          .select('admin')
          .eq('user_auth', user.id)
          .maybeSingle();
        setIsAdmin(data?.admin === true);
      } catch { /* silently fail */ }
    };
    checkAdmin();
  }, [user?.id]);

  // Buscar lista de médicos quando for admin (para o filtro de médico)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchDoctors = async () => {
      try {
        const { data } = await supabase
          .from('medicos')
          .select('id, name, email')
          .order('name');
        if (data) setDoctors(data.filter(d => d.name));
      } catch { /* silently fail */ }
    };
    fetchDoctors();
  }, [isAdmin]);

  // Função para voltar para a tela de seleção de soluções
  const handleBackToSolutionSelection = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Limpa a solucao_etapa para mostrar a tela de seleção de soluções
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: null
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Forçar mostrar a tela de seleção de soluções
      setForceShowSolutionSelection(true);
      setSelectedSection(null);

      // Recarregar detalhes da consulta para atualizar a tela
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao voltar para seleção de soluções:', error);
      showError('Erro ao voltar para seleção de soluções. Tente novamente.', 'Erro');
      // Mesmo em caso de erro, tentar forçar a tela de seleção
      setForceShowSolutionSelection(true);
      setSelectedSection(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Baixar todas as soluções em DOCX (tela "Selecionar Solução")
  const handleDownloadAllDocx = async () => {
    const effectiveConsultaId = consultaId || consultaDetails?.id || null;
    if (!effectiveConsultaId) return;
    setDownloadingDocx(true);
    try {
      const solutions = await fetchSolutionsFromGateway(effectiveConsultaId);
      await downloadSolutionsDocxPremium(solutions, `solucoes-consulta-${effectiveConsultaId.slice(0, 8)}.docx`);
    } catch (err) {
      console.error('Erro ao gerar DOCX:', err);
      showError('Erro ao gerar documento. Tente novamente.', 'Erro');
    } finally {
      setDownloadingDocx(false);
    }
  };

  // Função para navegar para a solução anterior
  const handleNavigateToPreviousSolution = async () => {
    if (!consultaId || !consultaDetails?.solucao_etapa) return;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    if (currentIndex <= 0) return; // Já está na primeira

    const previousSolution = solutionOrder[currentIndex - 1];

    try {
      setIsSaving(true);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: previousSolution
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao navegar para solução anterior:', error);
      showError('Erro ao navegar para solução anterior. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para navegar para a próxima solução
  const handleNavigateToNextSolution = async () => {
    if (!consultaId || !consultaDetails?.solucao_etapa) return;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    if (currentIndex >= solutionOrder.length - 1) return; // Já está na última

    const nextSolution = solutionOrder[currentIndex + 1];

    try {
      setIsSaving(true);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: nextSolution
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao navegar para próxima solução:', error);
      showError('Erro ao navegar para próxima solução. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função helper para renderizar botões de navegação entre soluções
  const renderSolutionNavigationButtons = () => {
    if (!consultaDetails?.solucao_etapa) return null;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const solutionNames: Record<string, string> = {
      'MENTALIDADE': 'Livro da Vida',
      'SUPLEMENTACAO': 'Suplementação',
      'ALIMENTACAO': 'Alimentação',
      'ATIVIDADE_FISICA': 'Atividade Física'
    };

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < solutionOrder.length - 1;

    if (!hasPrevious && !hasNext) return null;

    return (
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginLeft: 'auto'
      }}>
        {hasPrevious && (
          <button
            onClick={handleNavigateToPreviousSolution}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>
        )}
        {hasNext && (
          <button
            onClick={handleNavigateToNextSolution}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#1B4266',
              border: '1px solid #1B4266',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#153350';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#1B4266';
              }
            }}
          >
            Próxima
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Função helper para renderizar o botão "Ver Todas as Soluções"
  const renderViewSolutionsButton = () => (
    <button
      className="view-solutions-button"
      onClick={handleBackToSolutionSelection}
      disabled={isSaving}
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: isSaving ? '#9ca3af' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isSaving ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (!isSaving) {
          e.currentTarget.style.background = '#2563eb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSaving) {
          e.currentTarget.style.background = '#3b82f6';
        }
      }}
    >
      <FileText className="w-4 h-4" />
      {isSaving ? 'Carregando...' : 'Ver Todas as Soluções'}
    </button>
  );

  // Estados para chat com IA
  const [selectedField, setSelectedField] = useState<{ fieldPath: string; label: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);

  // Estado para controlar a tab ativa na Anamnese
  const [activeAnamneseTab, setActiveAnamneseTab] = useState<string>('Dados do Paciente');

  // Estado para controlar a tab ativa no Diagnóstico (undefined = mostrar todas)
  const [activeDiagnosticoTab, setActiveDiagnosticoTab] = useState<string | undefined>(undefined);

  // Estado para salvar alterações
  const [isSaving, setIsSaving] = useState(false);

  // Estados para MENTALIDADE
  const [mentalidadeData, setMentalidadeData] = useState<any>(null);
  const [loadingMentalidade, setLoadingMentalidade] = useState(false);

  // Estados para ATIVIDADE_FISICA
  const [atividadeFisicaData, setAtividadeFisicaData] = useState<ExercicioFisico[]>([]);
  const [loadingAtividadeFisica, setLoadingAtividadeFisica] = useState(false);
  const [editingExercicio, setEditingExercicio] = useState<{ id: number, field: string } | null>(null);
  const [selectedTreino, setSelectedTreino] = useState<string | null>(null);
  const [videoHelpExercicio, setVideoHelpExercicio] = useState<string | null>(null);
  const [showAddExercicio, setShowAddExercicio] = useState(false);
  const [editingExercicioId, setEditingExercicioId] = useState<number | null>(null);
  const [editExercicioForm, setEditExercicioForm] = useState<Record<string, string>>({});
  const [addExercicioSearch, setAddExercicioSearch] = useState('');
  const [addExercicioResults, setAddExercicioResults] = useState<any[]>([]);
  const [addExercicioLoading, setAddExercicioLoading] = useState(false);
  const [addExercicioTreino, setAddExercicioTreino] = useState<string>('Treino A');
  const [favTreinos, setFavTreinos] = useState<any[]>([]);
  const [showManualExercicio, setShowManualExercicio] = useState(false);
  const [manualExercicioForm, setManualExercicioForm] = useState({ nome_exercicio: '', grupo_muscular: '', series: '', repeticoes: '', descanso: '', observacoes: '' });

  // Estado para autocomplete de exercícios
  const [exercicioSuggestions, setExercicioSuggestions] = useState<Array<{ id: number, atividade: string, grupo_muscular: string }>>([]);

  // Estado para alterações pendentes (não salvas)
  const [pendingChanges, setPendingChanges] = useState<Record<number, Partial<ExercicioFisico>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState<Consultation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para modal de edição de agendamento
  const [showEditAgendamentoModal, setShowEditAgendamentoModal] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Consultation | null>(null);
  const [editAgendamentoForm, setEditAgendamentoForm] = useState({
    date: '',
    time: '',
    type: 'TELEMEDICINA' as 'PRESENCIAL' | 'TELEMEDICINA'
  });
  const [isSavingAgendamento, setIsSavingAgendamento] = useState(false);

  // Estados para modal de confirmação de avanço de etapa
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAction, setAdvanceAction] = useState<(() => Promise<void>) | null>(null);
  const [advanceMessage, setAdvanceMessage] = useState<string>('');

  // Estado para verificar se anamnese está preenchida
  const [anamnesePreenchida, setAnamnesePreenchida] = useState<boolean | null>(null);

  // Função para verificar se anamnese está preenchida (definida aqui para ser usada nos useEffects)
  const checkAnamnesePreenchida = useCallback(async (patientId: string): Promise<boolean> => {
    try {
      console.log('🔍 Verificando anamnese para paciente:', patientId);
      const response = await gatewayClient.get(`/patients/${patientId}`);
      if (!response.success) {
        console.error('❌ Erro ao buscar dados do paciente:', response.status);
        return false;
      }
      const data = response;
      const patient = data.patient || data;
      const isPreenchida = patient?.anamnese?.status === 'preenchida';
      console.log('📋 Status da anamnese:', {
        pacienteId: patientId,
        temAnamnese: !!patient?.anamnese,
        status: patient?.anamnese?.status,
        isPreenchida
      });
      return isPreenchida;
    } catch (error) {
      console.error('❌ Erro ao verificar anamnese:', error);
      return false;
    }
  }, []);

  // Função para selecionar campo para edição com IA
  const handleFieldSelect = (fieldPath: string, label: string) => {
    setSelectedField({ fieldPath, label });
    setChatMessages([]); // Limpa o chat anterior
    setShowAIChat(true); // Abre o chat automaticamente quando um campo é selecionado
  };

  // ID da consulta: URL (?consulta_id=) ou detalhes carregados (consultaDetails.id)
  const effectiveConsultaId = consultaId || consultaDetails?.id || null;

  // Função para carregar dados de mentalidade
  const loadMentalidadeData = useCallback(async () => {
    if (!effectiveConsultaId) return;

    try {
      setLoadingMentalidade(true);
      // Endpoint encontrado em SolutionsViewer.tsx: /solucao-mentalidade/${consultaId}
      const response = await gatewayClient.get<any>(`/solucao-mentalidade/${effectiveConsultaId}`);

      if (response && response.success) {
        setMentalidadeData(response.mentalidade_data || response);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de mentalidade:', error);
    } finally {
      setLoadingMentalidade(false);
    }
  }, [effectiveConsultaId]);

  // Função para enviar mensagem para IA
  const handleSendAIMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    // Validar seleção e consulta; dar feedback e limpar input para o usuário não ficar com a mensagem presa
    if (!selectedField || !effectiveConsultaId) {
      setChatInput('');
      const msg: ChatMessage = {
        role: 'assistant',
        content: !effectiveConsultaId
          ? 'Nenhuma consulta selecionada. Selecione uma consulta na lista para abrir os detalhes e editar com IA.'
          : 'Selecione um campo (clique em "Editar com IA" no campo desejado) antes de enviar.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, msg]);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    // Adiciona mensagem do usuário no chat e limpa o campo imediatamente para a mensagem não ficar presa
    setChatMessages(prev => [...prev, userMessage]);
    const messageText = trimmed;
    setChatInput('');
    setIsTyping(true);

    try {
      // Determinar qual endpoint usar baseado no fieldPath
      console.log('🔍 [DEBUG] handleSendAIMessage try block started');
      const isDiagnostico = selectedField.fieldPath.startsWith('d_') ||
        selectedField.fieldPath.startsWith('diagnostico_principal');
      console.log('🔍 [DEBUG] isDiagnostico:', isDiagnostico);

      // ✅ FIX: Verificar TODAS as etapas de solução para usar o webhook correto
      const isSolucaoMentalidade = selectedField.fieldPath.startsWith('s_agente_mentalidade') ||
        selectedField.fieldPath.startsWith('mentalidade_data');
      const isSolucaoSuplemementacao = selectedField.fieldPath.startsWith('s_agente_suplementacao') ||
        selectedField.fieldPath.startsWith('suplementacao');
      const isSolucaoAlimentacao = selectedField.fieldPath.startsWith('s_agente_alimentacao') ||
        selectedField.fieldPath.startsWith('alimentacao');
      const isSolucaoAtividadeFisica = selectedField.fieldPath.startsWith('s_exercicios_fisicos') ||
        selectedField.fieldPath.startsWith('atividade_fisica') ||
        selectedField.fieldPath.startsWith('exercicio');

      const isSolucao = isSolucaoMentalidade || isSolucaoSuplemementacao ||
        isSolucaoAlimentacao || isSolucaoAtividadeFisica;
      console.log('🔍 [DEBUG] isSolucao:', isSolucao);

      const webhookEndpoints = getWebhookEndpoints();
      console.log('🔍 [DEBUG] webhookEndpoints loaded');
      const webhookHeaders = getWebhookHeaders();

      // Cada tipo de edição vai para seu webhook específico:
      // - Soluções (todas as etapas): edicaoSolucao
      // - Diagnóstico: edicaoDiagnostico
      // - Análise/Anamnese: edicaoAnamnese
      const webhookUrl = isSolucao
        ? webhookEndpoints.edicaoSolucao
        : isDiagnostico
          ? webhookEndpoints.edicaoDiagnostico
          : webhookEndpoints.edicaoAnamnese; // Inclui tela de Análise (a_sintese_analitica.*)

      const requestBody: Pick<Consultation, never> & Record<string, any> = {
        origem: 'IA',
        fieldPath: selectedField.fieldPath,
        texto: messageText,
        consultaId: effectiveConsultaId, // Mantido para compatibilidade
        consulta_id: effectiveConsultaId, // Formato esperado pelo webhook
        paciente_id: consultaDetails?.patient_id || (consultaDetails as any)?.paciente_id || null,
        user_id: user?.id || null,
        msg_edicao: messageText, // O webhook mapeia isso como null se não for compatível, mas enviamos como string
        table: selectedField.fieldPath.split('.')[0] || null,
        query: null
      };

      // Adicionar solucao_etapa se for etapa de solução e corrigir fieldPath com nome da tabela
      if (isSolucaoMentalidade) {
        requestBody.solucao_etapa = 'MENTALIDADE';
        // Substituir prefixo lógico 'mentalidade_data' pelo nome real da tabela 's_agente_mentalidade_2'
        requestBody.fieldPath = requestBody.fieldPath.replace('mentalidade_data', 's_agente_mentalidade_2');
      } else if (isSolucaoSuplemementacao) {
        requestBody.solucao_etapa = 'SUPLEMENTACAO';
      } else if (isSolucaoAlimentacao) {
        requestBody.solucao_etapa = 'ALIMENTACAO';
      } else if (isSolucaoAtividadeFisica) {
        requestBody.solucao_etapa = 'ATIVIDADE_FISICA';
      }

      console.log('✅ [FIXED] Enviando para webhook:', requestBody);
      console.log('🔗 [FIXED] URL:', webhookUrl);
      console.log('👤 [DEBUG] User:', user);
      console.log('🏥 [DEBUG] ConsultaDetails:', consultaDetails);

      // Faz requisição para nossa API interna (que chama o webhook)
      console.log('📤 Fazendo requisição para /ai/edit...');
      const response = await gatewayClient.post('/ai/edit', {
        ...requestBody,
        webhookUrl: webhookUrl
      });

      console.log('📥 Resposta recebida do Gateway:', response);

      console.log('Success?', response.success);

      if (!response.success) {
        console.error('Response not OK:', response.error);
        // Se for erro 500, pode ser problema no webhook, mas ainda mostramos a resposta
        if (response.warning) {
          throw new Error(response.message || 'Webhook de IA não disponível');
        }
        throw new Error('Erro ao comunicar com a IA');
      }

      // O gatewayClient já parseia a resposta JSON automaticamente
      const data = response;

      // A API retorna { success: true, result: "string_json" }
      // Precisamos extrair o result e fazer parse
      let webhookResponse = data.result || data;

      // Tentar parsear se for string JSON
      let parsedData;
      if (typeof webhookResponse === 'string') {
        try {
          parsedData = JSON.parse(webhookResponse);
        } catch (e) {
          // Se não conseguir fazer parse, usar a string diretamente
          parsedData = webhookResponse;
        }
      } else {
        parsedData = webhookResponse;
      }

      console.log('📥 [FRONTEND] Resposta bruta do webhook:', parsedData);

      // Pega a resposta da IA - lidando com diferentes formatos
      let aiResponse = '';

      if (Array.isArray(parsedData) && parsedData.length > 0) {
        // Formato esperado: [{"response": "texto"}] ou [{"output": "texto"}]
        const firstItem = parsedData[0];
        if (firstItem) {
          if (firstItem.response) aiResponse = firstItem.response;
          else if (firstItem.message) aiResponse = firstItem.message;
          else if (firstItem.text) aiResponse = firstItem.text;
          else if (firstItem.answer) aiResponse = firstItem.answer;
          else if (firstItem.output) aiResponse = firstItem.output;
          else aiResponse = JSON.stringify(firstItem);
        }
      } else if (parsedData && typeof parsedData === 'object') {
        // Se não é array, pode ser um objeto com diferentes campos
        if (parsedData.response) aiResponse = parsedData.response;
        else if (parsedData.text) aiResponse = parsedData.text;
        else if (parsedData.answer) aiResponse = parsedData.answer;
        else if (parsedData.output) aiResponse = parsedData.output;
        else if (parsedData.message) {
          aiResponse = String(parsedData.message);
        }
      } else if (typeof parsedData === 'string') {
        aiResponse = parsedData;
      }

      // Se após todas as tentativas ainda estiver vazio, mas recebemos algo (não nulo), assumimos sucesso genérico
      if (!aiResponse && parsedData) {
        console.warn('⚠️ Formato de resposta desconhecido, usando fallback.');
        aiResponse = "Alteração realizada com sucesso!";
      }

      if (!aiResponse) {
        aiResponse = 'Não foi possível obter resposta da IA';
      }

      // Adiciona resposta da IA no chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Recarregar dados após processamento da IA (com delay para dar tempo do processamento)
      setTimeout(async () => {
        try {
          // Se for um campo de diagnóstico, recarregar dados de diagnóstico
          const isDiagnostico = selectedField.fieldPath.startsWith('d_') ||
            selectedField.fieldPath.startsWith('diagnostico_principal');

          // Verificação para Soluções
          const isSolucaoMentalidade = selectedField.fieldPath.startsWith('s_agente_mentalidade') ||
            selectedField.fieldPath.startsWith('mentalidade_data') ||
            selectedField.fieldPath.startsWith('livro_vida');

          const isSolucao = isSolucaoMentalidade ||
            selectedField.fieldPath.startsWith('s_agente_suplementacao') ||
            selectedField.fieldPath.startsWith('suplementacao') ||
            selectedField.fieldPath.startsWith('s_agente_alimentacao') ||
            selectedField.fieldPath.startsWith('alimentacao') ||
            selectedField.fieldPath.startsWith('s_exercicios_fisicos') ||
            selectedField.fieldPath.startsWith('atividade_fisica') ||
            selectedField.fieldPath.startsWith('exercicio');

          if (isDiagnostico) {
            // Trigger refresh of diagnostico data by updating a state that triggers useEffect
            window.dispatchEvent(new CustomEvent('diagnostico-data-refresh'));
          } else if (isSolucaoMentalidade) {
            console.log('🔄 Reloading Mentalidade Data...');
            if (typeof loadMentalidadeData === 'function') {
              await loadMentalidadeData();
            } else {
              console.error('loadMentalidadeData function not found!');
            }
          } else {
            // Se for anamnese, recarregar dados de anamnese
            window.dispatchEvent(new CustomEvent('anamnese-data-refresh'));
          }
        } catch (refreshError) {
          console.warn('Erro ao recarregar dados após IA:', refreshError);
        }
      }, 2000);

    } catch (error) {
      console.error('Erro ao enviar mensagem para IA:', error);

      // Adiciona mensagem de erro
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Carregar consultas só depois que dashboard e CSS estiverem carregados
  // Este useEffect é para mudanças de página e carregamento inicial
  useEffect(() => {
    const executeLoad = async () => {
      if (!consultaId && dashboardLoaded && cssLoaded) {
        // Se for mudança de página (não primeira renderização), não mostra loading
        const showLoading = isInitialMount.current;
        await loadConsultations(showLoading);
      }
    };

    executeLoad();
  }, [currentPage, consultaId, dashboardLoaded, cssLoaded]);

  // Buscar consultas quando filtros mudarem (com debounce)
  useEffect(() => {
    // Ignorar a primeira renderização (já foi feita busca no useEffect inicial)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Não fazer busca se ainda não carregou dashboard/CSS ou se estiver em detalhes
    if (!dashboardLoaded || !cssLoaded || consultaId) {
      return;
    }

    // Debounce de 1 segundo para evitar muitas requisições enquanto o usuário digita
    const timeoutId = setTimeout(() => {
      loadConsultations(false); // Não mostra loading durante busca com filtros
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, selectedDoctorId]);

  // Verificar se o dashboard está completamente carregado
  useEffect(() => {
    const checkDashboardLoaded = () => {
      // Verificar se elementos críticos do dashboard estão presentes e estilizados
      const sidebar = document.querySelector('.sidebar');
      const header = document.querySelector('.header');
      const mainContent = document.querySelector('.main-content');

      if (sidebar && header && mainContent) {
        // Verificar se os elementos têm estilos aplicados
        const sidebarStyles = window.getComputedStyle(sidebar);
        const headerStyles = window.getComputedStyle(header);

        const sidebarHasStyles = sidebarStyles.width !== 'auto' && sidebarStyles.width !== '0px';
        const headerHasStyles = headerStyles.height !== 'auto' && headerStyles.height !== '0px';

        if (sidebarHasStyles && headerHasStyles) {
          setDashboardLoaded(true);
          return true;
        }
      }

      return false;
    };

    // Verificar imediatamente
    if (checkDashboardLoaded()) return;

    // Verificar com intervalos menores para ser mais responsivo
    const checkInterval = setInterval(() => {
      if (checkDashboardLoaded()) {
        clearInterval(checkInterval);
      }
    }, 50);

    // Timeout de segurança - marcar como carregado após 2 segundos
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!dashboardLoaded) {
        setDashboardLoaded(true);
      }
    }, 2000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Verificar CSS (só depois que dashboard estiver carregado)
  useEffect(() => {
    if (!dashboardLoaded) return; // Aguardar dashboard carregar primeiro

    // Verificação rápida do CSS
    const checkCssLoaded = () => {
      const testElement = document.createElement('div');
      testElement.className = 'consultas-container';
      testElement.style.visibility = 'hidden';
      testElement.style.position = 'absolute';
      testElement.style.top = '-9999px';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      const hasStyles = computedStyle.padding !== '' || computedStyle.margin !== '';

      document.body.removeChild(testElement);

      if (hasStyles) {
        setCssLoaded(true);
      }
    };

    // Verificar imediatamente
    checkCssLoaded();

    // Fallback rápido: marcar como carregado após 500ms
    const fallbackTimer = setTimeout(() => {
      if (!cssLoaded) {
        setCssLoaded(true);
      }
    }, 500);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [dashboardLoaded]);

  // Função para carregar lista de consultas
  const loadConsultations = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const dateFilter = dateFilterType && selectedDate ? { type: dateFilterType, date: selectedDate } : undefined;
      const response = await fetchConsultations(currentPage, 20, searchTerm, statusFilter, dateFilter, selectedDoctorId);

      // Atualizar apenas se houver mudanças (evita re-renders desnecessários)
      setConsultations(prev => {
        // Comparar IDs e status para detectar mudanças
        const hasChanges = prev.length !== response.consultations.length ||
          prev.some((oldConsultation, index) => {
            const newConsultation = response.consultations[index];
            if (!newConsultation) return true;
            return oldConsultation.id !== newConsultation.id ||
              oldConsultation.status !== newConsultation.status ||
              oldConsultation.etapa !== newConsultation.etapa ||
              oldConsultation.updated_at !== newConsultation.updated_at;
          });

        if (hasChanges) {
          return response.consultations;
        }
        return prev;
      });

      setTotalPages(response.pagination.totalPages);
      setTotalConsultations(response.pagination.total);
    } catch (err) {
      console.error('❌ [loadConsultations] ERRO:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [currentPage, searchTerm, statusFilter, dateFilterType, selectedDate, selectedDoctorId]);

  // Buscar status de anamnese e primeira consulta por paciente
  useEffect(() => {
    if (!consultations || consultations.length === 0) return;
    const fetchAnamneseStatuses = async () => {
      try {
        // Identificar pacientes unicos
        const patientIds = Array.from(new Set(consultations.map(c => c.patient_id).filter(Boolean)));
        if (patientIds.length === 0) return;

        // Buscar primeira consulta de cada paciente direto do banco
        const firstMap: Record<string, string> = {};
        for (const pid of patientIds) {
          const { data: firstConsulta } = await supabase
            .from('consultations')
            .select('id')
            .eq('patient_id', pid)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstConsulta) {
            firstMap[pid] = firstConsulta.id;
          }
        }
        setFirstConsultaByPatient(firstMap);

        // Buscar anamneses preenchidas (com consulta_id agora disponivel)
        const { data: anamneseData } = await supabase
          .from('a_cadastro_anamnese')
          .select('paciente_id, consulta_id, status')
          .in('paciente_id', patientIds);

        if (anamneseData) {
          const statusMap: Record<string, string> = {};
          anamneseData.forEach((a: any) => {
            if (a.consulta_id) {
              // Anamnese vinculada a consulta especifica
              statusMap[a.consulta_id] = a.status;
            } else {
              // Anamnese inicial (sem consulta_id) → vincular a primeira consulta
              const firstId = firstMap[a.paciente_id];
              if (firstId) {
                statusMap[firstId] = a.status;
              }
            }
          });
          setConsultaAnamneseStatus(statusMap);
        }
      } catch (err) {
        console.error('Erro ao buscar status anamnese:', err);
      }
    };
    fetchAnamneseStatuses();
  }, [consultations]);

  // Efeito para cancelar automaticamente consultas de Telemedicina expiradas
  useEffect(() => {
    // Só executar se houver consultas carregadas
    if (!consultations || consultations.length === 0) return;

    const cancelExpiredConsultations = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Identificar consultas expiradas (Telemedicina, Agendamento, Data < Hoje)
      const expiredConsultations = consultations.filter(consultation => {
        if (consultation.consultation_type !== 'TELEMEDICINA') return false;
        if (consultation.status !== 'AGENDAMENTO') return false;
        if (!consultation.consulta_inicio) return false;

        const consultationDate = new Date(consultation.consulta_inicio);
        const cDay = new Date(consultationDate);
        cDay.setHours(0, 0, 0, 0);

        // Se a data da consulta for estritamente menor que hoje (ontem ou antes)
        return cDay < today;
      });

      if (expiredConsultations.length > 0) {
        console.log(`🧹 [AUTO-CANCEL] Encontradas ${expiredConsultations.length} consultas expiradas. Iniciando cancelamento...`);

        let updatedIds: string[] = [];

        // Processar cancelamentos
        await Promise.all(expiredConsultations.map(async (consultation) => {
          try {
            const response = await gatewayClient.patch(`/consultations/${consultation.id}`, {
              status: 'CANCELLED'
            });

            // Verificar sucesso da resposta (seja via propriedade success ou status 200)
            if (response && (response.success || response.status === 'CANCELLED' || response.consultation)) {
              console.log(`✅ [AUTO-CANCEL] Consulta ${consultation.id} cancelada com sucesso.`);
              updatedIds.push(consultation.id);
            }
          } catch (err) {
            console.error(`❌ [AUTO-CANCEL] Erro ao cancelar consulta ${consultation.id}:`, err);
          }
        }));

        // Se houve atualizações, refletir no estado local para evitar loop e atualizar UI
        if (updatedIds.length > 0) {
          setConsultations(prev => prev.map(c =>
            updatedIds.includes(c.id) ? { ...c, status: 'CANCELLED' } : c
          ));
          console.log(`🔄 [AUTO-CANCEL] Estado local atualizado para ${updatedIds.length} consultas.`);
        }
      }
    };

    cancelExpiredConsultations();
  }, [consultations]);

  // Carregar lista de consultas inicialmente
  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  // Polling automático para atualizar lista de consultas (especialmente status)
  useEffect(() => {
    // Só fazer polling na lista se não houver consulta específica aberta
    if (consultaId) return;

    // Verificar se há consultas em processamento na lista atual
    const hasProcessingConsultations = consultations.some(c =>
      ['PROCESSING', 'RECORDING'].includes(c.status)
    );

    // Se há consultas processando, fazer polling mais frequente
    const pollingInterval = hasProcessingConsultations ? 5000 : 15000; // 5s se processando, 15s caso contrário

    const intervalId = setInterval(async () => {
      try {
        await loadConsultations(false); // Modo silencioso para não mostrar loading
      } catch (error) {
        // Erro silencioso - não mostrar ao usuário
      }
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [consultations, consultaId, loadConsultations]); // Re-executar quando consultas mudarem ou consultaId mudar

  // Carregar detalhes quando houver consulta_id na URL
  useEffect(() => {
    console.log('🔄 useEffect consultaId mudou:', consultaId);
    if (consultaId) {
      console.log('📥 Carregando detalhes da consulta:', consultaId);
      fetchConsultaDetails(consultaId);
      // Resetar o estado do visualizador de soluções quando mudar de consulta
      setShowSolutionsViewer(false);
      // Se houver parâmetro section=anamnese na URL, abrir diretamente a seção de anamnese
      if (sectionParam === 'anamnese') {
        setSelectedSection('ANAMNESE');
      } else {
        // Resetar selectedSection quando mudar de consulta (a menos que tenha section param)
        setSelectedSection(null);
      }
    } else {
      console.log('❌ Nenhuma consulta selecionada, limpando detalhes');
      setConsultaDetails(null);
      setSelectedSection(null);
    }
  }, [consultaId, sectionParam]);

  // Verificar status da anamnese quando consulta for carregada ou quando entrar na seção de diagnóstico
  useEffect(() => {
    const verifyAnamneseStatus = async () => {
      if (!consultaDetails?.patient_id) {
        setAnamnesePreenchida(null);
        return;
      }

      // Se já tem solução, não precisa verificar
      if (consultaDetails.status === 'VALID_SOLUCAO' ||
        consultaDetails.status === 'COMPLETED' ||
        consultaDetails.etapa === 'SOLUCAO') {
        setAnamnesePreenchida(null);
        return;
      }

      // Verificar quando entrar na seção de diagnóstico
      if (selectedSection === 'DIAGNOSTICO') {
        const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
        setAnamnesePreenchida(isPreenchida);
      }
    };

    verifyAnamneseStatus();
  }, [consultaDetails?.patient_id, consultaDetails?.status, consultaDetails?.etapa, selectedSection, checkAnamnesePreenchida]);

  // Verificar status inicial quando a consulta for carregada (apenas uma vez)
  const hasCheckedInitialRef = useRef<string | null>(null);
  useEffect(() => {
    const verifyInitialStatus = async () => {
      if (!consultaDetails?.patient_id) {
        hasCheckedInitialRef.current = null;
        return;
      }

      // Se já verificamos para este paciente, não verificar novamente
      if (hasCheckedInitialRef.current === consultaDetails.patient_id) {
        return;
      }

      // Se já tem solução, não precisa verificar
      if (consultaDetails.status === 'VALID_SOLUCAO' ||
        consultaDetails.status === 'COMPLETED' ||
        consultaDetails.etapa === 'SOLUCAO') {
        return;
      }

      // Verificar quando a consulta for carregada pela primeira vez
      hasCheckedInitialRef.current = consultaDetails.patient_id;
      const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
      setAnamnesePreenchida(isPreenchida);
    };

    verifyInitialStatus();
  }, [consultaDetails?.patient_id, consultaDetails?.status, consultaDetails?.etapa, checkAnamnesePreenchida]);

  // Efeito para definir selectedSection automaticamente apenas quando houver parâmetro section=anamnese na URL
  // Não deve definir automaticamente baseado no status da consulta - deve mostrar a tela de overview primeiro
  useEffect(() => {
    if (!consultaDetails) return;

    // Apenas definir selectedSection como 'ANAMNESE' se houver o parâmetro section=anamnese na URL
    // Isso permite que o usuário clique no botão "Acessar Anamnese" e vá direto para a anamnese
    // Mas quando abre a consulta normalmente, mostra a tela de overview primeiro
    if (sectionParam === 'anamnese' && selectedSection !== 'ANAMNESE') {
      setSelectedSection('ANAMNESE');
    }
  }, [consultaDetails, selectedSection, sectionParam]);

  // Polling automático para atualizar status da consulta (SEMPRE ativo quando há consulta aberta)
  // Ref para controlar se devemos parar o polling (ex: erro 401)
  const pollingActiveRef = useRef(true);

  useEffect(() => {
    if (!consultaId) return;

    // Resetar flag de polling ativo quando consultaId mudar
    pollingActiveRef.current = true;

    // Determinar intervalo baseado no status atual
    const getPollingInterval = (currentStatus: string | null) => {
      if (!currentStatus) return 10000; // Default: 10 segundos

      // Status que mudam frequentemente: polling mais rápido
      if (['PROCESSING', 'RECORDING'].includes(currentStatus)) {
        return 5000; // 5 segundos
      }
      // Status estáveis: polling menos frequente
      if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(currentStatus)) {
        return 120000; // 2 minutos (reduzido - status estável não precisa de polling frequente)
      }
      // Status intermediários
      return 10000; // 10 segundos
    };

    const currentStatus = consultaDetails?.status || null;
    const pollingInterval = getPollingInterval(currentStatus);

    const intervalId = setInterval(async () => {
      // ✅ CORREÇÃO: Verificar se polling ainda está ativo antes de fazer requisição
      if (!pollingActiveRef.current) {
        console.log('⏹️ Polling desativado, ignorando requisição');
        clearInterval(intervalId);
        return;
      }

      try {
        // Buscar dados diretamente da API (com cache busting para garantir dados frescos)
        const response = await gatewayClient.get(`/consultations/${consultaId}?t=${Date.now()}`);

        // ✅ CORREÇÃO: Se erro 401 (não autenticado), parar polling imediatamente
        if (response.status === 401) {
          console.warn('⚠️ Sessão expirada - parando polling de consultas');
          pollingActiveRef.current = false;
          clearInterval(intervalId);
          // Não redirecionar automaticamente - deixar o usuário saber que precisa fazer login
          return;
        }

        // ✅ CORREÇÃO: Se erro 429 (Too Many Requests), parar polling temporariamente
        if (response.status === 429) {
          console.warn('⚠️ Rate Limit atingido (429) - parando polling de consultas');
          pollingActiveRef.current = false;
          clearInterval(intervalId);
          return;
        }

        // ✅ CORREÇÃO: Se erro 403 ou 404, parar polling (consulta não existe ou sem permissão)
        if (response.status === 403 || response.status === 404) {
          console.warn(`⚠️ Consulta não acessível (${response.status}) - parando polling`);
          pollingActiveRef.current = false;
          clearInterval(intervalId);
          return;
        }

        if (response.success) {
          const data = response;
          const newConsultation = data.consultation;

          if (!newConsultation) {
            return;
          }

          const newStatus = newConsultation.status;
          const newEtapa = newConsultation.etapa;
          const newSolucaoEtapa = newConsultation.solucao_etapa;
          const newUpdatedAt = newConsultation.updated_at;

          // Comparar com os dados atuais (usar consultaDetails do estado, não a variável local)
          // Isso garante que sempre comparamos com o estado mais recente
          setConsultaDetails(prev => {
            if (!prev) {
              return newConsultation;
            }

            // Verificar mudanças em campos importantes
            const statusChanged = prev.status !== newStatus;
            const etapaChanged = prev.etapa !== newEtapa;
            const solucaoEtapaChanged = prev.solucao_etapa !== newSolucaoEtapa;
            const updatedAtChanged = prev.updated_at !== newUpdatedAt;

            // Se QUALQUER campo importante mudou, atualizar
            if (statusChanged || etapaChanged || solucaoEtapaChanged || updatedAtChanged) {
              return newConsultation;
            }

            // Nenhuma mudança detectada
            return prev; // Retornar o mesmo objeto para evitar re-render desnecessário
          });
        }
      } catch (error) {
        // Erro de rede - pode continuar tentando, mas logar para debug
        console.warn('⚠️ Erro no polling de consulta:', error);
      }
    }, pollingInterval);

    // Cleanup: parar polling quando componente desmontar ou consulta mudar
    return () => {
      clearInterval(intervalId);
    };
  }, [consultaId, consultaDetails?.status]); // Re-executar quando consultaId ou status mudar

  // Carregar dados de atividade física quando a etapa for ATIVIDADE_FISICA
  useEffect(() => {
    if (consultaId && consultaDetails?.solucao_etapa === 'ATIVIDADE_FISICA') {
      loadAtividadeFisicaData();
    }
  }, [consultaId, consultaDetails?.solucao_etapa]);

  // Listener para recarregar dados de anamnese quando a IA processar
  useEffect(() => {
    const handleAnamneseRefresh = () => {
      console.log('🔍 DEBUG [REFERENCIA] Evento de refresh de anamnese recebido');
      // Disparar evento para o componente AnamneseSection
      window.dispatchEvent(new CustomEvent('force-anamnese-refresh'));
    };

    window.addEventListener('anamnese-data-refresh', handleAnamneseRefresh);

    return () => {
      window.removeEventListener('anamnese-data-refresh', handleAnamneseRefresh);
    };
  }, []);

  const loadAtividadeFisicaData = async () => {
    if (!consultaId) return;

    try {
      setLoadingAtividadeFisica(true);
      console.log('🔍 DEBUG [REFERENCIA] Iniciando carregamento de dados de atividade física para consulta:', consultaId);

      const response = await gatewayClient.get(`/atividade-fisica/${consultaId}`);
      console.log('🔍 DEBUG [REFERENCIA] Resposta da API:', response.status);

      if (response.success) {
        const data = response;
        console.log('🔍 DEBUG [REFERENCIA] Dados recebidos da API:', data);
        const exercicios = data.atividade_fisica_data || [];
        console.log('🔍 DEBUG [REFERENCIA] Exercícios para setar:', exercicios.length, 'exercícios');
        setAtividadeFisicaData(exercicios);
        console.log('🔍 DEBUG [REFERENCIA] Estado atividadeFisicaData atualizado');
      } else {
        console.error('❌ Erro na resposta da API:', response.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados de Atividade Física:', error);
    } finally {
      setLoadingAtividadeFisica(false);
    }
  };

  // Buscar favoritos de treinos
  useEffect(() => {
    const loadFavTreinos = async () => {
      try {
        const res = await gatewayClient.get('/cadastro-treinos?favoritos=true&limit=50');
        if (res.success) setFavTreinos(res.treinos || res.data || []);
      } catch (e) { console.error(e); }
    };
    loadFavTreinos();
  }, []);

  // Busca de exercicios/treinos para adicionar
  useEffect(() => {
    if (!showAddExercicio) { setAddExercicioResults([]); return; }
    const searchVal = addExercicioSearch.trim();
    const timeout = setTimeout(async () => {
      setAddExercicioLoading(true);
      try {
        const results: any[] = [];
        // Buscar treinos cadastrados (meus treinos)
        const treinosRes = await gatewayClient.get(`/cadastro-treinos?${searchVal ? `search=${encodeURIComponent(searchVal)}&` : ''}limit=15`);
        if (treinosRes.success && (treinosRes.treinos || treinosRes.data)) {
          (treinosRes.treinos || treinosRes.data).forEach((t: any) => results.push({ ...t, _source: 'cadastro' }));
        }
        // Buscar na base geral de exercicios
        if (searchVal) {
          const listaRes = await gatewayClient.get(`/lista-exercicios-fisicos?search=${encodeURIComponent(searchVal)}&limit=15`);
          if (listaRes.success && listaRes.exercicios) {
            listaRes.exercicios.forEach((e: any) => results.push({ ...e, _source: 'lista', nome: e.atividade || e.nome }));
          }
        }
        setAddExercicioResults(results);
      } catch (e) { console.error(e); }
      finally { setAddExercicioLoading(false); }
    }, searchVal ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [addExercicioSearch, showAddExercicio]);

  // Adicionar exercicio ao protocolo
  const handleAddExercicioToProtocol = async (item: any, treino?: string) => {
    try {
      await gatewayClient.post(`/atividade-fisica/${consultaId}/add-item`, {
        nome_exercicio: item.nome || item.atividade || '',
        nome_treino: treino || addExercicioTreino || selectedTreino || 'Treino A',
        grupo_muscular: item.grupo_muscular || '',
        series: item.series || '',
        repeticoes: item.repeticoes || '',
        descanso: item.descanso || '',
        observacoes: item.descricao || item.observacoes || '',
      });
      showSuccess('Exercício adicionado!');
      setShowAddExercicio(false);
      setAddExercicioSearch('');
      setAddExercicioResults([]);
      loadAtividadeFisicaData();
    } catch (e) {
      console.error(e);
      showError('Erro ao adicionar exercício.');
    }
  };

  // Adicionar exercicio manual
  const handleAddManualExercicio = async () => {
    if (!manualExercicioForm.nome_exercicio.trim()) {
      showError('Nome do exercício é obrigatório.');
      return;
    }
    try {
      await gatewayClient.post(`/atividade-fisica/${consultaId}/add-item`, {
        ...manualExercicioForm,
        nome_treino: addExercicioTreino || selectedTreino || 'Treino A',
      });
      showSuccess('Exercício adicionado!');
      setShowManualExercicio(false);
      setShowAddExercicio(false);
      setManualExercicioForm({ nome_exercicio: '', grupo_muscular: '', series: '', repeticoes: '', descanso: '', observacoes: '' });
      loadAtividadeFisicaData();
    } catch (e) {
      console.error(e);
      showError('Erro ao adicionar exercício.');
    }
  };

  // Salvar edicao de exercicio
  const handleSaveExercicioEdit = async (exercicioId: number) => {
    try {
      const fields = editExercicioForm;
      for (const [field, value] of Object.entries(fields)) {
        await gatewayClient.post(`/atividade-fisica/${consultaId}/update-field`, { id: exercicioId, field, value });
      }
      showSuccess('Exercício atualizado!');
      setEditingExercicioId(null);
      setEditExercicioForm({});
      loadAtividadeFisicaData();
    } catch (e) {
      console.error(e);
      showError('Erro ao salvar exercício.');
    }
  };

  // Renderizar painel de adicionar exercicio/treino
  // mode='treino' -> nivel 1 (adicionar treino novo), mode='exercicio' -> nivel 2 (adicionar exercicio dentro de treino)
  const renderAddExercicioPanel = (targetTreino?: string, mode: 'treino' | 'exercicio' = 'exercicio') => {
    const label = mode === 'treino' ? 'Adicionar Treino' : 'Adicionar Exercício';
    const searchPlaceholder = mode === 'treino' ? 'Buscar treino cadastrado...' : 'Buscar exercício cadastrado...';
    return (
    <div style={{ marginTop: 20, marginBottom: 16 }}>
      <button
        onClick={() => { setShowAddExercicio(!showAddExercicio); setAddExercicioTreino(targetTreino || selectedTreino || 'Treino A'); setAddExercicioSearch(''); setAddExercicioResults([]); setShowManualExercicio(false); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 10,
          border: showAddExercicio ? '2px solid #1A3D61' : '1.5px dashed #94A3B8',
          background: showAddExercicio ? '#EFF6FF' : 'transparent',
          color: '#1A3D61', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        {label}
      </button>

      {showAddExercicio && (
        <div style={{ marginTop: 8, border: '1.5px solid #BAE6FD', borderRadius: 12, overflow: 'hidden', background: '#F8FAFC' }}>
          {/* Favoritos */}
          {favTreinos.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1A3D61', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Favoritos
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {favTreinos.map((t: any) => (
                  <button key={t.id} onClick={() => handleAddExercicioToProtocol(t, targetTreino)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: '1px solid #BAE6FD', background: '#fff', fontSize: 12, fontWeight: 600, color: '#1A3D61', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    {t.nome}
                    {t.grupo_muscular && <span style={{ fontSize: 10, color: '#64748B' }}>{t.grupo_muscular}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Busca */}
          <div style={{ padding: '12px 16px' }}>
            <input
              type="text" placeholder={searchPlaceholder}
              value={addExercicioSearch} onChange={e => setAddExercicioSearch(e.target.value)} autoFocus
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const, marginBottom: 8 }}
            />
            {addExercicioLoading && <div style={{ textAlign: 'center', padding: 8 }}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>}
            {(() => {
              const cadastroItems = addExercicioResults.filter((r: any) => r._source === 'cadastro');
              const listaItems = addExercicioResults.filter((r: any) => r._source === 'lista');
              if (addExercicioResults.length === 0 && !addExercicioLoading) {
                return addExercicioSearch.trim() ? <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: '4px 0' }}>Nenhum exercício encontrado.</p> : null;
              }
              return (
                <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {cadastroItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#1A3D61', textTransform: 'uppercase' as const, padding: '6px 0 2px' }}>Meus Treinos</div>
                      {cadastroItems.map((item: any, i: number) => (
                        <div key={`c-${item.id || i}`} onClick={() => handleAddExercicioToProtocol(item, targetTreino)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.nome}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{item.grupo_muscular || item.categoria || ''}{item.series ? ` · ${item.series} séries` : ''}</div>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A3D61" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        </div>
                      ))}
                    </>
                  )}
                  {listaItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, padding: '6px 0 2px' }}>Base de Exercícios</div>
                      {listaItems.map((item: any, i: number) => (
                        <div key={`l-${item.id || i}`} onClick={() => handleAddExercicioToProtocol(item, targetTreino)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#fff', border: '1px solid #E2E8F0' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.nome}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{item.grupo_muscular || ''}</div>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A3D61" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Criar manual */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 4 }}>
              {!showManualExercicio ? (
                <button onClick={() => setShowManualExercicio(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#1A3D61', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  Criar exercício manualmente
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="text" placeholder="Nome do exercício *" value={manualExercicioForm.nome_exercicio} onChange={e => setManualExercicioForm(p => ({ ...p, nome_exercicio: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                  <input type="text" placeholder="Grupo muscular" value={manualExercicioForm.grupo_muscular} onChange={e => setManualExercicioForm(p => ({ ...p, grupo_muscular: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <input type="text" placeholder="Séries" value={manualExercicioForm.series} onChange={e => setManualExercicioForm(p => ({ ...p, series: e.target.value }))}
                      style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                    <input type="text" placeholder="Repetições" value={manualExercicioForm.repeticoes} onChange={e => setManualExercicioForm(p => ({ ...p, repeticoes: e.target.value }))}
                      style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                    <input type="text" placeholder="Descanso" value={manualExercicioForm.descanso} onChange={e => setManualExercicioForm(p => ({ ...p, descanso: e.target.value }))}
                      style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                  </div>
                  <input type="text" placeholder="Observações" value={manualExercicioForm.observacoes} onChange={e => setManualExercicioForm(p => ({ ...p, observacoes: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowManualExercicio(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={handleAddManualExercicio}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#1A3D61', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  };

  // Função para buscar exercícios da lista
  const searchExercicios = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setExercicioSuggestions([]);
      return;
    }

    try {
      const response = await gatewayClient.get(`/lista-exercicios-fisicos?search=${encodeURIComponent(searchTerm)}`);
      if (response.success) {
        const data = response;
        setExercicioSuggestions(data.exercicios || []);
      } else {
        setExercicioSuggestions([]);
      }
    } catch (error) {
      setExercicioSuggestions([]);
    }
  };

  // Função para atualizar exercício LOCALMENTE (sem salvar no banco)
  const handleUpdateExercicioLocal = (id: number, field: string, newValue: string) => {
    // Atualizar o estado local
    setAtividadeFisicaData(prev => prev.map(ex =>
      ex.id === id ? { ...ex, [field]: newValue } : ex
    ));

    // Registrar a alteração pendente
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: newValue }
    }));

    setHasUnsavedChanges(true);
    setEditingExercicio(null);
  };

  // Função para SALVAR TODAS as alterações no banco
  const handleSaveAllChanges = async () => {
    if (!consultaId || Object.keys(pendingChanges).length === 0) return;

    try {
      setIsSaving(true);

      // Salvar cada alteração pendente
      for (const [exercicioId, changes] of Object.entries(pendingChanges)) {
        for (const [field, value] of Object.entries(changes)) {
          const response = await gatewayClient.post(`/atividade-fisica/${consultaId}/update-field`, {
            id: Number(exercicioId),
            field,
            value
          });

          if (!response.success) throw new Error(`Erro ao atualizar ${field}`);
        }
      }

      // Notificar webhook via proxy (evita CORS)
      try {
        await gatewayClient.post('/webhook/proxy', {
          endpoint: 'edicaoSolucao',
          payload: {
            origem: 'MANUAL',
            fieldPath: 's_exercicios_fisicos',
            texto: 'Múltiplas alterações salvas',
            consultaId,
            solucao_etapa: 'ATIVIDADE_FISICA',
            paciente_id: consultaDetails?.patient_id || null,
            user_id: user?.id || null,
            msg_edicao: null,
            table: 's_exercicios_fisicos',
            query: null
          }
        });
      } catch (webhookError) {
        console.warn('Webhook não notificado:', webhookError);
      }

      // Limpar alterações pendentes
      setPendingChanges({});
      setHasUnsavedChanges(false);

      // Mostrar sucesso (você pode adicionar um toast aqui)
      //alert('Alterações salvas com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      // Usar sistema de notificações ao invés de alert
      // showError será usado se disponível, senão apenas console.error
      console.error('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };


  // Função para salvar exercício individual no banco
  const handleSaveExercicio = async (id: number, field: string, newValue: string) => {
    if (!consultaId) return;

    try {
      console.log('💾 [handleSaveExercicio] Salvando:', { id, field, newValue, consultaId });

      const response = await gatewayClient.post(`/atividade-fisica/${consultaId}/update-field`, {
        id,
        field,
        value: newValue
      });

      if (!response.success) {
        console.error('❌ [handleSaveExercicio] Erro na resposta:', response.error);
        throw new Error(response.error || 'Erro ao salvar');
      }

      console.log('✅ [handleSaveExercicio] Salvo com sucesso:', response);

      // Atualizar estado local com o novo valor
      setAtividadeFisicaData(prev => prev.map(ex =>
        ex.id === id ? { ...ex, [field]: newValue } : ex
      ));
    } catch (error) {
      console.error('❌ [handleSaveExercicio] Erro ao salvar:', error);
      throw error; // Re-throw para que o DataField possa tratar
    }
  };

  // Função para selecionar solução
  const handleSelectSolucao = async (solucaoEtapa: 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA') => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      console.log('🔍 [handleSelectSolucao] Iniciando seleção de solução:', solucaoEtapa);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: solucaoEtapa,
        etapa: 'SOLUCAO',
        status: 'VALID_SOLUCAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      console.log('✅ [handleSelectSolucao] Consulta atualizada com sucesso');

      // Resetar estados que podem interferir
      setForceShowSolutionSelection(false);
      // NÃO resetar selectedSection aqui - deixar null para que renderConsultationContent determine o que mostrar
      // Mas garantir que não vá para a tela intermediária quando há solução selecionada
      setSelectedSection(null);

      // Aguardar um pouco antes de recarregar para garantir que o banco foi atualizado
      await new Promise(resolve => setTimeout(resolve, 200));

      // Recarregar detalhes da consulta
      console.log('🔄 [handleSelectSolucao] Recarregando detalhes da consulta...');
      await fetchConsultaDetails(consultaId);

      console.log('✅ [handleSelectSolucao] Detalhes recarregados');
    } catch (error) {
      console.error('❌ [handleSelectSolucao] Erro ao selecionar solução:', error);
      showError('Erro ao selecionar solução. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAtividadeFisicaAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Limpa a solucao_etapa para mostrar a tela de seleção
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: null
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarregar detalhes da consulta
      await fetchConsultaDetails(consultaId);

    } catch (error) {
      console.error('Erro ao salvar e continuar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchConsultaDetails = async (id: string, silent = false) => {
    try {
      console.log('🔍 [fetchConsultaDetails] INICIANDO para ID:', id);
      if (!silent) {
        setLoadingDetails(true);
      }
      setError(null);
      const response = await gatewayClient.get(`/consultations/${id}`);
      console.log('📡 [fetchConsultaDetails] Response recebido:', response.success ? 'SUCESSO' : 'ERRO');

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      const data = response.data || response;
      const newConsultation = data.consultation || data;

      // Logs para debug de consulta_inicio, consulta_fim e duration
      console.log('📅 Dados da consulta recebidos (duração):', {
        duration: newConsultation?.duration,
        duracao: (newConsultation as any)?.duracao,
        consulta_inicio: newConsultation?.consulta_inicio,
        consulta_fim: newConsultation?.consulta_fim,
        created_at: newConsultation?.created_at,
        todas_as_colunas_consulta: Object.keys(newConsultation || {}).filter(k =>
          k.toLowerCase().includes('consulta') ||
          k.toLowerCase().includes('inicio') ||
          k.toLowerCase().includes('fim') ||
          k.toLowerCase().includes('start') ||
          k.toLowerCase().includes('end') ||
          k.toLowerCase().includes('duration') ||
          k.toLowerCase().includes('duracao')
        )
      });

      // Log específico para debug de soluções
      console.log('🔍 [fetchConsultaDetails] Dados recebidos:', {
        status: newConsultation?.status,
        etapa: newConsultation?.etapa,
        solucao_etapa: newConsultation?.solucao_etapa
      });

      // Atualizar consulta e forçar re-render
      setConsultaDetails(newConsultation);
      setForceRender(prev => prev + 1);
      console.log('✅ [fetchConsultaDetails] setConsultaDetails EXECUTADO!');
    } catch (err) {
      console.error('❌ [fetchConsultaDetails] ERRO:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes da consulta');
    } finally {
      if (!silent) {
        setLoadingDetails(false);
      }
    }
  };

  const handleConsultationClick = (consultation: Consultation) => {
    console.log('🖱️ Clicando na consulta:', consultation.id, consultation.patient_name);
    // Navegar para a URL com o ID da consulta para permitir recarregamento e deeplinking
    router.push(`/consultas?consulta_id=${consultation.id}`);
  };

  const handleBackToList = () => {
    // Limpar state
    setConsultaDetails(null);
    setSelectedSection(null);
    // Navegar de volta para a lista sem parâmetros
    router.push('/consultas');
  };

  // Função para editar consulta
  const handleEditConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta

    // Se for agendamento, abre o modal de edição
    if (consultation.status === 'AGENDAMENTO') {
      // Determinar data/hora do agendamento
      const dateTime = consultation.consulta_inicio
        ? new Date(consultation.consulta_inicio)
        : new Date(consultation.created_at);

      const dateStr = dateTime.toISOString().split('T')[0];
      const timeStr = dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      setEditAgendamentoForm({
        date: dateStr,
        time: timeStr,
        type: consultation.consultation_type
      });
      setEditingAgendamento(consultation);
      setShowEditAgendamentoModal(true);
    } else {
      // Para outras consultas, abre os detalhes
      router.push(`/consultas?consulta_id=${consultation.id}`);
    }
  };

  // Função para fechar modal de edição de agendamento
  const handleCloseEditAgendamentoModal = () => {
    setShowEditAgendamentoModal(false);
    setEditingAgendamento(null);
    setEditAgendamentoForm({ date: '', time: '', type: 'TELEMEDICINA' });
  };

  // Função para salvar edição de agendamento
  const handleSaveAgendamentoEdit = async () => {
    if (!editingAgendamento) return;

    setIsSavingAgendamento(true);
    try {
      // Criar datetime combinando data e hora
      const [year, month, day] = editAgendamentoForm.date.split('-').map(Number);
      const [hours, minutes] = editAgendamentoForm.time.split(':').map(Number);
      const consultaInicio = new Date(year, month - 1, day, hours, minutes).toISOString();

      const response = await gatewayClient.patch(`/consultations/${editingAgendamento.id}`, {
        consulta_inicio: consultaInicio,
        consultation_type: editAgendamentoForm.type
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Atualizar lista local
      setConsultations(prev => prev.map(c => {
        if (c.id === editingAgendamento.id) {
          return {
            ...c,
            consulta_inicio: consultaInicio,
            consultation_type: editAgendamentoForm.type
          };
        }
        return c;
      }));

      showSuccess('Agendamento atualizado com sucesso!', 'Sucesso');
      handleCloseEditAgendamentoModal();
    } catch (error: any) {
      console.error('Erro ao atualizar agendamento:', error);
      showError(error.message || 'Erro ao atualizar agendamento', 'Erro');
    } finally {
      setIsSavingAgendamento(false);
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta
    setConsultationToDelete(consultation);
    setShowDeleteModal(true);
  };

  // Enviar anamnese por email/WhatsApp a partir da lista de consultas
  const handleSendAnamneseFromList = async (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation();
    setSendingAnamneseId(consultation.id);
    try {
      const pid = consultation.patient_id;
      const isFirst = firstConsultaByPatient[pid] === consultation.id;
      const anamneseLink = isFirst
        ? `${window.location.origin}/anamnese-inicial?paciente_id=${pid}`
        : `${window.location.origin}/anamnese-inicial?paciente_id=${pid}&consulta_id=${consultation.id}`;

      const patientEmail = consultation.patients?.email;
      const patientPhone = consultation.patients?.phone;
      const patientName = consultation.patient_name || '';

      if (!patientEmail && !patientPhone) {
        showWarning('Paciente nao possui email nem telefone cadastrado.');
        return;
      }

      let hasError = false;

      if (patientEmail) {
        const emailResult = await gatewayClient.post('/email/anamnese', { to: patientEmail, patientName, anamneseLink });
        if (!emailResult.success) {
          console.error('Erro ao enviar email:', emailResult.error);
          hasError = true;
        }
      }
      if (patientPhone) {
        const whatsappResult = await gatewayClient.post('/whatsapp/anamnese', { phone: patientPhone, patientName, anamneseLink });
        if (!whatsappResult.success) {
          console.error('Erro ao enviar WhatsApp:', whatsappResult.error);
          hasError = true;
        }
      }

      if (hasError) {
        showError('Erro ao enviar anamnese. Verifique os dados do paciente.');
      } else {
        showSuccess('Anamnese enviada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao enviar anamnese:', err);
      showError('Erro ao enviar anamnese.');
    } finally {
      setSendingAnamneseId(null);
    }
  };

  // Copiar link da anamnese a partir da lista de consultas
  const handleCopyAnamneseLinkFromList = async (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation();
    const pid = consultation.patient_id;
    const isFirst = firstConsultaByPatient[pid] === consultation.id;
    const link = isFirst
      ? `${window.location.origin}/anamnese-inicial?paciente_id=${pid}`
      : `${window.location.origin}/anamnese-inicial?paciente_id=${pid}&consulta_id=${consultation.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedAnamneseId(consultation.id);
      showSuccess('Link da anamnese copiado!');
      setTimeout(() => setCopiedAnamneseId(null), 2000);
    } catch (err) {
      showError('Erro ao copiar link.');
    }
  };

  // Função para confirmar exclusão da consulta
  const confirmDeleteConsultation = async () => {
    if (!consultationToDelete) return;

    setIsDeleting(true);
    try {
      const response = await gatewayClient.delete(`/consultations/${consultationToDelete.id}`);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Atualiza a lista removendo a consulta excluída
      setConsultations(prev => prev.filter(c => c.id !== consultationToDelete.id));
      setTotalConsultations(prev => prev - 1);

      // Fecha o modal
      setShowDeleteModal(false);
      setConsultationToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir consulta:', err);
      showError('Erro ao excluir consulta. Por favor, tente novamente.', 'Erro');
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para cancelar exclusão
  const cancelDeleteConsultation = () => {
    setShowDeleteModal(false);
    setConsultationToDelete(null);
  };

  // Função para entrar em uma consulta agendada
  const handleEnterConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta

    // Redirecionar para a página de nova consulta com os dados do agendamento
    // Isso permite que a consulta seja iniciada com Socket.IO e WebRTC
    router.push(`/consulta/nova?agendamento_id=${consultation.id}&patient_id=${consultation.patient_id}&patient_name=${encodeURIComponent(consultation.patient_name)}&consultation_type=${consultation.consultation_type}`);
  };

  // Função para salvar alterações da ANAMNESE e mudar para próxima etapa (DIAGNOSTICO SENDO PROCESSADO)
  const handleSaveAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);

      // Verificar se já existe diagnóstico gerado - se sim, apenas avançar sem reprocessar
      const shouldGenerate = !hasDiagnosticoData();

      // Atualiza a etapa da consulta para DIAGNOSTICO
      // Se os dados já existem, apenas atualiza a etapa sem alterar o status
      const updateData: any = {
        etapa: 'DIAGNOSTICO'
      };

      // Só altera o status se precisar gerar (não se já existe)
      if (shouldGenerate) {
        updateData.status = 'PROCESSING';
      }

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, updateData);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Disparar webhook apenas se precisar gerar (não se já existe)
      if (shouldGenerate) {
        try {
          const webhookEndpoints = getWebhookEndpoints();
          const webhookHeaders = getWebhookHeaders();

          await fetch(webhookEndpoints.diagnosticoPrincipal, {
            method: 'POST',
            headers: webhookHeaders,
            body: JSON.stringify({
              consultaId: consultaDetails.id,
              medicoId: consultaDetails.doctor_id,
              pacienteId: consultaDetails.patient_id
            }),
          });
          console.log('✅ Webhook de diagnóstico disparado com sucesso');
        } catch (webhookError) {
          console.warn('⚠️ Webhook de diagnóstico falhou, mas consulta foi atualizada:', webhookError);
        }
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);

      // Navegar automaticamente para a seção de Diagnóstico
      setSelectedSection('DIAGNOSTICO');

      // Mensagem de sucesso apropriada
      if (shouldGenerate) {
        showSuccess('Diagnóstico em processamento!', 'Sucesso');
      } else {
        showSuccess('Avançando para Diagnóstico...', 'Sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para solicitar confirmação antes de avançar
  const requestAdvanceConfirmation = (action: () => Promise<void>, message: string) => {
    setAdvanceAction(() => action);
    setAdvanceMessage(message);
    setShowAdvanceModal(true);
  };

  // Função para confirmar avanço de etapa
  const confirmAdvance = async () => {
    if (advanceAction) {
      setShowAdvanceModal(false);
      await advanceAction();
      setAdvanceAction(null);
      setAdvanceMessage('');
    }
  };

  // Função para cancelar avanço
  const cancelAdvance = () => {
    setShowAdvanceModal(false);
    setAdvanceAction(null);
    setAdvanceMessage('');
  };

  // Função para salvar alterações do DIAGNÓSTICO e mudar para etapa de SOLUÇÃO
  const handleSaveDiagnosticoAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);

      // Verificar se já existe solução gerada - se sim, apenas avançar sem reprocessar
      const shouldGenerate = !hasSolucaoData();

      // Se precisar gerar solução, verificar se anamnese está preenchida
      if (shouldGenerate && consultaDetails.patient_id) {
        const isAnamnesePreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
        setAnamnesePreenchida(isAnamnesePreenchida);

        if (!isAnamnesePreenchida) {
          showWarning(
            'A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.',
            'Anamnese Não Preenchida'
          );
          setIsSaving(false);
          return;
        }
      }

      // Atualiza a etapa da consulta para SOLUCAO sem definir solucao_etapa (mostra tela de seleção)
      // Se os dados já existem, apenas atualiza a etapa sem alterar o status
      const updateData: any = {
        etapa: 'SOLUCAO',
        solucao_etapa: null
      };

      // Só altera o status se precisar gerar (não se já existe)
      if (shouldGenerate) {
        updateData.status = 'PROCESSING';
      }

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, updateData);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Disparar webhook apenas se precisar gerar (não se já existe)
      if (shouldGenerate) {
        try {
          // Usar proxy do backend para evitar CORS
          await gatewayClient.post('/webhooks/edicao-livro-da-vida', {
            consultaId: consultaDetails.id,
            medicoId: consultaDetails.doctor_id,
            pacienteId: consultaDetails.patient_id
          });
          console.log('✅ Webhook de solução disparado com sucesso');
        } catch (webhookError) {
          console.warn('⚠️ Webhook de solução falhou, mas consulta foi atualizada:', webhookError);
        }
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);

      // Navegar automaticamente para a tela de seleção de soluções
      setForceShowSolutionSelection(true);
      setSelectedSection(null);

      // Mensagem de sucesso apropriada
      if (shouldGenerate) {
        showSuccess('Solução em processamento!', 'Sucesso');
      } else {
        showSuccess('Avançando para Solução...', 'Sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };


  // Função para salvar alterações do Livro da Vida e mudar para ALIMENTACAO
  const handleSaveMentalidadeAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para ALIMENTACAO (NOTA: Pulando para SUPLEMENTACAO)
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'SUPLEMENTACAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do ALIMENTACAO e mudar para SUPLEMENTACAO
  const handleSaveAlimentacaoAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para SUPLEMENTACAO
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'SUPLEMENTACAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do SUPLEMENTACAO e mudar para ATIVIDADE_FISICA
  const handleSaveSuplemementacaoAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para ATIVIDADE_FISICA
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'ATIVIDADE_FISICA'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Funções de formatação para lista
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoje, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === -1) {
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

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatConsultaHorario = (consulta: Consultation) => {
    if (consulta.consulta_inicio && consulta.consulta_fim) {
      const data = formatDateOnly(consulta.consulta_inicio);
      const inicio = formatTime(consulta.consulta_inicio);
      const fim = formatTime(consulta.consulta_fim);
      return `${data} ${inicio} - ${fim}`;
    } else if (consulta.consulta_inicio) {
      const data = formatDateOnly(consulta.consulta_inicio);
      const inicio = formatTime(consulta.consulta_inicio);
      return `${data} ${inicio}`;
    } else {
      return formatFullDate(consulta.created_at);
    }
  };

  const formatDuration = (input?: number | Consultation) => {
    if (!input) return 'N/A';

    let durationInSeconds: number | null = null;

    if (typeof input === 'number') {
      durationInSeconds = input;
    } else {
      // 1. Tentar campo duration (em segundos)
      if (input.duration && input.duration > 0) {
        durationInSeconds = input.duration;
      }
      // 2. Tentar campo duracao (pode estar em minutos)
      else if ((input as any).duracao && (input as any).duracao > 0) {
        const duracaoMinutos = Number((input as any).duracao);
        if (duracaoMinutos > 0 && duracaoMinutos < 1440) {
          durationInSeconds = Math.floor(duracaoMinutos * 60);
        }
      }
      // 3. Calcular a partir de consulta_inicio e consulta_fim
      else if (input.consulta_inicio && input.consulta_fim) {
        try {
          const inicio = new Date(input.consulta_inicio);
          const fim = new Date(input.consulta_fim);
          if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
          }
        } catch (error) {
          console.error('Erro ao calcular duração no formatDuration global:', error);
        }
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const secs = durationInSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes} min`;
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
      case 'VALIDATION': return 'status-processing';
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
      case 'VALIDATION': return 'Validação';
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

  const avatarUserIcon = <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

  const generateAvatar = (name: string, profilePic?: string) => {
    if (profilePic) {
      return (
        <div className="patient-avatar">
          <img
            src={profilePic}
            alt={name}
            className="avatar-image"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '';
                parent.className = 'avatar-placeholder';
                parent.style.background = '#1B4266';
                parent.style.width = '48px';
                parent.style.height = '48px';
                parent.style.borderRadius = '50%';
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
                parent.style.color = 'white';
                parent.style.flexShrink = '0';
                parent.style.boxShadow = '0 4px 12px rgba(27, 66, 102, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                // Inserir ícone SVG de bonequinho
                parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
              }
            }}
          />
        </div>
      );
    }

    return (
      <div
        className="avatar-placeholder"
        style={{ background: '#1B4266' }}
      >
        {avatarUserIcon}
      </div>
    );
  };

  // Renderizar loading único - aguardar apenas dashboard, CSS e loadingDetails
  if (!dashboardLoaded || !cssLoaded || loadingDetails) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f9fafb',
        color: '#1f2937',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #1B4266',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
            Carregando...
          </p>
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
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
            onClick={() => consultaId ? fetchConsultaDetails(consultaId) : loadConsultations(true)}
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


  // Funções auxiliares para verificar se há dados disponíveis
  // Anamnese sempre está acessível (primeira etapa)
  const hasAnamneseData = (): boolean => {
    return true; // Anamnese sempre acessível
  };

  // Verifica se há dados de anamnese validados (para texto do botão)
  const hasValidAnamneseData = (): boolean => {
    if (!consultaDetails) return false;
    return consultaDetails.status === 'VALID_ANAMNESE' ||
      (consultaDetails.status === 'VALIDATION' && consultaDetails.etapa === 'ANAMNESE') ||
      consultaDetails.etapa === 'DIAGNOSTICO' ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'VALID_DIAGNOSTICO' ||
      consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  const hasDiagnosticoData = (): boolean => {
    if (!consultaDetails) return false;
    return consultaDetails.status === 'VALID_DIAGNOSTICO' ||
      (consultaDetails.status === 'VALIDATION' && consultaDetails.etapa === 'DIAGNOSTICO') ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  // Verifica se há dados de solução disponíveis (só acessível quando solução já foi gerada)
  const hasSolucaoData = (): boolean => {
    if (!consultaDetails) return false;
    // Solução acessível APENAS quando solução já foi gerada/validada
    return consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  // Função para renderizar o conteúdo baseado no status e etapa
  const renderConsultationContent = (): 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO_MENTALIDADE' | 'SOLUCAO_SUPLEMENTACAO' | 'SOLUCAO_ALIMENTACAO' | 'SOLUCAO_ATIVIDADE_FISICA' | 'SELECT_SOLUCAO' | JSX.Element | null => {
    if (!consultaDetails) return null;

    // 🔍 DEBUG: Log do status e etapa da consulta
    console.log('🔍 DEBUG renderConsultationContent:', {
      status: consultaDetails.status,
      etapa: consultaDetails.etapa,
      solucao_etapa: consultaDetails.solucao_etapa
    });

    // STATUS = PROCESSING
    if (consultaDetails.status === 'PROCESSING') {
      // Definir mensagens baseadas na etapa
      let titulo = 'Processando Consulta';
      let descricao = 'As informações da consulta estão sendo processadas';

      if (consultaDetails.etapa === 'DIAGNOSTICO') {
        titulo = 'Processando Diagnóstico';
        descricao = 'As informações do diagnóstico estão sendo processadas';
      }
      if (consultaDetails.etapa === 'SOLUCAO') {
        titulo = 'Processando Solução';
        descricao = 'As informações da solução estão sendo processadas';
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #f0f0f0',
          textAlign: 'center',
          minHeight: '400px'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
          <h2 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{titulo}</h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>{descricao}</p>
        </div>
      );
    }

    // STATUS = COMPLETED
    if (consultaDetails.status === 'COMPLETED') {
      return (
        <div className="modal-overlay">
          <div className="modal-content completion-modal-content">
            <Sparkles className="completion-icon" />
            <h2 className="completion-title">
              Processamento Concluído
            </h2>
            <p className="completion-message">
              A consulta foi processada com sucesso. <br />
              A tela de visualização completa será implementada em breve.
            </p>
            <button
              onClick={handleBackToList}
              className="btn-completion-back"
            >
              Voltar para lista
            </button>
          </div>
        </div>
      );
    }

    // STATUS = VALID_ANAMNESE
    if (consultaDetails.status === 'VALID_ANAMNESE') {
      // Retorna a tela atual de anamnese (será renderizado depois)
      return 'ANAMNESE';
    }

    // STATUS = VALID_DIAGNOSTICO
    if (consultaDetails.status === 'VALID_DIAGNOSTICO') {
      // Retorna a tela de diagnóstico (será renderizado depois)
      return 'DIAGNOSTICO';
    }

    // STATUS = VALID_SOLUCAO
    if (consultaDetails.status === 'VALID_SOLUCAO') {
      console.log('🔍 [renderConsultationContent] STATUS = VALID_SOLUCAO, solucao_etapa:', consultaDetails.solucao_etapa);

      // Se for MENTALIDADE, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'MENTALIDADE') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_MENTALIDADE');
        return 'SOLUCAO_MENTALIDADE';
      }

      // Se for SUPLEMENTACAO, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'SUPLEMENTACAO') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_SUPLEMENTACAO');
        return 'SOLUCAO_SUPLEMENTACAO';
      }

      // Se for ALIMENTACAO, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'ALIMENTACAO') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_ALIMENTACAO');
        return 'SOLUCAO_ALIMENTACAO';
      }

      // Se for ATIVIDADE_FISICA, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'ATIVIDADE_FISICA') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_ATIVIDADE_FISICA');
        return 'SOLUCAO_ATIVIDADE_FISICA';
      }

      // Se não tiver solucao_etapa definida, mostrar tela de seleção
      console.log('⚠️ [renderConsultationContent] solucao_etapa não definida, retornando SELECT_SOLUCAO');
      return 'SELECT_SOLUCAO';
    }

    // STATUS = VALIDATION (mantido para compatibilidade)
    if (consultaDetails.status === 'VALIDATION') {
      // ETAPA = ANAMNESE
      if (consultaDetails.etapa === 'ANAMNESE') {
        // Retorna a tela atual de anamnese (será renderizado depois)
        return 'ANAMNESE';
      }

      // ETAPA = DIAGNOSTICO
      if (consultaDetails.etapa === 'DIAGNOSTICO') {
        // Retorna a tela de diagnóstico (será renderizado depois)
        //console.log('🔍 renderConsultationContent - Retornando DIAGNOSTICO para consulta:', consultaDetails.id);
        return 'DIAGNOSTICO';
      }

      // ETAPA = SOLUCAO
      if (consultaDetails.etapa === 'SOLUCAO') {
        // Se não houver solucao_etapa definida, mostrar tela de seleção
        if (!consultaDetails.solucao_etapa) {
          return 'SELECT_SOLUCAO';
        }

        // Se for MENTALIDADE, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'MENTALIDADE') {
          return 'SOLUCAO_MENTALIDADE';
        }

        // Se for SUPLEMENTACAO, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'SUPLEMENTACAO') {
          return 'SOLUCAO_SUPLEMENTACAO';
        }

        // Se for ALIMENTACAO, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'ALIMENTACAO') {
          return 'SOLUCAO_ALIMENTACAO';
        }

        // Se for ATIVIDADE_FISICA, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'ATIVIDADE_FISICA') {
          console.log('🔍 DEBUG [REFERENCIA] Solução etapa é ATIVIDADE_FISICA, retornando SOLUCAO_ATIVIDADE_FISICA');
          return 'SOLUCAO_ATIVIDADE_FISICA';
        }

      }
    }

    // Retorna ANAMNESE como padrão para outros casos
    return 'ANAMNESE';
  };

  // Renderizar detalhes da consulta (forceRender usado para garantir re-render)
  console.log(`🎯 [RENDER #${forceRender}]`, consultaDetails ? `Detalhes: ${consultaDetails.id}` : 'Lista de consultas');
  if (consultaDetails) {
    console.log('✅ [RENDER] RENDERIZANDO DETALHES! Status:', consultaDetails.status);

    // Bloqueio para consultas em andamento (gravando) ou agendadas
    if (consultaDetails.status === 'RECORDING' || consultaDetails.status === 'CREATED' || consultaDetails.status === 'AGENDAMENTO') {
      const isAgendamento = consultaDetails.status === 'AGENDAMENTO';
      return (
        <div className="consultas-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: isAgendamento ? '#DBEAFE' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            {isAgendamento ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            )}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            {isAgendamento ? 'Consulta Agendada' : 'Consulta em Andamento'}
          </h2>
          <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, maxWidth: 400, marginBottom: 24 }}>
            {isAgendamento
              ? 'Esta consulta está agendada. Os detalhes estarão disponíveis após a realização da consulta.'
              : 'Esta consulta está sendo realizada no momento. Os detalhes estarão disponíveis após a finalização da gravação.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: isAgendamento ? '#DBEAFE' : '#FEF3C7', borderRadius: 10, marginBottom: 24 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: isAgendamento ? '#2563EB' : '#EF4444', animation: isAgendamento ? undefined : 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: isAgendamento ? '#1E40AF' : '#92400E' }}>
              {isAgendamento ? 'Aguardando consulta...' : consultaDetails.status === 'RECORDING' ? 'Gravando...' : 'Aguardando inicio...'}
            </span>
          </div>
          <button onClick={handleBackToList} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: '#1B4266', color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Voltar para Lista
          </button>
        </div>
      );
    }

    // Se showSolutionsViewer for true, renderiza o visualizador de soluções
    if (showSolutionsViewer) {
      return (
        <SolutionsViewer
          consultaId={consultaId!}
          onBack={() => setShowSolutionsViewer(false)}
          onSolutionSelect={(solutionType) => {
            // Mapear o tipo de solução para a etapa correspondente
            const solutionMapping: Record<string, string> = {
              'mentalidade': 'MENTALIDADE',
              'alimentacao': 'ALIMENTACAO',
              'suplementacao': 'SUPLEMENTACAO',
              'exercicios': 'ATIVIDADE_FISICA'
            };

            const etapa = solutionMapping[solutionType] as 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA' | undefined;
            if (etapa) {
              // Atualizar a consulta com a etapa selecionada
              handleSelectSolucao(etapa);
              // Voltar para a tela principal
              setShowSolutionsViewer(false);
            }
          }}
        />
      );
    }

    // Se forceShowSolutionSelection for true, renderizar a tela de seleção de soluções diretamente
    if (forceShowSolutionSelection) {
      // Renderizar a tela de seleção de soluções diretamente, sem depender do renderConsultationContent
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button
              className="back-button"
              onClick={() => {
                setForceShowSolutionSelection(false);
                setSelectedSection(null);
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title">Selecionar Solução</h1>
          </div>

          <div className="selecionar-solucao-content">
            <div className="selecionar-solucao-header">
              <h2 className="selecionar-solucao-title">
                Escolha uma das soluções para continuar:
              </h2>
              <p className="selecionar-solucao-subtitle">
                Selecione a solução que deseja implementar para este paciente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="download-docx-button selecionar-solucao-docx-btn"
                  onClick={handleDownloadAllDocx}
                  disabled={downloadingDocx}
                  title="Baixar todas as soluções em um documento Word editável (DOCX)"
                >
                  <FileDown className="w-5 h-5" />
                  {downloadingDocx ? 'Gerando...' : 'Baixar todas em DOCX'}
                </button>
              </div>
            </div>

            <div className="selecionar-solucao-grid">
              {/* Livro da Vida */}
              <div
                className="solucao-card solucao-card-select solucao-card-mentalidade"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em MENTALIDADE');
                  handleSelectSolucao('MENTALIDADE');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                  </svg>
                </div>
                <h3>Livro da Vida</h3>
                <p>Transformação Mental e Emocional</p>
              </div>

              {/* Alimentação */}
              <div
                className="solucao-card solucao-card-select solucao-card-alimentacao"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ALIMENTACAO');
                  handleSelectSolucao('ALIMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3>Alimentação</h3>
                <p>Plano Nutricional Personalizado</p>
              </div>

              {/* Suplementação */}
              <div
                className="solucao-card solucao-card-select solucao-card-suplementacao"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em SUPLEMENTACAO');
                  handleSelectSolucao('SUPLEMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3>Suplementação</h3>
                <p>Protocolo de Suplementos</p>
              </div>

              {/* Atividade Física */}
              <div
                className="solucao-card solucao-card-select solucao-card-atividade"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ATIVIDADE_FISICA');
                  handleSelectSolucao('ATIVIDADE_FISICA');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5h11l-1 7h-9l1-7z"></path>
                    <path d="M9.5 6.5V4.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v2"></path>
                    <path d="M12 13.5v5"></path>
                    <path d="M8 16.5h8"></path>
                  </svg>
                </div>
                <h3>Atividade Física</h3>
                <p>Programa de Exercícios</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se o status for PROCESSING, mostrar a tela de processamento
    if (consultaDetails.status === 'PROCESSING') {
      const contentType = renderConsultationContent();
      if (typeof contentType !== 'string' && contentType !== null) {
        // Se retornou JSX (tela de processamento), renderizar
        return (
          <div className="consultas-container consultas-details-container">
            <div className="consultas-header">
              <button
                className="back-button"
                onClick={handleBackToList}
                style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <h1 className="consultas-title">Processando</h1>
            </div>
            <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
              {contentType}
            </div>
          </div>
        );
      }
    }

    // Se selectedSection for null e não há solução selecionada, mostrar a tela intermediária
    // Se há uma solução selecionada (solucao_etapa), renderConsultationContent vai determinar qual tela mostrar
    // A tela intermediária (overview) só aparece quando não há solução selecionada E selectedSection é null
    if (selectedSection === null && !forceShowSolutionSelection && !consultaDetails.solucao_etapa) {
      return (
        <ConsultationDetailsOverview
          consultaDetails={consultaDetails}
          patientId={consultaDetails.patient_id}
          hasAnamneseData={hasAnamneseData}
          hasDiagnosticoData={hasDiagnosticoData}
          hasSolucaoData={hasSolucaoData}
          onNavigateToSection={(section) => {
            if (section === 'ANAMNESE') {
              // Anamnese sempre acessível (primeira etapa)
              setSelectedSection('ANAMNESE');
            } else if (section === 'DIAGNOSTICO') {
              // Verificar se há dados de diagnóstico antes de permitir acesso
              if (hasDiagnosticoData()) {
                setSelectedSection('DIAGNOSTICO');
              }
            } else if (section === 'SOLUCOES') {
              // Verificar se há dados de solução antes de permitir acesso
              if (hasSolucaoData()) {
                // Para soluções, forçar a renderização da tela de seleção de soluções imediatamente
                setForceShowSolutionSelection(true);
                setSelectedSection(null);
                setShowSolutionsViewer(false);
              } else {
                // Se não houver dados, não permitir acesso
                return;
              }
              // Atualizar a consulta em background para garantir que solucao_etapa seja null
              // Mas não esperar por isso para renderizar a tela
              if (consultaId) {
                gatewayClient.patch(`/consultations/${consultaId}`, { solucao_etapa: null })
                  .then(() => {
                    fetchConsultaDetails(consultaId, true); // silent = true para não mostrar loading
                  }).catch((error) => {
                    console.error('Erro ao atualizar solucao_etapa:', error);
                  });
              }
            } else if (section === 'EXAMES') {
              setSelectedSection('EXAMES');
            } else if (section === 'EVOLUCAO') {
              setSelectedSection('EVOLUCAO');
            }
          }}
          onBack={handleBackToList}
        />
      );
    }

    // Se selectedSection for 'ANAMNESE', renderizar a seção de anamnese diretamente
    if (selectedSection === 'ANAMNESE') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      // Renderizar a tela de anamnese completa com botão flutuante e sidebar de chat
      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header">
            <button
              className="back-button"
              onClick={() => {
                setSelectedSection(null);
                // Remover o parâmetro section da URL se existir
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('section');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title">
              {consultaDetails.status === 'VALID_ANAMNESE' ? 'Detalhes da Consulta - Análise' : 'Detalhes da Consulta - Anamnese'}
            </h1>
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <StatusBadge status={mapBackendStatus(consultaDetails.status)} />
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Tabs com Navegação */}
          <div className="anamnese-tabs-container">
            <div className="anamnese-tabs">
              {[
                'Síntese',
                'Dados do Paciente',
                'Objetivos e Queixas',
                'Histórico de Risco',
                'Observação Clínica e Laboratorial',
                'História de vida',
                'Setênios e Eventos',
                'Ambiente e Contexto',
                'Sensação e Emoções',
                'Preocupações e Crenças',
                'Reino e Miasma'
              ].map((tab) => (
                <button
                  key={tab}
                  className={`anamnese-tab ${activeAnamneseTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveAnamneseTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Botão Avançar para Diagnóstico - Movido para o topo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 0', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const message = hasDiagnosticoData()
                  ? 'Avançar para a etapa de Diagnóstico?'
                  : 'Você está prestes a avançar para a etapa de Diagnóstico. Esta ação iniciará o processamento do diagnóstico integrativo. Deseja continuar?';
                requestAdvanceConfirmation(handleSaveAndContinue, message);
              }}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: isSaving ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {hasValidAnamneseData() ? 'Avançar para Diagnóstico' : 'Gerar Diagnóstico'}
                </>
              )}
            </button>
          </div>

          {/* Conteúdo da Anamnese */}
          <div className="anamnese-content-wrapper">
            <AnamneseSection
              consultaId={consultaDetails?.id || consultaId || ''}
              patientId={consultaDetails?.patient_id}
              selectedField={selectedField}
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              onFieldSelect={handleFieldSelect}
              onSendMessage={handleSendAIMessage}
              onChatInputChange={setChatInput}
              readOnly={false}
              consultaStatus={consultaDetails?.status}
              consultaEtapa={consultaDetails?.etapa}
              activeTab={activeAnamneseTab}
            />
          </div>


          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Análise</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo da anamnese para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              {selectedField && (
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder="Descreva como deseja editar este campo..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAIMessage();
                      }
                    }}
                    rows={3}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleSendAIMessage}
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Overlay para fechar o sidebar ao clicar fora */}
          {showAIChat && (
            <div className="ai-chat-overlay" onClick={() => setShowAIChat(false)}></div>
          )}

          {/* Modal de Confirmação de Avanço de Etapa */}
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Se selectedSection for 'DIAGNOSTICO', renderizar a seção de diagnóstico
    if (selectedSection === 'DIAGNOSTICO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      // Renderizar a tela de diagnóstico completa com botão flutuante e sidebar de chat
      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header">
            <button
              className="back-button"
              onClick={() => {
                setSelectedSection(null);
                // Remover o parâmetro section da URL se existir
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('section');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title">Detalhes da Consulta - Diagnóstico</h1>
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <StatusBadge status={mapBackendStatus(consultaDetails.status)} />
                </div>
              </div>
            </div>
          </div>

          {/* Menu de Tabs do Diagnóstico */}
          <div className="anamnese-tabs-container">
            <div className="anamnese-tabs">
              {[
                'Diagnóstico Principal',
                'Estado Geral',
                'Estado Mental',
                'Estado Fisiológico',
                'Integração Diagnóstica',
                'Hábitos de Vida'
              ].map((tab) => (
                <button
                  key={tab}
                  className={`anamnese-tab ${activeDiagnosticoTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveDiagnosticoTab(activeDiagnosticoTab === tab ? undefined : tab)}
                  title={activeDiagnosticoTab === tab ? 'Clique para mostrar todas as seções' : `Clique para ver apenas: ${tab}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Botão Avançar para Solução - Abaixo do menu */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 0', marginBottom: '20px', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {!hasSolucaoData() && anamnesePreenchida === false && (
              <div style={{
                padding: '12px 16px',
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: '8px',
                color: '#92400E',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                width: '100%',
                maxWidth: '600px'
              }}>
                <AlertTriangle size={18} />
                <span style={{ flex: 1 }}>A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.</span>
                <button
                  onClick={async () => {
                    if (consultaDetails?.patient_id) {
                      const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
                      setAnamnesePreenchida(isPreenchida);
                      if (isPreenchida) {
                        showSuccess('Anamnese verificada! O botão foi liberado.', 'Anamnese Verificada');
                      } else {
                        showWarning('A anamnese ainda não foi preenchida.', 'Anamnese Pendente');
                      }
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}
                  title="Verificar novamente"
                >
                  Verificar Novamente
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Se anamnese não estiver preenchida e precisar gerar, bloquear
                if (!hasSolucaoData() && anamnesePreenchida === false) {
                  showWarning(
                    'A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.',
                    'Anamnese Não Preenchida'
                  );
                  return;
                }
                const message = hasSolucaoData()
                  ? 'Avançar para a etapa de Solução?'
                  : 'Você está prestes a avançar para a etapa de Solução. Esta ação iniciará o processamento da solução integrativa. Deseja continuar?';
                requestAdvanceConfirmation(handleSaveDiagnosticoAndContinue, message);
              }}
              disabled={isSaving || (!hasSolucaoData() && anamnesePreenchida === false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: (isSaving || (!hasSolucaoData() && anamnesePreenchida === false)) ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: (isSaving || (!hasSolucaoData() && anamnesePreenchida === false)) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {hasSolucaoData() ? 'Avançar para Solução' : 'Gerar Solução'}
                </>
              )}
            </button>
          </div>

          {/* Conteúdo do Diagnóstico */}
          <div className="anamnese-content-wrapper">
            <DiagnosticoSection
              consultaId={consultaDetails?.id || consultaId || ''}
              selectedField={selectedField}
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              onFieldSelect={handleFieldSelect}
              onSendMessage={handleSendAIMessage}
              onChatInputChange={setChatInput}
              activeTab={activeDiagnosticoTab}
            />
          </div>

          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Diagnóstico</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo do diagnóstico para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              {selectedField && (
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder="Descreva como deseja editar este campo..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAIMessage();
                      }
                    }}
                    rows={3}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleSendAIMessage}
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Overlay para fechar o sidebar ao clicar fora */}
          {showAIChat && (
            <div className="ai-chat-overlay" onClick={() => setShowAIChat(false)}></div>
          )}

          {/* Modal de Confirmação de Avanço de Etapa */}
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Se selectedSection for 'EXAMES', renderizar a seção de exames
    if (selectedSection === 'EXAMES') {
      if (!consultaDetails || !consultaId) {
        return (
          <div className="consultas-container consultas-details-container">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <div className="loading-spinner"></div>
            </div>
          </div>
        );
      }
      return (
        <ExamesSection
          consultaDetails={consultaDetails}
          consultaId={consultaId}
          onBack={() => setSelectedSection(null)}
        />
      );
    }

    if (selectedSection === 'EVOLUCAO') {
      if (!consultaDetails || !consultaId) {
        return (
          <div className="consultas-container consultas-details-container">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <div className="loading-spinner"></div>
            </div>
          </div>
        );
      }
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={() => setSelectedSection(null)}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Evolucao Mensal</h1>
          </div>
          <div style={{ padding: '0 8px' }}>
            <EvolucaoSection
              consultaId={consultaId}
              patientId={consultaDetails.patient_id}
              patientName={consultaDetails.patient_name}
            />
          </div>
        </div>
      );
    }

    console.log('🔄 [RENDER] Chamando renderConsultationContent()...');
    const contentType = renderConsultationContent();
    console.log('✅ [RENDER] renderConsultationContent retornou:', contentType);

    // Se renderConsultationContent retornar 'ANAMNESE', definir selectedSection como 'ANAMNESE'
    // e retornar null para que o componente re-renderize com a nova tela
    if (contentType === 'ANAMNESE') {
      if ((selectedSection as string) !== 'ANAMNESE') {
        // Usar useEffect para evitar problemas de renderização
        // Mas como estamos dentro do render, vamos usar um efeito via requestAnimationFrame
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => {
            setSelectedSection('ANAMNESE');
          });
        }
        // Retornar um loading temporário enquanto o estado é atualizado
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <div className="loading-spinner"></div>
          </div>
        );
      }
    }

    // Se for SELECT_SOLUCAO, renderiza a tela de seleção de soluções
    if (typeof contentType === 'string' && contentType === 'SELECT_SOLUCAO') {
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button
              className="back-button"
              onClick={handleBackToList}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title">Selecionar Solução</h1>
          </div>

          <div className="selecionar-solucao-content">
            <div className="selecionar-solucao-header">
              <h2 className="selecionar-solucao-title">
                Escolha uma das soluções para continuar:
              </h2>
              <p className="selecionar-solucao-subtitle">
                Selecione a solução que deseja implementar para este paciente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="download-docx-button selecionar-solucao-docx-btn"
                  onClick={handleDownloadAllDocx}
                  disabled={downloadingDocx}
                  title="Baixar todas as soluções em um documento Word editável (DOCX)"
                >
                  <FileDown className="w-5 h-5" />
                  {downloadingDocx ? 'Gerando...' : 'Baixar todas em DOCX'}
                </button>
              </div>
            </div>

            <div className="selecionar-solucao-grid">
              {/* Livro da Vida */}
              <div
                className="solucao-card solucao-card-select solucao-card-mentalidade"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em MENTALIDADE');
                  handleSelectSolucao('MENTALIDADE');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                  </svg>
                </div>
                <h3>Livro da Vida</h3>
                <p>Transformação Mental e Emocional</p>
              </div>

              {/* Alimentação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ALIMENTACAO');
                  handleSelectSolucao('ALIMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"></path>
                    <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Alimentação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Plano Nutricional Personalizado</p>
              </div>

              {/* Suplementação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em SUPLEMENTACAO');
                  handleSelectSolucao('SUPLEMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Suplementação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Protocolo de Suplementos</p>
              </div>

              {/* Atividade Física */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ATIVIDADE_FISICA');
                  handleSelectSolucao('ATIVIDADE_FISICA');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5h11l-1 7h-9l1-7z"></path>
                    <path d="M9.5 6.5V4.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v2"></path>
                    <path d="M12 13.5v5"></path>
                    <path d="M8 16.5h8"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Atividade Física</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Programa de Exercícios</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for DIAGNOSTICO, renderiza a tela de diagnóstico
    if (typeof contentType === 'string' && contentType === 'DIAGNOSTICO') {
      //console.log('🔍 Renderizando tela de DIAGNOSTICO para consulta:', consultaId);
      return (
        <>
          <div className="consultas-container consultas-details-container">
            <div className="consultas-header">
              <button
                className="back-button"
                onClick={handleBackToList}
                style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <h1 className="consultas-title">Diagnóstico</h1>
            </div>

            {/* Informações da Consulta - Card no Topo */}
            <div className="consultation-info-card">
              <div className="consultation-info-grid">
                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Paciente</span>
                    <span className="info-value">{consultaDetails.patient_name}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Data/Hora Início</span>
                    <span className="info-value">
                      {consultaDetails.consulta_inicio
                        ? `${formatDateOnly(consultaDetails.consulta_inicio)} ${formatTime(consultaDetails.consulta_inicio)}`
                        : formatFullDate(consultaDetails.created_at)}
                    </span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Data/Hora Fim</span>
                    <span className="info-value">
                      {(() => {
                        console.log('🔍 Renderizando Data/Hora Fim:', {
                          consulta_fim: consultaDetails.consulta_fim,
                          existe: !!consultaDetails.consulta_fim
                        });
                        return consultaDetails.consulta_fim
                          ? `${formatDateOnly(consultaDetails.consulta_fim)} ${formatTime(consultaDetails.consulta_fim)}`
                          : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    {consultaDetails.consultation_type === 'PRESENCIAL' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                  </div>
                  <div className="info-content">
                    <span className="info-label">Tipo</span>
                    <span className="info-value">{mapConsultationType(consultaDetails.consultation_type)}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Duração</span>
                    <span className="info-value">{formatDuration(consultaDetails)}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper status-icon">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Status</span>
                    <StatusBadge
                      status={mapBackendStatus(consultaDetails.status)}
                      size="md"
                      showIcon={true}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Anamnese (Consulta) - Movida para o topo para melhor visibilidade */}
            <div className="anamnese-container" style={{
              marginTop: '24px',
              marginBottom: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e5e7eb'
            }}>
              <div className="anamnese-header" style={{
                padding: '20px 24px',
                borderBottom: '2px solid #1B4266',
                background: 'linear-gradient(135deg, #fef7ed 0%, #fff7ed 100%)'
              }}>
                <h2 style={{
                  margin: 0,
                  color: '#1B4266',
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <FileText className="w-6 h-6" style={{ color: '#1B4266' }} />
                  Anamnese da Consulta
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '400'
                }}>
                  Informações coletadas durante a consulta
                </p>
              </div>
              <div className="anamnese-content" style={{ padding: '24px' }}>
                <AnamneseSection
                  consultaId={consultaDetails?.id || consultaId || ''}
                  selectedField={null}
                  chatMessages={[]}
                  isTyping={false}
                  chatInput=""
                  onFieldSelect={() => { }}
                  onSendMessage={() => { }}
                  onChatInputChange={() => { }}
                  readOnly={true}
                  renderViewSolutionsButton={renderViewSolutionsButton}
                />
              </div>
            </div>

            <div className="details-two-column-layout">
              {/* Coluna Esquerda - Chat com IA */}
              <div className="chat-column">
                <div className="chat-container">
                  <div className="chat-header">
                    <h3>Chat com IA - Assistente de Diagnóstico</h3>
                    {selectedField && (
                      <p className="chat-field-indicator">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        Editando: <strong>{selectedField.label}</strong>
                      </p>
                    )}
                  </div>

                  <div className="chat-messages">
                    {!selectedField ? (
                      <div className="chat-empty-state">
                        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-center">
                          Selecione um campo do diagnóstico clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
                        </p>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="chat-empty-state">
                        <p className="text-gray-500 text-center">
                          Digite uma mensagem para começar a conversa sobre <strong>{selectedField.label}</strong>
                        </p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={message.role === 'user' ? 'message user-message' : 'message ai-message'}
                          >
                            <div className={message.role === 'user' ? 'message-avatar user-avatar' : 'message-avatar ai-avatar'}>
                              {message.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                            </div>
                            <div className="message-content">
                              <p>{message.content}</p>
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="message ai-message">
                            <div className="message-avatar ai-avatar">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="message-content">
                              <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="chat-input-area">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Digite sua mensagem..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendAIMessage()}
                      disabled={!selectedField || isTyping}
                    />
                    <button
                      className="chat-send-button"
                      onClick={handleSendAIMessage}
                      disabled={!selectedField || !chatInput.trim() || isTyping}
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Coluna Direita - Diagnóstico + Anamnese (somente leitura) */}
              <div className="anamnese-column">
                <div className="anamnese-container">
                  <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Diagnóstico Integrativo</h2>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        requestAdvanceConfirmation(
                          handleSaveDiagnosticoAndContinue,
                          'Você está prestes a avançar para a etapa de Solução. Esta ação iniciará o processamento da solução integrativa. Deseja continuar?'
                        );
                      }}
                      disabled={isSaving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: isSaving ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = '#059669';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = '#10b981';
                        }
                      }}
                    >
                      {isSaving ? (
                        <>
                          <div className="loading-spinner-small"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Avançar
                        </>
                      )}
                    </button>
                  </div>

                  {/* Menu de Tabs do Diagnóstico */}
                  <div className="anamnese-tabs-container">
                    <div className="anamnese-tabs">
                      {[
                        'Diagnóstico Principal',
                        'Estado Geral',
                        'Estado Mental',
                        'Estado Fisiológico',
                        'Integração Diagnóstica',
                        'Hábitos de Vida'
                      ].map((tab) => (
                        <button
                          key={tab}
                          className={`anamnese-tab ${activeDiagnosticoTab === tab ? 'active' : ''}`}
                          onClick={() => setActiveDiagnosticoTab(activeDiagnosticoTab === tab ? undefined : tab)}
                          title={activeDiagnosticoTab === tab ? 'Clique para mostrar todas as seções' : `Clique para ver apenas: ${tab}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="anamnese-content">
                    <DiagnosticoSection
                      consultaId={consultaDetails?.id || consultaId || ''}
                      selectedField={selectedField}
                      chatMessages={chatMessages}
                      isTyping={isTyping}
                      chatInput={chatInput}
                      onFieldSelect={handleFieldSelect}
                      onSendMessage={handleSendAIMessage}
                      onChatInputChange={setChatInput}
                      activeTab={activeDiagnosticoTab}
                      consultaDetails={consultaDetails}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }

    // Se for SOLUCAO_MENTALIDADE, renderiza a tela de Livro da Vida
    if (contentType === 'SOLUCAO_MENTALIDADE') {
      // Funções auxiliares para formatação (mesmas da Anamnese)
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      const getStatusText = (status: string) => {
        switch (status) {
          case 'CREATED': return 'Criada';
          case 'RECORDING': return 'Gravando';
          case 'PROCESSING': return 'Processando';
          case 'VALIDATION': return 'Validação';
          case 'VALID_SOLUCAO': return 'Validação Solução';
          case 'COMPLETED': return 'Concluída';
          case 'ERROR': return 'Erro';
          case 'CANCELLED': return 'Cancelada';
          default: return status;
        }
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title" style={{ flex: 1 }}>Detalhes da Consulta - Livro da Vida</h1>
            {renderSolutionNavigationButtons()}
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <span className={`status-badge status-success status-badge-md status-badge-default`} style={{ '--status-bg': '#d1fae5', '--status-text': '#065f46', '--status-border': '#10b981' } as React.CSSProperties}>
                    <FileText className="status-icon" size={14} />
                    <span className="status-text">{getStatusText(consultaDetails.status)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="anamnese-content-wrapper">
            <div className="anamnese-sections">
              <MentalidadeSection
                consultaId={consultaId || ''}
                selectedField={selectedField}
                chatMessages={chatMessages}
                isTyping={isTyping}
                chatInput={chatInput}
                onFieldSelect={handleFieldSelect}
                onSendMessage={handleSendAIMessage}
                onChatInputChange={setChatInput}
                mentalidadeData={mentalidadeData}
              />
            </div>
          </div>

          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Livro da Vida</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo do Livro da Vida para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="chat-input-container">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Digite sua mensagem..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendAIMessage()}
                  disabled={!selectedField || isTyping}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendAIMessage}
                  disabled={!selectedField || !chatInput.trim() || isTyping}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_SUPLEMENTACAO, renderiza a tela de Suplementação
    if (contentType === 'SOLUCAO_SUPLEMENTACAO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Suplementação</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="anamnese-container">
            <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Protocolo de Suplementacao</h2>
              <button
                onClick={async () => {
                  try {
                    const { gerarReceitaPdf } = await import('@/lib/receitaPdf');

                    // Buscar dados do medico
                    const { data: medicoData } = await supabase
                      .from('medicos')
                      .select('name, crm, specialty, phone, email, logo_url')
                      .eq('user_auth', user?.id)
                      .maybeSingle();

                    // Buscar dados de suplementacao
                    const supResponse = await gatewayClient.get(`/solucao-suplementacao/${consultaDetails?.id || consultaId}`);

                    if (supResponse.success && supResponse.suplementacao_data) {
                      await gerarReceitaPdf({
                        suplementacaoData: supResponse.suplementacao_data,
                        medico: {
                          nome: medicoData?.name || 'Dr(a). Medico',
                          crm: medicoData?.crm || '',
                          especialidade: medicoData?.specialty || '',
                          telefone: medicoData?.phone || '',
                          email: medicoData?.email || '',
                          logo_url: medicoData?.logo_url || '',
                        },
                        paciente: {
                          nome: consultaDetails?.patient_name || '',
                          email: consultaDetails?.patients?.email || '',
                          telefone: consultaDetails?.patients?.phone || '',
                        },
                        dataConsulta: new Date(consultaDetails?.created_at || '').toLocaleDateString('pt-BR'),
                      });
                    }
                  } catch (err) {
                    console.error('Erro ao gerar PDF:', err);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', background: '#1A3D61', color: '#fff',
                  border: 'none', borderRadius: '10px', fontSize: '13px',
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0F172A'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1A3D61'; }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                Gerar Prescricao
              </button>
            </div>

            <div className="anamnese-content">
              <SuplemementacaoSection
                consultaId={consultaDetails?.id || consultaId || ''}
                userId={user?.id}
                patientName={consultaDetails?.patient_name}
              />
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_ATIVIDADE_FISICA, renderiza a tela de Atividade Física
    if (contentType === 'SOLUCAO_ATIVIDADE_FISICA') {
      console.log('🔍 DEBUG [REFERENCIA] Renderizando tela SOLUCAO_ATIVIDADE_FISICA - consultaDetails:', consultaDetails);
      console.log('🔍 DEBUG [REFERENCIA] atividadeFisicaData length:', atividadeFisicaData.length);

      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Atividade Física</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="anamnese-container" style={{ padding: '24px' }}>
            <div className="anamnese-content" style={{ padding: '0 8px' }}>
              {loadingAtividadeFisica ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Carregando exercicios fisicos...</p>
                </div>
              ) : atividadeFisicaData.length === 0 ? (
                <div>
                  {renderAddExercicioPanel(undefined, 'treino')}
                  <div className="no-data" style={{ padding: '40px', width: '100%', textAlign: 'center' }}>
                    <Dumbbell style={{ width: 48, height: 48, color: '#94A3B8', marginBottom: '16px' }} />
                    <h3 style={{ color: '#0F172A', marginBottom: 8 }}>Nenhum exercicio encontrado</h3>
                    <p style={{ color: '#64748B' }}>Adicione exercícios usando o botão acima ou seus favoritos.</p>
                  </div>
                </div>
              ) : (() => {
                const treinosAgrupados = atividadeFisicaData.reduce((acc, ex) => {
                  const treino = ex.nome_treino || 'Treino Sem Nome';
                  if (!acc[treino]) acc[treino] = [];
                  acc[treino].push(ex);
                  return acc;
                }, {} as Record<string, ExercicioFisico[]>);

                const treinoKeys = Object.keys(treinosAgrupados);
                const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

                // NIVEL 2: Detalhe do treino selecionado
                if (selectedTreino && treinosAgrupados[selectedTreino]) {
                  const exercicios = treinosAgrupados[selectedTreino];
                  const treinoIndex = treinoKeys.indexOf(selectedTreino);
                  const letter = letters[treinoIndex] || '';
                  const grupoMuscular = exercicios[0]?.grupo_muscular || '';
                  const totalSeries = exercicios.reduce((sum, ex) => sum + (parseInt(ex.series || '0') || 0), 0);

                  return (
                    <div>
                      <button
                        onClick={() => setSelectedTreino(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#1A3D61', fontSize: 14, fontWeight: 600,
                          padding: '8px 0', marginBottom: 20
                        }}
                      >
                        <ArrowLeft size={18} /> Voltar aos treinos
                      </button>

                      <div style={{
                        background: '#1A3D61', borderRadius: 16, padding: '24px 28px',
                        color: 'white', marginBottom: 24
                      }}>
                        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>
                          Treino {letter} - {(() => { const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']; return dias[treinoIndex % 7] || ''; })()}-feira
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{grupoMuscular || selectedTreino}</div>
                        <div style={{ display: 'flex', gap: 20, fontSize: 13, opacity: 0.8 }}>
                          <span>{exercicios.length} exercicios</span>
                          <span>{totalSeries} series totais</span>
                        </div>
                      </div>

                      {renderAddExercicioPanel(selectedTreino || undefined)}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {exercicios.map((exercicio, idx) => (
                          <div key={exercicio.id} style={{
                            background: '#FFFFFF', border: '1.5px solid #E2E8F0',
                            borderRadius: 14, padding: '20px 24px', position: 'relative'
                          }}>
                            {/* Botao excluir exercicio */}
                            <button
                              onClick={async () => {
                                try {
                                  await gatewayClient.post(`/atividade-fisica/${consultaId}/delete-item`, { exercicioId: exercicio.id });
                                  loadAtividadeFisicaData();
                                } catch (e) { console.error(e); }
                              }}
                              title="Excluir exercício"
                              style={{
                                position: 'absolute', top: 12, right: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 8,
                                border: '1px solid #E2E8F0', background: 'transparent',
                                color: '#94A3B8', cursor: 'pointer', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                            <div style={{
                              position: 'absolute', top: 20, left: 24,
                              width: 28, height: 28, borderRadius: '50%',
                              background: '#F1F5F9', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1A3D61'
                            }}>
                              {String(idx + 1).padStart(2, '0')}
                            </div>

                            <div style={{ marginLeft: 44 }}>
                              {editingExercicioId === exercicio.id ? (
                                /* MODO EDICAO */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Nome do Exercício</div>
                                    <input type="text" value={editExercicioForm.nome_exercicio ?? exercicio.nome_exercicio ?? ''}
                                      onChange={e => setEditExercicioForm(p => ({ ...p, nome_exercicio: e.target.value }))}
                                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #BAE6FD', borderRadius: 8, fontSize: 14, fontWeight: 600, boxSizing: 'border-box' as const }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Grupo Muscular</div>
                                    <input type="text" value={editExercicioForm.grupo_muscular ?? exercicio.grupo_muscular ?? ''}
                                      onChange={e => setEditExercicioForm(p => ({ ...p, grupo_muscular: e.target.value }))}
                                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }} />
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                    <div>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Séries</div>
                                      <input type="text" value={editExercicioForm.series ?? exercicio.series ?? ''}
                                        onChange={e => setEditExercicioForm(p => ({ ...p, series: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Repetições</div>
                                      <input type="text" value={editExercicioForm.repeticoes ?? exercicio.repeticoes ?? ''}
                                        onChange={e => setEditExercicioForm(p => ({ ...p, repeticoes: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Descanso</div>
                                      <input type="text" value={editExercicioForm.descanso ?? exercicio.descanso ?? ''}
                                        onChange={e => setEditExercicioForm(p => ({ ...p, descanso: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }} />
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Observações</div>
                                    <input type="text" value={editExercicioForm.observacoes ?? exercicio.observacoes ?? ''}
                                      onChange={e => setEditExercicioForm(p => ({ ...p, observacoes: e.target.value }))}
                                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <button onClick={() => { setEditingExercicioId(null); setEditExercicioForm({}); }}
                                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                      Cancelar
                                    </button>
                                    <button onClick={() => handleSaveExercicioEdit(exercicio.id)}
                                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#1A3D61', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* MODO VISUALIZACAO */
                                <>
                                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 }}>
                                    Nome do Exercicio
                                  </div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
                                    {exercicio.nome_exercicio || 'Sem nome'}
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>Series:</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{exercicio.series || '-'}</div>
                                    </div>
                                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>Repeticoes:</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{exercicio.repeticoes || '-'}</div>
                                    </div>
                                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>Descanso:</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{exercicio.descanso || '-'}</div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {/* Botao Editar */}
                                    <button
                                      onClick={() => { setEditingExercicioId(exercicio.id); setEditExercicioForm({}); }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        background: '#F1F5F9', border: '1.5px solid #E2E8F0',
                                        borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                                        fontSize: 13, fontWeight: 600, color: '#1A3D61',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                      Editar
                                    </button>
                                    {/* Botao Ajuda */}
                                    <button
                                      onClick={() => setVideoHelpExercicio(exercicio.nome_exercicio || '')}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        background: '#F1F5F9', border: '1.5px solid #E2E8F0',
                                        borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                                        fontSize: 13, fontWeight: 600, color: '#1A3D61',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
                                    >
                                      Ajuda
                                      <span style={{
                                        width: 18, height: 18, borderRadius: '50%',
                                        background: '#1A3D61', color: 'white',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 700
                                      }}>?</span>
                                    </button>
                                  </div>

                                  {exercicio.observacoes && (
                                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
                                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Observacoes:</div>
                                      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>{exercicio.observacoes}</div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // NIVEL 1: Lista de treinos da semana
                return (
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                      Treinos da semana
                    </h2>
                    <p style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>
                      Selecione um treino para ver os exercicios
                    </p>

                    {renderAddExercicioPanel(undefined, 'treino')}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {treinoKeys.map((nomeTreino, idx) => {
                        const exercicios = treinosAgrupados[nomeTreino];
                        const letter = letters[idx] || '';
                        const grupoMuscular = exercicios[0]?.grupo_muscular || '';
                        const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];
                        const dia = dias[idx % 7] || '';

                        return (
                          <button
                            key={nomeTreino}
                            onClick={() => setSelectedTreino(nomeTreino)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 16,
                              background: '#FFFFFF', border: '1.5px solid #E2E8F0',
                              borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
                              textAlign: 'left', transition: 'all 0.2s ease', width: '100%'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1A3D61'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,61,97,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <div style={{
                              width: 44, height: 44, borderRadius: 12,
                              background: '#1A3D61', color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 18, fontWeight: 700, flexShrink: 0
                            }}>
                              {letter}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                                Treino {letter} — {grupoMuscular || nomeTreino}
                              </div>
                              <div style={{ fontSize: 13, color: '#94A3B8' }}>
                                {dia}-feira - {exercicios.length} exercicios
                              </div>
                            </div>
                            <ChevronRight size={20} style={{ color: '#94A3B8' }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Popup de Video de Ajuda */}
          {videoHelpExercicio && (
            <div
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24
              }}
              onClick={() => setVideoHelpExercicio(null)}
            >
              <div
                style={{
                  background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 640,
                  overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderBottom: '1px solid #E2E8F0'
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                      Como executar
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      {videoHelpExercicio}
                    </div>
                  </div>
                  <button
                    onClick={() => setVideoHelpExercicio(null)}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: '1px solid #E2E8F0', background: '#F8FAFC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#64748B'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{
                  aspectRatio: '16/9', background: '#0F172A',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 12, color: '#94A3B8'
                }}>
                  <Play size={48} style={{ color: '#1A3D61' }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    Video em breve
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    O video demonstrativo sera adicionado pelo profissional
                  </span>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <button
                    onClick={() => setVideoHelpExercicio(null)}
                    style={{
                      padding: '10px 32px', background: '#1A3D61', color: 'white',
                      border: 'none', borderRadius: 10, fontSize: 14,
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Entendi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Se for SOLUCAO_ALIMENTACAO, renderiza a tela de Alimentação
    if (contentType === 'SOLUCAO_ALIMENTACAO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Alimentação</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Única - Alimentação */}
          <div className="single-column-layout">
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo de Alimentação</h2>
                  <button
                    onClick={handleSaveAlimentacaoAndContinue}
                    disabled={isSaving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      background: isSaving ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSaving) {
                        e.currentTarget.style.background = '#059669';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSaving) {
                        e.currentTarget.style.background = '#10b981';
                      }
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Próximo
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <AlimentacaoSection
                    consultaId={consultaDetails?.id || consultaId || ''}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Quando renderConsultationContent retorna 'ANAMNESE' mas selectedSection é null,
    // devemos mostrar a tela de overview (não a tela antiga de anamnese)
    // A tela de overview já foi renderizada acima quando selectedSection === null
    // Então não precisamos fazer nada aqui quando contentType === 'ANAMNESE' && selectedSection === null

    // Se renderConsultationContent retornou 'ANAMNESE' mas selectedSection é null,
    // devemos mostrar a tela de overview (que já foi renderizada acima)
    // Não renderizar a tela antiga quando selectedSection é null
    if (contentType === 'ANAMNESE' && selectedSection === null) {
      // A tela de overview já foi renderizada na condição acima
      // Retornar null para evitar renderizar a tela antiga
      return null;
    }

    // Se for um modal (não ANAMNESE, não DIAGNOSTICO, não SOLUCAO_MENTALIDADE, não SOLUCAO_SUPLEMENTACAO, não SOLUCAO_ALIMENTACAO, não SOLUCAO_ATIVIDADE_FISICA e não SELECT_SOLUCAO), renderiza só o modal
    if (typeof contentType !== 'string' || (contentType !== 'ANAMNESE' && contentType !== 'DIAGNOSTICO' && contentType !== 'SOLUCAO_MENTALIDADE' && contentType !== 'SOLUCAO_SUPLEMENTACAO' && contentType !== 'SOLUCAO_ALIMENTACAO' && contentType !== 'SOLUCAO_ATIVIDADE_FISICA' && contentType !== 'SELECT_SOLUCAO')) {
      return (
        <div className="consultas-container consultas-details-container">
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

          {typeof contentType !== 'string' ? contentType : null}
        </div>
      );
    }

    // Renderiza a tela de ANAMNESE completa (TELA ANTIGA - só será renderizada se selectedSection === 'ANAMNESE' mas a nova tela não foi selecionada)
    // Esta tela antiga não deve mais ser usada - a nova tela será renderizada quando selectedSection === 'ANAMNESE'
    return (
      <div className="consultas-container consultas-details-container">
        <div className="consultas-header">
          <button
            className="back-button"
            onClick={() => {
              if (selectedSection) {
                setSelectedSection(null);
              } else {
                handleBackToList();
              }
            }}
            style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="consultas-title">Detalhes da Consulta</h1>
        </div>

        {/* Cards de informações da consulta no topo */}
        <div className="consultation-details-cards-row">
          {/* Card Paciente */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <User size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Paciente</div>
              <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            </div>
          </div>

          {/* Card Data/Hora */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <Calendar size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Data / Hora</div>
              <div className="consultation-details-card-value">
                {consultaDetails.consulta_inicio
                  ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                  : formatDateOnly(consultaDetails.created_at)}
              </div>
            </div>
          </div>

          {/* Card Tipo */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <FileText size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Tipo</div>
              <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
            </div>
          </div>

          {/* Card Duração */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <Clock size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Duração</div>
              <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
            </div>
          </div>

          {/* Card Status */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <User size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Status</div>
              <div className="consultation-details-card-value">
                {(() => {
                  const statusMap: { [key: string]: string } = {
                    'AGENDAMENTO': 'Agendamento',
                    'EM_ANDAMENTO': 'Em Andamento',
                    'PROCESSING': 'Processamento',
                    'VALIDATION': 'Validação',
                    'FINALIZADA': 'Finalizada',
                    'CANCELADA': 'Cancelada',
                    'RECORDING': 'Gravando',
                    'VALID_SOLUCAO': 'Solução Válida'
                  };
                  return statusMap[consultaDetails.status] || consultaDetails.status;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="details-two-column-layout">
          {/* Coluna Esquerda - Chat com IA */}
          <div className="chat-column">
            <div className="chat-container">
              <div className="chat-header">
                <h3>Chat com IA - Assistente de Anamnese</h3>
                {selectedField && (
                  <p className="chat-field-indicator">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Editando: <strong>{selectedField.label}</strong>
                  </p>
                )}
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-empty-state">
                    <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-center">
                      Selecione um campo da anamnese clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
                    </p>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <p className="text-gray-500 text-center">
                      Digite uma mensagem para começar a conversa sobre <strong>{selectedField.label}</strong>
                    </p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={message.role === 'user' ? 'message user-message' : 'message ai-message'}
                      >
                        <div className={message.role === 'user' ? 'message-avatar user-avatar' : 'message-avatar ai-avatar'}>
                          {message.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <div className="message-content">
                          <p>{message.content}</p>
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="message ai-message">
                        <div className="message-avatar ai-avatar">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="message-content">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  placeholder={selectedField ? "Digite sua mensagem..." : "Selecione um campo para começar"}
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAIMessage();
                    }
                  }}
                  disabled={!selectedField || isTyping}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendAIMessage}
                  disabled={!selectedField || !chatInput.trim() || isTyping}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Anamnese */}
          <div className="anamnese-column">
            <div className="anamnese-container">
              <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Anamnese Integrativa - Identificação e Avaliação Inicial</h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestAdvanceConfirmation(
                      handleSaveAndContinue,
                      'Você está prestes a avançar para a etapa de Diagnóstico. Esta ação iniciará o processamento do diagnóstico integrativo. Deseja continuar?'
                    );
                  }}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: isSaving ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSaving) {
                      e.currentTarget.style.background = '#059669';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSaving) {
                      e.currentTarget.style.background = '#10b981';
                    }
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Avançar
                    </>
                  )}
                </button>
              </div>

              <div className="anamnese-content">
                <AnamneseSection
                  consultaId={consultaDetails?.id || consultaId || ''}
                  patientId={consultaDetails?.patient_id}
                  selectedField={selectedField}
                  chatMessages={chatMessages}
                  isTyping={isTyping}
                  chatInput={chatInput}
                  onFieldSelect={handleFieldSelect}
                  onSendMessage={handleSendAIMessage}
                  onChatInputChange={setChatInput}
                  consultaStatus={consultaDetails?.status}
                  consultaEtapa={consultaDetails?.etapa}
                  renderViewSolutionsButton={renderViewSolutionsButton}
                />
              </div>
            </div>
          </div>
        </div>
        {showAdvanceModal && (
          <div className="modal-overlay" onClick={cancelAdvance}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                  <ArrowRight className="w-6 h-6" />
                </div>
                <h3 className="modal-title">Avançar para Próxima Etapa</h3>
              </div>

              <div className="modal-body">
                <p className="modal-text" style={{ marginBottom: '15px' }}>
                  {advanceMessage}
                </p>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-button cancel-button"
                  onClick={cancelAdvance}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  className="modal-button"
                  onClick={confirmAdvance}
                  disabled={isSaving}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Avançar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Renderizar lista de consultas
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <div className="consultas-header-content">
          <div>
            <h1 className="consultas-title">Lista de Consulta</h1>
            <div className="consultas-stats-badge">
              <span>{totalConsultations} consultas encontradas</span>
            </div>
          </div>
          <button
            className="btn-new-consultation"
            onClick={() => router.push('/consulta/nova')}
          >
            <Plus className="btn-icon" />
            Nova consulta
          </button>
        </div>
      </div>

      {/* Filtros de Busca */}
      <div className="filters-section" style={{
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div className="search-container" style={{
          position: 'relative',
          flex: 1,
          maxWidth: '400px'
        }}>
          <Search className="search-icon" size={20} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af',
            pointerEvents: 'none',
            zIndex: 1
          }} />
          <input
            type="text"
            placeholder="Buscar consultas..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="search-input"
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              color: '#111827',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1B4266';
              e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Filtro por médico — visível apenas para admins */}
        {isAdmin && (
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <div style={{
              position: 'absolute',
              top: '-9px',
              left: '10px',
              backgroundColor: '#fff7ed',
              color: '#c2410c',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid #fed7aa',
              zIndex: 2,
              lineHeight: '16px'
            }}>ADMIN</div>
            <Search size={20} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#f97316',
              pointerEvents: 'none',
              zIndex: 1
            }} />
            <input
              type="text"
              placeholder="Filtrar por médico..."
              value={doctorSearchTerm}
              onChange={(e) => {
                setDoctorSearchTerm(e.target.value);
                setShowDoctorDropdown(true);
                if (!e.target.value) {
                  setSelectedDoctorId(null);
                }
              }}
              onFocus={() => setShowDoctorDropdown(true)}
              onBlur={() => setTimeout(() => setShowDoctorDropdown(false), 200)}
              style={{
                width: '100%',
                padding: '12px 40px 12px 44px',
                border: `1px solid ${selectedDoctorId ? '#f97316' : '#fed7aa'}`,
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#fff7ed',
                color: '#111827',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            />
            {selectedDoctorId && (
              <button
                onClick={() => {
                  setSelectedDoctorId(null);
                  setDoctorSearchTerm('');
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Limpar filtro"
              >
                <X size={16} />
              </button>
            )}
            {showDoctorDropdown && doctorSearchTerm && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                zIndex: 50,
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {doctors
                  .filter(d =>
                    d.name?.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                    d.email?.toLowerCase().includes(doctorSearchTerm.toLowerCase())
                  )
                  .map(doctor => (
                    <div
                      key={doctor.id}
                      onMouseDown={() => {
                        setSelectedDoctorId(doctor.id);
                        setDoctorSearchTerm(doctor.name);
                        setShowDoctorDropdown(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '13px'
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f9fafb'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#ffffff'; }}
                    >
                      <div style={{ fontWeight: 500, color: '#111827' }}>{doctor.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>{doctor.email}</div>
                    </div>
                  ))
                }
                {doctors.filter(d =>
                  d.name?.toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
                  d.email?.toLowerCase().includes(doctorSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: '13px' }}>
                    Nenhum médico encontrado
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
          }}
          className="status-filter"
          style={{
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#111827',
            cursor: 'pointer',
            minWidth: '180px',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1B4266';
            e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e5e7eb';
            e.target.style.boxShadow = 'none';
          }}
        >
          <option value="all">Todos os status</option>
          <option value="CREATED">Criada</option>
          <option value="RECORDING">Gravando</option>
          <option value="PROCESSING">Processando</option>
          <option value="VALIDATION">Validação</option>
          <option value="COMPLETED">Concluída</option>
          <option value="ERROR">Erro</option>
          <option value="CANCELLED">Cancelada</option>
        </select>

        {/* Filtro de Data */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          minWidth: '280px'
        }}>
          <select
            value={dateFilterType || ''}
            onChange={(e) => {
              const type = e.target.value as 'day' | 'week' | 'month' | '';
              setDateFilterType(type || null);
              if (!type) {
                setSelectedDate('');
              } else if (!selectedDate) {
                // Se não há data selecionada, usar data atual
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }
            }}
            style={{
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              color: '#111827',
              cursor: 'pointer',
              minWidth: '120px',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1B4266';
              e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value="">Sem filtro de data</option>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>

          {dateFilterType && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '12px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                color: '#111827',
                cursor: 'pointer',
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1B4266';
                e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          )}

          {dateFilterType && (
            <button
              onClick={() => {
                setDateFilterType(null);
                setSelectedDate('');
              }}
              style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
              title="Limpar filtro de data"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="consultas-table-container">
        <div className="consultas-table">
          {/* Header da tabela */}
          <div className={`table-header ${isAdmin ? 'has-from-col' : ''}`}>
            {isAdmin && (
              <div className="header-cell doctor-header">
                <span style={{
                  backgroundColor: '#fff7ed',
                  color: '#c2410c',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #fed7aa',
                  lineHeight: '16px',
                  marginRight: '6px'
                }}>ADMIN</span>
                Médico
              </div>
            )}
            {isAdmin && <div className="table-header-divider"></div>}
            <div className="header-cell patient-header">Paciente</div>
            <div className="table-header-divider"></div>
            <div className="header-cell date-header">Data</div>
            <div className="table-header-divider"></div>
            <div className="header-cell type-header">Tipo</div>
            <div className="table-header-divider"></div>
            <div className="header-cell status-header">Status</div>
            <div className="table-header-divider"></div>
            {isAdmin && <div className="header-cell from-header">Origem</div>}
            {isAdmin && <div className="table-header-divider"></div>}
            <div className="header-cell actions-header">Ações</div>
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
                  className={`table-row ${isAdmin ? 'has-from-col' : ''}`}
                  onClick={() => handleConsultationClick(consultation)}
                  style={{ cursor: 'pointer' }}
                >
                  {isAdmin && (
                    <div className="table-cell doctor-cell">
                      <span>{consultation.doctor_name || '-'}</span>
                    </div>
                  )}
                  {isAdmin && <div className="table-row-divider"></div>}
                  <div
                    className="table-cell patient-cell"
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div
                      className="patient-info"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        gap: '12px'
                      }}
                    >
                      {generateAvatar(consultation.patient_name, consultation.patients?.profile_pic)}
                      <div
                        className="patient-details"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          className="patient-name"
                          style={{
                            textAlign: 'left',
                            alignSelf: 'center',
                            width: '100%'
                          }}
                        >
                          {consultation.patient_name}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell date-cell">
                    {formatDate(consultation.consulta_inicio || consultation.created_at)}
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell type-cell">
                    <div className="consultation-type">
                      {getTypeIcon(consultation.consultation_type)}
                      <span>{mapConsultationType(consultation.consultation_type)}</span>
                    </div>
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell status-cell">
                    <StatusBadge
                      status={mapBackendStatus(consultation.status)}
                      size="md"
                      showIcon={true}
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' || consultation.status === 'VALIDATION' ? 'outlined' : 'default'}
                    />
                  </div>
                  {isAdmin && <div className="table-row-divider"></div>}
                  {isAdmin && (
                    <div className="table-cell from-cell">
                      {consultation.from ? (
                        <span className={`from-badge from-${consultation.from}`}>
                          {{ medcall: 'MedCall', auton: 'Auton Health', localhost: 'Localhost' }[consultation.from] || consultation.from}
                        </span>
                      ) : (
                        <span className="from-badge from-unknown">-</span>
                      )}
                    </div>
                  )}
                  <div className="table-row-divider"></div>
                  <div className="table-cell actions-cell">
                    <div className="action-buttons">
                      {/* Botão Finalizar para consultas presas em RECORDING/CREATED */}
                      {(consultation.status === 'RECORDING' || consultation.status === 'CREATED') && (
                        <button
                          className="action-btn-table"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Finalizar consulta com ${consultation.patient_name}?\n\nO status será alterado para PROCESSING.`)) return;
                            try {
                              const resp = await gatewayClient.patch(`/consultations/${consultation.id}`, {
                                status: 'PROCESSING',
                                consulta_finalizada: true,
                                consulta_fim: new Date().toISOString(),
                              });
                              if (resp.success) {
                                window.location.reload();
                              }
                            } catch (err) {
                              console.error('Erro ao finalizar:', err);
                            }
                          }}
                          title="Finalizar consulta"
                          style={{ color: '#EF4444', borderColor: '#FECACA' }}
                        >
                          <CheckCircle size={16} />
                          <span>Finalizar</span>
                        </button>
                      )}
                      {/* Botoes Anamnese - ocultos se já preenchida */}
                      {consultaAnamneseStatus[consultation.id] !== 'preenchida' && (
                        <button
                          className="action-btn-table email"
                          onClick={(e) => handleSendAnamneseFromList(e, consultation)}
                          disabled={sendingAnamneseId === consultation.id}
                          title="Enviar anamnese por email e WhatsApp"
                          style={sendingAnamneseId === consultation.id ? { opacity: 0.5 } : {}}
                        >
                          <Send size={16} />
                          <span>{sendingAnamneseId === consultation.id ? 'Enviando...' : 'Enviar Anamnese'}</span>
                        </button>
                      )}
                      {consultaAnamneseStatus[consultation.id] !== 'preenchida' && (
                        <button
                          className={`action-btn-table copy`}
                          onClick={(e) => handleCopyAnamneseLinkFromList(e, consultation)}
                          title="Copiar link da anamnese"
                          style={copiedAnamneseId === consultation.id ? { color: '#10b981' } : {}}
                        >
                          {copiedAnamneseId === consultation.id ? <ClipboardCheck size={16} /> : <Copy size={16} />}
                          <span>{copiedAnamneseId === consultation.id ? 'Copiado!' : 'Copiar Anamnese'}</span>
                        </button>
                      )}
                      <button
                        className="action-btn-table edit"
                        onClick={(e) => handleEditConsultation(e, consultation)}
                        title="Editar consulta"
                      >
                        <Pencil size={16} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="action-btn-table delete"
                        onClick={(e) => handleDeleteConsultation(e, consultation)}
                        title="Excluir consulta"
                      >
                        <Trash2 size={16} />
                        <span>Excluir</span>
                      </button>
                    </div>
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

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && consultationToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteConsultation}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon delete-icon">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="modal-title">Excluir Consulta</h3>
            </div>

            <div className="modal-body">
              <p className="modal-text">
                Tem certeza que deseja excluir a consulta de <strong>{consultationToDelete.patient_name}</strong>?
              </p>
              <p className="modal-warning">
                Esta ação irá remover a consulta do sistema e do Google Calendar (se sincronizado). Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={cancelDeleteConsultation}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                className="modal-button delete-button"
                onClick={confirmDeleteConsultation}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Consulta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Agendamento */}
      {showEditAgendamentoModal && editingAgendamento && (
        <div className="modal-overlay" onClick={handleCloseEditAgendamentoModal}>
          <div className="modal-content edit-agendamento-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Agendamento</h3>
              <button className="modal-close-btn" onClick={handleCloseEditAgendamentoModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* Paciente (readonly) */}
              <div className="form-group">
                <label className="form-label">Paciente</label>
                <div className="form-readonly-value">
                  <User className="w-4 h-4" />
                  {editingAgendamento.patient_name}
                </div>
              </div>

              {/* Data */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-agendamento-date">Data da Consulta</label>
                <input
                  type="date"
                  id="edit-agendamento-date"
                  className="form-input"
                  value={editAgendamentoForm.date}
                  onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Horário */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-agendamento-time">Horário</label>
                <input
                  type="time"
                  id="edit-agendamento-time"
                  className="form-input"
                  value={editAgendamentoForm.time}
                  onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              {/* Tipo de Atendimento */}
              <div className="form-group">
                <label className="form-label">Tipo de Atendimento</label>
                <div className="form-radio-group">
                  <label className={`form-radio-option ${editAgendamentoForm.type === 'TELEMEDICINA' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="agendamento-type"
                      value="TELEMEDICINA"
                      checked={editAgendamentoForm.type === 'TELEMEDICINA'}
                      onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <Video className="w-4 h-4" />
                    Telemedicina
                  </label>
                  <label className={`form-radio-option ${editAgendamentoForm.type === 'PRESENCIAL' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="agendamento-type"
                      value="PRESENCIAL"
                      checked={editAgendamentoForm.type === 'PRESENCIAL'}
                      onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <User className="w-4 h-4" />
                    Presencial
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer modal-footer-between">
              <button
                className="modal-button delete-button"
                onClick={() => {
                  handleCloseEditAgendamentoModal();
                  setConsultationToDelete(editingAgendamento);
                  setShowDeleteModal(true);
                }}
                disabled={isSavingAgendamento}
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
              <div className="modal-footer-right">
                <button
                  className="modal-button cancel-button"
                  onClick={handleCloseEditAgendamentoModal}
                  disabled={isSavingAgendamento}
                >
                  Cancelar
                </button>
                <button
                  className="modal-button save-button"
                  onClick={handleSaveAgendamentoEdit}
                  disabled={isSavingAgendamento || !editAgendamentoForm.date || !editAgendamentoForm.time}
                >
                  {isSavingAgendamento ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Avanço de Etapa */}
      {showAdvanceModal && (
        <div className="modal-overlay" onClick={cancelAdvance}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                <ArrowRight className="w-6 h-6" />
              </div>
              <h3 className="modal-title">Avançar para Próxima Etapa</h3>
            </div>

            <div className="modal-body">
              <p className="modal-text" style={{ marginBottom: '15px' }}>
                {advanceMessage}
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={cancelAdvance}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                className="modal-button"
                onClick={confirmAdvance}
                disabled={isSaving}
                style={{
                  background: '#10b981',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSaving ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Avançar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <TutorialPopup steps={CONSULTAS_STEPS} pageKey="consultas" showWelcome={false} />
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
