/**
 * Utilitário para debug e teste de conexão LiveKit no frontend
 * Use este script no console do browser para diagnosticar problemas
 */

import { Room, RoomEvent, RemoteParticipant, Track } from 'livekit-client';

export interface LiveKitDebugResult {
  success: boolean;
  error?: string;
  details: {
    tokenValid?: boolean;
    connectionEstablished?: boolean;
    mediaPermissions?: boolean;
    roomInfo?: any;
    tokenInfo?: any;
  };
}

export class LiveKitDebugger {
  private room: Room | null = null;
  private results: LiveKitDebugResult = {
    success: false,
    details: {}
  };

  /**
   * Testa conexão completa com LiveKit
   */
  async testConnection(
    serverUrl: string, 
    token: string, 
    roomName?: string
  ): Promise<LiveKitDebugResult> {
    console.log('🔍 Iniciando debug LiveKit...');
    console.log(`   Server URL: ${serverUrl}`);
    console.log(`   Token length: ${token.length}`);
    console.log(`   Room: ${roomName || 'N/A'}`);

    try {
      // 1. Validar token JWT
      await this.validateToken(token);
      
      // 2. Testar conexão com sala
      await this.testRoomConnection(serverUrl, token);
      
      // 3. Testar permissões de mídia
      await this.testMediaPermissions();
      
      this.results.success = true;
      console.log('✅ Todos os testes passaram!');
      
    } catch (error) {
      this.results.error = error.message;
      console.error('❌ Erro no debug:', error);
    }

    return this.results;
  }

  /**
   * Valida token JWT
   */
  private async validateToken(token: string): Promise<void> {
    console.log('🔑 Validando token JWT...');
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token JWT inválido - formato incorreto');
      }

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // Verificar expiração
      if (payload.exp && payload.exp < now) {
        throw new Error(`Token expirado há ${now - payload.exp} segundos`);
      }

      // Verificar campos obrigatórios
      if (!payload.sub) {
        throw new Error('Token sem identity (sub)');
      }

      if (!payload.video?.room) {
        throw new Error('Token sem room definida');
      }

      this.results.details.tokenValid = true;
      this.results.details.tokenInfo = {
        identity: payload.sub,
        room: payload.video.room,
        issuedAt: new Date(payload.iat * 1000).toISOString(),
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        timeUntilExpiry: payload.exp - now,
        canPublish: payload.video?.roomJoin || false,
        canSubscribe: payload.video?.roomJoin || false
      };

      console.log('✅ Token JWT válido!');
      console.log(`   Identity: ${payload.sub}`);
      console.log(`   Room: ${payload.video.room}`);
      console.log(`   Expira em: ${payload.exp - now} segundos`);

    } catch (error) {
      this.results.details.tokenValid = false;
      throw new Error(`Validação de token falhou: ${error.message}`);
    }
  }

  /**
   * Testa conexão com a sala
   */
  private async testRoomConnection(serverUrl: string, token: string): Promise<void> {
    console.log('🌐 Testando conexão com sala...');
    
    this.room = new Room();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Conexão não estabelecida em 15 segundos'));
      }, 15000);

      // Configurar listeners
      this.room!.on(RoomEvent.Connected, () => {
        clearTimeout(timeout);
        console.log('✅ Conectado à sala!');
        
        this.results.details.connectionEstablished = true;
        this.results.details.roomInfo = {
          name: this.room!.name,
          participants: this.room!.remoteParticipants.size,
          localParticipant: this.room!.localParticipant?.identity
        };
        
        resolve();
      });

      this.room!.on(RoomEvent.Disconnected, (reason) => {
        clearTimeout(timeout);
        reject(new Error(`Conexão perdida: ${reason}`));
      });

      this.room!.on(RoomEvent.ConnectionQualityChanged, (quality) => {
        console.log(`📊 Qualidade da conexão: ${quality}`);
      });

      // Tentar conectar
      this.room!.connect(serverUrl, token).catch(reject);
    });
  }

  /**
   * Testa permissões de mídia
   */
  private async testMediaPermissions(): Promise<void> {
    console.log('🎤 Testando permissões de mídia...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      this.results.details.mediaPermissions = true;
      
      console.log('✅ Permissões de mídia obtidas!');
      console.log(`   Video tracks: ${stream.getVideoTracks().length}`);
      console.log(`   Audio tracks: ${stream.getAudioTracks().length}`);
      
      // Limpar stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      this.results.details.mediaPermissions = false;
      throw new Error(`Permissões de mídia negadas: ${error.message}`);
    }
  }

  /**
   * Limpa recursos
   */
  async cleanup(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }
}

/**
 * Função utilitária para testar conexão rapidamente
 */
export async function quickLiveKitTest(serverUrl: string, token: string): Promise<void> {
  const debugger = new LiveKitDebugger();
  
  try {
    const result = await debugger.testConnection(serverUrl, token);
    
    console.log('\n📋 Resultado do teste:');
    console.log(`   Sucesso: ${result.success ? '✅' : '❌'}`);
    
    if (result.error) {
      console.log(`   Erro: ${result.error}`);
    }
    
    if (result.details.tokenValid) {
      console.log('   Token: ✅ Válido');
    }
    
    if (result.details.connectionEstablished) {
      console.log('   Conexão: ✅ Estabelecida');
    }
    
    if (result.details.mediaPermissions) {
      console.log('   Mídia: ✅ Permissões OK');
    }
    
  } finally {
    await debugger.cleanup();
  }
}

/**
 * Função para testar com parâmetros da URL atual
 */
export async function testCurrentSession(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  
  const sessionId = urlParams.get('sessionId');
  const roomName = urlParams.get('roomName');
  const token = urlParams.get('token');
  const livekitUrl = urlParams.get('livekitUrl') || process.env.NEXT_PUBLIC_LIVEKIT_URL;
  
  if (!token || !livekitUrl) {
    console.error('❌ Parâmetros insuficientes para teste');
    console.log('Parâmetros encontrados:');
    console.log(`   sessionId: ${sessionId || 'N/A'}`);
    console.log(`   roomName: ${roomName || 'N/A'}`);
    console.log(`   token: ${token ? 'Presente' : 'N/A'}`);
    console.log(`   livekitUrl: ${livekitUrl || 'N/A'}`);
    return;
  }
  
  console.log('🧪 Testando sessão atual...');
  await quickLiveKitTest(livekitUrl, token);
}

// Expor funções globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).testLiveKit = quickLiveKitTest;
  (window as any).testCurrentSession = testCurrentSession;
  (window as any).LiveKitDebugger = LiveKitDebugger;
  
  console.log('🔧 LiveKit Debug disponível!');
  console.log('   testCurrentSession() - Testa sessão atual');
  console.log('   testLiveKit(url, token) - Testa conexão específica');
  console.log('   new LiveKitDebugger() - Debugger avançado');
}
