/**
 * Script de teste para o sistema de sugestões de IA
 * Valida a integração completa entre transcrição, análise de contexto e geração de sugestões
 */

import { suggestionService } from './src/services/suggestionService';
import { asrService } from './src/services/asrService';
import { db } from './src/config/database';

// Dados de teste simulando uma consulta médica
const mockConsultationData = {
  sessionId: 'test-session-' + Date.now(),
  patientName: 'Maria Silva',
  patientAge: '45',
  patientGender: 'feminino',
  consultationType: 'presencial',
  specialty: 'clinica_geral',
  utterances: [
    {
      id: 'utterance-1',
      speaker: 'doctor',
      text: 'Bom dia, Maria. O que a trouxe aqui hoje?',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min atrás
      confidence: 0.95
    },
    {
      id: 'utterance-2',
      speaker: 'patient',
      text: 'Bom dia, doutor. Estou com uma dor muito forte no peito há dois dias.',
      timestamp: new Date(Date.now() - 280000).toISOString(),
      confidence: 0.92
    },
    {
      id: 'utterance-3',
      speaker: 'doctor',
      text: 'Entendo. Você pode me dizer onde exatamente dói?',
      timestamp: new Date(Date.now() - 260000).toISOString(),
      confidence: 0.94
    },
    {
      id: 'utterance-4',
      speaker: 'patient',
      text: 'Dói aqui no meio do peito, como se fosse um aperto. E às vezes a dor vai para o braço esquerdo.',
      timestamp: new Date(Date.now() - 240000).toISOString(),
      confidence: 0.89
    },
    {
      id: 'utterance-5',
      speaker: 'doctor',
      text: 'A dor aparece quando você faz esforço físico?',
      timestamp: new Date(Date.now() - 220000).toISOString(),
      confidence: 0.96
    },
    {
      id: 'utterance-6',
      speaker: 'patient',
      text: 'Sim, quando subo escadas ou caminho rápido a dor piora muito. E também sinto falta de ar.',
      timestamp: new Date(Date.now() - 200000).toISOString(),
      confidence: 0.91
    },
    {
      id: 'utterance-7',
      speaker: 'patient',
      text: 'Doutor, estou com muito medo. Minha mãe teve infarto do coração.',
      timestamp: new Date(Date.now() - 180000).toISOString(),
      confidence: 0.88
    }
  ]
};

async function testSuggestionSystem() {
  console.log('🧪 Iniciando testes do sistema de sugestões de IA...\n');

  try {
    // 1. Testar criação de sessão
    console.log('1️⃣ Testando criação de sessão...');
    const session = await db.createSession({
      id: mockConsultationData.sessionId,
      consultation_id: 'test-consultation-123',
      session_type: 'presencial',
      status: 'active',
      created_at: new Date(Date.now() - 300000).toISOString()
    });

    if (session) {
      console.log('✅ Sessão criada com sucesso:', session.id);
    } else {
      console.log('❌ Falha ao criar sessão');
      return;
    }

    // 2. Testar criação de utterances
    console.log('\n2️⃣ Testando criação de utterances...');
    for (const utterance of mockConsultationData.utterances) {
      const created = await db.createUtterance({
        id: utterance.id,
        session_id: mockConsultationData.sessionId,
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
      } else {
        console.log(`❌ Falha ao criar utterance: ${utterance.id}`);
      }
    }

    // 3. Testar geração de sugestões
    console.log('\n3️⃣ Testando geração de sugestões...');
    const context = {
      sessionId: mockConsultationData.sessionId,
      patientName: mockConsultationData.patientName,
      patientAge: mockConsultationData.patientAge,
      patientGender: mockConsultationData.patientGender,
      sessionDuration: 5, // 5 minutos
      consultationType: mockConsultationData.consultationType,
      utterances: mockConsultationData.utterances,
      specialty: mockConsultationData.specialty
    };

    const suggestions = await suggestionService.generateSuggestions(context);

    if (suggestions && suggestions.suggestions.length > 0) {
      console.log(`✅ ${suggestions.suggestions.length} sugestões geradas:`);
      
      suggestions.suggestions.forEach((suggestion, index) => {
        console.log(`\n   ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.content}`);
        console.log(`      Prioridade: ${suggestion.priority} | Confiança: ${Math.round(suggestion.confidence * 100)}%`);
        console.log(`      Fonte: ${suggestion.source || 'N/A'}`);
      });

      console.log('\n📊 Análise de contexto:');
      console.log(`   Fase da consulta: ${suggestions.context_analysis.phase}`);
      console.log(`   Nível de urgência: ${suggestions.context_analysis.urgency_level}`);
      console.log(`   Sintomas identificados: ${suggestions.context_analysis.symptoms.join(', ')}`);
      
      if (suggestions.red_flags.length > 0) {
        console.log(`\n⚠️ Sinais de alerta:`);
        suggestions.red_flags.forEach(flag => console.log(`   - ${flag}`));
      }

    } else {
      console.log('❌ Nenhuma sugestão foi gerada');
    }

    // 4. Testar busca de sugestões existentes
    console.log('\n4️⃣ Testando busca de sugestões existentes...');
    const existingSuggestions = await suggestionService.getSessionSuggestions(mockConsultationData.sessionId);
    console.log(`✅ ${existingSuggestions.length} sugestões encontradas na sessão`);

    // 5. Testar marcação de sugestão como usada
    if (existingSuggestions.length > 0) {
      console.log('\n5️⃣ Testando marcação de sugestão como usada...');
      const firstSuggestion = existingSuggestions[0];
      const marked = await suggestionService.markSuggestionAsUsed(firstSuggestion.id, 'test-doctor');
      
      if (marked) {
        console.log(`✅ Sugestão "${firstSuggestion.content.substring(0, 50)}..." marcada como usada`);
      } else {
        console.log('❌ Falha ao marcar sugestão como usada');
      }
    }

    // 6. Testar estatísticas do serviço
    console.log('\n6️⃣ Testando estatísticas do serviço...');
    const stats = suggestionService.getServiceStats();
    console.log('📈 Estatísticas do serviço:');
    console.log(`   Serviço habilitado: ${stats.isEnabled}`);
    console.log(`   Sessões ativas: ${stats.activeSessions}`);
    console.log(`   Total de sugestões: ${stats.totalSuggestions}`);
    console.log(`   Configurações:`, stats.config);

    // 7. Limpeza
    console.log('\n7️⃣ Limpando dados de teste...');
    suggestionService.clearSessionCache(mockConsultationData.sessionId);
    console.log('✅ Cache limpo');

    console.log('\n🎉 Todos os testes concluídos com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Função para testar diferentes cenários
async function testDifferentScenarios() {
  console.log('\n🔬 Testando diferentes cenários médicos...\n');

  const scenarios = [
    {
      name: 'Consulta Psiquiátrica - Ansiedade',
      specialty: 'psiquiatria',
      utterances: [
        { speaker: 'patient', text: 'Doutor, estou muito ansioso ultimamente. Não consigo dormir direito.' },
        { speaker: 'doctor', text: 'Entendo. Há quanto tempo você está com esses sintomas?' },
        { speaker: 'patient', text: 'Faz uns três meses. Começou depois que perdi o emprego.' }
      ]
    },
    {
      name: 'Consulta de Emergência - Dor Torácica',
      specialty: 'cardiologia',
      utterances: [
        { speaker: 'patient', text: 'Doutor, estou com uma dor muito forte no peito! Não consigo respirar!' },
        { speaker: 'doctor', text: 'Calma, vamos avaliar. A dor começou quando?' },
        { speaker: 'patient', text: 'Agora mesmo! E está se espalhando para o braço!' }
      ]
    },
    {
      name: 'Consulta de Rotina - Check-up',
      specialty: 'clinica_geral',
      utterances: [
        { speaker: 'doctor', text: 'Bom dia! Vamos fazer seu check-up anual hoje.' },
        { speaker: 'patient', text: 'Ótimo! Estou me sentindo bem, mas queria verificar a pressão.' },
        { speaker: 'doctor', text: 'Perfeito. Você tem algum sintoma ou preocupação?' }
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 Testando: ${scenario.name}`);
    
    const context = {
      sessionId: `test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      patientName: 'Paciente Teste',
      sessionDuration: 10,
      consultationType: 'presencial',
      utterances: scenario.utterances.map((u, i) => ({
        id: `test-${i}`,
        speaker: u.speaker,
        text: u.text,
        timestamp: new Date(Date.now() - (scenario.utterances.length - i) * 60000).toISOString(),
        confidence: 0.9
      })),
      specialty: scenario.specialty
    };

    try {
      const suggestions = await suggestionService.generateSuggestions(context);
      
      if (suggestions && suggestions.suggestions.length > 0) {
        console.log(`   ✅ ${suggestions.suggestions.length} sugestões geradas`);
        console.log(`   📊 Fase: ${suggestions.context_analysis.phase} | Urgência: ${suggestions.context_analysis.urgency_level}`);
        
        // Mostrar primeira sugestão como exemplo
        const firstSuggestion = suggestions.suggestions[0];
        console.log(`   💡 Exemplo: "${firstSuggestion.content.substring(0, 60)}..."`);
      } else {
        console.log('   ⚠️ Nenhuma sugestão gerada');
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

// Executar testes
async function runAllTests() {
  console.log('🚀 Iniciando suite completa de testes do sistema de sugestões de IA\n');
  console.log('=' .repeat(80));
  
  await testSuggestionSystem();
  await testDifferentScenarios();
  
  console.log('\n' + '=' .repeat(80));
  console.log('✨ Suite de testes concluída!');
  
  // Mostrar resumo final
  const finalStats = suggestionService.getServiceStats();
  console.log('\n📊 Resumo Final:');
  console.log(`   Status: ${finalStats.isEnabled ? '✅ Ativo' : '❌ Inativo'}`);
  console.log(`   Sessões testadas: ${finalStats.activeSessions}`);
  console.log(`   Sugestões geradas: ${finalStats.totalSuggestions}`);
}

// Executar se chamado diretamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testSuggestionSystem, testDifferentScenarios, runAllTests };
