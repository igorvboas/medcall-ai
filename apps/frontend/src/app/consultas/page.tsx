'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Save, X, Sparkles, Edit, Plus, Trash2, Pencil,
  Dna, Brain, Apple, Pill, Dumbbell, Leaf
} from 'lucide-react';
import { StatusBadge, mapBackendStatus } from '../../components/StatusBadge';
import ExamesUploadSection from '../../components/ExamesUploadSection';
import SolutionsViewer from '../../components/solutions/SolutionsViewer';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';
import './consultas.css';
import '../../components/solutions/solutions.css';

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
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'ERROR' | 'CANCELLED' | 'COMPLETED';
  etapa?: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO';
  solucao_etapa?: 'LTB' | 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA' | 'HABITOS_DE_VIDA';
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

// Componente de Seção Colapsável
function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
  readOnly = false
}: { 
  label: string; 
  value: any; 
  fieldPath?: string;
  consultaId?: string;
  onSave?: (fieldPath: string, newValue: string, consultaId: string) => Promise<void>;
  onAIEdit?: (fieldPath: string, label: string) => void;
  readOnly?: boolean;
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
    // Se não houver valor, mostrar campo vazio
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return <p className="data-value data-value-empty">—</p>;
    }

    // Se for array, renderizar lista
    if (Array.isArray(value)) {
      return (
        <ul className="data-list">
          {value.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    }

    // Renderizar valor normal
    return <p className="data-value">{String(value)}</p>;
  };

  return (
    <div className="data-field">
      <div className="data-field-header">
        <label className="data-label">{label}:</label>
        {!readOnly && (
          <div className="field-actions">
            {fieldPath && consultaId && onAIEdit && !isEditing && (
              <button 
                className="ai-button"
                onClick={() => onAIEdit(fieldPath, label)}
                title="Editar com IA"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            {fieldPath && consultaId && onSave && !isEditing && (
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
      
      {isEditing ? (
        <div className="edit-field">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="edit-input"
            rows={3}
            placeholder="Digite o novo valor..."
          />
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

// Componente da seção de Anamnese
function AnamneseSection({ 
  consultaId,
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
  renderViewSolutionsButton
}: { 
  consultaId: string;
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
}) {
  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  //console.log('🔍 AnamneseSection readOnly:', readOnly);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para selecionar campo para edição com IA
  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  // Função para salvar campo editado
  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // 1. Atualizar no Supabase
      const response = await fetch(`/api/anamnese/${consultaId}/update-field`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldPath,
          value: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar campo no Supabase');
      }

      // Obter dados da resposta da API
      const result = await response.json();
      console.log('📦 Dados retornados pela API:', result);

      // 2. Fazer requisição para o webhook
      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();
      
      const webhookResponse = await fetch(webhookEndpoints.edicaoAnamnese, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          fieldPath,
          value: newValue,
          consultaId,
          origem: 'manual',
        }),
      });

      if (!webhookResponse.ok) {
        console.warn('Webhook falhou, mas campo foi salvo no Supabase');
      }

      // 3. Atualizar o estado local usando os dados da API
      if (result.success && result.data) {
        console.log('🔄 Atualizando interface com dados da API:', result.data);
        
        // Determinar qual seção da anamnese atualizar baseado no fieldPath
        const pathParts = fieldPath.split('.');
        const tableName = pathParts[0];
        
        // Mapear nome da tabela para a chave do estado
        const stateKeyMap: { [key: string]: string } = {
          'a_cadastro_prontuario': 'cadastro_prontuario',
          'a_objetivos_queixas': 'objetivos_queixas',
          'a_historico_risco': 'historico_risco',
          'a_observacao_clinica_lab': 'observacao_clinica_lab',
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
            [stateKey]: result.data
          }));
          console.log('✅ Interface atualizada com dados da API');
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

  useEffect(() => {
    fetchAnamneseData();
  }, [consultaId]);

  // Listener para recarregar dados de anamnese quando a IA processar
  useEffect(() => {
    const handleAnamneseRefresh = () => {
      fetchAnamneseData();
    };

    window.addEventListener('force-anamnese-refresh', handleAnamneseRefresh);
    
    return () => {
      window.removeEventListener('force-anamnese-refresh', handleAnamneseRefresh);
    };
  }, []);

  const fetchAnamneseData = async () => {
    try {
      setLoadingDetails(true);
      setError(null);
      
      // Buscar dados de todas as tabelas de anamnese
      console.log('🔍 Buscando anamnese para consulta_id:', consultaId);
      const response = await fetch(`/api/anamnese/${consultaId}`);
      
      console.log('📡 Status da resposta:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro da API:', errorData);
        throw new Error(errorData.error || 'Erro ao carregar dados da anamnese');
      }
      
      const data = await response.json();
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

  // Mostrar loading apenas no primeiro carregamento
  if (loading && !error) {
    console.log('🔍 AnamneseSection - Mostrando loading...');
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando anamnese...</p>
      </div>
    );
  }

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

      {/* Dados do Paciente */}
      <CollapsibleSection title="Dados do Paciente" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Identificação</h4>
            <DataField label="Nome Completo" value={cadastro_prontuario?.identificacao_nome_completo} fieldPath="a_cadastro_prontuario.identificacao_nome_completo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly}/>
            <DataField label="Nome Social" value={cadastro_prontuario?.identificacao_nome_social} fieldPath="a_cadastro_prontuario.identificacao_nome_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Data de Nascimento" value={cadastro_prontuario?.identificacao_data_nascimento} fieldPath="a_cadastro_prontuario.identificacao_data_nascimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Idade Atual" value={cadastro_prontuario?.identificacao_idade_atual} fieldPath="a_cadastro_prontuario.identificacao_idade_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sexo Biológico" value={cadastro_prontuario?.identificacao_sexo_biologico} fieldPath="a_cadastro_prontuario.identificacao_sexo_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gênero" value={cadastro_prontuario?.identificacao_genero} fieldPath="a_cadastro_prontuario.identificacao_genero" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Naturalidade" value={cadastro_prontuario?.identificacao_naturalidade} fieldPath="a_cadastro_prontuario.identificacao_naturalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nacionalidade" value={cadastro_prontuario?.identificacao_nacionalidade} fieldPath="a_cadastro_prontuario.identificacao_nacionalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Dados Sociodemográficos</h4>
            <DataField label="Estado Civil" value={cadastro_prontuario?.dados_sociodemograficos_estado_civil} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_estado_civil" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Número de Filhos" value={cadastro_prontuario?.dados_sociodemograficos_numero_filhos} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_numero_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Idade dos Filhos" value={cadastro_prontuario?.dados_sociodemograficos_idade_filhos} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_idade_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Escolaridade" value={cadastro_prontuario?.dados_sociodemograficos_escolaridade} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_escolaridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profissão" value={cadastro_prontuario?.dados_sociodemograficos_profissao} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_profissao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exerce a Profissão" value={cadastro_prontuario?.dados_sociodemograficos_exerce_profissao} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_exerce_profissao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Situação de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_situacao_trabalho} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_situacao_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Carga Horária de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_carga_horaria_trabalho} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_carga_horaria_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Condição Social" value={cadastro_prontuario?.dados_sociodemograficos_condicao_social} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_condicao_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Renda Familiar" value={cadastro_prontuario?.dados_sociodemograficos_renda_familiar} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_renda_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pessoas na Residência" value={cadastro_prontuario?.dados_sociodemograficos_pessoas_residencia} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_pessoas_residencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Responsável Financeiro" value={cadastro_prontuario?.dados_sociodemograficos_responsavel_financeiro} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_responsavel_financeiro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Seguro Saúde" value={cadastro_prontuario?.dados_sociodemograficos_seguro_saude} fieldPath="a_cadastro_prontuario.dados_sociodemograficos_seguro_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Documentos</h4>
            <DataField label="CPF" value={cadastro_prontuario?.doc_cpf} fieldPath="a_cadastro_prontuario.doc_cpf" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="RG" value={cadastro_prontuario?.doc_rg} fieldPath="a_cadastro_prontuario.doc_rg" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="CNS" value={cadastro_prontuario?.doc_cns} fieldPath="a_cadastro_prontuario.doc_cns" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Endereço</h4>
            <DataField label="Logradouro" value={cadastro_prontuario?.endereco_logradouro} fieldPath="a_cadastro_prontuario.endereco_logradouro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Número" value={cadastro_prontuario?.endereco_numero} fieldPath="a_cadastro_prontuario.endereco_numero" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Complemento" value={cadastro_prontuario?.endereco_complemento} fieldPath="a_cadastro_prontuario.endereco_complemento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Bairro" value={cadastro_prontuario?.endereco_bairro} fieldPath="a_cadastro_prontuario.endereco_bairro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cidade" value={cadastro_prontuario?.endereco_cidade} fieldPath="a_cadastro_prontuario.endereco_cidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estado" value={cadastro_prontuario?.endereco_estado} fieldPath="a_cadastro_prontuario.endereco_estado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="CEP" value={cadastro_prontuario?.endereco_cep} fieldPath="a_cadastro_prontuario.endereco_cep" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contato</h4>
            <DataField label="Celular" value={cadastro_prontuario?.telefone_celular} fieldPath="a_cadastro_prontuario.telefone_celular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Telefone Residencial" value={cadastro_prontuario?.telefone_residencial} fieldPath="a_cadastro_prontuario.telefone_residencial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Telefone para Recado" value={cadastro_prontuario?.telefone_recado} fieldPath="a_cadastro_prontuario.telefone_recado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Email" value={cadastro_prontuario?.email} fieldPath="a_cadastro_prontuario.email" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Objetivos e Queixas */}
      <CollapsibleSection title="Objetivos e Queixas">
          <div className="anamnese-subsection">
            <h4>Saúde Geral Percebida</h4>
            <DataField label="Como Descreve a Saúde" value={objetivos_queixas?.saude_geral_percebida_como_descreve_saude} fieldPath="a_objetivos_queixas.saude_geral_percebida_como_descreve_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Define Bem-Estar" value={objetivos_queixas?.saude_geral_percebida_como_define_bem_estar} fieldPath="a_objetivos_queixas.saude_geral_percebida_como_define_bem_estar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avaliação da Saúde Emocional/Mental" value={objetivos_queixas?.saude_geral_percebida_avaliacao_saude_emocional_mental} fieldPath="a_objetivos_queixas.saude_geral_percebida_avaliacao_saude_emocional_mental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Queixas</h4>
            <DataField label="Queixa Principal" value={objetivos_queixas?.queixa_principal} fieldPath="a_objetivos_queixas.queixa_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sub-queixas" value={objetivos_queixas?.sub_queixas} fieldPath="a_objetivos_queixas.sub_queixas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Impacto das Queixas na Vida</h4>
            <DataField label="Como Afeta a Vida Diária" value={objetivos_queixas?.impacto_queixas_vida_como_afeta_vida_diaria} fieldPath="a_objetivos_queixas.impacto_queixas_vida_como_afeta_vida_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Limitações Causadas" value={objetivos_queixas?.impacto_queixas_vida_limitacoes_causadas} fieldPath="a_objetivos_queixas.impacto_queixas_vida_limitacoes_causadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Áreas Impactadas" value={objetivos_queixas?.impacto_queixas_vida_areas_impactadas} fieldPath="a_objetivos_queixas.impacto_queixas_vida_areas_impactadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Objetivos e Expectativas</h4>
            <DataField label="Problemas Deseja Resolver" value={objetivos_queixas?.problemas_deseja_resolver} fieldPath="a_objetivos_queixas.problemas_deseja_resolver" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativa Específica" value={objetivos_queixas?.expectativas_tratamento_expectativa_especifica} fieldPath="a_objetivos_queixas.expectativas_tratamento_expectativa_especifica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Buscou Tratamentos Similares" value={objetivos_queixas?.expectativas_tratamento_ja_buscou_tratamentos_similares} fieldPath="a_objetivos_queixas.expectativas_tratamento_ja_buscou_tratamentos_similares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tratamentos Anteriores" value={objetivos_queixas?.expectativas_tratamento_quais_tratamentos_anteriores} fieldPath="a_objetivos_queixas.expectativas_tratamento_quais_tratamentos_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Compreensão sobre a Causa</h4>
            <DataField label="Compreensão do Paciente" value={objetivos_queixas?.compreensao_sobre_causa_compreensao_paciente} fieldPath="a_objetivos_queixas.compreensao_sobre_causa_compreensao_paciente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos Influenciando" value={objetivos_queixas?.compreensao_sobre_causa_fatores_externos_influenciando} fieldPath="a_objetivos_queixas.compreensao_sobre_causa_fatores_externos_influenciando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Projeto de Vida</h4>
            <DataField label="Corporal" value={objetivos_queixas?.projeto_de_vida_corporal} fieldPath="a_objetivos_queixas.projeto_de_vida_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritual" value={objetivos_queixas?.projeto_de_vida_espiritual} fieldPath="a_objetivos_queixas.projeto_de_vida_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Familiar" value={objetivos_queixas?.projeto_de_vida_familiar} fieldPath="a_objetivos_queixas.projeto_de_vida_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profissional" value={objetivos_queixas?.projeto_de_vida_profissional} fieldPath="a_objetivos_queixas.projeto_de_vida_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sonhos" value={objetivos_queixas?.projeto_de_vida_sonhos} fieldPath="a_objetivos_queixas.projeto_de_vida_sonhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Motivação e Mudança</h4>
            <DataField label="Nível de Motivação" value={objetivos_queixas?.nivel_motivacao} fieldPath="a_objetivos_queixas.nivel_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Prontidão para Mudança" value={objetivos_queixas?.prontidao_para_mudanca} fieldPath="a_objetivos_queixas.prontidao_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mudanças Considera Necessárias" value={objetivos_queixas?.mudancas_considera_necessarias} fieldPath="a_objetivos_queixas.mudancas_considera_necessarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Histórico de Risco */}
      <CollapsibleSection title="Histórico de Risco">
          <div className="anamnese-subsection">
            <h4>Doenças Atuais e Passadas</h4>
            <DataField label="Doenças Atuais Confirmadas" value={historico_risco?.doencas_atuais_confirmadas} fieldPath="a_historico_risco.doencas_atuais_confirmadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Doenças na Infância/Adolescência" value={historico_risco?.doencas_infancia_adolescencia} fieldPath="a_historico_risco.doencas_infancia_adolescencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Antecedentes Familiares</h4>
            <DataField label="Pai" value={historico_risco?.antecedentes_familiares_pai} fieldPath="a_historico_risco.antecedentes_familiares_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mãe" value={historico_risco?.antecedentes_familiares_mae} fieldPath="a_historico_risco.antecedentes_familiares_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Irmãos" value={historico_risco?.antecedentes_familiares_irmaos} fieldPath="a_historico_risco.antecedentes_familiares_irmaos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Paternos" value={historico_risco?.antecedentes_familiares_avos_paternos} fieldPath="a_historico_risco.antecedentes_familiares_avos_paternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Maternos" value={historico_risco?.antecedentes_familiares_avos_maternos} fieldPath="a_historico_risco.antecedentes_familiares_avos_maternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Causas de Morte dos Avós" value={historico_risco?.antecedentes_familiares_causas_morte_avos} fieldPath="a_historico_risco.antecedentes_familiares_causas_morte_avos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Condições e Tratamentos</h4>
            <DataField label="Condições Genéticas Conhecidas" value={historico_risco?.condicoes_geneticas_conhecidas} fieldPath="a_historico_risco.condicoes_geneticas_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cirurgias/Procedimentos" value={historico_risco?.cirurgias_procedimentos} fieldPath="a_historico_risco.cirurgias_procedimentos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Atuais" value={historico_risco?.medicacoes_atuais} fieldPath="a_historico_risco.medicacoes_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Contínuas" value={historico_risco?.medicacoes_continuas} fieldPath="a_historico_risco.medicacoes_continuas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Usou Corticoides" value={historico_risco?.ja_usou_corticoides} fieldPath="a_historico_risco.ja_usou_corticoides" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Alergias e Exposições</h4>
            <DataField label="Alergias/Intolerâncias Conhecidas" value={historico_risco?.alergias_intolerancias_conhecidas} fieldPath="a_historico_risco.alergias_intolerancias_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alergias/Intolerâncias Suspeitas" value={historico_risco?.alergias_intolerancias_suspeitas} fieldPath="a_historico_risco.alergias_intolerancias_suspeitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição Tóxica" value={historico_risco?.exposicao_toxica} fieldPath="a_historico_risco.exposicao_toxica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Histórico de Peso</h4>
            <DataField label="Variação ao Longo da Vida" value={historico_risco?.historico_peso_variacao_ao_longo_vida} fieldPath="a_historico_risco.historico_peso_variacao_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Máximo Atingido" value={historico_risco?.historico_peso_peso_maximo_atingido} fieldPath="a_historico_risco.historico_peso_peso_maximo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Mínimo Atingido" value={historico_risco?.historico_peso_peso_minimo_atingido} fieldPath="a_historico_risco.historico_peso_peso_minimo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tratamentos Anteriores</h4>
            <DataField label="Tentativas de Tratamento Anteriores" value={historico_risco?.tentativas_tratamento_anteriores} fieldPath="a_historico_risco.tentativas_tratamento_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Observação Clínica e Laboratorial */}
      <CollapsibleSection title="Observação Clínica e Laboratorial">
          <div className="anamnese-subsection">
            <h4>Sintomas e Padrões</h4>
            <DataField label="Quando os Sintomas Começaram" value={observacao_clinica_lab?.quando_sintomas_comecaram} fieldPath="a_observacao_clinica_lab.quando_sintomas_comecaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrão Temporal" value={observacao_clinica_lab?.ha_algum_padrao_temporal} fieldPath="a_observacao_clinica_lab.ha_algum_padrao_temporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos que Agravaram" value={observacao_clinica_lab?.eventos_que_agravaram} fieldPath="a_observacao_clinica_lab.eventos_que_agravaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade de Dor/Desconforto" value={observacao_clinica_lab?.intensidade_dor_desconforto} fieldPath="a_observacao_clinica_lab.intensidade_dor_desconforto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Energia Diária" value={observacao_clinica_lab?.nivel_energia_diaria} fieldPath="a_observacao_clinica_lab.nivel_energia_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Gastrointestinal</h4>
            <DataField label="Intestino" value={observacao_clinica_lab?.sistema_gastrointestinal_intestino} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_intestino" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hábito Intestinal" value={observacao_clinica_lab?.sistema_gastrointestinal_habito_intestinal} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_habito_intestinal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_disbiose} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Língua" value={observacao_clinica_lab?.sistema_gastrointestinal_lingua} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_lingua" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Digestão" value={observacao_clinica_lab?.sistema_gastrointestinal_digestao} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_digestao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gases" value={observacao_clinica_lab?.sistema_gastrointestinal_gases} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_gases" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita de Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_suspeita_disbiose} fieldPath="a_observacao_clinica_lab.sistema_gastrointestinal_suspeita_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Musculoesquelético</h4>
            <DataField label="Dores" value={observacao_clinica_lab?.sistema_musculoesqueletico_dores} fieldPath="a_observacao_clinica_lab.sistema_musculoesqueletico_dores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Localização" value={observacao_clinica_lab?.sistema_musculoesqueletico_localizacao} fieldPath="a_observacao_clinica_lab.sistema_musculoesqueletico_localizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Postura" value={observacao_clinica_lab?.sistema_musculoesqueletico_postura} fieldPath="a_observacao_clinica_lab.sistema_musculoesqueletico_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tônus Muscular" value={observacao_clinica_lab?.sistema_musculoesqueletico_tono_muscular} fieldPath="a_observacao_clinica_lab.sistema_musculoesqueletico_tono_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mobilidade" value={observacao_clinica_lab?.sistema_musculoesqueletico_mobilidade} fieldPath="a_observacao_clinica_lab.sistema_musculoesqueletico_mobilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pele e Fâneros</h4>
            <DataField label="Pele" value={observacao_clinica_lab?.pele_faneros_pele} fieldPath="a_observacao_clinica_lab.pele_faneros_pele" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cabelo" value={observacao_clinica_lab?.pele_faneros_cabelo} fieldPath="a_observacao_clinica_lab.pele_faneros_cabelo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Unhas" value={observacao_clinica_lab?.pele_faneros_unhas} fieldPath="a_observacao_clinica_lab.pele_faneros_unhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hidratação" value={observacao_clinica_lab?.pele_faneros_hidratacao} fieldPath="a_observacao_clinica_lab.pele_faneros_hidratacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ingestão de Água (ml/dia)" value={observacao_clinica_lab?.pele_faneros_ingestao_agua_ml_dia} fieldPath="a_observacao_clinica_lab.pele_faneros_ingestao_agua_ml_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Neurológico/Mental</h4>
            <DataField label="Memória" value={observacao_clinica_lab?.sistema_neurologico_mental_memoria} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_memoria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Concentração" value={observacao_clinica_lab?.sistema_neurologico_mental_concentracao} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Qualidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_qualidade} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Latência do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_latencia} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_latencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Manutenção do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_manutencao} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_manutencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profundidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_profundidade} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_profundidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Duração do Sono (horas)" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_duracao_horas} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_duracao_horas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Despertar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_despertar} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_despertar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda Quantas Vezes" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_quantas_vezes} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_acorda_quantas_vezes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda para Urinar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_para_urinar} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_sono_acorda_para_urinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Energia" value={observacao_clinica_lab?.sistema_neurologico_mental_energia} fieldPath="a_observacao_clinica_lab.sistema_neurologico_mental_energia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Endócrino</h4>
            <h5>Tireoide</h5>
            <DataField label="TSH" value={observacao_clinica_lab?.sistema_endocrino_tireoide_tsh} fieldPath="a_observacao_clinica_lab.sistema_endocrino_tireoide_tsh" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Anti-TPO" value={observacao_clinica_lab?.sistema_endocrino_tireoide_anti_tpo} fieldPath="a_observacao_clinica_lab.sistema_endocrino_tireoide_anti_tpo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T3 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t3_livre} fieldPath="a_observacao_clinica_lab.sistema_endocrino_tireoide_t3_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T4 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t4_livre} fieldPath="a_observacao_clinica_lab.sistema_endocrino_tireoide_t4_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita" value={observacao_clinica_lab?.sistema_endocrino_tireoide_suspeita} fieldPath="a_observacao_clinica_lab.sistema_endocrino_tireoide_suspeita" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Insulina</h5>
            <DataField label="Valor" value={observacao_clinica_lab?.sistema_endocrino_insulina_valor} fieldPath="a_observacao_clinica_lab.sistema_endocrino_insulina_valor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Glicemia" value={observacao_clinica_lab?.sistema_endocrino_insulina_glicemia} fieldPath="a_observacao_clinica_lab.sistema_endocrino_insulina_glicemia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hemoglobina Glicada" value={observacao_clinica_lab?.sistema_endocrino_insulina_hemoglobina_glicada} fieldPath="a_observacao_clinica_lab.sistema_endocrino_insulina_hemoglobina_glicada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="HOMA-IR" value={observacao_clinica_lab?.sistema_endocrino_insulina_homa_ir} fieldPath="a_observacao_clinica_lab.sistema_endocrino_insulina_homa_ir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diagnóstico" value={observacao_clinica_lab?.sistema_endocrino_insulina_diagnostico} fieldPath="a_observacao_clinica_lab.sistema_endocrino_insulina_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Outros Hormônios</h5>
            <DataField label="Cortisol" value={observacao_clinica_lab?.sistema_endocrino_cortisol} fieldPath="a_observacao_clinica_lab.sistema_endocrino_cortisol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estrogênio" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_estrogeno} fieldPath="a_observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_estrogeno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Progesterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_progesterona} fieldPath="a_observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_progesterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Testosterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_testosterona} fieldPath="a_observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_testosterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_impacto} fieldPath="a_observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Medidas Antropométricas</h4>
            <DataField label="Peso Atual" value={observacao_clinica_lab?.medidas_antropometricas_peso_atual} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_peso_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Altura" value={observacao_clinica_lab?.medidas_antropometricas_altura} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_altura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="IMC" value={observacao_clinica_lab?.medidas_antropometricas_imc} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_imc" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência da Cintura" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_cintura} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_circunferencias_cintura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Quadril" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_quadril} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_circunferencias_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Pescoço" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_pescoco} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_circunferencias_pescoco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relação Cintura/Quadril" value={observacao_clinica_lab?.medidas_antropometricas_relacao_cintura_quadril} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_relacao_cintura_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Bioimpedância</h5>
            <DataField label="Gordura (%)" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_percentual} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_bioimpedancia_gordura_percentual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Massa Muscular" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_massa_muscular} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_bioimpedancia_massa_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Água Corporal" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_agua_corporal} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_bioimpedancia_agua_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_visceral} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_bioimpedancia_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_gordura_visceral} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Esteatose Hepática" value={observacao_clinica_lab?.medidas_antropometricas_esteatose_hepatica} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_esteatose_hepatica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pressão Arterial" value={observacao_clinica_lab?.medidas_antropometricas_pressao_arterial} fieldPath="a_observacao_clinica_lab.medidas_antropometricas_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sinais Vitais Relatados</h4>
            <DataField label="Disposição ao Acordar" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_acordar} fieldPath="a_observacao_clinica_lab.sinais_vitais_relatados_disposicao_ao_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disposição ao Longo do Dia" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_longo_dia} fieldPath="a_observacao_clinica_lab.sinais_vitais_relatados_disposicao_ao_longo_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Libido" value={observacao_clinica_lab?.sinais_vitais_relatados_libido} fieldPath="a_observacao_clinica_lab.sinais_vitais_relatados_libido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Regulação Térmica" value={observacao_clinica_lab?.sinais_vitais_relatados_regulacao_termica} fieldPath="a_observacao_clinica_lab.sinais_vitais_relatados_regulacao_termica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos Alimentares</h4>
            <DataField label="Recordatório 24h" value={observacao_clinica_lab?.habitos_alimentares_recordatorio_24h} fieldPath="a_observacao_clinica_lab.habitos_alimentares_recordatorio_24h" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência de Ultraprocessados" value={observacao_clinica_lab?.habitos_alimentares_frequencia_ultraprocessados} fieldPath="a_observacao_clinica_lab.habitos_alimentares_frequencia_ultraprocessados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Horários das Refeições" value={observacao_clinica_lab?.habitos_alimentares_horarios_refeicoes} fieldPath="a_observacao_clinica_lab.habitos_alimentares_horarios_refeicoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Come Assistindo TV/Trabalhando" value={observacao_clinica_lab?.habitos_alimentares_come_assistindo_tv_trabalhando} fieldPath="a_observacao_clinica_lab.habitos_alimentares_come_assistindo_tv_trabalhando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* História de Vida */}
      <CollapsibleSection title="História de Vida">
          <div className="anamnese-subsection">
            <h4>Narrativa e Eventos</h4>
            <DataField label="Síntese da Narrativa" value={historia_vida?.narrativa_sintese} fieldPath="a_historia_vida.narrativa_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos de Vida Marcantes" value={historia_vida?.eventos_vida_marcantes} fieldPath="a_historia_vida.eventos_vida_marcantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo/Trauma" value={historia_vida?.episodios_estresse_extremo_trauma} fieldPath="a_historia_vida.episodios_estresse_extremo_trauma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Trilha do Conflito</h4>
            <DataField label="Concepção/Gestação" value={historia_vida?.trilha_do_conflito_concepcao_gestacao} fieldPath="a_historia_vida.trilha_do_conflito_concepcao_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="0-7 anos" value={historia_vida?.trilha_do_conflito_0_7_anos} fieldPath="a_historia_vida.trilha_do_conflito_0_7_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="7-14 anos" value={historia_vida?.trilha_do_conflito_7_14_anos} fieldPath="a_historia_vida.trilha_do_conflito_7_14_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="14-21 anos" value={historia_vida?.trilha_do_conflito_14_21_anos} fieldPath="a_historia_vida.trilha_do_conflito_14_21_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="21-28 anos" value={historia_vida?.trilha_do_conflito_21_28_anos} fieldPath="a_historia_vida.trilha_do_conflito_21_28_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="28+ anos" value={historia_vida?.trilha_do_conflito_28_mais_anos} fieldPath="a_historia_vida.trilha_do_conflito_28_mais_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Padrões e Traumas</h4>
            <DataField label="Pontos Traumáticos" value={historia_vida?.pontos_traumaticos} fieldPath="a_historia_vida.pontos_traumaticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões Repetitivos" value={historia_vida?.padroes_repetitivos} fieldPath="a_historia_vida.padroes_repetitivos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe na Gestação" value={historia_vida?.saude_mae_gestacao} fieldPath="a_historia_vida.saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Traços/Comportamentos Repetitivos" value={historia_vida?.tracos_comportamentos_repetitivos_ao_longo_vida} fieldPath="a_historia_vida.tracos_comportamentos_repetitivos_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Superação e Identidade</h4>
            <DataField label="Experiência de Virada" value={historia_vida?.experiencia_considera_virada} fieldPath="a_historia_vida.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Identifica com Superação ou Defesa" value={historia_vida?.identifica_com_superacao_ou_defesa} fieldPath="a_historia_vida.identifica_com_superacao_ou_defesa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Conexão com Identidade e Propósito" value={historia_vida?.conexao_identidade_proposito} fieldPath="a_historia_vida.conexao_identidade_proposito" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Algo da Infância que Lembra com Emoção Intensa" value={historia_vida?.algo_infancia_lembra_com_emocao_intensa} fieldPath="a_historia_vida.algo_infancia_lembra_com_emocao_intensa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

        </CollapsibleSection>

      {/* Setênios e Eventos */}
      <CollapsibleSection title="Setênios e Eventos">
          <div className="anamnese-subsection">
            <h4>Concepção e Gestação</h4>
            <DataField label="Planejamento" value={setenios_eventos?.concepcao_gestacao_planejamento} fieldPath="a_setenios_eventos.concepcao_gestacao_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ambiente Gestacional" value={setenios_eventos?.concepcao_gestacao_ambiente_gestacional} fieldPath="a_setenios_eventos.concepcao_gestacao_ambiente_gestacional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe" value={setenios_eventos?.concepcao_gestacao_saude_mae_gestacao} fieldPath="a_setenios_eventos.concepcao_gestacao_saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Parto" value={setenios_eventos?.concepcao_gestacao_parto} fieldPath="a_setenios_eventos.concepcao_gestacao_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Houve Trauma de Parto" value={setenios_eventos?.concepcao_gestacao_houve_trauma_parto} fieldPath="a_setenios_eventos.concepcao_gestacao_houve_trauma_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Foi Desejada/Planejada" value={setenios_eventos?.concepcao_gestacao_foi_desejada_planejada} fieldPath="a_setenios_eventos.concepcao_gestacao_foi_desejada_planejada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.concepcao_gestacao_impacto} fieldPath="a_setenios_eventos.concepcao_gestacao_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Primeiro Setênio (0-7 anos)</h4>
            <DataField label="Ambiente" value={setenios_eventos?.primeiro_setenio_0_7_ambiente} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_ambiente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Pai" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_pai} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Mãe" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_mae} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aprendizados" value={setenios_eventos?.primeiro_setenio_0_7_aprendizados} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_aprendizados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Trauma Central" value={setenios_eventos?.primeiro_setenio_0_7_trauma_central} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_trauma_central" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Segundo Setênio (7-14 anos)</h4>
            <DataField label="Eventos" value={setenios_eventos?.segundo_setenio_7_14_eventos} fieldPath="a_setenios_eventos.segundo_setenio_7_14_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Desenvolvimento" value={setenios_eventos?.segundo_setenio_7_14_desenvolvimento} fieldPath="a_setenios_eventos.segundo_setenio_7_14_desenvolvimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Corpo Físico" value={setenios_eventos?.segundo_setenio_7_14_corpo_fisico} fieldPath="a_setenios_eventos.segundo_setenio_7_14_corpo_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.segundo_setenio_7_14_impacto} fieldPath="a_setenios_eventos.segundo_setenio_7_14_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Terceiro Setênio (14-21 anos)</h4>
            <DataField label="Escolhas" value={setenios_eventos?.terceiro_setenio_14_21_escolhas} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_escolhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Motivação" value={setenios_eventos?.terceiro_setenio_14_21_motivacao} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cumeeira da Casa" value={setenios_eventos?.terceiro_setenio_14_21_cumeeira_da_casa} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_cumeeira_da_casa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Quarto Setênio (21-28 anos)</h4>
            <DataField label="Eventos Significativos" value={setenios_eventos?.quarto_setenio_21_28_eventos_significativos} fieldPath="a_setenios_eventos.quarto_setenio_21_28_eventos_significativos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Formação Profissional" value={setenios_eventos?.quarto_setenio_21_28_formacao_profissional} fieldPath="a_setenios_eventos.quarto_setenio_21_28_formacao_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Decênios (28-40+ anos)</h4>
            <DataField label="Climatério/Menopausa" value={setenios_eventos?.decenios_28_40_mais_climaterio_menopausa} fieldPath="a_setenios_eventos.decenios_28_40_mais_climaterio_menopausa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pausas Hormonais" value={setenios_eventos?.decenios_28_40_mais_pausas_hormonais} fieldPath="a_setenios_eventos.decenios_28_40_mais_pausas_hormonais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acumulação" value={setenios_eventos?.decenios_28_40_mais_acumulacao} fieldPath="a_setenios_eventos.decenios_28_40_mais_acumulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estado Atual" value={setenios_eventos?.decenios_28_40_mais_estado_atual} fieldPath="a_setenios_eventos.decenios_28_40_mais_estado_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo" value={setenios_eventos?.decenios_28_40_mais_episodios_estresse_extremo} fieldPath="a_setenios_eventos.decenios_28_40_mais_episodios_estresse_extremo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Gerais</h4>
            <DataField label="Eventos Críticos Identificados" value={setenios_eventos?.eventos_criticos_identificados} fieldPath="a_setenios_eventos.eventos_criticos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Experiência de Virada" value={setenios_eventos?.experiencia_considera_virada} fieldPath="a_setenios_eventos.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diferenças Sazonais/Climáticas nos Sintomas" value={setenios_eventos?.diferencas_sazonais_climaticas_sintomas} fieldPath="a_setenios_eventos.diferencas_sazonais_climaticas_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Ambiente e Contexto */}
      <CollapsibleSection title="Ambiente e Contexto">
          <div className="anamnese-subsection">
            <h4>Contexto Familiar</h4>
            <DataField label="Estado Civil" value={ambiente_contexto?.contexto_familiar_estado_civil} fieldPath="a_ambiente_contexto.contexto_familiar_estado_civil" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Filhos" value={ambiente_contexto?.contexto_familiar_filhos} fieldPath="a_ambiente_contexto.contexto_familiar_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Dinâmica Familiar" value={ambiente_contexto?.contexto_familiar_dinamica_familiar} fieldPath="a_ambiente_contexto.contexto_familiar_dinamica_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suporte Familiar" value={ambiente_contexto?.contexto_familiar_suporte_familiar} fieldPath="a_ambiente_contexto.contexto_familiar_suporte_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relacionamento Conjugal" value={ambiente_contexto?.contexto_familiar_relacionamento_conjugal} fieldPath="a_ambiente_contexto.contexto_familiar_relacionamento_conjugal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Divisão de Tarefas Domésticas" value={ambiente_contexto?.contexto_familiar_divisao_tarefas_domesticas} fieldPath="a_ambiente_contexto.contexto_familiar_divisao_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Vida Sexual Ativa" value={ambiente_contexto?.contexto_familiar_vida_sexual_ativa} fieldPath="a_ambiente_contexto.contexto_familiar_vida_sexual_ativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diálogo sobre Sobrecarga" value={ambiente_contexto?.contexto_familiar_dialogo_sobre_sobrecarga} fieldPath="a_ambiente_contexto.contexto_familiar_dialogo_sobre_sobrecarga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contexto Profissional</h4>
            <DataField label="Área" value={ambiente_contexto?.contexto_profissional_area} fieldPath="a_ambiente_contexto.contexto_profissional_area" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Carga Horária" value={ambiente_contexto?.contexto_profissional_carga_horaria} fieldPath="a_ambiente_contexto.contexto_profissional_carga_horaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Estresse" value={ambiente_contexto?.contexto_profissional_nivel_estresse} fieldPath="a_ambiente_contexto.contexto_profissional_nivel_estresse" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Satisfação" value={ambiente_contexto?.contexto_profissional_satisfacao} fieldPath="a_ambiente_contexto.contexto_profissional_satisfacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ambiente Físico</h4>
            <DataField label="Sedentarismo" value={ambiente_contexto?.ambiente_fisico_sedentarismo} fieldPath="a_ambiente_contexto.ambiente_fisico_sedentarismo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição ao Sol" value={ambiente_contexto?.ambiente_fisico_exposicao_sol} fieldPath="a_ambiente_contexto.ambiente_fisico_exposicao_sol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pratica Atividade Física" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_pratica} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_pratica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Atividade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tipo} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_frequencia} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_intensidade} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem Acompanhamento Profissional" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos de Vida</h4>
            <DataField label="Sono" value={ambiente_contexto?.habitos_vida_sono} fieldPath="a_ambiente_contexto.habitos_vida_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alimentação" value={ambiente_contexto?.habitos_vida_alimentacao} fieldPath="a_ambiente_contexto.habitos_vida_alimentacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Lazer" value={ambiente_contexto?.habitos_vida_lazer} fieldPath="a_ambiente_contexto.habitos_vida_lazer" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritualidade" value={ambiente_contexto?.habitos_vida_espiritualidade} fieldPath="a_ambiente_contexto.habitos_vida_espiritualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Suporte Social</h4>
            <DataField label="Tem Rede de Apoio" value={ambiente_contexto?.suporte_social_tem_rede_apoio} fieldPath="a_ambiente_contexto.suporte_social_tem_rede_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Participa de Grupos Sociais" value={ambiente_contexto?.suporte_social_participa_grupos_sociais} fieldPath="a_ambiente_contexto.suporte_social_participa_grupos_sociais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem com Quem Desabafar" value={ambiente_contexto?.suporte_social_tem_com_quem_desabafar} fieldPath="a_ambiente_contexto.suporte_social_tem_com_quem_desabafar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Fatores de Risco</h4>
            <DataField label="Fatores Estressores" value={ambiente_contexto?.fatores_estressores} fieldPath="a_ambiente_contexto.fatores_estressores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos à Saúde" value={ambiente_contexto?.fatores_externos_saude} fieldPath="a_ambiente_contexto.fatores_externos_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Sensação e Emoções */}
      <CollapsibleSection title="Sensação e Emoções">
          <div className="anamnese-subsection">
            <h4>Emoções e Sensações</h4>
            <DataField label="Emoções Predominantes" value={sensacao_emocoes?.emocoes_predominantes} fieldPath="a_sensacao_emocoes.emocoes_predominantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sensações Corporais" value={sensacao_emocoes?.sensacoes_corporais} fieldPath="a_sensacao_emocoes.sensacoes_corporais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Palavras-chave Emocionais" value={sensacao_emocoes?.palavras_chave_emocionais} fieldPath="a_sensacao_emocoes.palavras_chave_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade Emocional" value={sensacao_emocoes?.intensidade_emocional} fieldPath="a_sensacao_emocoes.intensidade_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Gatilhos Emocionais</h4>
            <DataField label="Consegue Identificar Gatilhos" value={sensacao_emocoes?.consegue_identificar_gatilhos_emocionais} fieldPath="a_sensacao_emocoes.consegue_identificar_gatilhos_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gatilhos Identificados" value={sensacao_emocoes?.gatilhos_identificados} fieldPath="a_sensacao_emocoes.gatilhos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Regulação Emocional</h4>
            <DataField label="Capacidade de Regulação" value={sensacao_emocoes?.regulacao_emocional_capacidade_regulacao} fieldPath="a_sensacao_emocoes.regulacao_emocional_capacidade_regulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Forma de Expressão" value={sensacao_emocoes?.regulacao_emocional_forma_expressao} fieldPath="a_sensacao_emocoes.regulacao_emocional_forma_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Gerencia Estresse/Ansiedade" value={sensacao_emocoes?.regulacao_emocional_como_gerencia_estresse_ansiedade} fieldPath="a_sensacao_emocoes.regulacao_emocional_como_gerencia_estresse_ansiedade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Memória Afetiva" value={sensacao_emocoes?.memoria_afetiva} fieldPath="a_sensacao_emocoes.memoria_afetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sensações Específicas do Reino</h4>
            <DataField label="Usa Palavras Como" value={sensacao_emocoes?.sensacoes_especificas_reino_usa_palavras_como} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_usa_palavras_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={sensacao_emocoes?.sensacoes_especificas_reino_descreve_sensacoes_como} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões de Discurso" value={sensacao_emocoes?.sensacoes_especificas_reino_padroes_discurso} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_padroes_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Conexão Corpo-Mente</h4>
            <DataField label="Percebe Manifestações Corporais das Emoções" value={sensacao_emocoes?.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes} fieldPath="a_sensacao_emocoes.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exemplos" value={sensacao_emocoes?.conexao_corpo_mente_exemplos} fieldPath="a_sensacao_emocoes.conexao_corpo_mente_exemplos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Preocupações e Crenças */}
      <CollapsibleSection title="Preocupações e Crenças">
          <div className="anamnese-subsection">
            <h4>Percepção do Problema</h4>
            <DataField label="Como Percebe o Problema" value={preocupacoes_crencas?.como_percebe_problema} fieldPath="a_preocupacoes_crencas.como_percebe_problema" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Compreensão sobre Causa dos Sintomas" value={preocupacoes_crencas?.compreensao_sobre_causa_sintomas} fieldPath="a_preocupacoes_crencas.compreensao_sobre_causa_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Crenças e Preocupações</h4>
            <DataField label="Crenças Limitantes" value={preocupacoes_crencas?.crencas_limitantes} fieldPath="a_preocupacoes_crencas.crencas_limitantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Explícitas" value={preocupacoes_crencas?.preocupacoes_explicitas} fieldPath="a_preocupacoes_crencas.preocupacoes_explicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Implícitas" value={preocupacoes_crencas?.preocupacoes_implicitas} fieldPath="a_preocupacoes_crencas.preocupacoes_implicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ganhos Secundários" value={preocupacoes_crencas?.ganhos_secundarios} fieldPath="a_preocupacoes_crencas.ganhos_secundarios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Resistências Possíveis" value={preocupacoes_crencas?.resistencias_possiveis} fieldPath="a_preocupacoes_crencas.resistencias_possiveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Expectativas e Insight</h4>
            <DataField label="Condições Genéticas na Família" value={preocupacoes_crencas?.condicoes_geneticas_familia} fieldPath="a_preocupacoes_crencas.condicoes_geneticas_familia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativas Irrealistas" value={preocupacoes_crencas?.expectativas_irrealistas} fieldPath="a_preocupacoes_crencas.expectativas_irrealistas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Insight/Autoconsciência" value={preocupacoes_crencas?.nivel_insight_autoconsciencia} fieldPath="a_preocupacoes_crencas.nivel_insight_autoconsciencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abertura para Mudança" value={preocupacoes_crencas?.abertura_para_mudanca} fieldPath="a_preocupacoes_crencas.abertura_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Barreiras e Desafios</h4>
            <DataField label="Barreiras Percebidas ao Tratamento" value={preocupacoes_crencas?.barreiras_percebidas_tratamento} fieldPath="a_preocupacoes_crencas.barreiras_percebidas_tratamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aspectos do Plano que Parecem Desafiadores" value={preocupacoes_crencas?.aspectos_plano_parecem_desafiadores} fieldPath="a_preocupacoes_crencas.aspectos_plano_parecem_desafiadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Reino e Miasma */}
      <CollapsibleSection title="Reino e Miasma">
          <div className="anamnese-subsection">
            <h4>Reino Predominante</h4>
            <DataField label="Reino" value={reino_miasma?.reino_predominante} fieldPath="a_reino_miasma.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Características Identificadas" value={reino_miasma?.caracteristicas_identificadas} fieldPath="a_reino_miasma.caracteristicas_identificadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Análise Detalhada - Reino Animal</h4>
            <DataField label="Palavras Usadas" value={reino_miasma?.analise_detalhada_reino_animal_palavras_usadas} fieldPath="a_reino_miasma.analise_detalhada_reino_animal_palavras_usadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={reino_miasma?.analise_detalhada_reino_animal_descreve_sensacoes_como} fieldPath="a_reino_miasma.analise_detalhada_reino_animal_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Implicações Terapêuticas</h4>
            <DataField label="Comunicação" value={reino_miasma?.implicacoes_terapeuticas_comunicacao} fieldPath="a_reino_miasma.implicacoes_terapeuticas_comunicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abordagem" value={reino_miasma?.implicacoes_terapeuticas_abordagem} fieldPath="a_reino_miasma.implicacoes_terapeuticas_abordagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Outras Terapias Alinhadas" value={reino_miasma?.implicacoes_terapeuticas_outras_terapias_alinhadas} fieldPath="a_reino_miasma.implicacoes_terapeuticas_outras_terapias_alinhadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Comportamentais</h4>
            <DataField label="Maneira de Vestir" value={reino_miasma?.maneira_vestir} fieldPath="a_reino_miasma.maneira_vestir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Profissão Escolhida" value={reino_miasma?.tipo_profissao_escolhida} fieldPath="a_reino_miasma.tipo_profissao_escolhida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrão de Discurso" value={reino_miasma?.padrao_discurso} fieldPath="a_reino_miasma.padrao_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

        {/* Seção de Upload de Exames - Apenas para VALIDATION + ANAMNESE */}
        <ExamesUploadSection 
          consultaId={consultaId}
          consultaStatus={consultaStatus || ''}
          consultaEtapa={consultaEtapa || ''}
          disabled={readOnly}
        />
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
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const [diagnosticoData, setDiagnosticoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch(`/api/diagnostico/${consultaId}`);
      console.log('📡 Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
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
      const response = await fetch(`/api/diagnostico/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        
        await fetch('/api/ai-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            webhookUrl: webhookEndpoints.edicaoDiagnostico,
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId 
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
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
    integracao_diagnostica,
    habitos_vida
  } = diagnosticoData || {};

  console.log('🔍 DiagnosticoSection - dados recebidos:', diagnosticoData);
  console.log('🔍 DiagnosticoSection - Renderizando componente com dados:', {
    loading,
    hasDiagnosticoData: !!diagnosticoData,
    diagnosticoDataKeys: diagnosticoData ? Object.keys(diagnosticoData) : []
  });

  return (
    <div className="anamnese-sections">
      {/* ==================== DIAGNÓSTICO PRINCIPAL ==================== */}
      <CollapsibleSection title="1. Diagnóstico Principal" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>CID e Diagnósticos</h4>
          <DataField label="CID Principal." value={diagnostico_principal?.cid_principal} fieldPath="d_diagnostico_principal.cid_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnósticos Associados (CID)" value={diagnostico_principal?.diagnosticos_associados_cid} fieldPath="d_diagnostico_principal.diagnosticos_associados_cid" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Avaliação Diagnóstica Sistemática (ADS)</h4>
          <DataField label="Síntese" value={diagnostico_principal?.ads_sintese} fieldPath="d_diagnostico_principal.ads_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Biológico" value={diagnostico_principal?.ads_biologico} fieldPath="d_diagnostico_principal.ads_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico" value={diagnostico_principal?.ads_psicologico} fieldPath="d_diagnostico_principal.ads_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Emocional" value={diagnostico_principal?.ads_emocional} fieldPath="d_diagnostico_principal.ads_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={diagnostico_principal?.ads_social} fieldPath="d_diagnostico_principal.ads_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Espiritual" value={diagnostico_principal?.ads_espiritual} fieldPath="d_diagnostico_principal.ads_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Trilha Causal Sintética" value={diagnostico_principal?.ads_trilha_causal_sintetica} fieldPath="d_diagnostico_principal.ads_trilha_causal_sintetica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Síndrome" value={diagnostico_principal?.ads_tipo_sindrome} fieldPath="d_diagnostico_principal.ads_tipo_sindrome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Gravidade</h4>
          <DataField label="Nível de Gravidade" value={diagnostico_principal?.grav_nivel} fieldPath="d_diagnostico_principal.grav_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={diagnostico_principal?.grav_justificativa} fieldPath="d_diagnostico_principal.grav_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Janela de Intervenção" value={diagnostico_principal?.grav_janela_intervencao} fieldPath="d_diagnostico_principal.grav_janela_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Risco Iminente" value={diagnostico_principal?.grav_risco_iminente} fieldPath="d_diagnostico_principal.grav_risco_iminente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Homeopatia</h4>
          <DataField label="Reino Predominante" value={diagnostico_principal?.reino_predominante} fieldPath="d_diagnostico_principal.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Características do Reino" value={diagnostico_principal?.reino_caracteristicas} fieldPath="d_diagnostico_principal.reino_caracteristicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicamento Principal" value={diagnostico_principal?.homeo_medicamento_principal} fieldPath="d_diagnostico_principal.homeo_medicamento_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={diagnostico_principal?.homeo_justificativa} fieldPath="d_diagnostico_principal.homeo_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência Inicial" value={diagnostico_principal?.homeo_potencia_inicial} fieldPath="d_diagnostico_principal.homeo_potencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={diagnostico_principal?.homeo_frequencia} fieldPath="d_diagnostico_principal.homeo_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicamentos Complementares" value={diagnostico_principal?.medicamentos_complementares} fieldPath="d_diagnostico_principal.medicamentos_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Florais de Bach</h4>
          <DataField label="Florais Indicados" value={diagnostico_principal?.florais_bach_indicados} fieldPath="d_diagnostico_principal.florais_bach_indicados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fórmula Floral Sugerida" value={diagnostico_principal?.formula_floral_sugerida} fieldPath="d_diagnostico_principal.formula_floral_sugerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prognóstico</h4>
          <DataField label="Fatores Favoráveis" value={diagnostico_principal?.prognostico_fatores_favoraveis} fieldPath="d_diagnostico_principal.prognostico_fatores_favoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores Desfavoráveis" value={diagnostico_principal?.prognostico_fatores_desfavoraveis} fieldPath="d_diagnostico_principal.prognostico_fatores_desfavoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Adesão Total)" value={diagnostico_principal?.prob_sucesso_adesao_total} fieldPath="d_diagnostico_principal.prob_sucesso_adesao_total" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Adesão Parcial)" value={diagnostico_principal?.prob_sucesso_adesao_parcial} fieldPath="d_diagnostico_principal.prob_sucesso_adesao_parcial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Sem Adesão)" value={diagnostico_principal?.prob_sucesso_sem_adesao} fieldPath="d_diagnostico_principal.prob_sucesso_sem_adesao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alertas</h4>
          <DataField label="Alertas Críticos" value={diagnostico_principal?.alertas_criticos} fieldPath="d_diagnostico_principal.alertas_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ESTADO GERAL ==================== */}
      <CollapsibleSection title="2. Estado Geral" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Avaliação Global</h4>
          <DataField label="Estado Geral" value={estado_geral?.avaliacao_estado} fieldPath="d_estado_geral.avaliacao_estado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score de Vitalidade" value={estado_geral?.avaliacao_score_vitalidade} fieldPath="d_estado_geral.avaliacao_score_vitalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tendência" value={estado_geral?.avaliacao_tendencia} fieldPath="d_estado_geral.avaliacao_tendencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reserva Fisiológica" value={estado_geral?.avaliacao_reserva_fisiologica} fieldPath="d_estado_geral.avaliacao_reserva_fisiologica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Energia Vital</h4>
          <DataField label="Nível" value={estado_geral?.energia_vital_nivel} fieldPath="d_estado_geral.energia_vital_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.energia_vital_descricao} fieldPath="d_estado_geral.energia_vital_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_geral?.energia_vital_manifestacao} fieldPath="d_estado_geral.energia_vital_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto" value={estado_geral?.energia_vital_impacto} fieldPath="d_estado_geral.energia_vital_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Adaptação ao Stress</h4>
          <DataField label="Nível" value={estado_geral?.adapt_stress_nivel} fieldPath="d_estado_geral.adapt_stress_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.adapt_stress_descricao} fieldPath="d_estado_geral.adapt_stress_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reserva Adaptativa" value={estado_geral?.adapt_stress_reserva_adaptativa} fieldPath="d_estado_geral.adapt_stress_reserva_adaptativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_geral?.adapt_stress_manifestacao} fieldPath="d_estado_geral.adapt_stress_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resiliência</h4>
          <DataField label="Nível" value={estado_geral?.resiliencia_nivel} fieldPath="d_estado_geral.resiliencia_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.resiliencia_descricao} fieldPath="d_estado_geral.resiliencia_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Elasticidade" value={estado_geral?.resiliencia_elasticidade} fieldPath="d_estado_geral.resiliencia_elasticidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tempo de Recuperação" value={estado_geral?.resiliencia_tempo_recuperacao} fieldPath="d_estado_geral.resiliencia_tempo_recuperacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Observação Clínica</h4>
          <DataField label="Fácies" value={estado_geral?.obs_facies} fieldPath="d_estado_geral.obs_facies" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Postura" value={estado_geral?.obs_postura} fieldPath="d_estado_geral.obs_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Marcha" value={estado_geral?.obs_marcha} fieldPath="d_estado_geral.obs_marcha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tonus Muscular" value={estado_geral?.obs_tonus_muscular} fieldPath="d_estado_geral.obs_tonus_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Aparência Geral" value={estado_geral?.obs_aparencia_geral} fieldPath="d_estado_geral.obs_aparencia_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contato Visual" value={estado_geral?.obs_contato_visual} fieldPath="d_estado_geral.obs_contato_visual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Voz" value={estado_geral?.obs_voz} fieldPath="d_estado_geral.obs_voz" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Atividades de Vida Diária (AVD)</h4>
          <DataField label="Autocuidado Básico" value={estado_geral?.avd_autocuidado_basico} fieldPath="d_estado_geral.avd_autocuidado_basico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Trabalho Profissional" value={estado_geral?.avd_trabalho_profissional} fieldPath="d_estado_geral.avd_trabalho_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cuidado com Filhos" value={estado_geral?.avd_cuidado_filhos} fieldPath="d_estado_geral.avd_cuidado_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tarefas Domésticas" value={estado_geral?.avd_tarefas_domesticas} fieldPath="d_estado_geral.avd_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Lazer e Social" value={estado_geral?.avd_lazer_social} fieldPath="d_estado_geral.avd_lazer_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autocuidado Ampliado" value={estado_geral?.avd_autocuidado_ampliado} fieldPath="d_estado_geral.avd_autocuidado_ampliado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Funcionalidade e Qualidade de Vida</h4>
          <DataField label="Score Karnofsky" value={estado_geral?.funcionalidade_score_karnofsky} fieldPath="d_estado_geral.funcionalidade_score_karnofsky" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Limitações Funcionais Específicas" value={estado_geral?.limitacoes_funcionais_especificas} fieldPath="d_estado_geral.limitacoes_funcionais_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Score Geral" value={estado_geral?.whoqol_score_geral} fieldPath="d_estado_geral.whoqol_score_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Físico" value={estado_geral?.whoqol_fisico} fieldPath="d_estado_geral.whoqol_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Psicológico" value={estado_geral?.whoqol_psicologico} fieldPath="d_estado_geral.whoqol_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Social" value={estado_geral?.whoqol_social} fieldPath="d_estado_geral.whoqol_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Ambiental" value={estado_geral?.whoqol_ambiental} fieldPath="d_estado_geral.whoqol_ambiental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Espiritual" value={estado_geral?.whoqol_espiritual} fieldPath="d_estado_geral.whoqol_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Satisfação com a Vida Global" value={estado_geral?.whoqol_satisfacao_vida_global} fieldPath="d_estado_geral.whoqol_satisfacao_vida_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sinais de Alerta e Evolução</h4>
          <DataField label="Sinais de Alerta de Deterioração" value={estado_geral?.sinais_alerta_deterioracao} fieldPath="d_estado_geral.sinais_alerta_deterioracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="10 Anos Atrás" value={estado_geral?.evo_10_anos_atras} fieldPath="d_estado_geral.evo_10_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="5 Anos Atrás" value={estado_geral?.evo_5_anos_atras} fieldPath="d_estado_geral.evo_5_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="3 Anos Atrás" value={estado_geral?.evo_3_anos_atras} fieldPath="d_estado_geral.evo_3_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="1 Ano Atrás" value={estado_geral?.evo_1_ano_atras} fieldPath="d_estado_geral.evo_1_ano_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Atual" value={estado_geral?.evo_atual} fieldPath="d_estado_geral.evo_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Projeção 6 Meses (Sem Intervenção)" value={estado_geral?.projecao_6_meses_sem_intervencao} fieldPath="d_estado_geral.projecao_6_meses_sem_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Impacto nos Diferentes Âmbitos</h4>
          <DataField label="Profissional" value={estado_geral?.impacto_profissional} fieldPath="d_estado_geral.impacto_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Familiar" value={estado_geral?.impacto_familiar} fieldPath="d_estado_geral.impacto_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={estado_geral?.impacto_social} fieldPath="d_estado_geral.impacto_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pessoal" value={estado_geral?.impacto_pessoal} fieldPath="d_estado_geral.impacto_pessoal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Saúde" value={estado_geral?.impacto_saude} fieldPath="d_estado_geral.impacto_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ====================ESTADO MENTAL ==================== */}
      <CollapsibleSection title="3. Estado Mental" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Memória</h4>
          <DataField label="Curto Prazo" value={estado_mental?.memoria_curto_prazo} fieldPath="d_estado_mental.memoria_curto_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Longo Prazo" value={estado_mental?.memoria_longo_prazo} fieldPath="d_estado_mental.memoria_longo_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="De Trabalho" value={estado_mental?.memoria_de_trabalho} fieldPath="d_estado_mental.memoria_de_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Falha" value={estado_mental?.memoria_tipo_falha} fieldPath="d_estado_mental.memoria_tipo_falha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto Funcional" value={estado_mental?.memoria_impacto_funcional} fieldPath="d_estado_mental.memoria_impacto_funcional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.memoria_score} fieldPath="d_estado_mental.memoria_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Atenção</h4>
          <DataField label="Sustentada" value={estado_mental?.atencao_sustentada} fieldPath="d_estado_mental.atencao_sustentada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Seletiva" value={estado_mental?.atencao_seletiva} fieldPath="d_estado_mental.atencao_seletiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alternada" value={estado_mental?.atencao_alternada} fieldPath="d_estado_mental.atencao_alternada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dividida" value={estado_mental?.atencao_dividida} fieldPath="d_estado_mental.atencao_dividida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_mental?.atencao_manifestacao} fieldPath="d_estado_mental.atencao_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.atencao_score} fieldPath="d_estado_mental.atencao_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Funções Executivas</h4>
          <DataField label="Planejamento" value={estado_mental?.exec_planejamento} fieldPath="d_estado_mental.exec_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Organização" value={estado_mental?.exec_organizacao} fieldPath="d_estado_mental.exec_organizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Iniciativa" value={estado_mental?.exec_iniciativa} fieldPath="d_estado_mental.exec_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomada de Decisão" value={estado_mental?.exec_tomada_decisao} fieldPath="d_estado_mental.exec_tomada_decisao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Flexibilidade Cognitiva" value={estado_mental?.exec_flexibilidade_cognitiva} fieldPath="d_estado_mental.exec_flexibilidade_cognitiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle Inibitório" value={estado_mental?.exec_controle_inibitorio} fieldPath="d_estado_mental.exec_controle_inibitorio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.exec_score} fieldPath="d_estado_mental.exec_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Outras Funções Cognitivas</h4>
          <DataField label="Velocidade de Processamento" value={estado_mental?.velocidade_processamento} fieldPath="d_estado_mental.velocidade_processamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Linguagem" value={estado_mental?.linguagem} fieldPath="d_estado_mental.linguagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Humor e Afeto</h4>
          <DataField label="Tipo de Humor" value={estado_mental?.humor_tipo} fieldPath="d_estado_mental.humor_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intensidade" value={estado_mental?.humor_intensidade} fieldPath="d_estado_mental.humor_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Variabilidade" value={estado_mental?.humor_variabilidade} fieldPath="d_estado_mental.humor_variabilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reatividade" value={estado_mental?.humor_reatividade} fieldPath="d_estado_mental.humor_reatividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Padrão Diurno" value={estado_mental?.humor_diurno} fieldPath="d_estado_mental.humor_diurno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Expressão do Afeto" value={estado_mental?.afeto_expressao} fieldPath="d_estado_mental.afeto_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Congruência do Afeto" value={estado_mental?.afeto_congruencia} fieldPath="d_estado_mental.afeto_congruencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Modulação do Afeto" value={estado_mental?.afeto_modulacao} fieldPath="d_estado_mental.afeto_modulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ansiedade</h4>
          <DataField label="Nível" value={estado_mental?.ansiedade_nivel} fieldPath="d_estado_mental.ansiedade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo Predominante" value={estado_mental?.ansiedade_tipo_predominante} fieldPath="d_estado_mental.ansiedade_tipo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestações Físicas" value={estado_mental?.ansiedade_manifestacoes_fisicas} fieldPath="d_estado_mental.ansiedade_manifestacoes_fisicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestações Cognitivas" value={estado_mental?.ansiedade_manifestacoes_cognitivas} fieldPath="d_estado_mental.ansiedade_manifestacoes_cognitivas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score GAD-7 Estimado" value={estado_mental?.ansiedade_score_gad7_estimado} fieldPath="d_estado_mental.ansiedade_score_gad7_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>PHQ-9 (Depressão)</h4>
          <DataField label="Humor Deprimido" value={estado_mental?.phq9_humor_deprimido} fieldPath="d_estado_mental.phq9_humor_deprimido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Anedonia" value={estado_mental?.phq9_anedonia} fieldPath="d_estado_mental.phq9_anedonia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alteração de Apetite" value={estado_mental?.phq9_alteracao_apetite} fieldPath="d_estado_mental.phq9_alteracao_apetite" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alteração de Sono" value={estado_mental?.phq9_alteracao_sono} fieldPath="d_estado_mental.phq9_alteracao_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fadiga" value={estado_mental?.phq9_fadiga} fieldPath="d_estado_mental.phq9_fadiga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Culpa/Inutilidade" value={estado_mental?.phq9_culpa_inutilidade} fieldPath="d_estado_mental.phq9_culpa_inutilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dificuldade de Concentração" value={estado_mental?.phq9_dificuldade_concentracao} fieldPath="d_estado_mental.phq9_dificuldade_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Agitação/Retardo" value={estado_mental?.phq9_agitacao_retardo} fieldPath="d_estado_mental.phq9_agitacao_retardo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pensamentos de Morte/Suicídio" value={estado_mental?.phq9_pensamentos_morte_suicidio} fieldPath="d_estado_mental.phq9_pensamentos_morte_suicidio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score PHQ-9 Estimado" value={estado_mental?.phq9_score_estimado} fieldPath="d_estado_mental.phq9_score_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Irritabilidade</h4>
          <DataField label="Nível" value={estado_mental?.irritabilidade_nivel} fieldPath="d_estado_mental.irritabilidade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={estado_mental?.irritabilidade_frequencia} fieldPath="d_estado_mental.irritabilidade_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Gatilhos" value={estado_mental?.irritabilidade_gatilhos} fieldPath="d_estado_mental.irritabilidade_gatilhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Expressão" value={estado_mental?.irritabilidade_expressao} fieldPath="d_estado_mental.irritabilidade_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle" value={estado_mental?.irritabilidade_controle} fieldPath="d_estado_mental.irritabilidade_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Autoestima e Autopercepção</h4>
          <DataField label="Autoestima Global" value={estado_mental?.autoestima_global} fieldPath="d_estado_mental.autoestima_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autopercepção" value={estado_mental?.autopercepcao} fieldPath="d_estado_mental.autopercepcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autoimagem Corporal" value={estado_mental?.autoimagem_corporal} fieldPath="d_estado_mental.autoimagem_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autoeficácia" value={estado_mental?.autoeficacia} fieldPath="d_estado_mental.autoeficacia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autocompaixão" value={estado_mental?.autocompaixao} fieldPath="d_estado_mental.autocompaixao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pensamento</h4>
          <DataField label="Conteúdo Predominante" value={estado_mental?.pensamento_conteudo_predominante} fieldPath="d_estado_mental.pensamento_conteudo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Processo" value={estado_mental?.pensamento_processo} fieldPath="d_estado_mental.pensamento_processo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Velocidade" value={estado_mental?.pensamento_velocidade} fieldPath="d_estado_mental.pensamento_velocidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Distorções Cognitivas (Beck)" value={estado_mental?.distorcoes_cognitivas_beck} fieldPath="d_estado_mental.distorcoes_cognitivas_beck" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Regulação Emocional</h4>
          <DataField label="Estratégias Atuais" value={estado_mental?.reg_estrategias_atuais} fieldPath="d_estado_mental.reg_estrategias_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efetividade" value={estado_mental?.reg_efetividade} fieldPath="d_estado_mental.reg_efetividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Flexibilidade" value={estado_mental?.reg_flexibilidade} fieldPath="d_estado_mental.reg_flexibilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Motivação</h4>
          <DataField label="Nível Geral" value={estado_mental?.motiv_nivel_geral} fieldPath="d_estado_mental.motiv_nivel_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={estado_mental?.motiv_tipo} fieldPath="d_estado_mental.motiv_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Iniciativa" value={estado_mental?.motiv_iniciativa} fieldPath="d_estado_mental.motiv_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Persistência" value={estado_mental?.motiv_persistencia} fieldPath="d_estado_mental.motiv_persistencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Procrastinação" value={estado_mental?.motiv_procrastinacao} fieldPath="d_estado_mental.motiv_procrastinacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Perspectiva Temporal</h4>
          <DataField label="Passado" value={estado_mental?.tempo_passado} fieldPath="d_estado_mental.tempo_passado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Presente" value={estado_mental?.tempo_presente} fieldPath="d_estado_mental.tempo_presente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Futuro" value={estado_mental?.tempo_futuro} fieldPath="d_estado_mental.tempo_futuro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Risco de Suicídio</h4>
          <DataField label="Nível de Risco" value={estado_mental?.risco_nivel} fieldPath="d_estado_mental.risco_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ideação" value={estado_mental?.risco_ideacao} fieldPath="d_estado_mental.risco_ideacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intenção" value={estado_mental?.risco_intencao} fieldPath="d_estado_mental.risco_intencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Plano" value={estado_mental?.risco_plano} fieldPath="d_estado_mental.risco_plano" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Comportamento Recente" value={estado_mental?.risco_comportamento_recente} fieldPath="d_estado_mental.risco_comportamento_recente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tentativas Prévias" value={estado_mental?.risco_tentativas_previas} fieldPath="d_estado_mental.risco_tentativas_previas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Risco" value={estado_mental?.risco_fatores_risco} fieldPath="d_estado_mental.risco_fatores_risco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Proteção" value={estado_mental?.risco_fatores_protecao} fieldPath="d_estado_mental.risco_fatores_protecao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Requerida" value={estado_mental?.risco_acao_requerida} fieldPath="d_estado_mental.risco_acao_requerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Diagnósticos e Intervenções</h4>
          <DataField label="Diagnósticos Mentais DSM-5 Sugeridos" value={estado_mental?.diagnosticos_mentais_dsm5_sugeridos} fieldPath="d_estado_mental.diagnosticos_mentais_dsm5_sugeridos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção: Psicoterapia" value={estado_mental?.intervencao_psicoterapia} fieldPath="d_estado_mental.intervencao_psicoterapia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência Inicial" value={estado_mental?.intervencao_frequencia_inicial} fieldPath="d_estado_mental.intervencao_frequencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção: Psiquiatria" value={estado_mental?.intervencao_psiquiatria} fieldPath="d_estado_mental.intervencao_psiquiatria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grupos de Apoio" value={estado_mental?.intervencao_grupos_apoio} fieldPath="d_estado_mental.intervencao_grupos_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Técnicas Complementares" value={estado_mental?.intervencao_tecnicas_complementares} fieldPath="d_estado_mental.intervencao_tecnicas_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ESTADO FISIOLÓGICO ==================== */}
      <CollapsibleSection title="4. Estado Fisiológico (Resumo - devido ao volume de campos)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Sistema Endócrino - Tireoide</h4>
          <DataField label="Status" value={estado_fisiologico?.end_tireo_status} fieldPath="d_estado_fisiologico.end_tireo_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.end_tireo_diagnostico} fieldPath="d_estado_fisiologico.end_tireo_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_tireo_acao_terapeutica} fieldPath="d_estado_fisiologico.end_tireo_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Endócrino - Insulina/Glicose</h4>
          <DataField label="Status" value={estado_fisiologico?.end_insgl_status} fieldPath="d_estado_fisiologico.end_insgl_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.end_insgl_diagnostico} fieldPath="d_estado_fisiologico.end_insgl_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_insgl_acao_terapeutica} fieldPath="d_estado_fisiologico.end_insgl_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Gastrointestinal - Intestino</h4>
          <DataField label="Status" value={estado_fisiologico?.gi_int_status} fieldPath="d_estado_fisiologico.gi_int_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.gi_int_diagnostico} fieldPath="d_estado_fisiologico.gi_int_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Prioritária" value={estado_fisiologico?.gi_int_acao_prioritaria} fieldPath="d_estado_fisiologico.gi_int_acao_prioritaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Cardiovascular</h4>
          <DataField label="Status" value={estado_fisiologico?.cv_status} fieldPath="d_estado_fisiologico.cv_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pressão Arterial" value={estado_fisiologico?.cv_pressao_arterial} fieldPath="d_estado_fisiologico.cv_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação" value={estado_fisiologico?.cv_acao} fieldPath="d_estado_fisiologico.cv_acao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Inflamação e Estresse Oxidativo</h4>
          <DataField label="Nível de Inflamação Sistêmica" value={estado_fisiologico?.infl_sist_nivel} fieldPath="d_estado_fisiologico.infl_sist_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Causas" value={estado_fisiologico?.infl_sist_causas} fieldPath="d_estado_fisiologico.infl_sist_causas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível de Estresse Oxidativo" value={estado_fisiologico?.oxi_nivel} fieldPath="d_estado_fisiologico.oxi_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Exames Necessários</h4>
          <DataField label="Urgente (0-15 dias)" value={estado_fisiologico?.exames_urgente_0_15_dias} fieldPath="d_estado_fisiologico.exames_urgente_0_15_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alta Prioridade (30 dias)" value={estado_fisiologico?.exames_alta_prioridade_30_dias} fieldPath="d_estado_fisiologico.exames_alta_prioridade_30_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Média Prioridade (60-90 dias)" value={estado_fisiologico?.exames_media_prioridade_60_90_dias} fieldPath="d_estado_fisiologico.exames_media_prioridade_60_90_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== INTEGRAÇÃO DIAGNÓSTICA ==================== */}
      <CollapsibleSection title="5. Integração Diagnóstica" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Diagnóstico Integrado</h4>
          <DataField label="Título do Diagnóstico" value={integracao_diagnostica?.diagnostico_titulo} fieldPath="d_agente_integracao_diagnostica.diagnostico_titulo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="CID Primário" value={integracao_diagnostica?.diagnostico_cid_primario} fieldPath="d_agente_integracao_diagnostica.diagnostico_cid_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="CIDs Associados" value={integracao_diagnostica?.diagnostico_cids_associados} fieldPath="d_agente_integracao_diagnostica.diagnostico_cids_associados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Síntese Executiva" value={integracao_diagnostica?.diagnostico_sintese_executiva} fieldPath="d_agente_integracao_diagnostica.diagnostico_sintese_executiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Metáfora da Casa (Fundação, Colunas, Cumeeira)</h4>
          <DataField label="Fundação - Status" value={integracao_diagnostica?.fundacao_status} fieldPath="d_agente_integracao_diagnostica.fundacao_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fundação - Eventos" value={integracao_diagnostica?.fundacao_eventos} fieldPath="d_agente_integracao_diagnostica.fundacao_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Colunas - Status" value={integracao_diagnostica?.colunas_status} fieldPath="d_agente_integracao_diagnostica.colunas_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cumeeira - Status" value={integracao_diagnostica?.cumeeira_status} fieldPath="d_agente_integracao_diagnostica.cumeeira_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Colapso - Status" value={integracao_diagnostica?.colapso_status} fieldPath="d_agente_integracao_diagnostica.colapso_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Diagnósticos Específicos</h4>
          <DataField label="Biológico Primário" value={integracao_diagnostica?.diagnostico_biologico_primario} fieldPath="d_agente_integracao_diagnostica.diagnostico_biologico_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico DSM-5" value={integracao_diagnostica?.diagnostico_psicologico_dsm5} fieldPath="d_agente_integracao_diagnostica.diagnostico_psicologico_dsm5" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicossomático - Interpretação" value={integracao_diagnostica?.diagnostico_psicossomatico_interpretacao} fieldPath="d_agente_integracao_diagnostica.diagnostico_psicossomatico_interpretacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Biopsicossocial</h4>
          <DataField label="Biológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_biologico} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_psicologico} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={integracao_diagnostica?.diagnostico_biopsicossocial_social} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Espiritual" value={integracao_diagnostica?.diagnostico_biopsicossocial_espiritual} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Conclusão" value={integracao_diagnostica?.diagnostico_biopsicossocial_conclusao} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_conclusao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Janela Terapêutica</h4>
          <DataField label="Status" value={integracao_diagnostica?.janela_terapeutica_status} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tempo Crítico" value={integracao_diagnostica?.janela_terapeutica_tempo_critico} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_tempo_critico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={integracao_diagnostica?.janela_terapeutica_urgencia} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prognóstico</h4>
          <DataField label="Sem Intervenção - 3 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_3m} fieldPath="d_agente_integracao_diagnostica.prognostico_sem_intervencao_3m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sem Intervenção - 12 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_12m} fieldPath="d_agente_integracao_diagnostica.prognostico_sem_intervencao_12m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Com Intervenção - 1 mês" value={integracao_diagnostica?.prognostico_com_intervencao_1m} fieldPath="d_agente_integracao_diagnostica.prognostico_com_intervencao_1m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Com Intervenção - 6 meses" value={integracao_diagnostica?.prognostico_com_intervencao_6m} fieldPath="d_agente_integracao_diagnostica.prognostico_com_intervencao_6m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Sucesso" value={integracao_diagnostica?.prognostico_fatores_sucesso} fieldPath="d_agente_integracao_diagnostica.prognostico_fatores_sucesso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Estratégia Terapêutica por Fases</h4>
          <DataField label="Fase 1 - Objetivo" value={integracao_diagnostica?.fase1_objetivo} fieldPath="d_agente_integracao_diagnostica.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 1 - Ações Específicas" value={integracao_diagnostica?.fase1_acoes_especificas} fieldPath="d_agente_integracao_diagnostica.fase1_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 2 - Objetivo" value={integracao_diagnostica?.fase2_objetivo} fieldPath="d_agente_integracao_diagnostica.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 2 - Ações Específicas" value={integracao_diagnostica?.fase2_acoes_especificas} fieldPath="d_agente_integracao_diagnostica.fase2_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 3 - Objetivo" value={integracao_diagnostica?.fase3_objetivo} fieldPath="d_agente_integracao_diagnostica.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 4 - Objetivo" value={integracao_diagnostica?.fase4_objetivo} fieldPath="d_agente_integracao_diagnostica.fase4_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Equipe Multiprofissional</h4>
          <DataField label="Core (Obrigatórios)" value={integracao_diagnostica?.equipe_core_obrigatorios} fieldPath="d_agente_integracao_diagnostica.equipe_core_obrigatorios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte (Importantes)" value={integracao_diagnostica?.equipe_suporte_importantes} fieldPath="d_agente_integracao_diagnostica.equipe_suporte_importantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Complementares" value={integracao_diagnostica?.equipe_complementares_potencializadores} fieldPath="d_agente_integracao_diagnostica.equipe_complementares_potencializadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Observações Importantes</h4>
          <DataField label="Contradições e Paradoxos" value={integracao_diagnostica?.contradicoes_paradoxos} fieldPath="d_agente_integracao_diagnostica.contradicoes_paradoxos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Principais Bloqueios para Cura" value={integracao_diagnostica?.principais_bloqueios_para_cura} fieldPath="d_agente_integracao_diagnostica.principais_bloqueios_para_cura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Chaves Terapêuticas Prioritárias" value={integracao_diagnostica?.chaves_terapeuticas_prioritarias} fieldPath="d_agente_integracao_diagnostica.chaves_terapeuticas_prioritarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alertas Críticos da Equipe" value={integracao_diagnostica?.alertas_equipe_criticos} fieldPath="d_agente_integracao_diagnostica.alertas_equipe_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível de Confiança no Diagnóstico" value={integracao_diagnostica?.nivel_confianca_diagnostico} fieldPath="d_agente_integracao_diagnostica.nivel_confianca_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== HÁBITOS DE VIDA ==================== */}
      <CollapsibleSection title="6. Hábitos de Vida (Resumo dos 5 Pilares)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Pilar 1 - Alimentação</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar1_alimentacao_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score de Qualidade" value={habitos_vida?.pilar1_alimentacao_score_qualidade} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_score_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Problemas Identificados" value={habitos_vida?.pilar1_alimentacao_problemas_identificados} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_problemas_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção Requerida" value={habitos_vida?.pilar1_intervencao_requerida_nutricional} fieldPath="d_agente_habitos_vida_sistemica.pilar1_intervencao_requerida_nutricional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 2 - Atividade Física</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar2_atividade_fisica_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar2_atividade_fisica_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar2_atividade_fisica_score} fieldPath="d_agente_habitos_vida_sistemica.pilar2_atividade_fisica_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Padrão de Prática" value={habitos_vida?.pilar2_padrao_pratica_exercicio} fieldPath="d_agente_habitos_vida_sistemica.pilar2_padrao_pratica_exercicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prescrição Fase 1" value={habitos_vida?.pilar2_prescricao_fase1_objetivo} fieldPath="d_agente_habitos_vida_sistemica.pilar2_prescricao_fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 3 - Sono</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar3_sono_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar3_sono_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar3_sono_score} fieldPath="d_agente_habitos_vida_sistemica.pilar3_sono_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Qualidade Subjetiva" value={habitos_vida?.pilar3_padrao_qualidade_subjetiva} fieldPath="d_agente_habitos_vida_sistemica.pilar3_padrao_qualidade_subjetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção Prioridade" value={habitos_vida?.pilar3_intervencao_prioridade} fieldPath="d_agente_habitos_vida_sistemica.pilar3_intervencao_prioridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 4 - Gestão de Stress</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar4_stress_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar4_stress_score} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível Atual" value={habitos_vida?.pilar4_stress_nivel_atual} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_nivel_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fontes de Stress" value={habitos_vida?.pilar4_fontes_stress_profissional} fieldPath="d_agente_habitos_vida_sistemica.pilar4_fontes_stress_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 5 - Espiritualidade</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar5_espiritualidade_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar5_espiritualidade_score} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Práticas Atuais" value={habitos_vida?.pilar5_espiritualidade_praticas_atuais} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_praticas_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ritmo Circadiano</h4>
          <DataField label="Status" value={habitos_vida?.ritmo_circadiano_status} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Problemas" value={habitos_vida?.ritmo_circadiano_problemas} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_problemas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto" value={habitos_vida?.ritmo_circadiano_impacto} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resumo e Prioridades</h4>
          <DataField label="Score Geral de Hábitos de Vida" value={habitos_vida?.score_habitos_vida_geral} fieldPath="d_agente_habitos_vida_sistemica.score_habitos_vida_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prioridades de Intervenção" value={habitos_vida?.prioridades_intervencao_habitos} fieldPath="d_agente_habitos_vida_sistemica.prioridades_intervencao_habitos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Componente da seção de Solução LTB (Limpeza do Terreno Biológico)
function LTBSection({ 
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const [ltbData, setLtbData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLTBData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadLTBData();
    };

    window.addEventListener('ltb-data-refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('ltb-data-refresh', handleRefresh);
    };
  }, []);

  const loadLTBData = async () => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/solutions/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setLtbData(data.solutions.ltb);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de LTB:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await fetch(`/api/solucao-ltb/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId,
            solucao_etapa: 'LTB'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }
      
      // Recarregar dados após salvar
      await loadLTBData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de LTB...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* ==================== INFORMAÇÕES GERAIS ==================== */}
      <CollapsibleSection title="1. Informações Gerais do Protocolo" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Objetivo e Urgência</h4>
          <DataField label="Objetivo Principal" value={ltbData?.objetivo_principal} fieldPath="s_agente_limpeza_do_terreno_biologico.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={ltbData?.urgencia} fieldPath="s_agente_limpeza_do_terreno_biologico.urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 1 - LIMPEZA PROFUNDA ==================== */}
      <CollapsibleSection title="2. Fase 1 - Limpeza Profunda (Hidrocolonterapia + Ozonioterapia)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 1</h4>
          <DataField label="Duração da Fase 1" value={ltbData?.fase1_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.fase1_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 1" value={ltbData?.fase1_objetivo} fieldPath="s_agente_limpeza_do_terreno_biologico.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Hidrocolonterapia</h4>
          <DataField label="Indicação" value={ltbData?.hidrocolonterapia_indicacao} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.hidrocolonterapia_sessoes} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.hidrocolonterapia_frequencia} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.hidrocolonterapia_protocolo} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Temperatura da Água" value={ltbData?.hidrocolonterapia_temperatura_agua} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_temperatura_agua" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Profissional" value={ltbData?.hidrocolonterapia_profissional} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Preparo no Dia" value={ltbData?.hidrocolonterapia_preparo_dia} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_preparo_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pós-Sessão" value={ltbData?.hidrocolonterapia_pos_sessao} fieldPath="s_agente_limpeza_do_terreno_biologico.hidrocolonterapia_pos_sessao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ozonioterapia Intestinal</h4>
          <DataField label="Indicação" value={ltbData?.ozonioterapia_intestinal_indicacao} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.ozonioterapia_intestinal_sessoes} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.ozonioterapia_intestinal_frequencia} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Via de Administração" value={ltbData?.ozonioterapia_intestinal_via} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_via" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Concentração" value={ltbData?.ozonioterapia_intestinal_concentracao} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Sessão" value={ltbData?.ozonioterapia_intestinal_duracao_sessao} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_duracao_sessao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios para o Caso" value={ltbData?.ozonioterapia_intestinal_beneficios_caso} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_beneficios_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Combinar Com" value={ltbData?.ozonioterapia_intestinal_combinar} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_intestinal_combinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ozonioterapia Sistêmica</h4>
          <DataField label="Indicação" value={ltbData?.ozonioterapia_sistemica_indicacao} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={ltbData?.ozonioterapia_sistemica_tipo} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.ozonioterapia_sistemica_sessoes} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.ozonioterapia_sistemica_frequencia} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.ozonioterapia_sistemica_protocolo} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios para o Caso" value={ltbData?.ozonioterapia_sistemica_beneficios_caso} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_beneficios_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Observação" value={ltbData?.ozonioterapia_sistemica_observacao} fieldPath="s_agente_limpeza_do_terreno_biologico.ozonioterapia_sistemica_observacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 2 - ANTIPARASITÁRIO ==================== */}
      <CollapsibleSection title="3. Fase 2 - Protocolo Antiparasitário" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 2</h4>
          <DataField label="Duração da Fase 2" value={ltbData?.fase2_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.fase2_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 2" value={ltbData?.fase2_objetivo} fieldPath="s_agente_limpeza_do_terreno_biologico.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo Escolhido" value={ltbData?.antiparasitario_protocolo_escolhido} fieldPath="s_agente_limpeza_do_terreno_biologico.antiparasitario_protocolo_escolhido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Trio Hulda Clark</h4>
          <DataField label="Composição" value={ltbData?.trio_hulda_clark_composicao} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_composicao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semana 1" value={ltbData?.trio_hulda_clark_posologia_semana_1} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_posologia_semana_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semana 2" value={ltbData?.trio_hulda_clark_posologia_semana_2} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_posologia_semana_2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semanas 3-6" value={ltbData?.trio_hulda_clark_posologia_semana_3_6} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_posologia_semana_3_6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semanas 7-8" value={ltbData?.trio_hulda_clark_posologia_semana_7_8} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_posologia_semana_7_8" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Onde Comprar" value={ltbData?.trio_hulda_clark_onde_comprar} fieldPath="s_agente_limpeza_do_terreno_biologico.trio_hulda_clark_onde_comprar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Óleo de Orégano</h4>
          <DataField label="Tipo" value={ltbData?.oleo_oregano_tipo} fieldPath="s_agente_limpeza_do_terreno_biologico.oleo_oregano_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={ltbData?.oleo_oregano_posologia} fieldPath="s_agente_limpeza_do_terreno_biologico.oleo_oregano_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.oleo_oregano_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.oleo_oregano_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Marca Sugerida" value={ltbData?.oleo_oregano_marca_sugerida} fieldPath="s_agente_limpeza_do_terreno_biologico.oleo_oregano_marca_sugerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Suporte Hepático (Obrigatório)</h4>
          <DataField label="Justificativa" value={ltbData?.suporte_hepatico_obrigatorio_justificativa} fieldPath="s_agente_limpeza_do_terreno_biologico.suporte_hepatico_obrigatorio_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.suporte_hepatico_obrigatorio_protocolo} fieldPath="s_agente_limpeza_do_terreno_biologico.suporte_hepatico_obrigatorio_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Antifúngico e Dieta Anticândida</h4>
          <DataField label="Indicação Antifúngico" value={ltbData?.antifungico_candida_indicacao} fieldPath="s_agente_limpeza_do_terreno_biologico.antifungico_candida_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.antifungico_candida_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.antifungico_candida_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dieta - Eliminar Totalmente" value={ltbData?.dieta_anticandida_eliminar_totalmente} fieldPath="s_agente_limpeza_do_terreno_biologico.dieta_anticandida_eliminar_totalmente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dieta - Focar Em" value={ltbData?.dieta_anticandida_focar} fieldPath="s_agente_limpeza_do_terreno_biologico.dieta_anticandida_focar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração do Rigor na Dieta" value={ltbData?.dieta_anticandida_duracao_rigor} fieldPath="s_agente_limpeza_do_terreno_biologico.dieta_anticandida_duracao_rigor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Antifúngicos Naturais" value={ltbData?.antifungicos_naturais_lista} fieldPath="s_agente_limpeza_do_terreno_biologico.antifungicos_naturais_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probiótico Especial na Fase 2</h4>
          <DataField label="Substância" value={ltbData?.probiotico_especial_substancia} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_especial_substancia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={ltbData?.probiotico_especial_dose} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_especial_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={ltbData?.probiotico_especial_justificativa} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_especial_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.probiotico_especial_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_especial_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Reação de Herxheimer</h4>
          <DataField label="O que é" value={ltbData?.herxheimer_o_que_e} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_o_que_e" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sintomas Possíveis" value={ltbData?.herxheimer_sintomas_possiveis} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_sintomas_possiveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Ocorre" value={ltbData?.herxheimer_quando_ocorre} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_quando_ocorre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.herxheimer_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="É Bom ou Ruim?" value={ltbData?.herxheimer_e_bom_ou_ruim} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_e_bom_ou_ruim" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Minimizar" value={ltbData?.herxheimer_como_minimizar} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_como_minimizar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Parar" value={ltbData?.herxheimer_quando_parar} fieldPath="s_agente_limpeza_do_terreno_biologico.herxheimer_quando_parar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 3 - REPOPULAÇÃO INTESTINAL ==================== */}
      <CollapsibleSection title="4. Fase 3 - Repopulação Intestinal (Rotação de Probióticos)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 3</h4>
          <DataField label="Início da Fase 3" value={ltbData?.fase3_inicio} fieldPath="s_agente_limpeza_do_terreno_biologico.fase3_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Fase 3" value={ltbData?.fase3_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.fase3_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 3" value={ltbData?.fase3_objetivo} fieldPath="s_agente_limpeza_do_terreno_biologico.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estratégia de Rotação - Princípio" value={ltbData?.estrategia_rotacao_principio} fieldPath="s_agente_limpeza_do_terreno_biologico.estrategia_rotacao_principio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 1-2</h4>
          <DataField label="Tipo" value={ltbData?.probiotico_mes1_2_tipo} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes1_2_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência" value={ltbData?.probiotico_mes1_2_potencia} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes1_2_potencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Prioritárias" value={ltbData?.probiotico_mes1_2_cepas_prioritarias} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes1_2_cepas_prioritarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={ltbData?.probiotico_mes1_2_posologia} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes1_2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 3-4</h4>
          <DataField label="Foco" value={ltbData?.probiotico_mes3_4_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes3_4_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Específicas" value={ltbData?.probiotico_mes3_4_cepas_especificas} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes3_4_cepas_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício para o Caso" value={ltbData?.probiotico_mes3_4_beneficio_caso} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes3_4_beneficio_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Produto Exemplo" value={ltbData?.probiotico_mes3_4_produto_exemplo} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes3_4_produto_exemplo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 5-6</h4>
          <DataField label="Foco" value={ltbData?.probiotico_mes5_6_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes5_6_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Específicas" value={ltbData?.probiotico_mes5_6_cepas_especificas} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes5_6_cepas_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício para o Caso" value={ltbData?.probiotico_mes5_6_beneficio_caso} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes5_6_beneficio_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Mês 7+ (Manutenção)</h4>
          <DataField label="Tipo" value={ltbData?.probiotico_mes7_manutencao_tipo} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes7_manutencao_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dosagem" value={ltbData?.probiotico_mes7_manutencao_dosagem} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes7_manutencao_dosagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.probiotico_mes7_manutencao_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.probiotico_mes7_manutencao_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prebióticos</h4>
          <DataField label="Suplementos" value={ltbData?.prebioticos_suplementos} fieldPath="s_agente_limpeza_do_terreno_biologico.prebioticos_suplementos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alimentos" value={ltbData?.prebioticos_alimentos} fieldPath="s_agente_limpeza_do_terreno_biologico.prebioticos_alimentos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Posbióticos (Butirato)</h4>
          <DataField label="O que é" value={ltbData?.posbioticos_butirato_o_que_e} fieldPath="s_agente_limpeza_do_terreno_biologico.posbioticos_butirato_o_que_e" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento" value={ltbData?.posbioticos_butirato_suplemento} fieldPath="s_agente_limpeza_do_terreno_biologico.posbioticos_butirato_suplemento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={ltbData?.posbioticos_butirato_dose} fieldPath="s_agente_limpeza_do_terreno_biologico.posbioticos_butirato_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios" value={ltbData?.posbioticos_butirato_beneficios} fieldPath="s_agente_limpeza_do_terreno_biologico.posbioticos_butirato_beneficios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Adicionar" value={ltbData?.posbioticos_butirato_quando_adicionar} fieldPath="s_agente_limpeza_do_terreno_biologico.posbioticos_butirato_quando_adicionar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 4 - REPARAÇÃO DA MUCOSA ==================== */}
      <CollapsibleSection title="5. Fase 4 - Reparação da Mucosa Intestinal" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 4</h4>
          <DataField label="Duração da Fase 4" value={ltbData?.fase4_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.fase4_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 4" value={ltbData?.fase4_objetivo} fieldPath="s_agente_limpeza_do_terreno_biologico.fase4_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplementos Essenciais para Reparação" value={ltbData?.reparacao_suplementos_essenciais} fieldPath="s_agente_limpeza_do_terreno_biologico.reparacao_suplementos_essenciais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 5 - DETOX HEPÁTICA ==================== */}
      <CollapsibleSection title="6. Fase 5 - Detox Hepática (Se Necessário)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 5</h4>
          <DataField label="Urgência da Fase 5" value={ltbData?.fase5_urgencia} fieldPath="s_agente_limpeza_do_terreno_biologico.fase5_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Fase 5" value={ltbData?.fase5_duracao} fieldPath="s_agente_limpeza_do_terreno_biologico.fase5_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte Hepático Agressivo" value={ltbData?.suporte_hepatico_agressivo} fieldPath="s_agente_limpeza_do_terreno_biologico.suporte_hepatico_agressivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fitoterápicos Detox" value={ltbData?.fitoterapicos_detox} fieldPath="s_agente_limpeza_do_terreno_biologico.fitoterapicos_detox" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Monitoramento Hepático</h4>
          <DataField label="Exames de Controle" value={ltbData?.monitoramento_hepatico_exames_controle} fieldPath="s_agente_limpeza_do_terreno_biologico.monitoramento_hepatico_exames_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meta" value={ltbData?.monitoramento_hepatico_meta} fieldPath="s_agente_limpeza_do_terreno_biologico.monitoramento_hepatico_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 6 - QUELAÇÃO DE METAIS PESADOS ==================== */}
      <CollapsibleSection title="7. Fase 6 - Quelação de Metais Pesados (Se Detectado)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Condições e Protocolo</h4>
          <DataField label="Quando Aplicar" value={ltbData?.fase6_quando} fieldPath="s_agente_limpeza_do_terreno_biologico.fase6_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Se Positivo" value={ltbData?.fase6_se_positivo} fieldPath="s_agente_limpeza_do_terreno_biologico.fase6_se_positivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quelantes Naturais" value={ltbData?.quelantes_naturais} fieldPath="s_agente_limpeza_do_terreno_biologico.quelantes_naturais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte Hídrico" value={ltbData?.suporte_hidrico} fieldPath="s_agente_limpeza_do_terreno_biologico.suporte_hidrico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Quelação Agressiva</h4>
          <DataField label="Quando Considerar" value={ltbData?.quelacao_agressiva_quando_considerar} fieldPath="s_agente_limpeza_do_terreno_biologico.quelacao_agressiva_quando_considerar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipos" value={ltbData?.quelacao_agressiva_tipos} fieldPath="s_agente_limpeza_do_terreno_biologico.quelacao_agressiva_tipos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Fazer" value={ltbData?.quelacao_agressiva_como} fieldPath="s_agente_limpeza_do_terreno_biologico.quelacao_agressiva_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Fazer Sozinha" value={ltbData?.quelacao_agressiva_nao_fazer_sozinha} fieldPath="s_agente_limpeza_do_terreno_biologico.quelacao_agressiva_nao_fazer_sozinha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CRONOGRAMA COMPLETO ==================== */}
      <CollapsibleSection title="8. Cronograma Completo (Resumo por Período)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Mês 1</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes1_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes1_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes1_acoes} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes1_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Mês 2</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes2_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes2_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes2_acoes} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes2_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 3-4</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes3_4_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes3_4_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes3_4_acoes} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes3_4_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 5-6</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes5_6_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes5_6_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes5_6_acoes} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes5_6_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 7-12</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes7_12_foco} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes7_12_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes7_12_acoes} fieldPath="s_agente_limpeza_do_terreno_biologico.cronograma_mes7_12_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== OPÇÃO ECONÔMICA ==================== */}
      <CollapsibleSection title="9. Opção Econômica (Básica)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Alternativa Econômica</h4>
          <DataField label="Sem Terapias Específicas" value={ltbData?.opcao_basica_economica_sem_terapias} fieldPath="s_agente_limpeza_do_terreno_biologico.opcao_basica_economica_sem_terapias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Focar Em" value={ltbData?.opcao_basica_economica_focar} fieldPath="s_agente_limpeza_do_terreno_biologico.opcao_basica_economica_focar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Observação" value={ltbData?.opcao_basica_economica_observacao} fieldPath="s_agente_limpeza_do_terreno_biologico.opcao_basica_economica_observacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SINAIS DE SUCESSO ==================== */}
      <CollapsibleSection title="10. Sinais de Sucesso (Por Período)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Acompanhamento de Resultados</h4>
          <DataField label="Mês 1" value={ltbData?.sinais_sucesso_mes1} fieldPath="s_agente_limpeza_do_terreno_biologico.sinais_sucesso_mes1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 2" value={ltbData?.sinais_sucesso_mes2} fieldPath="s_agente_limpeza_do_terreno_biologico.sinais_sucesso_mes2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meses 3-4" value={ltbData?.sinais_sucesso_mes3_4} fieldPath="s_agente_limpeza_do_terreno_biologico.sinais_sucesso_mes3_4" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 6" value={ltbData?.sinais_sucesso_mes6} fieldPath="s_agente_limpeza_do_terreno_biologico.sinais_sucesso_mes6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 12" value={ltbData?.sinais_sucesso_mes12} fieldPath="s_agente_limpeza_do_terreno_biologico.sinais_sucesso_mes12" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALERTAS CRÍTICOS ==================== */}
      <CollapsibleSection title="11. Alertas Críticos de Segurança" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Avisos Importantes</h4>
          <DataField label="Alertas Críticos" value={ltbData?.alertas_criticos_seguranca} fieldPath="s_agente_limpeza_do_terreno_biologico.alertas_criticos_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Componente da seção de Solução Mentalidade
function MentalidadeSection({ 
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const [mentalidadeData, setMentalidadeData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMentalidadeData();
  }, [consultaId]);

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
      const response = await fetch(`/api/solutions/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setMentalidadeData(data.solutions.mentalidade);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Mentalidade:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await fetch(`/api/solucao-mentalidade/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId,
            solucao_etapa: 'MENTALIDADE'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }
      
      // Recarregar dados após salvar
      await loadMentalidadeData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de Mentalidade...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* ==================== INFORMAÇÕES GERAIS ==================== */}
      <CollapsibleSection title="1. Informações Gerais e Contexto" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Objetivo e Urgência</h4>
          <DataField label="Objetivo Principal" value={mentalidadeData?.objetivo_principal} fieldPath="mentalidade_data.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Realidade do Caso" value={mentalidadeData?.realidade_caso} fieldPath="mentalidade_data.realidade_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={mentalidadeData?.urgencia} fieldPath="mentalidade_data.urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 1 - ESTABILIZAÇÃO ==================== */}
      <CollapsibleSection title="2. Fase 1 - Estabilização da Crise (0-3 meses)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 1</h4>
          <DataField label="Duração da Fase 1" value={mentalidadeData?.fase1_duracao} fieldPath="mentalidade_data.fase1_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 1" value={mentalidadeData?.fase1_objetivo} fieldPath="mentalidade_data.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Psicoterapia</h4>
          <DataField label="Modalidade" value={mentalidadeData?.psicoterapia_modalidade} fieldPath="mentalidade_data.psicoterapia_modalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.psicoterapia_frequencia} fieldPath="mentalidade_data.psicoterapia_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Sessão" value={mentalidadeData?.psicoterapia_duracao_sessao} fieldPath="mentalidade_data.psicoterapia_duracao_sessao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Profissional" value={mentalidadeData?.psicoterapia_profissional} fieldPath="mentalidade_data.psicoterapia_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Foco nas Primeiras Sessões" value={mentalidadeData?.psicoterapia_foco_primeiras_sessoes} fieldPath="mentalidade_data.psicoterapia_foco_primeiras_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Risco Suicida</h4>
          <DataField label="Ação Imediata" value={mentalidadeData?.risco_suicida_acao_imediata} fieldPath="mentalidade_data.risco_suicida_acao_imediata" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Encaminhamento para Psiquiatria" value={mentalidadeData?.risco_suicida_encaminhamento_psiquiatria} fieldPath="mentalidade_data.risco_suicida_encaminhamento_psiquiatria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Avaliação Psiquiátrica</h4>
          <DataField label="Quando Solicitar" value={mentalidadeData?.avaliacao_psiquiatrica_quando} fieldPath="mentalidade_data.avaliacao_psiquiatrica_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo" value={mentalidadeData?.avaliacao_psiquiatrica_objetivo} fieldPath="mentalidade_data.avaliacao_psiquiatrica_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicação Atual - Observações" value={mentalidadeData?.medicacao_atual_observacoes} fieldPath="mentalidade_data.medicacao_atual_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ajustes de Medicação - Opções" value={mentalidadeData?.medicacao_ajustes_opcoes} fieldPath="mentalidade_data.medicacao_ajustes_opcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência de Seguimento com Psiquiatria" value={mentalidadeData?.psiquiatria_frequencia_seguimento} fieldPath="mentalidade_data.psiquiatria_frequencia_seguimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Tireoide (Puran)</h4>
          <DataField label="Dose Atual" value={mentalidadeData?.tireoide_puran_dose_atual} fieldPath="mentalidade_data.tireoide_puran_dose_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ajuste Necessário" value={mentalidadeData?.tireoide_puran_ajuste} fieldPath="mentalidade_data.tireoide_puran_ajuste" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Florais de Bach</h4>
          <DataField label="Justificativa" value={mentalidadeData?.florais_justificativa} fieldPath="mentalidade_data.florais_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fórmula para Crise - Composição" value={mentalidadeData?.florais_formula_crise_composicao} fieldPath="mentalidade_data.florais_formula_crise_composicao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Preparação" value={mentalidadeData?.florais_preparacao} fieldPath="mentalidade_data.florais_preparacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={mentalidadeData?.florais_posologia} fieldPath="mentalidade_data.florais_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={mentalidadeData?.florais_duracao} fieldPath="mentalidade_data.florais_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Onde Comprar/Preparar" value={mentalidadeData?.florais_onde} fieldPath="mentalidade_data.florais_onde" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Homeopatia</h4>
          <DataField label="Medicamento Principal" value={mentalidadeData?.homeopatia_medicamento_principal} fieldPath="mentalidade_data.homeopatia_medicamento_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa para o Caso" value={mentalidadeData?.homeopatia_justificativa_caso} fieldPath="mentalidade_data.homeopatia_justificativa_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência Inicial" value={mentalidadeData?.homeopatia_potencia_inicial} fieldPath="mentalidade_data.homeopatia_potencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={mentalidadeData?.homeopatia_posologia} fieldPath="mentalidade_data.homeopatia_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={mentalidadeData?.homeopatia_duracao} fieldPath="mentalidade_data.homeopatia_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicamentos Complementares" value={mentalidadeData?.homeopatia_medicamentos_complementares} fieldPath="mentalidade_data.homeopatia_medicamentos_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Técnicas de Autorregulação (Emergência)</h4>
          <DataField label="Respiração 4-7-8" value={mentalidadeData?.tecnicas_autorregulacao_respiracao_4_7_8} fieldPath="mentalidade_data.tecnicas_autorregulacao_respiracao_4_7_8" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grounding 5-4-3-2-1" value={mentalidadeData?.tecnicas_autorregulacao_grounding_5_4_3_2_1} fieldPath="mentalidade_data.tecnicas_autorregulacao_grounding_5_4_3_2_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Âncora de Segurança" value={mentalidadeData?.tecnicas_autorregulacao_ancora_seguranca} fieldPath="mentalidade_data.tecnicas_autorregulacao_ancora_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 2 - PROCESSAMENTO PROFUNDO ==================== */}
      <CollapsibleSection title="3. Fase 2 - Processamento Profundo dos Traumas (3-9 meses)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 2</h4>
          <DataField label="Duração da Fase 2" value={mentalidadeData?.fase2_duracao} fieldPath="mentalidade_data.fase2_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 2" value={mentalidadeData?.fase2_objetivo} fieldPath="mentalidade_data.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>EMDR (Eye Movement Desensitization and Reprocessing)</h4>
          <DataField label="Descrição" value={mentalidadeData?.emdr_descricao} fieldPath="mentalidade_data.emdr_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Funciona" value={mentalidadeData?.emdr_como_funciona} fieldPath="mentalidade_data.emdr_como_funciona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Eficácia" value={mentalidadeData?.emdr_eficacia} fieldPath="mentalidade_data.emdr_eficacia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Traumas Prioritários para EMDR" value={mentalidadeData?.emdr_traumas_prioritarios} fieldPath="mentalidade_data.emdr_traumas_prioritarios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Total de Sessões" value={mentalidadeData?.emdr_total_sessoes} fieldPath="mentalidade_data.emdr_total_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.emdr_frequencia} fieldPath="mentalidade_data.emdr_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Profissional" value={mentalidadeData?.emdr_profissional} fieldPath="mentalidade_data.emdr_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Observação Importante" value={mentalidadeData?.emdr_observacao_importante} fieldPath="mentalidade_data.emdr_observacao_importante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Constelação Familiar</h4>
          <DataField label="Descrição" value={mentalidadeData?.constelacao_descricao} fieldPath="mentalidade_data.constelacao_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Indicação para o Caso" value={mentalidadeData?.constelacao_indicacao_caso} fieldPath="mentalidade_data.constelacao_indicacao_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Formatos" value={mentalidadeData?.constelacao_formatos} fieldPath="mentalidade_data.constelacao_formatos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.constelacao_frequencia} fieldPath="mentalidade_data.constelacao_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Total de Sessões" value={mentalidadeData?.constelacao_total_sessoes} fieldPath="mentalidade_data.constelacao_total_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Terapia Somática</h4>
          <DataField label="Descrição" value={mentalidadeData?.terapia_somatica_descricao} fieldPath="mentalidade_data.terapia_somatica_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Indicação para o Caso" value={mentalidadeData?.terapia_somatica_indicacao_caso} fieldPath="mentalidade_data.terapia_somatica_indicacao_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Modalidades" value={mentalidadeData?.terapia_somatica_modalidades} fieldPath="mentalidade_data.terapia_somatica_modalidades" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Funciona" value={mentalidadeData?.terapia_somatica_como_funciona} fieldPath="mentalidade_data.terapia_somatica_como_funciona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.terapia_somatica_frequencia} fieldPath="mentalidade_data.terapia_somatica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sessões" value={mentalidadeData?.terapia_somatica_sessoes} fieldPath="mentalidade_data.terapia_somatica_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Trabalho de Perdão</h4>
          <DataField label="Realidade" value={mentalidadeData?.perdao_realidade} fieldPath="mentalidade_data.perdao_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Oração dos Pais" value={mentalidadeData?.perdao_oracao_pais} fieldPath="mentalidade_data.perdao_oracao_pais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autoperdão no Espelho" value={mentalidadeData?.perdao_autoperdao_espelho} fieldPath="mentalidade_data.perdao_autoperdao_espelho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Carta Nunca Enviada" value={mentalidadeData?.perdao_carta_nunca_enviada} fieldPath="mentalidade_data.perdao_carta_nunca_enviada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 3 - RECONSTRUÇÃO ==================== */}
      <CollapsibleSection title="4. Fase 3 - Reconstrução da Identidade (9-12 meses)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 3</h4>
          <DataField label="Duração da Fase 3" value={mentalidadeData?.fase3_duracao} fieldPath="mentalidade_data.fase3_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 3" value={mentalidadeData?.fase3_objetivo} fieldPath="mentalidade_data.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Trabalho de Autoestima</h4>
          <DataField label="Espelho Diário" value={mentalidadeData?.autoestima_espelho_diario} fieldPath="mentalidade_data.autoestima_espelho_diario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Lista de Conquistas Semanal" value={mentalidadeData?.autoestima_lista_conquistas_semanal} fieldPath="mentalidade_data.autoestima_lista_conquistas_semanal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fotos de Progressão" value={mentalidadeData?.autoestima_fotos_progressao} fieldPath="mentalidade_data.autoestima_fotos_progressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resgate de Sonhos e Essência</h4>
          <DataField label="Realidade" value={mentalidadeData?.resgate_sonhos_essencia_realidade} fieldPath="mentalidade_data.resgate_sonhos_essencia_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resgate da Dança</h4>
          <DataField label="Por Onde Começar" value={mentalidadeData?.resgate_danca_comecar} fieldPath="mentalidade_data.resgate_danca_comecar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Opções" value={mentalidadeData?.resgate_danca_opcoes} fieldPath="mentalidade_data.resgate_danca_opcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência Mínima" value={mentalidadeData?.resgate_danca_frequencia_minima} fieldPath="mentalidade_data.resgate_danca_frequencia_minima" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo" value={mentalidadeData?.resgate_danca_objetivo} fieldPath="mentalidade_data.resgate_danca_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Resistência Esperada" value={mentalidadeData?.resgate_danca_resistencia_esperada} fieldPath="mentalidade_data.resgate_danca_resistencia_esperada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resgate da Expressão Criativa</h4>
          <DataField label="Opções" value={mentalidadeData?.resgate_expressao_criativa_opcoes} fieldPath="mentalidade_data.resgate_expressao_criativa_opcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Escolher" value={mentalidadeData?.resgate_expressao_criativa_escolher} fieldPath="mentalidade_data.resgate_expressao_criativa_escolher" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.resgate_expressao_criativa_frequencia} fieldPath="mentalidade_data.resgate_expressao_criativa_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Treino de Assertividade</h4>
          <DataField label="Realidade" value={mentalidadeData?.assertividade_realidade} fieldPath="mentalidade_data.assertividade_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Treino Gradual" value={mentalidadeData?.assertividade_treino_gradual} fieldPath="mentalidade_data.assertividade_treino_gradual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frases Prontas" value={mentalidadeData?.assertividade_frases_prontas} fieldPath="mentalidade_data.assertividade_frases_prontas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Apoio da Terapia" value={mentalidadeData?.assertividade_apoio_terapia} fieldPath="mentalidade_data.assertividade_apoio_terapia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Reconexão com o Feminino</h4>
          <DataField label="Práticas" value={mentalidadeData?.reconexao_feminino_praticas} fieldPath="mentalidade_data.reconexao_feminino_praticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== PRÁTICAS DIÁRIAS ==================== */}
      <CollapsibleSection title="5. Práticas Diárias de Manutenção" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Meditação</h4>
          <DataField label="Duração" value={mentalidadeData?.meditacao_duracao} fieldPath="mentalidade_data.meditacao_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={mentalidadeData?.meditacao_horario} fieldPath="mentalidade_data.meditacao_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Apps Recomendados" value={mentalidadeData?.meditacao_apps_recomendados} fieldPath="mentalidade_data.meditacao_apps_recomendados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Iniciar" value={mentalidadeData?.meditacao_inicio} fieldPath="mentalidade_data.meditacao_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Meditação" value={mentalidadeData?.meditacao_tipo} fieldPath="mentalidade_data.meditacao_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios" value={mentalidadeData?.meditacao_beneficios} fieldPath="mentalidade_data.meditacao_beneficios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Diário de Gratidão</h4>
          <DataField label="Quando Fazer" value={mentalidadeData?.diario_gratidao_quando} fieldPath="mentalidade_data.diario_gratidao_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Praticar" value={mentalidadeData?.diario_gratidao_pratica} fieldPath="mentalidade_data.diario_gratidao_pratica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exemplos" value={mentalidadeData?.diario_gratidao_exemplos} fieldPath="mentalidade_data.diario_gratidao_exemplos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efeito no Cérebro" value={mentalidadeData?.diario_gratidao_efeito_cerebro} fieldPath="mentalidade_data.diario_gratidao_efeito_cerebro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Afirmações Positivas</h4>
          <DataField label="Quando Fazer" value={mentalidadeData?.afirmacoes_quando} fieldPath="mentalidade_data.afirmacoes_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exemplos Específicos" value={mentalidadeData?.afirmacoes_exemplos} fieldPath="mentalidade_data.afirmacoes_exemplos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Fazer" value={mentalidadeData?.afirmacoes_como} fieldPath="mentalidade_data.afirmacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Resistência Interna" value={mentalidadeData?.afirmacoes_resistencia} fieldPath="mentalidade_data.afirmacoes_resistencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Movimento Consciente</h4>
          <DataField label="Opções" value={mentalidadeData?.movimento_consciente_opcoes} fieldPath="mentalidade_data.movimento_consciente_opcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Fazer" value={mentalidadeData?.movimento_consciente_quando} fieldPath="mentalidade_data.movimento_consciente_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo" value={mentalidadeData?.movimento_consciente_objetivo} fieldPath="mentalidade_data.movimento_consciente_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={mentalidadeData?.movimento_consciente_frequencia} fieldPath="mentalidade_data.movimento_consciente_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== REDE DE APOIO ==================== */}
      <CollapsibleSection title="6. Rede de Apoio" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Grupo de Apoio</h4>
          <DataField label="Importância" value={mentalidadeData?.grupo_apoio_importancia} fieldPath="mentalidade_data.grupo_apoio_importancia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência Ideal" value={mentalidadeData?.grupo_apoio_frequencia_ideal} fieldPath="mentalidade_data.grupo_apoio_frequencia_ideal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Substitui Terapia" value={mentalidadeData?.grupo_apoio_nao_substitui_terapia} fieldPath="mentalidade_data.grupo_apoio_nao_substitui_terapia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CRONOGRAMA E MONITORAMENTO ==================== */}
      <CollapsibleSection title="7. Cronograma e Monitoramento" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Cronograma Mental (12 Meses)</h4>
          <DataField label="Cronograma Completo" value={mentalidadeData?.cronograma_mental_12_meses} fieldPath="mentalidade_data.cronograma_mental_12_meses" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sinais de Progresso</h4>
          <DataField label="Sinais de Progresso Mental" value={mentalidadeData?.sinais_progresso_mental} fieldPath="mentalidade_data.sinais_progresso_mental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alertas Críticos</h4>
          <DataField label="Alertas Críticos de Saúde Mental" value={mentalidadeData?.alertas_criticos_saude_mental} fieldPath="mentalidade_data.alertas_criticos_saude_mental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Componente da seção de Solução Suplementação
function SuplemementacaoSection({ 
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const [suplementacaoData, setSuplementacaoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuplemementacaoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadSuplemementacaoData();
    };

    window.addEventListener('suplementacao-data-refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('suplementacao-data-refresh', handleRefresh);
    };
  }, []);

  const loadSuplemementacaoData = async () => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/solutions/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setSuplementacaoData(data.solutions.suplementacao);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Suplementação:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await fetch(`/api/solucao-suplementacao/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId,
            solucao_etapa: 'SUPLEMENTACAO'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }
      
      // Recarregar dados após salvar
      await loadSuplemementacaoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de Suplementação...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* ==================== INFORMAÇÕES GERAIS ==================== */}
      <CollapsibleSection title="1. Objetivo e Filosofia da Suplementação" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Objetivo</h4>
          <DataField label="Objetivo Principal" value={suplementacaoData?.objetivo_principal} fieldPath="suplementacao_data.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Filosofia da Suplementação</h4>
          <DataField label="Realidade da Filosofia" value={suplementacaoData?.filosofia_realidade} fieldPath="suplementacao_data.filosofia_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Princípio" value={suplementacaoData?.filosofia_principio} fieldPath="suplementacao_data.filosofia_principio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ordem de Prioridade" value={suplementacaoData?.filosofia_ordem_prioridade} fieldPath="suplementacao_data.filosofia_ordem_prioridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.filosofia_duracao} fieldPath="suplementacao_data.filosofia_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ajustes" value={suplementacaoData?.filosofia_ajustes} fieldPath="suplementacao_data.filosofia_ajustes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SUPLEMENTOS POR CATEGORIA ==================== */}
      <CollapsibleSection title="2. Suplementos por Categoria" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 1 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat1_sup1_nome} fieldPath="suplementacao_data.cat1_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat1_sup1_finalidade} fieldPath="suplementacao_data.cat1_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat1_sup1_posologia} fieldPath="suplementacao_data.cat1_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat1_sup1_observacoes} fieldPath="suplementacao_data.cat1_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat1_sup2_nome} fieldPath="suplementacao_data.cat1_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat1_sup2_finalidade} fieldPath="suplementacao_data.cat1_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat1_sup2_posologia} fieldPath="suplementacao_data.cat1_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat1_sup2_observacoes} fieldPath="suplementacao_data.cat1_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 2 ==================== */}
      <CollapsibleSection title="3. Categoria 2 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 2 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat2_sup1_nome} fieldPath="suplementacao_data.cat2_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat2_sup1_finalidade} fieldPath="suplementacao_data.cat2_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat2_sup1_posologia} fieldPath="suplementacao_data.cat2_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat2_sup1_observacoes} fieldPath="suplementacao_data.cat2_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat2_sup2_nome} fieldPath="suplementacao_data.cat2_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat2_sup2_finalidade} fieldPath="suplementacao_data.cat2_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat2_sup2_posologia} fieldPath="suplementacao_data.cat2_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat2_sup2_observacoes} fieldPath="suplementacao_data.cat2_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 3 ==================== */}
      <CollapsibleSection title="4. Categoria 3 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 3 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat3_sup1_nome} fieldPath="suplementacao_data.cat3_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat3_sup1_finalidade} fieldPath="suplementacao_data.cat3_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat3_sup1_posologia} fieldPath="suplementacao_data.cat3_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat3_sup1_observacoes} fieldPath="suplementacao_data.cat3_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat3_sup2_nome} fieldPath="suplementacao_data.cat3_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat3_sup2_finalidade} fieldPath="suplementacao_data.cat3_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat3_sup2_posologia} fieldPath="suplementacao_data.cat3_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat3_sup2_observacoes} fieldPath="suplementacao_data.cat3_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 4 ==================== */}
      <CollapsibleSection title="5. Categoria 4 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 4 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat4_sup1_nome} fieldPath="suplementacao_data.cat4_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat4_sup1_finalidade} fieldPath="suplementacao_data.cat4_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat4_sup1_posologia} fieldPath="suplementacao_data.cat4_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat4_sup1_observacoes} fieldPath="suplementacao_data.cat4_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat4_sup2_nome} fieldPath="suplementacao_data.cat4_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat4_sup2_finalidade} fieldPath="suplementacao_data.cat4_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat4_sup2_posologia} fieldPath="suplementacao_data.cat4_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat4_sup2_observacoes} fieldPath="suplementacao_data.cat4_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 5 ==================== */}
      <CollapsibleSection title="6. Categoria 5 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 5 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat5_sup1_nome} fieldPath="suplementacao_data.cat5_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat5_sup1_finalidade} fieldPath="suplementacao_data.cat5_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat5_sup1_posologia} fieldPath="suplementacao_data.cat5_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat5_sup1_observacoes} fieldPath="suplementacao_data.cat5_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat5_sup2_nome} fieldPath="suplementacao_data.cat5_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat5_sup2_finalidade} fieldPath="suplementacao_data.cat5_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat5_sup2_posologia} fieldPath="suplementacao_data.cat5_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat5_sup2_observacoes} fieldPath="suplementacao_data.cat5_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 6 ==================== */}
      <CollapsibleSection title="7. Categoria 6 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 6 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat6_sup1_nome} fieldPath="suplementacao_data.cat6_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat6_sup1_finalidade} fieldPath="suplementacao_data.cat6_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat6_sup1_posologia} fieldPath="suplementacao_data.cat6_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat6_sup1_observacoes} fieldPath="suplementacao_data.cat6_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat6_sup2_nome} fieldPath="suplementacao_data.cat6_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat6_sup2_finalidade} fieldPath="suplementacao_data.cat6_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat6_sup2_posologia} fieldPath="suplementacao_data.cat6_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat6_sup2_observacoes} fieldPath="suplementacao_data.cat6_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 7 ==================== */}
      <CollapsibleSection title="8. Categoria 7 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 7 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat7_sup1_nome} fieldPath="suplementacao_data.cat7_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat7_sup1_finalidade} fieldPath="suplementacao_data.cat7_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat7_sup1_posologia} fieldPath="suplementacao_data.cat7_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat7_sup1_observacoes} fieldPath="suplementacao_data.cat7_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat7_sup2_nome} fieldPath="suplementacao_data.cat7_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat7_sup2_finalidade} fieldPath="suplementacao_data.cat7_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat7_sup2_posologia} fieldPath="suplementacao_data.cat7_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat7_sup2_observacoes} fieldPath="suplementacao_data.cat7_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 8 ==================== */}
      <CollapsibleSection title="9. Categoria 8 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 8 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat8_sup1_nome} fieldPath="suplementacao_data.cat8_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat8_sup1_finalidade} fieldPath="suplementacao_data.cat8_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat8_sup1_posologia} fieldPath="suplementacao_data.cat8_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat8_sup1_observacoes} fieldPath="suplementacao_data.cat8_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat8_sup2_nome} fieldPath="suplementacao_data.cat8_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat8_sup2_finalidade} fieldPath="suplementacao_data.cat8_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat8_sup2_posologia} fieldPath="suplementacao_data.cat8_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat8_sup2_observacoes} fieldPath="suplementacao_data.cat8_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CATEGORIA 9 ==================== */}
      <CollapsibleSection title="10. Categoria 9 - Suplementos" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Categoria 9 - Suplementos</h4>
          <DataField label="Suplemento 1 - Nome" value={suplementacaoData?.cat9_sup1_nome} fieldPath="suplementacao_data.cat9_sup1_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Finalidade" value={suplementacaoData?.cat9_sup1_finalidade} fieldPath="suplementacao_data.cat9_sup1_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Posologia" value={suplementacaoData?.cat9_sup1_posologia} fieldPath="suplementacao_data.cat9_sup1_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 1 - Observações" value={suplementacaoData?.cat9_sup1_observacoes} fieldPath="suplementacao_data.cat9_sup1_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Suplemento 2 - Nome" value={suplementacaoData?.cat9_sup2_nome} fieldPath="suplementacao_data.cat9_sup2_nome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Finalidade" value={suplementacaoData?.cat9_sup2_finalidade} fieldPath="suplementacao_data.cat9_sup2_finalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Posologia" value={suplementacaoData?.cat9_sup2_posologia} fieldPath="suplementacao_data.cat9_sup2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento 2 - Observações" value={suplementacaoData?.cat9_sup2_observacoes} fieldPath="suplementacao_data.cat9_sup2_observacoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== PROTOCOLOS POR MÊS ==================== */}
      <CollapsibleSection title="11. Protocolos por Mês" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Protocolo Mês 1-2</h4>
          <DataField label="Lista de Suplementos" value={suplementacaoData?.protocolo_mes1_2_lista} fieldPath="suplementacao_data.protocolo_mes1_2_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={suplementacaoData?.protocolo_mes1_2_justificativa} fieldPath="suplementacao_data.protocolo_mes1_2_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Protocolo Mês 3-6</h4>
          <DataField label="Lista de Suplementos" value={suplementacaoData?.protocolo_mes3_6_lista} fieldPath="suplementacao_data.protocolo_mes3_6_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={suplementacaoData?.protocolo_mes3_6_justificativa} fieldPath="suplementacao_data.protocolo_mes3_6_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Protocolo Mês 7-12</h4>
          <DataField label="Lista de Suplementos" value={suplementacaoData?.protocolo_mes7_12_lista} fieldPath="suplementacao_data.protocolo_mes7_12_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={suplementacaoData?.protocolo_mes7_12_justificativa} fieldPath="suplementacao_data.protocolo_mes7_12_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== HORÁRIOS DE TOMADA ==================== */}
      <CollapsibleSection title="12. Horários de Tomada" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Cronograma Diário</h4>
          <DataField label="Jejum ao Acordar" value={suplementacaoData?.horario_jejum_acordar} fieldPath="suplementacao_data.horario_jejum_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Café da Manhã" value={suplementacaoData?.horario_cafe_manha} fieldPath="suplementacao_data.horario_cafe_manha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Almoço" value={suplementacaoData?.horario_almoco} fieldPath="suplementacao_data.horario_almoco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meio da Tarde" value={suplementacaoData?.horario_meio_tarde} fieldPath="suplementacao_data.horario_meio_tarde" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Jantar" value={suplementacaoData?.horario_jantar} fieldPath="suplementacao_data.horario_jantar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="1h Antes de Dormir" value={suplementacaoData?.horario_1h_antes_dormir} fieldPath="suplementacao_data.horario_1h_antes_dormir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="30min Antes de Dormir" value={suplementacaoData?.horario_30min_antes_dormir} fieldPath="suplementacao_data.horario_30min_antes_dormir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== EXAMES DE CONTROLE ==================== */}
      <CollapsibleSection title="13. Exames de Controle" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Cronograma de Exames</h4>
          <DataField label="Exames Basais - Mês 1" value={suplementacaoData?.exames_basal_mes1} fieldPath="suplementacao_data.exames_basal_mes1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exames de Controle - Mês 3" value={suplementacaoData?.exames_controle_mes3} fieldPath="suplementacao_data.exames_controle_mes3" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exames de Controle - Mês 6" value={suplementacaoData?.exames_controle_mes6} fieldPath="suplementacao_data.exames_controle_mes6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exames de Controle - Mês 12" value={suplementacaoData?.exames_controle_mes12} fieldPath="suplementacao_data.exames_controle_mes12" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exames para Ajustar Doses" value={suplementacaoData?.exames_ajustar_doses} fieldPath="suplementacao_data.exames_ajustar_doses" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALERTAS DE SEGURANÇA ==================== */}
      <CollapsibleSection title="14. Alertas de Segurança" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Alertas Importantes</h4>
          <DataField label="Alertas de Segurança" value={suplementacaoData?.alertas_seguranca} fieldPath="suplementacao_data.alertas_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>


    </div>
  );
}

// Componente da seção de Solução Alimentação
function AlimentacaoSection({ 
  consultaId
}: {
  consultaId: string;
}) {
  const [alimentacaoData, setAlimentacaoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<{refeicao: string, index: number} | null>(null);
  const [editForm, setEditForm] = useState({
    alimento: '',
    tipo: '',
    gramatura: '',
    kcal: ''
  });

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

  const loadAlimentacaoData = async () => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/solutions/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setAlimentacaoData(data.solutions.alimentacao);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Alimentação:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await fetch(`/api/alimentacao/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId,
            solucao_etapa: 'ALIMENTACAO'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }
      
      // Recarregar dados após salvar
      await loadAlimentacaoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleEditItem = (refeicao: string, index: number, item: any) => {
    setEditingItem({ refeicao, index });
    setEditForm({
      alimento: item.alimento || '',
      tipo: item.tipo || '',
      gramatura: item.gramatura || '',
      kcal: item.kcal || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    try {
      // Salvar dados na tabela s_gramaturas_alimentares
      const response = await fetch(`/api/alimentacao/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refeicao: editingItem.refeicao,
          index: editingItem.index,
          alimento: editForm.alimento,
          tipo: editForm.tipo,
          gramatura: editForm.gramatura,
          kcal: editForm.kcal
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar dados');
      }

      // Fechar modal
      setEditingItem(null);
      setEditForm({ alimento: '', tipo: '', gramatura: '', kcal: '' });
      
      // Recarregar dados
      await loadAlimentacaoData();
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      alert('Erro ao salvar edição. Tente novamente.');
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({ alimento: '', tipo: '', gramatura: '', kcal: '' });
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de alimentação...</p>
      </div>
    );
  }

  const refeicoes = [
    { key: 'cafe_da_manha', label: 'Café da Manhã' },
    { key: 'almoco', label: 'Almoço' },
    { key: 'cafe_da_tarde', label: 'Café da Tarde' },
    { key: 'jantar', label: 'Jantar' }
  ];

  const getRefeicaoData = (refeicaoKey: string) => {
    if (!alimentacaoData || !Array.isArray(alimentacaoData)) return [];
    
    // Filtrar os dados por tipo de alimento baseado na refeição
    const tipoMap: { [key: string]: string[] } = {
      'cafe_da_manha': ['proteinas', 'carboidratos', 'frutas'],
      'almoco': ['proteinas', 'carboidratos', 'vegetais'],
      'cafe_da_tarde': ['frutas', 'carboidratos'],
      'jantar': ['proteinas', 'vegetais']
    };
    
    const tiposPermitidos = tipoMap[refeicaoKey] || [];
    return alimentacaoData.filter(item => 
      tiposPermitidos.includes(item.tipo_de_alimentos)
    );
  };

  return (
    <div className="anamnese-sections">
      <div className="alimentacao-container">
        <h2 className="alimentacao-title">Alimentação</h2>
        
        {/* Grid de refeições */}
        <div className="refeicoes-grid">
          {refeicoes.map((refeicao) => {
            const items = getRefeicaoData(refeicao.key);
            
            return (
              <div key={refeicao.key} className="refeicao-section">
                <h3 className="refeicao-title">{refeicao.label}</h3>
                <div className="refeicao-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Alimento</th>
                        <th>Tipo</th>
                        <th>Gramatura</th>
                        <th>Kcal</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length > 0 ? (
                        items.map((item: any, index: number) => (
                          <tr key={item.id}>
                            <td>{item.alimento}</td>
                            <td>{item.tipo || '-'}</td>
                            <td>{item.gramatura}</td>
                            <td>{item.kcal}</td>
                            <td>
                              <button
                                onClick={() => handleEditItem(refeicao.key, index, item)}
                                className="edit-button"
                                title="Editar item"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="empty-row">
                            Nenhum item adicionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de edição */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Editar Item - {refeicoes.find(r => r.key === editingItem.refeicao)?.label}</h3>
            <div className="edit-form">
              <div className="form-group">
                <label>Alimento:</label>
                <input
                  type="text"
                  value={editForm.alimento}
                  onChange={(e) => setEditForm({...editForm, alimento: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Tipo:</label>
                <select
                  value={editForm.tipo}
                  onChange={(e) => setEditForm({...editForm, tipo: e.target.value})}
                >
                  <option value="">Selecione o tipo</option>
                  <option value="Proteína">Proteína</option>
                  <option value="Carboidrato">Carboidrato</option>
                  <option value="Gordura">Gordura</option>
                  <option value="Fibra">Fibra</option>
                  <option value="Vitamina">Vitamina</option>
                  <option value="Mineral">Mineral</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Gramatura:</label>
                <input
                  type="text"
                  value={editForm.gramatura}
                  onChange={(e) => setEditForm({...editForm, gramatura: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Kcal:</label>
                <input
                  type="text"
                  value={editForm.kcal}
                  onChange={(e) => setEditForm({...editForm, kcal: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={handleCancelEdit} className="btn-cancel">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} className="btn-save">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente da seção de Solução Hábitos de Vida
function HabitosDeVidaSection({ 
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const [habitosVidaData, setHabitosVidaData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHabitosVidaData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadHabitosVidaData();
    };

    window.addEventListener('habitos-vida-data-refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('habitos-vida-data-refresh', handleRefresh);
    };
  }, []);

  const loadHabitosVidaData = async () => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/solutions/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setHabitosVidaData(data.solutions.habitos);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Hábitos de Vida:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await fetch(`/api/solucao-habitos-vida/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fieldPath, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no Supabase');
      
      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath, 
            texto: newValue,
            consultaId,
            solucao_etapa: 'HABITOS_DE_VIDA'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }
      
      // Recarregar dados após salvar
      await loadHabitosVidaData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de Hábitos de Vida...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* ==================== INFORMAÇÕES GERAIS ==================== */}
      <CollapsibleSection title="1. Metas e Foco por Período" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Metas Mensais</h4>
          <DataField label="Mês 1-2 - Foco" value={habitosVidaData?.mes_1_2_foco} fieldPath="habitos_vida_data.mes_1_2_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 1-2 - Meta" value={habitosVidaData?.mes_1_2_meta} fieldPath="habitos_vida_data.mes_1_2_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mudanças Simultâneas Máximo" value={habitosVidaData?.mes_1_2_mudancas_simultaneas_maximo} fieldPath="habitos_vida_data.mes_1_2_mudancas_simultaneas_maximo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Mês 3-4 - Foco" value={habitosVidaData?.mes_3_4_foco} fieldPath="habitos_vida_data.mes_3_4_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 3-4 - Meta" value={habitosVidaData?.mes_3_4_meta} fieldPath="habitos_vida_data.mes_3_4_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Mês 5-6 - Foco" value={habitosVidaData?.mes_5_6_foco} fieldPath="habitos_vida_data.mes_5_6_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 5-6 - Meta" value={habitosVidaData?.mes_5_6_meta} fieldPath="habitos_vida_data.mes_5_6_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Mês 7-9 - Meta" value={habitosVidaData?.mes_7_9_meta} fieldPath="habitos_vida_data.mes_7_9_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 10-12 - Meta" value={habitosVidaData?.mes_10_12_meta} fieldPath="habitos_vida_data.mes_10_12_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== RITUAIS ==================== */}
      <CollapsibleSection title="2. Rituais Diários" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Rituais Matinais</h4>
          <DataField label="Sequência do Ritual Matinal" value={habitosVidaData?.ritual_matinal_sequencia} fieldPath="habitos_vida_data.ritual_matinal_sequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Regras do Ritual Matinal" value={habitosVidaData?.ritual_matinal_regra} fieldPath="habitos_vida_data.ritual_matinal_regra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Rituais de Refeições</h4>
          <DataField label="Sequência das Refeições" value={habitosVidaData?.ritual_refeicoes_sequencia} fieldPath="habitos_vida_data.ritual_refeicoes_sequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência das Refeições" value={habitosVidaData?.ritual_refeicoes_frequencia} fieldPath="habitos_vida_data.ritual_refeicoes_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Rituais de Sono</h4>
          <DataField label="Sequência do Sono" value={habitosVidaData?.ritual_sono_sequencia} fieldPath="habitos_vida_data.ritual_sono_sequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Regras do Sono" value={habitosVidaData?.ritual_sono_regra} fieldPath="habitos_vida_data.ritual_sono_regra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== RECURSOS ==================== */}
      <CollapsibleSection title="3. Recursos e Ferramentas" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Apps e Livros</h4>
          <DataField label="Apps Recomendados" value={habitosVidaData?.apps_recomendados} fieldPath="habitos_vida_data.apps_recomendados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Livros" value={habitosVidaData?.livros} fieldPath="habitos_vida_data.livros" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Comunidade e Profissionais</h4>
          <DataField label="Comunidades" value={habitosVidaData?.comunidades} fieldPath="habitos_vida_data.comunidades" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Profissionais" value={habitosVidaData?.profissionais} fieldPath="habitos_vida_data.profissionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alertas</h4>
          <DataField label="Alertas Importantes" value={habitosVidaData?.alertas_importantes} fieldPath="habitos_vida_data.alertas_importantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CRONOGRAMA DIÁRIO ==================== */}
      <CollapsibleSection title="4. Cronograma Diário" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Horários de Segunda a Sexta</h4>
          <DataField label="6h00-6h05" value={habitosVidaData?.dia_util_6h00_6h05} fieldPath="habitos_vida_data.dia_util_6h00_6h05" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="6h05-6h15" value={habitosVidaData?.dia_util_6h05_6h15} fieldPath="habitos_vida_data.dia_util_6h05_6h15" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="6h15-6h30" value={habitosVidaData?.dia_util_6h15_6h30} fieldPath="habitos_vida_data.dia_util_6h15_6h30" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="6h30-7h00" value={habitosVidaData?.dia_util_6h30_7h00} fieldPath="habitos_vida_data.dia_util_6h30_7h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="7h00-7h30" value={habitosVidaData?.dia_util_7h00_7h30} fieldPath="habitos_vida_data.dia_util_7h00_7h30" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="7h30-8h00" value={habitosVidaData?.dia_util_7h30_8h00} fieldPath="habitos_vida_data.dia_util_7h30_8h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="8h00-9h00" value={habitosVidaData?.dia_util_8h00_9h00} fieldPath="habitos_vida_data.dia_util_8h00_9h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="9h00-10h00" value={habitosVidaData?.dia_util_9h00_10h00} fieldPath="habitos_vida_data.dia_util_9h00_10h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="10h00-11h00" value={habitosVidaData?.dia_util_10h00_11h00} fieldPath="habitos_vida_data.dia_util_10h00_11h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="11h00-12h00" value={habitosVidaData?.dia_util_11h00_12h00} fieldPath="habitos_vida_data.dia_util_11h00_12h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="12h00-12h30" value={habitosVidaData?.dia_util_12h00_12h30} fieldPath="habitos_vida_data.dia_util_12h00_12h30" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="12h30-13h00" value={habitosVidaData?.dia_util_12h30_13h00} fieldPath="habitos_vida_data.dia_util_12h30_13h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="13h00-14h00" value={habitosVidaData?.dia_util_13h00_14h00} fieldPath="habitos_vida_data.dia_util_13h00_14h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="14h00-15h00" value={habitosVidaData?.dia_util_14h00_15h00} fieldPath="habitos_vida_data.dia_util_14h00_15h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="15h00-16h00" value={habitosVidaData?.dia_util_15h00_16h00} fieldPath="habitos_vida_data.dia_util_15h00_16h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="16h00-17h00" value={habitosVidaData?.dia_util_16h00_17h00} fieldPath="habitos_vida_data.dia_util_16h00_17h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="17h00-18h00" value={habitosVidaData?.dia_util_17h00_18h00} fieldPath="habitos_vida_data.dia_util_17h00_18h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="18h00-19h00" value={habitosVidaData?.dia_util_18h00_19h00} fieldPath="habitos_vida_data.dia_util_18h00_19h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="19h00-20h00" value={habitosVidaData?.dia_util_19h00_20h00} fieldPath="habitos_vida_data.dia_util_19h00_20h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="20h00-20h30" value={habitosVidaData?.dia_util_20h00_20h30} fieldPath="habitos_vida_data.dia_util_20h00_20h30" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="20h30-21h00" value={habitosVidaData?.dia_util_20h30_21h00} fieldPath="habitos_vida_data.dia_util_20h30_21h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="21h00-21h30" value={habitosVidaData?.dia_util_21h00_21h30} fieldPath="habitos_vida_data.dia_util_21h00_21h30" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="21h30-22h00" value={habitosVidaData?.dia_util_21h30_22h00} fieldPath="habitos_vida_data.dia_util_21h30_22h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="22h00-6h00" value={habitosVidaData?.dia_util_22h00_6h00} fieldPath="habitos_vida_data.dia_util_22h00_6h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Horários de Sábado</h4>
          <DataField label="6h00-7h00" value={habitosVidaData?.sabado_6h00_7h00} fieldPath="habitos_vida_data.sabado_6h00_7h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="7h00-8h00" value={habitosVidaData?.sabado_7h00_8h00} fieldPath="habitos_vida_data.sabado_7h00_8h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="8h00-9h00" value={habitosVidaData?.sabado_8h00_9h00} fieldPath="habitos_vida_data.sabado_8h00_9h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="9h00-10h00" value={habitosVidaData?.sabado_9h00_10h00} fieldPath="habitos_vida_data.sabado_9h00_10h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="10h00-11h00" value={habitosVidaData?.sabado_10h00_11h00} fieldPath="habitos_vida_data.sabado_10h00_11h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="11h00-12h00" value={habitosVidaData?.sabado_11h00_12h00} fieldPath="habitos_vida_data.sabado_11h00_12h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="12h00-13h00" value={habitosVidaData?.sabado_12h00_13h00} fieldPath="habitos_vida_data.sabado_12h00_13h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="13h00-14h00" value={habitosVidaData?.sabado_13h00_14h00} fieldPath="habitos_vida_data.sabado_13h00_14h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="14h00-15h00" value={habitosVidaData?.sabado_14h00_15h00} fieldPath="habitos_vida_data.sabado_14h00_15h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="15h00-16h00" value={habitosVidaData?.sabado_15h00_16h00} fieldPath="habitos_vida_data.sabado_15h00_16h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="16h00-17h00" value={habitosVidaData?.sabado_16h00_17h00} fieldPath="habitos_vida_data.sabado_16h00_17h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="17h00-18h00" value={habitosVidaData?.sabado_17h00_18h00} fieldPath="habitos_vida_data.sabado_17h00_18h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="18h00-19h00" value={habitosVidaData?.sabado_18h00_19h00} fieldPath="habitos_vida_data.sabado_18h00_19h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="19h00-20h00" value={habitosVidaData?.sabado_19h00_20h00} fieldPath="habitos_vida_data.sabado_19h00_20h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="20h00-21h00" value={habitosVidaData?.sabado_20h00_21h00} fieldPath="habitos_vida_data.sabado_20h00_21h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="21h00-22h00" value={habitosVidaData?.sabado_21h00_22h00} fieldPath="habitos_vida_data.sabado_21h00_22h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="22h00-6h00" value={habitosVidaData?.sabado_22h00_6h00} fieldPath="habitos_vida_data.sabado_22h00_6h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
        
        <div className="anamnese-subsection">
          <h4>Horários de Domingo</h4>
          <DataField label="6h00-7h00" value={habitosVidaData?.domingo_6h00_7h00} fieldPath="habitos_vida_data.domingo_6h00_7h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="7h00-8h00" value={habitosVidaData?.domingo_7h00_8h00} fieldPath="habitos_vida_data.domingo_7h00_8h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="8h00-9h00" value={habitosVidaData?.domingo_8h00_9h00} fieldPath="habitos_vida_data.domingo_8h00_9h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="9h00-10h00" value={habitosVidaData?.domingo_9h00_10h00} fieldPath="habitos_vida_data.domingo_9h00_10h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="10h00-11h00" value={habitosVidaData?.domingo_10h00_11h00} fieldPath="habitos_vida_data.domingo_10h00_11h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="11h00-12h00" value={habitosVidaData?.domingo_11h00_12h00} fieldPath="habitos_vida_data.domingo_11h00_12h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="12h00-13h00" value={habitosVidaData?.domingo_12h00_13h00} fieldPath="habitos_vida_data.domingo_12h00_13h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="13h00-14h00" value={habitosVidaData?.domingo_13h00_14h00} fieldPath="habitos_vida_data.domingo_13h00_14h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="14h00-15h00" value={habitosVidaData?.domingo_14h00_15h00} fieldPath="habitos_vida_data.domingo_14h00_15h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="15h00-16h00" value={habitosVidaData?.domingo_15h00_16h00} fieldPath="habitos_vida_data.domingo_15h00_16h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="16h00-17h00" value={habitosVidaData?.domingo_16h00_17h00} fieldPath="habitos_vida_data.domingo_16h00_17h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="17h00-18h00" value={habitosVidaData?.domingo_17h00_18h00} fieldPath="habitos_vida_data.domingo_17h00_18h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="18h00-19h00" value={habitosVidaData?.domingo_18h00_19h00} fieldPath="habitos_vida_data.domingo_18h00_19h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="19h00-20h00" value={habitosVidaData?.domingo_19h00_20h00} fieldPath="habitos_vida_data.domingo_19h00_20h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="20h00-21h00" value={habitosVidaData?.domingo_20h00_21h00} fieldPath="habitos_vida_data.domingo_20h00_21h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="21h00-22h00" value={habitosVidaData?.domingo_21h00_22h00} fieldPath="habitos_vida_data.domingo_21h00_22h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="22h00-6h00" value={habitosVidaData?.domingo_22h00_6h00} fieldPath="habitos_vida_data.domingo_22h00_6h00" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALIMENTAÇÃO ==================== */}
      <CollapsibleSection title="5. Alimentação (Aplicação Prática)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Referências</h4>
          <DataField label="Ver Agente 3 (Alimentação)" value={habitosVidaData?.alimentacao_ver_agente_3} fieldPath="habitos_vida_data.alimentacao_ver_agente_3" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Adicionar Aqui" value={habitosVidaData?.alimentacao_adicionar_aqui} fieldPath="habitos_vida_data.alimentacao_adicionar_aqui" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Refeições Conscientes - Meal Prep</h4>
          <DataField label="Quando Fazer" value={habitosVidaData?.refeicoes_conscientes_meal_prep_quando} fieldPath="habitos_vida_data.refeicoes_conscientes_meal_prep_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="O Que Preparar" value={habitosVidaData?.refeicoes_conscientes_meal_prep_o_que_preparar} fieldPath="habitos_vida_data.refeicoes_conscientes_meal_prep_o_que_preparar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Recipientes" value={habitosVidaData?.refeicoes_conscientes_meal_prep_recipientes} fieldPath="habitos_vida_data.refeicoes_conscientes_meal_prep_recipientes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={habitosVidaData?.refeicoes_conscientes_meal_prep_beneficio} fieldPath="habitos_vida_data.refeicoes_conscientes_meal_prep_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Investimento" value={habitosVidaData?.refeicoes_conscientes_meal_prep_investimento} fieldPath="habitos_vida_data.refeicoes_conscientes_meal_prep_investimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Refeição Como Momento Sagrado</h4>
          <DataField label="Regras" value={habitosVidaData?.refeicao_momento_sagrado_regras} fieldPath="habitos_vida_data.refeicao_momento_sagrado_regras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={habitosVidaData?.refeicao_momento_sagrado_beneficio} fieldPath="habitos_vida_data.refeicao_momento_sagrado_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Situações Sociais - Festas</h4>
          <DataField label="Pré-Festa" value={habitosVidaData?.sociais_festas_pre} fieldPath="habitos_vida_data.sociais_festas_pre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Durante a Festa" value={habitosVidaData?.sociais_festas_durante} fieldPath="habitos_vida_data.sociais_festas_durante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pós-Festa" value={habitosVidaData?.sociais_festas_pos} fieldPath="habitos_vida_data.sociais_festas_pos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Compensar" value={habitosVidaData?.sociais_festas_nao_compensar} fieldPath="habitos_vida_data.sociais_festas_nao_compensar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Situações Sociais - Restaurantes</h4>
          <DataField label="Como Escolher" value={habitosVidaData?.sociais_restaurantes_escolher} fieldPath="habitos_vida_data.sociais_restaurantes_escolher" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Pedir" value={habitosVidaData?.sociais_restaurantes_pedir} fieldPath="habitos_vida_data.sociais_restaurantes_pedir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Molhos e Temperos" value={habitosVidaData?.sociais_restaurantes_molhos} fieldPath="habitos_vida_data.sociais_restaurantes_molhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Compartilhar Pratos" value={habitosVidaData?.sociais_restaurantes_compartilhar} fieldPath="habitos_vida_data.sociais_restaurantes_compartilhar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pressão Familiar</h4>
          <DataField label="Respostas Prontas" value={habitosVidaData?.sociais_pressao_familia_respostas} fieldPath="habitos_vida_data.sociais_pressao_familia_respostas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Precisa Explicar Tudo" value={habitosVidaData?.sociais_pressao_familia_nao_explicar} fieldPath="habitos_vida_data.sociais_pressao_familia_nao_explicar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mudar de Assunto" value={habitosVidaData?.sociais_pressao_familia_mudar_assunto} fieldPath="habitos_vida_data.sociais_pressao_familia_mudar_assunto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Assertividade" value={habitosVidaData?.sociais_pressao_familia_assertividade} fieldPath="habitos_vida_data.sociais_pressao_familia_assertividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Contextos Específicos</h4>
          <DataField label="Almoços de Trabalho" value={habitosVidaData?.sociais_almocos_trabalho} fieldPath="habitos_vida_data.sociais_almocos_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Finais de Semana (Regra 80/20)" value={habitosVidaData?.sociais_finais_semana_regra_80_20} fieldPath="habitos_vida_data.sociais_finais_semana_regra_80_20" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== MOVIMENTO ==================== */}
      <CollapsibleSection title="6. Movimento e Atividade Física" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Referências</h4>
          <DataField label="Ver Agente 5 (Atividade Física)" value={habitosVidaData?.movimento_ver_agente_5} fieldPath="habitos_vida_data.movimento_ver_agente_5" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Adicionar Aqui" value={habitosVidaData?.movimento_adicionar_aqui} fieldPath="habitos_vida_data.movimento_adicionar_aqui" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>NEAT (Non-Exercise Activity Thermogenesis)</h4>
          <DataField label="Conceito" value={habitosVidaData?.neat_conceito} fieldPath="habitos_vida_data.neat_conceito" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estratégias para Aumentar" value={habitosVidaData?.neat_estrategias_aumentar} fieldPath="habitos_vida_data.neat_estrategias_aumentar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meta de Passos por Dia" value={habitosVidaData?.neat_meta_passos_dia} fieldPath="habitos_vida_data.neat_meta_passos_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={habitosVidaData?.neat_beneficio} fieldPath="habitos_vida_data.neat_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ergonomia</h4>
          <DataField label="Problema Atual" value={habitosVidaData?.ergonomia_problema_atual} fieldPath="habitos_vida_data.ergonomia_problema_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Soluções" value={habitosVidaData?.ergonomia_solucoes} fieldPath="habitos_vida_data.ergonomia_solucoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ESPIRITUALIDADE E NATUREZA ==================== */}
      <CollapsibleSection title="7. Espiritualidade e Conexão com a Natureza" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Espiritualidade</h4>
          <DataField label="Ver Agente 2 (Mentalidade)" value={habitosVidaData?.espiritualidade_ver_agente_2} fieldPath="habitos_vida_data.espiritualidade_ver_agente_2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Adicionar Aqui" value={habitosVidaData?.espiritualidade_adicionar_aqui} fieldPath="habitos_vida_data.espiritualidade_adicionar_aqui" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Práticas Espirituais - Opções" value={habitosVidaData?.praticas_espirituais_opcoes} fieldPath="habitos_vida_data.praticas_espirituais_opcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Precisa Ser Religião" value={habitosVidaData?.praticas_espirituais_nao_precisa_religiao} fieldPath="habitos_vida_data.praticas_espirituais_nao_precisa_religiao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Conexão com a Natureza</h4>
          <DataField label="Frequência Mínima" value={habitosVidaData?.natureza_frequencia_minima} fieldPath="habitos_vida_data.natureza_frequencia_minima" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={habitosVidaData?.natureza_duracao} fieldPath="habitos_vida_data.natureza_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Atividades" value={habitosVidaData?.natureza_atividades} fieldPath="habitos_vida_data.natureza_atividades" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grounding - Prática" value={habitosVidaData?.natureza_grounding_pratica} fieldPath="habitos_vida_data.natureza_grounding_pratica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grounding - Ciência" value={habitosVidaData?.natureza_grounding_ciencia} fieldPath="habitos_vida_data.natureza_grounding_ciencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grounding - Quando Fazer" value={habitosVidaData?.natureza_grounding_quando} fieldPath="habitos_vida_data.natureza_grounding_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios da Natureza" value={habitosVidaData?.natureza_beneficios} fieldPath="habitos_vida_data.natureza_beneficios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CONEXÕES SOCIAIS E RELAÇÕES ==================== */}
      <CollapsibleSection title="8. Conexões Sociais e Relações" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Conexão Social</h4>
          <DataField label="Problema Atual" value={habitosVidaData?.conexao_social_problema_atual} fieldPath="habitos_vida_data.conexao_social_problema_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={habitosVidaData?.conexao_social_urgencia} fieldPath="habitos_vida_data.conexao_social_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações - Grupos de Apoio" value={habitosVidaData?.conexao_social_acoes_grupos_apoio} fieldPath="habitos_vida_data.conexao_social_acoes_grupos_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Atividades Coletivas" value={habitosVidaData?.conexao_social_atividades_coletivas} fieldPath="habitos_vida_data.conexao_social_atividades_coletivas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reativar Amizades" value={habitosVidaData?.conexao_social_reativar_amizades} fieldPath="habitos_vida_data.conexao_social_reativar_amizades" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Online - Cuidados" value={habitosVidaData?.conexao_social_online_cuidados} fieldPath="habitos_vida_data.conexao_social_online_cuidados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Qualidade vs Quantidade" value={habitosVidaData?.conexao_social_qualidade_vs_quantidade} fieldPath="habitos_vida_data.conexao_social_qualidade_vs_quantidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Relações Familiares</h4>
          <DataField label="Filha" value={habitosVidaData?.relacoes_familia_filha} fieldPath="habitos_vida_data.relacoes_familia_filha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Família de Origem" value={habitosVidaData?.relacoes_familia_origem} fieldPath="habitos_vida_data.relacoes_familia_origem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== PROPÓSITO E SENTIDO DE VIDA ==================== */}
      <CollapsibleSection title="9. Propósito e Sentido de Vida" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Reflexão Profunda</h4>
          <DataField label="Reflexão sobre Propósito" value={habitosVidaData?.proposito_reflexao_profunda} fieldPath="habitos_vida_data.proposito_reflexao_profunda" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resgate da Dança</h4>
          <DataField label="É Essencial" value={habitosVidaData?.proposito_resgate_danca_essencial} fieldPath="habitos_vida_data.proposito_resgate_danca_essencial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Integrar" value={habitosVidaData?.proposito_resgate_danca_como_integrar} fieldPath="habitos_vida_data.proposito_resgate_danca_como_integrar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Precisa Virar Profissão" value={habitosVidaData?.proposito_resgate_danca_nao_precisa_profissao} fieldPath="habitos_vida_data.proposito_resgate_danca_nao_precisa_profissao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alternativas e Projetos</h4>
          <DataField label="Teatro como Alternativa" value={habitosVidaData?.proposito_teatro_alternativa} fieldPath="habitos_vida_data.proposito_teatro_alternativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Projeto de Vida Profissional" value={habitosVidaData?.proposito_projeto_vida_profissional} fieldPath="habitos_vida_data.proposito_projeto_vida_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Passos Concretos" value={habitosVidaData?.proposito_passos_concretos} fieldPath="habitos_vida_data.proposito_passos_concretos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Micro Ações Mensais" value={habitosVidaData?.proposito_micro_acoes_mensais} fieldPath="habitos_vida_data.proposito_micro_acoes_mensais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alternativas" value={habitosVidaData?.proposito_alternativas} fieldPath="habitos_vida_data.proposito_alternativas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contribuição e Legado" value={habitosVidaData?.proposito_contribuicao_legado} fieldPath="habitos_vida_data.proposito_contribuicao_legado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== GESTÃO DE TEMPO E PRODUTIVIDADE ==================== */}
      <CollapsibleSection title="10. Gestão de Tempo e Produtividade" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Análise e Estratégias</h4>
          <DataField label="Problema Atual" value={habitosVidaData?.gestao_tempo_problema_atual} fieldPath="habitos_vida_data.gestao_tempo_problema_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Análise - Exercício" value={habitosVidaData?.gestao_tempo_analise_exercicio} fieldPath="habitos_vida_data.gestao_tempo_analise_exercicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Blocos de Tempo (Time Blocking)" value={habitosVidaData?.gestao_tempo_blocos_time_blocking} fieldPath="habitos_vida_data.gestao_tempo_blocos_time_blocking" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Regras dos Blocos" value={habitosVidaData?.gestao_tempo_regras_blocos} fieldPath="habitos_vida_data.gestao_tempo_regras_blocos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Delegação e Terceirização" value={habitosVidaData?.gestao_tempo_delegacao_terceirizar} fieldPath="habitos_vida_data.gestao_tempo_delegacao_terceirizar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Simplificar Tarefas" value={habitosVidaData?.gestao_tempo_simplificar_tarefas} fieldPath="habitos_vida_data.gestao_tempo_simplificar_tarefas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Eliminar Desperdícios</h4>
          <DataField label="Redes Sociais" value={habitosVidaData?.gestao_tempo_eliminar_desperdicio_redes} fieldPath="habitos_vida_data.gestao_tempo_eliminar_desperdicio_redes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WhatsApp" value={habitosVidaData?.gestao_tempo_eliminar_desperdicio_whatsapp} fieldPath="habitos_vida_data.gestao_tempo_eliminar_desperdicio_whatsapp" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="TV / Streaming" value={habitosVidaData?.gestao_tempo_eliminar_desperdicio_tv} fieldPath="habitos_vida_data.gestao_tempo_eliminar_desperdicio_tv" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Perfeccionismo" value={habitosVidaData?.gestao_tempo_eliminar_desperdicio_perfeccionismo} fieldPath="habitos_vida_data.gestao_tempo_eliminar_desperdicio_perfeccionismo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tempo Sagrado para Si" value={habitosVidaData?.gestao_tempo_tempo_sagrado_para_si} fieldPath="habitos_vida_data.gestao_tempo_tempo_sagrado_para_si" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== GESTÃO DE ESTRESSE ==================== */}
      <CollapsibleSection title="11. Gestão de Estresse" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Identificação e Técnicas</h4>
          <DataField label="Identificar Estressores" value={habitosVidaData?.estresse_identificar_estressores} fieldPath="habitos_vida_data.estresse_identificar_estressores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Técnicas no Momento" value={habitosVidaData?.estresse_tecnicas_momento} fieldPath="habitos_vida_data.estresse_tecnicas_momento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Válvulas de Escape Saudáveis" value={habitosVidaData?.estresse_valvulas_escape_saudaveis} fieldPath="habitos_vida_data.estresse_valvulas_escape_saudaveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ROTINAS E HÁBITOS ==================== */}
      <CollapsibleSection title="12. Rotinas e Hábitos Estruturantes" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Rotinas Diárias</h4>
          <DataField label="Rotina Matinal (Power Hour)" value={habitosVidaData?.habitos_matinal_power_hour} fieldPath="habitos_vida_data.habitos_matinal_power_hour" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Rotina Noturna (Wind Down)" value={habitosVidaData?.habitos_noturno_wind_down} fieldPath="habitos_vida_data.habitos_noturno_wind_down" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pausas Conscientes" value={habitosVidaData?.habitos_pausas_conscientes} fieldPath="habitos_vida_data.habitos_pausas_conscientes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Revisões Regulares" value={habitosVidaData?.habitos_revisoes_regulares} fieldPath="habitos_vida_data.habitos_revisoes_regulares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== TECNOLOGIA ==================== */}
      <CollapsibleSection title="13. Uso Consciente de Tecnologia" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Regras de Uso</h4>
          <DataField label="Celular - Regras" value={habitosVidaData?.tecnologia_celular_regras} fieldPath="habitos_vida_data.tecnologia_celular_regras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Computador de Trabalho" value={habitosVidaData?.tecnologia_computador_trabalho} fieldPath="habitos_vida_data.tecnologia_computador_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== MONITORAMENTO E MINDSET ==================== */}
      <CollapsibleSection title="14. Monitoramento e Mindset" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Acompanhamento</h4>
          <DataField label="Check-in Semanal" value={habitosVidaData?.monitoramento_checkin_semanal} fieldPath="habitos_vida_data.monitoramento_checkin_semanal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Celebração de Vitórias" value={habitosVidaData?.celebracao_vitorias} fieldPath="habitos_vida_data.celebracao_vitorias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Plano Integrado</h4>
          <DataField label="Plano de 12 Meses Integrado" value={habitosVidaData?.plano_12_meses_integrado} fieldPath="habitos_vida_data.plano_12_meses_integrado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Mindset Final</h4>
          <DataField label="Aceitar" value={habitosVidaData?.mindset_aceitar} fieldPath="habitos_vida_data.mindset_aceitar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Rejeitar" value={habitosVidaData?.mindset_rejeitar} fieldPath="habitos_vida_data.mindset_rejeitar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cultivar" value={habitosVidaData?.mindset_cultivar} fieldPath="habitos_vida_data.mindset_cultivar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Afirmações Diárias" value={habitosVidaData?.mindset_afirmacoes_diarias} fieldPath="habitos_vida_data.mindset_afirmacoes_diarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function ConsultasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultaId = searchParams.get('consulta_id');

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [cssLoaded, setCssLoaded] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  
  // Estados para visualização de detalhes
  const [consultaDetails, setConsultaDetails] = useState<Consultation | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSolutionsViewer, setShowSolutionsViewer] = useState(false);

  // Função helper para renderizar o botão "Ver Todas as Soluções"
  const renderViewSolutionsButton = () => (
    <button 
      className="view-solutions-button"
      onClick={() => setShowSolutionsViewer(true)}
      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
    >
      <FileText className="w-4 h-4" />
      Ver Todas as Soluções
    </button>
  );

  // Estados para chat com IA
  const [selectedField, setSelectedField] = useState<{ fieldPath: string; label: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Estado para salvar alterações
  const [isSaving, setIsSaving] = useState(false);

  // Estados para ATIVIDADE_FISICA
  const [atividadeFisicaData, setAtividadeFisicaData] = useState<ExercicioFisico[]>([]);
  const [loadingAtividadeFisica, setLoadingAtividadeFisica] = useState(false);
  const [editingExercicio, setEditingExercicio] = useState<{id: number, field: string} | null>(null);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState<Consultation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Função para selecionar campo para edição com IA
  const handleFieldSelect = (fieldPath: string, label: string) => {
    setSelectedField({ fieldPath, label });
    setChatMessages([]); // Limpa o chat anterior
  };

  // Função para enviar mensagem para IA
  const handleSendAIMessage = async () => {
    if (!chatInput.trim() || !selectedField || !consultaId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    // Adiciona mensagem do usuário no chat
    setChatMessages(prev => [...prev, userMessage]);
    const messageText = chatInput;
    setChatInput('');
    setIsTyping(true);

    try {
      // Determinar qual endpoint usar baseado no fieldPath
      const isDiagnostico = selectedField.fieldPath.startsWith('diagnostico_principal') ||
                           selectedField.fieldPath.startsWith('estado_geral') ||
                           selectedField.fieldPath.startsWith('estado_mental') ||
                           selectedField.fieldPath.startsWith('estado_fisiologico') ||
                           selectedField.fieldPath.startsWith('integracao_diagnostica') ||
                           selectedField.fieldPath.startsWith('habitos_vida');
      
      const isSolucaoLTB = selectedField.fieldPath.startsWith('ltb_data');
      const isSolucaoMentalidade = selectedField.fieldPath.startsWith('mentalidade_data');
      const isSolucaoSuplemementacao = selectedField.fieldPath.startsWith('suplementacao_data');
      const isSolucaoHabitosVida = selectedField.fieldPath.startsWith('habitos_vida_data');
      
      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();
      
      const webhookUrl = (isSolucaoLTB || isSolucaoMentalidade || isSolucaoSuplemementacao || isSolucaoHabitosVida)
        ? webhookEndpoints.edicaoSolucao
        : isDiagnostico 
        ? webhookEndpoints.edicaoDiagnostico
        : webhookEndpoints.edicaoAnamnese;
      
      const requestBody: any = {
        origem: 'IA',
        fieldPath: selectedField.fieldPath,
        texto: messageText,
        consultaId,
      };
      
      // Adicionar solucao_etapa se for etapa de solução
      if (isSolucaoLTB) {
        requestBody.solucao_etapa = 'LTB';
      } else if (isSolucaoMentalidade) {
        requestBody.solucao_etapa = 'MENTALIDADE';
      } else if (isSolucaoSuplemementacao) {
        requestBody.solucao_etapa = 'SUPLEMENTACAO';
      } else if (isSolucaoHabitosVida) {
        requestBody.solucao_etapa = 'HABITOS_DE_VIDA';
      }
      
      console.log('🚀 Enviando para webhook:', requestBody);
      console.log('🔗 URL:', webhookUrl);
      
      // Faz requisição para nossa API interna (que chama o webhook)
      console.log('📤 Fazendo requisição para /api/ai-edit...');
      const response = await fetch('/api/ai-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...requestBody,
          webhookUrl: webhookUrl
        }),
      });
      
      console.log('📥 Resposta recebida da API interna:', response.status);

      console.log('Status da resposta:', response.status);
      console.log('Response OK?', response.ok);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        // Se for erro 500, pode ser problema no webhook, mas ainda mostramos a resposta
        if (data.warning) {
          throw new Error(data.message || 'Webhook de IA não disponível');
        }
        throw new Error('Erro ao comunicar com a IA');
      }
      
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
      
      // Pega a resposta da IA - lidando com diferentes formatos
      let aiResponse = 'Não foi possível obter resposta da IA';
      
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        // Formato esperado: [{"response": "texto"}]
        const firstItem = parsedData[0];
        if (firstItem && firstItem.response) {
          aiResponse = firstItem.response;
        } else if (firstItem && firstItem.message) {
          aiResponse = firstItem.message;
        } else if (firstItem && firstItem.text) {
          aiResponse = firstItem.text;
        } else if (firstItem && firstItem.answer) {
          aiResponse = firstItem.answer;
        }
      } else if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        // Se não é array, pode ser um objeto com diferentes campos
        if (parsedData.response) {
          aiResponse = parsedData.response;
        } else if (parsedData.text) {
          aiResponse = parsedData.text;
        } else if (parsedData.answer) {
          aiResponse = parsedData.answer;
        } else if (parsedData.message) {
          if (parsedData.message.includes('Workflow iniciado') || parsedData.message.includes('Processing')) {
            aiResponse = 'Workflow iniciado com sucesso. Processando sua solicitação...';
          } else {
            aiResponse = parsedData.message;
          }
        }
      } else if (typeof parsedData === 'string') {
        // Se ainda é string, usar diretamente
        aiResponse = parsedData;
      }
      
      //console.log('🎯 Campo usado para resposta:', usedField);
      //console.log('💬 Resposta final da IA:', aiResponse);

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
          const isDiagnostico = selectedField.fieldPath.startsWith('diagnostico_principal') ||
                               selectedField.fieldPath.startsWith('estado_geral') ||
                               selectedField.fieldPath.startsWith('estado_mental') ||
                               selectedField.fieldPath.startsWith('estado_fisiologico') ||
                               selectedField.fieldPath.startsWith('integracao_diagnostica') ||
                               selectedField.fieldPath.startsWith('habitos_vida');
          
          if (isDiagnostico) {
            // Trigger refresh of diagnostico data by updating a state that triggers useEffect
            window.dispatchEvent(new CustomEvent('diagnostico-data-refresh'));
          } else {
            // Se for anamnese, recarregar dados de anamnese
            //console.log('🔍 DEBUG [REFERENCIA] Recarregando dados de anamnese após resposta da IA');
            window.dispatchEvent(new CustomEvent('anamnese-data-refresh'));
          }
        } catch (refreshError) {
          console.warn('Erro ao recarregar dados após IA:', refreshError);
        }
      }, 2000); // 2 segundos de delay
      
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
  useEffect(() => {
    const executeLoad = async () => {
      if (!consultaId && dashboardLoaded && cssLoaded) {
        await loadConsultations();
      }
    };
    
    executeLoad();
  }, [currentPage, consultaId, dashboardLoaded, cssLoaded]);

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

  // Carregar detalhes quando houver consulta_id na URL
  useEffect(() => {
    if (consultaId) {
      console.log('🔍 useEffect - Carregando detalhes para consulta:', consultaId);
      fetchConsultaDetails(consultaId);
      // Resetar o estado do visualizador de soluções quando mudar de consulta
      setShowSolutionsViewer(false);
    } else {
      setConsultaDetails(null);
    }
  }, [consultaId]);

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
      
      const response = await fetch(`/api/atividade-fisica/${consultaId}`);
      console.log('🔍 DEBUG [REFERENCIA] Resposta da API:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG [REFERENCIA] Dados recebidos da API:', data);
        const exercicios = data.exercicios || [];
        console.log('🔍 DEBUG [REFERENCIA] Exercícios para setar:', exercicios.length, 'exercícios');
        setAtividadeFisicaData(exercicios);
        console.log('🔍 DEBUG [REFERENCIA] Estado atividadeFisicaData atualizado');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro na resposta da API:', errorData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados de Atividade Física:', error);
    } finally {
      setLoadingAtividadeFisica(false);
    }
  };

  const handleSaveExercicio = async (id: number, field: string, newValue: string) => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Primeiro, atualizar no banco de dados
      const response = await fetch(`/api/atividade-fisica/${consultaId}/update-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id,
          field, 
          value: newValue
        }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar campo no banco de dados');
      
      // Depois, notificar o webhook
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({ 
            origem: 'MANUAL',
            fieldPath: `s_exercicios_fisicos.${field}`,
            texto: newValue,
            consultaId,
            solucao_etapa: 'ATIVIDADE_FISICA'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }

      // Recarregar dados
      await loadAtividadeFisicaData();
      setEditingExercicio(null);
      
    } catch (error) {
      console.error('Erro ao salvar exercício:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAtividadeFisicaAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a solucao_etapa para HABITOS_DE_VIDA
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: 'HABITOS_DE_VIDA'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Recarregar detalhes da consulta
      await fetchConsultaDetails(consultaId);
      
    } catch (error) {
      console.error('Erro ao salvar e continuar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadConsultations = async () => {
    try {
      setError(null);
      const response = await fetchConsultations(currentPage, 20);
      
      setConsultations(response.consultations);
      setTotalPages(response.pagination.totalPages);
      setTotalConsultations(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    }
  };

  const fetchConsultaDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      setError(null);
      //console.log('🔍 Carregando detalhes da consulta:', id);
      const response = await fetch(`/api/consultations/${id}`);
      //console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes da consulta');
      }
      
      const data = await response.json();
      setConsultaDetails(data.consultation);
    } catch (err) {
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

  // Função para editar consulta
  const handleEditConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta
    router.push(`/consultas?consulta_id=${consultation.id}`);
  };

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta
    setConsultationToDelete(consultation);
    setShowDeleteModal(true);
  };

  // Função para confirmar exclusão da consulta
  const confirmDeleteConsultation = async () => {
    if (!consultationToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/consultations/${consultationToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir consulta');
      }

      // Atualiza a lista removendo a consulta excluída
      setConsultations(prev => prev.filter(c => c.id !== consultationToDelete.id));
      setTotalConsultations(prev => prev - 1);
      
      // Fecha o modal
      setShowDeleteModal(false);
      setConsultationToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir consulta:', err);
      alert('Erro ao excluir consulta. Por favor, tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para cancelar exclusão
  const cancelDeleteConsultation = () => {
    setShowDeleteModal(false);
    setConsultationToDelete(null);
  };

  // Função para salvar alterações da ANAMNESE e mudar para próxima etapa (DIAGNOSTICO SENDO PROCESSADO)
  const handleSaveAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);
      
      // Atualiza a etapa da consulta para DIAGNOSTICO SENDO PROCESSADO
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          etapa: 'DIAGNOSTICO',
          status: 'PROCESSING'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Disparar webhook para iniciar processamento do diagnóstico
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
        //console.log('✅ Webhook de diagnóstico processando disparado com sucesso');
      } catch (webhookError) {
        console.warn('⚠️ Webhook de diagnóstico falhou, mas consulta foi atualizada:', webhookError);
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do DIAGNÓSTICO e mudar para etapa de SOLUÇÃO
  const handleSaveDiagnosticoAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);
      
      // Atualiza a etapa da consulta para PROCESSANDO SOLUCAO e define solucao_etapa como LTB
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          etapa: 'SOLUCAO',
          status: 'PROCESSING',
          solucao_etapa: 'LTB'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Disparar webhook para iniciar processamento da solução
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.triggerSolucao, {
          method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
            consultaId: consultaDetails.id,
            medicoId: consultaDetails.doctor_id,
            pacienteId: consultaDetails.patient_id
          }),
        });
        console.log('✅ Webhook de solução disparado com sucesso');
      } catch (webhookError) {
        console.warn('⚠️ Webhook de solução falhou, mas consulta foi atualizada:', webhookError);
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do LTB e mudar para MENTALIDADE
  const handleSaveLTBAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a solucao_etapa para MENTALIDADE
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: 'MENTALIDADE'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do MENTALIDADE e mudar para ALIMENTACAO
  const handleSaveMentalidadeAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a solucao_etapa para ALIMENTACAO (NOTA: Pulando para SUPLEMENTACAO)
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: 'SUPLEMENTACAO'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }
        
      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
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
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: 'SUPLEMENTACAO'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }
        
      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
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
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: 'ATIVIDADE_FISICA'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do HABITOS_DE_VIDA e FINALIZAR para PROCESSANDO ENTREGAVEIS
  const handleSaveHabitosVidaAndComplete = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);
      
      // Atualiza o status para PROCESSING para começar a processar os entregaveis (finalizando todo o processo)
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PROCESSING',
          etapa:'SOLUCAO'
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Disparar webhook para iniciar criação dos entregáveis
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();
        
        await fetch(webhookEndpoints.solucaoCriacaoEntregaveis, {
          method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
            consultaId: consultaDetails.id,
            medicoId: consultaDetails.doctor_id,
            pacienteId: consultaDetails.patient_id
          }),
        });
        //console.log('✅ Webhook de criação de entregáveis disparado com sucesso');
      } catch (webhookError) {
        console.warn('⚠️ Webhook de entregáveis falhou, mas consulta foi atualizada:', webhookError);
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
      
      // Redireciona para o dashboard após finalizar a consulta
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000); // Delay de 1 segundo para mostrar feedback visual
      
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
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

  const generateAvatar = (name: string, profilePic?: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const colorIndex = name.length % colors.length;

    if (profilePic) {
      return (
        <div className="patient-avatar">
          <img 
            src={profilePic} 
            alt={name}
            className="avatar-image"
            onError={(e) => {
              // Se a imagem falhar ao carregar, substituir por placeholder
              const target = e.target as HTMLImageElement;
              const parent = target.parentElement;
              if (parent) {
                // Limpar completamente o conteúdo
                parent.innerHTML = '';
                // Aplicar todas as classes CSS necessárias
                parent.className = 'avatar-placeholder';
                // Aplicar estilo de fundo correto (marrom em vez de azul)
                parent.style.background = 'linear-gradient(135deg, #E6C3A7 0%, #806D5D 100%)';
                parent.style.width = '48px';
                parent.style.height = '48px';
                parent.style.borderRadius = '50%';
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
                parent.style.fontSize = '15px';
                parent.style.fontWeight = '700';
                parent.style.color = 'white';
                parent.style.flexShrink = '0';
                parent.style.position = 'relative';
                parent.style.boxShadow = '0 4px 12px rgba(230, 195, 167, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                parent.style.transition = 'all 0.3s ease';
                parent.style.isolation = 'isolate';
                // Adicionar o texto
                parent.textContent = initials;
              }
            }}
          />
        </div>
      );
    }
    
    return (
      <div 
        className="avatar-placeholder" 
        style={{ background: 'linear-gradient(135deg, #E6C3A7 0%, #806D5D 100%)' }}
      >
        {initials}
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
            borderTop: '4px solid #d4a574',
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

  // Função para selecionar uma solução
  const handleSelectSolucao = async (solucaoEtapa: string) => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a consulta com a solução selecionada
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solucao_etapa: solucaoEtapa
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar consulta');
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao selecionar solução:', error);
      alert('Erro ao selecionar solução. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para renderizar o conteúdo baseado no status e etapa
  const renderConsultationContent = () => {
    if (!consultaDetails) return null;

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
        if (consultaDetails.solucao_etapa === 'HABITOS_DE_VIDA') {
          titulo = 'Processando Entregáveis';
          descricao = 'Os entegráveis da consulta estão sendo processados';
        }
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
              A consulta foi processada com sucesso. <br/>
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
      // Se for LTB, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'LTB') {
        return 'SOLUCAO_LTB';
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
        return 'SOLUCAO_ATIVIDADE_FISICA';
      }
      
      // Se for HABITOS_DE_VIDA, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'HABITOS_DE_VIDA') {
        return 'SOLUCAO_HABITOS_DE_VIDA';
      }

      // Se não tiver solucao_etapa definida, mostrar tela de seleção
      return 'SOLUCAO_SELECTION';
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
        // Se for LTB, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'LTB') {
          return 'SOLUCAO_LTB';
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
        
        // Se for HABITOS_DE_VIDA, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'HABITOS_DE_VIDA') {
          return 'SOLUCAO_HABITOS_DE_VIDA';
        }

      }
    }

    // Retorna ANAMNESE como padrão para outros casos
    return 'ANAMNESE';
  };

  // Renderizar detalhes da consulta
  if (consultaId && consultaDetails) {
    // Se showSolutionsViewer for true, renderiza o visualizador de soluções
    if (showSolutionsViewer) {
      return (
        <SolutionsViewer
          consultaId={consultaId!}
          onBack={() => setShowSolutionsViewer(false)}
          onSolutionSelect={(solutionType) => {
            // Mapear o tipo de solução para a etapa correspondente
            const solutionMapping: Record<string, string> = {
              'ltb': 'LTB',
              'mentalidade': 'MENTALIDADE',
              'alimentacao': 'ALIMENTACAO',
              'suplementacao': 'SUPLEMENTACAO',
              'exercicios': 'ATIVIDADE_FISICA',
              'habitos': 'HABITOS_DE_VIDA'
            };
            
            const etapa = solutionMapping[solutionType];
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
    
    const contentType = renderConsultationContent();

    // Se for DIAGNOSTICO, renderiza a tela de diagnóstico
    if (typeof contentType === 'string' && contentType === 'DIAGNOSTICO') {
      //console.log('🔍 Renderizando tela de DIAGNOSTICO para consulta:', consultaId);
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
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
                    onClick={handleSaveDiagnosticoAndContinue}
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
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <DiagnosticoSection 
                    consultaId={consultaId}
                    selectedField={selectedField}
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    onFieldSelect={handleFieldSelect}
                    onSendMessage={handleSendAIMessage}
                    onChatInputChange={setChatInput}
                  />

                  {/* Seção de Anamnese (Somente Leitura) */}
                  <CollapsibleSection title="Anamnese (Consulta)" defaultOpen={false}>
                    <div className="anamnese-subsection" style={{ opacity: 0.85, userSelect: 'text', position: 'relative' }}>
                      <AnamneseSection 
                        consultaId={consultaId}
                        selectedField={null}
                        chatMessages={[]}
                        isTyping={false}
                        chatInput=""
                        onFieldSelect={() => {}}
                        onSendMessage={() => {}}
                        onChatInputChange={() => {}}
                        readOnly={true}
                        renderViewSolutionsButton={renderViewSolutionsButton}
                      />
                    </div>
                  </CollapsibleSection>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_LTB, renderiza a tela de LTB
    if (contentType === 'SOLUCAO_LTB') {
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
            <h1 className="consultas-title">Solução - Limpeza do Terreno Biológico (LTB)</h1>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
                </div>
              </div>

              <div className="info-block">
                <div className="info-icon-wrapper status-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="info-content">
                  <span className="info-label">Status</span>
                  <span className="info-value">{getStatusText(consultaDetails.status)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="details-two-column-layout">
            {/* Coluna Esquerda - Chat com IA */}
            <div className="chat-column">
              <div className="chat-container">
                <div className="chat-header">
                  <h3>Chat com IA - Assistente de Solução LTB</h3>
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
                        Selecione um campo do protocolo LTB clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
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

            {/* Coluna Direita - LTB */}
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo LTB - Limpeza do Terreno Biológico</h2>
                  <button
                    onClick={handleSaveLTBAndContinue}
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
                        Salvar e Avançar para Mentalidade
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <LTBSection 
                    consultaId={consultaId}
                    selectedField={selectedField}
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    onFieldSelect={handleFieldSelect}
                    onSendMessage={handleSendAIMessage}
                    onChatInputChange={setChatInput}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_MENTALIDADE, renderiza a tela de Mentalidade
    if (contentType === 'SOLUCAO_MENTALIDADE') {
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
            <h1 className="consultas-title">Solução - Mentalidade do Paciente</h1>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
                </div>
              </div>

              <div className="info-block">
                <div className="info-icon-wrapper status-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="info-content">
                  <span className="info-label">Status</span>
                  <span className="info-value">{getStatusText(consultaDetails.status)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="details-two-column-layout">
            {/* Coluna Esquerda - Chat com IA */}
            <div className="chat-column">
              <div className="chat-container">
                <div className="chat-header">
                  <h3>Chat com IA - Assistente de Solução Mentalidade</h3>
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
                        Selecione um campo do protocolo de Mentalidade clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
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

            {/* Coluna Direita - Mentalidade */}
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo de Mentalidade</h2>
                  <button
                    onClick={handleSaveMentalidadeAndContinue}
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
                        Salvar e Avançar para Suplementação
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <MentalidadeSection 
                    consultaId={consultaId}
                    selectedField={selectedField}
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    onFieldSelect={handleFieldSelect}
                    onSendMessage={handleSendAIMessage}
                    onChatInputChange={setChatInput}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_SUPLEMENTACAO, renderiza a tela de Suplementação
    if (contentType === 'SOLUCAO_SUPLEMENTACAO') {
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
            <h1 className="consultas-title">Solução - Suplementação</h1>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
                </div>
              </div>

              <div className="info-block">
                <div className="info-icon-wrapper status-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="info-content">
                  <span className="info-label">Status</span>
                  <span className="info-value">{getStatusText(consultaDetails.status)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="details-two-column-layout">
            {/* Coluna Esquerda - Chat com IA */}
            <div className="chat-column">
              <div className="chat-container">
                <div className="chat-header">
                  <h3>Chat com IA - Assistente de Suplementação</h3>
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
                        Selecione um campo do protocolo de Suplementação clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
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

            {/* Coluna Direita - Suplementação */}
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo de Suplementação</h2>
                  <button
                    onClick={handleSaveSuplemementacaoAndContinue}
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
                        Salvar e Avançar para Hábitos de Vida
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <SuplemementacaoSection 
                    consultaId={consultaId}
                    selectedField={selectedField}
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    onFieldSelect={handleFieldSelect}
                    onSendMessage={handleSendAIMessage}
                    onChatInputChange={setChatInput}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_ATIVIDADE_FISICA, renderiza a tela de Atividade Física
    if (contentType === 'SOLUCAO_ATIVIDADE_FISICA') {
      console.log('🔍 DEBUG [REFERENCIA] Renderizando tela SOLUCAO_ATIVIDADE_FISICA - consultaDetails:', consultaDetails);
      console.log('🔍 DEBUG [REFERENCIA] atividadeFisicaData length:', atividadeFisicaData.length);
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button 
              className="back-button"
              onClick={handleBackToList}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar para lista
            </button>
            <div className="consultation-info">
              <h1>Atividades Físicas</h1>
            </div>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          <div className="consultation-content">
            {loadingAtividadeFisica ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando exercícios físicos...</p>
              </div>
            ) : (
              <div className="atividade-fisica-container">
                {(() => {
                  console.log('🔍 DEBUG [REFERENCIA] Renderizando atividade física - dados:', atividadeFisicaData.length, 'exercícios');
                  return null;
                })()}
                {atividadeFisicaData.length === 0 ? (
                  <div className="no-data">
                    <FileText className="w-16 h-16" style={{ color: '#6366f1', marginBottom: '20px' }} />
                    <h3>Nenhum exercício encontrado</h3>
                    <p>Não há exercícios físicos cadastrados para este paciente.</p>
                  </div>
                ) : (
                  <>
                    {/* Agrupar exercícios por nome_treino */}
                    {Object.entries(
                      atividadeFisicaData.reduce((acc, exercicio) => {
                        const treino = exercicio.nome_treino || 'Treino Sem Nome';
                        if (!acc[treino]) {
                          acc[treino] = [];
                        }
                        acc[treino].push(exercicio);
                        return acc;
                      }, {} as Record<string, ExercicioFisico[]>)
                    ).map(([nomeTreino, exercicios]: [string, ExercicioFisico[]]) => (
                      <div key={nomeTreino} className="treino-section">
                        <h2 className="treino-title">{nomeTreino}</h2>
                        <div className="exercicios-table-container">
                          <table className="exercicios-table">
                            <thead>
                              <tr>
                                <th>Nome do Exercício</th>
                                <th>Séries</th>
                                <th>Repetições</th>
                                <th>Descanso</th>
                                <th>Observações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exercicios.map((exercicio: ExercicioFisico) => (
                                <tr key={exercicio.id}>
                                  <td>
                                    {editingExercicio?.id === exercicio.id && editingExercicio?.field === 'nome_exercicio' ? (
                                      <input
                                        type="text"
                                        defaultValue={exercicio.nome_exercicio || ''}
                                        onBlur={(e) => handleSaveExercicio(exercicio.id, 'nome_exercicio', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveExercicio(exercicio.id, 'nome_exercicio', e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingExercicio(null);
                                          }
                                        }}
                                        autoFocus
                                        className="edit-input"
                                      />
                                    ) : (
                                      <span 
                                        className="editable-field"
                                        onClick={() => setEditingExercicio({ id: exercicio.id, field: 'nome_exercicio' })}
                                      >
                                        {exercicio.nome_exercicio || '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {editingExercicio?.id === exercicio.id && editingExercicio?.field === 'series' ? (
                                      <input
                                        type="text"
                                        defaultValue={exercicio.series || ''}
                                        onBlur={(e) => handleSaveExercicio(exercicio.id, 'series', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveExercicio(exercicio.id, 'series', e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingExercicio(null);
                                          }
                                        }}
                                        autoFocus
                                        className="edit-input"
                                      />
                                    ) : (
                                      <span 
                                        className="editable-field"
                                        onClick={() => setEditingExercicio({ id: exercicio.id, field: 'series' })}
                                      >
                                        {exercicio.series || '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {editingExercicio?.id === exercicio.id && editingExercicio?.field === 'repeticoes' ? (
                                      <input
                                        type="text"
                                        defaultValue={exercicio.repeticoes || ''}
                                        onBlur={(e) => handleSaveExercicio(exercicio.id, 'repeticoes', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveExercicio(exercicio.id, 'repeticoes', e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingExercicio(null);
                                          }
                                        }}
                                        autoFocus
                                        className="edit-input"
                                      />
                                    ) : (
                                      <span 
                                        className="editable-field"
                                        onClick={() => setEditingExercicio({ id: exercicio.id, field: 'repeticoes' })}
                                      >
                                        {exercicio.repeticoes || '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {editingExercicio?.id === exercicio.id && editingExercicio?.field === 'descanso' ? (
                                      <input
                                        type="text"
                                        defaultValue={exercicio.descanso || ''}
                                        onBlur={(e) => handleSaveExercicio(exercicio.id, 'descanso', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveExercicio(exercicio.id, 'descanso', e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingExercicio(null);
                                          }
                                        }}
                                        autoFocus
                                        className="edit-input"
                                      />
                                    ) : (
                                      <span 
                                        className="editable-field"
                                        onClick={() => setEditingExercicio({ id: exercicio.id, field: 'descanso' })}
                                      >
                                        {exercicio.descanso || '-'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {editingExercicio?.id === exercicio.id && editingExercicio?.field === 'observacoes' ? (
                                      <input
                                        type="text"
                                        defaultValue={exercicio.observacoes || ''}
                                        onBlur={(e) => handleSaveExercicio(exercicio.id, 'observacoes', e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveExercicio(exercicio.id, 'observacoes', e.currentTarget.value);
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingExercicio(null);
                                          }
                                        }}
                                        autoFocus
                                        className="edit-input"
                                      />
                                    ) : (
                                      <span 
                                        className="editable-field"
                                        onClick={() => setEditingExercicio({ id: exercicio.id, field: 'observacoes' })}
                                      >
                                        {exercicio.observacoes || '-'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    {/* Botão para continuar */}
                    <div className="save-section">
                      <button
                        className="save-button"
                        onClick={handleSaveAtividadeFisicaAndContinue}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <div className="loading-spinner-small"></div>
                            Salvando...
                          </>
                        ) : (
                          'Salvar e Avançar para Hábitos de Vida'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_HABITOS_DE_VIDA, renderiza a tela de Hábitos de Vida
    if (contentType === 'SOLUCAO_HABITOS_DE_VIDA') {
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
            <h1 className="consultas-title">Solução - Hábitos de Vida</h1>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
                </div>
              </div>

              <div className="info-block">
                <div className="info-icon-wrapper status-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="info-content">
                  <span className="info-label">Status</span>
                  <span className="info-value">{getStatusText(consultaDetails.status)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="details-two-column-layout">
            {/* Coluna Esquerda - Chat com IA */}
            <div className="chat-column">
              <div className="chat-container">
                <div className="chat-header">
                  <h3>Chat com IA - Assistente de Hábitos de Vida</h3>
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
                        Selecione um campo do protocolo de Hábitos de Vida clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
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

            {/* Coluna Direita - Hábitos de Vida */}
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo de Hábitos de Vida</h2>
                  <button
                    onClick={handleSaveHabitosVidaAndComplete}
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
                        Finalizar Consulta
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <HabitosDeVidaSection 
                    consultaId={consultaId}
                    selectedField={selectedField}
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    onFieldSelect={handleFieldSelect}
                    onSendMessage={handleSendAIMessage}
                    onChatInputChange={setChatInput}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_ALIMENTACAO, renderiza a tela de Alimentação
    if (contentType === 'SOLUCAO_ALIMENTACAO') {
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
            <h1 className="consultas-title">Solução - Alimentação</h1>
            {renderViewSolutionsButton && renderViewSolutionsButton()}
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
                  <span className="info-label">Data/Hora</span>
                  <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                  <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
                </div>
              </div>

              <div className="info-block">
                <div className="info-icon-wrapper status-icon">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="info-content">
                  <span className="info-label">Status</span>
                  <span className="info-value">{getStatusText(consultaDetails.status)}</span>
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
                    consultaId={consultaId}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_SELECTION, renderiza a tela de seleção de solução
    if (contentType === 'SOLUCAO_SELECTION') {
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
          
          <div className="solucao-selection-container">
            <div className="solucao-selection-header">
              <h2>Escolha uma das soluções para continuar:</h2>
              <p>Selecione a solução que deseja implementar para este paciente.</p>
            </div>
            
            <div className="solucao-grid">
              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('LTB')}
              >
                <div className="solucao-icon">
                  <Dna className="w-8 h-8" />
                </div>
                <h3>LTB</h3>
                <p>Limpeza Total do Bioma</p>
              </div>

              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('MENTALIDADE')}
              >
                <div className="solucao-icon">
                  <Brain className="w-8 h-8" />
                </div>
                <h3>Mentalidade</h3>
                <p>Transformação Mental e Emocional</p>
              </div>

              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('ALIMENTACAO')}
              >
                <div className="solucao-icon">
                  <Apple className="w-8 h-8" />
                </div>
                <h3>Alimentação</h3>
                <p>Plano Nutricional Personalizado</p>
              </div>

              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('SUPLEMENTACAO')}
              >
                <div className="solucao-icon">
                  <Pill className="w-8 h-8" />
                </div>
                <h3>Suplementação</h3>
                <p>Protocolo de Suplementos</p>
              </div>

              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('ATIVIDADE_FISICA')}
              >
                <div className="solucao-icon">
                  <Dumbbell className="w-8 h-8" />
                </div>
                <h3>Atividade Física</h3>
                <p>Programa de Exercícios</p>
              </div>

              <div 
                className="solucao-card"
                onClick={() => handleSelectSolucao('HABITOS_DE_VIDA')}
              >
                <div className="solucao-icon">
                  <Leaf className="w-8 h-8" />
                </div>
                <h3>Hábitos de Vida</h3>
                <p>Transformação de Estilo de Vida</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for um modal (não ANAMNESE, não DIAGNOSTICO, não SOLUCAO_LTB, não SOLUCAO_MENTALIDADE, não SOLUCAO_SUPLEMENTACAO, não SOLUCAO_ALIMENTACAO, não SOLUCAO_ATIVIDADE_FISICA, não SOLUCAO_HABITOS_DE_VIDA e não SOLUCAO_SELECTION), renderiza só o modal
    if (typeof contentType !== 'string' || (contentType !== 'ANAMNESE' && contentType !== 'DIAGNOSTICO' && contentType !== 'SOLUCAO_LTB' && contentType !== 'SOLUCAO_MENTALIDADE' && contentType !== 'SOLUCAO_SUPLEMENTACAO' && contentType !== 'SOLUCAO_ALIMENTACAO' && contentType !== 'SOLUCAO_ATIVIDADE_FISICA' && contentType !== 'SOLUCAO_HABITOS_DE_VIDA' && contentType !== 'SOLUCAO_SELECTION')) {
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

    // Renderiza a tela de ANAMNESE completa
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
                <span className="info-label">Data/Hora</span>
                <span className="info-value">{formatFullDate(consultaDetails.created_at)}</span>
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
                <span className="info-value">{formatDuration(consultaDetails.duration)}</span>
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
                  onClick={handleSaveAndContinue}
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
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>

              <div className="anamnese-content">
                <AnamneseSection 
                  consultaId={consultaId}
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
      </div>
    );
  }

  // Renderizar lista de consultas
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <div className="consultas-header-content">
          <div>
            <h1 className="consultas-title">Lista de Consultas</h1>
            <div className="consultas-stats">
              <span>{totalConsultations} consultas encontradas</span>
            </div>
          </div>
          <button 
            className="btn-new-consultation"
            onClick={() => router.push('/consulta/nova')}
          >
            <Plus className="btn-icon" />
            Nova Consulta
          </button>
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
                  className="table-row"
                  onClick={() => handleConsultationClick(consultation)}
                  style={{ cursor: 'pointer' }}
                >
                  <div 
                    className="table-cell patient-cell"
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'flex-start',
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
                          justifyContent: 'flex-start',
                          textAlign: 'left'
                        }}
                      >
                        <div 
                          className="patient-name"
                          style={{
                            textAlign: 'left',
                            alignSelf: 'flex-start',
                            width: '100%'
                          }}
                        >
                          {consultation.patient_name}
                        </div>
                        <div 
                          className="patient-condition"
                          style={{
                            textAlign: 'left',
                            alignSelf: 'flex-start',
                            width: '100%'
                          }}
                        >
                          {(() => {
                            const typeText = consultation.consultation_type === 'TELEMEDICINA' ? 'Consulta online' : 'Consulta presencial';
                            const context = consultation.patient_context || '';
                            
                            // Limpar contexto removendo informações duplicadas
                            let cleanContext = context;
                            if (cleanContext.toLowerCase().includes('consulta online')) {
                              cleanContext = cleanContext.replace(/consulta online\s*[-–]\s*/gi, '').trim();
                            }
                            if (cleanContext.toLowerCase().includes('consulta presencial')) {
                              cleanContext = cleanContext.replace(/consulta presencial\s*[-–]\s*/gi, '').trim();
                            }
                            
                            // Se ainda há contexto após limpeza, mostrar tipo + contexto
                            if (cleanContext && cleanContext !== consultation.patient_name) {
                              return `${typeText} - ${cleanContext}`;
                            }
                            
                            // Caso contrário, mostrar apenas o tipo
                            return typeText;
                          })()}
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
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' || consultation.status === 'VALIDATION' ? 'outlined' : 'default'}
                    />
                  </div>
                  
                  <div className="table-cell actions-cell">
                    <div className="action-buttons">
                      <button
                        className="action-button edit-action"
                        onClick={(e) => handleEditConsultation(e, consultation)}
                        title="Editar consulta"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="action-button delete-action"
                        onClick={(e) => handleDeleteConsultation(e, consultation)}
                        title="Excluir consulta"
                      >
                        <Trash2 className="w-4 h-4" />
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
                Esta ação não pode ser desfeita. Todos os dados da consulta serão permanentemente removidos.
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

