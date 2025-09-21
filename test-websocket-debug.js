/**
 * Script de debug específico para testar WebSocket LiveKit
 * Execute no console da página de consulta online
 */

// Função para testar WebSocket diretamente
async function testWebSocketDirect() {
    console.log('🔍 === TESTE WEBSOCKET DIRETO ===');
    
    // Extrair parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const livekitUrl = urlParams.get('livekitUrl');
    
    console.log('📋 Parâmetros:');
    console.log('  Token:', token ? `${token.substring(0, 30)}...` : 'NÃO ENCONTRADO');
    console.log('  LiveKit URL:', livekitUrl);
    
    if (!token || !livekitUrl) {
        console.error('❌ Parâmetros insuficientes');
        return;
    }
    
    // Teste 1: WebSocket direto
    console.log('🔌 Teste 1: WebSocket direto...');
    try {
        const ws = new WebSocket(livekitUrl);
        
        ws.onopen = () => {
            console.log('✅ WebSocket conectado diretamente!');
            ws.close();
        };
        
        ws.onerror = (error) => {
            console.error('❌ Erro WebSocket:', error);
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 WebSocket fechado: ${event.code} - ${event.reason}`);
        };
        
        // Timeout
        setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                console.log('⏰ WebSocket timeout após 5s');
                ws.close();
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Erro ao criar WebSocket:', error);
    }
    
    // Teste 2: LiveKit Client
    console.log('🎥 Teste 2: LiveKit Client...');
    if (typeof livekit !== 'undefined' && livekit.Room) {
        try {
            const { Room } = livekit;
            const room = new Room();
            
            room.on('connected', () => {
                console.log('✅ LiveKit Client conectado!');
                console.log('  Room:', room.name);
                console.log('  State:', room.state);
                room.disconnect();
            });
            
            room.on('disconnected', (reason) => {
                console.log('❌ LiveKit desconectado:', reason);
            });
            
            room.on('error', (error) => {
                console.error('❌ Erro LiveKit:', error);
            });
            
            console.log('🔄 Tentando conectar...');
            await room.connect(livekitUrl, token);
            
        } catch (error) {
            console.error('❌ Erro no LiveKit Client:', error);
        }
    } else {
        console.error('❌ LiveKit Client não carregado');
    }
}

// Função para verificar problemas de rede
async function checkNetworkIssues() {
    console.log('🌐 === VERIFICAÇÃO DE REDE ===');
    
    const urlParams = new URLSearchParams(window.location.search);
    const livekitUrl = urlParams.get('livekitUrl');
    
    if (!livekitUrl) {
        console.error('❌ LiveKit URL não encontrada');
        return;
    }
    
    // Teste de conectividade HTTP
    const httpUrl = livekitUrl.replace('wss://', 'https://');
    console.log('📡 Testando:', httpUrl);
    
    try {
        const response = await fetch(httpUrl, { 
            method: 'HEAD',
            mode: 'no-cors'
        });
        console.log('✅ HTTP conectividade OK');
    } catch (error) {
        console.error('❌ Problema HTTP:', error);
    }
    
    // Verificar se há proxy/firewall
    console.log('🔍 Verificando configurações de rede...');
    console.log('  User Agent:', navigator.userAgent);
    console.log('  Protocolo:', window.location.protocol);
    console.log('  Host:', window.location.host);
    
    // Teste de WebSocket básico
    console.log('🧪 Teste WebSocket básico...');
    try {
        const testWs = new WebSocket('wss://echo.websocket.org');
        testWs.onopen = () => {
            console.log('✅ WebSocket básico funciona');
            testWs.close();
        };
        testWs.onerror = () => {
            console.error('❌ WebSocket básico falhou - possível problema de firewall');
        };
    } catch (error) {
        console.error('❌ Erro no teste WebSocket:', error);
    }
}

// Função para simular o problema exato
async function simulateExactProblem() {
    console.log('🎬 === SIMULAÇÃO DO PROBLEMA EXATO ===');
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const livekitUrl = urlParams.get('livekitUrl');
    
    if (!token || !livekitUrl) {
        console.error('❌ Parâmetros insuficientes');
        return;
    }
    
    console.log('🔄 Simulando conexão exata do componente...');
    
    try {
        const { Room } = livekit;
        const room = new Room();
        
        // Adicionar todos os listeners
        room.on('connecting', () => console.log('🔄 Conectando...'));
        room.on('connected', () => {
            console.log('✅ Conectado!');
            setTimeout(() => room.disconnect(), 3000);
        });
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
        console.log('💡 Possíveis causas:');
        console.log('  - Firewall bloqueando WebSocket');
        console.log('  - Proxy corporativo');
        console.log('  - Problema de DNS');
        console.log('  - Token inválido/expirado');
        console.log('  - Servidor LiveKit sobrecarregado');
    }
}

// Exportar funções
window.testWebSocketDirect = testWebSocketDirect;
window.checkNetworkIssues = checkNetworkIssues;
window.simulateExactProblem = simulateExactProblem;

// Auto-executar se estiver na página de consulta
if (window.location.pathname.includes('/consulta/online')) {
    console.log('🔧 Debug WebSocket disponível!');
    console.log('Execute: testWebSocketDirect()');
    console.log('Execute: checkNetworkIssues()');
    console.log('Execute: simulateExactProblem()');
}
