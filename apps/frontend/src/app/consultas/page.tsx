'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Edit3, Save, X, Sparkles
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
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'ERROR' | 'CANCELLED' | 'COMPLETED';
  etapa?: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO';
  solucao_etapa?: 'LTB' | 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA' | 'HABITOS_DE_VIDA';
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
                <Edit3 className="w-4 h-4" />
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
  readOnly = false
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
}) {
  console.log('🔍 AnamneseSection readOnly:', readOnly);
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

  const fetchAnamneseData = async () => {
    try {
      setLoading(true);
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
      setAnamneseData(data);
    } catch (err) {
      console.error('❌ Erro ao carregar anamnese:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese');
    } finally {
      setLoading(false);
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
      setLoading(true);
      const response = await fetch(`/api/diagnostico/${consultaId}`);
      if (response.ok) {
        const data = await response.json();
        setDiagnosticoData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de diagnóstico:', error);
    } finally {
      setLoading(false);
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
        await fetch('https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-diagnostico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
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

  return (
    <div className="anamnese-sections">
      {/* ==================== DIAGNÓSTICO PRINCIPAL ==================== */}
      <CollapsibleSection title="1. Diagnóstico Principal" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>CID e Diagnósticos</h4>
          <DataField label="CID Principal" value={diagnostico_principal?.cid_principal} fieldPath="diagnostico_principal.cid_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
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

  // Estados para chat com IA
  const [selectedField, setSelectedField] = useState<{ fieldPath: string; label: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Estado para salvar alterações
  const [isSaving, setIsSaving] = useState(false);

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
      
      const webhookUrl = isDiagnostico 
        ? 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-diagnostico'
        : 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-anamnese';
      
      const requestBody = {
        origem: 'IA',
        fieldPath: selectedField.fieldPath,
        texto: messageText,
        consultaId,
      };
      
      console.log('Enviando para webhook:', requestBody);
      console.log('URL:', webhookUrl);
      
      // Faz requisição para o webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Status da resposta:', response.status);
      console.log('Response OK?', response.ok);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error('Erro ao comunicar com a IA');
      }

      const data = await response.json();
      
      // Debug: vamos ver exatamente o que está vindo
      console.log('Resposta completa do webhook:', data);
      console.log('Tipo da resposta:', typeof data);
      console.log('É array?', Array.isArray(data));
      console.log('Primeiro item:', data[0]);
      
      // Pega a resposta da IA - lidando com diferentes formatos
      let aiResponse = 'Não foi possível obter resposta da IA';
      
      if (Array.isArray(data) && data.length > 0) {
        // Formato esperado: [{"response": "texto"}]
        aiResponse = data[0]?.response || aiResponse;
      } else if (data && typeof data === 'object') {
        // Se não é array, pode ser um objeto com diferentes campos
        if (data.response) {
          aiResponse = data.response;
        } else if (data.message) {
          // Se só tem message, significa que o workflow foi iniciado
          aiResponse = 'Workflow iniciado com sucesso. Processando sua solicitação...';
        } else if (data.text) {
          aiResponse = data.text;
        } else if (data.answer) {
          aiResponse = data.answer;
        }
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
          const isDiagnostico = selectedField.fieldPath.startsWith('diagnostico_principal') ||
                               selectedField.fieldPath.startsWith('estado_geral') ||
                               selectedField.fieldPath.startsWith('estado_mental') ||
                               selectedField.fieldPath.startsWith('estado_fisiologico') ||
                               selectedField.fieldPath.startsWith('integracao_diagnostica') ||
                               selectedField.fieldPath.startsWith('habitos_vida');
          
          if (isDiagnostico) {
            // Trigger refresh of diagnostico data by updating a state that triggers useEffect
            window.dispatchEvent(new CustomEvent('diagnostico-data-refresh'));
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

  // Função para salvar alterações da ANAMNESE e mudar para próxima etapa (DIAGNOSTICO)
  const handleSaveAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a etapa da consulta para DIAGNOSTICO
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          etapa: 'DIAGNOSTICO'
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

  // Função para salvar alterações do DIAGNÓSTICO e mudar para etapa de SOLUÇÃO
  const handleSaveDiagnosticoAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);
      
      // Atualiza a etapa da consulta para SOLUCAO e define solucao_etapa como LTB
      const response = await fetch(`/api/consultations/${consultaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          etapa: 'SOLUCAO',
          solucao_etapa: 'LTB'
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

  // Função para renderizar o conteúdo baseado no status e etapa
  const renderConsultationContent = () => {
    if (!consultaDetails) return null;

    // STATUS = PROCESSING
    if (consultaDetails.status === 'PROCESSING') {
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
          <h2 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>Processando Consulta</h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>As informações da consulta estão sendo processadas</p>
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
        return 'DIAGNOSTICO';
      }

      // ETAPA = SOLUCAO
      if (consultaDetails.etapa === 'SOLUCAO') {
        const solucaoModals: Record<string, { title: string; icon: React.ReactNode }> = {
          'LTB': { 
            title: 'Tela de LTB', 
            icon: <FileText className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
          'MENTALIDADE': { 
            title: 'Tela de Mentalidade', 
            icon: <Sparkles className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
          'ALIMENTACAO': { 
            title: 'Tela de Alimentação', 
            icon: <FileText className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
          'SUPLEMENTACAO': { 
            title: 'Tela de Suplementação', 
            icon: <FileText className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
          'ATIVIDADE_FISICA': { 
            title: 'Tela de Atividade Fisica', 
            icon: <FileText className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
          'HABITOS_DE_VIDA': { 
            title: 'Tela de Habitos de Vida', 
            icon: <FileText className="w-16 h-16" style={{ margin: '0 auto 20px', color: '#6366f1' }} />
          },
        };

        const modalConfig = consultaDetails.solucao_etapa 
          ? solucaoModals[consultaDetails.solucao_etapa]
          : null;

        if (modalConfig) {
          return (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
                {modalConfig.icon}
                <h2 style={{ marginBottom: '10px' }}>{modalConfig.title}</h2>
                <p style={{ color: '#666' }}>Esta tela será implementada em breve</p>
                <button 
                  onClick={handleBackToList}
                  style={{ 
                    marginTop: '20px', 
                    padding: '10px 20px', 
                    background: '#6366f1', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Voltar para lista
                </button>
              </div>
            </div>
          );
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

    // Se for um modal (não ANAMNESE e não DIAGNOSTICO), renderiza só o modal
    if (typeof contentType !== 'string' || (contentType !== 'ANAMNESE' && contentType !== 'DIAGNOSTICO')) {
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
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' || consultation.status === 'VALIDATION' ? 'outlined' : 'default'}
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
