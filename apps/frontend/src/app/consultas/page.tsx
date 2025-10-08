'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Edit3, Save, X
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
  onSave 
}: { 
  label: string; 
  value: any; 
  fieldPath?: string;
  consultaId?: string;
  onSave?: (fieldPath: string, newValue: string, consultaId: string) => Promise<void>;
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
        {fieldPath && consultaId && onSave && !isEditing && (
          <button 
            className="edit-button"
            onClick={handleEdit}
            title="Editar campo"
          >
            <Edit3 className="w-4 h-4" />
          </button>
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

// Componente da seção de Anamnese
function AnamneseSection({ consultaId }: { consultaId: string }) {
  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <DataField label="Nome Completo" value={cadastro_prontuario?.identificacao_nome_completo} fieldPath="cadastro_prontuario.identificacao_nome_completo" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Nome Social" value={cadastro_prontuario?.identificacao_nome_social} fieldPath="cadastro_prontuario.identificacao_nome_social" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Data de Nascimento" value={cadastro_prontuario?.identificacao_data_nascimento} fieldPath="cadastro_prontuario.identificacao_data_nascimento" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Idade Atual" value={cadastro_prontuario?.identificacao_idade_atual} fieldPath="cadastro_prontuario.identificacao_idade_atual" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Sexo Biológico" value={cadastro_prontuario?.identificacao_sexo_biologico} fieldPath="cadastro_prontuario.identificacao_sexo_biologico" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Gênero" value={cadastro_prontuario?.identificacao_genero} fieldPath="cadastro_prontuario.identificacao_genero" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Naturalidade" value={cadastro_prontuario?.identificacao_naturalidade} fieldPath="cadastro_prontuario.identificacao_naturalidade" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Nacionalidade" value={cadastro_prontuario?.identificacao_nacionalidade} fieldPath="cadastro_prontuario.identificacao_nacionalidade" consultaId={consultaId} onSave={handleSaveField} />
          </div>

          <div className="anamnese-subsection">
            <h4>Dados Sociodemográficos</h4>
            <DataField label="Estado Civil" value={cadastro_prontuario?.dados_sociodemograficos_estado_civil} fieldPath="cadastro_prontuario.dados_sociodemograficos_estado_civil" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Número de Filhos" value={cadastro_prontuario?.dados_sociodemograficos_numero_filhos} fieldPath="cadastro_prontuario.dados_sociodemograficos_numero_filhos" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Idade dos Filhos" value={cadastro_prontuario?.dados_sociodemograficos_idade_filhos} fieldPath="cadastro_prontuario.dados_sociodemograficos_idade_filhos" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Escolaridade" value={cadastro_prontuario?.dados_sociodemograficos_escolaridade} fieldPath="cadastro_prontuario.dados_sociodemograficos_escolaridade" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Profissão" value={cadastro_prontuario?.dados_sociodemograficos_profissao} fieldPath="cadastro_prontuario.dados_sociodemograficos_profissao" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Exerce a Profissão" value={cadastro_prontuario?.dados_sociodemograficos_exerce_profissao} fieldPath="cadastro_prontuario.dados_sociodemograficos_exerce_profissao" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Situação de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_situacao_trabalho} fieldPath="cadastro_prontuario.dados_sociodemograficos_situacao_trabalho" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Carga Horária de Trabalho" value={cadastro_prontuario?.dados_sociodemograficos_carga_horaria_trabalho} fieldPath="cadastro_prontuario.dados_sociodemograficos_carga_horaria_trabalho" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Condição Social" value={cadastro_prontuario?.dados_sociodemograficos_condicao_social} fieldPath="cadastro_prontuario.dados_sociodemograficos_condicao_social" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Renda Familiar" value={cadastro_prontuario?.dados_sociodemograficos_renda_familiar} fieldPath="cadastro_prontuario.dados_sociodemograficos_renda_familiar" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Pessoas na Residência" value={cadastro_prontuario?.dados_sociodemograficos_pessoas_residencia} fieldPath="cadastro_prontuario.dados_sociodemograficos_pessoas_residencia" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Responsável Financeiro" value={cadastro_prontuario?.dados_sociodemograficos_responsavel_financeiro} fieldPath="cadastro_prontuario.dados_sociodemograficos_responsavel_financeiro" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="Seguro Saúde" value={cadastro_prontuario?.dados_sociodemograficos_seguro_saude} fieldPath="cadastro_prontuario.dados_sociodemograficos_seguro_saude" consultaId={consultaId} onSave={handleSaveField} />
          </div>

          <div className="anamnese-subsection">
            <h4>Documentos</h4>
            <DataField label="CPF" value={cadastro_prontuario?.doc_cpf} fieldPath="cadastro_prontuario.doc_cpf" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="RG" value={cadastro_prontuario?.doc_rg} fieldPath="cadastro_prontuario.doc_rg" consultaId={consultaId} onSave={handleSaveField} />
            <DataField label="CNS" value={cadastro_prontuario?.doc_cns} fieldPath="cadastro_prontuario.doc_cns" consultaId={consultaId} onSave={handleSaveField} />
          </div>

          <div className="anamnese-subsection">
            <h4>Endereço</h4>
            <DataField label="Logradouro" value={cadastro_prontuario?.endereco_logradouro} />
            <DataField label="Número" value={cadastro_prontuario?.endereco_numero} />
            <DataField label="Complemento" value={cadastro_prontuario?.endereco_complemento} />
            <DataField label="Bairro" value={cadastro_prontuario?.endereco_bairro} />
            <DataField label="Cidade" value={cadastro_prontuario?.endereco_cidade} />
            <DataField label="Estado" value={cadastro_prontuario?.endereco_estado} />
            <DataField label="CEP" value={cadastro_prontuario?.endereco_cep} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contato</h4>
            <DataField label="Celular" value={cadastro_prontuario?.telefone_celular} />
            <DataField label="Telefone Residencial" value={cadastro_prontuario?.telefone_residencial} />
            <DataField label="Telefone para Recado" value={cadastro_prontuario?.telefone_recado} />
            <DataField label="Email" value={cadastro_prontuario?.email} />
          </div>
        </CollapsibleSection>

      {/* Objetivos e Queixas */}
      <CollapsibleSection title="Objetivos e Queixas">
          <div className="anamnese-subsection">
            <h4>Saúde Geral Percebida</h4>
            <DataField label="Como Descreve a Saúde" value={objetivos_queixas?.saude_geral_percebida_como_descreve_saude} />
            <DataField label="Como Define Bem-Estar" value={objetivos_queixas?.saude_geral_percebida_como_define_bem_estar} />
            <DataField label="Avaliação da Saúde Emocional/Mental" value={objetivos_queixas?.saude_geral_percebida_avaliacao_saude_emocional_mental} />
          </div>

          <div className="anamnese-subsection">
            <h4>Queixas</h4>
            <DataField label="Queixa Principal" value={objetivos_queixas?.queixa_principal} />
            <DataField label="Sub-queixas" value={objetivos_queixas?.sub_queixas} />
          </div>

          <div className="anamnese-subsection">
            <h4>Impacto das Queixas na Vida</h4>
            <DataField label="Como Afeta a Vida Diária" value={objetivos_queixas?.impacto_queixas_vida_como_afeta_vida_diaria} />
            <DataField label="Limitações Causadas" value={objetivos_queixas?.impacto_queixas_vida_limitacoes_causadas} />
            <DataField label="Áreas Impactadas" value={objetivos_queixas?.impacto_queixas_vida_areas_impactadas} />
          </div>

          <div className="anamnese-subsection">
            <h4>Objetivos e Expectativas</h4>
            <DataField label="Problemas Deseja Resolver" value={objetivos_queixas?.problemas_deseja_resolver} />
            <DataField label="Expectativa Específica" value={objetivos_queixas?.expectativas_tratamento_expectativa_especifica} />
            <DataField label="Já Buscou Tratamentos Similares" value={objetivos_queixas?.expectativas_tratamento_ja_buscou_tratamentos_similares} />
            <DataField label="Tratamentos Anteriores" value={objetivos_queixas?.expectativas_tratamento_quais_tratamentos_anteriores} />
          </div>

          <div className="anamnese-subsection">
            <h4>Compreensão sobre a Causa</h4>
            <DataField label="Compreensão do Paciente" value={objetivos_queixas?.compreensao_sobre_causa_compreensao_paciente} />
            <DataField label="Fatores Externos Influenciando" value={objetivos_queixas?.compreensao_sobre_causa_fatores_externos_influenciando} />
          </div>

          <div className="anamnese-subsection">
            <h4>Projeto de Vida</h4>
            <DataField label="Corporal" value={objetivos_queixas?.projeto_de_vida_corporal} />
            <DataField label="Espiritual" value={objetivos_queixas?.projeto_de_vida_espiritual} />
            <DataField label="Familiar" value={objetivos_queixas?.projeto_de_vida_familiar} />
            <DataField label="Profissional" value={objetivos_queixas?.projeto_de_vida_profissional} />
            <DataField label="Sonhos" value={objetivos_queixas?.projeto_de_vida_sonhos} />
          </div>

          <div className="anamnese-subsection">
            <h4>Motivação e Mudança</h4>
            <DataField label="Nível de Motivação" value={objetivos_queixas?.nivel_motivacao} />
            <DataField label="Prontidão para Mudança" value={objetivos_queixas?.prontidao_para_mudanca} />
            <DataField label="Mudanças Considera Necessárias" value={objetivos_queixas?.mudancas_considera_necessarias} />
          </div>
        </CollapsibleSection>

      {/* Histórico de Risco */}
      <CollapsibleSection title="Histórico de Risco">
          <div className="anamnese-subsection">
            <h4>Doenças Atuais e Passadas</h4>
            <DataField label="Doenças Atuais Confirmadas" value={historico_risco?.doencas_atuais_confirmadas} />
            <DataField label="Doenças na Infância/Adolescência" value={historico_risco?.doencas_infancia_adolescencia} />
          </div>

          <div className="anamnese-subsection">
            <h4>Antecedentes Familiares</h4>
            <DataField label="Pai" value={historico_risco?.antecedentes_familiares_pai} />
            <DataField label="Mãe" value={historico_risco?.antecedentes_familiares_mae} />
            <DataField label="Irmãos" value={historico_risco?.antecedentes_familiares_irmaos} />
            <DataField label="Avós Paternos" value={historico_risco?.antecedentes_familiares_avos_paternos} />
            <DataField label="Avós Maternos" value={historico_risco?.antecedentes_familiares_avos_maternos} />
            <DataField label="Causas de Morte dos Avós" value={historico_risco?.antecedentes_familiares_causas_morte_avos} />
          </div>

          <div className="anamnese-subsection">
            <h4>Condições e Tratamentos</h4>
            <DataField label="Condições Genéticas Conhecidas" value={historico_risco?.condicoes_geneticas_conhecidas} />
            <DataField label="Cirurgias/Procedimentos" value={historico_risco?.cirurgias_procedimentos} />
            <DataField label="Medicações Atuais" value={historico_risco?.medicacoes_atuais} />
            <DataField label="Medicações Contínuas" value={historico_risco?.medicacoes_continuas} />
            <DataField label="Já Usou Corticoides" value={historico_risco?.ja_usou_corticoides} />
          </div>

          <div className="anamnese-subsection">
            <h4>Alergias e Exposições</h4>
            <DataField label="Alergias/Intolerâncias Conhecidas" value={historico_risco?.alergias_intolerancias_conhecidas} />
            <DataField label="Alergias/Intolerâncias Suspeitas" value={historico_risco?.alergias_intolerancias_suspeitas} />
            <DataField label="Exposição Tóxica" value={historico_risco?.exposicao_toxica} />
          </div>

          <div className="anamnese-subsection">
            <h4>Histórico de Peso</h4>
            <DataField label="Variação ao Longo da Vida" value={historico_risco?.historico_peso_variacao_ao_longo_vida} />
            <DataField label="Peso Máximo Atingido" value={historico_risco?.historico_peso_peso_maximo_atingido} />
            <DataField label="Peso Mínimo Atingido" value={historico_risco?.historico_peso_peso_minimo_atingido} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tratamentos Anteriores</h4>
            <DataField label="Tentativas de Tratamento Anteriores" value={historico_risco?.tentativas_tratamento_anteriores} />
          </div>
        </CollapsibleSection>

      {/* Observação Clínica e Laboratorial */}
      <CollapsibleSection title="Observação Clínica e Laboratorial">
          <div className="anamnese-subsection">
            <h4>Sintomas e Padrões</h4>
            <DataField label="Quando os Sintomas Começaram" value={observacao_clinica_lab?.quando_sintomas_comecaram} />
            <DataField label="Padrão Temporal" value={observacao_clinica_lab?.ha_algum_padrao_temporal} />
            <DataField label="Eventos que Agravaram" value={observacao_clinica_lab?.eventos_que_agravaram} />
            <DataField label="Intensidade de Dor/Desconforto" value={observacao_clinica_lab?.intensidade_dor_desconforto} />
            <DataField label="Nível de Energia Diária" value={observacao_clinica_lab?.nivel_energia_diaria} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Gastrointestinal</h4>
            <DataField label="Intestino" value={observacao_clinica_lab?.sistema_gastrointestinal_intestino} />
            <DataField label="Hábito Intestinal" value={observacao_clinica_lab?.sistema_gastrointestinal_habito_intestinal} />
            <DataField label="Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_disbiose} />
            <DataField label="Língua" value={observacao_clinica_lab?.sistema_gastrointestinal_lingua} />
            <DataField label="Digestão" value={observacao_clinica_lab?.sistema_gastrointestinal_digestao} />
            <DataField label="Gases" value={observacao_clinica_lab?.sistema_gastrointestinal_gases} />
            <DataField label="Suspeita de Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_suspeita_disbiose} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Musculoesquelético</h4>
            <DataField label="Dores" value={observacao_clinica_lab?.sistema_musculoesqueletico_dores} />
            <DataField label="Localização" value={observacao_clinica_lab?.sistema_musculoesqueletico_localizacao} />
            <DataField label="Postura" value={observacao_clinica_lab?.sistema_musculoesqueletico_postura} />
            <DataField label="Tônus Muscular" value={observacao_clinica_lab?.sistema_musculoesqueletico_tono_muscular} />
            <DataField label="Mobilidade" value={observacao_clinica_lab?.sistema_musculoesqueletico_mobilidade} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pele e Fâneros</h4>
            <DataField label="Pele" value={observacao_clinica_lab?.pele_faneros_pele} />
            <DataField label="Cabelo" value={observacao_clinica_lab?.pele_faneros_cabelo} />
            <DataField label="Unhas" value={observacao_clinica_lab?.pele_faneros_unhas} />
            <DataField label="Hidratação" value={observacao_clinica_lab?.pele_faneros_hidratacao} />
            <DataField label="Ingestão de Água (ml/dia)" value={observacao_clinica_lab?.pele_faneros_ingestao_agua_ml_dia} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Neurológico/Mental</h4>
            <DataField label="Memória" value={observacao_clinica_lab?.sistema_neurologico_mental_memoria} />
            <DataField label="Concentração" value={observacao_clinica_lab?.sistema_neurologico_mental_concentracao} />
            <DataField label="Qualidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_qualidade} />
            <DataField label="Latência do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_latencia} />
            <DataField label="Manutenção do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_manutencao} />
            <DataField label="Profundidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_profundidade} />
            <DataField label="Duração do Sono (horas)" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_duracao_horas} />
            <DataField label="Despertar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_despertar} />
            <DataField label="Acorda Quantas Vezes" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_quantas_vezes} />
            <DataField label="Acorda para Urinar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_para_urinar} />
            <DataField label="Energia" value={observacao_clinica_lab?.sistema_neurologico_mental_energia} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Endócrino</h4>
            <h5>Tireoide</h5>
            <DataField label="TSH" value={observacao_clinica_lab?.sistema_endocrino_tireoide_tsh} />
            <DataField label="Anti-TPO" value={observacao_clinica_lab?.sistema_endocrino_tireoide_anti_tpo} />
            <DataField label="T3 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t3_livre} />
            <DataField label="T4 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t4_livre} />
            <DataField label="Suspeita" value={observacao_clinica_lab?.sistema_endocrino_tireoide_suspeita} />
            
            <h5>Insulina</h5>
            <DataField label="Valor" value={observacao_clinica_lab?.sistema_endocrino_insulina_valor} />
            <DataField label="Glicemia" value={observacao_clinica_lab?.sistema_endocrino_insulina_glicemia} />
            <DataField label="Hemoglobina Glicada" value={observacao_clinica_lab?.sistema_endocrino_insulina_hemoglobina_glicada} />
            <DataField label="HOMA-IR" value={observacao_clinica_lab?.sistema_endocrino_insulina_homa_ir} />
            <DataField label="Diagnóstico" value={observacao_clinica_lab?.sistema_endocrino_insulina_diagnostico} />
            
            <h5>Outros Hormônios</h5>
            <DataField label="Cortisol" value={observacao_clinica_lab?.sistema_endocrino_cortisol} />
            <DataField label="Estrogênio" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_estrogeno} />
            <DataField label="Progesterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_progesterona} />
            <DataField label="Testosterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_testosterona} />
            <DataField label="Impacto" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_impacto} />
          </div>

          <div className="anamnese-subsection">
            <h4>Medidas Antropométricas</h4>
            <DataField label="Peso Atual" value={observacao_clinica_lab?.medidas_antropometricas_peso_atual} />
            <DataField label="Altura" value={observacao_clinica_lab?.medidas_antropometricas_altura} />
            <DataField label="IMC" value={observacao_clinica_lab?.medidas_antropometricas_imc} />
            <DataField label="Circunferência da Cintura" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_cintura} />
            <DataField label="Circunferência do Quadril" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_quadril} />
            <DataField label="Circunferência do Pescoço" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_pescoco} />
            <DataField label="Relação Cintura/Quadril" value={observacao_clinica_lab?.medidas_antropometricas_relacao_cintura_quadril} />
            
            <h5>Bioimpedância</h5>
            <DataField label="Gordura (%)" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_percentual} />
            <DataField label="Massa Muscular" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_massa_muscular} />
            <DataField label="Água Corporal" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_agua_corporal} />
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_visceral} />
            
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_gordura_visceral} />
            <DataField label="Esteatose Hepática" value={observacao_clinica_lab?.medidas_antropometricas_esteatose_hepatica} />
            <DataField label="Pressão Arterial" value={observacao_clinica_lab?.medidas_antropometricas_pressao_arterial} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sinais Vitais Relatados</h4>
            <DataField label="Disposição ao Acordar" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_acordar} />
            <DataField label="Disposição ao Longo do Dia" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_longo_dia} />
            <DataField label="Libido" value={observacao_clinica_lab?.sinais_vitais_relatados_libido} />
            <DataField label="Regulação Térmica" value={observacao_clinica_lab?.sinais_vitais_relatados_regulacao_termica} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos Alimentares</h4>
            <DataField label="Recordatório 24h" value={observacao_clinica_lab?.habitos_alimentares_recordatorio_24h} />
            <DataField label="Frequência de Ultraprocessados" value={observacao_clinica_lab?.habitos_alimentares_frequencia_ultraprocessados} />
            <DataField label="Horários das Refeições" value={observacao_clinica_lab?.habitos_alimentares_horarios_refeicoes} />
            <DataField label="Come Assistindo TV/Trabalhando" value={observacao_clinica_lab?.habitos_alimentares_come_assistindo_tv_trabalhando} />
          </div>
        </CollapsibleSection>

      {/* História de Vida */}
      <CollapsibleSection title="História de Vida">
          <div className="anamnese-subsection">
            <h4>Narrativa e Eventos</h4>
            <DataField label="Síntese da Narrativa" value={historia_vida?.narrativa_sintese} />
            <DataField label="Eventos de Vida Marcantes" value={historia_vida?.eventos_vida_marcantes} />
            <DataField label="Episódios de Estresse Extremo/Trauma" value={historia_vida?.episodios_estresse_extremo_trauma} />
          </div>

          <div className="anamnese-subsection">
            <h4>Trilha do Conflito</h4>
            <DataField label="Concepção/Gestação" value={historia_vida?.trilha_do_conflito_concepcao_gestacao} />
            <DataField label="0-7 anos" value={historia_vida?.trilha_do_conflito_0_7_anos} />
            <DataField label="7-14 anos" value={historia_vida?.trilha_do_conflito_7_14_anos} />
            <DataField label="14-21 anos" value={historia_vida?.trilha_do_conflito_14_21_anos} />
            <DataField label="21-28 anos" value={historia_vida?.trilha_do_conflito_21_28_anos} />
            <DataField label="28+ anos" value={historia_vida?.trilha_do_conflito_28_mais_anos} />
          </div>

          <div className="anamnese-subsection">
            <h4>Padrões e Traumas</h4>
            <DataField label="Pontos Traumáticos" value={historia_vida?.pontos_traumaticos} />
            <DataField label="Padrões Repetitivos" value={historia_vida?.padroes_repetitivos} />
            <DataField label="Saúde da Mãe na Gestação" value={historia_vida?.saude_mae_gestacao} />
            <DataField label="Traços/Comportamentos Repetitivos" value={historia_vida?.tracos_comportamentos_repetitivos_ao_longo_vida} />
          </div>

          <div className="anamnese-subsection">
            <h4>Superação e Identidade</h4>
            <DataField label="Experiência de Virada" value={historia_vida?.experiencia_considera_virada} />
            <DataField label="Identifica com Superação ou Defesa" value={historia_vida?.identifica_com_superacao_ou_defesa} />
            <DataField label="Conexão com Identidade e Propósito" value={historia_vida?.conexao_identidade_proposito} />
            <DataField label="Algo da Infância que Lembra com Emoção Intensa" value={historia_vida?.algo_infancia_lembra_com_emocao_intensa} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tentativas Anteriores</h4>
            <DataField label="Já Tentou Resolver Antes" value={historia_vida?.tentativas_anteriores_similares_ja_tentou_resolver_antes} />
            <DataField label="Quantas Vezes" value={historia_vida?.tentativas_anteriores_similares_quantas_vezes} />
            <DataField label="Métodos Utilizados" value={historia_vida?.tentativas_anteriores_similares_metodos_utilizados} />
            <DataField label="Máximo Resultado Alcançado" value={historia_vida?.tentativas_anteriores_similares_maximo_resultado_alcancado} />
            <DataField label="Resultado Recuperado" value={historia_vida?.tentativas_anteriores_similares_resultado_recuperado} />
          </div>
        </CollapsibleSection>

      {/* Setênios e Eventos */}
      <CollapsibleSection title="Setênios e Eventos">
          <div className="anamnese-subsection">
            <h4>Concepção e Gestação</h4>
            <DataField label="Planejamento" value={setenios_eventos?.concepcao_gestacao_planejamento} />
            <DataField label="Ambiente Gestacional" value={setenios_eventos?.concepcao_gestacao_ambiente_gestacional} />
            <DataField label="Saúde da Mãe" value={setenios_eventos?.concepcao_gestacao_saude_mae_gestacao} />
            <DataField label="Tipo de Parto" value={setenios_eventos?.concepcao_gestacao_parto} />
            <DataField label="Houve Trauma de Parto" value={setenios_eventos?.concepcao_gestacao_houve_trauma_parto} />
            <DataField label="Foi Desejada/Planejada" value={setenios_eventos?.concepcao_gestacao_foi_desejada_planejada} />
            <DataField label="Impacto" value={setenios_eventos?.concepcao_gestacao_impacto} />
          </div>

          <div className="anamnese-subsection">
            <h4>Primeiro Setênio (0-7 anos)</h4>
            <DataField label="Ambiente" value={setenios_eventos?.primeiro_setenio_0_7_ambiente} />
            <DataField label="Figuras Parentais - Pai" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_pai} />
            <DataField label="Figuras Parentais - Mãe" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_mae} />
            <DataField label="Aprendizados" value={setenios_eventos?.primeiro_setenio_0_7_aprendizados} />
            <DataField label="Trauma Central" value={setenios_eventos?.primeiro_setenio_0_7_trauma_central} />
          </div>

          <div className="anamnese-subsection">
            <h4>Segundo Setênio (7-14 anos)</h4>
            <DataField label="Eventos" value={setenios_eventos?.segundo_setenio_7_14_eventos} />
            <DataField label="Desenvolvimento" value={setenios_eventos?.segundo_setenio_7_14_desenvolvimento} />
            <DataField label="Corpo Físico" value={setenios_eventos?.segundo_setenio_7_14_corpo_fisico} />
            <DataField label="Impacto" value={setenios_eventos?.segundo_setenio_7_14_impacto} />
          </div>

          <div className="anamnese-subsection">
            <h4>Terceiro Setênio (14-21 anos)</h4>
            <DataField label="Escolhas" value={setenios_eventos?.terceiro_setenio_14_21_escolhas} />
            <DataField label="Motivação" value={setenios_eventos?.terceiro_setenio_14_21_motivacao} />
            <DataField label="Cumeeira da Casa" value={setenios_eventos?.terceiro_setenio_14_21_cumeeira_da_casa} />
          </div>

          <div className="anamnese-subsection">
            <h4>Quarto Setênio (21-28 anos)</h4>
            <DataField label="Eventos Significativos" value={setenios_eventos?.quarto_setenio_21_28_eventos_significativos} />
            <DataField label="Formação Profissional" value={setenios_eventos?.quarto_setenio_21_28_formacao_profissional} />
          </div>

          <div className="anamnese-subsection">
            <h4>Decênios (28-40+ anos)</h4>
            <DataField label="Climatério/Menopausa" value={setenios_eventos?.decenios_28_40_mais_climaterio_menopausa} />
            <DataField label="Pausas Hormonais" value={setenios_eventos?.decenios_28_40_mais_pausas_hormonais} />
            <DataField label="Acumulação" value={setenios_eventos?.decenios_28_40_mais_acumulacao} />
            <DataField label="Estado Atual" value={setenios_eventos?.decenios_28_40_mais_estado_atual} />
            <DataField label="Episódios de Estresse Extremo" value={setenios_eventos?.decenios_28_40_mais_episodios_estresse_extremo} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Gerais</h4>
            <DataField label="Eventos Críticos Identificados" value={setenios_eventos?.eventos_criticos_identificados} />
            <DataField label="Experiência de Virada" value={setenios_eventos?.experiencia_considera_virada} />
            <DataField label="Diferenças Sazonais/Climáticas nos Sintomas" value={setenios_eventos?.diferencas_sazonais_climaticas_sintomas} />
          </div>
        </CollapsibleSection>

      {/* Ambiente e Contexto */}
      <CollapsibleSection title="Ambiente e Contexto">
          <div className="anamnese-subsection">
            <h4>Contexto Familiar</h4>
            <DataField label="Estado Civil" value={ambiente_contexto?.contexto_familiar_estado_civil} />
            <DataField label="Filhos" value={ambiente_contexto?.contexto_familiar_filhos} />
            <DataField label="Dinâmica Familiar" value={ambiente_contexto?.contexto_familiar_dinamica_familiar} />
            <DataField label="Suporte Familiar" value={ambiente_contexto?.contexto_familiar_suporte_familiar} />
            <DataField label="Relacionamento Conjugal" value={ambiente_contexto?.contexto_familiar_relacionamento_conjugal} />
            <DataField label="Divisão de Tarefas Domésticas" value={ambiente_contexto?.contexto_familiar_divisao_tarefas_domesticas} />
            <DataField label="Vida Sexual Ativa" value={ambiente_contexto?.contexto_familiar_vida_sexual_ativa} />
            <DataField label="Diálogo sobre Sobrecarga" value={ambiente_contexto?.contexto_familiar_dialogo_sobre_sobrecarga} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contexto Profissional</h4>
            <DataField label="Área" value={ambiente_contexto?.contexto_profissional_area} />
            <DataField label="Carga Horária" value={ambiente_contexto?.contexto_profissional_carga_horaria} />
            <DataField label="Nível de Estresse" value={ambiente_contexto?.contexto_profissional_nivel_estresse} />
            <DataField label="Satisfação" value={ambiente_contexto?.contexto_profissional_satisfacao} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ambiente Físico</h4>
            <DataField label="Sedentarismo" value={ambiente_contexto?.ambiente_fisico_sedentarismo} />
            <DataField label="Exposição ao Sol" value={ambiente_contexto?.ambiente_fisico_exposicao_sol} />
            <DataField label="Pratica Atividade Física" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_pratica} />
            <DataField label="Tipo de Atividade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tipo} />
            <DataField label="Frequência" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_frequencia} />
            <DataField label="Intensidade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_intensidade} />
            <DataField label="Tem Acompanhamento Profissional" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos de Vida</h4>
            <DataField label="Sono" value={ambiente_contexto?.habitos_vida_sono} />
            <DataField label="Alimentação" value={ambiente_contexto?.habitos_vida_alimentacao} />
            <DataField label="Lazer" value={ambiente_contexto?.habitos_vida_lazer} />
            <DataField label="Espiritualidade" value={ambiente_contexto?.habitos_vida_espiritualidade} />
          </div>

          <div className="anamnese-subsection">
            <h4>Suporte Social</h4>
            <DataField label="Tem Rede de Apoio" value={ambiente_contexto?.suporte_social_tem_rede_apoio} />
            <DataField label="Participa de Grupos Sociais" value={ambiente_contexto?.suporte_social_participa_grupos_sociais} />
            <DataField label="Tem com Quem Desabafar" value={ambiente_contexto?.suporte_social_tem_com_quem_desabafar} />
          </div>

          <div className="anamnese-subsection">
            <h4>Fatores de Risco</h4>
            <DataField label="Fatores Estressores" value={ambiente_contexto?.fatores_estressores} />
            <DataField label="Fatores Externos à Saúde" value={ambiente_contexto?.fatores_externos_saude} />
          </div>
        </CollapsibleSection>

      {/* Sensação e Emoções */}
      <CollapsibleSection title="Sensação e Emoções">
          <div className="anamnese-subsection">
            <h4>Emoções e Sensações</h4>
            <DataField label="Emoções Predominantes" value={sensacao_emocoes?.emocoes_predominantes} />
            <DataField label="Sensações Corporais" value={sensacao_emocoes?.sensacoes_corporais} />
            <DataField label="Palavras-chave Emocionais" value={sensacao_emocoes?.palavras_chave_emocionais} />
            <DataField label="Intensidade Emocional" value={sensacao_emocoes?.intensidade_emocional} />
          </div>

          <div className="anamnese-subsection">
            <h4>Gatilhos Emocionais</h4>
            <DataField label="Consegue Identificar Gatilhos" value={sensacao_emocoes?.consegue_identificar_gatilhos_emocionais} />
            <DataField label="Gatilhos Identificados" value={sensacao_emocoes?.gatilhos_identificados} />
          </div>

          <div className="anamnese-subsection">
            <h4>Regulação Emocional</h4>
            <DataField label="Capacidade de Regulação" value={sensacao_emocoes?.regulacao_emocional_capacidade_regulacao} />
            <DataField label="Forma de Expressão" value={sensacao_emocoes?.regulacao_emocional_forma_expressao} />
            <DataField label="Como Gerencia Estresse/Ansiedade" value={sensacao_emocoes?.regulacao_emocional_como_gerencia_estresse_ansiedade} />
            <DataField label="Memória Afetiva" value={sensacao_emocoes?.memoria_afetiva} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sensações Específicas do Reino</h4>
            <DataField label="Usa Palavras Como" value={sensacao_emocoes?.sensacoes_especificas_reino_usa_palavras_como} />
            <DataField label="Descreve Sensações Como" value={sensacao_emocoes?.sensacoes_especificas_reino_descreve_sensacoes_como} />
            <DataField label="Padrões de Discurso" value={sensacao_emocoes?.sensacoes_especificas_reino_padroes_discurso} />
          </div>

          <div className="anamnese-subsection">
            <h4>Conexão Corpo-Mente</h4>
            <DataField label="Percebe Manifestações Corporais das Emoções" value={sensacao_emocoes?.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes} />
            <DataField label="Exemplos" value={sensacao_emocoes?.conexao_corpo_mente_exemplos} />
          </div>
        </CollapsibleSection>

      {/* Preocupações e Crenças */}
      <CollapsibleSection title="Preocupações e Crenças">
          <div className="anamnese-subsection">
            <h4>Percepção do Problema</h4>
            <DataField label="Como Percebe o Problema" value={preocupacoes_crencas?.como_percebe_problema} />
            <DataField label="Compreensão sobre Causa dos Sintomas" value={preocupacoes_crencas?.compreensao_sobre_causa_sintomas} />
          </div>

          <div className="anamnese-subsection">
            <h4>Crenças e Preocupações</h4>
            <DataField label="Crenças Limitantes" value={preocupacoes_crencas?.crencas_limitantes} />
            <DataField label="Preocupações Explícitas" value={preocupacoes_crencas?.preocupacoes_explicitas} />
            <DataField label="Preocupações Implícitas" value={preocupacoes_crencas?.preocupacoes_implicitas} />
            <DataField label="Ganhos Secundários" value={preocupacoes_crencas?.ganhos_secundarios} />
            <DataField label="Resistências Possíveis" value={preocupacoes_crencas?.resistencias_possiveis} />
          </div>

          <div className="anamnese-subsection">
            <h4>Expectativas e Insight</h4>
            <DataField label="Condições Genéticas na Família" value={preocupacoes_crencas?.condicoes_geneticas_familia} />
            <DataField label="Expectativas Irrealistas" value={preocupacoes_crencas?.expectativas_irrealistas} />
            <DataField label="Nível de Insight/Autoconsciência" value={preocupacoes_crencas?.nivel_insight_autoconsciencia} />
            <DataField label="Abertura para Mudança" value={preocupacoes_crencas?.abertura_para_mudanca} />
          </div>

          <div className="anamnese-subsection">
            <h4>Barreiras e Desafios</h4>
            <DataField label="Barreiras Percebidas ao Tratamento" value={preocupacoes_crencas?.barreiras_percebidas_tratamento} />
            <DataField label="Aspectos do Plano que Parecem Desafiadores" value={preocupacoes_crencas?.aspectos_plano_parecem_desafiadores} />
          </div>
        </CollapsibleSection>

      {/* Reino e Miasma */}
      <CollapsibleSection title="Reino e Miasma">
          <div className="anamnese-subsection">
            <h4>Reino Predominante</h4>
            <DataField label="Reino" value={reino_miasma?.reino_predominante} />
            <DataField label="Características Identificadas" value={reino_miasma?.caracteristicas_identificadas} />
          </div>

          <div className="anamnese-subsection">
            <h4>Análise Detalhada - Reino Animal</h4>
            <DataField label="Palavras Usadas" value={reino_miasma?.analise_detalhada_reino_animal_palavras_usadas} />
            <DataField label="Descreve Sensações Como" value={reino_miasma?.analise_detalhada_reino_animal_descreve_sensacoes_como} />
          </div>

          <div className="anamnese-subsection">
            <h4>Implicações Terapêuticas</h4>
            <DataField label="Comunicação" value={reino_miasma?.implicacoes_terapeuticas_comunicacao} />
            <DataField label="Abordagem" value={reino_miasma?.implicacoes_terapeuticas_abordagem} />
            <DataField label="Outras Terapias Alinhadas" value={reino_miasma?.implicacoes_terapeuticas_outras_terapias_alinhadas} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Comportamentais</h4>
            <DataField label="Maneira de Vestir" value={reino_miasma?.maneira_vestir} />
            <DataField label="Tipo de Profissão Escolhida" value={reino_miasma?.tipo_profissao_escolhida} />
            <DataField label="Padrão de Discurso" value={reino_miasma?.padrao_discurso} />
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
                <h3>Anamnese Integrativa - Identificação e Avaliação Inicial</h3>
              </div>
              
              <div className="chat-messages">
                {/* Mensagens mockadas */}
                <div className="message ai-message">
                  <div className="message-avatar ai-avatar">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="message-content">
                    <p>Hello! I've been thinking about developing some new skills. Any suggestions on where to start?</p>
                  </div>
                </div>

                <div className="message user-message">
                  <div className="message-avatar user-avatar">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="message-content">
                    <p>Hi there! That's great to hear. The first step is to identify your interests. What areas are you passionate about or curious to explore?</p>
                  </div>
                </div>

                <div className="message ai-message">
                  <div className="message-avatar ai-avatar">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="message-content">
                    <p>I've always been interested in graphic design, but I'm not sure where to start.</p>
                  </div>
                </div>

                <div className="message user-message">
                  <div className="message-avatar user-avatar">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="message-content">
                    <p>Graphic design is a fantastic choice! To start, you might want to learn the basics of design principles and software tools. There are many online platforms offering free Adobe Creative Cloud tutorials or design courses. Then, do you have access or plans to obtain design software like Illustrator or Sketch? Here are a few you could consider trying...</p>
                  </div>
                </div>
              </div>

              <div className="chat-input-area">
                <input 
                  type="text" 
                  placeholder="Message" 
                  className="chat-input"
                  disabled
                />
                <button className="chat-send-button" disabled>
                  <FileText className="w-5 h-5" />
                </button>
                <button className="chat-send-button" disabled>
                  <Mic className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Anamnese */}
          <div className="anamnese-column">
            <div className="anamnese-container">
              <div className="anamnese-header">
                <h2>Anamnese Integrativa - Identificação e Avaliação Inicial</h2>
              </div>

              <div className="anamnese-content">
                <AnamneseSection consultaId={consultaId} />
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