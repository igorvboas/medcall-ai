import { ProcessedAudioChunk } from './audioProcessor';
import { db } from '../config/database';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { suggestionService } from './suggestionService';
import FormData from 'form-data';

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
    // ✅ Prompt melhorado para contexto médico brasileiro e evitar transcrições estranhas
    prompt: 'Esta é uma consulta médica profissional em português brasileiro entre médico e paciente. Transcreva APENAS o que foi realmente dito na consulta. Use terminologia médica adequada. NÃO invente palavras ou frases. NÃO adicione conteúdo que não foi falado. NÃO transcreva ruído ou silêncio como palavras. Palavras comuns: doutor, dor, sintoma, medicamento, tratamento, exame, diagnóstico, consulta, paciente, médico.'
  };

  private isEnabled = false;
  private enableSimulation = false; // Flag para controlar simulação - PERMANENTEMENTE DESABILITADA
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
      console.warn(`⚠️ [ASR] ASR não está habilitado ou OpenAI não configurado - ${asrId}`);
      console.warn(`⚠️ [ASR] Não é possível transcrever áudio sem OpenAI Whisper configurado`);
      // ✅ NÃO usar simulação ou fallback - retornar null se não houver Whisper
      return null;
    }

    try {
      console.log(`🔍 DEBUG [ASR] USANDO WHISPER - ${asrId}`);
      // Usar OpenAI Whisper para transcrição real
      const result = await this.transcribeWithWhisper(audioChunk);
      /**
      console.log(`🔍 DEBUG [ASR] WHISPER RESULTADO - ${asrId}:`, {
        hasResult: !!result,
        text: result?.text || null,
        id: result?.id || null
      });
       */
      return result;
      
    } catch (error) {
      console.error(`❌ [ASR] ERRO WHISPER - ${asrId}:`, error);
      console.error(`❌ [ASR] Não é possível transcrever áudio devido a erro no Whisper`);
      // ✅ NÃO usar fallback - retornar null em caso de erro
      // Isso evita transcrições incorretas ou simuladas
      return null;
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

  // Salvar transcrição no banco de dados (usando array único)
  private async saveTranscription(transcription: TranscriptionResult): Promise<void> {
    try {
      // ✅ Validar sessionId antes de salvar
      if (!transcription.sessionId) {
        console.error('❌ [SAVE] sessionId não fornecido, não é possível salvar transcrição');
        console.error('❌ [SAVE] TranscriptionResult completo:', JSON.stringify(transcription, null, 2));
        return;
      }

      // ✅ Garantir que speaker está no formato correto
      let speaker: 'doctor' | 'patient' | 'system' = 'system';
      const speakerLower = (transcription.speaker || '').toLowerCase();
      if (speakerLower.includes('doctor') || speakerLower.includes('médico') || speakerLower.includes('medico') || speakerLower.includes('host')) {
        speaker = 'doctor';
      } else if (speakerLower.includes('patient') || speakerLower.includes('paciente') || speakerLower.includes('participant')) {
        speaker = 'patient';
      }

      // ✅ Usar addTranscriptionToSession para salvar em array único
      // Para consultas presenciais, usar o speaker como speaker_id (já que não temos nome real aqui)
      const speakerId = speaker; // Em consultas presenciais, pode não ter o nome real disponível
      
      const success = await db.addTranscriptionToSession(transcription.sessionId, {
        speaker: speaker,
        speaker_id: speakerId,
        text: transcription.text,
        confidence: transcription.confidence,
        start_ms: transcription.startTime,
        end_ms: transcription.endTime
      });

      if (!success) {
        console.warn('⚠️ [SAVE] Falha ao adicionar transcrição ao array');
      } else {
        console.log(`✅ [SAVE] Transcrição adicionada ao array: [${speaker}] "${transcription.text.substring(0, 30)}..."`);
      }
    } catch (error) {
      console.error('❌ [SAVE] Erro ao salvar transcrição no banco:', error);
      if (error instanceof Error) {
        console.error('❌ [SAVE] Stack trace:', error.stack);
      }
      // Não lançar erro para não bloquear o fluxo de transcrição
    }
  }

  // Processar resposta do Whisper
  private async processWhisperResponse(result: any, audioChunk: ProcessedAudioChunk): Promise<TranscriptionResult | null> {
    // Verificar se há texto transcrito
    if (!result.text || result.text.trim().length === 0) {
      console.log(`🔇 Whisper não detectou fala clara: ${audioChunk.channel}`);
      return null;
    }

    // 🔧 PÓS-PROCESSAMENTO do texto para melhorar qualidade
    const rawText = result.text.trim();
    
    // ✅ Filtrar textos inválidos ANTES de processar
    if (!this.filterInvalidTranscriptions(rawText)) {
      console.log(`🔇 [ASR] Texto inválido descartado: "${rawText}"`);
      return null;
    }
    
    const cleanedText = this.postProcessTranscription(rawText);
    
    // Verificar se texto limpo não ficou vazio
    if (!cleanedText || cleanedText.length < 2) {
      console.log(`🔇 Texto muito curto após limpeza: "${cleanedText}"`);
      return null;
    }
    
    // ✅ Validação adicional: verificar se o texto faz sentido para consulta médica
    if (!this.filterInvalidTranscriptions(cleanedText)) {
      console.log(`🔇 [ASR] Texto limpo ainda inválido, descartando: "${cleanedText}"`);
      return null;
    }

    // ✅ Mapear speaker para valores aceitos pelo schema ('doctor', 'patient')
    let speaker: 'doctor' | 'patient' = 'patient'; // Default para patient
    const channelLower = audioChunk.channel?.toLowerCase() || '';
    if (channelLower.includes('doctor') || channelLower.includes('médico') || channelLower.includes('medico') || channelLower.includes('host')) {
      speaker = 'doctor';
    } else if (channelLower.includes('patient') || channelLower.includes('paciente') || channelLower.includes('participant')) {
      speaker = 'patient';
    }

    // Criar resultado de transcrição
    const transcriptionResult: TranscriptionResult = {
      id: randomUUID(),
      sessionId: audioChunk.sessionId,
      speaker: speaker, // ✅ Usar valor mapeado (sempre 'doctor' ou 'patient')
      text: cleanedText,
      confidence: this.calculateWhisperConfidence(result),
      timestamp: new Date().toISOString(),
      startTime: Math.round(audioChunk.timestamp - audioChunk.duration),
      endTime: Math.round(audioChunk.timestamp),
      is_final: true
    };

    // ✅ Salvar no banco de dados automaticamente
    console.log(`💾 [AUTO-SAVE] Tentando salvar transcrição:`, {
      sessionId: transcriptionResult.sessionId,
      speaker: speaker,
      textLength: cleanedText.length,
      textPreview: cleanedText.substring(0, 50) + '...'
    });
    
    try {
      await this.saveTranscription(transcriptionResult);
      console.log(`✅ [AUTO-SAVE] Transcrição salva automaticamente no banco: ${speaker} - "${cleanedText.substring(0, 30)}..."`);
    } catch (saveError) {
      console.error('❌ [AUTO-SAVE] Erro ao salvar transcrição automaticamente:', saveError);
      if (saveError instanceof Error) {
        console.error('❌ [AUTO-SAVE] Stack:', saveError.stack);
      }
      // Não bloquear o fluxo se o salvamento falhar
    }
    
    // 🎯 LOG DETALHADO DA TRANSCRIÇÃO
    console.log(`🎯 Whisper transcreveu: [${audioChunk.channel}] "${result.text.trim()}" (conf: ${Math.round(transcriptionResult.confidence * 100)}%)`);
    console.log(`📝 [${audioChunk.channel}] [Transcrição]: ${cleanedText}`);

    return transcriptionResult;
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

      // 🔍 VALIDAÇÃO DETALHADA DO BUFFER WAV
      const wavValidation = this.validateWavBuffer(audioChunk.audioBuffer);
      if (!wavValidation.isValid) {
        console.error(`❌ Buffer WAV inválido para ${audioChunk.channel}:`, wavValidation.errors);
        return null;
      }
      console.log(`✅ Buffer WAV válido para ${audioChunk.channel}:`, wavValidation.info);

      // 🔍 VALIDAÇÃO ADICIONAL: Verificar se o buffer não está corrompido
      if (audioChunk.audioBuffer.length < 1000) {
        console.warn(`⚠️ Buffer WAV muito pequeno: ${audioChunk.audioBuffer.length} bytes`);
        return null;
      }

      // 🔍 VALIDAÇÃO ADICIONAL: Verificar assinatura RIFF
      const riffSignature = audioChunk.audioBuffer.toString('ascii', 0, 4);
      if (riffSignature !== 'RIFF') {
        console.error(`❌ Assinatura RIFF inválida: "${riffSignature}"`);
        return null;
      }

      // 🔧 CORREÇÃO: Usar FormData de forma mais robusta
      const formData = new FormData();
      
      // 🔧 CORREÇÃO: Adicionar model PRIMEIRO (algumas APIs são sensíveis à ordem)
      formData.append('model', this.config.model);
      
      // Adicionar arquivo com configurações específicas para Whisper
      formData.append('file', audioChunk.audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
        knownLength: audioChunk.audioBuffer.length
      });
      
      // Adicionar outros parâmetros de configuração
      formData.append('language', this.whisperConfig.language);
      formData.append('response_format', this.whisperConfig.response_format);
      formData.append('temperature', this.whisperConfig.temperature.toString());
      formData.append('prompt', this.whisperConfig.prompt);

      console.log(`🎤 Enviando áudio para Whisper: ${audioChunk.channel} - ${audioChunk.duration}ms`);
      //console.log(`🔍 DEBUG [AUDIO] Buffer size: ${audioChunk.audioBuffer.length} bytes`);
      //console.log(`🔍 DEBUG [AUDIO] Sample rate: ${audioChunk.sampleRate} Hz`);
      //console.log(`🔍 DEBUG [AUDIO] Has voice activity: ${audioChunk.hasVoiceActivity}`);
      //console.log(`🔍 DEBUG [AUDIO] Average volume: ${audioChunk.averageVolume}`);
      //console.log(`🔍 DEBUG [AUDIO] Duration: ${audioChunk.duration}ms`);
      
      // 🔍 DEBUG: Verificar parâmetros do FormData
      //console.log(`🔍 DEBUG [FORMDATA] Model: "${this.config.model}"`);
      //console.log(`🔍 DEBUG [FORMDATA] Language: "${this.whisperConfig.language}"`);
      //console.log(`🔍 DEBUG [FORMDATA] Response format: "${this.whisperConfig.response_format}"`);
      //console.log(`🔍 DEBUG [FORMDATA] Temperature: "${this.whisperConfig.temperature}"`);

      // 🔧 CORREÇÃO: Usar headers corretos e timeout
      console.log(`🚀 CHAMANDO WHISPER API...`);
      
      // 🔧 CORREÇÃO: Usar node-fetch para melhor compatibilidade com FormData
      const fetch = (await import('node-fetch')).default;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders() // Usar headers do FormData explicitamente
          },
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json() as any;
        
        console.log(`✅ WHISPER API RESPONDEU!`);
        console.log(`🔍 DEBUG [WHISPER] Response received:`, result);
        
        return this.processWhisperResponse(result, audioChunk);
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout na API Whisper (30s)');
        }
        throw fetchError;
      }

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

  // ✅ Filtrar textos estranhos que não fazem sentido em consultas médicas
  private filterInvalidTranscriptions(text: string): boolean {
    const invalidPatterns = [
      /se inscreva/i,
      /inscreva-se/i,
      /se inscrevam/i,
      /no nosso canal/i,
      /no canal/i,
      /curtam o vídeo/i,
      /deixe seu like/i,
      /compartilhe/i,
      /subscribe/i,
      /youtube/i,
      /canal do youtube/i,
      /tchau.*tchau/i,
      /oi.*tudo bem.*tchau/i
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(text)) {
        console.warn(`⚠️ [ASR] Texto inválido filtrado: "${text}" (padrão: ${pattern})`);
        return false; // Texto inválido
      }
    }
    
    return true; // Texto válido
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
  // ✅ DESABILITADO PERMANENTEMENTE - não usar simulação em produção
  public setSimulationEnabled(enabled: boolean): void {
    // ✅ FORÇAR sempre desabilitado
    this.enableSimulation = false;
    if (enabled) {
      console.warn(`⚠️ [ASR] Tentativa de habilitar simulação foi bloqueada - simulação está permanentemente desabilitada`);
    }
    console.log(`🔇 [ASR] Simulação está permanentemente desabilitada`);
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
  /**
   * Valida se o Buffer WAV está no formato correto
   */
  private validateWavBuffer(buffer: Buffer): { isValid: boolean; errors: string[]; info: any } {
    const errors: string[] = [];
    const info: any = {};

    try {
      // Verificar tamanho mínimo (44 bytes = header WAV)
      if (buffer.length < 44) {
        errors.push(`Buffer muito pequeno: ${buffer.length} bytes (mínimo: 44 bytes)`);
        return { isValid: false, errors, info };
      }

      // Verificar RIFF signature
      const riffSignature = buffer.toString('ascii', 0, 4);
      if (riffSignature !== 'RIFF') {
        errors.push(`RIFF signature inválida: "${riffSignature}" (esperado: "RIFF")`);
      }

      // Verificar WAVE format
      const waveFormat = buffer.toString('ascii', 8, 12);
      if (waveFormat !== 'WAVE') {
        errors.push(`WAVE format inválido: "${waveFormat}" (esperado: "WAVE")`);
      }

      // Verificar fmt chunk
      const fmtChunk = buffer.toString('ascii', 12, 16);
      if (fmtChunk !== 'fmt ') {
        errors.push(`fmt chunk inválido: "${fmtChunk}" (esperado: "fmt ")`);
      }

      // Verificar audio format (deve ser 1 = PCM)
      const audioFormat = buffer.readUInt16LE(20);
      if (audioFormat !== 1) {
        errors.push(`Audio format inválido: ${audioFormat} (esperado: 1 para PCM)`);
      }

      // Verificar número de canais
      const numChannels = buffer.readUInt16LE(22);
      if (numChannels !== 1) {
        errors.push(`Número de canais inválido: ${numChannels} (esperado: 1 para mono)`);
      }

      // Verificar sample rate
      const sampleRate = buffer.readUInt32LE(24);
      if (sampleRate !== 44100 && sampleRate !== 48000 && sampleRate !== 16000) {
        errors.push(`Sample rate inválido: ${sampleRate} Hz (esperado: 44100, 48000 ou 16000)`);
      }

      // Verificar bits per sample
      const bitsPerSample = buffer.readUInt16LE(34);
      if (bitsPerSample !== 16) {
        errors.push(`Bits per sample inválido: ${bitsPerSample} (esperado: 16)`);
      }

      // Verificar data chunk
      const dataChunk = buffer.toString('ascii', 36, 40);
      if (dataChunk !== 'data') {
        errors.push(`data chunk inválido: "${dataChunk}" (esperado: "data")`);
      }

      // Verificar se há dados de áudio
      const dataSize = buffer.readUInt32LE(40);
      const expectedDataSize = buffer.length - 44;
      if (dataSize !== expectedDataSize) {
        errors.push(`Tamanho dos dados incorreto: ${dataSize} bytes (esperado: ${expectedDataSize} bytes)`);
      }

      // Verificar se há dados de áudio suficientes
      if (dataSize < 1000) { // Mínimo 1KB de áudio
        errors.push(`Dados de áudio insuficientes: ${dataSize} bytes (mínimo: 1000 bytes)`);
      }

      // Informações do arquivo
      info.size = buffer.length;
      info.sampleRate = sampleRate;
      info.channels = numChannels;
      info.bitsPerSample = bitsPerSample;
      info.audioFormat = audioFormat;
      info.dataSize = dataSize;
      info.duration = (dataSize / (sampleRate * numChannels * (bitsPerSample / 8))) * 1000; // em ms

      // Verificar se há dados de áudio válidos (não todos zeros)
      const audioData = buffer.slice(44);
      let hasNonZeroData = false;
      for (let i = 0; i < Math.min(audioData.length, 1000); i++) {
        if (audioData[i] !== 0) {
          hasNonZeroData = true;
          break;
        }
      }
      if (!hasNonZeroData) {
        errors.push(`Dados de áudio parecem estar vazios (todos zeros)`);
      }

      console.log(`🔍 Validação WAV: ${buffer.length} bytes, ${sampleRate}Hz, ${numChannels} canal, ${bitsPerSample} bits, ${info.duration.toFixed(0)}ms`);

      return {
        isValid: errors.length === 0,
        errors,
        info
      };

    } catch (error) {
      errors.push(`Erro ao validar WAV: ${error}`);
      return { isValid: false, errors, info };
    }
  }
}

// Instância singleton do serviço ASR
export const asrService = new ASRService();
