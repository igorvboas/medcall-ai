import { RoomServiceClient, Room, DataPacket_Kind } from 'livekit-server-sdk';
import { TranscriptionService } from './transcriptionService';

export class LiveKitNativeTranscriptionService {
  private livekitClient: RoomServiceClient;
  private transcriptionService: TranscriptionService;
  private activeRooms: Map<string, Set<string>> = new Map();

  constructor() {
    this.livekitClient = new RoomServiceClient(
      process.env.LIVEKIT_URL || 'ws://localhost:7880',
      process.env.LIVEKIT_API_KEY || 'devkey',
      process.env.LIVEKIT_API_SECRET || 'secret'
    );
    
    this.transcriptionService = new TranscriptionService();
  }

  /**
   * Iniciar transcrição para uma sala LiveKit
   */
  async startTranscription(roomName: string): Promise<void> {
    try {
      console.log(`🎤 Iniciando transcrição LiveKit nativa para sala: ${roomName}`);
      
      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }
      
      console.log(`✅ Transcrição LiveKit nativa ativada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar transcrição LiveKit:', error);
      throw error;
    }
  }

  /**
   * Parar transcrição para uma sala LiveKit
   */
  async stopTranscription(roomName: string): Promise<void> {
    try {
      console.log(`🛑 Parando transcrição LiveKit nativa para sala: ${roomName}`);
      
      this.activeRooms.delete(roomName);
      
      console.log(`✅ Transcrição LiveKit nativa parada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao parar transcrição LiveKit:', error);
      throw error;
    }
  }

  /**
   * Processar áudio recebido via LiveKit Data Channel
   */
  async processLiveKitAudioData(data: Buffer, participantId: string, roomName: string): Promise<void> {
    try {
      console.log(`🎤 Processando áudio LiveKit para sala: ${roomName}, participante: ${participantId}`);
      
      // Decodificar mensagem
      const decoder = new TextDecoder();
      const messageStr = decoder.decode(data);
      const message = JSON.parse(messageStr);
      
      if (message.type === 'audio-data' && message.data) {
        const { audioData, sampleRate, channels } = message.data;
        
        // Converter base64 para Buffer
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        // Criar chunk de áudio
        const audioChunk = {
          data: audioBuffer,
          participantId,
          sampleRate: sampleRate || 16000,
          channels: channels || 1
        };
        
        // Processar áudio
        await this.transcriptionService.processAudioChunk(audioChunk, roomName);
        
        console.log(`✅ Áudio LiveKit processado para sala: ${roomName}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar áudio LiveKit:', error);
    }
  }

  /**
   * Enviar transcrição via LiveKit Data Channel
   */
  async sendTranscriptionViaLiveKit(roomName: string, transcription: any): Promise<void> {
    try {
      const message = {
        type: 'transcription',
        data: transcription
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      
      // Enviar via LiveKit Data Channel
      await this.livekitClient.sendData(roomName, data, DataPacket_Kind.RELIABLE);
      
      console.log(`📝 Transcrição enviada via LiveKit para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao enviar transcrição via LiveKit:', error);
    }
  }

  /**
   * Obter estatísticas de transcrição
   */
  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const config = this.activeRooms.get(roomName);
      if (!config) {
        return null;
      }

      return {
        roomName,
        isActive: this.activeRooms.has(roomName),
        isConnected: true,
        participants: config.size,
        transcriptionType: 'livekit-native'
      };
      
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  /**
   * Limpar recursos
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Limpando recursos do LiveKit Native Transcription Service...');
      
      // Parar todas as transcrições ativas
      for (const roomName of this.activeRooms.keys()) {
        await this.stopTranscription(roomName);
      }
      
      console.log('✅ Recursos limpos');
      
    } catch (error) {
      console.error('❌ Erro ao limpar recursos:', error);
    }
  }
}

export const livekitNativeTranscriptionService = new LiveKitNativeTranscriptionService();
