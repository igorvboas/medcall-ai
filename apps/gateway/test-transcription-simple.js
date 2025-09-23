#!/usr/bin/env node

/**
 * Teste simples para verificar se a transcrição está funcionando
 * Execute com: node test-transcription-simple.js
 */

const { io } = require('socket.io-client');

// Configurações de teste
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const ROOM_NAME = 'test-room-' + Date.now();
const CONSULTATION_ID = 'test-consultation-' + Date.now();
const PARTICIPANT_ID = 'test-participant-' + Date.now();

console.log('🧪 Teste simples de transcrição LiveKit...');
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
  
  // Teste 2: Simular áudio após 3 segundos
  setTimeout(() => {
    console.log('🎤 Teste 2: Enviando áudio simulado...');
    const mockAudio = Buffer.from('mock audio data for testing').toString('base64');
    
    socket.emit('online:audio-data', {
      roomName: ROOM_NAME,
      participantId: PARTICIPANT_ID,
      audioData: mockAudio,
      sampleRate: 16000,
      channels: 1
    });
  }, 3000);
});

socket.on('online:transcription-stats-response', (data) => {
  console.log('📊 Estatísticas recebidas:', data);
});

socket.on('error', (data) => {
  console.error('❌ Erro recebido:', data);
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado do WebSocket');
});

// Timeout de segurança
setTimeout(() => {
  console.log('⏰ Teste concluído (timeout de 30 segundos)');
  process.exit(0);
}, 30000);

console.log('⏳ Aguardando conexão...');
