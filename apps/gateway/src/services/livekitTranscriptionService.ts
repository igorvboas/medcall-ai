import { RoomServiceClient, AccessToken, DataPacket_Kind } from 'livekit-server-sdk';
import { EventEmitter } from 'events';
import { transcriptionService } from './transcriptionService';
import { config } from '../config';

interface LiveKitTranscriptionConfig {
  roomName: string;
  consultationId: string;
  participantId: string;
  participantName: string;
}

export class LiveKitTranscriptionService extends EventEmitter {
  private livekitClient: RoomServiceClient;
  private activeRooms: Map<string, LiveKitTranscriptionConfig> = new Map();

  constructor() {
    super();
    
    this.livekitClient = new RoomServiceClient(
      config.LIVEKIT_URL,
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET
    );

    console.log('🎤 LiveKit Transcription Service inicializado');
  }

  /**
   * Iniciar transcrição para uma sala LiveKit
   */
  async startTranscription(config: LiveKitTranscriptionConfig): Promise<void> {
    try {
      const { roomName, consultationId, participantId, participantName } = config;
      
      console.log(`🎤 Iniciando transcrição LiveKit para sala: ${roomName}`);
      
      // Verificar se a sala existe
      const rooms = await this.livekitClient.listRooms();
      const room = rooms.find(r => r.name === roomName);
      
      if (!room) {
        console.log(`⚠️ Sala ${roomName} não encontrada, mas continuando...`);
      }

      // Registrar configuração da sala
      this.activeRooms.set(roomName, config);

      // Iniciar transcrição no TranscriptionService
      await transcriptionService.startTranscription(roomName, consultationId);

      console.log(`✅ Transcrição LiveKit iniciada para sala: ${roomName}`);
      
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
      console.log(`🛑 Parando transcrição LiveKit para sala: ${roomName}`);
      
      // Parar transcrição no TranscriptionService
      await transcriptionService.stopTranscription(roomName);
      
      // Remover configuração
      this.activeRooms.delete(roomName);
      
      console.log(`✅ Transcrição LiveKit parada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao parar transcrição LiveKit:', error);
      throw error;
    }
  }

  /**
   * Processar áudio recebido do LiveKit
   */
  async processLiveKitAudio(audioData: Buffer, participantId: string, roomName: string): Promise<void> {
    try {
      const config = this.activeRooms.get(roomName);
      if (!config) {
        console.warn(`⚠️ Configuração não encontrada para sala: ${roomName}`);
        return;
      }

      // Converter áudio para formato esperado pelo TranscriptionService
      const audioChunk = {
        data: audioData,
        participantId,
        sampleRate: 16000, // LiveKit usa 16kHz por padrão
        channels: 1
      };

      // Processar áudio
      await transcriptionService.processAudioChunk(audioChunk, roomName);
      
    } catch (error) {
      console.error('❌ Erro ao processar áudio LiveKit:', error);
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

      const stats = await transcriptionService.getTranscriptionStats(roomName);

      return {
        roomName,
        isActive: this.activeRooms.has(roomName),
        isConnected: true, // Simplificado por enquanto
        participants: 0, // Será implementado quando necessário
        ...stats
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
      console.log('🧹 Limpando recursos do LiveKit Transcription Service...');
      
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

export const livekitTranscriptionService = new LiveKitTranscriptionService();
