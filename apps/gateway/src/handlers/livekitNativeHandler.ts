import { RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { livekitNativeTranscriptionService } from '../services/livekitNativeTranscriptionService';

export class LiveKitNativeHandler {
  private livekitClient: RoomServiceClient;

  constructor() {
    this.livekitClient = new RoomServiceClient(
      process.env.LIVEKIT_URL || 'ws://localhost:7880',
      process.env.LIVEKIT_API_KEY || 'devkey',
      process.env.LIVEKIT_API_SECRET || 'secret'
    );
  }

  /**
   * Iniciar escuta de Data Channels LiveKit
   */
  async startListening(roomName: string): Promise<void> {
    try {
      console.log(`🎧 Iniciando escuta LiveKit nativa para sala: ${roomName}`);
      
      // Por enquanto, simular escuta
      // Em uma implementação real, isso seria feito via LiveKit SDK
      console.log(`✅ Escuta LiveKit nativa iniciada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar escuta LiveKit:', error);
      throw error;
    }
  }

  /**
   * Parar escuta de Data Channels LiveKit
   */
  async stopListening(roomName: string): Promise<void> {
    try {
      console.log(`🛑 Parando escuta LiveKit nativa para sala: ${roomName}`);
      
      console.log(`✅ Escuta LiveKit nativa parada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao parar escuta LiveKit:', error);
      throw error;
    }
  }

  /**
   * Processar mensagem recebida via Data Channel
   */
  async processDataChannelMessage(roomName: string, data: Buffer, participantId: string): Promise<void> {
    try {
      console.log(`📨 Processando mensagem Data Channel para sala: ${roomName}, participante: ${participantId}`);
      
      // Processar áudio via serviço nativo
      await livekitNativeTranscriptionService.processLiveKitAudioData(data, participantId, roomName);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem Data Channel:', error);
    }
  }
}

export const livekitNativeHandler = new LiveKitNativeHandler();
