import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { TranscriptionWebSocketHandler } from './websocket/transcriptionHandler';
import transcriptionRoutes from './routes/transcription';
import sessionsRoutes from './routes/sessions';

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

// Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log das variáveis de ambiente importantes
console.log('🔧 Configurações do servidor:');
console.log('- PORT:', process.env.PORT || 3001);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Configurada' : 'Não configurada');

// Rotas da API
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/sessions', sessionsRoutes);

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
      websocket: 'running',
      socketio: io ? 'initialized' : 'not initialized'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: process.env.PORT || 3001,
      frontend_url: process.env.FRONTEND_URL || 'not set'
    }
  });
});

// Log conexões Socket.IO principal
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectou ao Socket.IO principal:', socket.id);
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectou do Socket.IO principal:', socket.id, 'Razão:', reason);
  });

  socket.on('error', (error) => {
    console.error('❌ Erro no Socket.IO principal:', error);
  });
});

// Configurar handler de transcrição WebSocket
console.log('📝 Inicializando handler de transcrição...');
const transcriptionHandler = new TranscriptionWebSocketHandler(io);

// Configurar namespace para transcrição
const transcriptionNamespace = io.of('/transcription');

transcriptionNamespace.on('connection', (socket) => {
  console.log('📝 Cliente conectou ao namespace de transcrição:', socket.id);
  console.log('📝 Total de clientes no namespace:', transcriptionNamespace.sockets.size);
  
  // Enviar confirmação de conexão
  socket.emit('connection-confirmed', {
    message: 'Connected to transcription service',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // Configurar handlers
  transcriptionHandler.handleConnection(socket);
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectou do namespace de transcrição:', socket.id, 'Razão:', reason);
    console.log('📝 Total de clientes restantes:', transcriptionNamespace.sockets.size);
  });

  socket.on('error', (error) => {
    console.error('❌ Erro no namespace de transcrição:', error);
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

httpServer.listen(PORT, () => {
  console.log('🚀 Gateway server running on port', PORT);
  console.log('📝 Transcription service available at /api/transcription');
  console.log('🔌 WebSocket available at /transcription');
  console.log('🌍 Health check available at /api/health');
  console.log('CORS configurado para:', allowedOrigins);
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM recebido, encerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT recebido, encerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');  
    process.exit(0);
  });
});

export { app, io };