#!/usr/bin/env node

// Carregar variáveis de ambiente
import * as dotenv from 'dotenv';
dotenv.config();

// Importar o servidor configurado
import './server';

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});