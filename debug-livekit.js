/**
 * Script para debug do LiveKit
 * Execute no console do browser quando estiver na página de consulta online
 */

// Função para testar conexão LiveKit
async function testLiveKitConnection() {
    console.log('🧪 Iniciando teste LiveKit...');
    
    // 1. Verificar parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    const roomName = urlParams.get('roomName');
    const token = urlParams.get('token');
    const livekitUrl = urlParams.get('livekitUrl');
    
    console.log('📋 Parâmetros da URL:');
    console.log('  sessionId:', sessionId);
    console.log('  roomName:', roomName);
    console.log('  token:', token ? `${token.substring(0, 50)}...` : 'NÃO ENCONTRADO');
    console.log('  livekitUrl:', livekitUrl);
    
    if (!token || !livekitUrl || !roomName) {
        console.error('❌ Parâmetros insuficientes para teste');
        return false;
    }
    
    // 2. Testar decodificação do token
    try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        const now = Math.floor(Date.now() / 1000);
        
        console.log('🔑 Token JWT:');
        console.log('  Identity:', payload.sub);
        console.log('  Room:', payload.video?.room);
        console.log('  Expira em:', payload.exp - now, 'segundos');
        console.log('  Can Publish:', payload.video?.roomJoin);
        
        if (payload.exp < now) {
            console.error('❌ Token expirado!');
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao decodificar token:', error);
        return false;
    }
    
    // 3. Testar conexão com LiveKit
    try {
        console.log('🌐 Testando conexão com LiveKit...');
        
        // Usar LiveKit se disponível
        if (typeof livekit !== 'undefined' && livekit.Room) {
            const { Room } = livekit;
            const room = new Room();
            
            const timeout = setTimeout(() => {
                console.error('⏰ Timeout: Conexão não estabelecida em 10 segundos');
                room.disconnect();
            }, 10000);
            
            room.on('connected', () => {
                clearTimeout(timeout);
                console.log('✅ Conectado ao LiveKit!');
                console.log('  Room:', room.name);
                console.log('  Participants:', room.remoteParticipants.size);
                
                // Desconectar após teste
                setTimeout(() => room.disconnect(), 2000);
            });
            
            room.on('disconnected', (reason) => {
                console.log('❌ Desconectado:', reason);
            });
            
            await room.connect(livekitUrl, token);
            return true;
            
        } else {
            console.log('⚠️ LiveKit não carregado, testando apenas conectividade...');
            
            // Teste básico de conectividade
            const wsUrl = livekitUrl.replace('wss://', 'https://').replace('/ws', '');
            const response = await fetch(wsUrl, { method: 'HEAD' });
            console.log('📡 Teste de conectividade:', response.status);
            return response.ok;
        }
        
    } catch (error) {
        console.error('❌ Erro na conexão:', error);
        return false;
    }
}

// Função para testar gateway
async function testGateway() {
    console.log('🔍 Testando gateway...');
    
    try {
        const response = await fetch('https://medcall-gateway-416450784258.southamerica-east1.run.app/api/health');
        const data = await response.json();
        
        console.log('✅ Gateway:', data);
        return true;
    } catch (error) {
        console.error('❌ Gateway error:', error);
        return false;
    }
}

// Função para criar sessão de teste
async function createTestSession() {
    console.log('🔧 Criando sessão de teste...');
    
    try {
        const response = await fetch('https://medcall-gateway-416450784258.southamerica-east1.run.app/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                consultation_id: 'debug-test-' + Date.now(),
                session_type: 'online',
                participants: {
                    doctor: {
                        id: 'doctor-debug',
                        name: 'Dr. Debug',
                        email: 'debug@test.com'
                    },
                    patient: {
                        id: 'patient-debug',
                        name: 'Paciente Debug',
                        email: 'patient@test.com'
                    }
                },
                consent: true,
                metadata: {
                    appointmentType: 'online'
                }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Sessão criada:', data);
            return data;
        } else {
            const error = await response.json();
            console.error('❌ Erro na sessão:', error);
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao criar sessão:', error);
        return null;
    }
}

// Função principal de debug
async function debugLiveKit() {
    console.log('🚀 Iniciando debug completo do LiveKit...');
    console.log('=====================================');
    
    // 1. Testar gateway
    await testGateway();
    console.log('');
    
    // 2. Testar sessão atual (se estiver em uma página de consulta)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
        console.log('📱 Testando sessão atual...');
        await testLiveKitConnection();
    } else {
        console.log('🔧 Criando sessão de teste...');
        const sessionData = await createTestSession();
        if (sessionData) {
            console.log('📱 Testando sessão criada...');
            // Simular parâmetros para teste
            const originalParams = {
                token: sessionData.tokens.doctor,
                livekitUrl: sessionData.livekit.url,
                roomName: sessionData.session.roomName,
                sessionId: sessionData.session.id
            };
            
            // Temporariamente sobrescrever parâmetros para teste
            const originalUrl = window.location.href;
            const testUrl = `${window.location.origin}${window.location.pathname}?token=${originalParams.token}&livekitUrl=${encodeURIComponent(originalParams.livekitUrl)}&roomName=${originalParams.roomName}&sessionId=${originalParams.sessionId}`;
            
            console.log('🔗 URL de teste:', testUrl);
            console.log('💡 Copie esta URL e abra em uma nova aba para testar');
        }
    }
    
    console.log('=====================================');
    console.log('✅ Debug concluído!');
}

// Executar automaticamente se estiver na página de consulta
if (window.location.pathname.includes('/consulta/online')) {
    console.log('🔧 Debug LiveKit disponível!');
    console.log('Execute: debugLiveKit()');
}

// Exportar funções globalmente
window.debugLiveKit = debugLiveKit;
window.testLiveKitConnection = testLiveKitConnection;
window.testGateway = testGateway;
window.createTestSession = createTestSession;
