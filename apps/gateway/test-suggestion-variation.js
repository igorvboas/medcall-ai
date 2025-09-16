/**
 * Script para testar variação das sugestões
 */

const { suggestionService } = require('./src/services/suggestionService');
const { db } = require('./src/config/database');

async function testSuggestionVariation() {
  console.log('🔄 Testando variação das sugestões...\n');

  try {
    // Criar dados de teste baseados na imagem (dor de cabeça, estômago, diarreia)
    const testSessionId = 'test-variation-' + Date.now();
    const testUtterances = [
      {
        id: 'test-1',
        speaker: 'patient',
        text: 'Doutor, estou com uma dor de cabeça muito forte.',
        timestamp: new Date().toISOString(),
        confidence: 0.9
      },
      {
        id: 'test-2',
        speaker: 'patient',
        text: 'Também sinto dor no estômago e estou com diarreia.',
        timestamp: new Date().toISOString(),
        confidence: 0.85
      },
      {
        id: 'test-3',
        speaker: 'patient',
        text: 'Não tomei remédio porque não achei necessário.',
        timestamp: new Date().toISOString(),
        confidence: 0.88
      }
    ];

    // Criar sessão
    const session = await db.createSession({
      id: testSessionId,
      consultation_id: 'test-consultation-variation',
      session_type: 'presencial',
      status: 'active',
      created_at: new Date().toISOString()
    });

    console.log('✅ Sessão criada:', session.id);

    // Criar utterances
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

    const context = {
      sessionId: testSessionId,
      patientName: 'Mariana',
      sessionDuration: 5,
      consultationType: 'presencial',
      utterances: testUtterances,
      specialty: 'clinica_geral'
    };

    console.log('\n🔍 Testando múltiplas gerações de sugestões...\n');

    // Forçar uso de fallback para testar variação
    const originalMakeChatCompletion = require('./src/services/openaiService').makeChatCompletion;
    require('./src/services/openaiService').makeChatCompletion = async () => {
      throw new Error('Forçando fallback para testar variação');
    };

    try {
      // Gerar sugestões múltiplas vezes para ver a variação
      const allSuggestions = [];
      
      for (let i = 1; i <= 5; i++) {
        console.log(`--- Teste ${i} ---`);
        const suggestions = await suggestionService.generateSuggestions(context);
        
        if (suggestions && suggestions.suggestions.length > 0) {
          console.log(`✅ ${suggestions.suggestions.length} sugestões geradas:`);
          
          suggestions.suggestions.forEach((suggestion, index) => {
            console.log(`   ${index + 1}. ${suggestion.content}`);
            console.log(`      Fonte: ${suggestion.source} | Prioridade: ${suggestion.priority}`);
          });

          // Coletar todas as sugestões para análise
          allSuggestions.push(...suggestions.suggestions.map(s => s.content));
          
        } else {
          console.log('❌ Nenhuma sugestão gerada');
        }
        
        console.log(''); // Linha em branco
      }

      // Análise da variação
      console.log('📊 Análise da variação:');
      const uniqueSuggestions = [...new Set(allSuggestions)];
      console.log(`   Total de sugestões geradas: ${allSuggestions.length}`);
      console.log(`   Sugestões únicas: ${uniqueSuggestions.length}`);
      console.log(`   Taxa de variação: ${Math.round((uniqueSuggestions.length / allSuggestions.length) * 100)}%`);

      if (uniqueSuggestions.length > allSuggestions.length * 0.5) {
        console.log('🎉 Excelente! As sugestões estão variando bem.');
      } else if (uniqueSuggestions.length > allSuggestions.length * 0.3) {
        console.log('✅ Bom! As sugestões estão variando moderadamente.');
      } else {
        console.log('⚠️ As sugestões ainda estão muito repetitivas.');
      }

      console.log('\n📝 Sugestões únicas encontradas:');
      uniqueSuggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });

    } finally {
      // Restaurar função original
      require('./src/services/openaiService').makeChatCompletion = originalMakeChatCompletion;
    }

    // Limpeza
    suggestionService.clearSessionCache(testSessionId);
    console.log('\n✅ Teste de variação concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
if (require.main === module) {
  testSuggestionVariation().catch(console.error);
}

module.exports = { testSuggestionVariation };
