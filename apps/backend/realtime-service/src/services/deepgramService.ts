/**
 * DeepgramService - Serviço de transcrição em tempo real usando Deepgram
 *
 * Substitui o Whisper para transcrição de áudio em consultas médicas.
 * Vantagens sobre Whisper:
 * - VAD nativo (sem enviar silêncio para transcrição)
 * - Streaming via WebSocket (baixa latência)
 * - Sem alucinações de prompt echo
 * - Endpointing automático para detectar fim de fala
 */

import { EventEmitter } from 'events';
import { createClient, LiveTranscriptionEvents, type ListenLiveClient } from '@deepgram/sdk';
import { aiConfig } from '../config';
import { logError, logWarning } from '../config/database';

export interface DeepgramTranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  speechFinal: boolean;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word: string;
  }>;
  start: number;
  duration: number;
  channel: number;
}

interface DeepgramConnectionOptions {
  /** Identificador da sessão/sala */
  sessionId: string;
  /** Identificador do participante */
  participantId: string;
  /** Papel do participante */
  role: 'doctor' | 'patient';
  /** Sample rate do áudio (default: 16000) */
  sampleRate?: number;
  /** Encoding do áudio (default: linear16) */
  encoding?: string;
  /** Número de canais (default: 1) */
  channels?: number;
}

interface ActiveConnection {
  client: ListenLiveClient;
  sessionId: string;
  participantId: string;
  role: 'doctor' | 'patient';
  keepAliveInterval: NodeJS.Timeout | null;
  utteranceBuffer: string;
  lastTranscriptTime: number;
  isConnected: boolean;
}

export class DeepgramService extends EventEmitter {
  private deepgramClient: ReturnType<typeof createClient>;
  private connections: Map<string, ActiveConnection> = new Map();
  private enabled: boolean;
  // Buffer de áudio para enviar quando a conexão abrir
  private pendingAudio: Map<string, Buffer[]> = new Map();

  constructor() {
    super();
    const apiKey = aiConfig.deepgram?.apiKey || process.env.DEEPGRAM_API_KEY || '';
    this.enabled = !!(aiConfig.deepgram?.enabled && apiKey);

    if (!apiKey) {
      console.warn('⚠️ [DEEPGRAM] API key não configurada - serviço desabilitado');
      this.deepgramClient = null as any;
      return;
    }

    this.deepgramClient = createClient(apiKey);
    console.log('✅ [DEEPGRAM] Serviço inicializado');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gera uma chave única para a conexão
   */
  private getConnectionKey(sessionId: string, participantId: string): string {
    return `${sessionId}:${participantId}`;
  }

  /**
   * Cria uma conexão de streaming com o Deepgram
   */
  async createConnection(options: DeepgramConnectionOptions): Promise<string> {
    if (!this.enabled) {
      throw new Error('DeepgramService não está habilitado');
    }

    const key = this.getConnectionKey(options.sessionId, options.participantId);

    // Fechar conexão existente se houver
    if (this.connections.has(key)) {
      await this.closeConnection(options.sessionId, options.participantId);
    }

    const sampleRate = options.sampleRate || 16000;
    const encoding = options.encoding || 'linear16';
    const channels = options.channels || 1;

    try {
      const connection = this.deepgramClient.listen.live({
        // Modelo: nova-2 para português (mais estável e testado)
        model: 'nova-2',
        language: 'pt-BR',

        // Formatação inteligente
        smart_format: true,
        punctuate: true,
        numerals: true,

        // VAD e endpointing nativos do Deepgram
        // endpointing: tempo em ms para considerar fim de fala (300ms = responsivo)
        endpointing: 300,
        // utterance_end_ms: tempo adicional após endpointing para finalizar utterance
        utterance_end_ms: 1000,
        // vad_events: receber eventos de início de fala
        vad_events: true,
        // interim_results: resultados parciais enquanto a pessoa fala
        interim_results: true,

        // Configuração de áudio
        encoding: encoding as any,
        sample_rate: sampleRate,
        channels: channels,

        // Keywords para melhorar reconhecimento de termos médicos
        keywords: [
          'paciente:2',
          'doutor:2',
          'doutora:2',
          'pressão arterial:3',
          'frequência cardíaca:3',
          'hemograma:3',
          'diagnóstico:2',
          'medicamento:2',
          'receita:2',
          'exame:2',
          'sintoma:2',
          'consulta:2',
          'anamnese:3',
          'prontuário:2',
        ],

        // Diarização
        diarize: true,
      });

      const activeConn: ActiveConnection = {
        client: connection,
        sessionId: options.sessionId,
        participantId: options.participantId,
        role: options.role,
        keepAliveInterval: null,
        utteranceBuffer: '',
        lastTranscriptTime: Date.now(),
        isConnected: false,
      };

      this.setupConnectionHandlers(key, activeConn);
      this.connections.set(key, activeConn);

      console.log(`🎙️ [DEEPGRAM] Conexão criada: ${key} (${options.role})`);
      return key;

    } catch (error) {
      console.error(`❌ [DEEPGRAM] Erro ao criar conexão ${key}:`, error);
      logError(
        'Erro ao criar conexão Deepgram',
        'error',
        options.sessionId,
        { participantId: options.participantId, error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Configura os handlers de eventos da conexão Deepgram
   */
  private setupConnectionHandlers(key: string, conn: ActiveConnection): void {
    const { client } = conn;

    // Conexão aberta
    client.on(LiveTranscriptionEvents.Open, () => {
      console.log(`✅ [DEEPGRAM] Conexão aberta: ${key}`);
      conn.isConnected = true;

      // Flush de áudio pendente que chegou antes da conexão abrir
      const pending = this.pendingAudio.get(key);
      if (pending && pending.length > 0) {
        console.log(`📤 [DEEPGRAM] Enviando ${pending.length} chunks pendentes para ${key}`);
        for (const chunk of pending) {
          try {
            const ab = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
            client.send(ab);
          } catch (e) {
            // Ignore errors on flush
          }
        }
        this.pendingAudio.delete(key);
      }

      // KeepAlive a cada 8 segundos para manter a conexão
      conn.keepAliveInterval = setInterval(() => {
        if (conn.isConnected) {
          try {
            client.keepAlive();
          } catch (e) {
            // Silently ignore keepalive errors
          }
        }
      }, 8000);
    });

    // Resultado de transcrição
    client.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript) return;

      const text = transcript.transcript?.trim();
      if (!text) return;

      const isFinal = data.is_final === true;
      const speechFinal = data.speech_final === true;

      const result: DeepgramTranscriptionResult = {
        text,
        confidence: transcript.confidence || 0,
        isFinal,
        speechFinal,
        words: transcript.words || [],
        start: data.start || 0,
        duration: data.duration || 0,
        channel: data.channel_index?.[0] || 0,
      };

      conn.lastTranscriptTime = Date.now();

      if (isFinal) {
        // Acumular no buffer de utterance
        conn.utteranceBuffer += (conn.utteranceBuffer ? ' ' : '') + text;
      }

      // Emitir resultado parcial ou final
      this.emit('transcription', {
        connectionKey: key,
        sessionId: conn.sessionId,
        participantId: conn.participantId,
        role: conn.role,
        result,
      });

      // Log apenas de finais (reduzir verbosidade)
      if (isFinal && text.length > 2) {
        console.log(`📝 [DEEPGRAM] [${conn.role}]: "${text}" (${(transcript.confidence * 100).toFixed(0)}%)`);
      }
    });

    // Fim de utterance (pausa na fala)
    client.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (conn.utteranceBuffer.trim()) {
        const fullUtterance = conn.utteranceBuffer.trim();
        console.log(`📝 [DEEPGRAM] [${conn.role}] Utterance completa: "${fullUtterance}"`);

        this.emit('utteranceEnd', {
          connectionKey: key,
          sessionId: conn.sessionId,
          participantId: conn.participantId,
          role: conn.role,
          text: fullUtterance,
        });

        conn.utteranceBuffer = '';
      }
    });

    // Início de fala detectado pelo VAD
    client.on(LiveTranscriptionEvents.SpeechStarted, () => {
      this.emit('speechStarted', {
        connectionKey: key,
        sessionId: conn.sessionId,
        participantId: conn.participantId,
        role: conn.role,
      });
    });

    // Metadados da sessão (silencioso)
    client.on(LiveTranscriptionEvents.Metadata, (_data: any) => {
      // Silencioso - metadata é informacional apenas
    });

    // Erro
    client.on(LiveTranscriptionEvents.Error, (error: any) => {
      console.error(`❌ [DEEPGRAM] Erro na conexão ${key}:`, error);
      logError(
        'Erro na conexão Deepgram',
        'error',
        conn.sessionId,
        { participantId: conn.participantId, error: JSON.stringify(error) }
      );

      this.emit('error', {
        connectionKey: key,
        sessionId: conn.sessionId,
        participantId: conn.participantId,
        error,
      });
    });

    // Conexão fechada
    client.on(LiveTranscriptionEvents.Close, () => {
      console.log(`🔌 [DEEPGRAM] Conexão fechada: ${key}`);
      conn.isConnected = false;

      if (conn.keepAliveInterval) {
        clearInterval(conn.keepAliveInterval);
        conn.keepAliveInterval = null;
      }

      // Flush do buffer restante
      if (conn.utteranceBuffer.trim()) {
        this.emit('utteranceEnd', {
          connectionKey: key,
          sessionId: conn.sessionId,
          participantId: conn.participantId,
          role: conn.role,
          text: conn.utteranceBuffer.trim(),
        });
        conn.utteranceBuffer = '';
      }

      this.emit('connectionClosed', {
        connectionKey: key,
        sessionId: conn.sessionId,
        participantId: conn.participantId,
      });
    });
  }

  /**
   * Envia dados de áudio para transcrição
   * Aceita Buffer PCM16 (linear16) ou qualquer formato configurado
   */
  sendAudio(sessionId: string, participantId: string, audioData: Buffer): boolean {
    const key = this.getConnectionKey(sessionId, participantId);
    const conn = this.connections.get(key);

    if (!conn) {
      return false; // Conexão não existe
    }

    if (!conn.isConnected) {
      // Conexão ainda abrindo - bufferizar áudio
      if (!this.pendingAudio.has(key)) {
        this.pendingAudio.set(key, []);
      }
      const pending = this.pendingAudio.get(key)!;
      // Limitar buffer pendente a ~5s de áudio (160 chunks de ~32ms cada a 16kHz)
      if (pending.length < 160) {
        pending.push(audioData);
      }
      return true; // Retorna true - está bufferizado
    }

    try {
      const ab = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength) as ArrayBuffer;
      conn.client.send(ab);
      return true;
    } catch (error) {
      console.error(`❌ [DEEPGRAM] Erro ao enviar áudio ${key}:`, error);
      return false;
    }
  }

  /**
   * Envia dados de áudio usando a chave de conexão diretamente
   */
  sendAudioByKey(key: string, audioData: Buffer): boolean {
    const conn = this.connections.get(key);

    if (!conn || !conn.isConnected) {
      return false;
    }

    try {
      const ab = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength) as ArrayBuffer;
      conn.client.send(ab);
      return true;
    } catch (error) {
      console.error(`❌ [DEEPGRAM] Erro ao enviar áudio ${key}:`, error);
      return false;
    }
  }

  /**
   * Finaliza (flush) a transcrição pendente sem fechar a conexão
   */
  finalize(sessionId: string, participantId: string): void {
    const key = this.getConnectionKey(sessionId, participantId);
    const conn = this.connections.get(key);

    if (conn?.isConnected) {
      try {
        conn.client.finalize();
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Fecha uma conexão específica
   */
  async closeConnection(sessionId: string, participantId: string): Promise<void> {
    const key = this.getConnectionKey(sessionId, participantId);
    const conn = this.connections.get(key);

    if (!conn) return;

    try {
      if (conn.keepAliveInterval) {
        clearInterval(conn.keepAliveInterval);
        conn.keepAliveInterval = null;
      }

      if (conn.isConnected) {
        conn.client.requestClose();
      }
    } catch (error) {
      console.error(`❌ [DEEPGRAM] Erro ao fechar conexão ${key}:`, error);
    } finally {
      this.connections.delete(key);
    }
  }

  /**
   * Fecha todas as conexões de uma sessão
   */
  async closeSession(sessionId: string): Promise<void> {
    const keysToClose: string[] = [];

    for (const [key, conn] of this.connections) {
      if (conn.sessionId === sessionId) {
        keysToClose.push(key);
      }
    }

    for (const key of keysToClose) {
      const conn = this.connections.get(key);
      if (conn) {
        await this.closeConnection(conn.sessionId, conn.participantId);
      }
    }

    console.log(`🔌 [DEEPGRAM] Sessão ${sessionId} encerrada (${keysToClose.length} conexões)`);
  }

  /**
   * Retorna estatísticas das conexões ativas
   */
  getStats(): {
    activeConnections: number;
    connections: Array<{
      key: string;
      sessionId: string;
      participantId: string;
      role: string;
      isConnected: boolean;
      lastTranscriptTime: number;
    }>;
  } {
    const connections: any[] = [];
    for (const [key, conn] of this.connections) {
      connections.push({
        key,
        sessionId: conn.sessionId,
        participantId: conn.participantId,
        role: conn.role,
        isConnected: conn.isConnected,
        lastTranscriptTime: conn.lastTranscriptTime,
      });
    }

    return {
      activeConnections: this.connections.size,
      connections,
    };
  }

  /**
   * Verifica se uma conexão existe e está ativa
   */
  hasConnection(sessionId: string, participantId: string): boolean {
    const key = this.getConnectionKey(sessionId, participantId);
    const conn = this.connections.get(key);
    return !!conn?.isConnected;
  }
}

// Singleton
export const deepgramService = new DeepgramService();
