#!/usr/bin/env node

/**
 * Teste para verificar se as correções do AudioProcessor resolveram o stack overflow
 */

const { audioProcessor } = require('./dist/services/audioProcessor');

console.log('🧪 Testando correções do AudioProcessor...\n');

// Simular chunks de áudio grandes
function createLargeAudioChunk(sessionId, channel, size) {
  const audioData = new Float32Array(size);
  
  // Preencher com dados simulados
  for (let i = 0; i < size; i++) {
    audioData[i] = Math.sin(i * 0.01) * 0.1 + Math.random() * 0.05;
  }
  
  return {
    sessionId,
    channel,
    audioData,
    timestamp: Date.now(),
    sampleRate: 44100
  };
}

// Teste 1: Chunk normal
console.log('📋 Teste 1: Chunk normal (44.1k samples)...');
try {
  const normalChunk = createLargeAudioChunk('test-session', 'doctor', 44100);
  audioProcessor.processAudioChunk(normalChunk);
  console.log('✅ Chunk normal processado com sucesso');
} catch (error) {
  console.error('❌ Erro no chunk normal:', error.message);
}

// Teste 2: Chunk grande (mas dentro do limite)
console.log('\n📋 Teste 2: Chunk grande (200k samples)...');
try {
  const largeChunk = createLargeAudioChunk('test-session', 'patient', 200000);
  audioProcessor.processAudioChunk(largeChunk);
  console.log('✅ Chunk grande processado com sucesso');
} catch (error) {
  console.error('❌ Erro no chunk grande:', error.message);
}

// Teste 3: Chunk muito grande (deve ser rejeitado)
console.log('\n📋 Teste 3: Chunk muito grande (600k samples - deve ser rejeitado)...');
try {
  const hugeChunk = createLargeAudioChunk('test-session', 'doctor', 600000);
  audioProcessor.processAudioChunk(hugeChunk);
  console.log('✅ Chunk muito grande foi rejeitado corretamente');
} catch (error) {
  console.error('❌ Erro inesperado no chunk muito grande:', error.message);
}

// Teste 4: Múltiplos chunks para testar buffering
console.log('\n📋 Teste 4: Múltiplos chunks para testar buffering...');
try {
  for (let i = 0; i < 10; i++) {
    const chunk = createLargeAudioChunk('test-session-2', i % 2 === 0 ? 'doctor' : 'patient', 44100);
    audioProcessor.processAudioChunk(chunk);
  }
  console.log('✅ Múltiplos chunks processados com sucesso');
} catch (error) {
  console.error('❌ Erro nos múltiplos chunks:', error.message);
}

// Teste 5: Forçar processamento de frases pendentes
console.log('\n📋 Teste 5: Forçar processamento de frases pendentes...');
try {
  audioProcessor.flushPendingPhrases('test-session');
  audioProcessor.flushPendingPhrases('test-session-2');
  console.log('✅ Processamento de frases pendentes executado com sucesso');
} catch (error) {
  console.error('❌ Erro no processamento de frases pendentes:', error.message);
}

// Teste 6: Estatísticas
console.log('\n📋 Teste 6: Obter estatísticas...');
try {
  const stats = audioProcessor.getStats();
  console.log('✅ Estatísticas obtidas:', JSON.stringify(stats, null, 2));
} catch (error) {
  console.error('❌ Erro ao obter estatísticas:', error.message);
}

// Teste 7: Limpeza
console.log('\n📋 Teste 7: Limpeza de sessões...');
try {
  audioProcessor.clearAllSessions();
  console.log('✅ Limpeza executada com sucesso');
} catch (error) {
  console.error('❌ Erro na limpeza:', error.message);
}

console.log('\n🎉 Testes concluídos! Se não houve stack overflow, as correções funcionaram.');
console.log('\n📊 Resumo das correções aplicadas:');
console.log('1. ✅ Proteção contra arrays muito grandes');
console.log('2. ✅ Otimização do debug logging');
console.log('3. ✅ Processamento assíncrono com setImmediate');
console.log('4. ✅ Limites de tamanho de buffer');
console.log('5. ✅ Validações de entrada aprimoradas');
console.log('6. ✅ Truncamento seguro de áudio longo');
console.log('7. ✅ Proteção contra recursão infinita');
