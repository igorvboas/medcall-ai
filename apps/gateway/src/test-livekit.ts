#!/usr/bin/env tsx

/**
 * Script para testar conexão com LiveKit e geração de tokens
 * Execute: npx tsx src/test-livekit.ts
 */

import { config } from './config/index';
import { generateLiveKitToken } from './config/providers';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';

async function testLiveKitConnection() {
  console.log('🚀 Testando conexão com LiveKit...\n');

  // 1. Verificar configurações
  console.log('📋 Configurações LiveKit:');
  console.log(`   URL: ${config.LIVEKIT_URL}`);
  console.log(`   API Key: ${config.LIVEKIT_API_KEY ? `${config.LIVEKIT_API_KEY.substring(0, 10)}...` : 'NÃO CONFIGURADO'}`);
  console.log(`   API Secret: ${config.LIVEKIT_API_SECRET ? `${config.LIVEKIT_API_SECRET.substring(0, 10)}...` : 'NÃO CONFIGURADO'}\n`);

  if (!config.LIVEKIT_URL || !config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    console.error('❌ Configurações LiveKit incompletas!');
    return false;
  }

  try {
    // 2. Testar geração de token
    console.log('🔑 Testando geração de token...');
    const testIdentity = 'test-doctor-' + Date.now();
    const testRoom = 'test-room-' + Date.now();
    
    const token = await generateLiveKitToken(testIdentity, testRoom, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'doctor', test: true })
    });

    console.log('✅ Token gerado com sucesso!');
    console.log(`   Token length: ${token.length} caracteres`);
    console.log(`   Identity: ${testIdentity}`);
    console.log(`   Room: ${testRoom}\n`);

    // 3. Testar decodificação do token
    console.log('🔍 Validando token JWT...');
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Token JWT inválido - formato incorreto');
    }

    const payload = JSON.parse(atob(tokenParts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    console.log('✅ Token JWT válido!');
    console.log(`   Issued at: ${new Date(payload.iat * 1000).toISOString()}`);
    console.log(`   Expires at: ${new Date(payload.exp * 1000).toISOString()}`);
    console.log(`   Time until expiry: ${payload.exp - now} segundos`);
    console.log(`   Identity: ${payload.sub}`);
    console.log(`   Room: ${payload.video?.room}\n`);

    // 4. Testar conexão com a sala
    console.log('🌐 Testando conexão com sala LiveKit...');
    const room = new Room();
    
    // Configurar listeners de eventos
    room.on(RoomEvent.Connected, () => {
      console.log('✅ Conectado à sala LiveKit!');
      console.log(`   Room name: ${room.name}`);
      console.log(`   Participants: ${room.remoteParticipants.size}`);
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      console.log(`❌ Desconectado da sala: ${reason}`);
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`👤 Participante conectado: ${participant.identity}`);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`👤 Participante desconectado: ${participant.identity}`);
    });

    // Conectar à sala
    await room.connect(config.LIVEKIT_URL, token);
    
    console.log('✅ Conexão estabelecida com sucesso!\n');

    // 5. Testar permissões de mídia (se disponível)
    try {
      console.log('🎤 Testando permissões de mídia...');
      const stream = await navigator.mediaDevices?.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (stream) {
        console.log('✅ Permissões de mídia obtidas!');
        console.log(`   Video tracks: ${stream.getVideoTracks().length}`);
        console.log(`   Audio tracks: ${stream.getAudioTracks().length}`);
        
        // Limpar stream
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (mediaError) {
      console.log('⚠️  Não foi possível testar permissões de mídia (ambiente Node.js)');
    }

    // 6. Desconectar e limpar
    console.log('🧹 Desconectando da sala...');
    await room.disconnect();
    
    console.log('✅ Teste de conexão LiveKit concluído com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro no teste de conexão LiveKit:');
    console.error(`   Tipo: ${error.constructor.name}`);
    console.error(`   Mensagem: ${error.message}`);
    
    if (error.stack) {
      console.error('   Stack trace:');
      console.error(error.stack);
    }
    
    return false;
  }
}

async function testTokenValidation() {
  console.log('\n🔍 Testando validação de tokens...\n');

  try {
    // Testar token expirado
    console.log('⏰ Testando token expirado...');
    const expiredToken = await generateLiveKitToken('test-user', 'test-room', {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'doctor', test: true })
    });

    // Simular token expirado alterando o payload
    const tokenParts = expiredToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    payload.exp = Math.floor(Date.now() / 1000) - 3600; // Expirou há 1 hora
    
    const newPayload = btoa(JSON.stringify(payload));
    const expiredTokenTest = `${tokenParts[0]}.${newPayload}.${tokenParts[2]}`;

    try {
      const room = new Room();
      await room.connect(config.LIVEKIT_URL, expiredTokenTest);
      console.log('❌ Token expirado foi aceito (ERRO!)');
    } catch (error) {
      console.log('✅ Token expirado rejeitado corretamente');
      console.log(`   Erro: ${error.message}`);
    }

    // Testar token com room inválida
    console.log('\n🏠 Testando token com room inválida...');
    const invalidRoomToken = await generateLiveKitToken('test-user', '', {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    try {
      const room = new Room();
      await room.connect(config.LIVEKIT_URL, invalidRoomToken);
      console.log('❌ Token com room inválida foi aceito (ERRO!)');
    } catch (error) {
      console.log('✅ Token com room inválida rejeitado corretamente');
      console.log(`   Erro: ${error.message}`);
    }

    console.log('\n✅ Testes de validação concluídos!');

  } catch (error) {
    console.error('❌ Erro nos testes de validação:', error);
  }
}

async function main() {
  console.log('🧪 Teste Completo de LiveKit\n');
  console.log('=====================================\n');

  const connectionTest = await testLiveKitConnection();
  
  if (connectionTest) {
    await testTokenValidation();
  }

  console.log('\n=====================================');
  console.log(connectionTest ? '✅ Todos os testes passaram!' : '❌ Alguns testes falharam!');
  
  process.exit(connectionTest ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { testLiveKitConnection, testTokenValidation };
