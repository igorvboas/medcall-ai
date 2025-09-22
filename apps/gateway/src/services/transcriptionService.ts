import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { Room, RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import WebSocket from 'ws';

interface TranscriptionSegment {
  id: string;
  text: string;
  participantId: string;
  participantName: string;
  timestamp: Date;
  final: boolean;
  confidence?: number;
  language?: string;
}

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
  private openai: OpenAI;
  private supabase: any;
  private livekitClient: RoomServiceClient;
  private activeRooms: Map<string, Set<string>> = new Map();
  private audioBuffers: Map<string, Buffer[]> = new Map();
  private processingQueue: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    
    // Configurar OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Configurar Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Configurar LiveKit
    this.livekitClient = new RoomServiceClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
  }

  /**
   * Iniciar transcrição para uma sala
   */
  async startTranscription(roomName: string, consultationId: string): Promise<void> {
    try {
      console.log(`🎤 Iniciando transcrição para sala: ${roomName}`);
      
      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }
      
      // Conectar à sala LiveKit como participante invisível
      await this.connectToRoom(roomName, consultationId);
      
    } catch (error) {
      console.error('Erro ao iniciar transcrição:', error);
      throw error;
    }
  }

  /**
   * Parar transcrição para uma sala
   */
  async stopTranscription(roomName: string): Promise<void> {
    try {
      console.log(`🛑 Parando transcrição para sala: ${roomName}`);
      
      // Limpar buffers de áudio
      this.audioBuffers.delete(roomName);
      
      // Cancelar processamento pendente
      const timeout = this.processingQueue.get(roomName);
      if (timeout) {
        clearTimeout(timeout);
        this.processingQueue.delete(roomName);
      }
      
      // Remover sala ativa
      this.activeRooms.delete(roomName);
      
    } catch (error) {
      console.error('Erro ao parar transcrição:', error);
      throw error;
    }
  }

  /**
   * Processar chunk de áudio
   */
  async processAudioChunk(audioChunk: AudioChunk, roomName: string): Promise<void> {
    try {
      const { data, participantId } = audioChunk;
      
      // Adicionar ao buffer
      const bufferKey = `${roomName}-${participantId}`;
      if (!this.audioBuffers.has(bufferKey)) {
        this.audioBuffers.set(bufferKey, []);
      }
      
      this.audioBuffers.get(bufferKey)!.push(data);
      
      // Processar em lotes (debounce)
      this.scheduleProcessing(bufferKey, roomName, participantId);
      
    } catch (error) {
      console.error('Erro ao processar chunk de áudio:', error);
    }
  }

  /**
   * Agendar processamento de transcrição
   */
  private scheduleProcessing(bufferKey: string, roomName: string, participantId: string): void {
    // Cancelar timeout anterior se existir
    const existingTimeout = this.processingQueue.get(bufferKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Agendar novo processamento em 1 segundo
    const timeout = setTimeout(async () => {
      await this.processBufferedAudio(bufferKey, roomName, participantId);
    }, 1000);
    
    this.processingQueue.set(bufferKey, timeout);
  }

  /**
   * Processar áudio bufferizado
   */
  private async processBufferedAudio(bufferKey: string, roomName: string, participantId: string): Promise<void> {
    try {
      const audioBuffers = this.audioBuffers.get(bufferKey);
      if (!audioBuffers || audioBuffers.length === 0) {
        return;
      }
      
      // Concatenar buffers
      const combinedBuffer = Buffer.concat(audioBuffers);
      
      // Limpar buffer
      this.audioBuffers.set(bufferKey, []);
      
      // Verificar se há áudio suficiente (mínimo 0.5 segundos)
      if (combinedBuffer.length < 8000) { // ~0.5s a 16kHz
        return;
      }
      
      // Converter para formato WAV e transcrever
      const transcription = await this.transcribeAudio(combinedBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      });
      
      if (transcription && transcription.text.trim()) {
        // Enviar transcrição para a sala
        await this.sendTranscriptionToRoom(roomName, {
          id: this.generateTranscriptionId(),
          text: transcription.text,
          participantId,
          participantName: await this.getParticipantName(participantId),
          timestamp: new Date(),
          final: true,
          confidence: transcription.confidence,
          language: transcription.language
        });
      }
      
    } catch (error) {
      console.error('Erro ao processar áudio bufferizado:', error);
    }
  }

  /**
   * Transcrever áudio usando OpenAI Whisper
   */
  private async transcribeAudio(audioBuffer: Buffer, options: TranscriptionOptions = {}): Promise<any> {
    try {
      // Converter buffer para formato WAV
      const wavBuffer = this.convertToWav(audioBuffer);
      
      // Criar arquivo temporário em memória
      const file = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });
      
      const response = await this.openai.audio.transcriptions.create({
        file: file,
        model: options.model || 'whisper-1',
        language: options.language || 'pt',
        response_format: options.response_format || 'verbose_json',
        temperature: options.temperature || 0
      });
      
      return response;
      
    } catch (error) {
      console.error('Erro na transcrição:', error);
      return null;
    }
  }

  /**
   * Converter buffer raw para WAV
   */
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
    
    // Copiar dados de áudio
    rawBuffer.copy(buffer, 44);
    
    return buffer;
  }

  /**
   * Enviar transcrição para a sala LiveKit
   */
  private async sendTranscriptionToRoom(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // Salvar no banco de dados
      await this.saveTranscriptionToDatabase(segment);
      
      // Enviar via LiveKit data stream
      await this.sendLiveKitDataMessage(roomName, {
        type: 'transcription',
        data: segment
      });
      
      // Emitir evento local
      this.emit('transcription', { roomName, segment });
      
      console.log(`📝 Transcrição enviada: ${segment.participantName}: ${segment.text}`);
      
    } catch (error) {
      console.error('Erro ao enviar transcrição:', error);
    }
  }

  /**
   * Conectar à sala LiveKit como agente
   */
  private async connectToRoom(roomName: string, consultationId: string): Promise<void> {
    try {
      // Criar token para o agente de transcrição
      const token = new AccessToken(
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!,
        {
          identity: `transcription-agent-${consultationId}`,
          name: 'Agente de Transcrição'
        }
      );
      
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: false,
        canSubscribe: true,
        canPublishData: true
      });
      
      const jwt = token.toJwt();
      
      // Conectar à sala (implementação WebSocket/SDK específica)
      console.log(`🔗 Conectando agente à sala: ${roomName}`);
      
    } catch (error) {
      console.error('Erro ao conectar à sala:', error);
      throw error;
    }
  }

  /**
   * Enviar mensagem de dados via LiveKit
   */
  private async sendLiveKitDataMessage(roomName: string, message: any): Promise<void> {
    try {
      // Implementar envio de dados via LiveKit
      // Isso depende da implementação específica do seu cliente LiveKit
      console.log(`📤 Enviando dados para sala ${roomName}:`, message);
      
    } catch (error) {
      console.error('Erro ao enviar dados LiveKit:', error);
    }
  }

  /**
   * Salvar transcrição no banco de dados
   */
  private async saveTranscriptionToDatabase(segment: TranscriptionSegment): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('utterances')
        .insert({
          id: segment.id,
          text: segment.text,
          participant_id: segment.participantId,
          participant_name: segment.participantName,
          timestamp: segment.timestamp.toISOString(),
          confidence: segment.confidence,
          language: segment.language,
          final: segment.final
        });
      
      if (error) {
        console.error('Erro ao salvar transcrição:', error);
      }
      
    } catch (error) {
      console.error('Erro no banco de dados:', error);
    }
  }

  /**
   * Obter nome do participante
   */
  private async getParticipantName(participantId: string): Promise<string> {
    try {
      // Buscar no banco ou usar cache
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

  /**
   * Gerar ID único para transcrição
   */
  private generateTranscriptionId(): string {
    return `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obter estatísticas de transcrição
   */
  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const activeParticipants = this.activeRooms.get(roomName)?.size || 0;
      const bufferSize = this.audioBuffers.size;
      
      return {
        roomName,
        activeParticipants,
        bufferSize,
        isActive: this.activeRooms.has(roomName)
      };
      
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();