import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { TextEncoder } from 'util';

interface TranscriptionSegment {
  id: string;
  text: string;
  participantId: string;
  participantName: string;
  timestamp: Date;
  final: boolean;  // REVERTER: usar final como estava antes
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
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
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
      console.log(`Iniciando transcrição para sala: ${roomName}`);
      
      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }
      
      // SIMPLIFICAR: Não conectar como participante por enquanto devido ao SSL
      console.log(`Transcrição ativada para sala: ${roomName} (via WebSocket)`);
      
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
      console.log(`Parando transcrição para sala: ${roomName}`);
      
      this.audioBuffers.delete(roomName);
      
      const timeout = this.processingQueue.get(roomName);
      if (timeout) {
        clearTimeout(timeout);
        this.processingQueue.delete(roomName);
      }
      
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
      
      const bufferKey = `${roomName}-${participantId}`;
      if (!this.audioBuffers.has(bufferKey)) {
        this.audioBuffers.set(bufferKey, []);
      }
      
      this.audioBuffers.get(bufferKey)!.push(data);
      this.scheduleProcessing(bufferKey, roomName, participantId);
      
    } catch (error) {
      console.error('Erro ao processar chunk de áudio:', error);
    }
  }

  /**
   * Agendar processamento de transcrição
   */
  private scheduleProcessing(bufferKey: string, roomName: string, participantId: string): void {
    const existingTimeout = this.processingQueue.get(bufferKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
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
      
      const combinedBuffer = Buffer.concat(audioBuffers);
      this.audioBuffers.set(bufferKey, []);
      
      if (combinedBuffer.length < 8000) {
        return;
      }
      
      const transcription = await this.transcribeAudio(combinedBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      });
      
      if (transcription && transcription.text.trim()) {
        await this.sendTranscriptionToRoom(roomName, {
          id: this.generateTranscriptionId(),
          text: transcription.text,
          participantId,
          participantName: await this.getParticipantName(participantId),
          timestamp: new Date(),
          final: true,  // REVERTER: usar final
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
      const wavBuffer = this.convertToWav(audioBuffer);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      const formData = new FormData();
      formData.append('file', blob, 'audio.wav');
      formData.append('model', options.model || 'whisper-1');
      formData.append('language', options.language || 'pt');
      formData.append('response_format', options.response_format || 'verbose_json');
      formData.append('temperature', (options.temperature || 0).toString());

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      return await response.json();
      
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
    
    rawBuffer.copy(buffer, 44);
    return buffer;
  }

  /**
   * Enviar transcrição para a sala
   */
  private async sendTranscriptionToRoom(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // SIMPLIFICAR: Apenas salvar no banco e emitir evento (WebSocket irá enviar)
      await this.saveTranscriptionToDatabase(segment);
      
      this.emit('transcription', { roomName, segment });
      
      console.log(`Transcrição enviada: ${segment.participantName}: ${segment.text}`);
      
    } catch (error) {
      console.error('Erro ao enviar transcrição:', error);
    }
  }

  /**
   * Salvar transcrição no banco (usar estrutura original que funcionava)
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
   * Gerar ID único para transcrição (formato que funcionava)
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
        isActive: this.activeRooms.has(roomName),
        livekitConnected: false  // Por enquanto false devido ao SSL
      };
      
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();