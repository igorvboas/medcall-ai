import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { TranscriptionWebSocketHandler } from './websocket/transcriptionHandler';
import transcriptionRoutes from './routes/transcription';

const app = express();
const httpServer = createServer(app);

// Configurar Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    //origin: process.env.FRONTEND_URL || "http://localhost:3000",
    origin: '*',
    methods: ["GET", "POST"]
  }
});


// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rotas da API
app.use('/api/transcription', transcriptionRoutes);

// Suas outras rotas existentes
// app.use('/api/sessions', sessionRoutes);
// app.use('/api/consultations', consultationRoutes);
// etc...

// Configurar handler de transcrição WebSocket
const transcriptionHandler = new TranscriptionWebSocketHandler(io);

// Configurar namespace para transcrição
const transcriptionNamespace = io.of('/transcription');
transcriptionNamespace.on('connection', (socket) => {
  transcriptionHandler.handleConnection(socket);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      transcription: 'running',
      websocket: 'running'
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Gateway server running on port ${PORT}`);
  console.log(`📝 Transcription service available at /api/transcription`);
  console.log(`🔌 WebSocket available at /transcription`);
});

export { app, io };