#!/usr/bin/env node

/**
 * Teste específico para verificar se o parâmetro model está sendo enviado corretamente
 */

const { asrService } = require('./dist/services/asrService');

console.log('🧪 Testando correção do parâmetro model...\n');

// Verificar configuração
const status = asrService.getStatus();
console.log('📊 Configuração do modelo:', status.config.model);

if (!status.enabled) {
  console.log('⚠️ ASR Service não está habilitado. Configure OPENAI_API_KEY para testar.');
  process.exit(0);
}

// Criar um buffer WAV válido para teste
function createTestWavBuffer(durationMs = 1000) {
  const sampleRate = 44100;
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const buffer = Buffer.allocUnsafe(44 + samples * 2);
  
  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(1, 22);  // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  
  // Dados de áudio (onda senoidal simples)
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(i * 0.01) * 0.1;
    const int16Sample = Math.round(sample * 32767);
    buffer.writeInt16LE(int16Sample, 44 + i * 2);
  }
  
  return buffer;
}

console.log('📋 Teste: Enviar áudio com parâmetro model corrigido...');

try {
  const testWavBuffer = createTestWavBuffer(2000); // 2 segundos
  
  const processedChunk = {
    sessionId: 'test-model-fix-session',
    channel: 'doctor',
    audioBuffer: testWavBuffer,
    timestamp: Date.now(),
    sampleRate: 44100,
    duration: 2000,
    hasVoiceActivity: true,
    averageVolume: 0.1
  };
  
  console.log(`✅ ProcessedAudioChunk criado: ${testWavBuffer.length} bytes`);
  console.log('🚀 Enviando para ASR Service...');
  
  // Processar de forma assíncrona
  asrService.processAudio(processedChunk)
    .then((result) => {
      if (result) {
        console.log('🎉 SUCESSO! ASR Service processou com sucesso!');
        console.log(`📝 Transcrição: "${result.text}"`);
        console.log(`🎯 Confiança: ${Math.round(result.confidence * 100)}%`);
        console.log('\n✅ Problema do parâmetro model RESOLVIDO!');
      } else {
        console.log('ℹ️ ASR Service não retornou transcrição');
      }
    })
    .catch((error) => {
      console.error('❌ Erro no ASR Service:', error.message);
      
      // Verificar tipo de erro
      if (error.message.includes('you must provide a model parameter')) {
        console.log('🔧 AINDA HÁ PROBLEMA: Parâmetro model não está sendo enviado');
      } else if (error.message.includes('multipart form')) {
        console.log('🔧 Problema de FormData ainda existe');
      } else if (error.message.includes('Invalid file format')) {
        console.log('ℹ️ Erro esperado - áudio sintético pode não ser reconhecido');
      } else {
        console.log('🔍 Outro tipo de erro:', error.message);
      }
    });
    
} catch (error) {
  console.error('❌ Erro ao processar:', error.message);
}

console.log('\n⏳ Aguardando resultado...');

// Aguardar resultado
setTimeout(() => {
  console.log('\n🏁 Teste finalizado.');
}, 10000);
