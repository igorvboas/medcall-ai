/**
 * Script de debug específico para problemas de WebSocket LiveKit
 * Execute no console da página de consulta online
 */

// Função principal de debug WebSocket
async function debugWebSocketIssue() {
    console.log('🔍 === DEBUG WEBSOCKET LIVEKIT ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // 1. Extrair parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const roomName = urlParams.get('roomName');
    const token = urlParams.get('token');
    const livekitUrl = urlParams.get('livekitUrl');
    
    console.log('📋 Parâmetros extraídos:');
    console.log('  sessionId:', sessionId);
    console.log('  roomName:', roomName);
    console.log('  token length:', token?.length);
    console.log('  livekitUrl:', livekitUrl);
    
    // 2. Validar token JWT
    if (token) {
        try {
            const tokenParts = token.split('.');
            const payload = JSON.parse(atob(tokenParts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            console.log('🔑 Token JWT:');
            console.log('  Identity:', payload.sub);
            console.log('  Room:', payload.video?.room);
            console.log('  Can Publish:', payload.video?.canPublish);
            console.log('  Can Subscribe:', payload.video?.canSubscribe);
            console.log('  Issued at:', new Date(payload.iat * 1000));
            console.log('  Expires at:', new Date(payload.exp * 1000));
            console.log('  Is Expired:', payload.exp < now);
            console.log('  Time to expire:', payload.exp - now, 'seconds');
            
            if (payload.exp < now) {
                console.error('❌ TOKEN EXPIRADO!');
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao decodificar token:', error);
            return false;
        }
    } else {
        console.error('❌ Token não encontrado na URL');
        return false;
    }
    
    // 3. Testar conectividade básica
    console.log('🌐 Testando conectividade...');
    try {
        const httpUrl = livekitUrl.replace('wss://', 'https://');
        console.log('Testing HTTP URL:', httpUrl);
        
        // Teste simples de conectividade
        const response = await fetch(httpUrl, { 
            method: 'HEAD',
            mode: 'no-cors'
        });
        console.log('✅ HTTP conectividade OK');
    } catch (error) {
        console.error('❌ Problema de conectividade HTTP:', error);
    }
    
    // 4. Testar WebSocket direto
    console.log('🔌 Testando WebSocket direto...');
    await testWebSocketDirect(livekitUrl);
    
    // 5. Testar LiveKit Client
    console.log('🎥 Testando LiveKit Client...');
    await testLiveKitClientDirect(livekitUrl, token);
    
    console.log('✅ Debug WebSocket concluído!');
    return true;
}

// Função para testar WebSocket direto
async function testWebSocketDirect(wsUrl) {
    return new Promise((resolve) => {
        console.log(`📡 Conectando WebSocket: ${wsUrl}`);
        
        try {
            const ws = new WebSocket(wsUrl);
            let connected = false;
            
            const timeout = setTimeout(() => {
                if (!connected) {
                    console.error('⏰ WebSocket timeout (5s)');
                    resolve(false);
                    ws.close();
                }
            }, 5000);
            
            ws.onopen = () => {
                connected = true;
                clearTimeout(timeout);
                console.log('✅ WebSocket conectado diretamente!');
                ws.close();
                resolve(true);
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error('❌ Erro WebSocket:', error);
                resolve(false);
            };
            
            ws.onclose = (event) => {
                if (connected) {
                    console.log(`🔌 WebSocket fechado: ${event.code} - ${event.reason}`);
                }
                resolve(connected);
            };
            
        } catch (error) {
            console.error('❌ Erro ao criar WebSocket:', error);
            resolve(false);
        }
    });
}

// Função para testar LiveKit Client diretamente
async function testLiveKitClientDirect(wsUrl, token) {
    if (typeof livekit === 'undefined' || !livekit.Room) {
        console.error('❌ LiveKit Client não carregado');
        return false;
    }
    
    try {
        console.log('🎥 Iniciando teste LiveKit Client...');
        const { Room } = livekit;
        const room = new Room();
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.error('⏰ LiveKit Client timeout (10s)');
                room.disconnect();
                resolve(false);
            }, 10000);
            
            room.on('connected', () => {
                clearTimeout(timeout);
                console.log('✅ LiveKit Client conectado!');
                console.log(`  Room: ${room.name}`);
                console.log(`  Participants: ${room.remoteParticipants.size}`);
                console.log(`  Connection State: ${room.state}`);
                
                // Desconectar após teste
                setTimeout(() => {
                    room.disconnect();
                    resolve(true);
                }, 2000);
            });
            
            room.on('disconnected', (reason) => {
                console.log(`❌ LiveKit Client desconectado: ${reason}`);
                resolve(false);
            });
            
            room.on('connectionQualityChanged', (quality) => {
                console.log(`📊 Qualidade de conexão: ${quality}`);
            });
            
            room.on('trackSubscribed', (track, publication, participant) => {
                console.log(`🎵 Track subscribed: ${track.kind} from ${participant.identity}`);
            });
            
            room.on('trackUnsubscribed', (track, publication, participant) => {
                console.log(`🔇 Track unsubscribed: ${track.kind} from ${participant.identity}`);
            });
            
            room.on('participantConnected', (participant) => {
                console.log(`👤 Participante conectado: ${participant.identity}`);
            });
            
            room.on('participantDisconnected', (participant) => {
                console.log(`👋 Participante desconectado: ${participant.identity}`);
            });
            
            // Conectar
            room.connect(wsUrl, token).catch(error => {
                clearTimeout(timeout);
                console.error('❌ Erro na conexão LiveKit:', error);
                resolve(false);
            });
        });
        
    } catch (error) {
        console.error('❌ Erro no teste LiveKit Client:', error);
        return false;
    }
}

// Função para diagnosticar problemas específicos
function diagnoseConnectionIssue() {
    console.log('🔧 === DIAGNÓSTICO DE PROBLEMAS ===');
    
    // Verificar se estamos na página correta
    if (!window.location.pathname.includes('/consulta/online')) {
        console.error('❌ Não está na página de consulta online');
        return;
    }
    
    // Verificar se LiveKit está carregado
    if (typeof livekit === 'undefined') {
        console.error('❌ LiveKit Client não está carregado');
        console.log('💡 Verifique se o script do LiveKit está sendo carregado');
        return;
    }
    
    // Verificar variáveis de ambiente
    console.log('🔍 Variáveis de ambiente:');
    console.log('  NEXT_PUBLIC_LIVEKIT_URL:', process.env.NEXT_PUBLIC_LIVEKIT_URL);
    
    // Verificar se há elementos LiveKit na página
    const livekitElements = document.querySelectorAll('[data-lk-theme]');
    console.log(`🎥 Elementos LiveKit encontrados: ${livekitElements.length}`);
    
    // Verificar conexões WebSocket ativas
    console.log('🔌 Verificando conexões WebSocket...');
    // Nota: Não é possível listar conexões WebSocket ativas via JavaScript
    
    console.log('✅ Diagnóstico concluído');
}

// Função para simular o problema
async function simulateConnectionIssue() {
    console.log('🧪 === SIMULAÇÃO DO PROBLEMA ===');
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const livekitUrl = urlParams.get('livekitUrl');
    
    if (!token || !livekitUrl) {
        console.error('❌ Parâmetros insuficientes para simulação');
        return;
    }
    
    console.log('🎬 Simulando conexão LiveKit...');
    
    try {
        const { Room } = livekit;
        const room = new Room();
        
        // Adicionar todos os listeners para debug
        room.on('connecting', () => console.log('🔄 Conectando...'));
        room.on('connected', () => console.log('✅ Conectado!'));
        room.on('reconnecting', () => console.log('🔄 Reconectando...'));
        room.on('reconnected', () => console.log('✅ Reconectado!'));
        room.on('disconnected', (reason) => console.log('❌ Desconectado:', reason));
        room.on('error', (error) => console.error('❌ Erro:', error));
        
        // Tentar conectar com timeout
        const connectionPromise = room.connect(livekitUrl, token);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout 30s')), 30000)
        );
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
    } catch (error) {
        console.error('❌ Erro na simulação:', error);
        
        // Diagnóstico adicional
        console.log('🔍 Diagnóstico adicional:');
        console.log('  - Verifique sua conexão de internet');
        console.log('  - Verifique se há firewall bloqueando WebSocket');
        console.log('  - Teste em uma aba anônima');
        console.log('  - Verifique se o token não expirou');
    }
}

// Exportar funções globalmente
window.debugWebSocketIssue = debugWebSocketIssue;
window.testWebSocketDirect = testWebSocketDirect;
window.testLiveKitClientDirect = testLiveKitClientDirect;
window.diagnoseConnectionIssue = diagnoseConnectionIssue;
window.simulateConnectionIssue = simulateConnectionIssue;

// Auto-executar se estiver na página de consulta
if (window.location.pathname.includes('/consulta/online')) {
    console.log('🔧 Debug WebSocket disponível!');
    console.log('Execute: debugWebSocketIssue()');
    console.log('Ou: simulateConnectionIssue()');
}
