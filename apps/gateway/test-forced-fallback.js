/**
 * Script para testar o sistema com fallback forçado
 */

const { suggestionService } = require('./src/services/suggestionService');
const { db } = require('./src/config/database');

async function testForcedFallback() {
  console.log('🔧 Testando sistema com fallback forçado...\n');

  try {
    // 1. Criar dados de teste
    const testSessionId = 'test-forced-fallback-' + Date.now();
    const testUtterances = [
      {
        id: 'test-1',
        speaker: 'patient',
        text: 'Doutor, estou com uma dor muito forte no peito há dois dias.',
        timestamp: new Date().toISOString(),
        confidence: 0.9
      },
      {
        id: 'test-2',
        speaker: 'patient',
        text: 'Também sinto falta de ar quando faço esforço físico.',
        timestamp: new Date().toISOString(),
        confidence: 0.85
      }
    ];

    // 2. Criar sessão
    const session = await db.createSession({
      id: testSessionId,
      consultation_id: 'test-consultation-forced',
      session_type: 'presencial',
      status: 'active',
      created_at: new Date().toISOString()
    });

    console.log('✅ Sessão criada:', session.id);

    // 3. Criar utterances
    for (const utterance of testUtterances) {
      await db.createUtterance({
        id: utterance.id,
        session_id: testSessionId,
        speaker: utterance.speaker,
        text: utterance.text,
        confidence: utterance.confidence,
        start_ms: Date.now() - 300000,
        end_ms: Date.now() - 200000,
        is_final: true,
        created_at: utterance.timestamp
      });
    }

    // 4. Simular contexto com sintomas detectados
    const context = {
      sessionId: testSessionId,
      patientName: 'Paciente Teste',
      sessionDuration: 5,
      consultationType: 'presencial',
      utterances: testUtterances,
      specialty: 'clinica_geral'
    };

    console.log('\n🤖 Testando geração de sugestões com fallback...');

    // 5. Forçar uso de fallback simulando erro na IA
    const originalMakeChatCompletion = require('./src/services/openaiService').makeChatCompletion;
    
    // Mock que sempre falha para forçar fallback
    require('./src/services/openaiService').makeChatCompletion = async () => {
      throw new Error('Simulação de erro da IA para testar fallback');
    };

    try {
      const suggestions = await suggestionService.generateSuggestions(context);
      
      if (suggestions && suggestions.suggestions.length > 0) {
        console.log(`\n✅ ${suggestions.suggestions.length} sugestões geradas via fallback:`);
        
        suggestions.suggestions.forEach((suggestion, index) => {
          console.log(`\n   ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.content}`);
          console.log(`      Prioridade: ${suggestion.priority} | Confiança: ${Math.round(suggestion.confidence * 100)}%`);
          console.log(`      Fonte: ${suggestion.source || 'N/A'}`);
        });

        console.log('\n🎉 Sistema de fallback funcionando perfeitamente!');
        console.log('💡 Isso significa que mesmo quando a IA falha, o sistema ainda gera sugestões úteis.');

      } else {
        console.log('❌ Nenhuma sugestão foi gerada mesmo com fallback');
      }

    } finally {
      // Restaurar função original
      require('./src/services/openaiService').makeChatCompletion = originalMakeChatCompletion;
    }

    // 6. Limpeza
    suggestionService.clearSessionCache(testSessionId);
    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
if (require.main === module) {
  testForcedFallback().catch(console.error);
}

module.exports = { testForcedFallback };
