#!/usr/bin/env node

// Carregar variáveis de ambiente
import * as dotenv from 'dotenv';
dotenv.config();

// Importar o servidor configurado
import './server';

console.log('🎯 Gateway MedCall AI iniciado');
console.log('📅 Timestamp:', new Date().toISOString());
console.log('🌐 Environment:', process.env.NODE_ENV || 'development');

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});