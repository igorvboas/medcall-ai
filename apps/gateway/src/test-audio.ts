// Script para testar o processamento de áudio localmente
import { AudioProcessor } from './services/audioProcessor';
import { asrService } from './services/asrService';

// Criar instâncias
const audioProcessor = new AudioProcessor();

// Simular áudio de teste
const sampleRate = 16000;
const duration = 2000; // 2 segundos
const frequency = 440; // Nota A4
const samples = Math.floor(sampleRate * duration / 1000);

// Criar áudio senoidal (simula voz)
const audioData = new Float32Array(samples);
for (let i = 0; i < samples; i++) {
  audioData[i] = 0.3 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
}

console.log('🧪 TESTE DE PROCESSAMENTO DE ÁUDIO');
console.log('=====================================');
console.log(`Samples: ${samples}`);
console.log(`Sample Rate: ${sampleRate} Hz`);
console.log(`Duration: ${duration} ms`);
console.log(`Frequency: ${frequency} Hz`);

// Testar detecção de voz
const hasVoiceActivity = audioProcessor['detectVoiceActivity'](audioData);
console.log(`\n🔍 DETECÇÃO DE VOZ:`);
console.log(`Has Voice Activity: ${hasVoiceActivity}`);

// Calcular RMS manualmente
let sum = 0;
for (let i = 0; i < audioData.length; i++) {
  sum += audioData[i] * audioData[i];
}
const rms = Math.sqrt(sum / audioData.length);
console.log(`RMS: ${rms.toFixed(6)}`);

// Testar conversão para WAV
const audioBuffer = audioProcessor['float32ToWavBuffer'](audioData, sampleRate);
console.log(`\n🔍 CONVERSÃO WAV:`);
console.log(`Buffer size: ${audioBuffer.length} bytes`);

// Verificar header WAV
console.log(`\n🔍 HEADER WAV:`);
console.log(`RIFF: ${audioBuffer.toString('ascii', 0, 4)}`);
console.log(`WAVE: ${audioBuffer.toString('ascii', 8, 12)}`);
console.log(`fmt : ${audioBuffer.toString('ascii', 12, 16)}`);
console.log(`data: ${audioBuffer.toString('ascii', 36, 40)}`);

// Testar com Whisper (se disponível)
if (process.env.OPENAI_API_KEY) {
  console.log(`\n🧪 TESTE COM WHISPER:`);
  
  // Criar chunk de teste
  const testChunk = {
    sessionId: 'test-session',
    channel: 'patient' as const,
    audioBuffer,
    timestamp: Date.now(),
    sampleRate,
    duration,
    hasVoiceActivity: true,
    averageVolume: rms
  };

  // Testar transcrição
  asrService.processAudio(testChunk).then(result => {
    if (result) {
      console.log(`✅ Transcrição: "${result.text}"`);
    } else {
      console.log(`❌ Nenhuma transcrição retornada`);
    }
  }).catch(error => {
    console.log(`❌ Erro na transcrição: ${error.message}`);
  });
} else {
  console.log(`\n⚠️ OPENAI_API_KEY não configurada - pulando teste do Whisper`);
}

console.log(`\n✅ Teste concluído!`);
