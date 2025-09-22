import { Server as SocketIOServer } from 'socket.io';
import { TranscriptionWebSocketHandler } from './transcriptionHandler';
import { createServer } from 'http';
import express from 'express';

const app = express();
const httpServer = createServer(app);

// Criar servidor Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ["https://medcall-ai-frontend-v2.vercel.app/"],
    methods: ["GET", "POST"]
  }
});

// Configurar namespace de transcrição  
const transcriptionNamespace = io.of('/transcription');
const transcriptionHandler = new TranscriptionWebSocketHandler(io);

transcriptionNamespace.on('connection', (socket) => {
  transcriptionHandler.handleConnection(socket);
});