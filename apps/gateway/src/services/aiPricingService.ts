/**
 * Serviço de Monitoramento de Custos de IA
 * Registra todos os usos de IA na tabela ai_pricing para análise de custos
 * 
 * O campo 'tester' é determinado pelo campo 'tester' da tabela 'medicos'
 * associado à consulta. Se o médico for tester, ai_pricing.tester = true
 */

import { supabase } from '../config/database';

// Tipos de LLM suportados
export type LLMType = 
  | 'whisper-1'                           // Transcrição Whisper
  | 'gpt-4o-realtime-preview-2024-12-17'  // Realtime API
  | 'gpt-4o'                              // Chat Completion
  | 'gpt-4o-mini'                         // Chat Completion (mini)
  | 'gpt-4-turbo'                         // Chat Completion
  | 'gpt-3.5-turbo'                       // Chat Completion
  | 'text-embedding-3-small'              // Embeddings
  | 'text-embedding-3-large';             // Embeddings

// Cache para evitar múltiplas consultas ao banco para o mesmo médico
const doctorTesterCache = new Map<string, { isTester: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

// Etapas do processo onde IA é utilizada
export type AIStage = 
  | 'transcricao_whisper'       // Transcrição de áudio com Whisper
  | 'transcricao_realtime'      // Transcrição em tempo real (Realtime API)
  | 'analise_contexto'          // Análise de contexto para sugestões
  | 'sugestoes_contextuais'     // Geração de sugestões contextuais
  | 'sugestoes_emergencia'      // Geração de sugestões de emergência
  | 'embedding'                 // Geração de embeddings
  | 'chat_completion';          // Chat completion genérico

// Preços por modelo (em USD por 1000 tokens ou por minuto para áudio)
const AI_PRICING: Record<LLMType, { input: number; output: number; unit: 'tokens' | 'minutes' }> = {
  'whisper-1': { input: 0.006, output: 0, unit: 'minutes' },
  'gpt-4o-realtime-preview-2024-12-17': { input: 0.06, output: 0.24, unit: 'minutes' }, // Audio input/output
  'gpt-4o': { input: 0.0025, output: 0.01, unit: 'tokens' }, // per 1K tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, unit: 'tokens' },
  'gpt-4-turbo': { input: 0.01, output: 0.03, unit: 'tokens' },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015, unit: 'tokens' },
  'text-embedding-3-small': { input: 0.00002, output: 0, unit: 'tokens' },
  'text-embedding-3-large': { input: 0.00013, output: 0, unit: 'tokens' },
};

export interface AIPricingRecord {
  consulta_id?: string;
  LLM: LLMType;
  token: number;          // Tokens usados OU minutos de áudio
  price: number;          // Preço calculado em USD
  tester?: boolean;       // Se é ambiente de teste
  etapa: AIStage;         // Etapa onde foi usado
}

class AIPricingService {
  private isEnabled: boolean = true;

  constructor() {
    console.log(`📊 AI Pricing Service inicializado`);
  }

  /**
   * Busca se o médico da consulta é tester
   * Verifica na tabela 'medicos' através da consulta ou sessão
   * @param consultaId ID da consulta ou sessão
   * @returns true se o médico for tester, false caso contrário
   */
  private async isDoctorTester(consultaId?: string): Promise<boolean> {
    if (!consultaId) {
      return false; // Se não tem consultaId, assume que não é tester
    }

    // Verificar cache primeiro
    const cached = doctorTesterCache.get(consultaId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.isTester;
    }

    try {
      // Tentar buscar pela tabela consultations primeiro
      let doctorId: string | null = null;

      // 1. Tentar buscar na tabela consultations
      const { data: consultation } = await supabase
        .from('consultations')
        .select('doctor_id')
        .eq('id', consultaId)
        .maybeSingle();

      if (consultation?.doctor_id) {
        doctorId = consultation.doctor_id;
      }

      // 2. Se não encontrou, tentar buscar na tabela call_sessions
      if (!doctorId) {
        const { data: callSession } = await supabase
          .from('call_sessions')
          .select('consultation_id, metadata')
          .eq('id', consultaId)
          .maybeSingle();

        if (callSession?.consultation_id) {
          // Buscar a consulta associada
          const { data: linkedConsultation } = await supabase
            .from('consultations')
            .select('doctor_id')
            .eq('id', callSession.consultation_id)
            .maybeSingle();

          if (linkedConsultation?.doctor_id) {
            doctorId = linkedConsultation.doctor_id;
          }
        }

        // Tentar buscar do metadata
        if (!doctorId && callSession?.metadata?.doctorId) {
          doctorId = callSession.metadata.doctorId;
        }
      }

      // 3. Se encontrou o doctor_id, buscar se é tester
      if (doctorId) {
        const { data: doctor } = await supabase
          .from('medicos')
          .select('tester')
          .eq('id', doctorId)
          .maybeSingle();

        const isTester = doctor?.tester === true;
        
        // Salvar no cache
        doctorTesterCache.set(consultaId, { isTester, timestamp: Date.now() });
        
        console.log(`📊 [AI_PRICING] Médico ${doctorId} é tester: ${isTester}`);
        return isTester;
      }

      // Se não encontrou nada, assume que não é tester
      doctorTesterCache.set(consultaId, { isTester: false, timestamp: Date.now() });
      return false;

    } catch (error) {
      console.error('❌ [AI_PRICING] Erro ao verificar se médico é tester:', error);
      return false; // Em caso de erro, assume que não é tester (registra como produção)
    }
  }

  /**
   * Limpa o cache de tester (útil para testes)
   */
  clearTesterCache(): void {
    doctorTesterCache.clear();
    console.log('📊 [AI_PRICING] Cache de tester limpo');
  }

  /**
   * Calcula o preço baseado no modelo e quantidade de tokens/minutos
   */
  private calculatePrice(model: LLMType, inputTokens: number, outputTokens: number = 0): number {
    const pricing = AI_PRICING[model];
    if (!pricing) {
      console.warn(`⚠️ Modelo não encontrado para pricing: ${model}`);
      return 0;
    }

    if (pricing.unit === 'minutes') {
      // Para modelos de áudio, inputTokens representa minutos
      return (inputTokens * pricing.input) + (outputTokens * pricing.output);
    } else {
      // Para modelos de texto, tokens são divididos por 1000
      return ((inputTokens / 1000) * pricing.input) + ((outputTokens / 1000) * pricing.output);
    }
  }

  /**
   * Registra uso de IA na tabela ai_pricing
   * O campo 'tester' é determinado pelo campo 'tester' do médico da consulta
   */
  async logUsage(record: AIPricingRecord): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Determinar se é tester baseado no médico da consulta
      let isTester = record.tester;
      
      // Se não foi passado explicitamente, buscar do médico
      if (isTester === undefined && record.consulta_id) {
        isTester = await this.isDoctorTester(record.consulta_id);
      }
      
      // Default para false se não conseguiu determinar
      if (isTester === undefined) {
        isTester = false;
      }

      const { error } = await supabase
        .from('ai_pricing')
        .insert({
          consulta_id: record.consulta_id || null,
          LLM: record.LLM,
          token: record.token,
          price: record.price,
          tester: isTester,
          etapa: record.etapa,
        });

      if (error) {
        console.error('❌ Erro ao registrar ai_pricing:', error.message);
        return false;
      }

      const testerLabel = isTester ? '[TESTER]' : '[PROD]';
      console.log(`📊 AI Pricing ${testerLabel}: ${record.etapa} - ${record.LLM} - ${record.token} ${AI_PRICING[record.LLM]?.unit || 'units'} - $${record.price.toFixed(6)}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao registrar ai_pricing:', error);
      return false;
    }
  }

  /**
   * Registra uso do Whisper (transcrição de áudio)
   * @param durationMs Duração do áudio em milissegundos
   * @param consultaId ID da consulta (opcional)
   */
  async logWhisperUsage(durationMs: number, consultaId?: string): Promise<boolean> {
    const durationMinutes = durationMs / 60000; // Converter para minutos
    const price = this.calculatePrice('whisper-1', durationMinutes);

    return this.logUsage({
      consulta_id: consultaId,
      LLM: 'whisper-1',
      token: durationMinutes, // Armazenar em minutos
      price,
      etapa: 'transcricao_whisper',
    });
  }

  /**
   * Registra uso da Realtime API (transcrição em tempo real)
   * @param durationMs Duração do áudio em milissegundos
   * @param consultaId ID da consulta (opcional)
   */
  async logRealtimeUsage(durationMs: number, consultaId?: string): Promise<boolean> {
    const durationMinutes = durationMs / 60000; // Converter para minutos
    const price = this.calculatePrice('gpt-4o-realtime-preview-2024-12-17', durationMinutes);

    return this.logUsage({
      consulta_id: consultaId,
      LLM: 'gpt-4o-realtime-preview-2024-12-17',
      token: durationMinutes, // Armazenar em minutos
      price,
      etapa: 'transcricao_realtime',
    });
  }

  /**
   * Registra uso de Chat Completion
   * @param model Modelo usado (ex: gpt-4o, gpt-4o-mini)
   * @param inputTokens Tokens de entrada
   * @param outputTokens Tokens de saída
   * @param etapa Etapa do processo
   * @param consultaId ID da consulta (opcional)
   */
  async logChatCompletionUsage(
    model: LLMType,
    inputTokens: number,
    outputTokens: number,
    etapa: AIStage,
    consultaId?: string
  ): Promise<boolean> {
    const price = this.calculatePrice(model, inputTokens, outputTokens);
    const totalTokens = inputTokens + outputTokens;

    return this.logUsage({
      consulta_id: consultaId,
      LLM: model,
      token: totalTokens,
      price,
      etapa,
    });
  }

  /**
   * Registra uso de Embeddings
   * @param model Modelo de embedding
   * @param tokens Tokens processados
   * @param consultaId ID da consulta (opcional)
   */
  async logEmbeddingUsage(
    model: 'text-embedding-3-small' | 'text-embedding-3-large',
    tokens: number,
    consultaId?: string
  ): Promise<boolean> {
    const price = this.calculatePrice(model, tokens);

    return this.logUsage({
      consulta_id: consultaId,
      LLM: model,
      token: tokens,
      price,
      etapa: 'embedding',
    });
  }

  /**
   * Obter resumo de custos por consulta
   */
  async getConsultaCosts(consultaId: string): Promise<{
    total: number;
    byEtapa: Record<string, number>;
    byModel: Record<string, number>;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('ai_pricing')
        .select('*')
        .eq('consulta_id', consultaId);

      if (error) {
        console.error('❌ Erro ao buscar custos:', error.message);
        return null;
      }

      const result = {
        total: 0,
        byEtapa: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
      };

      for (const record of data || []) {
        result.total += record.price || 0;
        
        // Por etapa
        if (record.etapa) {
          result.byEtapa[record.etapa] = (result.byEtapa[record.etapa] || 0) + (record.price || 0);
        }
        
        // Por modelo
        if (record.LLM) {
          result.byModel[record.LLM] = (result.byModel[record.LLM] || 0) + (record.price || 0);
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar custos:', error);
      return null;
    }
  }

  /**
   * Obter resumo de custos total (para dashboard)
   */
  async getTotalCosts(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    totalTester: number;
    totalProduction: number;
    byEtapa: Record<string, number>;
    byModel: Record<string, number>;
    count: number;
  } | null> {
    try {
      let query = supabase
        .from('ai_pricing')
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar custos totais:', error.message);
        return null;
      }

      const result = {
        total: 0,
        totalTester: 0,
        totalProduction: 0,
        byEtapa: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        count: data?.length || 0,
      };

      for (const record of data || []) {
        const price = record.price || 0;
        result.total += price;
        
        if (record.tester) {
          result.totalTester += price;
        } else {
          result.totalProduction += price;
        }
        
        // Por etapa
        if (record.etapa) {
          result.byEtapa[record.etapa] = (result.byEtapa[record.etapa] || 0) + price;
        }
        
        // Por modelo
        if (record.LLM) {
          result.byModel[record.LLM] = (result.byModel[record.LLM] || 0) + price;
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar custos totais:', error);
      return null;
    }
  }

  /**
   * Habilitar/desabilitar o serviço
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📊 AI Pricing Service ${enabled ? 'habilitado' : 'desabilitado'}`);
  }

  /**
   * Força um valor de tester para um registro específico
   * Útil para casos onde você já sabe se é tester
   */
  async logUsageWithTester(record: AIPricingRecord, isTester: boolean): Promise<boolean> {
    return this.logUsage({ ...record, tester: isTester });
  }
}

// Instância singleton
export const aiPricingService = new AIPricingService();
export default aiPricingService;

