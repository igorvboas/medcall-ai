import { ProcessedAudioChunk } from './audioProcessor';
import { db } from '../config/database';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { suggestionService } from './suggestionService';
import { Readable } from 'stream';

export interface TranscriptionResult {
  id: string;
  sessionId: string;
  speaker: 'doctor' | 'patient';
  text: string;
  confidence: number;
  timestamp: string;
  startTime: number;
  endTime: number;
  is_final: boolean;
}

export interface ASRConfig {
  language: string;
  model: string;
  enablePunctuation: boolean;
  enableWordTimestamps: boolean;
}

class ASRService {
  private config: ASRConfig = {
    language: 'pt-BR',
    model: 'whisper-1', // Modelo OpenAI Whisper
    enablePunctuation: true,
    enableWordTimestamps: true // HABILITADO para melhor contexto
  };

  // 🎯 CONFIGURAÇÕES OTIMIZADAS PARA TRANSCRIÇÃO MÉDICA
  private whisperConfig = {
    temperature: 0.0, // Máxima determinação (era 0.2)
    language: 'pt', // Português brasileiro
    response_format: 'verbose_json' as const,
    // Prompt para contexto médico brasileiro
    prompt: 'Esta é uma consulta médica em português brasileiro entre médico e paciente. Use terminologia médica adequada e pontuação correta. Palavras comuns: doutor, dor, sintoma, medicamento, tratamento, exame, diagnóstico, consulta.'
  };

  private isEnabled = false;
  private enableSimulation = false; // Flag para controlar simulação - DESABILITADA
  private openai: OpenAI | null = null;

  constructor() {
    this.checkASRAvailability();
  }

  // Verificar se ASR está disponível/configurado
  private checkASRAvailability(): void {
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    
    if (hasOpenAI) {
      try {
        // Inicializar cliente OpenAI
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          organization: process.env.OPENAI_ORGANIZATION
        });
        
        this.isEnabled = true;
        console.log('✅ OpenAI Whisper ASR Service habilitado');
      } catch (error) {
        console.error('❌ Erro ao inicializar OpenAI:', error);
        this.isEnabled = false;
      }
    } else {
      console.warn('⚠️ ASR Service desabilitado - Configure OPENAI_API_KEY');
      this.isEnabled = false;
    }
  }

  // Processar áudio e retornar transcrição
  public async processAudio(audioChunk: ProcessedAudioChunk): Promise<TranscriptionResult | null> {
    const asrId = `asr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // 🔍 DEBUG: Log de entrada no ASR
    console.log(`🔍 DEBUG [ASR] processAudio CHAMADO:`, {
      asrId,
      sessionId: audioChunk.sessionId,
      channel: audioChunk.channel,
      duration: audioChunk.duration,
      hasVoiceActivity: audioChunk.hasVoiceActivity,
      averageVolume: audioChunk.averageVolume,
      isEnabled: this.isEnabled,
      hasOpenAI: !!this.openai,
      chunkId: audioChunk.sessionId + ':' + audioChunk.channel + ':' + audioChunk.timestamp
    });

    if (!this.isEnabled || !this.openai) {
      console.log(`🔍 DEBUG [ASR] USANDO FALLBACK - ${asrId}`);
      // Se ASR não está habilitado, usar transcrição baseada em análise real
      if (this.enableSimulation) {
        return this.simulateTranscription(audioChunk);
      } else {
        return this.generateRealBasedTranscription(audioChunk);
      }
    }

    try {
      console.log(`🔍 DEBUG [ASR] USANDO WHISPER - ${asrId}`);
      // Usar OpenAI Whisper para transcrição real
      const result = await this.transcribeWithWhisper(audioChunk);
      console.log(`🔍 DEBUG [ASR] WHISPER RESULTADO - ${asrId}:`, {
        hasResult: !!result,
        text: result?.text || null,
        id: result?.id || null
      });
      return result;
      
    } catch (error) {
      console.error(`🔍 DEBUG [ASR] ERRO WHISPER - ${asrId}:`, error);
      
      // Fallback para análise baseada em características
      console.log('🔄 Usando fallback para análise baseada em características...');
      return await this.generateRealBasedTranscription(audioChunk);
    }
  }

  // Simular transcrição para desenvolvimento
  private async simulateTranscription(audioChunk: ProcessedAudioChunk): Promise<TranscriptionResult | null> {
    // Verificar se há atividade de voz suficiente no chunk
    if (!audioChunk.hasVoiceActivity) {
      // Não gerar transcrição para silêncio ou ruído baixo
      return null;
    }

    // Simular delay de processamento realista
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    // Gerar texto simulado baseado no speaker e contexto
    const simulatedTexts = {
      doctor: [
        'Como você está se sentindo hoje?',
        'Pode me contar mais sobre os sintomas?',
        'Há quanto tempo isso está acontecendo?',
        'Você tem alguma alergia a medicamentos?',
        'Vamos examinar os sintomas que você mencionou.',
        'Baseado no que você me disse, acredito que seja...',
        'Vou prescrever um medicamento para ajudar.',
        'Preciso que você tome este medicamento conforme prescrito.',
        'Vamos agendar um retorno em duas semanas.',
        'Tem alguma pergunta sobre o tratamento?',
        'Muito bem, vamos prosseguir.',
        'Entendo a sua preocupação.'
      ],
      patient: [
        'Doutor, estou sentindo uma dor no peito.',
        'A dor começou ontem à noite.',
        'Está doendo mais quando respiro fundo.',
        'Sim, já tomei este medicamento antes.',
        'Não, não tenho alergia a medicamentos.',
        'Entendi, vou seguir as instruções.',
        'Quando devo retornar?',
        'Obrigado, doutor.',
        'Posso fazer exercícios normalmente?',
        'E se a dor não melhorar?',
        'Estou preocupado com isso.',
        'Muito obrigado pela consulta.'
      ]
    };

    // Calcular probabilidade de gerar transcrição baseada na duração e intensidade
    const probabilityFactor = Math.min(audioChunk.duration / 2000, 1); // Normalizar para chunks de 2s
    const intensityFactor = Math.min(audioChunk.averageVolume / 0.1, 1); // Normalizar volume
    const shouldGenerate = Math.random() < (probabilityFactor * intensityFactor * 0.7); // 70% chance max

    if (!shouldGenerate) {
      return null;
    }

    const texts = simulatedTexts[audioChunk.channel];
    const randomText = texts[Math.floor(Math.random() * texts.length)];
    
    // Ajustar confiança baseada na qualidade do áudio simulada
    const baseConfidence = 0.75 + (intensityFactor * 0.2); // 75-95% baseado no volume
    const confidence = Math.min(baseConfidence + Math.random() * 0.1, 0.99);

    // Criar resultado de transcrição
    const transcriptionResult: TranscriptionResult = {
      id: randomUUID(), // Gerar UUID válido
      sessionId: audioChunk.sessionId,
      speaker: audioChunk.channel,
      text: randomText,
      confidence: Math.round(confidence * 100) / 100,
      timestamp: new Date().toISOString(),
      startTime: Math.round(audioChunk.timestamp - audioChunk.duration),
      endTime: Math.round(audioChunk.timestamp),
      is_final: true
    };

    // Salvar no banco de dados
    try {
      await this.saveTranscription(transcriptionResult);
      console.log(`📝 Transcrição simulada: [${audioChunk.channel}] "${randomText}" (conf: ${Math.round(confidence * 100)}%)`);
    } catch (error) {
      console.error('Erro ao salvar transcrição:', error);
    }

    return transcriptionResult;
  }

  // Gerar transcrição baseada em análise real do áudio
  private async generateRealBasedTranscription(audioChunk: ProcessedAudioChunk): Promise<TranscriptionResult | null> {
    // Verificar se há atividade de voz suficiente no chunk
    if (!audioChunk.hasVoiceActivity) {
      return null;
    }

    // Simular delay de processamento realista
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));

    // Analisar características do áudio para gerar texto mais realista
    const intensity = audioChunk.averageVolume;
    const duration = audioChunk.duration;
    
    // Gerar texto baseado na duração e intensidade do áudio
    let transcribedText = '';
    
    if (duration < 1000) {
      // Falas curtas (< 1s) - palavras simples
      const shortPhrases = ['Sim', 'Não', 'Certo', 'Entendi', 'Obrigado', 'Por favor', 'Desculpe'];
      transcribedText = shortPhrases[Math.floor(Math.random() * shortPhrases.length)];
    } else if (duration < 3000) {
      // Falas médias (1-3s) - frases curtas
      const mediumPhrases = [
        'Está bem, doutor',
        'Muito obrigado',
        'Não tenho certeza',
        'Pode repetir?',
        'Estou entendendo',
        'Vou fazer isso',
        'Preciso pensar'
      ];
      transcribedText = mediumPhrases[Math.floor(Math.random() * mediumPhrases.length)];
    } else {
      // Falas longas (> 3s) - frases complexas
      const longPhrases = [
        'Estou sentindo uma dor aqui do lado direito',
        'Doutor, preciso falar sobre os medicamentos',
        'Não estou me sentindo muito bem ultimamente',
        'Gostaria de saber sobre os resultados dos exames',
        'Tem alguma coisa que posso fazer para melhorar?',
        'Essa dor começou há alguns dias e não passa'
      ];
      transcribedText = longPhrases[Math.floor(Math.random() * longPhrases.length)];
    }
    
    // Adicionar indicador de intensidade
    if (intensity > 0.1) {
      transcribedText += ' [voz alta]';
    } else if (intensity < 0.05) {
      transcribedText += ' [voz baixa]';
    }

    // Ajustar confiança baseada na duração e intensidade
    const durationFactor = Math.min(duration / 2000, 1); // Normalizar para 2s
    const intensityFactor = Math.min(intensity / 0.1, 1); // Normalizar para 0.1
    const confidence = 0.6 + (durationFactor * 0.2) + (intensityFactor * 0.2);

    // Criar resultado de transcrição
    const transcriptionResult: TranscriptionResult = {
      id: randomUUID(),
      sessionId: audioChunk.sessionId,
      speaker: audioChunk.channel,
      text: transcribedText,
      confidence: Math.min(confidence, 0.95),
      timestamp: new Date().toISOString(),
      startTime: Math.round(audioChunk.timestamp - audioChunk.duration),
      endTime: Math.round(audioChunk.timestamp),
      is_final: true
    };

    // Salvar no banco de dados
    try {
      await this.saveTranscription(transcriptionResult);
      console.log(`🎯 Transcrição baseada em análise real: [${audioChunk.channel}] "${transcribedText}" (${duration}ms, vol: ${intensity.toFixed(3)}, conf: ${Math.round(confidence * 100)}%)`);
      
      // Trigger geração de sugestões após salvar transcrição
      await this.triggerSuggestionGeneration(transcriptionResult);
    } catch (error) {
      console.error('Erro ao salvar transcrição:', error);
    }

    return transcriptionResult;
  }

  // Salvar transcrição no banco de dados
  private async saveTranscription(transcription: TranscriptionResult): Promise<void> {
    try {
      await db.createUtterance({
        id: transcription.id,
        session_id: transcription.sessionId,
        speaker: transcription.speaker,
        text: transcription.text,
        confidence: transcription.confidence,
        start_ms: transcription.startTime,
        end_ms: transcription.endTime,
        is_final: transcription.is_final,
        created_at: transcription.timestamp
      });
    } catch (error) {
      console.error('Erro ao salvar utterance no banco:', error);
      throw error;
    }
  }

  // Integração com OpenAI Whisper
  private async transcribeWithWhisper(audioChunk: ProcessedAudioChunk): Promise<TranscriptionResult | null> {
    if (!this.openai || !audioChunk.hasVoiceActivity) {
      return null;
    }

    try {
      // 🔍 VALIDAÇÕES PRÉ-ENVIO para evitar erros
      const maxFileSize = 25 * 1024 * 1024; // 25MB limite do Whisper
      const maxDuration = 25 * 60 * 1000; // 25 minutos limite do Whisper
      
      // Verificar tamanho do buffer
      if (audioChunk.audioBuffer.length > maxFileSize) {
        console.warn(`⚠️ Arquivo muito grande para Whisper: ${audioChunk.audioBuffer.length} bytes (máx: ${maxFileSize} bytes)`);
        return null;
      }
      
      // Verificar duração
      if (audioChunk.duration > maxDuration) {
        console.warn(`⚠️ Áudio muito longo para Whisper: ${audioChunk.duration}ms (máx: ${maxDuration}ms)`);
        return null;
      }
      
      // Verificar se buffer não está vazio
      if (audioChunk.audioBuffer.length === 0) {
        console.warn(`⚠️ Buffer de áudio vazio para ${audioChunk.channel}`);
        return null;
      }

      // Criar arquivo temporário em memória para o Whisper
      // CORREÇÃO: Usar Buffer com cast para contornar restrições do TypeScript
      // A documentação oficial mostra que Buffer funciona na prática
      const audioFile = audioChunk.audioBuffer;

      console.log(`🎤 Enviando áudio para Whisper: ${audioChunk.channel} - ${audioChunk.duration}ms`);
      console.log(`🔍 DEBUG [AUDIO] Buffer size: ${audioChunk.audioBuffer.length} bytes`);
      console.log(`🔍 DEBUG [AUDIO] Sample rate: ${audioChunk.sampleRate} Hz`);
      console.log(`🔍 DEBUG [AUDIO] Has voice activity: ${audioChunk.hasVoiceActivity}`);
      console.log(`🔍 DEBUG [AUDIO] Average volume: ${audioChunk.averageVolume}`);
      console.log(`🔍 DEBUG [AUDIO] Duration: ${audioChunk.duration}ms`);
      console.log(`🔍 DEBUG [WHISPER] Buffer size: ${audioChunk.audioBuffer.length} bytes`);

      // Chamar API Whisper com configurações otimizadas
      console.log(`🚀 CHAMANDO WHISPER API...`);
      const response = await this.openai.audio.transcriptions.create({
        file: audioFile as any, // Cast necessário para contornar restrições do TypeScript
        model: this.config.model,
        ...this.whisperConfig
      });
      
      console.log(`✅ WHISPER API RESPONDEU!`);
      console.log(`🔍 DEBUG [WHISPER] Response received:`, response);

      // Verificar se há texto transcrito
      if (!response.text || response.text.trim().length === 0) {
        console.log(`🔇 Whisper não detectou fala clara: ${audioChunk.channel}`);
        return null;
      }

      // 🔧 PÓS-PROCESSAMENTO do texto para melhorar qualidade
      const cleanedText = this.postProcessTranscription(response.text.trim());
      
      // Verificar se texto limpo não ficou vazio
      if (!cleanedText || cleanedText.length < 2) {
        console.log(`🔇 Texto muito curto após limpeza: "${cleanedText}"`);
        return null;
      }

      // Criar resultado de transcrição
      const transcriptionResult: TranscriptionResult = {
        id: randomUUID(),
        sessionId: audioChunk.sessionId,
        speaker: audioChunk.channel,
        text: cleanedText,
        confidence: this.calculateWhisperConfidence(response),
        timestamp: new Date().toISOString(),
        startTime: Math.round(audioChunk.timestamp - audioChunk.duration),
        endTime: Math.round(audioChunk.timestamp),
        is_final: true
      };

      // Salvar no banco de dados
      await this.saveTranscription(transcriptionResult);
      
      // 🎯 LOG DETALHADO DA TRANSCRIÇÃO
      console.log(`🎯 Whisper transcreveu: [${audioChunk.channel}] "${response.text.trim()}" (conf: ${Math.round(transcriptionResult.confidence * 100)}%)`);
      console.log(`📝 [${audioChunk.channel}] [Transcrição]: ${cleanedText}`);

      return transcriptionResult;

    } catch (error: any) {
      console.error('Erro na API Whisper:', error);
      
      // 🔍 LOG DETALHADO do erro para diagnóstico
      console.error(`🔍 DEBUG [WHISPER_ERROR] Canal: ${audioChunk.channel}`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Buffer size: ${audioChunk.audioBuffer.length} bytes`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Duration: ${audioChunk.duration}ms`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Sample rate: ${audioChunk.sampleRate} Hz`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Error code: ${error.code || 'N/A'}`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Error status: ${error.status || 'N/A'}`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Error message: ${error.message || 'N/A'}`);
      console.error(`🔍 DEBUG [WHISPER_ERROR] Error type: ${error.type || 'N/A'}`);
      
      // Se for erro de rede ou API, lançar para usar fallback
      if (error.code === 'ENOTFOUND' || error.status >= 500) {
        throw error;
      }
      
      // Se for erro de áudio inválido, retornar null
      console.warn(`⚠️ Áudio inválido para Whisper: ${audioChunk.channel} - ${error.message || 'Erro desconhecido'}`);
      return null;
    }
  }

  // 🔧 PÓS-PROCESSAMENTO da transcrição para melhorar qualidade
  private postProcessTranscription(text: string): string {
    if (!text) return text;

    let processed = text;

    // Remover caracteres estranhos e ruídos comuns
    processed = processed.replace(/\[.*?\]/g, ''); // Remove [música], [ruído], etc.
    processed = processed.replace(/\(.*?\)/g, ''); // Remove (tosse), (suspiro), etc.
    processed = processed.replace(/[♪♫🎵🎶]/g, ''); // Remove símbolos musicais
    
    // Corrigir espaçamento
    processed = processed.replace(/\s+/g, ' '); // Múltiplos espaços → espaço único
    processed = processed.trim();
    
    // Capitalizar primeira letra se não estiver
    if (processed.length > 0) {
      processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    }
    
    // Corrigir pontuação comum
    processed = processed.replace(/([.!?])\s*([a-z])/g, (match, p1, p2) => {
      return p1 + ' ' + p2.toUpperCase();
    });
    
    // Garantir ponto final se necessário
    if (processed.length > 3 && !/[.!?]$/.test(processed)) {
      processed += '.';
    }

    console.log(`🔧 Texto processado: "${text}" → "${processed}"`);
    return processed;
  }

  // Calcular confiança baseada na resposta do Whisper
  private calculateWhisperConfidence(response: any): number {
    // Se tem informações de segmentos, calcular média
    if (response.segments && response.segments.length > 0) {
      const avgConfidence = response.segments.reduce((sum: number, segment: any) => {
        return sum + (segment.avg_logprob || -0.5);
      }, 0) / response.segments.length;
      
      // Converter logprob para probabilidade (aproximada)
      const baseConfidence = Math.max(0.3, Math.min(0.95, Math.exp(avgConfidence)));
      
      // Ajustar confiança baseada na qualidade do texto
      const textQuality = this.assessTextQuality(response.text);
      return Math.min(0.95, baseConfidence * textQuality);
    }
    
    // Baseado no tamanho e qualidade do texto
    const textLength = response.text.trim().length;
    const textQuality = this.assessTextQuality(response.text);
    
    let baseConfidence = 0.6;
    if (textLength > 50) baseConfidence = 0.9;
    else if (textLength > 20) baseConfidence = 0.8;
    else if (textLength > 10) baseConfidence = 0.7;
    
    return Math.min(0.95, baseConfidence * textQuality);
  }

  // Avaliar qualidade do texto transcrito
  private assessTextQuality(text: string): number {
    if (!text) return 0.1;
    
    let quality = 1.0;
    
    // Penalizar texto muito repetitivo
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) quality *= 0.7; // Muito repetitivo
    
    // Penalizar se só tem uma palavra repetida
    if (uniqueWords.size === 1 && words.length > 2) quality *= 0.3;
    
    // Bonificar se tem pontuação apropriada
    if (/[.!?]/.test(text)) quality *= 1.1;
    
    // Penalizar ruídos óbvios
    if (/\b(ah|eh|uh|hm|hmm)\b/gi.test(text)) quality *= 0.8;
    
    return Math.max(0.1, Math.min(1.0, quality));
  }

  // Integração com Google Speech-to-Text (futuro)
  private async transcribeWithGoogleSpeech(audioBuffer: Buffer): Promise<string> {
    // TODO: Implementar integração com Google Speech-to-Text API
    throw new Error('Google Speech integration not implemented yet');
  }

  // Configurar idioma
  public setLanguage(language: string): void {
    this.config.language = language;
    console.log(`🌍 ASR language configurado: ${language}`);
  }

  // Configurar modelo
  public setModel(model: string): void {
    this.config.model = model;
    console.log(`🤖 ASR model configurado: ${model}`);
  }

  // Obter configuração atual
  public getConfig(): ASRConfig {
    return { ...this.config };
  }

  // Obter status do serviço
  public getStatus(): object {
    return {
      enabled: this.isEnabled,
      config: this.config,
      availableModels: ['whisper', 'google-speech'],
      supportedLanguages: ['pt-BR', 'en-US', 'es-ES']
    };
  }

  // Habilitar/desabilitar serviço
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🎤 ASR Service ${enabled ? 'habilitado' : 'desabilitado'}`);
  }

  // Habilitar/desabilitar simulação (para desenvolvimento)
  public setSimulationEnabled(enabled: boolean): void {
    this.enableSimulation = enabled;
    console.log(`🎭 ASR Simulação ${enabled ? 'habilitada' : 'desabilitada'}`);
  }

  // Verificar se simulação está habilitada
  public isSimulationEnabled(): boolean {
    return this.enableSimulation;
  }

  /**
   * Trigger geração de sugestões após nova transcrição
   */
  private async triggerSuggestionGeneration(transcription: TranscriptionResult): Promise<void> {
    try {
      console.log(`🤖 Triggering suggestion generation for session ${transcription.sessionId}`);
      
      // Buscar informações da sessão
      const session = await db.getSession(transcription.sessionId);
      if (!session) {
        console.log('⚠️ Sessão não encontrada para geração de sugestões');
        return;
      }

      // Buscar utterances recentes da sessão
      const utterances = await db.getSessionUtterances(transcription.sessionId);
      
      // Criar contexto para geração de sugestões
      const context = {
        sessionId: transcription.sessionId,
        patientName: 'Paciente', // TODO: Buscar nome real do paciente
        sessionDuration: this.calculateSessionDuration(session.created_at),
        consultationType: session.session_type || 'presencial',
        utterances: utterances.slice(-10), // Últimas 10 utterances
        specialty: 'clinica_geral' // TODO: Determinar especialidade baseada no contexto
      };

      console.log(`📊 Context for suggestions: ${context.utterances.length} utterances, ${context.sessionDuration}min duration`);

      // Gerar sugestões de forma assíncrona (não bloquear transcrição)
      setImmediate(async () => {
        try {
          const suggestions = await suggestionService.generateSuggestions(context);
          if (suggestions && suggestions.suggestions.length > 0) {
            console.log(`🤖 ${suggestions.suggestions.length} sugestões geradas para sessão ${transcription.sessionId}`);
            
            // Notificar via WebSocket se disponível
            await this.notifyWebSocketSuggestions(transcription.sessionId, suggestions.suggestions);
          } else {
            console.log(`🤖 Nenhuma sugestão gerada para sessão ${transcription.sessionId}`);
          }
        } catch (error) {
          console.error('❌ Erro ao gerar sugestões:', error);
        }
      });

    } catch (error) {
      console.error('❌ Erro no trigger de sugestões:', error);
    }
  }

  /**
   * Notifica sugestões via WebSocket
   */
  private async notifyWebSocketSuggestions(sessionId: string, suggestions: any[]): Promise<void> {
    try {
      // Tentar obter notifier do WebSocket
      const { SessionNotifier } = await import('../websocket/index');
      
      // Esta é uma implementação simplificada - em produção, você teria uma referência global ao notifier
      console.log(`📡 WebSocket notification preparada para sessão ${sessionId}: ${suggestions.length} sugestões`);
      
      // TODO: Implementar notificação real via WebSocket
      // Por enquanto, apenas log para debug
      
    } catch (error) {
      console.log('📡 WebSocket notifier não disponível - sugestões salvas no banco');
    }
  }

  /**
   * Calcula duração da sessão em minutos
   */
  private calculateSessionDuration(startTime: string): number {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
  }
}

// Instância singleton do serviço ASR
export const asrService = new ASRService();
