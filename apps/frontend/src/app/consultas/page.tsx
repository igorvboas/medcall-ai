'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Save, X, Sparkles, Edit, Plus
} from 'lucide-react';
import { StatusBadge, mapBackendStatus } from '../../components/StatusBadge';
import ExamesUploadSection from '../../components/ExamesUploadSection';
import './consultas.css';

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
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'ERROR' | 'CANCELLED' | 'COMPLETED';
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
  consultaEtapa
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
}) {
  //console.log('🔍 AnamneseSection readOnly:', readOnly);
  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
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

      // 2. Fazer requisição para o webhook
      const webhookResponse = await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-anamnese', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // 3. Atualizar o estado local
      const pathParts = fieldPath.split('.');
      let current = anamneseData;
      
      // Navegar até o campo correto
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (current && current[pathParts[i] as keyof AnamneseData]) {
          current = current[pathParts[i] as keyof AnamneseData] as any;
        }
      }
      
      // Atualizar o valor
      if (current && pathParts.length > 0) {
        const lastKey = pathParts[pathParts.length - 1];
        (current as any)[lastKey] = newValue;
        setAnamneseData({ ...anamneseData! });
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
      //console.log('🔍 Buscando anamnese para consulta_id:', consultaId);
      const response = await fetch(`/api/anamnese/${consultaId}`);
      
      //console.log('📡 Status da resposta:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro da API:', errorData);
        throw new Error(errorData.error || 'Erro ao carregar dados da anamnese');
      }
      
      const data = await response.json();
      //console.log('✅ Dados da anamnese recebidos:', data);
      setAnamneseData(data);
    } catch (err) {
      console.error('❌ Erro ao carregar anamnese:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese');
    } finally {
      setLoadingDetails(false);
    }
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
            <DataField label="Nome Completo" value={cadastro_prontuario?.identificacao_nome_completo} fieldPath="cadastro_prontuario.identificacao_nome_completo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly}/>
            <DataField label="Nome Social" value={cadastro_prontuario?.identificacao_nome_social} fieldPath="cadastro_prontuario.identificacao_nome_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Data de Nascimento" value={cadastro_prontuario?.identificacao_data_nascimento} fieldPath="cadastro_prontuario.identificacao_data_nascimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Idade Atual" value={cadastro_prontuario?.identificacao_idade_atual} fieldPath="cadastro_prontuario.identificacao_idade_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sexo Biológico" value={cadastro_prontuario?.identificacao_sexo_biologico} fieldPath="cadastro_prontuario.identificacao_sexo_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gênero" value={cadastro_prontuario?.identificacao_genero} fieldPath="cadastro_prontuario.identificacao_genero" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Naturalidade" value={cadastro_prontuario?.identificacao_naturalidade} fieldPath="cadastro_prontuario.identificacao_naturalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nacionalidade" value={cadastro_prontuario?.identificacao_nacionalidade} fieldPath="cadastro_prontuario.identificacao_nacionalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Dados Sociodemográficos</h4>
            <DataField label="Estado Civil" value={cadastro_prontuario?.dados_sociodemograficos_estado_civil} fieldPath="cadastro_prontuario.dados_sociodemograficos_estado_civil" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Número de Filhos" value={cadastro_prontuario?.dados_sociodemograficos_numero_filhos} fieldPath="cadastro_prontuario.dados_sociodemograficos_numero_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Idade dos Filhos" value={cadastro_prontuario?.dados_sociodemograficos_idade_filhos} fieldPath="cadastro_prontuario.dados_sociodemograficos_idade_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Escolaridade" value={cadastro_prontuario?.dados_sociodemograficos_escolaridade} fieldPath="cadastro_prontuario.dados_sociodemograficos_escolaridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profissão" value={cadastro_prontuario?.dados_sociodemograficos_profissao} fieldPath="cadastro_prontuario.dados_sociodemograficos_profissao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exerce a Profissão" value={cadastro_prontuario?.dados_sociodemograficos_exerce_profissao} fieldPath="cadastro_prontuario.dados_sociodemograficos_exerce_profissao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Situação de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_situacao_trabalho} fieldPath="cadastro_prontuario.dados_sociodemograficos_situacao_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Carga Horária de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_carga_horaria_trabalho} fieldPath="cadastro_prontuario.dados_sociodemograficos_carga_horaria_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Condição Social" value={cadastro_prontuario?.dados_sociodemograficos_condicao_social} fieldPath="cadastro_prontuario.dados_sociodemograficos_condicao_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Renda Familiar" value={cadastro_prontuario?.dados_sociodemograficos_renda_familiar} fieldPath="cadastro_prontuario.dados_sociodemograficos_renda_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pessoas na Residência" value={cadastro_prontuario?.dados_sociodemograficos_pessoas_residencia} fieldPath="cadastro_prontuario.dados_sociodemograficos_pessoas_residencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Responsável Financeiro" value={cadastro_prontuario?.dados_sociodemograficos_responsavel_financeiro} fieldPath="cadastro_prontuario.dados_sociodemograficos_responsavel_financeiro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Seguro Saúde" value={cadastro_prontuario?.dados_sociodemograficos_seguro_saude} fieldPath="cadastro_prontuario.dados_sociodemograficos_seguro_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Documentos</h4>
            <DataField label="CPF" value={cadastro_prontuario?.doc_cpf} fieldPath="cadastro_prontuario.doc_cpf" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="RG" value={cadastro_prontuario?.doc_rg} fieldPath="cadastro_prontuario.doc_rg" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="CNS" value={cadastro_prontuario?.doc_cns} fieldPath="cadastro_prontuario.doc_cns" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Endereço</h4>
            <DataField label="Logradouro" value={cadastro_prontuario?.endereco_logradouro} fieldPath="cadastro_prontuario.endereco_logradouro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Número" value={cadastro_prontuario?.endereco_numero} fieldPath="cadastro_prontuario.endereco_numero" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Complemento" value={cadastro_prontuario?.endereco_complemento} fieldPath="cadastro_prontuario.endereco_complemento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Bairro" value={cadastro_prontuario?.endereco_bairro} fieldPath="cadastro_prontuario.endereco_bairro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cidade" value={cadastro_prontuario?.endereco_cidade} fieldPath="cadastro_prontuario.endereco_cidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estado" value={cadastro_prontuario?.endereco_estado} fieldPath="cadastro_prontuario.endereco_estado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="CEP" value={cadastro_prontuario?.endereco_cep} fieldPath="cadastro_prontuario.endereco_cep" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contato</h4>
            <DataField label="Celular" value={cadastro_prontuario?.telefone_celular} fieldPath="cadastro_prontuario.telefone_celular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Telefone Residencial" value={cadastro_prontuario?.telefone_residencial} fieldPath="cadastro_prontuario.telefone_residencial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Telefone para Recado" value={cadastro_prontuario?.telefone_recado} fieldPath="cadastro_prontuario.telefone_recado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Email" value={cadastro_prontuario?.email} fieldPath="cadastro_prontuario.email" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Objetivos e Queixas */}
      <CollapsibleSection title="Objetivos e Queixas">
          <div className="anamnese-subsection">
            <h4>Saúde Geral Percebida</h4>
            <DataField label="Como Descreve a Saúde" value={objetivos_queixas?.saude_geral_percebida_como_descreve_saude} fieldPath="objetivos_queixas.saude_geral_percebida_como_descreve_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Define Bem-Estar" value={objetivos_queixas?.saude_geral_percebida_como_define_bem_estar} fieldPath="objetivos_queixas.saude_geral_percebida_como_define_bem_estar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avaliação da Saúde Emocional/Mental" value={objetivos_queixas?.saude_geral_percebida_avaliacao_saude_emocional_mental} fieldPath="objetivos_queixas.saude_geral_percebida_avaliacao_saude_emocional_mental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Queixas</h4>
            <DataField label="Queixa Principal" value={objetivos_queixas?.queixa_principal} fieldPath="objetivos_queixas.queixa_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sub-queixas" value={objetivos_queixas?.sub_queixas} fieldPath="objetivos_queixas.sub_queixas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Impacto das Queixas na Vida</h4>
            <DataField label="Como Afeta a Vida Diária" value={objetivos_queixas?.impacto_queixas_vida_como_afeta_vida_diaria} fieldPath="objetivos_queixas.impacto_queixas_vida_como_afeta_vida_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Limitações Causadas" value={objetivos_queixas?.impacto_queixas_vida_limitacoes_causadas} fieldPath="objetivos_queixas.impacto_queixas_vida_limitacoes_causadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Áreas Impactadas" value={objetivos_queixas?.impacto_queixas_vida_areas_impactadas} fieldPath="objetivos_queixas.impacto_queixas_vida_areas_impactadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Objetivos e Expectativas</h4>
            <DataField label="Problemas Deseja Resolver" value={objetivos_queixas?.problemas_deseja_resolver} fieldPath="objetivos_queixas.problemas_deseja_resolver" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativa Específica" value={objetivos_queixas?.expectativas_tratamento_expectativa_especifica} fieldPath="objetivos_queixas.expectativas_tratamento_expectativa_especifica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Buscou Tratamentos Similares" value={objetivos_queixas?.expectativas_tratamento_ja_buscou_tratamentos_similares} fieldPath="objetivos_queixas.expectativas_tratamento_ja_buscou_tratamentos_similares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tratamentos Anteriores" value={objetivos_queixas?.expectativas_tratamento_quais_tratamentos_anteriores} fieldPath="objetivos_queixas.expectativas_tratamento_quais_tratamentos_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Compreensão sobre a Causa</h4>
            <DataField label="Compreensão do Paciente" value={objetivos_queixas?.compreensao_sobre_causa_compreensao_paciente} fieldPath="objetivos_queixas.compreensao_sobre_causa_compreensao_paciente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos Influenciando" value={objetivos_queixas?.compreensao_sobre_causa_fatores_externos_influenciando} fieldPath="objetivos_queixas.compreensao_sobre_causa_fatores_externos_influenciando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Projeto de Vida</h4>
            <DataField label="Corporal" value={objetivos_queixas?.projeto_de_vida_corporal} fieldPath="objetivos_queixas.projeto_de_vida_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritual" value={objetivos_queixas?.projeto_de_vida_espiritual} fieldPath="objetivos_queixas.projeto_de_vida_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Familiar" value={objetivos_queixas?.projeto_de_vida_familiar} fieldPath="objetivos_queixas.projeto_de_vida_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profissional" value={objetivos_queixas?.projeto_de_vida_profissional} fieldPath="objetivos_queixas.projeto_de_vida_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sonhos" value={objetivos_queixas?.projeto_de_vida_sonhos} fieldPath="objetivos_queixas.projeto_de_vida_sonhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Motivação e Mudança</h4>
            <DataField label="Nível de Motivação" value={objetivos_queixas?.nivel_motivacao} fieldPath="objetivos_queixas.nivel_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Prontidão para Mudança" value={objetivos_queixas?.prontidao_para_mudanca} fieldPath="objetivos_queixas.prontidao_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mudanças Considera Necessárias" value={objetivos_queixas?.mudancas_considera_necessarias} fieldPath="objetivos_queixas.mudancas_considera_necessarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Histórico de Risco */}
      <CollapsibleSection title="Histórico de Risco">
          <div className="anamnese-subsection">
            <h4>Doenças Atuais e Passadas</h4>
            <DataField label="Doenças Atuais Confirmadas" value={historico_risco?.doencas_atuais_confirmadas} fieldPath="historico_risco.doencas_atuais_confirmadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Doenças na Infância/Adolescência" value={historico_risco?.doencas_infancia_adolescencia} fieldPath="historico_risco.doencas_infancia_adolescencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Antecedentes Familiares</h4>
            <DataField label="Pai" value={historico_risco?.antecedentes_familiares_pai} fieldPath="historico_risco.antecedentes_familiares_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mãe" value={historico_risco?.antecedentes_familiares_mae} fieldPath="historico_risco.antecedentes_familiares_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Irmãos" value={historico_risco?.antecedentes_familiares_irmaos} fieldPath="historico_risco.antecedentes_familiares_irmaos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Paternos" value={historico_risco?.antecedentes_familiares_avos_paternos} fieldPath="historico_risco.antecedentes_familiares_avos_paternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Maternos" value={historico_risco?.antecedentes_familiares_avos_maternos} fieldPath="historico_risco.antecedentes_familiares_avos_maternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Causas de Morte dos Avós" value={historico_risco?.antecedentes_familiares_causas_morte_avos} fieldPath="historico_risco.antecedentes_familiares_causas_morte_avos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Condições e Tratamentos</h4>
            <DataField label="Condições Genéticas Conhecidas" value={historico_risco?.condicoes_geneticas_conhecidas} fieldPath="historico_risco.condicoes_geneticas_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cirurgias/Procedimentos" value={historico_risco?.cirurgias_procedimentos} fieldPath="historico_risco.cirurgias_procedimentos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Atuais" value={historico_risco?.medicacoes_atuais} fieldPath="historico_risco.medicacoes_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Contínuas" value={historico_risco?.medicacoes_continuas} fieldPath="historico_risco.medicacoes_continuas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Usou Corticoides" value={historico_risco?.ja_usou_corticoides} fieldPath="historico_risco.ja_usou_corticoides" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Alergias e Exposições</h4>
            <DataField label="Alergias/Intolerâncias Conhecidas" value={historico_risco?.alergias_intolerancias_conhecidas} fieldPath="historico_risco.alergias_intolerancias_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alergias/Intolerâncias Suspeitas" value={historico_risco?.alergias_intolerancias_suspeitas} fieldPath="historico_risco.alergias_intolerancias_suspeitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição Tóxica" value={historico_risco?.exposicao_toxica} fieldPath="historico_risco.exposicao_toxica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Histórico de Peso</h4>
            <DataField label="Variação ao Longo da Vida" value={historico_risco?.historico_peso_variacao_ao_longo_vida} fieldPath="historico_risco.historico_peso_variacao_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Máximo Atingido" value={historico_risco?.historico_peso_peso_maximo_atingido} fieldPath="historico_risco.historico_peso_peso_maximo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Mínimo Atingido" value={historico_risco?.historico_peso_peso_minimo_atingido} fieldPath="historico_risco.historico_peso_peso_minimo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tratamentos Anteriores</h4>
            <DataField label="Tentativas de Tratamento Anteriores" value={historico_risco?.tentativas_tratamento_anteriores} fieldPath="historico_risco.tentativas_tratamento_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Observação Clínica e Laboratorial */}
      <CollapsibleSection title="Observação Clínica e Laboratorial">
          <div className="anamnese-subsection">
            <h4>Sintomas e Padrões</h4>
            <DataField label="Quando os Sintomas Começaram" value={observacao_clinica_lab?.quando_sintomas_comecaram} fieldPath="observacao_clinica_lab.quando_sintomas_comecaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrão Temporal" value={observacao_clinica_lab?.ha_algum_padrao_temporal} fieldPath="observacao_clinica_lab.ha_algum_padrao_temporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos que Agravaram" value={observacao_clinica_lab?.eventos_que_agravaram} fieldPath="observacao_clinica_lab.eventos_que_agravaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade de Dor/Desconforto" value={observacao_clinica_lab?.intensidade_dor_desconforto} fieldPath="observacao_clinica_lab.intensidade_dor_desconforto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Energia Diária" value={observacao_clinica_lab?.nivel_energia_diaria} fieldPath="observacao_clinica_lab.nivel_energia_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Gastrointestinal</h4>
            <DataField label="Intestino" value={observacao_clinica_lab?.sistema_gastrointestinal_intestino} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_intestino" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hábito Intestinal" value={observacao_clinica_lab?.sistema_gastrointestinal_habito_intestinal} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_habito_intestinal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_disbiose} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Língua" value={observacao_clinica_lab?.sistema_gastrointestinal_lingua} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_lingua" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Digestão" value={observacao_clinica_lab?.sistema_gastrointestinal_digestao} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_digestao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gases" value={observacao_clinica_lab?.sistema_gastrointestinal_gases} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_gases" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita de Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_suspeita_disbiose} fieldPath="observacao_clinica_lab.sistema_gastrointestinal_suspeita_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Musculoesquelético</h4>
            <DataField label="Dores" value={observacao_clinica_lab?.sistema_musculoesqueletico_dores} fieldPath="observacao_clinica_lab.sistema_musculoesqueletico_dores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Localização" value={observacao_clinica_lab?.sistema_musculoesqueletico_localizacao} fieldPath="observacao_clinica_lab.sistema_musculoesqueletico_localizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Postura" value={observacao_clinica_lab?.sistema_musculoesqueletico_postura} fieldPath="observacao_clinica_lab.sistema_musculoesqueletico_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tônus Muscular" value={observacao_clinica_lab?.sistema_musculoesqueletico_tono_muscular} fieldPath="observacao_clinica_lab.sistema_musculoesqueletico_tono_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mobilidade" value={observacao_clinica_lab?.sistema_musculoesqueletico_mobilidade} fieldPath="observacao_clinica_lab.sistema_musculoesqueletico_mobilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pele e Fâneros</h4>
            <DataField label="Pele" value={observacao_clinica_lab?.pele_faneros_pele} fieldPath="observacao_clinica_lab.pele_faneros_pele" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cabelo" value={observacao_clinica_lab?.pele_faneros_cabelo} fieldPath="observacao_clinica_lab.pele_faneros_cabelo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Unhas" value={observacao_clinica_lab?.pele_faneros_unhas} fieldPath="observacao_clinica_lab.pele_faneros_unhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hidratação" value={observacao_clinica_lab?.pele_faneros_hidratacao} fieldPath="observacao_clinica_lab.pele_faneros_hidratacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ingestão de Água (ml/dia)" value={observacao_clinica_lab?.pele_faneros_ingestao_agua_ml_dia} fieldPath="observacao_clinica_lab.pele_faneros_ingestao_agua_ml_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Neurológico/Mental</h4>
            <DataField label="Memória" value={observacao_clinica_lab?.sistema_neurologico_mental_memoria} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_memoria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Concentração" value={observacao_clinica_lab?.sistema_neurologico_mental_concentracao} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Qualidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_qualidade} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Latência do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_latencia} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_latencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Manutenção do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_manutencao} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_manutencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profundidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_profundidade} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_profundidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Duração do Sono (horas)" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_duracao_horas} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_duracao_horas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Despertar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_despertar} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_despertar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda Quantas Vezes" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_quantas_vezes} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_acorda_quantas_vezes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda para Urinar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_para_urinar} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_sono_acorda_para_urinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Energia" value={observacao_clinica_lab?.sistema_neurologico_mental_energia} fieldPath="observacao_clinica_lab.sistema_neurologico_mental_energia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Endócrino</h4>
            <h5>Tireoide</h5>
            <DataField label="TSH" value={observacao_clinica_lab?.sistema_endocrino_tireoide_tsh} fieldPath="observacao_clinica_lab.sistema_endocrino_tireoide_tsh" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Anti-TPO" value={observacao_clinica_lab?.sistema_endocrino_tireoide_anti_tpo} fieldPath="observacao_clinica_lab.sistema_endocrino_tireoide_anti_tpo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T3 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t3_livre} fieldPath="observacao_clinica_lab.sistema_endocrino_tireoide_t3_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T4 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t4_livre} fieldPath="observacao_clinica_lab.sistema_endocrino_tireoide_t4_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita" value={observacao_clinica_lab?.sistema_endocrino_tireoide_suspeita} fieldPath="observacao_clinica_lab.sistema_endocrino_tireoide_suspeita" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Insulina</h5>
            <DataField label="Valor" value={observacao_clinica_lab?.sistema_endocrino_insulina_valor} fieldPath="observacao_clinica_lab.sistema_endocrino_insulina_valor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Glicemia" value={observacao_clinica_lab?.sistema_endocrino_insulina_glicemia} fieldPath="observacao_clinica_lab.sistema_endocrino_insulina_glicemia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hemoglobina Glicada" value={observacao_clinica_lab?.sistema_endocrino_insulina_hemoglobina_glicada} fieldPath="observacao_clinica_lab.sistema_endocrino_insulina_hemoglobina_glicada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="HOMA-IR" value={observacao_clinica_lab?.sistema_endocrino_insulina_homa_ir} fieldPath="observacao_clinica_lab.sistema_endocrino_insulina_homa_ir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diagnóstico" value={observacao_clinica_lab?.sistema_endocrino_insulina_diagnostico} fieldPath="observacao_clinica_lab.sistema_endocrino_insulina_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Outros Hormônios</h5>
            <DataField label="Cortisol" value={observacao_clinica_lab?.sistema_endocrino_cortisol} fieldPath="observacao_clinica_lab.sistema_endocrino_cortisol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estrogênio" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_estrogeno} fieldPath="observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_estrogeno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Progesterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_progesterona} fieldPath="observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_progesterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Testosterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_testosterona} fieldPath="observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_testosterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_impacto} fieldPath="observacao_clinica_lab.sistema_endocrino_hormonios_sexuais_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Medidas Antropométricas</h4>
            <DataField label="Peso Atual" value={observacao_clinica_lab?.medidas_antropometricas_peso_atual} fieldPath="observacao_clinica_lab.medidas_antropometricas_peso_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Altura" value={observacao_clinica_lab?.medidas_antropometricas_altura} fieldPath="observacao_clinica_lab.medidas_antropometricas_altura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="IMC" value={observacao_clinica_lab?.medidas_antropometricas_imc} fieldPath="observacao_clinica_lab.medidas_antropometricas_imc" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência da Cintura" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_cintura} fieldPath="observacao_clinica_lab.medidas_antropometricas_circunferencias_cintura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Quadril" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_quadril} fieldPath="observacao_clinica_lab.medidas_antropometricas_circunferencias_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Pescoço" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_pescoco} fieldPath="observacao_clinica_lab.medidas_antropometricas_circunferencias_pescoco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relação Cintura/Quadril" value={observacao_clinica_lab?.medidas_antropometricas_relacao_cintura_quadril} fieldPath="observacao_clinica_lab.medidas_antropometricas_relacao_cintura_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <h5>Bioimpedância</h5>
            <DataField label="Gordura (%)" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_percentual} fieldPath="observacao_clinica_lab.medidas_antropometricas_bioimpedancia_gordura_percentual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Massa Muscular" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_massa_muscular} fieldPath="observacao_clinica_lab.medidas_antropometricas_bioimpedancia_massa_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Água Corporal" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_agua_corporal} fieldPath="observacao_clinica_lab.medidas_antropometricas_bioimpedancia_agua_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_visceral} fieldPath="observacao_clinica_lab.medidas_antropometricas_bioimpedancia_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_gordura_visceral} fieldPath="observacao_clinica_lab.medidas_antropometricas_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Esteatose Hepática" value={observacao_clinica_lab?.medidas_antropometricas_esteatose_hepatica} fieldPath="observacao_clinica_lab.medidas_antropometricas_esteatose_hepatica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pressão Arterial" value={observacao_clinica_lab?.medidas_antropometricas_pressao_arterial} fieldPath="observacao_clinica_lab.medidas_antropometricas_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sinais Vitais Relatados</h4>
            <DataField label="Disposição ao Acordar" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_acordar} fieldPath="observacao_clinica_lab.sinais_vitais_relatados_disposicao_ao_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disposição ao Longo do Dia" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_longo_dia} fieldPath="observacao_clinica_lab.sinais_vitais_relatados_disposicao_ao_longo_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Libido" value={observacao_clinica_lab?.sinais_vitais_relatados_libido} fieldPath="observacao_clinica_lab.sinais_vitais_relatados_libido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Regulação Térmica" value={observacao_clinica_lab?.sinais_vitais_relatados_regulacao_termica} fieldPath="observacao_clinica_lab.sinais_vitais_relatados_regulacao_termica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos Alimentares</h4>
            <DataField label="Recordatório 24h" value={observacao_clinica_lab?.habitos_alimentares_recordatorio_24h} fieldPath="observacao_clinica_lab.habitos_alimentares_recordatorio_24h" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência de Ultraprocessados" value={observacao_clinica_lab?.habitos_alimentares_frequencia_ultraprocessados} fieldPath="observacao_clinica_lab.habitos_alimentares_frequencia_ultraprocessados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Horários das Refeições" value={observacao_clinica_lab?.habitos_alimentares_horarios_refeicoes} fieldPath="observacao_clinica_lab.habitos_alimentares_horarios_refeicoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Come Assistindo TV/Trabalhando" value={observacao_clinica_lab?.habitos_alimentares_come_assistindo_tv_trabalhando} fieldPath="observacao_clinica_lab.habitos_alimentares_come_assistindo_tv_trabalhando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* História de Vida */}
      <CollapsibleSection title="História de Vida">
          <div className="anamnese-subsection">
            <h4>Narrativa e Eventos</h4>
            <DataField label="Síntese da Narrativa" value={historia_vida?.narrativa_sintese} fieldPath="historia_vida.narrativa_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos de Vida Marcantes" value={historia_vida?.eventos_vida_marcantes} fieldPath="historia_vida.eventos_vida_marcantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo/Trauma" value={historia_vida?.episodios_estresse_extremo_trauma} fieldPath="historia_vida.episodios_estresse_extremo_trauma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Trilha do Conflito</h4>
            <DataField label="Concepção/Gestação" value={historia_vida?.trilha_do_conflito_concepcao_gestacao} fieldPath="historia_vida.trilha_do_conflito_concepcao_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="0-7 anos" value={historia_vida?.trilha_do_conflito_0_7_anos} fieldPath="historia_vida.trilha_do_conflito_0_7_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="7-14 anos" value={historia_vida?.trilha_do_conflito_7_14_anos} fieldPath="historia_vida.trilha_do_conflito_7_14_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="14-21 anos" value={historia_vida?.trilha_do_conflito_14_21_anos} fieldPath="historia_vida.trilha_do_conflito_14_21_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="21-28 anos" value={historia_vida?.trilha_do_conflito_21_28_anos} fieldPath="historia_vida.trilha_do_conflito_21_28_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="28+ anos" value={historia_vida?.trilha_do_conflito_28_mais_anos} fieldPath="historia_vida.trilha_do_conflito_28_mais_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Padrões e Traumas</h4>
            <DataField label="Pontos Traumáticos" value={historia_vida?.pontos_traumaticos} fieldPath="historia_vida.pontos_traumaticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões Repetitivos" value={historia_vida?.padroes_repetitivos} fieldPath="historia_vida.padroes_repetitivos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe na Gestação" value={historia_vida?.saude_mae_gestacao} fieldPath="historia_vida.saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Traços/Comportamentos Repetitivos" value={historia_vida?.tracos_comportamentos_repetitivos_ao_longo_vida} fieldPath="historia_vida.tracos_comportamentos_repetitivos_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Superação e Identidade</h4>
            <DataField label="Experiência de Virada" value={historia_vida?.experiencia_considera_virada} fieldPath="historia_vida.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Identifica com Superação ou Defesa" value={historia_vida?.identifica_com_superacao_ou_defesa} fieldPath="historia_vida.identifica_com_superacao_ou_defesa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Conexão com Identidade e Propósito" value={historia_vida?.conexao_identidade_proposito} fieldPath="historia_vida.conexao_identidade_proposito" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Algo da Infância que Lembra com Emoção Intensa" value={historia_vida?.algo_infancia_lembra_com_emocao_intensa} fieldPath="historia_vida.algo_infancia_lembra_com_emocao_intensa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tentativas Anteriores</h4>
            <DataField label="Já Tentou Resolver Antes" value={historia_vida?.tentativas_anteriores_similares_ja_tentou_resolver_antes} fieldPath="historia_vida.tentativas_anteriores_similares_ja_tentou_resolver_antes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Quantas Vezes" value={historia_vida?.tentativas_anteriores_similares_quantas_vezes} fieldPath="historia_vida.tentativas_anteriores_similares_quantas_vezes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Métodos Utilizados" value={historia_vida?.tentativas_anteriores_similares_metodos_utilizados} fieldPath="historia_vida.tentativas_anteriores_similares_metodos_utilizados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Máximo Resultado Alcançado" value={historia_vida?.tentativas_anteriores_similares_maximo_resultado_alcancado} fieldPath="historia_vida.tentativas_anteriores_similares_maximo_resultado_alcancado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Resultado Recuperado" value={historia_vida?.tentativas_anteriores_similares_resultado_recuperado} fieldPath="historia_vida.tentativas_anteriores_similares_resultado_recuperado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Setênios e Eventos */}
      <CollapsibleSection title="Setênios e Eventos">
          <div className="anamnese-subsection">
            <h4>Concepção e Gestação</h4>
            <DataField label="Planejamento" value={setenios_eventos?.concepcao_gestacao_planejamento} fieldPath="setenios_eventos.concepcao_gestacao_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ambiente Gestacional" value={setenios_eventos?.concepcao_gestacao_ambiente_gestacional} fieldPath="setenios_eventos.concepcao_gestacao_ambiente_gestacional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe" value={setenios_eventos?.concepcao_gestacao_saude_mae_gestacao} fieldPath="setenios_eventos.concepcao_gestacao_saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Parto" value={setenios_eventos?.concepcao_gestacao_parto} fieldPath="setenios_eventos.concepcao_gestacao_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Houve Trauma de Parto" value={setenios_eventos?.concepcao_gestacao_houve_trauma_parto} fieldPath="setenios_eventos.concepcao_gestacao_houve_trauma_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Foi Desejada/Planejada" value={setenios_eventos?.concepcao_gestacao_foi_desejada_planejada} fieldPath="setenios_eventos.concepcao_gestacao_foi_desejada_planejada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.concepcao_gestacao_impacto} fieldPath="setenios_eventos.concepcao_gestacao_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Primeiro Setênio (0-7 anos)</h4>
            <DataField label="Ambiente" value={setenios_eventos?.primeiro_setenio_0_7_ambiente} fieldPath="setenios_eventos.primeiro_setenio_0_7_ambiente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Pai" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_pai} fieldPath="setenios_eventos.primeiro_setenio_0_7_figuras_parentais_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Mãe" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_mae} fieldPath="setenios_eventos.primeiro_setenio_0_7_figuras_parentais_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aprendizados" value={setenios_eventos?.primeiro_setenio_0_7_aprendizados} fieldPath="setenios_eventos.primeiro_setenio_0_7_aprendizados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Trauma Central" value={setenios_eventos?.primeiro_setenio_0_7_trauma_central} fieldPath="setenios_eventos.primeiro_setenio_0_7_trauma_central" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Segundo Setênio (7-14 anos)</h4>
            <DataField label="Eventos" value={setenios_eventos?.segundo_setenio_7_14_eventos} fieldPath="setenios_eventos.segundo_setenio_7_14_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Desenvolvimento" value={setenios_eventos?.segundo_setenio_7_14_desenvolvimento} fieldPath="setenios_eventos.segundo_setenio_7_14_desenvolvimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Corpo Físico" value={setenios_eventos?.segundo_setenio_7_14_corpo_fisico} fieldPath="setenios_eventos.segundo_setenio_7_14_corpo_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.segundo_setenio_7_14_impacto} fieldPath="setenios_eventos.segundo_setenio_7_14_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Terceiro Setênio (14-21 anos)</h4>
            <DataField label="Escolhas" value={setenios_eventos?.terceiro_setenio_14_21_escolhas} fieldPath="setenios_eventos.terceiro_setenio_14_21_escolhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Motivação" value={setenios_eventos?.terceiro_setenio_14_21_motivacao} fieldPath="setenios_eventos.terceiro_setenio_14_21_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cumeeira da Casa" value={setenios_eventos?.terceiro_setenio_14_21_cumeeira_da_casa} fieldPath="setenios_eventos.terceiro_setenio_14_21_cumeeira_da_casa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Quarto Setênio (21-28 anos)</h4>
            <DataField label="Eventos Significativos" value={setenios_eventos?.quarto_setenio_21_28_eventos_significativos} fieldPath="setenios_eventos.quarto_setenio_21_28_eventos_significativos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Formação Profissional" value={setenios_eventos?.quarto_setenio_21_28_formacao_profissional} fieldPath="setenios_eventos.quarto_setenio_21_28_formacao_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Decênios (28-40+ anos)</h4>
            <DataField label="Climatério/Menopausa" value={setenios_eventos?.decenios_28_40_mais_climaterio_menopausa} fieldPath="setenios_eventos.decenios_28_40_mais_climaterio_menopausa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pausas Hormonais" value={setenios_eventos?.decenios_28_40_mais_pausas_hormonais} fieldPath="setenios_eventos.decenios_28_40_mais_pausas_hormonais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acumulação" value={setenios_eventos?.decenios_28_40_mais_acumulacao} fieldPath="setenios_eventos.decenios_28_40_mais_acumulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estado Atual" value={setenios_eventos?.decenios_28_40_mais_estado_atual} fieldPath="setenios_eventos.decenios_28_40_mais_estado_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo" value={setenios_eventos?.decenios_28_40_mais_episodios_estresse_extremo} fieldPath="setenios_eventos.decenios_28_40_mais_episodios_estresse_extremo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Gerais</h4>
            <DataField label="Eventos Críticos Identificados" value={setenios_eventos?.eventos_criticos_identificados} fieldPath="setenios_eventos.eventos_criticos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Experiência de Virada" value={setenios_eventos?.experiencia_considera_virada} fieldPath="setenios_eventos.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diferenças Sazonais/Climáticas nos Sintomas" value={setenios_eventos?.diferencas_sazonais_climaticas_sintomas} fieldPath="setenios_eventos.diferencas_sazonais_climaticas_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Ambiente e Contexto */}
      <CollapsibleSection title="Ambiente e Contexto">
          <div className="anamnese-subsection">
            <h4>Contexto Familiar</h4>
            <DataField label="Estado Civil" value={ambiente_contexto?.contexto_familiar_estado_civil} fieldPath="ambiente_contexto.contexto_familiar_estado_civil" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Filhos" value={ambiente_contexto?.contexto_familiar_filhos} fieldPath="ambiente_contexto.contexto_familiar_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Dinâmica Familiar" value={ambiente_contexto?.contexto_familiar_dinamica_familiar} fieldPath="ambiente_contexto.contexto_familiar_dinamica_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suporte Familiar" value={ambiente_contexto?.contexto_familiar_suporte_familiar} fieldPath="ambiente_contexto.contexto_familiar_suporte_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relacionamento Conjugal" value={ambiente_contexto?.contexto_familiar_relacionamento_conjugal} fieldPath="ambiente_contexto.contexto_familiar_relacionamento_conjugal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Divisão de Tarefas Domésticas" value={ambiente_contexto?.contexto_familiar_divisao_tarefas_domesticas} fieldPath="ambiente_contexto.contexto_familiar_divisao_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Vida Sexual Ativa" value={ambiente_contexto?.contexto_familiar_vida_sexual_ativa} fieldPath="ambiente_contexto.contexto_familiar_vida_sexual_ativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diálogo sobre Sobrecarga" value={ambiente_contexto?.contexto_familiar_dialogo_sobre_sobrecarga} fieldPath="ambiente_contexto.contexto_familiar_dialogo_sobre_sobrecarga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contexto Profissional</h4>
            <DataField label="Área" value={ambiente_contexto?.contexto_profissional_area} fieldPath="ambiente_contexto.contexto_profissional_area" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Carga Horária" value={ambiente_contexto?.contexto_profissional_carga_horaria} fieldPath="ambiente_contexto.contexto_profissional_carga_horaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Estresse" value={ambiente_contexto?.contexto_profissional_nivel_estresse} fieldPath="ambiente_contexto.contexto_profissional_nivel_estresse" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Satisfação" value={ambiente_contexto?.contexto_profissional_satisfacao} fieldPath="ambiente_contexto.contexto_profissional_satisfacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ambiente Físico</h4>
            <DataField label="Sedentarismo" value={ambiente_contexto?.ambiente_fisico_sedentarismo} fieldPath="ambiente_contexto.ambiente_fisico_sedentarismo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição ao Sol" value={ambiente_contexto?.ambiente_fisico_exposicao_sol} fieldPath="ambiente_contexto.ambiente_fisico_exposicao_sol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pratica Atividade Física" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_pratica} fieldPath="ambiente_contexto.ambiente_fisico_atividade_fisica_pratica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Atividade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tipo} fieldPath="ambiente_contexto.ambiente_fisico_atividade_fisica_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_frequencia} fieldPath="ambiente_contexto.ambiente_fisico_atividade_fisica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_intensidade} fieldPath="ambiente_contexto.ambiente_fisico_atividade_fisica_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem Acompanhamento Profissional" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona} fieldPath="ambiente_contexto.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos de Vida</h4>
            <DataField label="Sono" value={ambiente_contexto?.habitos_vida_sono} fieldPath="ambiente_contexto.habitos_vida_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alimentação" value={ambiente_contexto?.habitos_vida_alimentacao} fieldPath="ambiente_contexto.habitos_vida_alimentacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Lazer" value={ambiente_contexto?.habitos_vida_lazer} fieldPath="ambiente_contexto.habitos_vida_lazer" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritualidade" value={ambiente_contexto?.habitos_vida_espiritualidade} fieldPath="ambiente_contexto.habitos_vida_espiritualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Suporte Social</h4>
            <DataField label="Tem Rede de Apoio" value={ambiente_contexto?.suporte_social_tem_rede_apoio} fieldPath="ambiente_contexto.suporte_social_tem_rede_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Participa de Grupos Sociais" value={ambiente_contexto?.suporte_social_participa_grupos_sociais} fieldPath="ambiente_contexto.suporte_social_participa_grupos_sociais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem com Quem Desabafar" value={ambiente_contexto?.suporte_social_tem_com_quem_desabafar} fieldPath="ambiente_contexto.suporte_social_tem_com_quem_desabafar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Fatores de Risco</h4>
            <DataField label="Fatores Estressores" value={ambiente_contexto?.fatores_estressores} fieldPath="ambiente_contexto.fatores_estressores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos à Saúde" value={ambiente_contexto?.fatores_externos_saude} fieldPath="ambiente_contexto.fatores_externos_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Sensação e Emoções */}
      <CollapsibleSection title="Sensação e Emoções">
          <div className="anamnese-subsection">
            <h4>Emoções e Sensações</h4>
            <DataField label="Emoções Predominantes" value={sensacao_emocoes?.emocoes_predominantes} fieldPath="sensacao_emocoes.emocoes_predominantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sensações Corporais" value={sensacao_emocoes?.sensacoes_corporais} fieldPath="sensacao_emocoes.sensacoes_corporais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Palavras-chave Emocionais" value={sensacao_emocoes?.palavras_chave_emocionais} fieldPath="sensacao_emocoes.palavras_chave_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade Emocional" value={sensacao_emocoes?.intensidade_emocional} fieldPath="sensacao_emocoes.intensidade_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Gatilhos Emocionais</h4>
            <DataField label="Consegue Identificar Gatilhos" value={sensacao_emocoes?.consegue_identificar_gatilhos_emocionais} fieldPath="sensacao_emocoes.consegue_identificar_gatilhos_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gatilhos Identificados" value={sensacao_emocoes?.gatilhos_identificados} fieldPath="sensacao_emocoes.gatilhos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Regulação Emocional</h4>
            <DataField label="Capacidade de Regulação" value={sensacao_emocoes?.regulacao_emocional_capacidade_regulacao} fieldPath="sensacao_emocoes.regulacao_emocional_capacidade_regulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Forma de Expressão" value={sensacao_emocoes?.regulacao_emocional_forma_expressao} fieldPath="sensacao_emocoes.regulacao_emocional_forma_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Gerencia Estresse/Ansiedade" value={sensacao_emocoes?.regulacao_emocional_como_gerencia_estresse_ansiedade} fieldPath="sensacao_emocoes.regulacao_emocional_como_gerencia_estresse_ansiedade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Memória Afetiva" value={sensacao_emocoes?.memoria_afetiva} fieldPath="sensacao_emocoes.memoria_afetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sensações Específicas do Reino</h4>
            <DataField label="Usa Palavras Como" value={sensacao_emocoes?.sensacoes_especificas_reino_usa_palavras_como} fieldPath="sensacao_emocoes.sensacoes_especificas_reino_usa_palavras_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={sensacao_emocoes?.sensacoes_especificas_reino_descreve_sensacoes_como} fieldPath="sensacao_emocoes.sensacoes_especificas_reino_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões de Discurso" value={sensacao_emocoes?.sensacoes_especificas_reino_padroes_discurso} fieldPath="sensacao_emocoes.sensacoes_especificas_reino_padroes_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Conexão Corpo-Mente</h4>
            <DataField label="Percebe Manifestações Corporais das Emoções" value={sensacao_emocoes?.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes} fieldPath="sensacao_emocoes.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exemplos" value={sensacao_emocoes?.conexao_corpo_mente_exemplos} fieldPath="sensacao_emocoes.conexao_corpo_mente_exemplos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Preocupações e Crenças */}
      <CollapsibleSection title="Preocupações e Crenças">
          <div className="anamnese-subsection">
            <h4>Percepção do Problema</h4>
            <DataField label="Como Percebe o Problema" value={preocupacoes_crencas?.como_percebe_problema} fieldPath="preocupacoes_crencas.como_percebe_problema" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Compreensão sobre Causa dos Sintomas" value={preocupacoes_crencas?.compreensao_sobre_causa_sintomas} fieldPath="preocupacoes_crencas.compreensao_sobre_causa_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Crenças e Preocupações</h4>
            <DataField label="Crenças Limitantes" value={preocupacoes_crencas?.crencas_limitantes} fieldPath="preocupacoes_crencas.crencas_limitantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Explícitas" value={preocupacoes_crencas?.preocupacoes_explicitas} fieldPath="preocupacoes_crencas.preocupacoes_explicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Implícitas" value={preocupacoes_crencas?.preocupacoes_implicitas} fieldPath="preocupacoes_crencas.preocupacoes_implicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ganhos Secundários" value={preocupacoes_crencas?.ganhos_secundarios} fieldPath="preocupacoes_crencas.ganhos_secundarios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Resistências Possíveis" value={preocupacoes_crencas?.resistencias_possiveis} fieldPath="preocupacoes_crencas.resistencias_possiveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Expectativas e Insight</h4>
            <DataField label="Condições Genéticas na Família" value={preocupacoes_crencas?.condicoes_geneticas_familia} fieldPath="preocupacoes_crencas.condicoes_geneticas_familia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativas Irrealistas" value={preocupacoes_crencas?.expectativas_irrealistas} fieldPath="preocupacoes_crencas.expectativas_irrealistas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Insight/Autoconsciência" value={preocupacoes_crencas?.nivel_insight_autoconsciencia} fieldPath="preocupacoes_crencas.nivel_insight_autoconsciencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abertura para Mudança" value={preocupacoes_crencas?.abertura_para_mudanca} fieldPath="preocupacoes_crencas.abertura_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Barreiras e Desafios</h4>
            <DataField label="Barreiras Percebidas ao Tratamento" value={preocupacoes_crencas?.barreiras_percebidas_tratamento} fieldPath="preocupacoes_crencas.barreiras_percebidas_tratamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aspectos do Plano que Parecem Desafiadores" value={preocupacoes_crencas?.aspectos_plano_parecem_desafiadores} fieldPath="preocupacoes_crencas.aspectos_plano_parecem_desafiadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>

      {/* Reino e Miasma */}
      <CollapsibleSection title="Reino e Miasma">
          <div className="anamnese-subsection">
            <h4>Reino Predominante</h4>
            <DataField label="Reino" value={reino_miasma?.reino_predominante} fieldPath="reino_miasma.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Características Identificadas" value={reino_miasma?.caracteristicas_identificadas} fieldPath="reino_miasma.caracteristicas_identificadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Análise Detalhada - Reino Animal</h4>
            <DataField label="Palavras Usadas" value={reino_miasma?.analise_detalhada_reino_animal_palavras_usadas} fieldPath="reino_miasma.analise_detalhada_reino_animal_palavras_usadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={reino_miasma?.analise_detalhada_reino_animal_descreve_sensacoes_como} fieldPath="reino_miasma.analise_detalhada_reino_animal_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Implicações Terapêuticas</h4>
            <DataField label="Comunicação" value={reino_miasma?.implicacoes_terapeuticas_comunicacao} fieldPath="reino_miasma.implicacoes_terapeuticas_comunicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abordagem" value={reino_miasma?.implicacoes_terapeuticas_abordagem} fieldPath="reino_miasma.implicacoes_terapeuticas_abordagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Outras Terapias Alinhadas" value={reino_miasma?.implicacoes_terapeuticas_outras_terapias_alinhadas} fieldPath="reino_miasma.implicacoes_terapeuticas_outras_terapias_alinhadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Comportamentais</h4>
            <DataField label="Maneira de Vestir" value={reino_miasma?.maneira_vestir} fieldPath="reino_miasma.maneira_vestir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Profissão Escolhida" value={reino_miasma?.tipo_profissao_escolhida} fieldPath="reino_miasma.tipo_profissao_escolhida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrão de Discurso" value={reino_miasma?.padrao_discurso} fieldPath="reino_miasma.padrao_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
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
      //console.log('🔍 Carregando dados de diagnóstico para consulta:', consultaId);
      const response = await fetch(`/api/diagnostico/${consultaId}`);
      //console.log('📡 Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        //console.log('✅ Dados de diagnóstico carregados:', data);
        setDiagnosticoData(data);
      } else {
        const errorData = await response.text();
      }
    } catch (error) {
      // Erro ao carregar dados
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
        await fetch('/api/ai-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            webhookUrl: 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-diagnostico',
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
    //console.log('🔍 DiagnosticoSection - Mostrando loading...');
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

  //console.log('🔍 DiagnosticoSection - dados recebidos:', diagnosticoData);
  //console.log('🔍 DiagnosticoSection - Renderizando componente com dados:', diagnosticoData);

  return (
    <div className="anamnese-sections">
      {/* ==================== DIAGNÓSTICO PRINCIPAL ==================== */}
      <CollapsibleSection title="1. Diagnóstico Principal" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>CID e Diagnósticos</h4>
          <DataField label="CID Principal." value={diagnostico_principal?.cid_principal} fieldPath="diagnostico_principal.cid_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnósticos Associados (CID)" value={diagnostico_principal?.diagnosticos_associados_cid} fieldPath="diagnostico_principal.diagnosticos_associados_cid" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Avaliação Diagnóstica Sistemática (ADS)</h4>
          <DataField label="Síntese" value={diagnostico_principal?.ads_sintese} fieldPath="diagnostico_principal.ads_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Biológico" value={diagnostico_principal?.ads_biologico} fieldPath="diagnostico_principal.ads_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico" value={diagnostico_principal?.ads_psicologico} fieldPath="diagnostico_principal.ads_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Emocional" value={diagnostico_principal?.ads_emocional} fieldPath="diagnostico_principal.ads_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={diagnostico_principal?.ads_social} fieldPath="diagnostico_principal.ads_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Espiritual" value={diagnostico_principal?.ads_espiritual} fieldPath="diagnostico_principal.ads_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Trilha Causal Sintética" value={diagnostico_principal?.ads_trilha_causal_sintetica} fieldPath="diagnostico_principal.ads_trilha_causal_sintetica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Síndrome" value={diagnostico_principal?.ads_tipo_sindrome} fieldPath="diagnostico_principal.ads_tipo_sindrome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Gravidade</h4>
          <DataField label="Nível de Gravidade" value={diagnostico_principal?.grav_nivel} fieldPath="diagnostico_principal.grav_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={diagnostico_principal?.grav_justificativa} fieldPath="diagnostico_principal.grav_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Janela de Intervenção" value={diagnostico_principal?.grav_janela_intervencao} fieldPath="diagnostico_principal.grav_janela_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Risco Iminente" value={diagnostico_principal?.grav_risco_iminente} fieldPath="diagnostico_principal.grav_risco_iminente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Homeopatia</h4>
          <DataField label="Reino Predominante" value={diagnostico_principal?.reino_predominante} fieldPath="diagnostico_principal.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Características do Reino" value={diagnostico_principal?.reino_caracteristicas} fieldPath="diagnostico_principal.reino_caracteristicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicamento Principal" value={diagnostico_principal?.homeo_medicamento_principal} fieldPath="diagnostico_principal.homeo_medicamento_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={diagnostico_principal?.homeo_justificativa} fieldPath="diagnostico_principal.homeo_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência Inicial" value={diagnostico_principal?.homeo_potencia_inicial} fieldPath="diagnostico_principal.homeo_potencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={diagnostico_principal?.homeo_frequencia} fieldPath="diagnostico_principal.homeo_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Medicamentos Complementares" value={diagnostico_principal?.medicamentos_complementares} fieldPath="diagnostico_principal.medicamentos_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Florais de Bach</h4>
          <DataField label="Florais Indicados" value={diagnostico_principal?.florais_bach_indicados} fieldPath="diagnostico_principal.florais_bach_indicados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fórmula Floral Sugerida" value={diagnostico_principal?.formula_floral_sugerida} fieldPath="diagnostico_principal.formula_floral_sugerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prognóstico</h4>
          <DataField label="Fatores Favoráveis" value={diagnostico_principal?.prognostico_fatores_favoraveis} fieldPath="diagnostico_principal.prognostico_fatores_favoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores Desfavoráveis" value={diagnostico_principal?.prognostico_fatores_desfavoraveis} fieldPath="diagnostico_principal.prognostico_fatores_desfavoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Adesão Total)" value={diagnostico_principal?.prob_sucesso_adesao_total} fieldPath="diagnostico_principal.prob_sucesso_adesao_total" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Adesão Parcial)" value={diagnostico_principal?.prob_sucesso_adesao_parcial} fieldPath="diagnostico_principal.prob_sucesso_adesao_parcial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Probabilidade de Sucesso (Sem Adesão)" value={diagnostico_principal?.prob_sucesso_sem_adesao} fieldPath="diagnostico_principal.prob_sucesso_sem_adesao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alertas</h4>
          <DataField label="Alertas Críticos" value={diagnostico_principal?.alertas_criticos} fieldPath="diagnostico_principal.alertas_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ESTADO GERAL ==================== */}
      <CollapsibleSection title="2. Estado Geral" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Avaliação Global</h4>
          <DataField label="Estado Geral" value={estado_geral?.avaliacao_estado} fieldPath="estado_geral.avaliacao_estado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score de Vitalidade" value={estado_geral?.avaliacao_score_vitalidade} fieldPath="estado_geral.avaliacao_score_vitalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tendência" value={estado_geral?.avaliacao_tendencia} fieldPath="estado_geral.avaliacao_tendencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reserva Fisiológica" value={estado_geral?.avaliacao_reserva_fisiologica} fieldPath="estado_geral.avaliacao_reserva_fisiologica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Energia Vital</h4>
          <DataField label="Nível" value={estado_geral?.energia_vital_nivel} fieldPath="estado_geral.energia_vital_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.energia_vital_descricao} fieldPath="estado_geral.energia_vital_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_geral?.energia_vital_manifestacao} fieldPath="estado_geral.energia_vital_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto" value={estado_geral?.energia_vital_impacto} fieldPath="estado_geral.energia_vital_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Adaptação ao Stress</h4>
          <DataField label="Nível" value={estado_geral?.adapt_stress_nivel} fieldPath="estado_geral.adapt_stress_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.adapt_stress_descricao} fieldPath="estado_geral.adapt_stress_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reserva Adaptativa" value={estado_geral?.adapt_stress_reserva_adaptativa} fieldPath="estado_geral.adapt_stress_reserva_adaptativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_geral?.adapt_stress_manifestacao} fieldPath="estado_geral.adapt_stress_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resiliência</h4>
          <DataField label="Nível" value={estado_geral?.resiliencia_nivel} fieldPath="estado_geral.resiliencia_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Descrição" value={estado_geral?.resiliencia_descricao} fieldPath="estado_geral.resiliencia_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Elasticidade" value={estado_geral?.resiliencia_elasticidade} fieldPath="estado_geral.resiliencia_elasticidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tempo de Recuperação" value={estado_geral?.resiliencia_tempo_recuperacao} fieldPath="estado_geral.resiliencia_tempo_recuperacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Observação Clínica</h4>
          <DataField label="Fácies" value={estado_geral?.obs_facies} fieldPath="estado_geral.obs_facies" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Postura" value={estado_geral?.obs_postura} fieldPath="estado_geral.obs_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Marcha" value={estado_geral?.obs_marcha} fieldPath="estado_geral.obs_marcha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tonus Muscular" value={estado_geral?.obs_tonus_muscular} fieldPath="estado_geral.obs_tonus_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Aparência Geral" value={estado_geral?.obs_aparencia_geral} fieldPath="estado_geral.obs_aparencia_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contato Visual" value={estado_geral?.obs_contato_visual} fieldPath="estado_geral.obs_contato_visual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Voz" value={estado_geral?.obs_voz} fieldPath="estado_geral.obs_voz" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Atividades de Vida Diária (AVD)</h4>
          <DataField label="Autocuidado Básico" value={estado_geral?.avd_autocuidado_basico} fieldPath="estado_geral.avd_autocuidado_basico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Trabalho Profissional" value={estado_geral?.avd_trabalho_profissional} fieldPath="estado_geral.avd_trabalho_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cuidado com Filhos" value={estado_geral?.avd_cuidado_filhos} fieldPath="estado_geral.avd_cuidado_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tarefas Domésticas" value={estado_geral?.avd_tarefas_domesticas} fieldPath="estado_geral.avd_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Lazer e Social" value={estado_geral?.avd_lazer_social} fieldPath="estado_geral.avd_lazer_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autocuidado Ampliado" value={estado_geral?.avd_autocuidado_ampliado} fieldPath="estado_geral.avd_autocuidado_ampliado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Funcionalidade e Qualidade de Vida</h4>
          <DataField label="Score Karnofsky" value={estado_geral?.funcionalidade_score_karnofsky} fieldPath="estado_geral.funcionalidade_score_karnofsky" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Limitações Funcionais Específicas" value={estado_geral?.limitacoes_funcionais_especificas} fieldPath="estado_geral.limitacoes_funcionais_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Score Geral" value={estado_geral?.whoqol_score_geral} fieldPath="estado_geral.whoqol_score_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Físico" value={estado_geral?.whoqol_fisico} fieldPath="estado_geral.whoqol_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Psicológico" value={estado_geral?.whoqol_psicologico} fieldPath="estado_geral.whoqol_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Social" value={estado_geral?.whoqol_social} fieldPath="estado_geral.whoqol_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Ambiental" value={estado_geral?.whoqol_ambiental} fieldPath="estado_geral.whoqol_ambiental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="WHOQOL Espiritual" value={estado_geral?.whoqol_espiritual} fieldPath="estado_geral.whoqol_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Satisfação com a Vida Global" value={estado_geral?.whoqol_satisfacao_vida_global} fieldPath="estado_geral.whoqol_satisfacao_vida_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sinais de Alerta e Evolução</h4>
          <DataField label="Sinais de Alerta de Deterioração" value={estado_geral?.sinais_alerta_deterioracao} fieldPath="estado_geral.sinais_alerta_deterioracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="10 Anos Atrás" value={estado_geral?.evo_10_anos_atras} fieldPath="estado_geral.evo_10_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="5 Anos Atrás" value={estado_geral?.evo_5_anos_atras} fieldPath="estado_geral.evo_5_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="3 Anos Atrás" value={estado_geral?.evo_3_anos_atras} fieldPath="estado_geral.evo_3_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="1 Ano Atrás" value={estado_geral?.evo_1_ano_atras} fieldPath="estado_geral.evo_1_ano_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Atual" value={estado_geral?.evo_atual} fieldPath="estado_geral.evo_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Projeção 6 Meses (Sem Intervenção)" value={estado_geral?.projecao_6_meses_sem_intervencao} fieldPath="estado_geral.projecao_6_meses_sem_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Impacto nos Diferentes Âmbitos</h4>
          <DataField label="Profissional" value={estado_geral?.impacto_profissional} fieldPath="estado_geral.impacto_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Familiar" value={estado_geral?.impacto_familiar} fieldPath="estado_geral.impacto_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={estado_geral?.impacto_social} fieldPath="estado_geral.impacto_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pessoal" value={estado_geral?.impacto_pessoal} fieldPath="estado_geral.impacto_pessoal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Saúde" value={estado_geral?.impacto_saude} fieldPath="estado_geral.impacto_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ====================ESTADO MENTAL ==================== */}
      <CollapsibleSection title="3. Estado Mental" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Memória</h4>
          <DataField label="Curto Prazo" value={estado_mental?.memoria_curto_prazo} fieldPath="estado_mental.memoria_curto_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Longo Prazo" value={estado_mental?.memoria_longo_prazo} fieldPath="estado_mental.memoria_longo_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="De Trabalho" value={estado_mental?.memoria_de_trabalho} fieldPath="estado_mental.memoria_de_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo de Falha" value={estado_mental?.memoria_tipo_falha} fieldPath="estado_mental.memoria_tipo_falha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto Funcional" value={estado_mental?.memoria_impacto_funcional} fieldPath="estado_mental.memoria_impacto_funcional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.memoria_score} fieldPath="estado_mental.memoria_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Atenção</h4>
          <DataField label="Sustentada" value={estado_mental?.atencao_sustentada} fieldPath="estado_mental.atencao_sustentada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Seletiva" value={estado_mental?.atencao_seletiva} fieldPath="estado_mental.atencao_seletiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alternada" value={estado_mental?.atencao_alternada} fieldPath="estado_mental.atencao_alternada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dividida" value={estado_mental?.atencao_dividida} fieldPath="estado_mental.atencao_dividida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestação" value={estado_mental?.atencao_manifestacao} fieldPath="estado_mental.atencao_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.atencao_score} fieldPath="estado_mental.atencao_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Funções Executivas</h4>
          <DataField label="Planejamento" value={estado_mental?.exec_planejamento} fieldPath="estado_mental.exec_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Organização" value={estado_mental?.exec_organizacao} fieldPath="estado_mental.exec_organizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Iniciativa" value={estado_mental?.exec_iniciativa} fieldPath="estado_mental.exec_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomada de Decisão" value={estado_mental?.exec_tomada_decisao} fieldPath="estado_mental.exec_tomada_decisao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Flexibilidade Cognitiva" value={estado_mental?.exec_flexibilidade_cognitiva} fieldPath="estado_mental.exec_flexibilidade_cognitiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle Inibitório" value={estado_mental?.exec_controle_inibitorio} fieldPath="estado_mental.exec_controle_inibitorio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={estado_mental?.exec_score} fieldPath="estado_mental.exec_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Outras Funções Cognitivas</h4>
          <DataField label="Velocidade de Processamento" value={estado_mental?.velocidade_processamento} fieldPath="estado_mental.velocidade_processamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Linguagem" value={estado_mental?.linguagem} fieldPath="estado_mental.linguagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Humor e Afeto</h4>
          <DataField label="Tipo de Humor" value={estado_mental?.humor_tipo} fieldPath="estado_mental.humor_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intensidade" value={estado_mental?.humor_intensidade} fieldPath="estado_mental.humor_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Variabilidade" value={estado_mental?.humor_variabilidade} fieldPath="estado_mental.humor_variabilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Reatividade" value={estado_mental?.humor_reatividade} fieldPath="estado_mental.humor_reatividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Padrão Diurno" value={estado_mental?.humor_diurno} fieldPath="estado_mental.humor_diurno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Expressão do Afeto" value={estado_mental?.afeto_expressao} fieldPath="estado_mental.afeto_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Congruência do Afeto" value={estado_mental?.afeto_congruencia} fieldPath="estado_mental.afeto_congruencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Modulação do Afeto" value={estado_mental?.afeto_modulacao} fieldPath="estado_mental.afeto_modulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ansiedade</h4>
          <DataField label="Nível" value={estado_mental?.ansiedade_nivel} fieldPath="estado_mental.ansiedade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo Predominante" value={estado_mental?.ansiedade_tipo_predominante} fieldPath="estado_mental.ansiedade_tipo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestações Físicas" value={estado_mental?.ansiedade_manifestacoes_fisicas} fieldPath="estado_mental.ansiedade_manifestacoes_fisicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Manifestações Cognitivas" value={estado_mental?.ansiedade_manifestacoes_cognitivas} fieldPath="estado_mental.ansiedade_manifestacoes_cognitivas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score GAD-7 Estimado" value={estado_mental?.ansiedade_score_gad7_estimado} fieldPath="estado_mental.ansiedade_score_gad7_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>PHQ-9 (Depressão)</h4>
          <DataField label="Humor Deprimido" value={estado_mental?.phq9_humor_deprimido} fieldPath="estado_mental.phq9_humor_deprimido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Anedonia" value={estado_mental?.phq9_anedonia} fieldPath="estado_mental.phq9_anedonia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alteração de Apetite" value={estado_mental?.phq9_alteracao_apetite} fieldPath="estado_mental.phq9_alteracao_apetite" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alteração de Sono" value={estado_mental?.phq9_alteracao_sono} fieldPath="estado_mental.phq9_alteracao_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fadiga" value={estado_mental?.phq9_fadiga} fieldPath="estado_mental.phq9_fadiga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Culpa/Inutilidade" value={estado_mental?.phq9_culpa_inutilidade} fieldPath="estado_mental.phq9_culpa_inutilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dificuldade de Concentração" value={estado_mental?.phq9_dificuldade_concentracao} fieldPath="estado_mental.phq9_dificuldade_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Agitação/Retardo" value={estado_mental?.phq9_agitacao_retardo} fieldPath="estado_mental.phq9_agitacao_retardo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pensamentos de Morte/Suicídio" value={estado_mental?.phq9_pensamentos_morte_suicidio} fieldPath="estado_mental.phq9_pensamentos_morte_suicidio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score PHQ-9 Estimado" value={estado_mental?.phq9_score_estimado} fieldPath="estado_mental.phq9_score_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Irritabilidade</h4>
          <DataField label="Nível" value={estado_mental?.irritabilidade_nivel} fieldPath="estado_mental.irritabilidade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={estado_mental?.irritabilidade_frequencia} fieldPath="estado_mental.irritabilidade_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Gatilhos" value={estado_mental?.irritabilidade_gatilhos} fieldPath="estado_mental.irritabilidade_gatilhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Expressão" value={estado_mental?.irritabilidade_expressao} fieldPath="estado_mental.irritabilidade_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle" value={estado_mental?.irritabilidade_controle} fieldPath="estado_mental.irritabilidade_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Autoestima e Autopercepção</h4>
          <DataField label="Autoestima Global" value={estado_mental?.autoestima_global} fieldPath="estado_mental.autoestima_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autopercepção" value={estado_mental?.autopercepcao} fieldPath="estado_mental.autopercepcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autoimagem Corporal" value={estado_mental?.autoimagem_corporal} fieldPath="estado_mental.autoimagem_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autoeficácia" value={estado_mental?.autoeficacia} fieldPath="estado_mental.autoeficacia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Autocompaixão" value={estado_mental?.autocompaixao} fieldPath="estado_mental.autocompaixao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pensamento</h4>
          <DataField label="Conteúdo Predominante" value={estado_mental?.pensamento_conteudo_predominante} fieldPath="estado_mental.pensamento_conteudo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Processo" value={estado_mental?.pensamento_processo} fieldPath="estado_mental.pensamento_processo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Velocidade" value={estado_mental?.pensamento_velocidade} fieldPath="estado_mental.pensamento_velocidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Distorções Cognitivas (Beck)" value={estado_mental?.distorcoes_cognitivas_beck} fieldPath="estado_mental.distorcoes_cognitivas_beck" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Regulação Emocional</h4>
          <DataField label="Estratégias Atuais" value={estado_mental?.reg_estrategias_atuais} fieldPath="estado_mental.reg_estrategias_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efetividade" value={estado_mental?.reg_efetividade} fieldPath="estado_mental.reg_efetividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Flexibilidade" value={estado_mental?.reg_flexibilidade} fieldPath="estado_mental.reg_flexibilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Motivação</h4>
          <DataField label="Nível Geral" value={estado_mental?.motiv_nivel_geral} fieldPath="estado_mental.motiv_nivel_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={estado_mental?.motiv_tipo} fieldPath="estado_mental.motiv_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Iniciativa" value={estado_mental?.motiv_iniciativa} fieldPath="estado_mental.motiv_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Persistência" value={estado_mental?.motiv_persistencia} fieldPath="estado_mental.motiv_persistencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Procrastinação" value={estado_mental?.motiv_procrastinacao} fieldPath="estado_mental.motiv_procrastinacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Perspectiva Temporal</h4>
          <DataField label="Passado" value={estado_mental?.tempo_passado} fieldPath="estado_mental.tempo_passado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Presente" value={estado_mental?.tempo_presente} fieldPath="estado_mental.tempo_presente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Futuro" value={estado_mental?.tempo_futuro} fieldPath="estado_mental.tempo_futuro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Risco de Suicídio</h4>
          <DataField label="Nível de Risco" value={estado_mental?.risco_nivel} fieldPath="estado_mental.risco_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ideação" value={estado_mental?.risco_ideacao} fieldPath="estado_mental.risco_ideacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intenção" value={estado_mental?.risco_intencao} fieldPath="estado_mental.risco_intencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Plano" value={estado_mental?.risco_plano} fieldPath="estado_mental.risco_plano" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Comportamento Recente" value={estado_mental?.risco_comportamento_recente} fieldPath="estado_mental.risco_comportamento_recente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tentativas Prévias" value={estado_mental?.risco_tentativas_previas} fieldPath="estado_mental.risco_tentativas_previas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Risco" value={estado_mental?.risco_fatores_risco} fieldPath="estado_mental.risco_fatores_risco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Proteção" value={estado_mental?.risco_fatores_protecao} fieldPath="estado_mental.risco_fatores_protecao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Requerida" value={estado_mental?.risco_acao_requerida} fieldPath="estado_mental.risco_acao_requerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Diagnósticos e Intervenções</h4>
          <DataField label="Diagnósticos Mentais DSM-5 Sugeridos" value={estado_mental?.diagnosticos_mentais_dsm5_sugeridos} fieldPath="estado_mental.diagnosticos_mentais_dsm5_sugeridos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção: Psicoterapia" value={estado_mental?.intervencao_psicoterapia} fieldPath="estado_mental.intervencao_psicoterapia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência Inicial" value={estado_mental?.intervencao_frequencia_inicial} fieldPath="estado_mental.intervencao_frequencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção: Psiquiatria" value={estado_mental?.intervencao_psiquiatria} fieldPath="estado_mental.intervencao_psiquiatria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Grupos de Apoio" value={estado_mental?.intervencao_grupos_apoio} fieldPath="estado_mental.intervencao_grupos_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Técnicas Complementares" value={estado_mental?.intervencao_tecnicas_complementares} fieldPath="estado_mental.intervencao_tecnicas_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ESTADO FISIOLÓGICO ==================== */}
      <CollapsibleSection title="4. Estado Fisiológico (Resumo - devido ao volume de campos)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Sistema Endócrino - Tireoide</h4>
          <DataField label="Status" value={estado_fisiologico?.end_tireo_status} fieldPath="estado_fisiologico.end_tireo_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.end_tireo_diagnostico} fieldPath="estado_fisiologico.end_tireo_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_tireo_acao_terapeutica} fieldPath="estado_fisiologico.end_tireo_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Endócrino - Insulina/Glicose</h4>
          <DataField label="Status" value={estado_fisiologico?.end_insgl_status} fieldPath="estado_fisiologico.end_insgl_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.end_insgl_diagnostico} fieldPath="estado_fisiologico.end_insgl_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_insgl_acao_terapeutica} fieldPath="estado_fisiologico.end_insgl_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Gastrointestinal - Intestino</h4>
          <DataField label="Status" value={estado_fisiologico?.gi_int_status} fieldPath="estado_fisiologico.gi_int_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Diagnóstico" value={estado_fisiologico?.gi_int_diagnostico} fieldPath="estado_fisiologico.gi_int_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação Prioritária" value={estado_fisiologico?.gi_int_acao_prioritaria} fieldPath="estado_fisiologico.gi_int_acao_prioritaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Sistema Cardiovascular</h4>
          <DataField label="Status" value={estado_fisiologico?.cv_status} fieldPath="estado_fisiologico.cv_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pressão Arterial" value={estado_fisiologico?.cv_pressao_arterial} fieldPath="estado_fisiologico.cv_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ação" value={estado_fisiologico?.cv_acao} fieldPath="estado_fisiologico.cv_acao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Inflamação e Estresse Oxidativo</h4>
          <DataField label="Nível de Inflamação Sistêmica" value={estado_fisiologico?.infl_sist_nivel} fieldPath="estado_fisiologico.infl_sist_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Causas" value={estado_fisiologico?.infl_sist_causas} fieldPath="estado_fisiologico.infl_sist_causas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível de Estresse Oxidativo" value={estado_fisiologico?.oxi_nivel} fieldPath="estado_fisiologico.oxi_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Exames Necessários</h4>
          <DataField label="Urgente (0-15 dias)" value={estado_fisiologico?.exames_urgente_0_15_dias} fieldPath="estado_fisiologico.exames_urgente_0_15_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alta Prioridade (30 dias)" value={estado_fisiologico?.exames_alta_prioridade_30_dias} fieldPath="estado_fisiologico.exames_alta_prioridade_30_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Média Prioridade (60-90 dias)" value={estado_fisiologico?.exames_media_prioridade_60_90_dias} fieldPath="estado_fisiologico.exames_media_prioridade_60_90_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== INTEGRAÇÃO DIAGNÓSTICA ==================== */}
      <CollapsibleSection title="5. Integração Diagnóstica" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Diagnóstico Integrado</h4>
          <DataField label="Título do Diagnóstico" value={integracao_diagnostica?.diagnostico_titulo} fieldPath="integracao_diagnostica.diagnostico_titulo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="CID Primário" value={integracao_diagnostica?.diagnostico_cid_primario} fieldPath="integracao_diagnostica.diagnostico_cid_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="CIDs Associados" value={integracao_diagnostica?.diagnostico_cids_associados} fieldPath="integracao_diagnostica.diagnostico_cids_associados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Síntese Executiva" value={integracao_diagnostica?.diagnostico_sintese_executiva} fieldPath="integracao_diagnostica.diagnostico_sintese_executiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Metáfora da Casa (Fundação, Colunas, Cumeeira)</h4>
          <DataField label="Fundação - Status" value={integracao_diagnostica?.fundacao_status} fieldPath="integracao_diagnostica.fundacao_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fundação - Eventos" value={integracao_diagnostica?.fundacao_eventos} fieldPath="integracao_diagnostica.fundacao_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Colunas - Status" value={integracao_diagnostica?.colunas_status} fieldPath="integracao_diagnostica.colunas_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cumeeira - Status" value={integracao_diagnostica?.cumeeira_status} fieldPath="integracao_diagnostica.cumeeira_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Colapso - Status" value={integracao_diagnostica?.colapso_status} fieldPath="integracao_diagnostica.colapso_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Diagnósticos Específicos</h4>
          <DataField label="Biológico Primário" value={integracao_diagnostica?.diagnostico_biologico_primario} fieldPath="integracao_diagnostica.diagnostico_biologico_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico DSM-5" value={integracao_diagnostica?.diagnostico_psicologico_dsm5} fieldPath="integracao_diagnostica.diagnostico_psicologico_dsm5" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicossomático - Interpretação" value={integracao_diagnostica?.diagnostico_psicossomatico_interpretacao} fieldPath="integracao_diagnostica.diagnostico_psicossomatico_interpretacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Biopsicossocial</h4>
          <DataField label="Biológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_biologico} fieldPath="integracao_diagnostica.diagnostico_biopsicossocial_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Psicológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_psicologico} fieldPath="integracao_diagnostica.diagnostico_biopsicossocial_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Social" value={integracao_diagnostica?.diagnostico_biopsicossocial_social} fieldPath="integracao_diagnostica.diagnostico_biopsicossocial_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Espiritual" value={integracao_diagnostica?.diagnostico_biopsicossocial_espiritual} fieldPath="integracao_diagnostica.diagnostico_biopsicossocial_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Conclusão" value={integracao_diagnostica?.diagnostico_biopsicossocial_conclusao} fieldPath="integracao_diagnostica.diagnostico_biopsicossocial_conclusao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Janela Terapêutica</h4>
          <DataField label="Status" value={integracao_diagnostica?.janela_terapeutica_status} fieldPath="integracao_diagnostica.janela_terapeutica_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tempo Crítico" value={integracao_diagnostica?.janela_terapeutica_tempo_critico} fieldPath="integracao_diagnostica.janela_terapeutica_tempo_critico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={integracao_diagnostica?.janela_terapeutica_urgencia} fieldPath="integracao_diagnostica.janela_terapeutica_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prognóstico</h4>
          <DataField label="Sem Intervenção - 3 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_3m} fieldPath="integracao_diagnostica.prognostico_sem_intervencao_3m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sem Intervenção - 12 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_12m} fieldPath="integracao_diagnostica.prognostico_sem_intervencao_12m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Com Intervenção - 1 mês" value={integracao_diagnostica?.prognostico_com_intervencao_1m} fieldPath="integracao_diagnostica.prognostico_com_intervencao_1m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Com Intervenção - 6 meses" value={integracao_diagnostica?.prognostico_com_intervencao_6m} fieldPath="integracao_diagnostica.prognostico_com_intervencao_6m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fatores de Sucesso" value={integracao_diagnostica?.prognostico_fatores_sucesso} fieldPath="integracao_diagnostica.prognostico_fatores_sucesso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Estratégia Terapêutica por Fases</h4>
          <DataField label="Fase 1 - Objetivo" value={integracao_diagnostica?.fase1_objetivo} fieldPath="integracao_diagnostica.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 1 - Ações Específicas" value={integracao_diagnostica?.fase1_acoes_especificas} fieldPath="integracao_diagnostica.fase1_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 2 - Objetivo" value={integracao_diagnostica?.fase2_objetivo} fieldPath="integracao_diagnostica.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 2 - Ações Específicas" value={integracao_diagnostica?.fase2_acoes_especificas} fieldPath="integracao_diagnostica.fase2_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 3 - Objetivo" value={integracao_diagnostica?.fase3_objetivo} fieldPath="integracao_diagnostica.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fase 4 - Objetivo" value={integracao_diagnostica?.fase4_objetivo} fieldPath="integracao_diagnostica.fase4_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Equipe Multiprofissional</h4>
          <DataField label="Core (Obrigatórios)" value={integracao_diagnostica?.equipe_core_obrigatorios} fieldPath="integracao_diagnostica.equipe_core_obrigatorios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte (Importantes)" value={integracao_diagnostica?.equipe_suporte_importantes} fieldPath="integracao_diagnostica.equipe_suporte_importantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Complementares" value={integracao_diagnostica?.equipe_complementares_potencializadores} fieldPath="integracao_diagnostica.equipe_complementares_potencializadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Observações Importantes</h4>
          <DataField label="Contradições e Paradoxos" value={integracao_diagnostica?.contradicoes_paradoxos} fieldPath="integracao_diagnostica.contradicoes_paradoxos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Principais Bloqueios para Cura" value={integracao_diagnostica?.principais_bloqueios_para_cura} fieldPath="integracao_diagnostica.principais_bloqueios_para_cura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Chaves Terapêuticas Prioritárias" value={integracao_diagnostica?.chaves_terapeuticas_prioritarias} fieldPath="integracao_diagnostica.chaves_terapeuticas_prioritarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alertas Críticos da Equipe" value={integracao_diagnostica?.alertas_equipe_criticos} fieldPath="integracao_diagnostica.alertas_equipe_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível de Confiança no Diagnóstico" value={integracao_diagnostica?.nivel_confianca_diagnostico} fieldPath="integracao_diagnostica.nivel_confianca_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== HÁBITOS DE VIDA ==================== */}
      <CollapsibleSection title="6. Hábitos de Vida (Resumo dos 5 Pilares)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Pilar 1 - Alimentação</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar1_alimentacao_status_global} fieldPath="habitos_vida.pilar1_alimentacao_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score de Qualidade" value={habitos_vida?.pilar1_alimentacao_score_qualidade} fieldPath="habitos_vida.pilar1_alimentacao_score_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Problemas Identificados" value={habitos_vida?.pilar1_alimentacao_problemas_identificados} fieldPath="habitos_vida.pilar1_alimentacao_problemas_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção Requerida" value={habitos_vida?.pilar1_intervencao_requerida_nutricional} fieldPath="habitos_vida.pilar1_intervencao_requerida_nutricional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 2 - Atividade Física</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar2_atividade_fisica_status_global} fieldPath="habitos_vida.pilar2_atividade_fisica_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar2_atividade_fisica_score} fieldPath="habitos_vida.pilar2_atividade_fisica_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Padrão de Prática" value={habitos_vida?.pilar2_padrao_pratica_exercicio} fieldPath="habitos_vida.pilar2_padrao_pratica_exercicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prescrição Fase 1" value={habitos_vida?.pilar2_prescricao_fase1_objetivo} fieldPath="habitos_vida.pilar2_prescricao_fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 3 - Sono</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar3_sono_status_global} fieldPath="habitos_vida.pilar3_sono_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar3_sono_score} fieldPath="habitos_vida.pilar3_sono_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Qualidade Subjetiva" value={habitos_vida?.pilar3_padrao_qualidade_subjetiva} fieldPath="habitos_vida.pilar3_padrao_qualidade_subjetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Intervenção Prioridade" value={habitos_vida?.pilar3_intervencao_prioridade} fieldPath="habitos_vida.pilar3_intervencao_prioridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 4 - Gestão de Stress</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar4_stress_status_global} fieldPath="habitos_vida.pilar4_stress_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar4_stress_score} fieldPath="habitos_vida.pilar4_stress_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Nível Atual" value={habitos_vida?.pilar4_stress_nivel_atual} fieldPath="habitos_vida.pilar4_stress_nivel_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fontes de Stress" value={habitos_vida?.pilar4_fontes_stress_profissional} fieldPath="habitos_vida.pilar4_fontes_stress_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Pilar 5 - Espiritualidade</h4>
          <DataField label="Status Global" value={habitos_vida?.pilar5_espiritualidade_status_global} fieldPath="habitos_vida.pilar5_espiritualidade_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Score" value={habitos_vida?.pilar5_espiritualidade_score} fieldPath="habitos_vida.pilar5_espiritualidade_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Práticas Atuais" value={habitos_vida?.pilar5_espiritualidade_praticas_atuais} fieldPath="habitos_vida.pilar5_espiritualidade_praticas_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ritmo Circadiano</h4>
          <DataField label="Status" value={habitos_vida?.ritmo_circadiano_status} fieldPath="habitos_vida.ritmo_circadiano_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Problemas" value={habitos_vida?.ritmo_circadiano_problemas} fieldPath="habitos_vida.ritmo_circadiano_problemas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Impacto" value={habitos_vida?.ritmo_circadiano_impacto} fieldPath="habitos_vida.ritmo_circadiano_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Resumo e Prioridades</h4>
          <DataField label="Score Geral de Hábitos de Vida" value={habitos_vida?.score_habitos_vida_geral} fieldPath="habitos_vida.score_habitos_vida_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prioridades de Intervenção" value={habitos_vida?.prioridades_intervencao_habitos} fieldPath="habitos_vida.prioridades_intervencao_habitos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
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
      const response = await fetch(`/api/solucao-ltb/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setLtbData(data.ltb_data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de LTB:', error);
    } finally {
      setLoadingDetails(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          <DataField label="Objetivo Principal" value={ltbData?.objetivo_principal} fieldPath="ltb_data.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urgência" value={ltbData?.urgencia} fieldPath="ltb_data.urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 1 - LIMPEZA PROFUNDA ==================== */}
      <CollapsibleSection title="2. Fase 1 - Limpeza Profunda (Hidrocolonterapia + Ozonioterapia)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 1</h4>
          <DataField label="Duração da Fase 1" value={ltbData?.fase1_duracao} fieldPath="ltb_data.fase1_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 1" value={ltbData?.fase1_objetivo} fieldPath="ltb_data.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Hidrocolonterapia</h4>
          <DataField label="Indicação" value={ltbData?.hidrocolonterapia_indicacao} fieldPath="ltb_data.hidrocolonterapia_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.hidrocolonterapia_sessoes} fieldPath="ltb_data.hidrocolonterapia_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.hidrocolonterapia_frequencia} fieldPath="ltb_data.hidrocolonterapia_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.hidrocolonterapia_protocolo} fieldPath="ltb_data.hidrocolonterapia_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Temperatura da Água" value={ltbData?.hidrocolonterapia_temperatura_agua} fieldPath="ltb_data.hidrocolonterapia_temperatura_agua" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Profissional" value={ltbData?.hidrocolonterapia_profissional} fieldPath="ltb_data.hidrocolonterapia_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Preparo no Dia" value={ltbData?.hidrocolonterapia_preparo_dia} fieldPath="ltb_data.hidrocolonterapia_preparo_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pós-Sessão" value={ltbData?.hidrocolonterapia_pos_sessao} fieldPath="ltb_data.hidrocolonterapia_pos_sessao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ozonioterapia Intestinal</h4>
          <DataField label="Indicação" value={ltbData?.ozonioterapia_intestinal_indicacao} fieldPath="ltb_data.ozonioterapia_intestinal_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.ozonioterapia_intestinal_sessoes} fieldPath="ltb_data.ozonioterapia_intestinal_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.ozonioterapia_intestinal_frequencia} fieldPath="ltb_data.ozonioterapia_intestinal_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Via de Administração" value={ltbData?.ozonioterapia_intestinal_via} fieldPath="ltb_data.ozonioterapia_intestinal_via" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Concentração" value={ltbData?.ozonioterapia_intestinal_concentracao} fieldPath="ltb_data.ozonioterapia_intestinal_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Sessão" value={ltbData?.ozonioterapia_intestinal_duracao_sessao} fieldPath="ltb_data.ozonioterapia_intestinal_duracao_sessao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios para o Caso" value={ltbData?.ozonioterapia_intestinal_beneficios_caso} fieldPath="ltb_data.ozonioterapia_intestinal_beneficios_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Combinar Com" value={ltbData?.ozonioterapia_intestinal_combinar} fieldPath="ltb_data.ozonioterapia_intestinal_combinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ozonioterapia Sistêmica</h4>
          <DataField label="Indicação" value={ltbData?.ozonioterapia_sistemica_indicacao} fieldPath="ltb_data.ozonioterapia_sistemica_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={ltbData?.ozonioterapia_sistemica_tipo} fieldPath="ltb_data.ozonioterapia_sistemica_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Número de Sessões" value={ltbData?.ozonioterapia_sistemica_sessoes} fieldPath="ltb_data.ozonioterapia_sistemica_sessoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Frequência" value={ltbData?.ozonioterapia_sistemica_frequencia} fieldPath="ltb_data.ozonioterapia_sistemica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.ozonioterapia_sistemica_protocolo} fieldPath="ltb_data.ozonioterapia_sistemica_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios para o Caso" value={ltbData?.ozonioterapia_sistemica_beneficios_caso} fieldPath="ltb_data.ozonioterapia_sistemica_beneficios_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Observação" value={ltbData?.ozonioterapia_sistemica_observacao} fieldPath="ltb_data.ozonioterapia_sistemica_observacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 2 - ANTIPARASITÁRIO ==================== */}
      <CollapsibleSection title="3. Fase 2 - Protocolo Antiparasitário" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 2</h4>
          <DataField label="Duração da Fase 2" value={ltbData?.fase2_duracao} fieldPath="ltb_data.fase2_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 2" value={ltbData?.fase2_objetivo} fieldPath="ltb_data.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo Escolhido" value={ltbData?.antiparasitario_protocolo_escolhido} fieldPath="ltb_data.antiparasitario_protocolo_escolhido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Trio Hulda Clark</h4>
          <DataField label="Composição" value={ltbData?.trio_hulda_clark_composicao} fieldPath="ltb_data.trio_hulda_clark_composicao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semana 1" value={ltbData?.trio_hulda_clark_posologia_semana_1} fieldPath="ltb_data.trio_hulda_clark_posologia_semana_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semana 2" value={ltbData?.trio_hulda_clark_posologia_semana_2} fieldPath="ltb_data.trio_hulda_clark_posologia_semana_2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semanas 3-6" value={ltbData?.trio_hulda_clark_posologia_semana_3_6} fieldPath="ltb_data.trio_hulda_clark_posologia_semana_3_6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia - Semanas 7-8" value={ltbData?.trio_hulda_clark_posologia_semana_7_8} fieldPath="ltb_data.trio_hulda_clark_posologia_semana_7_8" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Onde Comprar" value={ltbData?.trio_hulda_clark_onde_comprar} fieldPath="ltb_data.trio_hulda_clark_onde_comprar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Óleo de Orégano</h4>
          <DataField label="Tipo" value={ltbData?.oleo_oregano_tipo} fieldPath="ltb_data.oleo_oregano_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={ltbData?.oleo_oregano_posologia} fieldPath="ltb_data.oleo_oregano_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.oleo_oregano_duracao} fieldPath="ltb_data.oleo_oregano_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Marca Sugerida" value={ltbData?.oleo_oregano_marca_sugerida} fieldPath="ltb_data.oleo_oregano_marca_sugerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Suporte Hepático (Obrigatório)</h4>
          <DataField label="Justificativa" value={ltbData?.suporte_hepatico_obrigatorio_justificativa} fieldPath="ltb_data.suporte_hepatico_obrigatorio_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Protocolo" value={ltbData?.suporte_hepatico_obrigatorio_protocolo} fieldPath="ltb_data.suporte_hepatico_obrigatorio_protocolo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Antifúngico e Dieta Anticândida</h4>
          <DataField label="Indicação Antifúngico" value={ltbData?.antifungico_candida_indicacao} fieldPath="ltb_data.antifungico_candida_indicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.antifungico_candida_duracao} fieldPath="ltb_data.antifungico_candida_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dieta - Eliminar Totalmente" value={ltbData?.dieta_anticandida_eliminar_totalmente} fieldPath="ltb_data.dieta_anticandida_eliminar_totalmente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dieta - Focar Em" value={ltbData?.dieta_anticandida_focar} fieldPath="ltb_data.dieta_anticandida_focar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração do Rigor na Dieta" value={ltbData?.dieta_anticandida_duracao_rigor} fieldPath="ltb_data.dieta_anticandida_duracao_rigor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Antifúngicos Naturais" value={ltbData?.antifungicos_naturais_lista} fieldPath="ltb_data.antifungicos_naturais_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probiótico Especial na Fase 2</h4>
          <DataField label="Substância" value={ltbData?.probiotico_especial_substancia} fieldPath="ltb_data.probiotico_especial_substancia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={ltbData?.probiotico_especial_dose} fieldPath="ltb_data.probiotico_especial_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Justificativa" value={ltbData?.probiotico_especial_justificativa} fieldPath="ltb_data.probiotico_especial_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.probiotico_especial_duracao} fieldPath="ltb_data.probiotico_especial_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Reação de Herxheimer</h4>
          <DataField label="O que é" value={ltbData?.herxheimer_o_que_e} fieldPath="ltb_data.herxheimer_o_que_e" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sintomas Possíveis" value={ltbData?.herxheimer_sintomas_possiveis} fieldPath="ltb_data.herxheimer_sintomas_possiveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Ocorre" value={ltbData?.herxheimer_quando_ocorre} fieldPath="ltb_data.herxheimer_quando_ocorre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.herxheimer_duracao} fieldPath="ltb_data.herxheimer_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="É Bom ou Ruim?" value={ltbData?.herxheimer_e_bom_ou_ruim} fieldPath="ltb_data.herxheimer_e_bom_ou_ruim" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Minimizar" value={ltbData?.herxheimer_como_minimizar} fieldPath="ltb_data.herxheimer_como_minimizar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Parar" value={ltbData?.herxheimer_quando_parar} fieldPath="ltb_data.herxheimer_quando_parar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 3 - REPOPULAÇÃO INTESTINAL ==================== */}
      <CollapsibleSection title="4. Fase 3 - Repopulação Intestinal (Rotação de Probióticos)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 3</h4>
          <DataField label="Início da Fase 3" value={ltbData?.fase3_inicio} fieldPath="ltb_data.fase3_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Fase 3" value={ltbData?.fase3_duracao} fieldPath="ltb_data.fase3_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 3" value={ltbData?.fase3_objetivo} fieldPath="ltb_data.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estratégia de Rotação - Princípio" value={ltbData?.estrategia_rotacao_principio} fieldPath="ltb_data.estrategia_rotacao_principio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 1-2</h4>
          <DataField label="Tipo" value={ltbData?.probiotico_mes1_2_tipo} fieldPath="ltb_data.probiotico_mes1_2_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência" value={ltbData?.probiotico_mes1_2_potencia} fieldPath="ltb_data.probiotico_mes1_2_potencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Prioritárias" value={ltbData?.probiotico_mes1_2_cepas_prioritarias} fieldPath="ltb_data.probiotico_mes1_2_cepas_prioritarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Posologia" value={ltbData?.probiotico_mes1_2_posologia} fieldPath="ltb_data.probiotico_mes1_2_posologia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 3-4</h4>
          <DataField label="Foco" value={ltbData?.probiotico_mes3_4_foco} fieldPath="ltb_data.probiotico_mes3_4_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Específicas" value={ltbData?.probiotico_mes3_4_cepas_especificas} fieldPath="ltb_data.probiotico_mes3_4_cepas_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício para o Caso" value={ltbData?.probiotico_mes3_4_beneficio_caso} fieldPath="ltb_data.probiotico_mes3_4_beneficio_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Produto Exemplo" value={ltbData?.probiotico_mes3_4_produto_exemplo} fieldPath="ltb_data.probiotico_mes3_4_produto_exemplo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Meses 5-6</h4>
          <DataField label="Foco" value={ltbData?.probiotico_mes5_6_foco} fieldPath="ltb_data.probiotico_mes5_6_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas Específicas" value={ltbData?.probiotico_mes5_6_cepas_especificas} fieldPath="ltb_data.probiotico_mes5_6_cepas_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício para o Caso" value={ltbData?.probiotico_mes5_6_beneficio_caso} fieldPath="ltb_data.probiotico_mes5_6_beneficio_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Probióticos - Mês 7+ (Manutenção)</h4>
          <DataField label="Tipo" value={ltbData?.probiotico_mes7_manutencao_tipo} fieldPath="ltb_data.probiotico_mes7_manutencao_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dosagem" value={ltbData?.probiotico_mes7_manutencao_dosagem} fieldPath="ltb_data.probiotico_mes7_manutencao_dosagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={ltbData?.probiotico_mes7_manutencao_duracao} fieldPath="ltb_data.probiotico_mes7_manutencao_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Prebióticos</h4>
          <DataField label="Suplementos" value={ltbData?.prebioticos_suplementos} fieldPath="ltb_data.prebioticos_suplementos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alimentos" value={ltbData?.prebioticos_alimentos} fieldPath="ltb_data.prebioticos_alimentos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Posbióticos (Butirato)</h4>
          <DataField label="O que é" value={ltbData?.posbioticos_butirato_o_que_e} fieldPath="ltb_data.posbioticos_butirato_o_que_e" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplemento" value={ltbData?.posbioticos_butirato_suplemento} fieldPath="ltb_data.posbioticos_butirato_suplemento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={ltbData?.posbioticos_butirato_dose} fieldPath="ltb_data.posbioticos_butirato_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefícios" value={ltbData?.posbioticos_butirato_beneficios} fieldPath="ltb_data.posbioticos_butirato_beneficios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando Adicionar" value={ltbData?.posbioticos_butirato_quando_adicionar} fieldPath="ltb_data.posbioticos_butirato_quando_adicionar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 4 - REPARAÇÃO DA MUCOSA ==================== */}
      <CollapsibleSection title="5. Fase 4 - Reparação da Mucosa Intestinal" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 4</h4>
          <DataField label="Duração da Fase 4" value={ltbData?.fase4_duracao} fieldPath="ltb_data.fase4_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Objetivo da Fase 4" value={ltbData?.fase4_objetivo} fieldPath="ltb_data.fase4_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suplementos Essenciais para Reparação" value={ltbData?.reparacao_suplementos_essenciais} fieldPath="ltb_data.reparacao_suplementos_essenciais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 5 - DETOX HEPÁTICA ==================== */}
      <CollapsibleSection title="6. Fase 5 - Detox Hepática (Se Necessário)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Informações da Fase 5</h4>
          <DataField label="Urgência da Fase 5" value={ltbData?.fase5_urgencia} fieldPath="ltb_data.fase5_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração da Fase 5" value={ltbData?.fase5_duracao} fieldPath="ltb_data.fase5_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte Hepático Agressivo" value={ltbData?.suporte_hepatico_agressivo} fieldPath="ltb_data.suporte_hepatico_agressivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fitoterápicos Detox" value={ltbData?.fitoterapicos_detox} fieldPath="ltb_data.fitoterapicos_detox" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Monitoramento Hepático</h4>
          <DataField label="Exames de Controle" value={ltbData?.monitoramento_hepatico_exames_controle} fieldPath="ltb_data.monitoramento_hepatico_exames_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meta" value={ltbData?.monitoramento_hepatico_meta} fieldPath="ltb_data.monitoramento_hepatico_meta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== FASE 6 - QUELAÇÃO DE METAIS PESADOS ==================== */}
      <CollapsibleSection title="7. Fase 6 - Quelação de Metais Pesados (Se Detectado)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Condições e Protocolo</h4>
          <DataField label="Quando Aplicar" value={ltbData?.fase6_quando} fieldPath="ltb_data.fase6_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Se Positivo" value={ltbData?.fase6_se_positivo} fieldPath="ltb_data.fase6_se_positivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quelantes Naturais" value={ltbData?.quelantes_naturais} fieldPath="ltb_data.quelantes_naturais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Suporte Hídrico" value={ltbData?.suporte_hidrico} fieldPath="ltb_data.suporte_hidrico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Quelação Agressiva</h4>
          <DataField label="Quando Considerar" value={ltbData?.quelacao_agressiva_quando_considerar} fieldPath="ltb_data.quelacao_agressiva_quando_considerar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipos" value={ltbData?.quelacao_agressiva_tipos} fieldPath="ltb_data.quelacao_agressiva_tipos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Como Fazer" value={ltbData?.quelacao_agressiva_como} fieldPath="ltb_data.quelacao_agressiva_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Fazer Sozinha" value={ltbData?.quelacao_agressiva_nao_fazer_sozinha} fieldPath="ltb_data.quelacao_agressiva_nao_fazer_sozinha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CRONOGRAMA COMPLETO ==================== */}
      <CollapsibleSection title="8. Cronograma Completo (Resumo por Período)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Mês 1</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes1_foco} fieldPath="ltb_data.cronograma_mes1_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes1_acoes} fieldPath="ltb_data.cronograma_mes1_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Mês 2</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes2_foco} fieldPath="ltb_data.cronograma_mes2_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes2_acoes} fieldPath="ltb_data.cronograma_mes2_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 3-4</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes3_4_foco} fieldPath="ltb_data.cronograma_mes3_4_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes3_4_acoes} fieldPath="ltb_data.cronograma_mes3_4_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 5-6</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes5_6_foco} fieldPath="ltb_data.cronograma_mes5_6_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes5_6_acoes} fieldPath="ltb_data.cronograma_mes5_6_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Meses 7-12</h4>
          <DataField label="Foco" value={ltbData?.cronograma_mes7_12_foco} fieldPath="ltb_data.cronograma_mes7_12_foco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ações" value={ltbData?.cronograma_mes7_12_acoes} fieldPath="ltb_data.cronograma_mes7_12_acoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== OPÇÃO ECONÔMICA ==================== */}
      <CollapsibleSection title="9. Opção Econômica (Básica)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Alternativa Econômica</h4>
          <DataField label="Sem Terapias Específicas" value={ltbData?.opcao_basica_economica_sem_terapias} fieldPath="ltb_data.opcao_basica_economica_sem_terapias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Focar Em" value={ltbData?.opcao_basica_economica_focar} fieldPath="ltb_data.opcao_basica_economica_focar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Observação" value={ltbData?.opcao_basica_economica_observacao} fieldPath="ltb_data.opcao_basica_economica_observacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SINAIS DE SUCESSO ==================== */}
      <CollapsibleSection title="10. Sinais de Sucesso (Por Período)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Acompanhamento de Resultados</h4>
          <DataField label="Mês 1" value={ltbData?.sinais_sucesso_mes1} fieldPath="ltb_data.sinais_sucesso_mes1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 2" value={ltbData?.sinais_sucesso_mes2} fieldPath="ltb_data.sinais_sucesso_mes2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meses 3-4" value={ltbData?.sinais_sucesso_mes3_4} fieldPath="ltb_data.sinais_sucesso_mes3_4" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 6" value={ltbData?.sinais_sucesso_mes6} fieldPath="ltb_data.sinais_sucesso_mes6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 12" value={ltbData?.sinais_sucesso_mes12} fieldPath="ltb_data.sinais_sucesso_mes12" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALERTAS CRÍTICOS ==================== */}
      <CollapsibleSection title="11. Alertas Críticos de Segurança" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Avisos Importantes</h4>
          <DataField label="Alertas Críticos" value={ltbData?.alertas_criticos_seguranca} fieldPath="ltb_data.alertas_criticos_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
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
      const response = await fetch(`/api/solucao-mentalidade/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setMentalidadeData(data.mentalidade_data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Mentalidade:', error);
    } finally {
      setLoadingDetails(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  const [suplementacaoData, setSuplemementacaoData] = useState<any>(null);
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
      const response = await fetch(`/api/solucao-suplementacao/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setSuplemementacaoData(data.suplementacao_data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Suplementação:', error);
    } finally {
      setLoadingDetails(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          <h4>Objetivo e Realidade</h4>
          <DataField label="Objetivo Principal" value={suplementacaoData?.objetivo_principal} fieldPath="suplementacao_data.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Realidade" value={suplementacaoData?.realidade} fieldPath="suplementacao_data.realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Filosofia da Suplementação</h4>
          <DataField label="Realidade da Filosofia" value={suplementacaoData?.filosofia_suplementacao_realidade} fieldPath="suplementacao_data.filosofia_suplementacao_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Princípio" value={suplementacaoData?.filosofia_suplementacao_principio} fieldPath="suplementacao_data.filosofia_suplementacao_principio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ordem de Prioridade" value={suplementacaoData?.filosofia_suplementacao_ordem_prioridade} fieldPath="suplementacao_data.filosofia_suplementacao_ordem_prioridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.filosofia_suplementacao_duracao} fieldPath="suplementacao_data.filosofia_suplementacao_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ajustes" value={suplementacaoData?.filosofia_suplementacao_ajustes} fieldPath="suplementacao_data.filosofia_suplementacao_ajustes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== BASE ESSENCIAL - PARTE 1 ==================== */}
      <CollapsibleSection title="2. Base Essencial - Vitamina D3" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Vitamina D3 (Colecalciferol)</h4>
          <DataField label="Urgência" value={suplementacaoData?.vitamina_d3_colecalciferol_urgencia} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.vitamina_d3_colecalciferol_funcoes} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Inicial Agressiva" value={suplementacaoData?.vitamina_d3_colecalciferol_dose_inicial_agressiva} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_dose_inicial_agressiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose de Manutenção" value={suplementacaoData?.vitamina_d3_colecalciferol_dose_manutencao} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_dose_manutencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alvo Sanguíneo" value={suplementacaoData?.vitamina_d3_colecalciferol_alvo_sanguineo} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_alvo_sanguineo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.vitamina_d3_colecalciferol_forma} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar Com" value={suplementacaoData?.vitamina_d3_colecalciferol_tomar_com} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cofator Obrigatório" value={suplementacaoData?.vitamina_d3_colecalciferol_cofator_obrigatorio} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_cofator_obrigatorio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exame de Controle" value={suplementacaoData?.vitamina_d3_colecalciferol_exame_controle} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_exame_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Toxicidade" value={suplementacaoData?.vitamina_d3_colecalciferol_toxicidade} fieldPath="suplementacao_data.vitamina_d3_colecalciferol_toxicidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* Continuo organizando os campos em seções lógicas... */}
      
      <CollapsibleSection title="3. Base Essencial - Ômega 3" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Ômega 3 (EPA/DHA Alta Potência)</h4>
          <DataField label="Urgência" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_urgencia} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_funcoes} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Terapêutica" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_dose_terapeutica} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_dose_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Proporção Ideal" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_proporcao_ideal} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_proporcao_ideal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fonte" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_fonte} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_fonte" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Qualidade Essencial" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_qualidade_essencial} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_qualidade_essencial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_horario} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Conservação" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_conservacao} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_conservacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Testar Qualidade" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_testar_qualidade} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_testar_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_contraindicacao} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_contraindicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.omega_3_epa_dha_alta_potencia_duracao} fieldPath="suplementacao_data.omega_3_epa_dha_alta_potencia_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="4. Base Essencial - Magnésio" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Magnésio (Bisglicinato)</h4>
          <DataField label="Urgência" value={suplementacaoData?.magnesio_bisglicinato_urgencia} fieldPath="suplementacao_data.magnesio_bisglicinato_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.magnesio_bisglicinato_funcoes} fieldPath="suplementacao_data.magnesio_bisglicinato_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sinais de Deficiência no Caso" value={suplementacaoData?.magnesio_bisglicinato_deficiencia_sinais_caso} fieldPath="suplementacao_data.magnesio_bisglicinato_deficiencia_sinais_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.magnesio_bisglicinato_dose} fieldPath="suplementacao_data.magnesio_bisglicinato_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Formas (Melhores e Piores)" value={suplementacaoData?.magnesio_bisglicinato_formas_melhores_piores} fieldPath="suplementacao_data.magnesio_bisglicinato_formas_melhores_piores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma Escolhida para o Caso" value={suplementacaoData?.magnesio_bisglicinato_forma_escolhida_caso} fieldPath="suplementacao_data.magnesio_bisglicinato_forma_escolhida_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.magnesio_bisglicinato_horario} fieldPath="suplementacao_data.magnesio_bisglicinato_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Tomar Com" value={suplementacaoData?.magnesio_bisglicinato_nao_tomar_com} fieldPath="suplementacao_data.magnesio_bisglicinato_nao_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exame" value={suplementacaoData?.magnesio_bisglicinato_exame} fieldPath="suplementacao_data.magnesio_bisglicinato_exame" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.magnesio_bisglicinato_duracao} fieldPath="suplementacao_data.magnesio_bisglicinato_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Adicional para Sono (Magnésio + Glicina)" value={suplementacaoData?.magnesio_glicina_dose_sono} fieldPath="suplementacao_data.magnesio_glicina_dose_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="5. Base Essencial - Complexo B, Vitamina C e Zinco" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Complexo B (Formas Ativas)</h4>
          <DataField label="Urgência" value={suplementacaoData?.complexo_b_formas_ativas_urgencia} fieldPath="suplementacao_data.complexo_b_formas_ativas_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.complexo_b_formas_ativas_funcoes} fieldPath="suplementacao_data.complexo_b_formas_ativas_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Priorizar Formas Ativas" value={suplementacaoData?.complexo_b_formas_ativas_priorizar_formas_ativas} fieldPath="suplementacao_data.complexo_b_formas_ativas_priorizar_formas_ativas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Por Que Formas Ativas" value={suplementacaoData?.complexo_b_formas_ativas_porque_ativas} fieldPath="suplementacao_data.complexo_b_formas_ativas_porque_ativas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.complexo_b_formas_ativas_dose} fieldPath="suplementacao_data.complexo_b_formas_ativas_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="B12 Adicional" value={suplementacaoData?.complexo_b_formas_ativas_b12_adicional} fieldPath="suplementacao_data.complexo_b_formas_ativas_b12_adicional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.complexo_b_formas_ativas_horario} fieldPath="suplementacao_data.complexo_b_formas_ativas_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Urina Amarela (Normal)" value={suplementacaoData?.complexo_b_formas_ativas_urina_amarela} fieldPath="suplementacao_data.complexo_b_formas_ativas_urina_amarela" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.complexo_b_formas_ativas_duracao} fieldPath="suplementacao_data.complexo_b_formas_ativas_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="B5 (Ácido Pantotênico) Extra - Função" value={suplementacaoData?.b5_acido_pantotenico_extra_funcao} fieldPath="suplementacao_data.b5_acido_pantotenico_extra_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="B5 - Se Não Estiver no Complexo B" value={suplementacaoData?.b5_acido_pantotenico_extra_se_nao_no_complexo_b} fieldPath="suplementacao_data.b5_acido_pantotenico_extra_se_nao_no_complexo_b" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Vitamina C (Ácido Ascórbico)</h4>
          <DataField label="Urgência" value={suplementacaoData?.vitamina_c_acido_ascorbico_urgencia} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.vitamina_c_acido_ascorbico_funcoes} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Terapêutica" value={suplementacaoData?.vitamina_c_acido_ascorbico_dose_terapeutica} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_dose_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.vitamina_c_acido_ascorbico_forma} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.vitamina_c_acido_ascorbico_horario} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tolerância Intestinal" value={suplementacaoData?.vitamina_c_acido_ascorbico_tolerancia_intestinal} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_tolerancia_intestinal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.vitamina_c_acido_ascorbico_duracao} fieldPath="suplementacao_data.vitamina_c_acido_ascorbico_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Extra para Adrenal (Adicional)" value={suplementacaoData?.vitamina_c_dose_extra_adrenal_adicional} fieldPath="suplementacao_data.vitamina_c_dose_extra_adrenal_adicional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Total por Dia (Adrenal)" value={suplementacaoData?.vitamina_c_dose_extra_adrenal_total_dia} fieldPath="suplementacao_data.vitamina_c_dose_extra_adrenal_total_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Zinco (Bisglicinato)</h4>
          <DataField label="Urgência" value={suplementacaoData?.zinco_bisglicinato_urgencia} fieldPath="suplementacao_data.zinco_bisglicinato_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Funções" value={suplementacaoData?.zinco_bisglicinato_funcoes} fieldPath="suplementacao_data.zinco_bisglicinato_funcoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sinais de Deficiência no Caso" value={suplementacaoData?.zinco_bisglicinato_deficiencia_sinais_caso} fieldPath="suplementacao_data.zinco_bisglicinato_deficiencia_sinais_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Inicial" value={suplementacaoData?.zinco_bisglicinato_dose_inicial} fieldPath="suplementacao_data.zinco_bisglicinato_dose_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose de Manutenção" value={suplementacaoData?.zinco_bisglicinato_dose_manutencao} fieldPath="suplementacao_data.zinco_bisglicinato_dose_manutencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.zinco_bisglicinato_forma} fieldPath="suplementacao_data.zinco_bisglicinato_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar Com" value={suplementacaoData?.zinco_bisglicinato_tomar_com} fieldPath="suplementacao_data.zinco_bisglicinato_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Proporção Zinco:Cobre" value={suplementacaoData?.zinco_bisglicinato_proporcao_cobre} fieldPath="suplementacao_data.zinco_bisglicinato_proporcao_cobre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Tomar Com" value={suplementacaoData?.zinco_bisglicinato_nao_tomar_com} fieldPath="suplementacao_data.zinco_bisglicinato_nao_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exame" value={suplementacaoData?.zinco_bisglicinato_exame} fieldPath="suplementacao_data.zinco_bisglicinato_exame" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.zinco_bisglicinato_duracao} fieldPath="suplementacao_data.zinco_bisglicinato_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* Continua com mais seções devido ao grande número de campos... */}
      {/* Por brevidade, vou criar uma nota dizendo que há mais campos */}
      
      <CollapsibleSection title="6. Saúde Intestinal" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Probióticos (Rotação de Cepas)</h4>
          <DataField label="Ver Agente 1 (LTB)" value={suplementacaoData?.probioticos_rotacao_cepas_ver_agente_1} fieldPath="suplementacao_data.probioticos_rotacao_cepas_ver_agente_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estratégia" value={suplementacaoData?.probioticos_rotacao_cepas_estrategia} fieldPath="suplementacao_data.probioticos_rotacao_cepas_estrategia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Potência" value={suplementacaoData?.probioticos_rotacao_cepas_potencia} fieldPath="suplementacao_data.probioticos_rotacao_cepas_potencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cepas a Priorizar" value={suplementacaoData?.probioticos_rotacao_cepas_cepas_priorizar} fieldPath="suplementacao_data.probioticos_rotacao_cepas_cepas_priorizar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.probioticos_rotacao_cepas_horario} fieldPath="suplementacao_data.probioticos_rotacao_cepas_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Conservação" value={suplementacaoData?.probioticos_rotacao_cepas_conservacao} fieldPath="suplementacao_data.probioticos_rotacao_cepas_conservacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.probioticos_rotacao_cepas_duracao} fieldPath="suplementacao_data.probioticos_rotacao_cepas_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>L-Glutamina (Pó)</h4>
          <DataField label="Urgência" value={suplementacaoData?.l_glutamina_po_urgencia} fieldPath="suplementacao_data.l_glutamina_po_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Função" value={suplementacaoData?.l_glutamina_po_funcao} fieldPath="suplementacao_data.l_glutamina_po_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Alta para o Caso" value={suplementacaoData?.l_glutamina_po_dose_alta_caso} fieldPath="suplementacao_data.l_glutamina_po_dose_alta_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.l_glutamina_po_forma} fieldPath="suplementacao_data.l_glutamina_po_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dissolver Em" value={suplementacaoData?.l_glutamina_po_dissolver} fieldPath="suplementacao_data.l_glutamina_po_dissolver" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.l_glutamina_po_horario} fieldPath="suplementacao_data.l_glutamina_po_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sabor" value={suplementacaoData?.l_glutamina_po_sabor} fieldPath="suplementacao_data.l_glutamina_po_sabor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.l_glutamina_po_duracao} fieldPath="suplementacao_data.l_glutamina_po_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação" value={suplementacaoData?.l_glutamina_po_contraindicacao} fieldPath="suplementacao_data.l_glutamina_po_contraindicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Colágeno Hidrolisado (Peptídeos)</h4>
          <DataField label="Função" value={suplementacaoData?.colageno_hidrolisado_peptideos_funcao} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={suplementacaoData?.colageno_hidrolisado_peptideos_tipo} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.colageno_hidrolisado_peptideos_dose} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.colageno_hidrolisado_peptideos_horario} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sabor" value={suplementacaoData?.colageno_hidrolisado_peptideos_sabor} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_sabor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.colageno_hidrolisado_peptideos_duracao} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício Extra" value={suplementacaoData?.colageno_hidrolisado_peptideos_beneficio_extra} fieldPath="suplementacao_data.colageno_hidrolisado_peptideos_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Outros Suplementos Intestinais</h4>
          <DataField label="Curcumina + Piperina - Função" value={suplementacaoData?.curcumina_piperina_funcao} fieldPath="suplementacao_data.curcumina_piperina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Curcumina + Piperina - Dose" value={suplementacaoData?.curcumina_piperina_dose} fieldPath="suplementacao_data.curcumina_piperina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Curcumina + Piperina - Tomar Com" value={suplementacaoData?.curcumina_piperina_tomar_com} fieldPath="suplementacao_data.curcumina_piperina_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Curcumina + Piperina - Duração" value={suplementacaoData?.curcumina_piperina_duracao} fieldPath="suplementacao_data.curcumina_piperina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Zinco-Carnosina (PepZinGI) - Função" value={suplementacaoData?.zinco_carnosina_pepzingi_funcao} fieldPath="suplementacao_data.zinco_carnosina_pepzingi_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Zinco-Carnosina - Dose" value={suplementacaoData?.zinco_carnosina_pepzingi_dose} fieldPath="suplementacao_data.zinco_carnosina_pepzingi_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Zinco-Carnosina - Forma" value={suplementacaoData?.zinco_carnosina_pepzingi_forma} fieldPath="suplementacao_data.zinco_carnosina_pepzingi_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Zinco-Carnosina - Duração" value={suplementacaoData?.zinco_carnosina_pepzingi_duracao} fieldPath="suplementacao_data.zinco_carnosina_pepzingi_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Zinco-Carnosina - Benefício Extra" value={suplementacaoData?.zinco_carnosina_pepzingi_beneficio_extra} fieldPath="suplementacao_data.zinco_carnosina_pepzingi_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Prebióticos/Fibras - Tipos" value={suplementacaoData?.prebioticos_fibras_tipos} fieldPath="suplementacao_data.prebioticos_fibras_tipos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prebióticos - Horário" value={suplementacaoData?.prebioticos_fibras_horario} fieldPath="suplementacao_data.prebioticos_fibras_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prebióticos - Início Gradual" value={suplementacaoData?.prebioticos_fibras_inicio_gradual} fieldPath="suplementacao_data.prebioticos_fibras_inicio_gradual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          
          <DataField label="Enzimas Digestivas - Quando" value={suplementacaoData?.enzimas_digestivas_quando} fieldPath="suplementacao_data.enzimas_digestivas_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Enzimas - Composição" value={suplementacaoData?.enzimas_digestivas_composicao} fieldPath="suplementacao_data.enzimas_digestivas_composicao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Enzimas - Dose" value={suplementacaoData?.enzimas_digestivas_dose} fieldPath="suplementacao_data.enzimas_digestivas_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Enzimas - Duração" value={suplementacaoData?.enzimas_digestivas_duracao} fieldPath="suplementacao_data.enzimas_digestivas_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SAÚDE DA TIREOIDE ==================== */}
      <CollapsibleSection title="7. Suporte para Saúde da Tireoide" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Selênio (Selenometionina)</h4>
          <DataField label="Urgência" value={suplementacaoData?.selenio_selenometionina_urgencia} fieldPath="suplementacao_data.selenio_selenometionina_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Função" value={suplementacaoData?.selenio_selenometionina_funcao} fieldPath="suplementacao_data.selenio_selenometionina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estudos" value={suplementacaoData?.selenio_selenometionina_estudos} fieldPath="suplementacao_data.selenio_selenometionina_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.selenio_selenometionina_dose} fieldPath="suplementacao_data.selenio_selenometionina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.selenio_selenometionina_forma} fieldPath="suplementacao_data.selenio_selenometionina_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Prefiro" value={suplementacaoData?.selenio_selenometionina_prefiro} fieldPath="suplementacao_data.selenio_selenometionina_prefiro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Exceder" value={suplementacaoData?.selenio_selenometionina_nao_exceder} fieldPath="suplementacao_data.selenio_selenometionina_nao_exceder" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.selenio_selenometionina_duracao} fieldPath="suplementacao_data.selenio_selenometionina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Exame de Controle" value={suplementacaoData?.selenio_selenometionina_exame_controle} fieldPath="suplementacao_data.selenio_selenometionina_exame_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Iodo (Cauteloso)</h4>
          <DataField label="Controvérsia" value={suplementacaoData?.iodo_cauteloso_controversia} fieldPath="suplementacao_data.iodo_cauteloso_controversia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Realidade" value={suplementacaoData?.iodo_cauteloso_realidade} fieldPath="suplementacao_data.iodo_cauteloso_realidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Conduta para o Caso" value={suplementacaoData?.iodo_cauteloso_conduta_caso} fieldPath="suplementacao_data.iodo_cauteloso_conduta_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fonte Preferencial" value={suplementacaoData?.iodo_cauteloso_fonte_preferencial} fieldPath="suplementacao_data.iodo_cauteloso_fonte_preferencial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Monitorar" value={suplementacaoData?.iodo_cauteloso_monitorar} fieldPath="suplementacao_data.iodo_cauteloso_monitorar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Início" value={suplementacaoData?.iodo_cauteloso_inicio} fieldPath="suplementacao_data.iodo_cauteloso_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>L-Tirosina</h4>
          <DataField label="Função" value={suplementacaoData?.l_tirosina_funcao} fieldPath="suplementacao_data.l_tirosina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.l_tirosina_dose} fieldPath="suplementacao_data.l_tirosina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.l_tirosina_horario} fieldPath="suplementacao_data.l_tirosina_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício Extra" value={suplementacaoData?.l_tirosina_beneficio_extra} fieldPath="suplementacao_data.l_tirosina_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação" value={suplementacaoData?.l_tirosina_contraindicacao} fieldPath="suplementacao_data.l_tirosina_contraindicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.l_tirosina_duracao} fieldPath="suplementacao_data.l_tirosina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Vitamina A (Retinol)</h4>
          <DataField label="Função" value={suplementacaoData?.vitamina_a_retinol_funcao} fieldPath="suplementacao_data.vitamina_a_retinol_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.vitamina_a_retinol_dose} fieldPath="suplementacao_data.vitamina_a_retinol_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Fonte" value={suplementacaoData?.vitamina_a_retinol_fonte} fieldPath="suplementacao_data.vitamina_a_retinol_fonte" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Não Confundir" value={suplementacaoData?.vitamina_a_retinol_nao_confundir} fieldPath="suplementacao_data.vitamina_a_retinol_nao_confundir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Toxicidade" value={suplementacaoData?.vitamina_a_retinol_toxicidade} fieldPath="suplementacao_data.vitamina_a_retinol_toxicidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.vitamina_a_retinol_duracao} fieldPath="suplementacao_data.vitamina_a_retinol_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ferro (Se Baixo)</h4>
          <DataField label="Função" value={suplementacaoData?.ferro_se_baixo_funcao} fieldPath="suplementacao_data.ferro_se_baixo_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Primeiro: Exame" value={suplementacaoData?.ferro_se_baixo_primeiro_exame} fieldPath="suplementacao_data.ferro_se_baixo_primeiro_exame" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Se Baixo: Dose" value={suplementacaoData?.ferro_se_baixo_se_baixo_dose} fieldPath="suplementacao_data.ferro_se_baixo_se_baixo_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar Com" value={suplementacaoData?.ferro_se_baixo_tomar_com} fieldPath="suplementacao_data.ferro_se_baixo_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.ferro_se_baixo_horario} fieldPath="suplementacao_data.ferro_se_baixo_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efeito Colateral" value={suplementacaoData?.ferro_se_baixo_efeito_colateral} fieldPath="suplementacao_data.ferro_se_baixo_efeito_colateral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle" value={suplementacaoData?.ferro_se_baixo_controle} fieldPath="suplementacao_data.ferro_se_baixo_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.ferro_se_baixo_duracao} fieldPath="suplementacao_data.ferro_se_baixo_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SUPORTE ADRENAL ==================== */}
      <CollapsibleSection title="8. Suporte para Adrenais (Fadiga Adrenal)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Ashwagandha (KSM-66)</h4>
          <DataField label="Função" value={suplementacaoData?.ashwagandha_ksm66_funcao} fieldPath="suplementacao_data.ashwagandha_ksm66_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={suplementacaoData?.ashwagandha_ksm66_tipo} fieldPath="suplementacao_data.ashwagandha_ksm66_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.ashwagandha_ksm66_dose} fieldPath="suplementacao_data.ashwagandha_ksm66_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.ashwagandha_ksm66_horario} fieldPath="suplementacao_data.ashwagandha_ksm66_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício (Estudos)" value={suplementacaoData?.ashwagandha_ksm66_beneficio_estudos} fieldPath="suplementacao_data.ashwagandha_ksm66_beneficio_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação" value={suplementacaoData?.ashwagandha_ksm66_contraindicacao} fieldPath="suplementacao_data.ashwagandha_ksm66_contraindicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.ashwagandha_ksm66_duracao} fieldPath="suplementacao_data.ashwagandha_ksm66_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Rhodiola Rosea</h4>
          <DataField label="Função" value={suplementacaoData?.rhodiola_rosea_funcao} fieldPath="suplementacao_data.rhodiola_rosea_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={suplementacaoData?.rhodiola_rosea_tipo} fieldPath="suplementacao_data.rhodiola_rosea_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.rhodiola_rosea_dose} fieldPath="suplementacao_data.rhodiola_rosea_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.rhodiola_rosea_horario} fieldPath="suplementacao_data.rhodiola_rosea_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.rhodiola_rosea_beneficio} fieldPath="suplementacao_data.rhodiola_rosea_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.rhodiola_rosea_duracao} fieldPath="suplementacao_data.rhodiola_rosea_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Fosfatidilserina</h4>
          <DataField label="Função" value={suplementacaoData?.fosfatidilserina_funcao} fieldPath="suplementacao_data.fosfatidilserina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.fosfatidilserina_dose} fieldPath="suplementacao_data.fosfatidilserina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.fosfatidilserina_horario} fieldPath="suplementacao_data.fosfatidilserina_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estudos" value={suplementacaoData?.fosfatidilserina_estudos} fieldPath="suplementacao_data.fosfatidilserina_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.fosfatidilserina_duracao} fieldPath="suplementacao_data.fosfatidilserina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>DHEA (Se Muito Baixo)</h4>
          <DataField label="Primeiro: Exame" value={suplementacaoData?.dhea_se_muito_baixo_primeiro_exame} fieldPath="suplementacao_data.dhea_se_muito_baixo_primeiro_exame" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Se Muito Baixo" value={suplementacaoData?.dhea_se_muito_baixo_se_muito_baixo} fieldPath="suplementacao_data.dhea_se_muito_baixo_se_muito_baixo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Cuidado" value={suplementacaoData?.dhea_se_muito_baixo_cuidado} fieldPath="suplementacao_data.dhea_se_muito_baixo_cuidado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CONTROLE GLICÊMICO ==================== */}
      <CollapsibleSection title="9. Controle Glicêmico e Resistência Insulínica" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Berberina HCL</h4>
          <DataField label="Urgência" value={suplementacaoData?.berberina_hcl_urgencia} fieldPath="suplementacao_data.berberina_hcl_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Função" value={suplementacaoData?.berberina_hcl_funcao} fieldPath="suplementacao_data.berberina_hcl_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Eficaz" value={suplementacaoData?.berberina_hcl_dose_eficaz} fieldPath="suplementacao_data.berberina_hcl_dose_eficaz" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Início" value={suplementacaoData?.berberina_hcl_inicio} fieldPath="suplementacao_data.berberina_hcl_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício (Estudos)" value={suplementacaoData?.berberina_hcl_beneficio_estudos} fieldPath="suplementacao_data.berberina_hcl_beneficio_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efeito Colateral" value={suplementacaoData?.berberina_hcl_efeito_colateral} fieldPath="suplementacao_data.berberina_hcl_efeito_colateral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação" value={suplementacaoData?.berberina_hcl_contraindicacao} fieldPath="suplementacao_data.berberina_hcl_contraindicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.berberina_hcl_duracao} fieldPath="suplementacao_data.berberina_hcl_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ácido Alfa-Lipóico (ALA)</h4>
          <DataField label="Função" value={suplementacaoData?.acido_alfa_lipoico_ala_funcao} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.acido_alfa_lipoico_ala_dose} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.acido_alfa_lipoico_ala_forma} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.acido_alfa_lipoico_ala_horario} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.acido_alfa_lipoico_ala_beneficio} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.acido_alfa_lipoico_ala_duracao} fieldPath="suplementacao_data.acido_alfa_lipoico_ala_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Cromo Picolinato</h4>
          <DataField label="Função" value={suplementacaoData?.cromo_picolinato_funcao} fieldPath="suplementacao_data.cromo_picolinato_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.cromo_picolinato_dose} fieldPath="suplementacao_data.cromo_picolinato_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.cromo_picolinato_horario} fieldPath="suplementacao_data.cromo_picolinato_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.cromo_picolinato_beneficio} fieldPath="suplementacao_data.cromo_picolinato_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.cromo_picolinato_duracao} fieldPath="suplementacao_data.cromo_picolinato_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Canela Ceylon</h4>
          <DataField label="Função" value={suplementacaoData?.canela_ceylon_funcao} fieldPath="suplementacao_data.canela_ceylon_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tipo" value={suplementacaoData?.canela_ceylon_tipo} fieldPath="suplementacao_data.canela_ceylon_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.canela_ceylon_dose} fieldPath="suplementacao_data.canela_ceylon_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Usar" value={suplementacaoData?.canela_ceylon_usar} fieldPath="suplementacao_data.canela_ceylon_usar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.canela_ceylon_duracao} fieldPath="suplementacao_data.canela_ceylon_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Inositol (Mio ou D-Chiro)</h4>
          <DataField label="Função" value={suplementacaoData?.inositol_mio_ou_dci_funcao} fieldPath="suplementacao_data.inositol_mio_ou_dci_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.inositol_mio_ou_dci_dose} fieldPath="suplementacao_data.inositol_mio_ou_dci_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.inositol_mio_ou_dci_horario} fieldPath="suplementacao_data.inositol_mio_ou_dci_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício Extra" value={suplementacaoData?.inositol_mio_ou_dci_beneficio_extra} fieldPath="suplementacao_data.inositol_mio_ou_dci_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.inositol_mio_ou_dci_duracao} fieldPath="suplementacao_data.inositol_mio_ou_dci_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Gymnema Sylvestre</h4>
          <DataField label="Função" value={suplementacaoData?.gymnema_sylvestre_funcao} fieldPath="suplementacao_data.gymnema_sylvestre_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.gymnema_sylvestre_dose} fieldPath="suplementacao_data.gymnema_sylvestre_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar" value={suplementacaoData?.gymnema_sylvestre_tomar} fieldPath="suplementacao_data.gymnema_sylvestre_tomar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Efeito Curioso" value={suplementacaoData?.gymnema_sylvestre_efeito_curioso} fieldPath="suplementacao_data.gymnema_sylvestre_efeito_curioso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.gymnema_sylvestre_duracao} fieldPath="suplementacao_data.gymnema_sylvestre_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SAÚDE HEPÁTICA ==================== */}
      <CollapsibleSection title="10. Saúde Hepática (Detox e Proteção)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Silimarina (Cardo Mariano)</h4>
          <DataField label="Urgência" value={suplementacaoData?.silimarina_cardo_mariano_urgencia} fieldPath="suplementacao_data.silimarina_cardo_mariano_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Função" value={suplementacaoData?.silimarina_cardo_mariano_funcao} fieldPath="suplementacao_data.silimarina_cardo_mariano_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose Terapêutica" value={suplementacaoData?.silimarina_cardo_mariano_dose_terapeutica} fieldPath="suplementacao_data.silimarina_cardo_mariano_dose_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.silimarina_cardo_mariano_duracao} fieldPath="suplementacao_data.silimarina_cardo_mariano_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estudos" value={suplementacaoData?.silimarina_cardo_mariano_estudos} fieldPath="suplementacao_data.silimarina_cardo_mariano_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Custo/Mês" value={suplementacaoData?.silimarina_cardo_mariano_custo_mes} fieldPath="suplementacao_data.silimarina_cardo_mariano_custo_mes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Colina (Bitartrato ou CDP-Colina)</h4>
          <DataField label="Função" value={suplementacaoData?.colina_bitartrato_ou_cdp_colina_funcao} fieldPath="suplementacao_data.colina_bitartrato_ou_cdp_colina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.colina_bitartrato_ou_cdp_colina_dose} fieldPath="suplementacao_data.colina_bitartrato_ou_cdp_colina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Combinar Com" value={suplementacaoData?.colina_bitartrato_ou_cdp_colina_combinar_com} fieldPath="suplementacao_data.colina_bitartrato_ou_cdp_colina_combinar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.colina_bitartrato_ou_cdp_colina_beneficio} fieldPath="suplementacao_data.colina_bitartrato_ou_cdp_colina_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.colina_bitartrato_ou_cdp_colina_duracao} fieldPath="suplementacao_data.colina_bitartrato_ou_cdp_colina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>NAC (N-Acetilcisteína)</h4>
          <DataField label="Função" value={suplementacaoData?.nac_n_acetilcisteina_funcao} fieldPath="suplementacao_data.nac_n_acetilcisteina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.nac_n_acetilcisteina_dose} fieldPath="suplementacao_data.nac_n_acetilcisteina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.nac_n_acetilcisteina_horario} fieldPath="suplementacao_data.nac_n_acetilcisteina_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício Extra" value={suplementacaoData?.nac_n_acetilcisteina_beneficio_extra} fieldPath="suplementacao_data.nac_n_acetilcisteina_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.nac_n_acetilcisteina_duracao} fieldPath="suplementacao_data.nac_n_acetilcisteina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Alcachofra (Cynara)</h4>
          <DataField label="Função" value={suplementacaoData?.alcachofra_cynara_funcao} fieldPath="suplementacao_data.alcachofra_cynara_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.alcachofra_cynara_dose} fieldPath="suplementacao_data.alcachofra_cynara_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.alcachofra_cynara_duracao} fieldPath="suplementacao_data.alcachofra_cynara_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Taurina</h4>
          <DataField label="Função" value={suplementacaoData?.taurina_funcao} fieldPath="suplementacao_data.taurina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.taurina_dose} fieldPath="suplementacao_data.taurina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.taurina_duracao} fieldPath="suplementacao_data.taurina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SONO E RELAXAMENTO ==================== */}
      <CollapsibleSection title="11. Sono e Relaxamento" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>L-Triptofano ou 5-HTP</h4>
          <DataField label="Função" value={suplementacaoData?.l_triptofano_ou_5_htp_funcao} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Opção 1" value={suplementacaoData?.l_triptofano_ou_5_htp_opcao_1} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_opcao_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Opção 2" value={suplementacaoData?.l_triptofano_ou_5_htp_opcao_2} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_opcao_2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Escolher" value={suplementacaoData?.l_triptofano_ou_5_htp_escolher} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_escolher" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.l_triptofano_ou_5_htp_horario} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar Com" value={suplementacaoData?.l_triptofano_ou_5_htp_tomar_com} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Contraindicação Crítica" value={suplementacaoData?.l_triptofano_ou_5_htp_contraindicacao_critica} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_contraindicacao_critica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Solução para o Caso" value={suplementacaoData?.l_triptofano_ou_5_htp_solucao_caso} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_solucao_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Alternativa Segura" value={suplementacaoData?.l_triptofano_ou_5_htp_alternativa_segura} fieldPath="suplementacao_data.l_triptofano_ou_5_htp_alternativa_segura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Melatonina</h4>
          <DataField label="Função" value={suplementacaoData?.melatonina_funcao} fieldPath="suplementacao_data.melatonina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.melatonina_dose} fieldPath="suplementacao_data.melatonina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Início" value={suplementacaoData?.melatonina_inicio} fieldPath="suplementacao_data.melatonina_inicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.melatonina_forma} fieldPath="suplementacao_data.melatonina_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Segurança" value={suplementacaoData?.melatonina_seguranca} fieldPath="suplementacao_data.melatonina_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Despertar/Piora" value={suplementacaoData?.melatonina_despertar_piora} fieldPath="suplementacao_data.melatonina_despertar_piora" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.melatonina_duracao} fieldPath="suplementacao_data.melatonina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>L-Teanina</h4>
          <DataField label="Função" value={suplementacaoData?.l_teanina_funcao} fieldPath="suplementacao_data.l_teanina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.l_teanina_dose} fieldPath="suplementacao_data.l_teanina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.l_teanina_horario} fieldPath="suplementacao_data.l_teanina_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Combo" value={suplementacaoData?.l_teanina_combo} fieldPath="suplementacao_data.l_teanina_combo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.l_teanina_duracao} fieldPath="suplementacao_data.l_teanina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Glicina</h4>
          <DataField label="Função" value={suplementacaoData?.glicina_funcao} fieldPath="suplementacao_data.glicina_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.glicina_dose} fieldPath="suplementacao_data.glicina_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.glicina_forma} fieldPath="suplementacao_data.glicina_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estudos" value={suplementacaoData?.glicina_estudos} fieldPath="suplementacao_data.glicina_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.glicina_duracao} fieldPath="suplementacao_data.glicina_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Fitoterápicos para Sono</h4>
          <DataField label="Valeriana" value={suplementacaoData?.fitoterapicos_valeriana} fieldPath="suplementacao_data.fitoterapicos_valeriana" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Passiflora" value={suplementacaoData?.fitoterapicos_passiflora} fieldPath="suplementacao_data.fitoterapicos_passiflora" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Melissa" value={suplementacaoData?.fitoterapicos_melissa} fieldPath="suplementacao_data.fitoterapicos_melissa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Combinar" value={suplementacaoData?.fitoterapicos_combinar} fieldPath="suplementacao_data.fitoterapicos_combinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.fitoterapicos_duracao} fieldPath="suplementacao_data.fitoterapicos_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ENERGIA MITOCONDRIAL ==================== */}
      <CollapsibleSection title="12. Energia Mitocondrial" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Coenzima Q10 (Ubiquinol)</h4>
          <DataField label="Função" value={suplementacaoData?.coenzima_q10_ubiquinol_funcao} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.coenzima_q10_ubiquinol_forma} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.coenzima_q10_ubiquinol_dose} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tomar Com" value={suplementacaoData?.coenzima_q10_ubiquinol_tomar_com} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_tomar_com" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício Extra" value={suplementacaoData?.coenzima_q10_ubiquinol_beneficio_extra} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_beneficio_extra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estatinas Depletem" value={suplementacaoData?.coenzima_q10_ubiquinol_estatinas_depletem} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_estatinas_depletem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.coenzima_q10_ubiquinol_duracao} fieldPath="suplementacao_data.coenzima_q10_ubiquinol_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>PQQ (Pirroloquinolina Quinona)</h4>
          <DataField label="Função" value={suplementacaoData?.pqq_pirroloquinolina_quinona_funcao} fieldPath="suplementacao_data.pqq_pirroloquinolina_quinona_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.pqq_pirroloquinolina_quinona_dose} fieldPath="suplementacao_data.pqq_pirroloquinolina_quinona_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.pqq_pirroloquinolina_quinona_horario} fieldPath="suplementacao_data.pqq_pirroloquinolina_quinona_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Sinergia" value={suplementacaoData?.pqq_pirroloquinolina_quinona_sinergia} fieldPath="suplementacao_data.pqq_pirroloquinolina_quinona_sinergia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.pqq_pirroloquinolina_quinona_duracao} fieldPath="suplementacao_data.pqq_pirroloquinolina_quinona_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Acetil-L-Carnitina (ALCAR)</h4>
          <DataField label="Função" value={suplementacaoData?.acetil_l_carnitina_alcar_funcao} fieldPath="suplementacao_data.acetil_l_carnitina_alcar_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.acetil_l_carnitina_alcar_dose} fieldPath="suplementacao_data.acetil_l_carnitina_alcar_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.acetil_l_carnitina_alcar_horario} fieldPath="suplementacao_data.acetil_l_carnitina_alcar_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.acetil_l_carnitina_alcar_beneficio} fieldPath="suplementacao_data.acetil_l_carnitina_alcar_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.acetil_l_carnitina_alcar_duracao} fieldPath="suplementacao_data.acetil_l_carnitina_alcar_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>D-Ribose</h4>
          <DataField label="Função" value={suplementacaoData?.d_ribose_funcao} fieldPath="suplementacao_data.d_ribose_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.d_ribose_dose} fieldPath="suplementacao_data.d_ribose_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Forma" value={suplementacaoData?.d_ribose_forma} fieldPath="suplementacao_data.d_ribose_forma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quando" value={suplementacaoData?.d_ribose_quando} fieldPath="suplementacao_data.d_ribose_quando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== EMAGRECIMENTO ==================== */}
      <CollapsibleSection title="13. Suporte para Emagrecimento (Opcional)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>CLA (Ácido Linoleico Conjugado)</h4>
          <DataField label="Função" value={suplementacaoData?.cla_acido_linoleico_conjugado_funcao} fieldPath="suplementacao_data.cla_acido_linoleico_conjugado_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.cla_acido_linoleico_conjugado_dose} fieldPath="suplementacao_data.cla_acido_linoleico_conjugado_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estudos" value={suplementacaoData?.cla_acido_linoleico_conjugado_estudos} fieldPath="suplementacao_data.cla_acido_linoleico_conjugado_estudos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.cla_acido_linoleico_conjugado_duracao} fieldPath="suplementacao_data.cla_acido_linoleico_conjugado_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Chá Verde (EGCG)</h4>
          <DataField label="Função" value={suplementacaoData?.cha_verde_egcg_funcao} fieldPath="suplementacao_data.cha_verde_egcg_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.cha_verde_egcg_dose} fieldPath="suplementacao_data.cha_verde_egcg_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário" value={suplementacaoData?.cha_verde_egcg_horario} fieldPath="suplementacao_data.cha_verde_egcg_horario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Benefício" value={suplementacaoData?.cha_verde_egcg_beneficio} fieldPath="suplementacao_data.cha_verde_egcg_beneficio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Café Verde</h4>
          <DataField label="Função" value={suplementacaoData?.cafe_verde_funcao} fieldPath="suplementacao_data.cafe_verde_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.cafe_verde_dose} fieldPath="suplementacao_data.cafe_verde_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Duração" value={suplementacaoData?.cafe_verde_duracao} fieldPath="suplementacao_data.cafe_verde_duracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>L-Carnitina Tartrato</h4>
          <DataField label="Função" value={suplementacaoData?.l_carnitina_tartrato_funcao} fieldPath="suplementacao_data.l_carnitina_tartrato_funcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Dose" value={suplementacaoData?.l_carnitina_tartrato_dose} fieldPath="suplementacao_data.l_carnitina_tartrato_dose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Eficácia" value={suplementacaoData?.l_carnitina_tartrato_eficacia} fieldPath="suplementacao_data.l_carnitina_tartrato_eficacia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== CRONOGRAMA E EXAMES ==================== */}
      <CollapsibleSection title="Cronograma por Período e Horários" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Cronograma por Mês</h4>
          <DataField label="Mês 1-2: Base Essencial Obrigatório - Lista" value={suplementacaoData?.mes_1_2_base_essencial_obrigatorio_lista} fieldPath="suplementacao_data.mes_1_2_base_essencial_obrigatorio_lista" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 1-2: Não Negociável" value={suplementacaoData?.mes_1_2_base_essencial_obrigatorio_nao_negociavel} fieldPath="suplementacao_data.mes_1_2_base_essencial_obrigatorio_nao_negociavel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 3-6: Expandido Importante - Adicionar" value={suplementacaoData?.mes_3_6_expandido_importante_adicionar} fieldPath="suplementacao_data.mes_3_6_expandido_importante_adicionar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Mês 7-12: Otimização Opcional - Adicionar se Orçamento" value={suplementacaoData?.mes_7_12_otimizacao_opcional_adicionar_se_orcamento} fieldPath="suplementacao_data.mes_7_12_otimizacao_opcional_adicionar_se_orcamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Horários Sugeridos</h4>
          <DataField label="Jejum ao Acordar" value={suplementacaoData?.jejum_ao_acordar} fieldPath="suplementacao_data.jejum_ao_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Café da Manhã (com comida/gordura)" value={suplementacaoData?.cafe_manha_com_comida_gordura} fieldPath="suplementacao_data.cafe_manha_com_comida_gordura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Almoço (com comida)" value={suplementacaoData?.almoco_com_comida} fieldPath="suplementacao_data.almoco_com_comida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meio da Tarde" value={suplementacaoData?.meio_tarde} fieldPath="suplementacao_data.meio_tarde" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Jantar (com comida)" value={suplementacaoData?.jantar_com_comida} fieldPath="suplementacao_data.jantar_com_comida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="1 Hora Antes de Dormir" value={suplementacaoData?.uma_hora_antes_dormir} fieldPath="suplementacao_data.uma_hora_antes_dormir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="30 Min Antes de Dormir" value={suplementacaoData?.trinta_min_antes_dormir} fieldPath="suplementacao_data.trinta_min_antes_dormir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Qualquer Hora (estômago vazio)" value={suplementacaoData?.qualquer_hora_estomago_vazio} fieldPath="suplementacao_data.qualquer_hora_estomago_vazio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Exames de Controle</h4>
          <DataField label="Basal (Mês 1)" value={suplementacaoData?.basal_mes_1} fieldPath="suplementacao_data.basal_mes_1" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle (Mês 3)" value={suplementacaoData?.controle_mes_3} fieldPath="suplementacao_data.controle_mes_3" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle (Mês 6)" value={suplementacaoData?.controle_mes_6} fieldPath="suplementacao_data.controle_mes_6" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Controle (Mês 12)" value={suplementacaoData?.controle_mes_12} fieldPath="suplementacao_data.controle_mes_12" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ajustar Doses" value={suplementacaoData?.ajustar_doses} fieldPath="suplementacao_data.ajustar_doses" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALERTAS CRÍTICOS ==================== */}
      <CollapsibleSection title="Alertas Críticos de Segurança" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Avisos Importantes</h4>
          <DataField label="Alertas Críticos de Segurança" value={suplementacaoData?.alertas_criticos_seguranca} fieldPath="suplementacao_data.alertas_criticos_seguranca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
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
      const response = await fetch(`/api/alimentacao/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setAlimentacaoData(data.alimentacao_data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Alimentação:', error);
    } finally {
      setLoadingDetails(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    if (!alimentacaoData) return [];
    
    // Usar os dados organizados pela API
    return alimentacaoData[refeicaoKey] || [];
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
      const response = await fetch(`/api/solucao-habitos-vida/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setHabitosVidaData(data.habitos_vida_data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de Hábitos de Vida:', error);
    } finally {
      setLoadingDetails(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      <CollapsibleSection title="1. Objetivo e Realidade Atual" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Contexto</h4>
          <DataField label="Objetivo Principal" value={habitosVidaData?.objetivo_principal} fieldPath="habitos_vida_data.objetivo_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Realidade Atual (Brutal)" value={habitosVidaData?.realidade_atual_brutal} fieldPath="habitos_vida_data.realidade_atual_brutal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== SONO ==================== */}
      <CollapsibleSection title="2. Sono (Protocolo Detalhado)" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Referências e Contexto</h4>
          <DataField label="Ver Agente 2 (Mentalidade)" value={habitosVidaData?.sono_ver_agente_2} fieldPath="habitos_vida_data.sono_ver_agente_2" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Adicionar Aqui" value={habitosVidaData?.sono_adicionar_aqui} fieldPath="habitos_vida_data.sono_adicionar_aqui" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Realidade do Caso" value={habitosVidaData?.sono_realidade_caso} fieldPath="habitos_vida_data.sono_realidade_caso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Meta Inquebrantável" value={habitosVidaData?.sono_meta_inquebrantavel} fieldPath="habitos_vida_data.sono_meta_inquebrantavel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Higiene do Sono - Horário Fixo</h4>
          <DataField label="Regra" value={habitosVidaData?.sono_higiene_horario_fixo_regra} fieldPath="habitos_vida_data.sono_higiene_horario_fixo_regra" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Horário de Acordar" value={habitosVidaData?.sono_higiene_horario_fixo_acordar} fieldPath="habitos_vida_data.sono_higiene_horario_fixo_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Consistência" value={habitosVidaData?.sono_higiene_horario_fixo_consistencia} fieldPath="habitos_vida_data.sono_higiene_horario_fixo_consistencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Despertador" value={habitosVidaData?.sono_higiene_horario_fixo_despertador} fieldPath="habitos_vida_data.sono_higiene_horario_fixo_despertador" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Finais de Semana" value={habitosVidaData?.sono_higiene_horario_fixo_finais_semana} fieldPath="habitos_vida_data.sono_higiene_horario_fixo_finais_semana" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Ambiente do Sono</h4>
          <DataField label="Escuridão Total" value={habitosVidaData?.sono_ambiente_escuridao_total} fieldPath="habitos_vida_data.sono_ambiente_escuridao_total" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Temperatura Fresca" value={habitosVidaData?.sono_ambiente_temperatura_fresca} fieldPath="habitos_vida_data.sono_ambiente_temperatura_fresca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Silêncio ou Ruído Branco" value={habitosVidaData?.sono_ambiente_silencio_ou_ruido_branco} fieldPath="habitos_vida_data.sono_ambiente_silencio_ou_ruido_branco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Colchão e Travesseiro Adequados" value={habitosVidaData?.sono_ambiente_colchao_travesseiro_adequados} fieldPath="habitos_vida_data.sono_ambiente_colchao_travesseiro_adequados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Quarto Exclusivo para Sono/Sexo" value={habitosVidaData?.sono_ambiente_quarto_exclusivo_sono_sexo} fieldPath="habitos_vida_data.sono_ambiente_quarto_exclusivo_sono_sexo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Rotina Pré-Sono</h4>
          <DataField label="Timeline da Rotina" value={habitosVidaData?.sono_rotina_pre_sono_timeline} fieldPath="habitos_vida_data.sono_rotina_pre_sono_timeline" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Ritual de Relaxamento - Atividades" value={habitosVidaData?.sono_ritual_relaxamento_atividades} fieldPath="habitos_vida_data.sono_ritual_relaxamento_atividades" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Desligar Telas (2h Antes)</h4>
          <DataField label="Horário Limite" value={habitosVidaData?.sono_desligar_telas_2h_horario_limite} fieldPath="habitos_vida_data.sono_desligar_telas_2h_horario_limite" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Por Quê" value={habitosVidaData?.sono_desligar_telas_2h_porque} fieldPath="habitos_vida_data.sono_desligar_telas_2h_porque" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Estratégias" value={habitosVidaData?.sono_desligar_telas_2h_estrategias} fieldPath="habitos_vida_data.sono_desligar_telas_2h_estrategias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>O Que Evitar</h4>
          <DataField label="Evitar Cafeína" value={habitosVidaData?.sono_evitar_cafeina} fieldPath="habitos_vida_data.sono_evitar_cafeina" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Evitar Álcool" value={habitosVidaData?.sono_evitar_alcool} fieldPath="habitos_vida_data.sono_evitar_alcool" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Evitar Refeição Pesada" value={habitosVidaData?.sono_evitar_refeicao_pesada} fieldPath="habitos_vida_data.sono_evitar_refeicao_pesada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Evitar Exercício Intenso" value={habitosVidaData?.sono_evitar_exercicio_intenso} fieldPath="habitos_vida_data.sono_evitar_exercicio_intenso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Evitar Líquidos em Excesso" value={habitosVidaData?.sono_evitar_liquidos_excesso} fieldPath="habitos_vida_data.sono_evitar_liquidos_excesso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Exposição à Luz</h4>
          <DataField label="Manhã" value={habitosVidaData?.sono_exposicao_luz_manha} fieldPath="habitos_vida_data.sono_exposicao_luz_manha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Durante o Dia" value={habitosVidaData?.sono_exposicao_luz_dia} fieldPath="habitos_vida_data.sono_exposicao_luz_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Tarde" value={habitosVidaData?.sono_exposicao_luz_tarde} fieldPath="habitos_vida_data.sono_exposicao_luz_tarde" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Noite" value={habitosVidaData?.sono_exposicao_luz_noite} fieldPath="habitos_vida_data.sono_exposicao_luz_noite" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>

        <div className="anamnese-subsection">
          <h4>Investigações e Estratégias</h4>
          <DataField label="Investigar Apneia" value={habitosVidaData?.sono_investigar_apneia} fieldPath="habitos_vida_data.sono_investigar_apneia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Investigar Pernas Inquietas" value={habitosVidaData?.sono_investigar_pernas_inquietas} fieldPath="habitos_vida_data.sono_investigar_pernas_inquietas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Se Não Dormir em 30 Min" value={habitosVidaData?.sono_se_nao_dorme_30min} fieldPath="habitos_vida_data.sono_se_nao_dorme_30min" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ALIMENTAÇÃO ==================== */}
      <CollapsibleSection title="3. Alimentação (Aplicação Prática)" defaultOpen={false}>
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
      <CollapsibleSection title="4. Movimento e Atividade Física" defaultOpen={false}>
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
      <CollapsibleSection title="5. Espiritualidade e Conexão com a Natureza" defaultOpen={false}>
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
      <CollapsibleSection title="6. Conexões Sociais e Relações" defaultOpen={false}>
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
      <CollapsibleSection title="7. Propósito e Sentido de Vida" defaultOpen={false}>
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
      <CollapsibleSection title="8. Gestão de Tempo e Produtividade" defaultOpen={false}>
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
      <CollapsibleSection title="9. Gestão de Estresse" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Identificação e Técnicas</h4>
          <DataField label="Identificar Estressores" value={habitosVidaData?.estresse_identificar_estressores} fieldPath="habitos_vida_data.estresse_identificar_estressores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Técnicas no Momento" value={habitosVidaData?.estresse_tecnicas_momento} fieldPath="habitos_vida_data.estresse_tecnicas_momento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Válvulas de Escape Saudáveis" value={habitosVidaData?.estresse_valvulas_escape_saudaveis} fieldPath="habitos_vida_data.estresse_valvulas_escape_saudaveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== ROTINAS E HÁBITOS ==================== */}
      <CollapsibleSection title="10. Rotinas e Hábitos Estruturantes" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Rotinas Diárias</h4>
          <DataField label="Rotina Matinal (Power Hour)" value={habitosVidaData?.habitos_matinal_power_hour} fieldPath="habitos_vida_data.habitos_matinal_power_hour" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Rotina Noturna (Wind Down)" value={habitosVidaData?.habitos_noturno_wind_down} fieldPath="habitos_vida_data.habitos_noturno_wind_down" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Pausas Conscientes" value={habitosVidaData?.habitos_pausas_conscientes} fieldPath="habitos_vida_data.habitos_pausas_conscientes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Revisões Regulares" value={habitosVidaData?.habitos_revisoes_regulares} fieldPath="habitos_vida_data.habitos_revisoes_regulares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== TECNOLOGIA ==================== */}
      <CollapsibleSection title="11. Uso Consciente de Tecnologia" defaultOpen={false}>
        <div className="anamnese-subsection">
          <h4>Regras de Uso</h4>
          <DataField label="Celular - Regras" value={habitosVidaData?.tecnologia_celular_regras} fieldPath="habitos_vida_data.tecnologia_celular_regras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          <DataField label="Computador de Trabalho" value={habitosVidaData?.tecnologia_computador_trabalho} fieldPath="habitos_vida_data.tecnologia_computador_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
        </div>
      </CollapsibleSection>

      {/* ==================== MONITORAMENTO E MINDSET ==================== */}
      <CollapsibleSection title="12. Monitoramento e Mindset" defaultOpen={false}>
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
      
      const webhookUrl = (isSolucaoLTB || isSolucaoMentalidade || isSolucaoSuplemementacao || isSolucaoHabitosVida)
        ? 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao'
        : isDiagnostico 
        ? 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-diagnostico'
        : 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-anamnese';
      
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-solucao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/diagnostico-principal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-trigger-solucao', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-solucao-criacao-entregaveis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
                parent.innerHTML = '';
                parent.className = 'avatar-placeholder';
                parent.style.backgroundColor = colors[colorIndex];
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
        style={{ backgroundColor: colors[colorIndex] }}
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

    // STATUS = VALIDATION
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
                  <CollapsibleSection title="📋 Anamnese (Consulta)" defaultOpen={false}>
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

    // Se for um modal (não ANAMNESE, não DIAGNOSTICO, não SOLUCAO_LTB, não SOLUCAO_MENTALIDADE, não SOLUCAO_SUPLEMENTACAO, não SOLUCAO_ALIMENTACAO, não SOLUCAO_ATIVIDADE_FISICA e não SOLUCAO_HABITOS_DE_VIDA), renderiza só o modal
    if (typeof contentType !== 'string' || (contentType !== 'ANAMNESE' && contentType !== 'DIAGNOSTICO' && contentType !== 'SOLUCAO_LTB' && contentType !== 'SOLUCAO_MENTALIDADE' && contentType !== 'SOLUCAO_SUPLEMENTACAO' && contentType !== 'SOLUCAO_ALIMENTACAO' && contentType !== 'SOLUCAO_ATIVIDADE_FISICA' && contentType !== 'SOLUCAO_HABITOS_DE_VIDA')) {
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
                      {generateAvatar(consultation.patient_name, consultation.patients?.profile_pic)}
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
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' || consultation.status === 'VALIDATION' ? 'outlined' : 'default'}
                    />
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

