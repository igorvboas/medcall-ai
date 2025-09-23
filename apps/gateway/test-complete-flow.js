// Teste completo do fluxo de transcrição
console.log('🧪 Teste completo do fluxo de transcrição...');

// Simular dados de áudio real
const sampleRate = 16000;
const duration = 2; // 2 segundos
const frequency = 440; // A4
const samples = sampleRate * duration;
const audioData = new Int16Array(samples);

console.log(`📊 Gerando ${samples} samples de áudio...`);

for (let i = 0; i < samples; i++) {
  audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000;
}

console.log(`✅ Áudio gerado: ${audioData.length} samples`);

// Converter para base64
const base64Audio = Buffer.from(audioData.buffer).toString('base64');
console.log(`📦 Áudio em base64: ${base64Audio.length} caracteres`);

// Simular dados que seriam enviados para o backend
const audioPayload = {
  roomName: 'test-room-' + Date.now(),
  participantId: 'test-participant',
  audioData: base64Audio,
  sampleRate: 16000,
  channels: 1
};

console.log('🎤 Payload de áudio:', {
  roomName: audioPayload.roomName,
  participantId: audioPayload.participantId,
  audioDataLength: audioPayload.audioData.length,
  sampleRate: audioPayload.sampleRate,
  channels: audioPayload.channels
});

// Simular resposta do backend
const transcriptionResponse = {
  type: 'transcription',
  data: {
    id: 'transcription-' + Date.now(),
    text: 'Esta é uma transcrição de teste',
    participantId: 'test-participant',
    participantName: 'Test Participant',
    timestamp: new Date().toISOString(),
    final: true,
    confidence: 0.95
  }
};

console.log('📝 Resposta de transcrição simulada:', transcriptionResponse);

console.log('✅ Teste concluído - fluxo pode funcionar');
console.log('🔍 Próximos passos:');
console.log('1. Verificar se o gateway está rodando');
console.log('2. Testar com áudio real do microfone');
console.log('3. Verificar se LiveKit Data Channels está funcionando');
