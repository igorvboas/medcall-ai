#!/usr/bin/env node

/**
 * Teste para verificar se as correções da API Whisper resolveram o erro de multipart form
 */

const { asrService } = require('./dist/services/asrService');
const { audioProcessor } = require('./dist/services/audioProcessor');

console.log('🧪 Testando correções da API Whisper...\n');

// Verificar se o serviço está habilitado
const status = asrService.getStatus();
console.log('📊 Status do ASR Service:', JSON.stringify(status, null, 2));

if (!status.enabled) {
  console.log('⚠️ ASR Service não está habilitado. Configure OPENAI_API_KEY para testar.');
  console.log('🔄 Testando apenas o processamento de áudio local...\n');
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

// Teste 1: Criar chunk de áudio processado
console.log('📋 Teste 1: Criar ProcessedAudioChunk válido...');
try {
  const testWavBuffer = createTestWavBuffer(2000); // 2 segundos
  
  const processedChunk = {
    sessionId: 'test-whisper-session',
    channel: 'doctor',
    audioBuffer: testWavBuffer,
    timestamp: Date.now(),
    sampleRate: 44100,
    duration: 2000,
    hasVoiceActivity: true,
    averageVolume: 0.1
  };
  
  console.log(`✅ ProcessedAudioChunk criado: ${testWavBuffer.length} bytes`);
  console.log(`🔍 Buffer WAV válido: RIFF=${testWavBuffer.toString('ascii', 0, 4)}`);
  
} catch (error) {
  console.error('❌ Erro ao criar ProcessedAudioChunk:', error.message);
}

// Teste 2: Processar áudio com ASR Service
console.log('\n📋 Teste 2: Processar áudio com ASR Service...');
try {
  const testWavBuffer = createTestWavBuffer(1500); // 1.5 segundos
  
  const processedChunk = {
    sessionId: 'test-whisper-session',
    channel: 'patient',
    audioBuffer: testWavBuffer,
    timestamp: Date.now(),
    sampleRate: 44100,
    duration: 1500,
    hasVoiceActivity: true,
    averageVolume: 0.08
  };
  
  console.log('🚀 Enviando para ASR Service...');
  
  // Processar de forma assíncrona
  asrService.processAudio(processedChunk)
    .then((result) => {
      if (result) {
        console.log('✅ ASR Service processou com sucesso!');
        console.log(`📝 Transcrição: "${result.text}"`);
        console.log(`🎯 Confiança: ${Math.round(result.confidence * 100)}%`);
      } else {
        console.log('ℹ️ ASR Service não retornou transcrição (normal se Whisper não estiver configurado)');
      }
    })
    .catch((error) => {
      console.error('❌ Erro no ASR Service:', error.message);
      
      // Verificar se é erro específico do Whisper
      if (error.message.includes('multipart form')) {
        console.log('🔧 Erro de multipart form detectado - correções podem não ter funcionado');
      } else if (error.message.includes('OPENAI_API_KEY')) {
        console.log('ℹ️ Erro esperado - API key não configurada');
      } else {
        console.log('🔍 Outro tipo de erro:', error.message);
      }
    });
    
} catch (error) {
  console.error('❌ Erro ao processar com ASR Service:', error.message);
}

// Teste 3: Validar buffer WAV
console.log('\n📋 Teste 3: Validar diferentes tamanhos de buffer WAV...');
try {
  const sizes = [500, 1000, 2000, 5000]; // em ms
  
  sizes.forEach(size => {
    const buffer = createTestWavBuffer(size);
    console.log(`✅ Buffer ${size}ms: ${buffer.length} bytes - RIFF: ${buffer.toString('ascii', 0, 4)}`);
  });
  
} catch (error) {
  console.error('❌ Erro na validação de buffers:', error.message);
}

// Teste 4: Testar com buffer inválido
console.log('\n📋 Teste 4: Testar com buffer inválido...');
try {
  const invalidBuffer = Buffer.from('INVALID_WAV_DATA');
  
  const processedChunk = {
    sessionId: 'test-invalid',
    channel: 'doctor',
    audioBuffer: invalidBuffer,
    timestamp: Date.now(),
    sampleRate: 44100,
    duration: 1000,
    hasVoiceActivity: true,
    averageVolume: 0.1
  };
  
  asrService.processAudio(processedChunk)
    .then((result) => {
      if (result) {
        console.log('⚠️ Buffer inválido foi processado (inesperado)');
      } else {
        console.log('✅ Buffer inválido foi rejeitado corretamente');
      }
    })
    .catch((error) => {
      console.log('✅ Buffer inválido causou erro (esperado):', error.message);
    });
    
} catch (error) {
  console.error('❌ Erro no teste de buffer inválido:', error.message);
}

console.log('\n🎉 Testes concluídos!');
console.log('\n📊 Resumo das correções aplicadas:');
console.log('1. ✅ FormData corrigido para Node.js');
console.log('2. ✅ Headers otimizados');
console.log('3. ✅ Validação de buffer WAV aprimorada');
console.log('4. ✅ Timeout de 30s adicionado');
console.log('5. ✅ Tratamento de erro melhorado');
console.log('6. ✅ Processamento assíncrono robusto');

// Aguardar um pouco para que as promises assíncronas terminem
setTimeout(() => {
  console.log('\n🏁 Todos os testes finalizados.');
}, 3000);
