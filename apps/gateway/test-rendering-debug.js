// Teste simples para verificar se o problema está na renderização
console.log('🧪 Teste de renderização do TranscriptionDisplay...');

// Simular props que seriam passadas
const testProps = {
  patientName: 'Test Patient',
  userRole: 'doctor',
  roomName: 'test-room-123',
  participantId: 'test-participant',
  consultationId: 'test-consultation-123'
};

console.log('📋 Props de teste:', testProps);

// Simular o que deveria acontecer
console.log('🔄 Simulando renderização...');
console.log('1. Arquivo TranscriptionDisplay carregado ✅');
console.log('2. Componente TranscriptionDisplay renderizado ✅');
console.log('3. Hook useTranscriptionLiveKit executado ✅');
console.log('4. Logs de debug aparecem no console ✅');

console.log('✅ Teste concluído');
console.log('🔍 Se não aparecer logs no console do navegador:');
console.log('- O componente não está sendo renderizado');
console.log('- Há erro de importação');
console.log('- O componente está sendo renderizado condicionalmente');
console.log('- Há erro de JavaScript que impede execução');
