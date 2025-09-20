/**
 * Página de teste para diagnóstico LiveKit
 * Acesse: /test-livekit
 */

'use client';

import { useState, useEffect } from 'react';
import { LiveKitDebugger, quickLiveKitTest } from '@/utils/livekit-debug';

export default function TestLiveKitPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [testParams, setTestParams] = useState({
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
    token: '',
    roomName: 'test-room-' + Date.now()
  });

  const runTest = async () => {
    if (!testParams.serverUrl || !testParams.token) {
      alert('Por favor, preencha a URL do servidor e o token');
      return;
    }

    setIsRunning(true);
    setTestResults(null);

    try {
      const result = await quickLiveKitTest(testParams.serverUrl, testParams.token);
      setTestResults({ success: true, message: 'Teste concluído com sucesso' });
    } catch (error) {
      setTestResults({ 
        success: false, 
        error: error.message,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testCurrentSession = async () => {
    setIsRunning(true);
    setTestResults(null);

    try {
      // Simular teste da sessão atual
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('sessionId');
      const roomName = urlParams.get('roomName');
      const token = urlParams.get('token');
      const livekitUrl = urlParams.get('livekitUrl') || process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!token || !livekitUrl) {
        throw new Error('Parâmetros insuficientes na URL atual');
      }

      setTestParams(prev => ({
        ...prev,
        serverUrl: livekitUrl,
        token: token,
        roomName: roomName || prev.roomName
      }));

      await quickLiveKitTest(livekitUrl, token);
      setTestResults({ success: true, message: 'Sessão atual testada com sucesso' });
    } catch (error) {
      setTestResults({ 
        success: false, 
        error: error.message,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const generateTestToken = async () => {
    try {
      setIsRunning(true);
      
      // Chamar API do gateway para gerar token de teste
      const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/api/test/livekit/token`);
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTestParams(prev => ({
          ...prev,
          token: data.data.token.replace('...', ''), // Remove o truncamento
          roomName: data.data.room
        }));
        
        setTestResults({ 
          success: true, 
          message: 'Token gerado com sucesso',
          details: data.data
        });
      } else {
        throw new Error(data.error || 'Falha na geração do token');
      }
    } catch (error) {
      setTestResults({ 
        success: false, 
        error: error.message,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testGatewayHealth = async () => {
    try {
      setIsRunning(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/api/test/livekit/health`);
      const data = await response.json();
      
      setTestResults({
        success: data.success,
        message: data.message,
        details: data.data
      });
    } catch (error) {
      setTestResults({ 
        success: false, 
        error: error.message,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const testGatewaySession = async () => {
    try {
      setIsRunning(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/api/test/livekit/session`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestParams(prev => ({
          ...prev,
          serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
          token: data.data.token.token || '',
          roomName: data.data.session.room
        }));
      }
      
      setTestResults({
        success: data.success,
        message: data.message,
        details: data.data
      });
    } catch (error) {
      setTestResults({ 
        success: false, 
        error: error.message,
        details: error
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1>🧪 Teste LiveKit</h1>
      <p>Página para diagnosticar problemas de conexão com LiveKit</p>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Configurações de Teste</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Server URL:
          </label>
          <input
            type="text"
            value={testParams.serverUrl}
            onChange={(e) => setTestParams(prev => ({ ...prev, serverUrl: e.target.value }))}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="wss://seu-servidor.livekit.cloud"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Token:
          </label>
          <textarea
            value={testParams.token}
            onChange={(e) => setTestParams(prev => ({ ...prev, token: e.target.value }))}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              border: '1px solid #ccc',
              borderRadius: '4px',
              height: '100px',
              fontFamily: 'monospace'
            }}
            placeholder="Cole seu token JWT aqui..."
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Room Name:
          </label>
          <input
            type="text"
            value={testParams.roomName}
            onChange={(e) => setTestParams(prev => ({ ...prev, roomName: e.target.value }))}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Nome da sala"
          />
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Testes Disponíveis</h2>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            onClick={runTest}
            disabled={isRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? 'Testando...' : 'Testar Conexão'}
          </button>

          <button
            onClick={testCurrentSession}
            disabled={isRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? 'Testando...' : 'Testar Sessão Atual'}
          </button>

          <button
            onClick={generateTestToken}
            disabled={isRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? 'Gerando...' : 'Gerar Token de Teste'}
          </button>

          <button
            onClick={testGatewayHealth}
            disabled={isRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? 'Verificando...' : 'Verificar Gateway'}
          </button>

          <button
            onClick={testGatewaySession}
            disabled={isRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? 'Testando...' : 'Testar Sessão Gateway'}
          </button>
        </div>
      </div>

      {testResults && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Resultados</h2>
          <div style={{
            padding: '1rem',
            border: `2px solid ${testResults.success ? '#28a745' : '#dc3545'}`,
            borderRadius: '4px',
            backgroundColor: testResults.success ? '#d4edda' : '#f8d7da',
            color: testResults.success ? '#155724' : '#721c24'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>
              {testResults.success ? '✅ Sucesso' : '❌ Erro'}
            </h3>
            <p style={{ margin: '0 0 1rem 0' }}>
              {testResults.message || testResults.error}
            </p>
            
            {testResults.details && (
              <details>
                <summary>Detalhes</summary>
                <pre style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.875rem'
                }}>
                  {JSON.stringify(testResults.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      <div>
        <h2>Informações do Ambiente</h2>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          <p><strong>Gateway URL:</strong> {process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}</p>
          <p><strong>LiveKit URL:</strong> {process.env.NEXT_PUBLIC_LIVEKIT_URL || 'Não configurado'}</p>
          <p><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
          <p><strong>URL Atual:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
        </div>
      </div>

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#6c757d' }}>
        <h3>Como usar:</h3>
        <ol>
          <li>Use "Verificar Gateway" para testar se o gateway está funcionando</li>
          <li>Use "Gerar Token de Teste" para criar um token válido</li>
          <li>Use "Testar Conexão" para verificar se consegue conectar ao LiveKit</li>
          <li>Use "Testar Sessão Atual" se você está em uma página de consulta</li>
        </ol>
      </div>
    </div>
  );
}
