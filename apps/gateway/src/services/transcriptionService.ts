// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logError, logWarning } from '../config/database';

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
      this.setupAudioCapture(roomName, consultationId);
      
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
      
      const timeout = this.processingQueue.get(roomName);
      if (timeout) {
        clearTimeout(timeout);
        this.processingQueue.delete(roomName);
      }
      
      this.activeRooms.delete(roomName);
      
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
      logError(
        `Erro ao processar chunk de áudio`,
        'error',
        null,
        { roomName, participantId: audioChunk.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

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
          id: randomUUID(),
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
      logError(
        `Erro ao processar áudio bufferizado`,
        'error',
        null,
        { roomName, participantId, error: error instanceof Error ? error.message : String(error) }
      );
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
      console.error('Erro na transcrição:', error);
      logError(
        `Erro na transcrição de áudio via OpenAI Whisper`,
        'error',
        null,
        { language: options.language, model: options.model, error: error instanceof Error ? error.message : String(error) }
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
      // ✅ Salvar no banco ANTES de enviar (para não perder dados)
      await this.saveTranscriptionToDatabase(roomName, segment);
      
      // Enviar via LiveKit Data Channel nativo
      await this.sendDataViaRoomService(roomName, {
        type: 'transcription',
        data: segment
      });
      
      this.emit('transcription', { roomName, segment });
      
      console.log(`📝 Transcrição enviada via LiveKit nativo: ${segment.participantName}: ${segment.text}`);
      
    } catch (error) {
      console.error('❌ Erro ao enviar transcrição:', error);
      logError(
        `Erro ao enviar transcrição para sala`,
        'error',
        null,
        { roomName, participantId: segment.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async sendDataViaRoomService(roomName: string, message: any): Promise<void> {
    try {
      const messageData = JSON.stringify(message);
      const encoder = new TextEncoder();
      const data = encoder.encode(messageData);
      
      // Usar RoomServiceClient.sendData para enviar dados sem conectar como participante
      await this.livekitClient.sendData(roomName, data, DataPacket_Kind.RELIABLE);
      
      console.log(`Dados enviados via RoomServiceClient para sala ${roomName}`);
      
    } catch (error) {
      console.error('Erro ao enviar dados via RoomServiceClient:', error);
      logError(
        `Erro ao enviar dados via RoomServiceClient LiveKit`,
        'error',
        null,
        { roomName, error: error instanceof Error ? error.message : String(error) }
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
      const participantLower = (segment.participantId + segment.participantName).toLowerCase();
      if (participantLower.includes('doctor') || participantLower.includes('médico') || participantLower.includes('Medico')) {
        speaker = 'doctor';
      } else if (participantLower.includes('patient') || participantLower.includes('Paciente')) {
        speaker = 'patient';
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
        start_ms: segment.timestamp.getTime(),
        end_ms: segment.timestamp.getTime() + 1000, // Assumir 1 segundo de duração
        doctor_name: speaker === 'doctor' ? speakerId : undefined
      });
      
      if (!success) {
        console.error('❌ [TRANSCRIPTION-SERVICE] Erro ao salvar transcrição no banco');
        console.error('❌ [TRANSCRIPTION-SERVICE] Dados tentados:', {
          session_id: sessionId,
          speaker,
          speaker_id: speakerId,
          text: segment.text.substring(0, 50) + '...',
          roomName
        });
        logError(
          `Erro ao salvar transcrição no banco via TranscriptionService`,
          'error',
          null,
          { sessionId, speaker, speakerId, roomName, textLength: segment.text.length }
        );
      } else {
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição salva no banco (${speaker}):`, segment.text.substring(0, 50) + '...');
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