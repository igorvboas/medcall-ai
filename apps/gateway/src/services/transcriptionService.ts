import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { 
  Room, 
  RoomEvent, 
  RemoteParticipant, 
  RemoteTrack, 
  RemoteTrackPublication,
  AudioStream,
  dispose 
} from '@livekit/rtc-node';
import { randomUUID } from 'crypto';
import { TextEncoder } from 'util';

interface TranscriptionSegment {
  id: string;
  text: string;
  participantId: string;
  participantName: string;
  timestamp: Date;
  is_final: boolean;
  confidence?: number;
  language?: string;
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
  private roomConnections: Map<string, Room> = new Map();
  private audioStreams: Map<string, AudioStream> = new Map();
  private processingBuffers: Map<string, Int16Array[]> = new Map();
  private processingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
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

  async startTranscription(roomName: string, consultationId: string): Promise<void> {
    try {
      console.log(`[LiveKit] Iniciando transcrição para sala: ${roomName}`);
      
      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }
      
      await this.connectToRoom(roomName, consultationId);
      
    } catch (error) {
      console.error('[LiveKit] Erro ao iniciar transcrição:', error);
      throw error;
    }
  }

  async stopTranscription(roomName: string): Promise<void> {
    try {
      console.log(`[LiveKit] Parando transcrição para sala: ${roomName}`);
      
       // Limpar streams de áudio
       const audioStreams = Array.from(this.audioStreams.entries())
         .filter(([key]) => key.startsWith(roomName));
       
       for (const [key] of audioStreams) {
         this.audioStreams.delete(key);
       }
      
      // Limpar buffers de processamento
      const bufferKeys = Array.from(this.processingBuffers.keys())
        .filter(key => key.startsWith(roomName));
      
      for (const key of bufferKeys) {
        const timeout = this.processingTimeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.processingTimeouts.delete(key);
        }
        this.processingBuffers.delete(key);
      }
      
      // Desconectar da sala
      const room = this.roomConnections.get(roomName);
      if (room) {
        await room.disconnect();
        this.roomConnections.delete(roomName);
      }
      
      this.activeRooms.delete(roomName);
      
    } catch (error) {
      console.error('[LiveKit] Erro ao parar transcrição:', error);
    }
  }

  private async connectToRoom(roomName: string, consultationId: string): Promise<void> {
    try {
      if (this.roomConnections.has(roomName)) {
        console.log(`[LiveKit] Já conectado à sala: ${roomName}`);
        return;
      }

      // Criar token para agente de transcrição
      const token = new AccessToken(
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!,
        {
          identity: `transcription-agent-${consultationId}`,
          name: 'Agente de Transcrição LiveKit'
        }
      );
      
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: false,       // Agente não publica áudio/vídeo
        canSubscribe: true,      // Subscreve para ouvir participantes
        canPublishData: true     // Publica transcrições via data channels
      });
      
      const jwt = await token.toJwt();
      
      console.log(`[LiveKit] Conectando agente à sala: ${roomName}`);
      
      // Conectar usando API oficial @livekit/rtc-node
      const room = new Room();
      await room.connect(process.env.LIVEKIT_URL!, jwt, {
        autoSubscribe: true,  // Subscrever automaticamente a tracks de áudio
        dynacast: true        // Otimizar bandwidth
      });
      
      this.roomConnections.set(roomName, room);
      console.log(`[LiveKit] ✅ Agente conectado com sucesso à sala: ${roomName}`);
      
      // Configurar event listeners nativos LiveKit
      this.setupRoomEventListeners(room, roomName);
      
    } catch (error) {
      console.error('[LiveKit] Erro ao conectar à sala:', error);
      throw error;
    }
  }

  private setupRoomEventListeners(room: Room, roomName: string): void {
    // Participante conectou
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`[LiveKit] Participante conectou: ${participant.identity}`);
      const activeParticipants = this.activeRooms.get(roomName) || new Set();
      activeParticipants.add(participant.identity);
      this.activeRooms.set(roomName, activeParticipants);
    });
    
    // Participante desconectou
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`[LiveKit] Participante desconectou: ${participant.identity}`);
      const activeParticipants = this.activeRooms.get(roomName);
      if (activeParticipants) {
        activeParticipants.delete(participant.identity);
      }
      
       // Limpar stream de áudio do participante
       const streamKey = `${roomName}-${participant.identity}`;
       this.audioStreams.delete(streamKey);
    });
    
    // Track subscribed - EVENTO PRINCIPAL para captura de áudio
    room.on(RoomEvent.TrackSubscribed, async (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log(`[LiveKit] Track subscribed: ${track.kind} from ${participant.identity}`);
      
      // Verificar se é track de áudio usando comparação de string segura
      const trackKind = String(track.kind).toLowerCase();
      if (trackKind.includes('audio') || trackKind === '1') {
        console.log(`[LiveKit] Configurando captura de áudio para: ${participant.identity}`);
        await this.setupAudioCapture(track, participant, roomName);
      }
    });
    
    // Track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log(`[LiveKit] Track unsubscribed: ${track.kind} from ${participant.identity}`);
      
       // Limpar stream de áudio
       const streamKey = `${roomName}-${participant.identity}`;
       this.audioStreams.delete(streamKey);
    });
    
    // Desconexão da sala
    room.on(RoomEvent.Disconnected, () => {
      console.log(`[LiveKit] Agente desconectou da sala: ${roomName}`);
      this.roomConnections.delete(roomName);
    });
  }

  private async setupAudioCapture(track: RemoteTrack, participant: RemoteParticipant, roomName: string): Promise<void> {
    try {
      const streamKey = `${roomName}-${participant.identity}`;
      
      // Criar AudioStream nativo LiveKit para capturar frames de áudio
      const audioStream = new AudioStream(track);
      this.audioStreams.set(streamKey, audioStream);
      
      console.log(`[LiveKit] AudioStream configurado para: ${participant.identity}`);
      
      // Processar frames de áudio de forma assíncrona
      this.processAudioStream(audioStream, participant, roomName);
      
    } catch (error) {
      console.error(`[LiveKit] Erro ao configurar captura de áudio para ${participant.identity}:`, error);
    }
  }

  private async processAudioStream(audioStream: AudioStream, participant: RemoteParticipant, roomName: string): Promise<void> {
    try {
      const bufferKey = `${roomName}-${participant.identity}`;
      
      // Processar frames de áudio usando iterator nativo LiveKit
      for await (const audioFrame of audioStream) {
        // audioFrame contém os dados de áudio PCM
        const audioData = audioFrame.data; // Int16Array com dados PCM
        
        // Adicionar ao buffer para processamento em lotes
        if (!this.processingBuffers.has(bufferKey)) {
          this.processingBuffers.set(bufferKey, []);
        }
        
        this.processingBuffers.get(bufferKey)!.push(audioData);
        
        // Agendar processamento com debounce
        this.scheduleTranscriptionProcessing(bufferKey, participant, roomName);
      }
      
    } catch (error) {
      console.error(`[LiveKit] Erro no processamento de AudioStream para ${participant.identity}:`, error);
    }
  }

  private scheduleTranscriptionProcessing(bufferKey: string, participant: RemoteParticipant, roomName: string): void {
    // Cancelar timeout anterior se existir
    const existingTimeout = this.processingTimeouts.get(bufferKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Agendar processamento com debounce de 1 segundo
    const timeout = setTimeout(async () => {
      await this.processBufferedAudio(bufferKey, participant, roomName);
    }, 1000);
    
    this.processingTimeouts.set(bufferKey, timeout);
  }

  private async processBufferedAudio(bufferKey: string, participant: RemoteParticipant, roomName: string): Promise<void> {
    try {
      const audioBuffers = this.processingBuffers.get(bufferKey);
      if (!audioBuffers || audioBuffers.length === 0) {
        return;
      }
      
      // Combinar todos os frames em um único buffer
      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const combinedBuffer = new Int16Array(totalLength);
      
      let offset = 0;
      for (const buffer of audioBuffers) {
        combinedBuffer.set(buffer, offset);
        offset += buffer.length;
      }
      
      // Limpar buffer
      this.processingBuffers.set(bufferKey, []);
      
      // Verificar se há dados suficientes para transcrição
      if (combinedBuffer.length < 4000) { // Mínimo ~250ms de áudio a 16kHz
        return;
      }
      
      console.log(`[LiveKit] Processando ${combinedBuffer.length} samples de áudio de ${participant.identity}`);
      
      // Converter Int16Array para Buffer para Whisper
      const audioBuffer = Buffer.from(combinedBuffer.buffer);
      const transcription = await this.transcribeAudio(audioBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      });
      
      if (transcription && transcription.text.trim()) {
        await this.sendTranscriptionToRoom(roomName, {
          id: randomUUID(),
          text: transcription.text,
          participantId: participant.identity,
          participantName: participant.name || participant.identity,
          timestamp: new Date(),
          is_final: true,
          confidence: transcription.confidence,
          language: transcription.language
        });
      }
      
    } catch (error) {
      console.error('[LiveKit] Erro ao processar áudio bufferizado:', error);
    }
  }

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
      console.error('[LiveKit] Erro na transcrição Whisper:', error);
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
      // Salvar no banco de dados
      await this.saveTranscriptionToDatabase(segment);
      
      // Enviar via LiveKit data channels nativos
      await this.publishDataToRoom(roomName, {
        type: 'transcription',
        data: segment
      });
      
      console.log(`[LiveKit] ✅ Transcrição enviada: ${segment.participantName}: ${segment.text}`);
      
    } catch (error) {
      console.error('[LiveKit] Erro ao enviar transcrição:', error);
    }
  }

  private async publishDataToRoom(roomName: string, message: any): Promise<void> {
    try {
      const room = this.roomConnections.get(roomName);
      if (!room || !room.localParticipant) {
        console.error(`[LiveKit] Sala ou localParticipant não encontrado: ${roomName}`);
        return;
      }
      
      const messageData = JSON.stringify(message);
      const encoder = new TextEncoder();
      const data = encoder.encode(messageData);
      
      // Usar API nativa publishData do LiveKit
      await room.localParticipant.publishData(data, {
        reliable: true,
        topic: 'transcription'
      });
      
      console.log(`[LiveKit] ✅ Dados enviados via data channel: ${roomName}`);
      
    } catch (error) {
      console.error('[LiveKit] Erro ao publicar dados:', error);
    }
  }

  private async saveTranscriptionToDatabase(segment: TranscriptionSegment): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('utterances')
        .insert({
          id: segment.id,
          session_id: segment.participantId, // Usar participantId como session_id temporário
          speaker: this.mapParticipantToSpeaker(segment.participantId),
          speaker_id: segment.participantId,
          text: segment.text,
          is_final: segment.is_final,
          start_ms: Date.now(),
          end_ms: null,
          confidence: segment.confidence,
          processing_status: 'completed'
        });
      
      if (error) {
        console.error('[LiveKit] Erro ao salvar transcrição:', error);
      }
      
    } catch (error) {
      console.error('[LiveKit] Erro no banco de dados:', error);
    }
  }

  private mapParticipantToSpeaker(participantId: string): 'doctor' | 'patient' | 'system' {
    if (participantId.includes('doctor') || participantId.includes('medico')) {
      return 'doctor';
    } else if (participantId.includes('transcription-agent')) {
      return 'system';
    } else {
      return 'patient';
    }
  }

  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const activeParticipants = this.activeRooms.get(roomName)?.size || 0;
      const activeStreams = Array.from(this.audioStreams.keys())
        .filter(key => key.startsWith(roomName)).length;
      const isConnected = this.roomConnections.has(roomName);
      
      return {
        roomName,
        activeParticipants,
        activeAudioStreams: activeStreams,
        isActive: this.activeRooms.has(roomName),
        livekitConnected: isConnected,
        bufferCount: this.processingBuffers.size
      };
      
    } catch (error) {
      console.error('[LiveKit] Erro ao obter estatísticas:', error);
      return null;
    }
  }

  // Cleanup ao finalizar aplicação
  async dispose(): Promise<void> {
    console.log('[LiveKit] Finalizando TranscriptionService...');
    
    // Fechar todas as conexões
    for (const [roomName, room] of this.roomConnections) {
      try {
        await room.disconnect();
        console.log(`[LiveKit] Sala desconectada: ${roomName}`);
      } catch (error) {
        console.error(`[LiveKit] Erro ao desconectar sala ${roomName}:`, error);
      }
    }
    
     // Fechar todos os streams de áudio
     for (const [streamKey] of this.audioStreams) {
       console.log(`[LiveKit] AudioStream removido: ${streamKey}`);
     }
    
    // Limpar timeouts
    for (const timeout of this.processingTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    // Limpar mapas
    this.roomConnections.clear();
    this.audioStreams.clear();
    this.processingBuffers.clear();
    this.processingTimeouts.clear();
    this.activeRooms.clear();
    
    // Dispose global do LiveKit
    await dispose();
    
    console.log('[LiveKit] ✅ TranscriptionService finalizado');
  }
}

export const transcriptionService = new TranscriptionService();

// Cleanup graceful ao finalizar processo
process.on('SIGINT', async () => {
  await transcriptionService.dispose();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await transcriptionService.dispose();
  process.exit(0);
});