/**
 * Serviço de Geração de Sugestões de IA para Consultas Médicas
 * Analisa contexto da conversa e gera sugestões inteligentes baseadas em protocolos médicos
 */

import { EventEmitter } from 'events';
import { db } from '@/config/database';
import { makeChatCompletion, makeEmbedding } from '@/config/providers';
import { PromptTemplate, PROMPT_CONFIG } from '@/prompts/medical-prompts';
import { randomUUID } from 'crypto';

export interface ContextAnalysis {
  phase: 'anamnese' | 'exame_fisico' | 'diagnostico' | 'tratamento' | 'encerramento';
  symptoms: string[];
  urgency_level: 'baixa' | 'media' | 'alta' | 'critica';
  next_steps: string[];
  missing_info: string[];
  patient_concerns: string[];
  doctor_questions_asked: string[];
  clinical_notes: string;
}

export interface AISuggestion {
  id: string;
  session_id: string;
  utterance_id?: string;
  type: 'question' | 'protocol' | 'alert' | 'followup' | 'assessment' | 'insight' | 'warning';
  content: string;
  source?: string;
  source_section?: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  used: boolean;
  used_at?: string;
  used_by?: string;
  rag_context?: any;
  created_at: string;
}

export interface SuggestionGenerationResult {
  suggestions: AISuggestion[];
  clinical_insights: string[];
  red_flags: string[];
  context_analysis: ContextAnalysis;
}

export interface ConversationContext {
  sessionId: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  sessionDuration: number;
  consultationType: string;
  utterances: any[];
  specialty?: string;
}

class SuggestionService extends EventEmitter {
  private isEnabled: boolean = false;
  private contextCache: Map<string, ContextAnalysis> = new Map();
  private suggestionHistory: Map<string, AISuggestion[]> = new Map();
  private lastSuggestionTime: Map<string, number> = new Map();
  
  // Configurações
  private readonly MIN_SUGGESTION_INTERVAL = 10000; // 10 segundos entre sugestões
  private readonly MAX_SUGGESTIONS_PER_SESSION = 20;
  private readonly CONTEXT_WINDOW_SIZE = 10; // Últimas 10 utterances
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    super();
    this.checkServiceAvailability();
  }

  private checkServiceAvailability(): void {
    const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
    
    if (hasOpenAI) {
      this.isEnabled = true;
      console.log('✅ AI Suggestion Service habilitado');
    } else {
      console.warn('⚠️ AI Suggestion Service desabilitado - Configure OPENAI_API_KEY');
      this.isEnabled = false;
    }
  }

  /**
   * Gera sugestões de IA baseadas no contexto da conversa
   */
  public async generateSuggestions(context: ConversationContext): Promise<SuggestionGenerationResult | null> {
    if (!this.isEnabled) {
      console.log('🔇 AI Suggestion Service desabilitado - usando sugestões mock');
      return this.generateMockSuggestions(context);
    }

    try {
      // Verificar se é muito cedo para gerar nova sugestão
      const lastTime = this.lastSuggestionTime.get(context.sessionId) || 0;
      const now = Date.now();
      if (now - lastTime < this.MIN_SUGGESTION_INTERVAL) {
        console.log('⏱️ Muito cedo para gerar nova sugestão');
        return null;
      }

      // Verificar limite de sugestões por sessão
      const existingSuggestions = this.suggestionHistory.get(context.sessionId) || [];
      if (existingSuggestions.length >= this.MAX_SUGGESTIONS_PER_SESSION) {
        console.log('📊 Limite de sugestões atingido para esta sessão');
        return null;
      }

      console.log(`🤖 Gerando sugestões para sessão ${context.sessionId}`);

      // 1. Analisar contexto da conversa
      const contextAnalysis = await this.analyzeContext(context);
      
      // 2. Buscar protocolos médicos relevantes
      const relevantProtocols = await this.findRelevantProtocols(contextAnalysis);
      
      // 3. Gerar sugestões baseadas no contexto e protocolos
      const suggestions = await this.generateContextualSuggestions(
        context,
        contextAnalysis,
        relevantProtocols
      );

      // 4. Filtrar e priorizar sugestões
      const filteredSuggestions = this.filterAndPrioritizeSuggestions(suggestions, context);

      // 5. Salvar sugestões no banco de dados
      const savedSuggestions = await this.saveSuggestions(filteredSuggestions, context.sessionId);

      // 6. Atualizar cache e histórico
      this.updateCache(context.sessionId, contextAnalysis, savedSuggestions);
      this.lastSuggestionTime.set(context.sessionId, now);

      const result: SuggestionGenerationResult = {
        suggestions: savedSuggestions,
        clinical_insights: this.extractClinicalInsights(contextAnalysis),
        red_flags: this.extractRedFlags(contextAnalysis),
        context_analysis: contextAnalysis
      };

      // Emitir evento para notificar frontend via WebSocket
      this.emit('suggestions:generated', {
        sessionId: context.sessionId,
        suggestions: savedSuggestions,
        context: contextAnalysis
      });

      // Notificar via WebSocket se disponível
      await this.notifyWebSocket(context.sessionId, savedSuggestions, contextAnalysis);

      console.log(`✅ ${savedSuggestions.length} sugestões geradas para sessão ${context.sessionId}`);
      return result;

    } catch (error) {
      console.error('❌ Erro ao gerar sugestões:', error);
      return null;
    }
  }

  /**
   * Analisa o contexto atual da conversa
   */
  private async analyzeContext(context: ConversationContext): Promise<ContextAnalysis> {
    try {
      const prompt = PromptTemplate.generateContextPrompt({
        patientName: context.patientName,
        patientAge: context.patientAge,
        patientGender: context.patientGender,
        sessionDuration: context.sessionDuration,
        consultationType: context.consultationType,
        utterances: context.utterances.slice(-this.CONTEXT_WINDOW_SIZE)
      });

      const response = await makeChatCompletion([
        {
          role: 'system',
          content: 'Você é um assistente médico especializado em análise de consultas clínicas. Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      let content = response.choices[0].message.content || '{}';
      
      // Limpar markdown se presente
      if (content.includes('```json')) {
        content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (content.includes('```')) {
        content = content.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Tentar extrair JSON se houver texto adicional
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      // Validar e corrigir JSON
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.warn('⚠️ JSON inválido da IA, usando fallback:', parseError.message);
        console.warn('📝 Conteúdo recebido:', content.substring(0, 200) + '...');
        
        // Fallback: análise básica baseada nos utterances
        analysis = {
          phase: 'anamnese',
          urgency_level: 'medium',
          symptoms: this.extractSymptomsFromUtterances(context.utterances),
          patient_concerns: this.extractConcernsFromUtterances(context.utterances),
          clinical_notes: 'Análise automática baseada na transcrição'
        };
      }
      
      // Validar estrutura da resposta
      if (!analysis.phase || !analysis.symptoms) {
        throw new Error('Resposta de análise de contexto inválida');
      }

      return analysis as ContextAnalysis;

    } catch (error) {
      console.error('❌ Erro na análise de contexto:', error);
      // Retornar análise padrão em caso de erro
      return {
        phase: 'anamnese',
        symptoms: [],
        urgency_level: 'baixa',
        next_steps: [],
        missing_info: [],
        patient_concerns: [],
        doctor_questions_asked: [],
        clinical_notes: 'Análise de contexto indisponível'
      };
    }
  }

  /**
   * Extrai sintomas dos utterances usando análise simples
   */
  private extractSymptomsFromUtterances(utterances: any[]): string[] {
    const symptoms: string[] = [];
    const symptomPatterns = {
      'dor': ['dor', 'dói', 'dolorido', 'dolorida', 'dores'],
      'peito': ['peito', 'tórax', 'coração', 'cardíaco'],
      'cabeça': ['cabeça', 'cranio', 'cefaléia', 'enxaqueca'],
      'respiração': ['respiração', 'respirar', 'respiratório'],
      'falta de ar': ['falta de ar', 'dispneia', 'sufocando', 'sufoco'],
      'febre': ['febre', 'temperatura', 'calor', 'quente'],
      'náusea': ['náusea', 'enjoo', 'enjoado', 'enjoada'],
      'vômito': ['vômito', 'vomitar', 'vomitando'],
      'tosse': ['tosse', 'tossindo', 'tossir'],
      'tontura': ['tontura', 'tonto', 'tonta', 'vertigem'],
      'desmaio': ['desmaio', 'desmaiar', 'desmaiando'],
      'palpitação': ['palpitação', 'batimento', 'coração acelerado'],
      'ansiedade': ['ansiedade', 'ansioso', 'ansiosa', 'nervoso', 'nervosa'],
      'depressão': ['depressão', 'deprimido', 'deprimida', 'tristeza'],
      'insônia': ['insônia', 'insone', 'dormir', 'sono'],
      'fadiga': ['fadiga', 'cansaço', 'cansado', 'cansada', 'fraco', 'fraca'],
      'diarreia': ['diarreia', 'diarréia', 'evacuação', 'cocô'],
      'estômago': ['estômago', 'barriga', 'abdômen', 'gástrico']
    };

    utterances.forEach(utterance => {
      if (utterance.speaker === 'patient') {
        const text = utterance.text.toLowerCase();
        
        // Buscar padrões de sintomas
        Object.entries(symptomPatterns).forEach(([symptom, patterns]) => {
          const found = patterns.some(pattern => text.includes(pattern));
          if (found && !symptoms.includes(symptom)) {
            symptoms.push(symptom);
          }
        });
      }
    });

    return symptoms;
  }

  /**
   * Extrai preocupações do paciente dos utterances
   */
  private extractConcernsFromUtterances(utterances: any[]): string[] {
    const concerns: string[] = [];
    
    utterances.forEach(utterance => {
      if (utterance.speaker === 'patient') {
        // Extrair frases que indicam preocupação
        const text = utterance.text.toLowerCase();
        if (text.includes('preocupado') || text.includes('medo') || text.includes('ansioso')) {
          concerns.push(utterance.text);
        }
      }
    });

    return concerns;
  }

  /**
   * Gera sugestões básicas quando a IA falha
   */
  private generateFallbackSuggestions(contextAnalysis: ContextAnalysis): any[] {
    const suggestions = [];
    const symptoms = contextAnalysis.symptoms;
    const concerns = contextAnalysis.patient_concerns;
    const phase = contextAnalysis.phase;

    // Sugestões baseadas nos sintomas detectados com variações
    if (symptoms.includes('dor')) {
      const painQuestions = [
        'Você pode descrever melhor a dor? Onde exatamente dói?',
        'Como você classificaria a intensidade da dor de 0 a 10?',
        'A dor é constante ou vem em ondas?',
        'Você já sentiu essa dor antes?',
        'A dor melhora ou piora com alguma posição?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(painQuestions),
        source: 'Protocolo de Avaliação de Dor',
        confidence: 0.9,
        priority: 'high'
      });
    }

    if (symptoms.includes('peito')) {
      const chestQuestions = [
        'A dor no peito irradia para algum lugar? Braço, pescoço, mandíbula?',
        'Você sente pressão ou aperto no peito?',
        'A dor no peito piora com esforço físico?',
        'Você tem histórico de problemas cardíacos na família?',
        'Você sente palpitações ou batimentos irregulares?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(chestQuestions),
        source: 'Protocolo Cardiovascular',
        confidence: 0.9,
        priority: 'critical'
      });
    }

    if (symptoms.includes('respiração') || symptoms.includes('falta de ar')) {
      const breathingQuestions = [
        'Você sente falta de ar em repouso ou apenas com esforço?',
        'Você tem tosse? Se sim, é seca ou com catarro?',
        'Você já teve problemas respiratórios antes?',
        'Você fuma ou já fumou?',
        'Você sente chiado no peito?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(breathingQuestions),
        source: 'Protocolo Respiratório',
        confidence: 0.9,
        priority: 'high'
      });
    }

    if (symptoms.includes('cabeça')) {
      const headacheQuestions = [
        'Como você descreveria a dor de cabeça? Latejante, pressão, pontada?',
        'A dor de cabeça é acompanhada de náusea ou vômito?',
        'Você tem sensibilidade à luz ou ao barulho?',
        'Você já teve esse tipo de dor de cabeça antes?',
        'A dor de cabeça começou de repente ou gradualmente?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(headacheQuestions),
        source: 'Protocolo Neurológico',
        confidence: 0.9,
        priority: 'high'
      });
    }

    if (symptoms.includes('febre')) {
      const feverQuestions = [
        'Você mediu a temperatura? Qual foi a temperatura mais alta?',
        'A febre é acompanhada de calafrios ou suor?',
        'Você tem outros sintomas além da febre?',
        'A febre começou quando?',
        'Você tomou algum medicamento para a febre?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(feverQuestions),
        source: 'Protocolo de Febre',
        confidence: 0.9,
        priority: 'high'
      });
    }

    if (symptoms.includes('estômago')) {
      const stomachQuestions = [
        'Você pode descrever a dor no estômago? É queimação, cólica ou pontada?',
        'A dor no estômago melhora ou piora com a alimentação?',
        'Você tem náusea ou vômito?',
        'Você notou alguma mudança no apetite?',
        'Você tem histórico de problemas gástricos?',
        'Você toma algum medicamento para o estômago?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(stomachQuestions),
        source: 'Protocolo Gastrointestinal',
        confidence: 0.9,
        priority: 'high'
      });
    }

    if (symptoms.includes('diarreia')) {
      const diarrheaQuestions = [
        'Há quanto tempo você está com diarreia?',
        'Quantas evacuações você tem por dia?',
        'A diarreia é acompanhada de sangue ou muco?',
        'Você tem dor abdominal junto com a diarreia?',
        'Você tem febre junto com a diarreia?',
        'Você viajou recentemente ou comeu algo diferente?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(diarrheaQuestions),
        source: 'Protocolo Gastrointestinal',
        confidence: 0.9,
        priority: 'high'
      });
    }

    // Sugestões baseadas na fase da consulta
    if (phase === 'anamnese' && suggestions.length < 3) {
      const anamnesisQuestions = [
        'Você pode me contar mais sobre o que está sentindo?',
        'Quando os sintomas começaram?',
        'Você já teve sintomas similares antes?',
        'Você está tomando algum medicamento atualmente?',
        'Você tem alguma alergia conhecida?',
        'Como está seu apetite e sono?',
        'Você tem histórico de doenças na família?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(anamnesisQuestions),
        source: 'Protocolo de Anamnese',
        confidence: 0.8,
        priority: 'medium'
      });
    }

    if (phase === 'exame_fisico' && suggestions.length < 3) {
      const examQuestions = [
        'Vou examinar você agora. Você tem alguma área específica que dói mais?',
        'Você pode me mostrar onde exatamente sente a dor?',
        'A dor piora quando pressiono aqui?',
        'Você consegue fazer movimentos normais?',
        'Vou verificar seus sinais vitais agora.'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(examQuestions),
        source: 'Protocolo de Exame Físico',
        confidence: 0.8,
        priority: 'medium'
      });
    }

    // Sugestões gerais se não há sintomas específicos ou poucas sugestões
    if (suggestions.length === 0) {
      const generalQuestions = [
        'Você pode me contar mais sobre o que está sentindo?',
        'Como posso ajudá-lo hoje?',
        'Você tem alguma preocupação específica?',
        'Quando foi a última vez que você se sentiu bem?',
        'Você notou alguma mudança recente em sua saúde?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(generalQuestions),
        source: 'Protocolo de Anamnese',
        confidence: 0.8,
        priority: 'medium'
      });
    }

    // Adicionar sugestões de acompanhamento se já temos algumas
    if (suggestions.length > 0 && suggestions.length < 4) {
      const followUpQuestions = [
        'Você tem mais algum sintoma que gostaria de mencionar?',
        'Há algo mais que você gostaria de me contar?',
        'Você tem alguma dúvida sobre seus sintomas?',
        'Como isso está afetando seu dia a dia?'
      ];
      suggestions.push({
        type: 'question',
        content: this.getRandomSuggestion(followUpQuestions),
        source: 'Protocolo de Acompanhamento',
        confidence: 0.7,
        priority: 'low'
      });
    }

    // Limitar a 4 sugestões e embaralhar
    return this.shuffleArray(suggestions).slice(0, 4);
  }

  /**
   * Seleciona uma sugestão aleatória de uma lista
   */
  private getRandomSuggestion(suggestions: string[]): string {
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /**
   * Embaralha um array
   */
  private shuffleArray(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Gera sugestões de emergência quando a IA falha
   */
  private generateEmergencyFallbackSuggestions(contextAnalysis: ContextAnalysis): any[] {
    const suggestions = [];

    if (contextAnalysis.symptoms.includes('peito')) {
      suggestions.push({
        type: 'warning',
        content: '⚠️ Dor no peito pode indicar emergência cardiovascular. Avalie sinais vitais imediatamente.',
        source: 'Protocolo de Emergência Cardiovascular',
        confidence: 1.0
      });
    }

    if (contextAnalysis.symptoms.includes('respiração') || contextAnalysis.symptoms.includes('falta de ar')) {
      suggestions.push({
        type: 'warning',
        content: '⚠️ Dispneia pode indicar emergência respiratória. Monitore saturação de oxigênio.',
        source: 'Protocolo de Emergência Respiratória',
        confidence: 1.0
      });
    }

    return suggestions;
  }

  /**
   * Busca protocolos médicos relevantes usando busca simples
   */
  private async findRelevantProtocols(contextAnalysis: ContextAnalysis): Promise<any[]> {
    try {
      // Por enquanto, retornar protocolos básicos baseados nos sintomas
      const basicProtocols = [
        {
          id: 'protocol-1',
          title: 'Protocolo de Anamnese - Clínica Geral',
          source: 'Manual de Procedimentos Clínicos',
          content: 'PROTOCOLO DE ANAMNESE - CLÍNICA GERAL\n\n1. IDENTIFICAÇÃO DO PACIENTE\n2. QUEIXA PRINCIPAL\n3. HISTÓRIA DA DOENÇA ATUAL\n4. SINTOMAS ASSOCIADOS\n5. HISTÓRIA PATOLÓGICA PREGRESSA\n6. MEDICAÇÕES EM USO\n7. HISTÓRIA FAMILIAR\n8. HISTÓRIA SOCIAL'
        },
        {
          id: 'protocol-2',
          title: 'Perguntas Padronizadas - Dor',
          source: 'Guia de Consulta Clínica',
          content: 'PERGUNTAS PADRONIZADAS PARA AVALIAÇÃO DE DOR\n\n1. LOCALIZAÇÃO\n2. CARACTERÍSTICAS\n3. INTENSIDADE\n4. DURAÇÃO E EVOLUÇÃO\n5. FATORES DESENCADEANTES\n6. SINTOMAS ASSOCIADOS\n7. TRATAMENTOS PRÉVIOS'
        }
      ];

      // Filtrar protocolos baseados nos sintomas mencionados
      const relevantProtocols = basicProtocols.filter(protocol => {
        const symptoms = contextAnalysis.symptoms.join(' ').toLowerCase();
        const protocolContent = protocol.content.toLowerCase();
        
        // Buscar palavras-chave relacionadas aos sintomas
        const keywords = ['dor', 'peito', 'cabeça', 'respiração', 'febre', 'náusea'];
        return keywords.some(keyword => 
          symptoms.includes(keyword) && protocolContent.includes(keyword)
        );
      });

      console.log(`📚 ${relevantProtocols.length} protocolos relevantes encontrados`);
      return relevantProtocols;

    } catch (error) {
      console.error('❌ Erro na busca de protocolos:', error);
      return [];
    }
  }

  /**
   * Gera sugestões contextualizadas
   */
  private async generateContextualSuggestions(
    context: ConversationContext,
    contextAnalysis: ContextAnalysis,
    relevantProtocols: any[]
  ): Promise<AISuggestion[]> {
    try {
      // Determinar se é situação de emergência
      if (contextAnalysis.urgency_level === 'critica') {
        return await this.generateEmergencySuggestions(contextAnalysis);
      }

      // Gerar sugestões normais
      const prompt = PromptTemplate.generateSuggestionPrompt({
        contextAnalysis,
        relevantProtocols,
        alreadyAskedQuestions: contextAnalysis.doctor_questions_asked,
        currentPhase: contextAnalysis.phase,
        urgencyLevel: contextAnalysis.urgency_level,
        mentionedSymptoms: contextAnalysis.symptoms
      });

      const response = await makeChatCompletion([
        {
          role: 'system',
          content: 'Você é um médico experiente auxiliando um colega. Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      let content = response.choices[0].message.content || '{}';
      
      // Limpar markdown se presente
      if (content.includes('```json')) {
        content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (content.includes('```')) {
        content = content.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Tentar extrair JSON se houver texto adicional
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      // Validar e corrigir JSON
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.warn('⚠️ JSON inválido na geração de sugestões, usando fallback:', parseError.message);
        console.warn('📝 Conteúdo recebido:', content.substring(0, 200) + '...');
        
        // Fallback: sugestões básicas baseadas no contexto
        result = {
          suggestions: this.generateFallbackSuggestions(contextAnalysis)
        };
      }
      
      // Converter para formato AISuggestion
      const suggestions: AISuggestion[] = (result.suggestions || []).map((s: any) => ({
        id: randomUUID(),
        session_id: context.sessionId,
        type: s.type,
        content: s.content,
        source: s.source,
        confidence: s.confidence || 0.8,
        priority: s.priority || 'medium',
        used: false,
        rag_context: relevantProtocols,
        created_at: new Date().toISOString()
      }));

      return suggestions;

    } catch (error) {
      console.error('❌ Erro ao gerar sugestões contextualizadas:', error);
      return [];
    }
  }

  /**
   * Gera sugestões para situações de emergência
   */
  private async generateEmergencySuggestions(contextAnalysis: ContextAnalysis): Promise<AISuggestion[]> {
    const prompt = PromptTemplate.generateEmergencyPrompt({
      criticalSymptoms: contextAnalysis.symptoms
    });

    try {
      const response = await makeChatCompletion([
        {
          role: 'system',
          content: 'Você é um médico de emergência. Responda APENAS com JSON válido, sem markdown, sem ```json, sem texto adicional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      let content = response.choices[0].message.content || '{}';
      
      // Limpar markdown se presente
      if (content.includes('```json')) {
        content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (content.includes('```')) {
        content = content.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Tentar extrair JSON se houver texto adicional
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      // Validar e corrigir JSON
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.warn('⚠️ JSON inválido nas sugestões de emergência, usando fallback:', parseError.message);
        console.warn('📝 Conteúdo recebido:', content.substring(0, 200) + '...');
        
        // Fallback: sugestões básicas de emergência
        result = {
          emergency_suggestions: this.generateEmergencyFallbackSuggestions(contextAnalysis)
        };
      }
      
      return (result.emergency_suggestions || []).map((s: any) => ({
        id: randomUUID(),
        session_id: '', // Será preenchido pelo caller
        type: s.type,
        content: s.content,
        source: s.source,
        confidence: s.confidence || 1.0,
        priority: 'critical',
        used: false,
        created_at: new Date().toISOString()
      }));

    } catch (error) {
      console.error('❌ Erro ao gerar sugestões de emergência:', error);
      return [];
    }
  }

  /**
   * Filtra e prioriza sugestões
   */
  private filterAndPrioritizeSuggestions(
    suggestions: AISuggestion[],
    context: ConversationContext
  ): AISuggestion[] {
    return suggestions
      .filter(s => s.confidence >= this.CONFIDENCE_THRESHOLD)
      .sort((a, b) => {
        // Priorizar por nível de prioridade
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 2;
        const bPriority = priorityOrder[b.priority] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // Em caso de empate, priorizar por confiança
        return b.confidence - a.confidence;
      })
      .slice(0, 5); // Máximo 5 sugestões por vez
  }

  /**
   * Salva sugestões no banco de dados
   */
  private async saveSuggestions(suggestions: AISuggestion[], sessionId: string): Promise<AISuggestion[]> {
    const savedSuggestions: AISuggestion[] = [];

    for (const suggestion of suggestions) {
      try {
        const saved = await db.createSuggestion({
          ...suggestion,
          session_id: sessionId
        });

        if (saved) {
          savedSuggestions.push(saved);
        }
      } catch (error) {
        console.error('❌ Erro ao salvar sugestão:', error);
      }
    }

    return savedSuggestions;
  }

  /**
   * Atualiza cache interno
   */
  private updateCache(sessionId: string, contextAnalysis: ContextAnalysis, suggestions: AISuggestion[]): void {
    this.contextCache.set(sessionId, contextAnalysis);
    
    const existingSuggestions = this.suggestionHistory.get(sessionId) || [];
    this.suggestionHistory.set(sessionId, [...existingSuggestions, ...suggestions]);
  }

  /**
   * Extrai insights clínicos do contexto
   */
  private extractClinicalInsights(contextAnalysis: ContextAnalysis): string[] {
    const insights: string[] = [];

    if (contextAnalysis.symptoms.length > 0) {
      insights.push(`Sintomas identificados: ${contextAnalysis.symptoms.join(', ')}`);
    }

    if (contextAnalysis.missing_info.length > 0) {
      insights.push(`Informações em falta: ${contextAnalysis.missing_info.join(', ')}`);
    }

    if (contextAnalysis.clinical_notes) {
      insights.push(`Observações clínicas: ${contextAnalysis.clinical_notes}`);
    }

    return insights;
  }

  /**
   * Extrai sinais de alerta do contexto
   */
  private extractRedFlags(contextAnalysis: ContextAnalysis): string[] {
    const redFlags: string[] = [];

    if (contextAnalysis.urgency_level === 'critica') {
      redFlags.push('Situação crítica detectada - requer atenção imediata');
    }

    if (contextAnalysis.urgency_level === 'alta') {
      redFlags.push('Sintomas de alta urgência identificados');
    }

    // Adicionar mais lógica de detecção de red flags baseada nos sintomas
    const criticalSymptoms = ['dor torácica', 'falta de ar', 'perda de consciência', 'sangramento'];
    const mentionedCriticalSymptoms = contextAnalysis.symptoms.filter(symptom => 
      criticalSymptoms.some(critical => symptom.toLowerCase().includes(critical))
    );

    if (mentionedCriticalSymptoms.length > 0) {
      redFlags.push(`Sintomas críticos mencionados: ${mentionedCriticalSymptoms.join(', ')}`);
    }

    return redFlags;
  }

  /**
   * Gera sugestões mock para desenvolvimento/teste
   */
  private generateMockSuggestions(context: ConversationContext): SuggestionGenerationResult {
    const mockSuggestions: AISuggestion[] = [
      {
        id: randomUUID(),
        session_id: context.sessionId,
        type: 'question',
        content: 'Como você descreveria a intensidade da dor?',
        source: 'Protocolo Mock',
        confidence: 0.85,
        priority: 'medium',
        used: false,
        created_at: new Date().toISOString()
      },
      {
        id: randomUUID(),
        session_id: context.sessionId,
        type: 'assessment',
        content: 'Há quanto tempo você está com esses sintomas?',
        source: 'Protocolo Mock',
        confidence: 0.9,
        priority: 'high',
        used: false,
        created_at: new Date().toISOString()
      }
    ];

    return {
      suggestions: mockSuggestions,
      clinical_insights: ['Análise mock ativa'],
      red_flags: [],
      context_analysis: {
        phase: 'anamnese',
        symptoms: ['dor'],
        urgency_level: 'media',
        next_steps: ['continuar anamnese'],
        missing_info: ['duração dos sintomas'],
        patient_concerns: ['dor'],
        doctor_questions_asked: [],
        clinical_notes: 'Modo mock ativo'
      }
    };
  }

  /**
   * Marca uma sugestão como usada
   */
  public async markSuggestionAsUsed(suggestionId: string, userId: string): Promise<boolean> {
    try {
      const success = await db.markSuggestionAsUsed(suggestionId);
      
      if (success) {
        this.emit('suggestion:used', {
          suggestionId,
          userId,
          timestamp: new Date().toISOString()
        });
      }

      return success;
    } catch (error) {
      console.error('❌ Erro ao marcar sugestão como usada:', error);
      return false;
    }
  }

  /**
   * Obtém sugestões existentes de uma sessão
   */
  public async getSessionSuggestions(sessionId: string): Promise<AISuggestion[]> {
    try {
      return await db.getSessionSuggestions(sessionId);
    } catch (error) {
      console.error('❌ Erro ao obter sugestões da sessão:', error);
      return [];
    }
  }

  /**
   * Limpa cache de uma sessão
   */
  public clearSessionCache(sessionId: string): void {
    this.contextCache.delete(sessionId);
    this.suggestionHistory.delete(sessionId);
    this.lastSuggestionTime.delete(sessionId);
  }

  /**
   * Notifica via WebSocket (se disponível)
   */
  private async notifyWebSocket(sessionId: string, suggestions: AISuggestion[], contextAnalysis: ContextAnalysis): Promise<void> {
    try {
      // Tentar obter instância do WebSocket notifier
      const { SessionNotifier } = await import('@/websocket/index');
      
      // Esta é uma implementação simplificada - em produção, você teria uma referência global ao notifier
      console.log(`📡 WebSocket notification preparada para sessão ${sessionId}: ${suggestions.length} sugestões`);
      
    } catch (error) {
      // WebSocket não disponível - não é crítico
      console.log('📡 WebSocket notifier não disponível - sugestões salvas no banco');
    }
  }

  /**
   * Obtém estatísticas do serviço
   */
  public getServiceStats(): any {
    return {
      isEnabled: this.isEnabled,
      activeSessions: this.contextCache.size,
      totalSuggestions: Array.from(this.suggestionHistory.values()).reduce(
        (total, suggestions) => total + suggestions.length, 0
      ),
      config: {
        minSuggestionInterval: this.MIN_SUGGESTION_INTERVAL,
        maxSuggestionsPerSession: this.MAX_SUGGESTIONS_PER_SESSION,
        contextWindowSize: this.CONTEXT_WINDOW_SIZE,
        confidenceThreshold: this.CONFIDENCE_THRESHOLD
      }
    };
  }
}

// Instância singleton do serviço
export const suggestionService = new SuggestionService();
export default suggestionService;
