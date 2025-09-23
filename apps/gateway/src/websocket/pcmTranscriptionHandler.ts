import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { transcriptionService } from '../services/transcriptionService';
import { livekitTranscriptionService } from '../services/livekitTranscriptionService';

interface PCMConnectionInfo {
  sessionId: string;
  participantId: string;
  ws: WebSocket;
  lastActivity: number;
}

export class PCMTranscriptionHandler {
  private wss: WebSocketServer;
  private connections: Map<string, PCMConnectionInfo> = new Map();
  private cleanupInterval!: NodeJS.Timeout;

  constructor() {
    this.wss = new WebSocketServer({ 
      noServer: true,
      perMessageDeflate: false // Desabilitar compressão para melhor performance com dados binários
    });

    this.setupEventHandlers();
    this.startCleanupTimer();
  }

  /**
   * Configurar handlers de eventos
   */
  private setupEventHandlers(): void {
    // Escutar eventos do serviço de transcrição
    transcriptionService.on('transcription', (data) => {
      this.handleTranscriptionResult(data);
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
  }

  /**
   * Handler de upgrade para WebSocket
   */
  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    
    if (url.pathname === '/ws/transcribe') {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    }
  }

  /**
   * Validar parâmetros de conexão
   */
  private validateConnectionParams(request: IncomingMessage): { sessionId: string; participantId: string } | null {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('session');
    const participantId = url.searchParams.get('participant');

    if (!sessionId || !participantId) {
      return null;
    }

    return { sessionId, participantId };
  }

  /**
   * Handler de nova conexão WebSocket
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const params = this.validateConnectionParams(request);
    
    if (!params) {
      console.error('[PCMTranscription] Invalid connection parameters');
      ws.close(1008, 'Invalid parameters: session and participant required');
      return;
    }

    const { sessionId, participantId } = params;
    const connectionId = `${sessionId}-${participantId}`;

    console.log(`[PCMTranscription] New connection: ${connectionId}`);

    // Registrar conexão
    this.connections.set(connectionId, {
      sessionId,
      participantId,
      ws,
      lastActivity: Date.now()
    });

    // Enviar confirmação de conexão
    this.sendMessage(ws, {
      type: 'connection_established',
      sessionId,
      participantId,
      timestamp: Date.now()
    });

    // Iniciar transcrição para a sessão
    this.startTranscriptionForSession(sessionId);

    // Handler de mensagens (dados PCM binários)
    ws.on('message', (data) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      this.handleAudioData(connectionId, buffer);
    });

    // Handler de fechamento
    ws.on('close', (code, reason) => {
      this.handleDisconnection(connectionId, code, reason);
    });

    // Handler de erro
    ws.on('error', (error) => {
      console.error(`[PCMTranscription] WebSocket error for ${connectionId}:`, error);
      this.handleDisconnection(connectionId, 1011, Buffer.from('Internal error'));
    });

    // Handler de pong (heartbeat)
    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivity = Date.now();
      }
    });
  }

  /**
   * Processar dados de áudio PCM recebidos
   */
  private async handleAudioData(connectionId: string, data: Buffer): Promise<void> {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      console.error(`[PCMTranscription] Connection not found: ${connectionId}`);
      return;
    }

    // Atualizar última atividade
    connection.lastActivity = Date.now();

    try {
      // Validar que é dados binários (PCM16)
      if (data.length < 2 || data.length % 2 !== 0) {
        console.warn(`[PCMTranscription] Invalid PCM data size: ${data.length} bytes`);
        return;
      }

      // Processar chunk de áudio via transcriptionService
      await transcriptionService.processAudioChunk({
        data: data,
        participantId: connection.participantId,
        sampleRate: 16000,
        channels: 1
      }, connection.sessionId);

      // Debug log ocasional (a cada ~100 chunks)
      if (Math.random() < 0.01) {
        console.log(`[PCMTranscription] Processed ${data.length} bytes PCM for ${connectionId}`);
      }

    } catch (error) {
      console.error(`[PCMTranscription] Error processing audio for ${connectionId}:`, error);
      
      this.sendMessage(connection.ws, {
        type: 'error',
        message: 'Failed to process audio data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Iniciar transcrição para uma sessão
   */
  private async startTranscriptionForSession(sessionId: string): Promise<void> {
    try {
      // Verificar se já está rodando para esta sessão
      const sessionConnections = Array.from(this.connections.values())
        .filter(conn => conn.sessionId === sessionId);

      if (sessionConnections.length === 1) {
        // Primeira conexão da sessão - iniciar transcrição
        await transcriptionService.startTranscription(sessionId, sessionId);
        console.log(`[PCMTranscription] Started transcription for session: ${sessionId}`);
      }
    } catch (error) {
      console.error(`[PCMTranscription] Failed to start transcription for ${sessionId}:`, error);
    }
  }

  /**
   * Processar resultado de transcrição e enviar via LiveKit DataChannel
   */
  private async handleTranscriptionResult(data: any): Promise<void> {
    try {
      const { roomName, segment } = data;
      
      if (!roomName || !segment) {
        console.warn('[PCMTranscription] Invalid transcription data received');
        return;
      }

      // Publicar via LiveKit DataChannel
      await livekitTranscriptionService.publishTranscription(roomName, {
        type: 'transcription',
        data: {
          id: segment.id || `seg-${Date.now()}`,
          text: segment.text,
          participantId: segment.participantId,
          timestamp: segment.timestamp || Date.now(),
          final: segment.final || false,
          confidence: segment.confidence || 0.8
        }
      });

      console.log(`[PCMTranscription] Published transcription to LiveKit: ${roomName}`);

      // Opcional: também enviar de volta via WebSocket para debug/latência
      const sessionConnections = Array.from(this.connections.values())
        .filter(conn => conn.sessionId === roomName);

      sessionConnections.forEach(conn => {
        this.sendMessage(conn.ws, {
          type: 'transcription_result',
          data: segment
        });
      });

    } catch (error) {
      console.error('[PCMTranscription] Error handling transcription result:', error);
    }
  }

  /**
   * Handler de desconexão
   */
  private async handleDisconnection(connectionId: string, code: number, reason: Buffer): Promise<void> {
    console.log(`[PCMTranscription] Disconnection: ${connectionId}, code: ${code}, reason: ${reason.toString()}`);
    
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      // Verificar se era a última conexão da sessão
      const sessionConnections = Array.from(this.connections.values())
        .filter(conn => conn.sessionId === connection.sessionId && conn.participantId !== connection.participantId);

      // Remover conexão
      this.connections.delete(connectionId);

      // Se era a última conexão da sessão, parar transcrição
      if (sessionConnections.length === 0) {
        try {
          await transcriptionService.stopTranscription(connection.sessionId);
          console.log(`[PCMTranscription] Stopped transcription for session: ${connection.sessionId}`);
        } catch (error) {
          console.error(`[PCMTranscription] Error stopping transcription:`, error);
        }
      }
    }
  }

  /**
   * Enviar mensagem JSON via WebSocket
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[PCMTranscription] Error sending message:', error);
      }
    }
  }

  /**
   * Timer de limpeza para conexões inativas
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 segundos

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastActivity > timeout) {
          console.log(`[PCMTranscription] Cleaning up inactive connection: ${connectionId}`);
          connection.ws.close(1000, 'Inactive connection cleanup');
          this.connections.delete(connectionId);
        } else {
          // Enviar ping para manter conexão viva
          if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.ping();
          }
        }
      }
    }, 15000); // Verificar a cada 15 segundos
  }

  /**
   * Obter estatísticas das conexões
   */
  getStats(): any {
    const sessionStats = new Map<string, number>();
    
    for (const connection of this.connections.values()) {
      sessionStats.set(
        connection.sessionId, 
        (sessionStats.get(connection.sessionId) || 0) + 1
      );
    }

    return {
      totalConnections: this.connections.size,
      activeSessions: sessionStats.size,
      sessionDetails: Array.from(sessionStats.entries()).map(([sessionId, connections]) => ({
        sessionId,
        connections
      }))
    };
  }

  /**
   * Fechar todas as conexões e limpar recursos
   */
  destroy(): void {
    console.log('[PCMTranscription] Shutting down...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Fechar todas as conexões
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutdown');
    }

    this.connections.clear();
    this.wss.close();
  }
}
