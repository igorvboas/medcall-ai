#!/usr/bin/env node

/**
 * Teste para verificar se a transcrição LiveKit está funcionando
 * Execute com: node test-livekit-transcription.js
 */

const { io } = require('socket.io-client');

// Configurações de teste
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const ROOM_NAME = 'test-room-' + Date.now();
const CONSULTATION_ID = 'test-consultation-' + Date.now();
const PARTICIPANT_ID = 'test-participant-' + Date.now();

console.log('🧪 Iniciando teste de transcrição LiveKit...');
console.log('📋 Configurações:', {
  GATEWAY_URL,
  ROOM_NAME,
  CONSULTATION_ID,
  PARTICIPANT_ID
});

// Conectar ao WebSocket
const socket = io(GATEWAY_URL, {
  transports: ['websocket'],
  autoConnect: true
});

socket.on('connect', () => {
  console.log('✅ Conectado ao WebSocket');
  
  // Teste 1: Iniciar transcrição
  console.log('🎤 Teste 1: Iniciando transcrição...');
  socket.emit('online:start-transcription', {
    roomName: ROOM_NAME,
    consultationId: CONSULTATION_ID,
    participantId: PARTICIPANT_ID,
    participantName: 'Test Participant'
  });
});

socket.on('online:transcription-started', (data) => {
  console.log('✅ Transcrição iniciada:', data);
  
  // Teste 2: Obter estatísticas
  console.log('📊 Teste 2: Obtendo estatísticas...');
  socket.emit('online:transcription-stats', {
    roomName: ROOM_NAME
  });
});

socket.on('online:transcription-stats-response', (data) => {
  console.log('📊 Estatísticas recebidas:', data);
  
  // Teste 3: Parar transcrição após 5 segundos
  setTimeout(() => {
    console.log('🛑 Teste 3: Parando transcrição...');
    socket.emit('online:stop-transcription', {
      roomName: ROOM_NAME,
      consultationId: CONSULTATION_ID
    });
  }, 5000);
});

socket.on('online:transcription-stopped', (data) => {
  console.log('✅ Transcrição parada:', data);
  
  // Teste concluído
  console.log('🎉 Todos os testes concluídos com sucesso!');
  process.exit(0);
});

socket.on('error', (data) => {
  console.error('❌ Erro recebido:', data);
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado do WebSocket');
});

// Timeout de segurança
setTimeout(() => {
  console.error('⏰ Timeout: Teste não concluído em 30 segundos');
  process.exit(1);
}, 30000);

console.log('⏳ Aguardando conexão...');
