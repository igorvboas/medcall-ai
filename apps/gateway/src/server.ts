// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import transcriptionRoutes from './routes/transcription';
import livekitTranscriptionRoutes from './routes/livekitTranscription';
import sessionsRoutes from './routes/sessions';
import roomsRoutes, { setSocketIO } from './routes/rooms';
import twilioRoutes from './routes/index';
import aiPricingRoutes from './routes/aiPricing';
import { PCMTranscriptionHandler } from './websocket/pcmTranscriptionHandler';
import { setupRoomsWebSocket } from './websocket/rooms';

const app = express();
const httpServer = createServer(app);

// Configurar Socket.IO com CORS corrigido
const allowedOrigins = [
  "http://localhost:3000",
  "https://medcall-ai-frontend-v2.vercel.app"
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Configurar handler de WebSocket PCM para transcrição
const pcmHandler = new PCMTranscriptionHandler();

// Configurar handlers de salas WebRTC
setupRoomsWebSocket(io);

// Passar referência do Socket.IO para as rotas REST de rooms (para notificações admin)
setSocketIO(io);

// Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));



// Rotas da API
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/livekit/transcription', livekitTranscriptionRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/ai-pricing', aiPricingRoutes);
app.use('/api', twilioRoutes);

// Endpoint para estatísticas de WebSocket PCM
app.get('/api/pcm-transcription/stats', (req, res) => {
  res.json(pcmHandler.getStats());
});

// Health check detalhado para WebSocket PCM
app.get('/api/pcm-transcription/health', (req, res) => {
  const stats = pcmHandler.getStats();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket: {
      server_running: true,
      active_connections: stats.totalConnections,
      active_sessions: stats.activeSessions,
    },
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    },
    environment: {
      node_env: process.env.NODE_ENV,
      livekit_url: process.env.LIVEKIT_URL ? 'configured' : 'missing',
      openai_key: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    }
  };
  
  res.json(health);
});

// Suas outras rotas existentes podem ser adicionadas aqui
// app.use('/api/sessions', sessionRoutes);
// app.use('/api/consultations', consultationRoutes);

// Health check expandido
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      transcription: 'running',
      livekit: 'native-integration',
      socketio: io ? 'initialized' : 'not initialized'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: process.env.PORT || 3001,
      frontend_url: process.env.FRONTEND_URL || 'not set'
    }
  });
});

// Middleware de tratamento de erros
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ Erro no servidor:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 3001;

// Configurar upgrade para WebSocket PCM com debug detalhado

httpServer.on('upgrade', (request, socket, head) => {
  /**
  console.log('🔄 [WS-UPGRADE] Request received:', {
    url: request.url,
    method: request.method,
    headers: {
      connection: request.headers.connection,
      upgrade: request.headers.upgrade,
      'sec-websocket-key': request.headers['sec-websocket-key'],
      'sec-websocket-version': request.headers['sec-websocket-version'],
      origin: request.headers.origin
    }
  });
  */
  try {
    pcmHandler.handleUpgrade(request, socket, head);
    // console.log('✅ [WS-UPGRADE] Handled by PCM handler');
  } catch (error) {
    console.error('❌ [WS-UPGRADE] Error in handler:', error);
    socket.destroy();
  }
});

httpServer.listen(PORT, () => {
  console.log('🚀 MedCall Gateway Server Started\n\n');
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM recebido, encerrando servidor...');
  pcmHandler.destroy();
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT recebido, encerrando servidor...');
  pcmHandler.destroy();
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');  
    process.exit(0);
  });
});

export { app, io };