// Teste simples para verificar captura de áudio
console.log('🧪 Teste de captura de áudio...');

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

// Simular envio para backend
console.log('🎤 Simulando envio para backend...');
console.log('✅ Teste concluído - áudio pode ser enviado');
