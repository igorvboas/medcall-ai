/**
 * Rotas de teste para LiveKit
 * Endpoint: /api/test/livekit
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { generateLiveKitToken } from '../config/providers';
import { config } from '../config/index';
import { Room } from 'livekit-client';

const router = Router();

/**
 * Teste básico de geração de token
 * GET /api/test/livekit/token
 */
router.get('/token', asyncHandler(async (req: Request, res: Response) => {
  console.log('🧪 Testando geração de token LiveKit...');

  try {
    const testIdentity = 'test-user-' + Date.now();
    const testRoom = 'test-room-' + Date.now();
    
    const token = await generateLiveKitToken(testIdentity, testRoom, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'test', timestamp: Date.now() })
    });

    // Decodificar token para verificar
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);

    res.json({
      success: true,
      message: 'Token gerado com sucesso',
      data: {
        token: token.substring(0, 50) + '...', // Apenas início do token
        tokenLength: token.length,
        identity: payload.sub,
        room: payload.video?.room,
        issuedAt: new Date(payload.iat * 1000).toISOString(),
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        timeUntilExpiry: payload.exp - now,
        canPublish: payload.video?.roomJoin || false,
        canSubscribe: payload.video?.roomJoin || false,
        metadata: payload.metadata ? JSON.parse(payload.metadata) : null
      }
    });

    } catch (error) {
      console.error('❌ Erro na geração de token:', error);
      res.status(500).json({
        success: false,
        error: 'Falha na geração de token',
        details: error instanceof Error ? error.message : String(error)
      });
    }
}));

/**
 * Teste de conexão com LiveKit
 * POST /api/test/livekit/connection
 */
router.post('/connection', asyncHandler(async (req: Request, res: Response) => {
  console.log('🧪 Testando conexão com LiveKit...');

  const { token, serverUrl } = req.body;

  if (!token || !serverUrl) {
    return res.status(400).json({
      success: false,
      error: 'Token e serverUrl são obrigatórios'
    });
  }

  try {
    const room = new Room();
    
    // Configurar timeout
    const timeout = setTimeout(() => {
      room.disconnect();
    }, 10000); // 10 segundos

    // Tentar conectar
    await room.connect(serverUrl, token);
    
    clearTimeout(timeout);

    // Obter informações da sala
    const roomInfo = {
      name: room.name,
      participants: room.remoteParticipants.size,
      localParticipant: room.localParticipant?.identity,
      connectionState: room.state
    };

    // Desconectar
    await room.disconnect();

    res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso',
      data: roomInfo
    });

    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      res.status(500).json({
        success: false,
        error: 'Falha na conexão com LiveKit',
        details: error instanceof Error ? error.message : String(error)
      });
    }
}));

/**
 * Teste completo de sessão (criação + token + conexão)
 * POST /api/test/livekit/session
 */
router.post('/session', asyncHandler(async (req: Request, res: Response) => {
  console.log('🧪 Testando sessão completa LiveKit...');

  try {
    // 1. Gerar token
    const testIdentity = 'test-doctor-' + Date.now();
    const testRoom = 'test-session-' + Date.now();
    
    const token = await generateLiveKitToken(testIdentity, testRoom, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'doctor', test: true })
    });

    console.log('✅ Token gerado:', token.substring(0, 50) + '...');

    // 2. Testar conexão
    const room = new Room();
    
    const timeout = setTimeout(() => {
      room.disconnect();
    }, 10000);

    await room.connect(config.LIVEKIT_URL, token);
    
    clearTimeout(timeout);

    const roomInfo = {
      name: room.name,
      participants: room.remoteParticipants.size,
      localParticipant: room.localParticipant?.identity,
      connectionState: room.state
    };

    await room.disconnect();

    // 3. Decodificar token para verificar
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);

    res.json({
      success: true,
      message: 'Sessão teste criada com sucesso',
      data: {
        session: {
          identity: testIdentity,
          room: testRoom,
          connectionEstablished: true
        },
        token: {
          length: token.length,
          identity: payload.sub,
          room: payload.video?.room,
          issuedAt: new Date(payload.iat * 1000).toISOString(),
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          timeUntilExpiry: payload.exp - now
        },
        room: roomInfo
      }
    });

    } catch (error) {
      console.error('❌ Erro no teste de sessão:', error);
      res.status(500).json({
        success: false,
        error: 'Falha no teste de sessão',
        details: error instanceof Error ? error.message : String(error)
      });
    }
}));

/**
 * Verificar configurações LiveKit
 * GET /api/test/livekit/config
 */
router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔍 Verificando configurações LiveKit...');

  const configInfo = {
    livekit: {
      url: config.LIVEKIT_URL,
      apiKey: config.LIVEKIT_API_KEY ? `${config.LIVEKIT_API_KEY.substring(0, 10)}...` : 'NÃO CONFIGURADO',
      apiSecret: config.LIVEKIT_API_SECRET ? `${config.LIVEKIT_API_SECRET.substring(0, 10)}...` : 'NÃO CONFIGURADO'
    },
    environment: {
      nodeEnv: config.NODE_ENV,
      port: config.PORT,
      frontendUrl: config.FRONTEND_URL
    },
    validation: {
      urlConfigured: !!config.LIVEKIT_URL,
      apiKeyConfigured: !!config.LIVEKIT_API_KEY,
      apiSecretConfigured: !!config.LIVEKIT_API_SECRET,
      allConfigured: !!(config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET)
    }
  };

  res.json({
    success: true,
    message: 'Configurações verificadas',
    data: configInfo
  });
}));

/**
 * Teste de saúde geral do LiveKit
 * GET /api/test/livekit/health
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  console.log('🏥 Verificando saúde do LiveKit...');

  const health = {
    timestamp: new Date().toISOString(),
    status: 'unknown' as string,
    checks: {
      config: false,
      tokenGeneration: false,
      connection: false
    },
    details: {} as Record<string, string>
  };

  try {
    // 1. Verificar configurações
    if (config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET) {
      health.checks.config = true;
      health.details.config = 'Configurações OK';
    } else {
      health.details.config = 'Configurações incompletas';
    }

    // 2. Testar geração de token
    if (health.checks.config) {
      try {
        const token = await generateLiveKitToken('health-check', 'health-room', {
          canPublish: false,
          canSubscribe: false,
          canPublishData: false
        });
        
        if (token && token.length > 0) {
          health.checks.tokenGeneration = true;
          health.details.tokenGeneration = 'Geração OK';
        }
        } catch (error) {
          health.details.tokenGeneration = `Erro: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    // 3. Testar conexão (se token OK)
    if (health.checks.tokenGeneration) {
      try {
        const room = new Room();
        
        const timeout = setTimeout(() => {
          room.disconnect();
        }, 5000);

        await room.connect(config.LIVEKIT_URL, await generateLiveKitToken('health-check', 'health-room'));
        
        clearTimeout(timeout);
        await room.disconnect();
        
        health.checks.connection = true;
        health.details.connection = 'Conexão OK';
        
        } catch (error) {
          health.details.connection = `Erro: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    // Determinar status geral
    const allChecksPass = Object.values(health.checks).every(check => check);
    health.status = allChecksPass ? 'healthy' : 'unhealthy';

    const statusCode = allChecksPass ? 200 : 503;
    
    res.status(statusCode).json({
      success: allChecksPass,
      message: `LiveKit está ${health.status}`,
      data: health
    });

  } catch (error) {
    health.status = 'error';
    health.details.error = error instanceof Error ? error.message : String(error);
    
    res.status(500).json({
      success: false,
      message: 'Erro na verificação de saúde',
      data: health
    });
  }
}));

export default router;
