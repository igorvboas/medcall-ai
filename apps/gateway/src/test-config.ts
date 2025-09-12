#!/usr/bin/env tsx

/**
 * Script para testar todas as configurações do gateway
 * Execute: npm run test:config (vamos adicionar no package.json)
 * Ou: npx tsx src/test-config.ts
 */

import { config } from './config/index';
import { testDatabaseConnection } from './config/database';
import { validateAllProviders } from './config/providers';
import { initializeRedis, cache } from './config/redis';

async function testConfigurations() {
  console.log('🚀 Iniciando teste de configurações...\n');

  // 1. Testar variáveis de ambiente
  console.log('📋 Configurações carregadas:');
  console.log(`   Ambiente: ${config.NODE_ENV}`);
  console.log(`   Porta: ${config.PORT}`);
  console.log(`   Frontend URL: ${config.FRONTEND_URL}`);
  console.log(`   LiveKit URL: ${config.LIVEKIT_URL}`);
  console.log(`   Supabase URL: ${config.SUPABASE_URL}`);
  console.log(`   OpenAI configurado: ${config.OPENAI_API_KEY ? 'Sim' : 'Não'}`);
  console.log(`   JWT Secret: ${config.JWT_SECRET.length} caracteres`);
  console.log(`   Encryption Key: ${config.ENCRYPTION_KEY.length} caracteres`);
  console.log(`   Redis configurado: ${config.REDIS_URL ? 'Sim' : 'Não'}\n`);

  // 2. Testar conexão com Supabase
  console.log('🗄️  Testando conexão com Supabase...');
  const dbConnected = await testDatabaseConnection();
  console.log();

  // 3. Testar provedores (OpenAI, LiveKit)
  const providerResults = await validateAllProviders();
  console.log();

  // 4. Testar Redis (se configurado)
  console.log('🔴 Testando Redis...');
  const redisClient = initializeRedis();
  let redisWorking = false;
  
  if (redisClient) {
    try {
      await cache.set('test-key', { message: 'Redis funcionando!' }, 10);
      const testData = await cache.get('test-key');
      redisWorking = testData && testData.message === 'Redis funcionando!';
      await cache.del('test-key');
      
      if (redisWorking) {
        console.log('✅ Redis funcionando corretamente');
      } else {
        console.log('❌ Redis conectado mas operações falharam');
      }
    } catch (error) {
      console.log('❌ Erro ao testar Redis:', error);
    }
  } else {
    console.log('⚠️  Redis não configurado (normal para desenvolvimento)');
    redisWorking = true; // Não é erro, apenas não está configurado
  }

  // 5. Resumo final
  console.log('\n📊 RESUMO FINAL:');
  console.log('================');
  
  const results = {
    config: true, // Se chegou até aqui, config está OK
    database: dbConnected,
    openai: providerResults.openai,
    livekit: providerResults.livekit,
    redis: redisWorking,
  };

  Object.entries(results).forEach(([service, status]) => {
    const icon = status ? '✅' : '❌';
    const name = service.charAt(0).toUpperCase() + service.slice(1);
    console.log(`   ${icon} ${name}: ${status ? 'OK' : 'FALHOU'}`);
  });

  const allGood = Object.values(results).every(Boolean);
  
  console.log(`\n${allGood ? '🎉' : '⚠️'} Status geral: ${allGood ? 'TUDO FUNCIONANDO!' : 'ALGUNS PROBLEMAS ENCONTRADOS'}`);
  
  if (!allGood) {
    console.log('\n🔧 Para resolver problemas:');
    if (!results.database) {
      console.log('   - Verifique as credenciais do Supabase no .env');
      console.log('   - Certifique-se que o projeto Supabase está ativo');
    }
    if (!results.openai) {
      console.log('   - Verifique a chave da OpenAI no .env');
      console.log('   - Confirme que a conta OpenAI tem créditos');
    }
    if (!results.livekit) {
      console.log('   - Verifique as credenciais do LiveKit no .env');
      console.log('   - Confirme que o projeto LiveKit está ativo');
    }
  } else {
    console.log('\n🚀 Pronto para implementar o servidor Express!');
  }

  // Fechar conexões
  if (redisClient) {
    await redisClient.quit();
  }

  process.exit(allGood ? 0 : 1);
}

// Capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erro não tratado:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exceção não capturada:', error);
  process.exit(1);
});

// Executar teste
testConfigurations();