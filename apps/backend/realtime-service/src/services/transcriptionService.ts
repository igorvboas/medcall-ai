// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logError, logWarning } from '../config/database';
import { aiPricingService } from './aiPricingService';
import { aiConfig } from '../config';
import { VoiceActivityDetector } from '../utils/vad';
import { TranscriptionSegment, Speaker } from '@medcall/shared-types';
import { filterWhisperResponse, isValidTranscriptionText, WhisperVerboseResponse } from '../utils/antiHallucinationFilter';
import { deepgramService } from './deepgramService';

interface AudioChunk {
  data: Buffer;
  participantId: string;
  sampleRate: number;
  channels: number;
}

interface TranscriptionOptions {
  language?: string;
  model?: 'whisper-1';
  temperature?: number;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export class TranscriptionService extends EventEmitter {
  private supabase: any;
  private activeRooms: Map<string, Set<string>> = new Map();
  // ✅ Armazenar metadados junto com o buffer
  private audioBuffers: Map<string, { data: Buffer; sampleRate: number }[]> = new Map();
  private vadInstances: Map<string, VoiceActivityDetector> = new Map();
  private roomConsultations: Map<string, string> = new Map();

  // Deepgram: mapeamento participantId -> connectionKey
  private deepgramConnections: Map<string, string> = new Map();
  private useDeepgram: boolean;

  // Azure OpenAI config (fallback)
  private azureEndpoint: string;
  private azureApiKey: string;
  private azureDeployment: string;
  private azureApiVersion: string;

  constructor() {
    super();

    // Verificar se Deepgram está disponível
    this.useDeepgram = deepgramService.isEnabled();
    if (this.useDeepgram) {
      console.log('🎙️ [TRANSCRIPTION] Usando Deepgram para transcrição em tempo real');
      this.setupDeepgramListeners();
    } else {
      console.log('🎙️ [TRANSCRIPTION] Deepgram não disponível, usando Azure Whisper (fallback)');
    }

    // Configurar Azure OpenAI (fallback)
    this.azureEndpoint = aiConfig.azure.endpoint;
    this.azureApiKey = aiConfig.azure.apiKey;
    this.azureDeployment = aiConfig.azure.deployments.whisper;
    this.azureApiVersion = aiConfig.azure.apiVersions.whisper;

    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Configura listeners do DeepgramService para processar transcrições
   */
  private setupDeepgramListeners(): void {
    // Quando uma utterance completa é recebida (pausa na fala detectada pelo Deepgram)
    deepgramService.on('utteranceEnd', async (data) => {
      const { sessionId, participantId, role, text } = data;

      // Encontrar roomName a partir do sessionId
      const roomName = this.findRoomBySessionOrParticipant(sessionId, participantId);
      if (!roomName) {
        console.warn(`⚠️ [DEEPGRAM] Room não encontrada para sessão ${sessionId}`);
        return;
      }

      const consultaId = this.roomConsultations.get(roomName);

      // Registrar uso para monitoramento de custos
      try {
        await aiPricingService.logWhisperUsage(
          1000, // estimativa de duração
          consultaId,
          text,
          { provider: 'deepgram', model: 'nova-2' }
        );
      } catch (e) {
        // Não bloquear transcrição por erro de logging
      }

      let speaker: Speaker = 'UNKNOWN';
      if (role === 'doctor') speaker = 'MEDICO';
      else if (role === 'patient') speaker = 'PACIENTE';

      await this.sendTranscriptionToRoom(roomName, {
        id: randomUUID(),
        text,
        participantId,
        participantName: await this.getParticipantName(participantId),
        timestamp: new Date().toISOString(),
        final: true,
        confidence: 0.95, // Deepgram nova-2 tem alta confiança
        language: 'pt-BR',
        speaker,
      });
    });

    // Log de transcrições parciais (para debug)
    deepgramService.on('transcription', (data) => {
      const { result, role } = data;
      if (result.isFinal && result.text) {
        // Log apenas finais para não poluir
        console.log(`🎙️ [DEEPGRAM] [${role}] partial-final: "${result.text}" (${(result.confidence * 100).toFixed(0)}%)`);
      }
    });
  }

  /**
   * Encontra o roomName baseado em sessionId ou participantId
   */
  private findRoomBySessionOrParticipant(sessionId: string, participantId: string): string | null {
    // 1. sessionId É o roomName (quando usamos roomName como dgSessionId)
    if (this.activeRooms.has(sessionId)) {
      return sessionId;
    }

    // 2. Mapeamento reverso do Deepgram
    const mappedRoom = this.deepgramSessionToRoom?.get(sessionId);
    if (mappedRoom && this.activeRooms.has(mappedRoom)) {
      return mappedRoom;
    }

    // 3. Procurar em rooms ativas por participantId
    for (const [roomName, participants] of this.activeRooms) {
      if (participants.has(participantId)) {
        return roomName;
      }
    }

    // 4. Procurar pelo mapeamento de consultas (consultationId -> roomName)
    for (const [roomName, consultId] of this.roomConsultations) {
      if (consultId === sessionId) {
        return roomName;
      }
    }

    return null;
  }

  async startTranscription(roomName: string, consultationId: string): Promise<void> {
    try {
      console.log(`🎤 Iniciando transcrição para sala: ${roomName}`);

      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }

      // Ativar transcrição via WebSocket
      console.log(`✅ Transcrição ativada para sala: ${roomName}`);

      // Captura de áudio via WebSocket
      // Captura de áudio via WebSocket
      this.setupAudioCapture(roomName, consultationId);

      // ✅ Salvar consultationId para uso posterior (salvamento no banco)
      if (consultationId) {
        this.roomConsultations.set(roomName, consultationId);
        console.log(`✅ [TRANSCRIPTION] ConsultationId vinculado à sala ${roomName}: ${consultationId}`);
      }

    } catch (error) {
      console.error('Erro ao iniciar transcrição:', error);
      logError(
        `Erro ao iniciar transcrição`,
        'error',
        consultationId || null,
        { roomName, error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  private setupAudioCapture(roomName: string, consultationId: string): void {
    console.log(`🎵 Configurando captura de áudio para sala: ${roomName}`);

    // Aguardar áudio real do frontend via WebSocket
    console.log(`⏳ Aguardando áudio via WebSocket para sala: ${roomName}`);

    // O áudio será recebido via WebSocket do frontend
    // quando o usuário falar no microfone
  }

  // Remover simulação - usar áudio real
  // private simulateLiveKitAudio() - REMOVIDO

  async stopTranscription(roomName: string): Promise<void> {
    try {
      console.log(`Parando transcrição para sala: ${roomName}`);

      this.audioBuffers.delete(roomName);

      // Limpar instâncias VAD associadas à sala
      for (const [key, vad] of this.vadInstances.entries()) {
        if (key.startsWith(`${roomName}-`)) {
          console.log(`🧹 [VAD] Limpando VAD para ${key}`);
          vad.removeAllListeners();
          this.vadInstances.delete(key);
        }
      }

      // Fechar conexões Deepgram associadas à sala
      if (this.useDeepgram) {
        // Fechar pelo roomName (usado como dgSessionId)
        await deepgramService.closeSession(roomName);
        // Limpar mapeamentos
        for (const [key, connKey] of this.deepgramConnections) {
          if (key.startsWith(`${roomName}-`)) {
            this.deepgramConnections.delete(key);
          }
        }
        this.deepgramSessionToRoom?.delete(roomName);
      }

      this.activeRooms.delete(roomName);
      this.roomConsultations.delete(roomName);

    } catch (error) {
      console.error('Erro ao parar transcrição:', error);
      logError(
        `Erro ao parar transcrição`,
        'error',
        null,
        { roomName, error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  // ✅ Armazenar metadados junto com o buffer (usado apenas no fallback Whisper)
  private prerollBuffers: Map<string, { data: Buffer; sampleRate: number }[]> = new Map();
  private isSpeakingMap: Map<string, boolean> = new Map();

  async processAudioChunk(audioChunk: AudioChunk, roomName: string): Promise<void> {
    try {
      const { data, participantId, sampleRate } = audioChunk;

      // ========== DEEPGRAM: Streaming direto ==========
      if (this.useDeepgram) {
        await this.processAudioChunkDeepgram(audioChunk, roomName);
        return;
      }

      // ========== WHISPER FALLBACK: VAD + Buffer + Batch ==========
      await this.processAudioChunkWhisper(audioChunk, roomName);

    } catch (error) {
      console.error('Erro ao processar chunk de áudio:', error);
      logError(
        `Erro ao processar chunk de áudio`,
        'error',
        null,
        { roomName, participantId: audioChunk.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Mapeamento reverso: deepgramSessionId -> roomName (para encontrar room nos callbacks)
  private deepgramSessionToRoom: Map<string, string> = new Map();

  /**
   * Processa áudio via Deepgram (streaming em tempo real)
   * O áudio é enviado diretamente para o Deepgram que faz VAD, endpointing e transcrição
   */
  private async processAudioChunkDeepgram(audioChunk: AudioChunk, roomName: string): Promise<void> {
    const { data, participantId, sampleRate } = audioChunk;
    const bufferKey = `${roomName}-${participantId}`;

    // Criar conexão Deepgram se não existir
    if (!this.deepgramConnections.has(bufferKey)) {
      // Usar roomName como sessionId do Deepgram (mais simples e direto)
      const dgSessionId = roomName;
      const role = this.getParticipantRole(participantId);

      try {
        // Registrar participante no room
        if (!this.activeRooms.has(roomName)) {
          this.activeRooms.set(roomName, new Set());
        }
        this.activeRooms.get(roomName)!.add(participantId);

        // Guardar mapeamento reverso para o callback de utteranceEnd
        this.deepgramSessionToRoom.set(dgSessionId, roomName);

        const connKey = await deepgramService.createConnection({
          sessionId: dgSessionId,
          participantId,
          role: role === 'system' ? 'patient' : role,
          sampleRate: sampleRate || 16000,
          encoding: 'linear16',
          channels: 1,
        });

        this.deepgramConnections.set(bufferKey, connKey);
        console.log(`🎙️ [DEEPGRAM] Conexão streaming criada: ${participantId} -> sala ${roomName}`);
      } catch (error) {
        console.error(`❌ [DEEPGRAM] Falha ao criar conexão para ${participantId}:`, error);
        await this.processAudioChunkWhisper(audioChunk, roomName);
        return;
      }
    }

    // Enviar áudio para o Deepgram (bufferiza automaticamente se conexão ainda abrindo)
    deepgramService.sendAudio(roomName, participantId, data);
  }

  /**
   * Processa áudio via Whisper (fallback: VAD local + buffer + batch)
   */
  private async processAudioChunkWhisper(audioChunk: AudioChunk, roomName: string): Promise<void> {
    const { data, participantId, sampleRate } = audioChunk;
    const bufferKey = `${roomName}-${participantId}`;
    const chunkData = { data, sampleRate: sampleRate || 16000 };

    // Inicializar VAD se não existir
    if (!this.vadInstances.has(bufferKey)) {
      console.log(`🎙️ [VAD] Inicializando para ${participantId} na sala ${roomName}`);

      const vad = new VoiceActivityDetector({
        sampleRate: chunkData.sampleRate,
        energyThreshold: 0.08,
        silenceDuration: 1000,
        minSpeechDuration: 500
      });

      this.prerollBuffers.set(bufferKey, []);
      this.isSpeakingMap.set(bufferKey, false);
      this.audioBuffers.set(bufferKey, []);

      vad.on('speechStart', () => {
        this.isSpeakingMap.set(bufferKey, true);
        const preroll = this.prerollBuffers.get(bufferKey) || [];
        const mainBuffer = this.audioBuffers.get(bufferKey) || [];
        this.audioBuffers.set(bufferKey, [...preroll, ...mainBuffer]);
        this.prerollBuffers.set(bufferKey, []);
      });

      vad.on('speechEnd', async ({ duration }) => {
        this.isSpeakingMap.set(bufferKey, false);
        await this.processBufferedAudio(bufferKey, roomName, participantId);
      });

      this.vadInstances.set(bufferKey, vad);
    }

    const vad = this.vadInstances.get(bufferKey);
    if (vad) {
      vad.processAudio(data);
    }

    const isSpeaking = this.isSpeakingMap.get(bufferKey) || false;

    if (isSpeaking) {
      if (!this.audioBuffers.has(bufferKey)) this.audioBuffers.set(bufferKey, []);
      this.audioBuffers.get(bufferKey)!.push(chunkData);
    } else {
      if (!this.prerollBuffers.has(bufferKey)) this.prerollBuffers.set(bufferKey, []);
      const preroll = this.prerollBuffers.get(bufferKey)!;
      preroll.push(chunkData);
      if (preroll.length > 20) {
        preroll.shift();
      }
    }
  }

  // Método scheduleProcessing removido em favor do VAD logic


  private async processBufferedAudio(bufferKey: string, roomName: string, participantId: string): Promise<void> {
    try {
      const audioChunks = this.audioBuffers.get(bufferKey);
      if (!audioChunks || audioChunks.length === 0) {
        return;
      }

      // Extrair buffers e determinar sampleRate (assumindo constante no segmento)
      const dataBuffers = audioChunks.map(c => c.data);
      const sampleRate = audioChunks[0]?.sampleRate || 16000;

      const combinedBuffer = Buffer.concat(dataBuffers);

      // Limpar buffer após consumo
      this.audioBuffers.set(bufferKey, []);

      // Resetar estado do VAD para evitar falsos positivos imediatos
      const vad = this.vadInstances.get(bufferKey);
      if (vad) vad.reset();

      // Mínimo de áudio para enviar (aprox 0.5s)
      if (combinedBuffer.length < (sampleRate * 0.5 * 2)) { // 0.5s de audio (sampleRate * duration * bytesPerSample)
        // Aprox check
        if (combinedBuffer.length < 8000) { // Fallback check
          console.log(`⚠️ [TRANSCRIPTION] Áudio muito curto descartado`);
          return;
        }
      }

      // ✅ Obter consultationId do mapa para registrar uso de IA
      const consultaId = this.roomConsultations.get(roomName) || undefined;

      // ✅ PASSAR SAMPLE RATE CORRETA E CONSULTA ID
      const transcription = await this.transcribeAudio(combinedBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      }, consultaId, sampleRate); // ✅ Agora passa o consultaId corretamente

      if (transcription && transcription.text.trim()) {
        const text = transcription.text.trim();

        // 🛡️ FILTRO ANTI-ALUCINAÇÃO CENTRALIZADO
        const filterResult = filterWhisperResponse(transcription as WhisperVerboseResponse);
        if (!filterResult.isValid) {
          console.log(`🛡️ [ANTI-HALLUCINATION] Texto descartado: ${filterResult.reason} | "${text.substring(0, 60)}"`);
          return;
        }

        // Verificação adicional com filtro de texto
        if (!isValidTranscriptionText(text)) {
          console.log(`🛡️ [ANTI-HALLUCINATION] Texto inválido descartado: "${text.substring(0, 60)}"`);
          return;
        }

        const role = this.getParticipantRole(participantId);
        // console.log(`====> Role: ${role}`); // Remove debug logs
        let speaker: Speaker = 'UNKNOWN';
        if (role === 'doctor') speaker = 'MEDICO';
        else if (role === 'patient') speaker = 'PACIENTE';
        else if (role === 'system') speaker = 'SISTEMA';

        await this.sendTranscriptionToRoom(roomName, {
          id: randomUUID(),
          text: transcription.text,
          participantId,
          participantName: await this.getParticipantName(participantId),
          timestamp: new Date().toISOString(),
          final: true,
          confidence: transcription.confidence,
          language: transcription.language,
          speaker: speaker
        });
      }

    } catch (error) {
      console.error('Erro ao processar áudio bufferizado:', error);
      logError(
        `Erro ao processar áudio bufferizado`,
        'error',
        null,
        { roomName, participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async transcribeAudio(audioBuffer: Buffer, options: TranscriptionOptions = {}, consultaId?: string, sampleRate: number = 16000): Promise<any> {
    try {
      const wavBuffer = this.convertToWav(audioBuffer, sampleRate);

      // Azure OpenAI Whisper endpoint
      const azureUrl = `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/audio/transcriptions?api-version=${this.azureApiVersion}`;

      // Usar node-fetch com form-data (compatibilidade com Node.js)
      const FormData = (await import('form-data')).default;
      const nodeFetch = (await import('node-fetch')).default;
      const { Readable } = await import('stream');

      const formData = new FormData();
      // Converter Buffer para Readable stream para form-data
      const audioStream = Readable.from(wavBuffer);
      formData.append('file', audioStream, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
        knownLength: wavBuffer.length
      });
      formData.append('language', options.language || 'pt');
      formData.append('response_format', options.response_format || 'verbose_json');
      formData.append('temperature', '0'); // Temperatura 0 para determinismo

      // ✅ Prompt para contexto médico e redução de alucinações
      formData.append('prompt', 'Esta é uma consulta médica profissional em português brasileiro entre médico e paciente. Transcreva APENAS o que foi realmente dito na consulta. Use terminologia médica adequada. NÃO invente palavras ou frases. NÃO transcreva ruído ou silêncio como palavras.');

      console.log(`🌐 [TRANSCRIPTION-SERVICE] Enviando para Azure: ${azureUrl}`);

      const response = await nodeFetch(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.azureApiKey,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure Whisper API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as any;

      // 📊 Registrar uso do Whisper para monitoramento de custos
      // ✅ USAR DURAÇÃO REAL DO WHISPER (result.duration em segundos)
      // Whisper retorna a duração exata do áudio processado no campo 'duration'
      const actualAudioDurationMs = result.duration ? (result.duration * 1000) : 1000;

      // ✅ NOVO: Passar texto transcrito e payload completo
      await aiPricingService.logWhisperUsage(
        actualAudioDurationMs,
        consultaId,
        result.text, // Texto transcrito
        result       // Payload completo da API
      );
      console.log(`📊 [TRANSCRIPTION-SERVICE] Uso Whisper registrado: ${(actualAudioDurationMs / 1000).toFixed(2)}s de áudio (duração real do Whisper)`);

      return result;

    } catch (error) {
      console.error('Erro na transcrição:', error);
      logError(
        `Erro na transcrição de áudio via Azure OpenAI Whisper`,
        'error',
        consultaId || null,
        { language: options.language, error: error instanceof Error ? error.message : String(error) }
      );
      return null;
    }
  }

  private convertToWav(rawBuffer: Buffer, sampleRate: number = 16000, channels: number = 1): Buffer {
    const length = rawBuffer.length;
    const buffer = Buffer.alloc(44 + length);

    // WAV Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + length, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * 2, 28);
    buffer.writeUInt16LE(channels * 2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(length, 40);

    rawBuffer.copy(buffer, 44);
    return buffer;
  }

  private async sendTranscriptionToRoom(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // ✅ Salvar no banco (LiveKit removido - usando WebRTC direto via WebSocket)
      await this.saveTranscriptionToDatabase(roomName, segment);

      // Emitir evento para que outros serviços possam escutar
      this.emit('transcription', { roomName, segment });

      console.log(`📝 Transcrição salva no banco: ${segment.participantName}: ${segment.text}`);

    } catch (error) {
      console.error('❌ Erro ao salvar transcrição:', error);
      logError(
        `Erro ao salvar transcrição para sala`,
        'error',
        null,
        { roomName, participantId: segment.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async saveTranscriptionToDatabase(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // ✅ NOVO: Buscar session_id a partir do roomName
      let sessionId: string | null = null;

      // Tentar buscar session_id da call_sessions usando roomName
      const { data: callSession, error: sessionError } = await this.supabase
        .from('call_sessions')
        .select('id')
        .or(`room_id.eq.${roomName},room_name.eq.${roomName}`)
        .maybeSingle();

      if (callSession?.id) {
        sessionId = callSession.id;
      } else {
        // Se não encontrou, tentar usar roomName como sessionId (fallback)
        sessionId = roomName;
        console.warn(`⚠️ Session ID não encontrado para roomName ${roomName}, usando roomName como sessionId`);
      }

      // Mapear speaker baseado no participantId ou participantName
      let speaker: 'doctor' | 'patient' | 'system' = 'system';

      // 1. Tentar usar o papel já identificado no segmento se confiável
      if (segment.speaker === 'MEDICO') speaker = 'doctor';
      else if (segment.speaker === 'PACIENTE') speaker = 'patient';

      // 2. Fallback: Analisar nome/ID (Se ainda for system ou UNKNOWN)
      if (speaker === 'system') {
        const participantLower = ((segment.participantId || '') + (segment.participantName || '')).toLowerCase();

        // Identificação de Médico (Case insensitive e variações)
        if (participantLower.includes('doctor') || participantLower.includes('médico') || participantLower.includes('medico')) {
          speaker = 'doctor';
        } else {
          // Para transcrições de áudio, se não é médico, assumimos que é o paciente
          // Isso resolve o problema de IDs temporários (ex: Temp-123) sendo marcados como system
          speaker = 'patient';
        }
      }

      // ✅ Usar addTranscriptionToSession em vez de insert direto
      // Isso garante que todas as transcrições sejam salvas em um único registro (array)
      const { db } = await import('../config/database');

      // ✅ Validar que sessionId é um UUID válido
      if (!sessionId || (sessionId.length !== 36 && !sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
        console.error('❌ [TRANSCRIPTION-SERVICE] sessionId inválido:', sessionId);
        console.error('❌ [TRANSCRIPTION-SERVICE] roomName:', roomName);
        return;
      }

      // ✅ Determinar speaker_id (nome real do participante)
      const speakerId = segment.participantName || segment.participantId || speaker;

      const success = await db.addTranscriptionToSession(sessionId, {
        speaker: speaker,
        speaker_id: speakerId,
        text: segment.text,
        confidence: segment.confidence || 0.9,
        start_ms: new Date(segment.timestamp).getTime(),
        end_ms: new Date(segment.timestamp).getTime() + 1000, // Assumir 1 segundo de duração
        doctor_name: speaker === 'doctor' ? speakerId : undefined
      });

      if (!success) {
        console.error('❌ [TRANSCRIPTION-SERVICE] Erro ao salvar transcrição no banco (array)');
        // ... (logging error)
      } else {
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição salva no banco (array - ${speaker}):`, segment.text.substring(0, 50) + '...');
      }

      // ✅ NOVO: Salvar na tabela 'transcriptions' (append) para cumprir requisito "salvar toda vez"
      // Tentar pegar consultationId do mapa ou buscar do banco se necessário
      let consultationId = this.roomConsultations.get(roomName) || null;

      if (!consultationId && sessionId) {
        // Tentar recuperar da call_sessions se tivermos sessionId mas não consultationId
        // (Otimização: idealmente já teríamos no map)
        const { data: sessionData } = await this.supabase
          .from('call_sessions')
          .select('consultation_id')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionData?.consultation_id) {
          consultationId = sessionData.consultation_id;
          this.roomConsultations.set(roomName, consultationId as string); // Cache
        }
      }

      if (consultationId) {
        console.log(`===> SPEAKER: ${speaker}`)
        // Formatar speaker para o padrão: [MEDICO] ou [PACIENTE]
        let formattedSpeaker = '';
        if (speaker === 'doctor') {
          formattedSpeaker = 'MEDICO';
        } else {
          formattedSpeaker = 'PACIENTE';
        }

        // Formatar timestamp para visualização (HH:mm:ss)
        const date = new Date(segment.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;

        // Salvar raw_text appendado (Req 2)
        await db.appendConsultationTranscription(
          consultationId as string,
          segment.text,
          formattedSpeaker,
          formattedTime
        );
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição anexada à tabela 'transcriptions' para consulta ${consultationId}`);
      } else {
        console.warn(`⚠️ [TRANSCRIPTION-SERVICE] Não foi possível anexar à tabela 'transcriptions': consultationId não encontrado para sala ${roomName}`);
      }

    } catch (error) {
      console.error('❌ Erro no banco de dados ao salvar transcrição:', error);
      logError(
        `Erro no banco de dados ao salvar transcrição via TranscriptionService`,
        'error',
        null,
        { roomName, participantId: segment.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ✅ Cache de nomes e roles de participantes
  private participantRegistry: Map<string, { name: string; role: 'doctor' | 'patient' }> = new Map();

  public registerParticipant(participantId: string, name: string, role: 'doctor' | 'patient') {
    this.participantRegistry.set(participantId, { name, role });
    console.log(`👤 [TRANSCRIPTION-SERVICE] Participante registrado: ${name} (${role}) - ID: ${participantId}`);
  }

  private async getParticipantName(participantId: string): Promise<string> {
    try {
      if (this.participantRegistry.has(participantId)) {
        return this.participantRegistry.get(participantId)!.name;
      }

      const { data } = await this.supabase
        .from('participants')
        .select('name')
        .eq('id', participantId)
        .single();

      return data?.name || participantId;
    } catch (error) {
      return participantId;
    }
  }

  private getParticipantRole(participantId: string): 'doctor' | 'patient' | 'system' {
    if (this.participantRegistry.has(participantId)) {
      return this.participantRegistry.get(participantId)!.role;
    }
    return 'system';
  }

  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const activeParticipants = this.activeRooms.get(roomName)?.size || 0;
      const bufferSize = this.audioBuffers.size;

      return {
        roomName,
        activeParticipants,
        bufferSize,
        isActive: this.activeRooms.has(roomName),
        livekitConnected: false // Por enquanto false até resolver SSL
      };

    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

export const transcriptionService = new TranscriptionService();