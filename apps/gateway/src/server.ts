import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config, corsOrigins, rateLimitConfig, isDevelopment } from './config';
import { testDatabaseConnection } from './config/database';
import { validateAllProviders } from './config/providers';
import { initializeRedis } from './config/redis';

// Import routes
import healthRoutes from './routes/health';
import sessionRoutes from './routes/sessions';
import debugRoutes from './routes/debug';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { corsMiddleware } from './middleware/cors';

// Import WebSocket handlers
import { setupWebSocketHandlers } from './websocket';

class GatewayServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSockets();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: isDevelopment ? false : undefined,
      crossOriginEmbedderPolicy: false, // Necessário para WebRTC
    }));

    // Compression
    this.app.use(compression());

    // CORS
    this.app.use(corsMiddleware);

    // Rate limiting
    if (!isDevelopment) {
      const limiter = rateLimit(rateLimitConfig);
      this.app.use('/api/', limiter);
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging em desenvolvimento
    if (isDevelopment) {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
      });
    }

    // Health check simples (sem autenticação)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.NODE_ENV,
      });
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/sessions', sessionRoutes);
    
    // Debug routes (apenas em desenvolvimento)
    if (isDevelopment) {
      this.app.use('/debug', debugRoutes);
    }

    // Catch-all para rotas não encontradas
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.originalUrl,
        method: req.method,
      });
    });
  }

  private initializeWebSockets(): void {
    // Configurar handlers de WebSocket
    setupWebSocketHandlers(this.io);

    // Log de conexões em desenvolvimento
    if (isDevelopment) {
      this.io.on('connection', (socket) => {
        console.log(`WebSocket conectado: ${socket.id}`);
        
        socket.on('disconnect', (reason) => {
          console.log(`WebSocket desconectado: ${socket.id} - ${reason}`);
        });
      });
    }
  }

  private initializeErrorHandling(): void {
    // Error handler deve ser o último middleware
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      console.log('🚀 Iniciando Gateway Server...\n');

      // Validar configurações
      console.log('📋 Validando configurações...');
      const providersValid = await this.validateConnections();
      
      if (!providersValid) {
        console.log('⚠️  Alguns provedores falharam, mas continuando...');
      }

      // Inicializar Redis (opcional)
      console.log('\n🔴 Inicializando Redis...');
      initializeRedis();

      // Iniciar servidor
      this.server.listen(config.PORT, () => {
        console.log('\n✅ Gateway Server iniciado com sucesso!');
        console.log(`   Porta: ${config.PORT}`);
        console.log(`   Ambiente: ${config.NODE_ENV}`);
        console.log(`   URL: http://localhost:${config.PORT}`);
        console.log(`   Health Check: http://localhost:${config.PORT}/health`);
        console.log(`   API Base: http://localhost:${config.PORT}/api`);
        
        if (isDevelopment) {
          console.log('\n🔧 Endpoints disponíveis:');
          console.log('   GET  /health              - Health check básico');
          console.log('   GET  /api/health/detailed - Health check detalhado');
          console.log('   POST /api/sessions        - Criar sessão');
          console.log('   WebSocket /               - Conexão para áudio/IA');
        }
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Falha ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  private async validateConnections(): Promise<boolean> {
    try {
      // Testar conexão com database
      const dbConnected = await testDatabaseConnection();
      
      // Testar provedores
      const providers = await validateAllProviders();
      
      // Retorna true se pelo menos database estiver funcionando
      return dbConnected;
    } catch (error) {
      console.error('❌ Erro na validação:', error);
      return false;
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📥 Recebido ${signal}, encerrando servidor...`);
      
      try {
        // Fechar servidor HTTP
        this.server.close(() => {
          console.log('✅ Servidor HTTP fechado');
        });

        // Fechar conexões WebSocket
        this.io.close(() => {
          console.log('✅ WebSocket fechado');
        });

        // Fechar Redis se estiver conectado
        const { closeRedis } = await import('./config/redis');
        await closeRedis();
        console.log('✅ Redis fechado');

        console.log('👋 Shutdown concluído');
        process.exit(0);
      } catch (error) {
        console.error('❌ Erro durante shutdown:', error);
        process.exit(1);
      }
    };

    // Escutar sinais de shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Tratar erros não capturados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection:', reason);
      console.error('At:', promise);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });
  }

  // Getter para usar em testes
  public getApp(): express.Application {
    return this.app;
  }

  public getIOServer(): SocketIOServer {
    return this.io;
  }
}

export default GatewayServer;