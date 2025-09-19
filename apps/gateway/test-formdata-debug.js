#!/usr/bin/env node

/**
 * Teste para debugar o problema do parâmetro model no FormData
 */

const FormData = require('form-data');

console.log('🧪 Testando construção do FormData...\n');

// Simular a construção do FormData como no código
const formData = new FormData();

// Adicionar arquivo (simulado)
const testBuffer = Buffer.from('test audio data');
formData.append('file', testBuffer, {
  filename: 'audio.wav',
  contentType: 'audio/wav',
  knownLength: testBuffer.length
});

// Adicionar parâmetros (como no código)
formData.append('model', 'whisper-1');
formData.append('language', 'pt');
formData.append('response_format', 'verbose_json');
formData.append('temperature', '0.0');
formData.append('prompt', 'Test prompt');

console.log('📋 FormData construído:');
console.log(`🔍 Headers:`, formData.getHeaders());
console.log(`🔍 FormData size: ${formData.getLengthSync()} bytes`);

// Verificar se os campos estão sendo adicionados
console.log('\n🔍 Verificando campos do FormData...');

// Tentar acessar os campos (isso pode não funcionar, mas vamos tentar)
try {
  // Note: FormData não expõe facilmente os campos, mas podemos verificar os headers
  const headers = formData.getHeaders();
  console.log('✅ Headers do FormData:', headers);
  
  if (headers['content-type']) {
    console.log('✅ Content-Type definido:', headers['content-type']);
    
    // Verificar se é multipart/form-data
    if (headers['content-type'].includes('multipart/form-data')) {
      console.log('✅ Formato multipart/form-data correto');
    } else {
      console.log('❌ Formato incorreto:', headers['content-type']);
    }
  } else {
    console.log('⚠️ Content-Type não definido nos headers');
  }
  
} catch (error) {
  console.log('⚠️ Erro ao verificar FormData:', error.message);
}

// Testar com fetch simulado (sem enviar)
console.log('\n🧪 Testando fetch simulado...');

// Simular a chamada fetch (sem enviar realmente)
const mockFetchOptions = {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test-key',
    ...formData.getHeaders()
  },
  body: formData
};

console.log('📋 Opções do fetch:');
console.log(`🔍 Method: ${mockFetchOptions.method}`);
console.log(`🔍 Headers:`, mockFetchOptions.headers);
console.log(`🔍 Body type: ${typeof mockFetchOptions.body}`);

// Verificar se o problema pode estar na ordem dos parâmetros
console.log('\n🔧 Testando ordem dos parâmetros...');

const formData2 = new FormData();

// Adicionar model PRIMEIRO (como alguns exemplos sugerem)
formData2.append('model', 'whisper-1');
formData2.append('file', testBuffer, {
  filename: 'audio.wav',
  contentType: 'audio/wav'
});
formData2.append('language', 'pt');

console.log('✅ FormData com model primeiro criado');
console.log(`🔍 Headers:`, formData2.getHeaders());

console.log('\n🎉 Teste concluído!');
console.log('\n📊 Possíveis soluções:');
console.log('1. ✅ Verificar se model está sendo enviado');
console.log('2. ✅ Verificar ordem dos parâmetros');
console.log('3. ✅ Verificar se FormData está sendo construído corretamente');
console.log('4. ✅ Verificar se headers estão corretos');
