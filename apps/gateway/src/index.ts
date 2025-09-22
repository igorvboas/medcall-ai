#!/usr/bin/env node

import GatewayServer from './server_old';

// Inicializar e iniciar o servidor
async function bootstrap() {
  const server = new GatewayServer();
  await server.start();
}

// Executar o bootstrap
bootstrap().catch((error) => {
  console.error('❌ Falha crítica no bootstrap:', error);
  process.exit(1);
});