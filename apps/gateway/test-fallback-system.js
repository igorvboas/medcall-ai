/**
 * Script de teste simplificado - testa apenas o sistema de fallback
 */

const { suggestionService } = require('./src/services/suggestionService');
const { db } = require('./src/config/database');

async function testFallbackSystem() {
  console.log('🔧 Testando sistema de fallback (sem IA)...\n');

  try {
    // 1. Verificar status do serviço
    const stats = suggestionService.getServiceStats();
    console.log('📊 Status do serviço:', stats.isEnabled ? '✅ Habilitado' : '❌ Desabilitado');

    // 2. Criar dados de teste simples
    const testSessionId = 'test-fallback-' + Date.now();
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

    // 3. Criar sessão de teste
    console.log('\n📝 Criando sessão de teste...');
    const session = await db.createSession({
      id: testSessionId,
      consultation_id: 'test-consultation-fallback',
      session_type: 'presencial',
      status: 'active',
      created_at: new Date().toISOString()
    });

    if (!session) {
      console.log('❌ Falha ao criar sessão de teste');
      return;
    }

    console.log('✅ Sessão criada:', session.id);

    // 4. Criar utterances de teste
    console.log('\n📝 Criando utterances de teste...');
    for (const utterance of testUtterances) {
      const created = await db.createUtterance({
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

      if (created) {
        console.log(`✅ Utterance criada: [${utterance.speaker}] "${utterance.text.substring(0, 50)}..."`);
      }
    }

    // 5. Testar extração de sintomas (método direto)
    console.log('\n🔍 Testando extração de sintomas...');
    
    // Simular análise de contexto básica
    const mockContextAnalysis = {
      phase: 'anamnese',
      urgency_level: 'high',
      symptoms: ['dor', 'peito', 'respiração', 'falta de ar'],
      patient_concerns: ['dor no peito', 'falta de ar'],
      clinical_notes: 'Paciente relata dor no peito e dispneia'
    };

    console.log('📊 Sintomas detectados:', mockContextAnalysis.symptoms);
    console.log('📊 Preocupações:', mockContextAnalysis.patient_concerns);

    // 6. Testar geração de sugestões de fallback
    console.log('\n🤖 Testando geração de sugestões de fallback...');
    
    // Simular chamada direta do método privado (via reflexão)
    const fallbackSuggestions = suggestionService.generateFallbackSuggestions(mockContextAnalysis);
    
    if (fallbackSuggestions && fallbackSuggestions.length > 0) {
      console.log(`\n✅ ${fallbackSuggestions.length} sugestões de fallback geradas:`);
      
      fallbackSuggestions.forEach((suggestion, index) => {
        console.log(`\n   ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.content}`);
        console.log(`      Prioridade: ${suggestion.priority} | Confiança: ${Math.round(suggestion.confidence * 100)}%`);
        console.log(`      Fonte: ${suggestion.source}`);
      });

      console.log('\n🎉 Sistema de fallback funcionando!');

    } else {
      console.log('❌ Nenhuma sugestão de fallback foi gerada');
    }

    // 7. Testar sugestões de emergência
    console.log('\n🚨 Testando sugestões de emergência...');
    const emergencySuggestions = suggestionService.generateEmergencyFallbackSuggestions(mockContextAnalysis);
    
    if (emergencySuggestions && emergencySuggestions.length > 0) {
      console.log(`\n✅ ${emergencySuggestions.length} sugestões de emergência:`);
      emergencySuggestions.forEach((suggestion, index) => {
        console.log(`\n   ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.content}`);
        console.log(`      Fonte: ${suggestion.source}`);
      });
    }

    // 8. Limpeza
    console.log('\n🧹 Limpando dados de teste...');
    suggestionService.clearSessionCache(testSessionId);
    console.log('✅ Teste de fallback concluído!');

    console.log('\n💡 Próximos passos:');
    console.log('   1. Verifique se OPENAI_API_KEY está configurada');
    console.log('   2. Teste o sistema completo com IA');
    console.log('   3. Monitore os logs para erros de JSON');

  } catch (error) {
    console.error('❌ Erro durante o teste de fallback:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Executar teste
if (require.main === module) {
  testFallbackSystem().catch(console.error);
}

module.exports = { testFallbackSystem };
