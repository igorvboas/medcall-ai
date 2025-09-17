import cors from 'cors';
import { corsOrigins, isDevelopment } from '../config';

// Configuração específica de CORS para WebRTC e áudio
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin && isDevelopment) {
      return callback(null, true);
    }

    // Verificar se origin está na lista permitida
    if (origin && corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Em desenvolvimento, ser mais flexível
    if (isDevelopment) {
      return callback(null, true);
    }

    // Em produção, bloquear origins não autorizadas
    callback(new Error('Bloqueado pelo CORS: Origin não permitida'));
  },
  
  credentials: true,
  
  // Headers necessários para WebRTC e áudio
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Session-ID',
    'X-Audio-Format',
    'X-Sample-Rate',
  ],
  
  // Métodos permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Headers expostos para o cliente
  exposedHeaders: [
    'X-Total-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
  ],

  // Preflight cache (24h)
  maxAge: 86400,
});