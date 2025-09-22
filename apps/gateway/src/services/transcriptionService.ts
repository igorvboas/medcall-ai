import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { Room, RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { Room as ClientRoom, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import { TextEncoder } from 'util';

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
  
  // Novo: Gerenciar conexões reais às salas
  private roomConnections: Map<string, ClientRoom> = new Map();
  
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
      console.log(`Iniciando transcrição para sala: ${roomName}`);
      
      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }
      
      // Conectar à sala LiveKit como participante real
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
      console.log(`Parando transcrição para sala: ${roomName}`);
      
      // Desconectar da sala LiveKit
      const room = this.roomConnections.get(roomName);
      if (room) {
        await room.disconnect();
        this.roomConnections.delete(roomName);
      }
      
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
   * Processar chunk de áudio (mantém lógica existente)
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
   * Agendar processamento de transcrição (mantém lógica existente)
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
   * Processar áudio bufferizado (mantém lógica existente)
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
   * Transcrever áudio usando OpenAI Whisper (mantém lógica existente)
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
   * Converter buffer raw para WAV (mantém lógica existente)
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
   * Enviar transcrição para a sala LiveKit (mantém estrutura, muda implementação)
   */
  private async sendTranscriptionToRoom(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // Salvar no banco de dados (mantém)
      await this.saveTranscriptionToDatabase(segment);
      
      // NOVO: Enviar via LiveKit data stream real
      await this.sendLiveKitDataMessage(roomName, {
        type: 'transcription',
        data: segment
      });
      
      // Emitir evento local (mantém)
      this.emit('transcription', { roomName, segment });
      
      console.log(`Transcrição enviada: ${segment.participantName}: ${segment.text}`);
      
    } catch (error) {
      console.error('Erro ao enviar transcrição:', error);
    }
  }

  /**
   * NOVO: Conectar à sala LiveKit como participante real
   */
  private async connectToRoom(roomName: string, consultationId: string): Promise<void> {
    try {
      // Verificar se já conectado
      if (this.roomConnections.has(roomName)) {
        console.log(`Já conectado à sala: ${roomName}`);
        return;
      }

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
        canPublish: false,      // Não publica áudio/vídeo
        canSubscribe: true,     // Escuta áudio dos outros
        canPublishData: true    // Pode enviar dados (transcrições)
      });
      
      const jwt = await token.toJwt();
      
      console.log(`Conectando agente à sala: ${roomName}`);
      
      // Conectar à sala usando cliente LiveKit
      const room = new ClientRoom();
      await room.connect(process.env.LIVEKIT_URL!, jwt, {
        autoSubscribe: true,    // Inscrever automaticamente em tracks
      });
      
      // Armazenar conexão
      this.roomConnections.set(roomName, room);
      
      // Configurar event listeners
      room.on('participantConnected', (participant: RemoteParticipant) => {
        console.log(`Participante conectou: ${participant.identity}`);
      });
      
      room.on('participantDisconnected', (participant: RemoteParticipant) => {
        console.log(`Participante desconectou: ${participant.identity}`);
      });
      
      room.on('trackSubscribed', (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log(`Track subscribed: ${track.kind} from ${participant.identity}`);
        // Aqui poderia escutar áudio diretamente se necessário
      });
      
      room.on('disconnected', () => {
        console.log(`Agente desconectou da sala: ${roomName}`);
        this.roomConnections.delete(roomName);
      });
      
      console.log(`Agente conectado com sucesso à sala: ${roomName}`);
      
    } catch (error) {
      console.error('Erro ao conectar à sala:', error);
      throw error;
    }
  }

  /**
   * NOVO: Implementação real do envio de dados via LiveKit
   */
  private async sendLiveKitDataMessage(roomName: string, message: any): Promise<void> {
    try {
      const room = this.roomConnections.get(roomName);
      if (!room) {
        console.error(`Sala não encontrada: ${roomName}`);
        return;
      }
      
      // Serializar mensagem para envio
      const messageData = JSON.stringify(message);
      const encoder = new TextEncoder();
      const data = encoder.encode(messageData);
      
      // Enviar dados via LiveKit usando formato correto
      await room.localParticipant.publishData(data, {
        reliable: true,           // Garantir entrega
        topic: 'transcription'    // Tópico específico
      });
      
      console.log(`Dados enviados via LiveKit para sala ${roomName}:`, message.type);
      
    } catch (error) {
      console.error('Erro ao enviar dados LiveKit:', error);
    }
  }

  /**
   * Salvar transcrição no banco de dados (mantém lógica existente)
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
   * Obter nome do participante (mantém lógica existente)
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
   * Gerar ID único para transcrição (mantém lógica existente)
   */
  private generateTranscriptionId(): string {
    return `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obter estatísticas de transcrição (mantém lógica existente)
   */
  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const activeParticipants = this.activeRooms.get(roomName)?.size || 0;
      const bufferSize = this.audioBuffers.size;
      const isConnected = this.roomConnections.has(roomName);
      
      return {
        roomName,
        activeParticipants,
        bufferSize,
        isActive: this.activeRooms.has(roomName),
        livekitConnected: isConnected
      };
      
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();