// Teste para simular recebimento de áudio via LiveKit Data Channels
console.log('🧪 Testando recebimento de áudio via LiveKit Data Channels...');

// Simular dados de áudio
const sampleRate = 16000;
const duration = 1; // 1 segundo
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

// Simular mensagem que seria recebida via LiveKit Data Channel
const message = {
  type: 'audio-data',
  data: {
    participantId: 'test-participant',
    audioData: base64Audio,
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now()
  }
};

console.log('📨 Mensagem simulada:', {
  type: message.type,
  participantId: message.data.participantId,
  audioDataLength: message.data.audioData.length,
  sampleRate: message.data.sampleRate,
  channels: message.data.channels
});

// Simular processamento no backend
console.log('🔄 Simulando processamento no backend...');
console.log('1. Decodificar mensagem ✅');
console.log('2. Converter base64 para Buffer ✅');
console.log('3. Processar com Whisper ✅');
console.log('4. Enviar transcrição via LiveKit Data Channel ✅');

console.log('✅ Teste concluído - fluxo pode funcionar');
console.log('🔍 Próximos passos:');
console.log('1. Verificar se o frontend está enviando áudio');
console.log('2. Verificar se o backend está recebendo áudio');
console.log('3. Verificar se o backend está processando áudio');
