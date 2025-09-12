import { EventEmitter } from 'events';

export interface AudioChunk {
  sessionId: string;
  channel: 'doctor' | 'patient';
  audioData: Float32Array;
  timestamp: number;
  sampleRate: number;
}

export interface ProcessedAudioChunk {
  sessionId: string;
  channel: 'doctor' | 'patient';
  audioBuffer: Buffer;
  timestamp: number;
  sampleRate: number;
  duration: number;
  hasVoiceActivity: boolean;
  averageVolume: number;
}

export interface AudioProcessorEvents {
  'audio:processed': (chunk: ProcessedAudioChunk) => void;
  'audio:silence': (data: { sessionId: string; channel: 'doctor' | 'patient' }) => void;
  'audio:voice_activity': (data: { sessionId: string; channel: 'doctor' | 'patient'; isActive: boolean }) => void;
  'error': (error: Error) => void;
}

export class AudioProcessor extends EventEmitter {
  private buffers: Map<string, Float32Array[]> = new Map();
  // 🎯 OTIMIZADO PARA TRANSCRIÇÃO DE QUALIDADE
  private vadThreshold = 0.05; // Mais sensível para captar voz baixa (era 0.08)
  private bufferDuration = 1000; // Duração do buffer em ms
  private maxBufferSize = 44100; // Máximo de samples no buffer (1 segundo a 44.1kHz)
  private minVoiceDurationMs = 800; // Reduzido para captar frases curtas importantes (era 2000)
  private silenceThresholdMs = 3000; // Reduzido para ser mais responsivo (era 5000)
  private lastVoiceActivity: Map<string, number> = new Map(); // Timestamp da última atividade de voz
  private consecutiveVoiceChunks: Map<string, number> = new Map(); // Contador de chunks consecutivos com voz
  private minConsecutiveChunks = 1; // Mais responsivo (era 2)
  
  // Parâmetros para frases completas - OTIMIZADO
  private phraseBuffers: Map<string, Float32Array[]> = new Map(); // Buffer para agrupar frases completas
  private phraseTimestamps: Map<string, number> = new Map(); // Timestamp do início da frase
  private phraseEndSilenceMs = 1200; // Silêncio que indica fim de frase - mais responsivo (era 2000)
  private maxPhraseLength = 15000; // Máximo 15s por frase para evitar perda de contexto
  
  // Controle para evitar processamento parcial
  private disablePartialProcessing = true; // NOVA FLAG - só processa frases completas
  
  // 🛡️ CONTROLE DE DEDUPLICAÇÃO TOTAL - SOLUÇÃO PARA DUPLICAÇÕES
  private processingInProgress: Map<string, boolean> = new Map(); // Flag de processamento em andamento
  private lastProcessedTimestamp: Map<string, number> = new Map(); // Timestamp do último processamento
  private processedChunkIds: Set<string> = new Set(); // IDs de chunks já processados
  private globalProcessingLock: Map<string, boolean> = new Map(); // Lock global por canal
  
  // 🔍 SISTEMA DE DEBUGGING DETALHADO
  private debugTracker: Map<string, any[]> = new Map(); // Rastrear eventos por sessão

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  // 🔍 DEBUGGING: Gerar ID único para rastreamento
  private generateProcessingId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 🔍 DEBUGGING: Registrar evento no tracker
  private logDebugEvent(sessionId: string, channel: string, event: string, details: any = {}) {
    const key = `${sessionId}:${channel}`;
    if (!this.debugTracker.has(key)) {
      this.debugTracker.set(key, []);
    }
    
    const logEntry = {
      timestamp: Date.now(),
      time: new Date().toISOString(),
      event,
      ...details
    };
    
    this.debugTracker.get(key)!.push(logEntry);
    
    // Log detalhado no console
    console.log(`🔍 DEBUG [${key}] ${event}:`, JSON.stringify(details, null, 2));
    
    // Manter apenas últimos 50 eventos por canal
    const events = this.debugTracker.get(key)!;
    if (events.length > 50) {
      events.splice(0, events.length - 50);
    }
  }

  // Processar chunk de áudio recebido
  public processAudioChunk(audioChunk: AudioChunk): void {
    try {
      const { sessionId, channel, audioData, timestamp, sampleRate } = audioChunk;
      const bufferKey = `${sessionId}:${channel}`;
      const currentTime = Date.now();

      // Aplicar Voice Activity Detection
      const hasVoiceActivity = this.detectVoiceActivity(audioData);
      
      // Calcular RMS para logs de debug
      const rms = this.calculateRMS(audioData);
      
      if (hasVoiceActivity) {
        // Incrementar contador de chunks consecutivos
        const currentCount = this.consecutiveVoiceChunks.get(bufferKey) || 0;
        this.consecutiveVoiceChunks.set(bufferKey, currentCount + 1);
        
        // Só processar se tiver chunks consecutivos suficientes
        if (currentCount + 1 >= this.minConsecutiveChunks) {
          // Atualizar timestamp da última atividade de voz
          this.lastVoiceActivity.set(bufferKey, currentTime);
          
          // Inicializar buffer de frase se não existir
          const phraseKey = `phrase_${bufferKey}`;
          if (!this.phraseTimestamps.has(phraseKey)) {
            this.phraseTimestamps.set(phraseKey, currentTime);
            console.log(`🎬 Iniciando nova frase: ${channel}`);
          }
          
          // Log de debug ocasional para não spam
          if (Math.random() < 0.02 && process.env.NODE_ENV === 'development') {
            console.log(`🎙️ Voz contínua detectada: ${channel} - RMS: ${rms.toFixed(4)} (chunks: ${currentCount + 1})`);
          }
          
          this.emit('audio:voice_activity', {
            sessionId,
            channel,
            isActive: true
          });

          // Adicionar ao buffer principal
          if (!this.buffers.has(bufferKey)) {
            this.buffers.set(bufferKey, []);
          }
          const buffer = this.buffers.get(bufferKey)!;
          buffer.push(new Float32Array(audioData));

          // Adicionar ao buffer de frase
          if (!this.phraseBuffers.has(phraseKey)) {
            this.phraseBuffers.set(phraseKey, []);
          }
          const phraseBuffer = this.phraseBuffers.get(phraseKey)!;
          phraseBuffer.push(new Float32Array(audioData));

          // Calcular tamanho total do buffer
          const totalSamples = buffer.reduce((sum, chunk) => sum + chunk.length, 0);

          // DESABILITADO: Não processar por buffer cheio, apenas por fim de frase
          if (!this.disablePartialProcessing && totalSamples >= this.maxBufferSize) {
            this.flushBuffer(bufferKey, sessionId, channel, sampleRate);
          }
        } else {
          // Ainda não tem chunks suficientes, apenas log de debug ocasional
          if (Math.random() < 0.1 && process.env.NODE_ENV === 'development') {
            console.log(`🔍 Verificando consistência: ${channel} - RMS: ${rms.toFixed(4)} (chunks: ${currentCount + 1}/${this.minConsecutiveChunks})`);
          }
        }
      } else {
        // Reset do contador de chunks consecutivos
        this.consecutiveVoiceChunks.set(bufferKey, 0);
        // Verificar se há buffer para processar após silêncio
        const lastActivity = this.lastVoiceActivity.get(bufferKey) || 0;
        const silenceDuration = currentTime - lastActivity;
        
        // Log de silêncio apenas ocasionalmente para não spam
        if (Math.random() < 0.01 && process.env.NODE_ENV === 'development') {
          console.log(`🔇 Silêncio: ${channel} - RMS: ${rms.toFixed(4)} (silêncio há ${silenceDuration}ms)`);
        }
        
        // PRINCIPAL: Verificar se deve finalizar frase por silêncio prolongado
        const phraseKey = `phrase_${bufferKey}`;
        if (silenceDuration > this.phraseEndSilenceMs && this.phraseBuffers.has(phraseKey)) {
          const phraseBuffer = this.phraseBuffers.get(phraseKey)!;
          if (phraseBuffer.length > 0) {
            console.log(`🔚 Finalizando frase após ${silenceDuration}ms de silêncio: ${channel}`);
            this.flushPhraseBuffer(phraseKey, sessionId, channel, sampleRate);
          }
        }
        
        // DESABILITADO: Não processar buffers órfãos no modo de frases completas
        // Apenas limpar para não acumular memória
        if (silenceDuration > this.silenceThresholdMs && this.buffers.has(bufferKey)) {
          const buffer = this.buffers.get(bufferKey)!;
          if (buffer.length > 0 && !this.phraseBuffers.has(phraseKey)) {
            // Apenas limpar sem processar quando em modo de frases completas
            this.buffers.set(bufferKey, []);
            console.log(`🧹 Buffer órfão limpo sem processar: ${channel} (modo frases completas)`);
          }
        }
        
        this.emit('audio:silence', { sessionId, channel });
      }
    } catch (error) {
      console.error('Erro ao processar chunk de áudio:', error);
      this.emit('error', error as Error);
    }
  }

  // Detectar atividade de voz (VAD simples)
  private detectVoiceActivity(audioData: Float32Array): boolean {
    // Calcular RMS (Root Mean Square) do áudio
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    return rms > this.vadThreshold;
  }

  // Calcular volume médio do áudio
  private calculateAverageVolume(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return sum / audioData.length;
  }

  // Calcular RMS (Root Mean Square) do áudio
  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  // 🎚️ NORMALIZAR ÁUDIO para melhorar qualidade da transcrição
  private normalizeAudio(audioData: Float32Array): Float32Array {
    if (audioData.length === 0) return audioData;

    // Encontrar valor máximo absoluto
    let maxValue = 0;
    for (let i = 0; i < audioData.length; i++) {
      const absValue = Math.abs(audioData[i]);
      if (absValue > maxValue) {
        maxValue = absValue;
      }
    }

    // Se áudio muito baixo, não normalizar (pode ser silêncio)
    if (maxValue < 0.001) {
      return audioData;
    }

    // Normalizar para 85% do máximo (evita clipping e mantém dinâmica)
    const targetLevel = 0.85;
    const normalizationFactor = targetLevel / maxValue;
    
    const normalizedAudio = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      normalizedAudio[i] = audioData[i] * normalizationFactor;
    }

    const originalRMS = this.calculateRMS(audioData);
    const normalizedRMS = this.calculateRMS(normalizedAudio);
    
    console.log(`🎚️ Áudio normalizado: ${originalRMS.toFixed(4)} → ${normalizedRMS.toFixed(4)} (fator: ${normalizationFactor.toFixed(2)})`);
    
    return normalizedAudio;
  }

  // Processar buffer acumulado
  // 🛡️ PROTEÇÃO GLOBAL CONTRA DUPLICAÇÕES
  private canProcessChannel(sessionId: string, channel: 'doctor' | 'patient'): boolean {
    const globalKey = `${sessionId}:${channel}`;
    
    // Verificar lock global
    if (this.globalProcessingLock.get(globalKey)) {
      console.log(`🛡️ LOCK GLOBAL ATIVO - Bloqueando processamento: ${channel}`);
      return false;
    }
    
    // Verificar processamento recente (proteção temporal)
    const lastProcessed = this.lastProcessedTimestamp.get(globalKey) || 0;
    const timeSinceLastProcessing = Date.now() - lastProcessed;
    if (timeSinceLastProcessing < 8000) { // 8 segundos mínimo - AUMENTADO
      console.log(`🛡️ PROTEÇÃO TEMPORAL - Bloqueando processamento: ${channel} (${timeSinceLastProcessing}ms atrás)`);
      return false;
    }
    
    return true;
  }

  // Processar e emitir buffer de frase completa
  private flushPhraseBuffer(
    phraseKey: string,
    sessionId: string,
    channel: 'doctor' | 'patient',
    sampleRate: number
  ): void {
    const processingId = this.generateProcessingId();
    
    // 🔍 DEBUG: Log de entrada
    this.logDebugEvent(sessionId, channel, 'FLUSH_PHRASE_BUFFER_START', {
      processingId,
      phraseKey,
      sampleRate,
      hasBuffer: this.phraseBuffers.has(phraseKey),
      bufferLength: this.phraseBuffers.get(phraseKey)?.length || 0
    });

    try {
      const phraseBuffer = this.phraseBuffers.get(phraseKey);
      if (!phraseBuffer || phraseBuffer.length === 0) {
        this.logDebugEvent(sessionId, channel, 'FLUSH_PHRASE_BUFFER_EMPTY', { processingId });
        return;
      }

      // 🛡️ PROTEÇÃO GLOBAL PRIMEIRA - Verificar se pode processar este canal
      if (!this.canProcessChannel(sessionId, channel)) {
        this.logDebugEvent(sessionId, channel, 'FLUSH_PHRASE_BUFFER_BLOCKED', { 
          processingId,
          reason: 'canProcessChannel_failed'
        });
        return;
      }

      // PROTEÇÃO: Verificar se já está processando esta frase
      if (this.processingInProgress.get(phraseKey)) {
        this.logDebugEvent(sessionId, channel, 'FLUSH_PHRASE_BUFFER_ALREADY_PROCESSING', { 
          processingId,
          phraseKey
        });
        console.log(`⚠️ Processamento já em andamento para: ${phraseKey} - IGNORANDO`);
        return;
      }

      // 🔒 MARCAR LOCKS GLOBAIS
      const globalChannelKey = `${sessionId}:${channel}`;
      this.processingInProgress.set(phraseKey, true);
      this.globalProcessingLock.set(globalChannelKey, true);

      this.logDebugEvent(sessionId, channel, 'FLUSH_PHRASE_BUFFER_LOCKS_SET', {
        processingId,
        phraseKey,
        globalChannelKey
      });

      console.log(`🔒 LOCKS ATIVADOS: ${phraseKey} + global ${globalChannelKey}`);

      // Calcular tamanho total
      const totalSamples = phraseBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const duration = (totalSamples / sampleRate) * 1000; // em ms

      // Verificar duração mínima (mais flexível)
      if (duration < this.minVoiceDurationMs) {
        console.log(`⏭️ Frase muito curta ignorada: ${channel} - ${duration.toFixed(0)}ms`);
        this.phraseBuffers.delete(phraseKey);
        this.phraseTimestamps.delete(phraseKey);
        return;
      }

      // Verificar se frase não é muito longa (evitar perda de contexto)
      if (duration > this.maxPhraseLength) {
        console.log(`📏 Frase muito longa, processando: ${channel} - ${duration.toFixed(0)}ms`);
      }

      // Concatenar todos os chunks da frase
      const concatenatedAudio = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of phraseBuffer) {
        concatenatedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // 🎚️ NORMALIZAR ÁUDIO para melhor qualidade de transcrição
      const normalizedAudio = this.normalizeAudio(concatenatedAudio);

      // Converter para WAV com áudio normalizado
      const audioBuffer = this.float32ToWavBuffer(normalizedAudio, sampleRate);

      // Detectar atividade de voz final
      const hasVoiceActivity = this.detectVoiceActivity(concatenatedAudio);
      const averageVolume = this.calculateAverageVolume(concatenatedAudio);

      // Criar chunk processado da frase completa
      const processedChunk: ProcessedAudioChunk = {
        sessionId,
        channel,
        audioBuffer,
        timestamp: Date.now(),
        sampleRate,
        duration,
        hasVoiceActivity,
        averageVolume
      };

      // 🔍 DEBUG: Log antes de emitir evento
      this.logDebugEvent(sessionId, channel, 'AUDIO_PROCESSED_EVENT_EMIT', {
        processingId,
        duration: Math.round(duration),
        audioBufferSize: audioBuffer.length,
        hasVoiceActivity,
        averageVolume,
        chunkId: processedChunk.sessionId + ':' + processedChunk.channel + ':' + processedChunk.timestamp
      });

      // Emitir evento de frase processada
      this.emit('audio:processed', processedChunk);

      console.log(`🎯 FRASE COMPLETA PROCESSADA: ${channel} - ${duration.toFixed(0)}ms - ${audioBuffer.length} bytes - ENVIANDO PARA WHISPER`);

      // Registrar timestamp do processamento
      const finalGlobalKey = `${sessionId}:${channel}`;
      this.lastProcessedTimestamp.set(finalGlobalKey, Date.now());

      // Limpar buffers de frase
      this.phraseBuffers.delete(phraseKey);
      this.phraseTimestamps.delete(phraseKey);

    } catch (error) {
      console.error('Erro ao processar buffer de frase:', error);
      this.emit('error', error as Error);
    } finally {
      // 🔓 SEMPRE LIBERAR TODOS OS LOCKS
      const unlockGlobalKey = `${sessionId}:${channel}`;
      this.processingInProgress.set(phraseKey, false);
      
      // Liberar lock global após delay para evitar processamento imediato
      setTimeout(() => {
        this.globalProcessingLock.set(unlockGlobalKey, false);
        console.log(`🔓 LOCK GLOBAL LIBERADO: ${unlockGlobalKey}`);
      }, 2000); // 2 segundos de delay
    }
  }

  private flushBuffer(
    bufferKey: string,
    sessionId: string,
    channel: 'doctor' | 'patient',
    sampleRate: number
  ): void {
    const processingId = this.generateProcessingId();
    
    // 🔍 DEBUG: Log de entrada no flushBuffer
    this.logDebugEvent(sessionId, channel, 'FLUSH_BUFFER_START', {
      processingId,
      bufferKey,
      sampleRate,
      hasBuffer: this.buffers.has(bufferKey),
      bufferLength: this.buffers.get(bufferKey)?.length || 0
    });

    // 🛡️ PROTEÇÃO GLOBAL - Verificar se pode processar este canal
    if (!this.canProcessChannel(sessionId, channel)) {
      this.logDebugEvent(sessionId, channel, 'FLUSH_BUFFER_BLOCKED', {
        processingId,
        reason: 'canProcessChannel_failed'
      });
      console.log(`🛡️ flushBuffer BLOQUEADO por proteção global: ${channel}`);
      return;
    }

    const buffer = this.buffers.get(bufferKey);
    if (!buffer || buffer.length === 0) {
      this.logDebugEvent(sessionId, channel, 'FLUSH_BUFFER_EMPTY', { processingId });
      return;
    }

    try {
      // Concatenar todos os chunks do buffer
      const totalSamples = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const concatenatedAudio = new Float32Array(totalSamples);
      
      let offset = 0;
      for (const chunk of buffer) {
        concatenatedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Converter Float32Array para Buffer WAV para melhor compatibilidade com Whisper
      const audioBuffer = this.float32ToWavBuffer(concatenatedAudio, sampleRate);

      // Calcular duração
      const duration = (totalSamples / sampleRate) * 1000; // em ms

      // Detectar atividade de voz no buffer concatenado
      const hasVoiceActivity = this.detectVoiceActivity(concatenatedAudio);

      // Calcular volume médio
      const averageVolume = this.calculateAverageVolume(concatenatedAudio);

      // Criar chunk processado
      const processedChunk: ProcessedAudioChunk = {
        sessionId,
        channel,
        audioBuffer,
        timestamp: Date.now(),
        sampleRate,
        duration,
        hasVoiceActivity,
        averageVolume
      };

      // Emitir evento de áudio processado
      this.emit('audio:processed', processedChunk);

      // Limpar buffer
      this.buffers.set(bufferKey, []);

      console.log(`✅ Buffer processado: ${channel} - ${duration.toFixed(0)}ms - ${audioBuffer.length} bytes`);
    } catch (error) {
      console.error('Erro ao processar buffer:', error);
      this.emit('error', error as Error);
    }
  }

  // Converter Float32Array para Buffer WAV completo
  private float32ToWavBuffer(float32Array: Float32Array, sampleRate: number): Buffer {
    const length = float32Array.length;
    const buffer = Buffer.allocUnsafe(44 + length * 2);
    
    // WAV Header
    buffer.write('RIFF', 0);                                    // ChunkID
    buffer.writeUInt32LE(36 + length * 2, 4);                  // ChunkSize
    buffer.write('WAVE', 8);                                    // Format
    buffer.write('fmt ', 12);                                   // Subchunk1ID
    buffer.writeUInt32LE(16, 16);                              // Subchunk1Size
    buffer.writeUInt16LE(1, 20);                               // AudioFormat (PCM)
    buffer.writeUInt16LE(1, 22);                               // NumChannels (mono)
    buffer.writeUInt32LE(sampleRate, 24);                      // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28);                  // ByteRate
    buffer.writeUInt16LE(2, 32);                               // BlockAlign
    buffer.writeUInt16LE(16, 34);                              // BitsPerSample
    buffer.write('data', 36);                                   // Subchunk2ID
    buffer.writeUInt32LE(length * 2, 40);                      // Subchunk2Size
    
    // Audio Data (16-bit PCM)
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const int16Sample = Math.round(sample * 32767);
      buffer.writeInt16LE(int16Sample, 44 + i * 2);
    }
    
    return buffer;
  }

  // Converter Float32Array para Buffer Int16 (mantido para compatibilidade)
  private float32ToInt16Buffer(float32Array: Float32Array): Buffer {
    const buffer = Buffer.allocUnsafe(float32Array.length * 2);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Converter de float (-1 a 1) para int16 (-32768 a 32767)
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const int16Sample = Math.round(sample * 32767);
      buffer.writeInt16LE(int16Sample, i * 2);
    }
    
    return buffer;
  }

  // Forçar processamento de frases pendentes (PRIORITÁRIO)
  public flushPendingPhrases(sessionId: string): void {
    const doctorKey = `${sessionId}:doctor`;
    const patientKey = `${sessionId}:patient`;
    const doctorPhraseKey = `phrase_${doctorKey}`;
    const patientPhraseKey = `phrase_${patientKey}`;

    // Processar frases pendentes primeiro
    if (this.phraseBuffers.has(doctorPhraseKey)) {
      console.log(`🔄 Forçando finalização de frase: doctor`);
      this.flushPhraseBuffer(doctorPhraseKey, sessionId, 'doctor', 44100);
    }

    if (this.phraseBuffers.has(patientPhraseKey)) {
      console.log(`🔄 Forçando finalização de frase: patient`);
      this.flushPhraseBuffer(patientPhraseKey, sessionId, 'patient', 44100);
    }
  }

  // Forçar processamento de buffer pendente (BACKUP)
  public flushPendingBuffers(sessionId: string): void {
    const doctorKey = `${sessionId}:doctor`;
    const patientKey = `${sessionId}:patient`;

    if (this.buffers.has(doctorKey)) {
      this.flushBuffer(doctorKey, sessionId, 'doctor', 44100);
    }

    if (this.buffers.has(patientKey)) {
      this.flushBuffer(patientKey, sessionId, 'patient', 44100);
    }
  }

  // Limpar buffers de uma sessão
  public clearSession(sessionId: string): void {
    const keysToRemove = Array.from(this.buffers.keys()).filter(key => 
      key.startsWith(`${sessionId}:`)
    );

    for (const key of keysToRemove) {
      this.buffers.delete(key);
      this.lastVoiceActivity.delete(key);
      this.consecutiveVoiceChunks.delete(key);
      
      // Limpar buffers de frase correspondentes
      const phraseKey = `phrase_${key}`;
      this.phraseBuffers.delete(phraseKey);
      this.phraseTimestamps.delete(phraseKey);
      this.processingInProgress.delete(phraseKey);
      this.lastProcessedTimestamp.delete(key); // Usar key diretamente para globalKey
      this.globalProcessingLock.delete(key); // 🛡️ Limpar lock global
    }

    console.log(`🧹 Buffers limpos para sessão: ${sessionId}`);
  }

  // Limpar todas as sessões
  public clearAllSessions(): void {
    this.buffers.clear();
    this.lastVoiceActivity.clear();
    this.consecutiveVoiceChunks.clear();
    this.phraseBuffers.clear();
    this.phraseTimestamps.clear();
    this.processingInProgress.clear();
    this.lastProcessedTimestamp.clear();
    this.processedChunkIds.clear(); // 🛡️ Limpar IDs processados
    this.globalProcessingLock.clear(); // 🛡️ Limpar locks globais
    this.debugTracker.clear(); // 🔍 Limpar debug tracker
    console.log('🧹 Todos os buffers e locks foram limpos');
  }

  // 🔍 DEBUGGING: Obter relatório de eventos
  public getDebugReport(sessionId?: string): any {
    if (sessionId) {
      const doctorKey = `${sessionId}:doctor`;
      const patientKey = `${sessionId}:patient`;
      return {
        doctor: this.debugTracker.get(doctorKey) || [],
        patient: this.debugTracker.get(patientKey) || []
      };
    }
    
    // Retornar todos os eventos
    const report: any = {};
    for (const [key, events] of this.debugTracker.entries()) {
      report[key] = events;
    }
    return report;
  }

  // 🔍 DEBUGGING: Contar eventos por tipo
  public getDebugSummary(sessionId: string): any {
    const doctorKey = `${sessionId}:doctor`;
    const patientKey = `${sessionId}:patient`;
    
    const summarize = (events: any[]) => {
      const summary: any = {};
      events.forEach(event => {
        summary[event.event] = (summary[event.event] || 0) + 1;
      });
      return summary;
    };
    
    return {
      doctor: summarize(this.debugTracker.get(doctorKey) || []),
      patient: summarize(this.debugTracker.get(patientKey) || [])
    };
  }

  // Configurar limpeza automática de buffers antigos
  private setupCleanupInterval(): void {
    setInterval(() => {
      // TODO: Implementar limpeza de buffers antigos
      // Por enquanto, apenas log
      const bufferCount = this.buffers.size;
      if (bufferCount > 0) {
        console.log(`📊 Buffers ativos: ${bufferCount}`);
      }
    }, 30000); // A cada 30 segundos
  }

  // Configurar duração do buffer
  public setBufferDuration(durationMs: number): void {
    this.bufferDuration = Math.max(100, Math.min(5000, durationMs));
    this.maxBufferSize = Math.floor((this.bufferDuration / 1000) * 44100);
    console.log(`⏱️ Buffer duration configurado: ${this.bufferDuration}ms`);
  }

  // Obter estatísticas
  public getStats(): object {
    return {
      activeBuffers: this.buffers.size,
      configuracao: {
        vadThreshold: this.vadThreshold,
        minVoiceDurationMs: this.minVoiceDurationMs,
        silenceThresholdMs: this.silenceThresholdMs,
        maxBufferSize: this.maxBufferSize,
        bufferDuration: this.bufferDuration
      },
      bufferDetails: Array.from(this.buffers.entries()).map(([key, buffer]) => ({
        key,
        chunks: buffer.length,
        totalSamples: buffer.reduce((sum, chunk) => sum + chunk.length, 0)
      }))
    };
  }

  // Configurar threshold de VAD dinamicamente
  public setVADThreshold(threshold: number): void {
    this.vadThreshold = Math.max(0.001, Math.min(1.0, threshold));
    console.log(`🎛️ VAD Threshold atualizado: ${this.vadThreshold}`);
  }

  // Configurar duração mínima de voz
  public setMinVoiceDuration(durationMs: number): void {
    this.minVoiceDurationMs = Math.max(100, durationMs);
    console.log(`⏱️ Duração mínima de voz atualizada: ${this.minVoiceDurationMs}ms`);
  }

  // Configurar threshold de silêncio
  public setSilenceThreshold(thresholdMs: number): void {
    this.silenceThresholdMs = Math.max(500, thresholdMs);
    console.log(`🔇 Threshold de silêncio atualizado: ${this.silenceThresholdMs}ms`);
  }

  // Obter configuração atual
  public getConfiguration(): object {
    return {
      vadThreshold: this.vadThreshold,
      minVoiceDurationMs: this.minVoiceDurationMs,
      silenceThresholdMs: this.silenceThresholdMs,
      maxBufferSize: this.maxBufferSize,
      bufferDuration: this.bufferDuration
    };
  }
}

// Instância singleton do processador de áudio
export const audioProcessor = new AudioProcessor();
