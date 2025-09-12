import { Server as SocketIOServer, Socket } from 'socket.io';
import { isDevelopment } from '@/config';
import { setupPresentialAudioHandlers } from './audioHandler';

// Interfaces para eventos WebSocket
interface SessionJoinData {
  sessionId: string;
  userId: string;
  role: 'doctor' | 'patient';
}

interface AudioData {
  sessionId: string;
  chunk: Buffer;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

// Setup dos handlers WebSocket
export function setupWebSocketHandlers(io: SocketIOServer): void {
  const notifier = new SessionNotifier(io);
  
  io.on('connection', (socket: Socket) => {
    if (isDevelopment) {
      console.log(`WebSocket conectado: ${socket.id}`);
    }

    // Configurar handlers de áudio presencial
    setupPresentialAudioHandlers(socket, notifier);

    // Handler para participar de uma sessão
    socket.on('session:join', (data: SessionJoinData) => {
      const { sessionId, userId, role } = data;
      
      if (!sessionId || !userId || !role) {
        socket.emit('error', {
          code: 'INVALID_SESSION_DATA',
          message: 'Dados de sessão inválidos',
        });
        return;
      }

      // Entrar na sala da sessão
      socket.join(`session:${sessionId}`);
      
      // Notificar outros participantes
      socket.to(`session:${sessionId}`).emit('participant:joined', {
        userId,
        role,
        timestamp: new Date().toISOString(),
      });

      // Confirmar entrada na sessão
      socket.emit('session:joined', {
        sessionId,
        userId,
        role,
        timestamp: new Date().toISOString(),
      });

      if (isDevelopment) {
        console.log(`Usuario ${userId} (${role}) entrou na sessão ${sessionId}`);
      }
    });

    // Handler para sair de uma sessão
    socket.on('session:leave', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;
      
      if (sessionId) {
        socket.leave(`session:${sessionId}`);
        
        // Notificar outros participantes
        socket.to(`session:${sessionId}`).emit('participant:left', {
          userId,
          timestamp: new Date().toISOString(),
        });

        if (isDevelopment) {
          console.log(`Usuario ${userId} saiu da sessão ${sessionId}`);
        }
      }
    });

    // Handler para receber dados de áudio (preparação para futura implementação)
    socket.on('audio:data', (data: AudioData) => {
      // TODO: Implementar processamento de áudio
      // Por enquanto, apenas log em desenvolvimento
      if (isDevelopment) {
        console.log(`Áudio recebido da sessão ${data.sessionId}: ${data.chunk.length} bytes`);
      }
      
      // Placeholder: repassar para processamento de ASR
      // Será implementado nas próximas fases
    });

    // Handler para status de transcrição
    socket.on('transcription:request', (data: { sessionId: string }) => {
      const { sessionId } = data;
      
      // TODO: Buscar transcrições existentes da sessão
      // Por enquanto, retorna vazio
      socket.emit('transcription:update', {
        sessionId,
        utterances: [],
        timestamp: new Date().toISOString(),
      });
    });

    // Handler para marcar sugestão como usada
    socket.on('suggestion:used', (data: { suggestionId: string; sessionId: string }) => {
      const { suggestionId, sessionId } = data;
      
      // TODO: Implementar marcação no banco
      // Por enquanto, apenas notifica outros participantes
      socket.to(`session:${sessionId}`).emit('suggestion:marked_used', {
        suggestionId,
        timestamp: new Date().toISOString(),
      });

      if (isDevelopment) {
        console.log(`Sugestão ${suggestionId} marcada como usada na sessão ${sessionId}`);
      }
    });

    // Handler para erros
    socket.on('error', (error) => {
      console.error(`WebSocket Error [${socket.id}]:`, error);
    });

    // Handler para desconexão
    socket.on('disconnect', (reason) => {
      if (isDevelopment) {
        console.log(`WebSocket desconectado: ${socket.id} - ${reason}`);
      }

      // TODO: Cleanup de sessões ativas
      // Remover usuário de todas as salas que estava participando
    });

    // Handler para ping/pong (manter conexão viva)
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
      });
    });
  });

  // Configurar middleware de autenticação para WebSocket (futuro)
  io.use((socket, next) => {
    // TODO: Implementar autenticação de WebSocket
    // Por enquanto, permitir todas as conexões
    next();
  });

  // Log de status do WebSocket
  if (isDevelopment) {
    io.engine.on('connection_error', (err) => {
      console.log('WebSocket connection error:', err.req, err.code, err.message, err.context);
    });
  }
}

// Utilitários para emitir eventos para sessões específicas
export class SessionNotifier {
  constructor(private io: SocketIOServer) {}

  // Notificar nova transcrição para uma sessão
  emitTranscriptionUpdate(sessionId: string, utterance: any) {
    this.io.to(`session:${sessionId}`).emit('transcription:update', {
      sessionId,
      utterance,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar nova sugestão de IA para uma sessão
  emitAISuggestion(sessionId: string, suggestion: any) {
    this.io.to(`session:${sessionId}`).emit('ai:suggestion', {
      sessionId,
      suggestion,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar status de processamento
  emitProcessingStatus(sessionId: string, status: 'processing' | 'completed' | 'error', message?: string) {
    this.io.to(`session:${sessionId}`).emit('processing:status', {
      sessionId,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar erro específico de sessão
  emitSessionError(sessionId: string, error: { code: string; message: string }) {
    this.io.to(`session:${sessionId}`).emit('session:error', {
      sessionId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar atividade de voz
  emitVoiceActivity(sessionId: string, channel: string, isActive: boolean) {
    this.io.to(`session:${sessionId}`).emit('presential:voice_activity', {
      sessionId,
      channel,
      isActive,
      timestamp: new Date().toISOString()
    });
  }
}