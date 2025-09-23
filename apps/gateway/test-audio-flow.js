const io = require('socket.io-client');

console.log('🧪 Testando fluxo de áudio completo...');

const gatewayUrl = 'http://localhost:3001';
const socketUrl = gatewayUrl.replace('http', 'ws');

const socket = io(socketUrl, {
  transports: ['websocket'],
  autoConnect: true
});

socket.on('connect', () => {
  console.log('✅ Conectado ao gateway');
  
  // Simular início de transcrição
  const roomName = 'test-room-' + Date.now();
  const consultationId = 'test-consultation-' + Date.now();
  const participantId = 'test-participant';
  
  console.log(`🎤 Iniciando transcrição para sala: ${roomName}`);
  
  socket.emit('online:start-transcription', {
    roomName,
    consultationId,
    participantId,
    participantName: participantId
  });
});

socket.on('online:transcription-started', (data) => {
  console.log('✅ Transcrição iniciada:', data);
  
  // Simular envio de áudio
  setTimeout(() => {
    console.log('🎤 Enviando áudio simulado...');
    
    // Criar áudio simulado (sine wave)
    const sampleRate = 16000;
    const duration = 1; // 1 segundo
    const frequency = 440; // A4
    const samples = sampleRate * duration;
    const audioData = new Int16Array(samples);
    
    for (let i = 0; i < samples; i++) {
      audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000;
    }
    
    // Converter para base64
    const base64Audio = Buffer.from(audioData.buffer).toString('base64');
    
    socket.emit('online:audio-data', {
      roomName: data.roomName,
      participantId: 'test-participant',
      audioData: base64Audio,
      sampleRate: 16000,
      channels: 1
    });
    
    console.log('✅ Áudio enviado');
    
  }, 2000);
});

socket.on('online:transcription-stopped', (data) => {
  console.log('🛑 Transcrição parada:', data);
});

socket.on('error', (data) => {
  console.error('❌ Erro:', data);
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado');
});

// Timeout para parar o teste
setTimeout(() => {
  console.log('⏰ Teste finalizado');
  socket.disconnect();
  process.exit(0);
}, 10000);
