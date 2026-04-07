'use client';

import { useState, useEffect, useRef } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import {
  Smartphone,
  Wifi,
  WifiOff,
  Loader2,
  LogOut,
  Info,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import './conexao.css';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export default function ConexaoPage() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar status inicial
  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Polling enquanto está em "connecting" para detectar quando conectou
  useEffect(() => {
    if (status === 'connecting') {
      pollingRef.current = setInterval(fetchStatus, 5000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [status]);

  const fetchStatus = async () => {
    try {
      const response = await gatewayClient.get('/conexao/status');

      if (response.success) {
        const newStatus = response.status as ConnectionStatus;
        setStatus(newStatus);
        setInstanceName(response.conexao?.instancia_nome || null);

        if (newStatus === 'connecting' && response.conexao?.instancia_qrcode) {
          setQrCode(response.conexao.instancia_qrcode);
        } else if (newStatus !== 'connecting') {
          setQrCode(null);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await gatewayClient.post('/conexao/connect');

      if (response.success) {
        setStatus('connecting');
        setInstanceName(response.instanceName);
        if (response.qrcode) {
          setQrCode(response.qrcode);
        }
      } else {
        setError(response.error || 'Erro ao conectar');
      }
    } catch (err) {
      console.error('Erro ao conectar:', err);
      setError('Erro ao conectar com o servidor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await gatewayClient.post('/conexao/disconnect');

      if (response.success) {
        setStatus('disconnected');
        setQrCode(null);
        setInstanceName(null);
      } else {
        setError(response.error || 'Erro ao desconectar');
      }
    } catch (err) {
      console.error('Erro ao desconectar:', err);
      setError('Erro ao desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="conexao-container">
        <div className="conexao-header">
          <h1 className="conexao-title">Conexao WhatsApp</h1>
        </div>
        <div className="conexao-card">
          <div className="conexao-loading">
            <Loader2 size={32} className="conexao-loading-spinner" />
            <p>Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conexao-container">
      <div className="conexao-header">
        <h1 className="conexao-title">Conexao WhatsApp</h1>
        <p className="conexao-subtitle">
          Conecte seu WhatsApp para enviar mensagens diretamente pelo seu numero
        </p>
      </div>

      <div className="conexao-card">
        {/* Status Banner */}
        <div className={`conexao-status ${status}`}>
          <div className="conexao-status-icon">
            {status === 'disconnected' && <WifiOff size={22} />}
            {status === 'connecting' && <Loader2 size={22} className="animate-spin" />}
            {status === 'connected' && <Wifi size={22} />}
          </div>
          <div className="conexao-status-info">
            <h3 className="conexao-status-title">
              {status === 'disconnected' && 'Desconectado'}
              {status === 'connecting' && 'Aguardando conexao...'}
              {status === 'connected' && 'Conectado'}
            </h3>
            <p className="conexao-status-text">
              {status === 'disconnected' && 'Nenhum WhatsApp conectado'}
              {status === 'connecting' && 'Escaneie o QR Code para conectar'}
              {status === 'connected' && 'Pronto para enviar mensagens'}
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="conexao-card-body">
          {error && (
            <div className="conexao-error">
              <WifiOff size={16} />
              {error}
            </div>
          )}

          <h2 className="conexao-section-title">
            <MessageSquare size={20} />
            WhatsApp Profissional
          </h2>

          <p className="conexao-description">
            Ao conectar seu número, as notificações de consulta (lembretes, confirmações e mensagens ao paciente)
            serão enviadas pelo seu próprio WhatsApp, dando mais confiança e proximidade ao paciente.
          </p>

          {/* Desconectado */}
          {status === 'disconnected' && (
            <button
              className="btn-connect"
              onClick={handleConnect}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Conectando...</>
              ) : (
                <><Smartphone size={18} /> Conectar WhatsApp</>
              )}
            </button>
          )}

          {/* Conectando (QR Code) */}
          {status === 'connecting' && (
            <div className="qrcode-container">
              <div className="qrcode-box">
                {qrCode ? (
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                  />
                ) : (
                  <div className="qrcode-placeholder">
                    <div className="qrcode-spinner" />
                    <span>Gerando QR Code...</span>
                  </div>
                )}
              </div>

              <div className="qrcode-instructions">
                <h4>Como conectar:</h4>
                <ol>
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Menu</strong> ou <strong>Configuracoes</strong></li>
                  <li>Toque em <strong>Dispositivos conectados</strong></li>
                  <li>Toque em <strong>Conectar um dispositivo</strong></li>
                  <li>Aponte a camera para o QR Code acima</li>
                </ol>
              </div>
            </div>
          )}

          {/* Conectado */}
          {status === 'connected' && (
            <>
              <div className="connected-info">
                <div className="connected-avatar">
                  <CheckCircle2 size={24} />
                </div>
                <div className="connected-details">
                  <h4 className="connected-name">{instanceName || 'WhatsApp'}</h4>
                  <p className="connected-phone">Instancia ativa e pronta para envio</p>
                </div>
              </div>

              <div className="conexao-actions">
                <button
                  className="btn-disconnect"
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> Desconectando...</>
                  ) : (
                    <><LogOut size={16} /> Desconectar</>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Info box */}
          <div className="conexao-info-box">
            <Info size={18} className="info-icon" />
            <p>
              As mensagens enviadas incluem lembretes de consulta,
              confirmacoes de agendamento e orientacoes ao paciente.
              Seus dados e conversas pessoais nao sao acessados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
