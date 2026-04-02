'use client';

import React, { useState } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { UserCheck, Loader2, CheckCircle, AlertCircle, Users, User, Mail, MessageSquare } from 'lucide-react';

type LogEntry = {
  nome: string;
  email: string;
  telefone: string;
  success: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  whatsappError?: string;
  error?: string;
};

export default function LiberacaoMedicosPage() {
  const [tab, setTab] = useState<'individual' | 'massa'>('individual');

  // Individual
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Massa
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkLogs, setBulkLogs] = useState<LogEntry[]>([]);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; successCount: number; failCount: number } | null>(null);

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLogs([]);

    try {
      const response = await gatewayClient.post('/liberacao-medicos/liberar', {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
      });

      if (response.success) {
        setLogs([{
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          success: true,
          emailSent: response.emailSent,
          whatsappSent: response.whatsappSent,
          whatsappError: response.whatsappError,
        }]);
        setNome('');
        setEmail('');
        setTelefone('');
      } else {
        setLogs([{
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          success: false,
          emailSent: false,
          whatsappSent: false,
          error: response.error || 'Erro ao liberar conta',
        }]);
      }
    } catch {
      setLogs([{
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        success: false,
        emailSent: false,
        whatsappSent: false,
        error: 'Erro de conexão com o servidor',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const parseBulkText = (text: string): Array<{ nome: string; email: string; telefone: string }> => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    return lines.map(line => {
      const parts = line.trim().split(/\t+/);

      if (parts.length >= 3) {
        // Tab-separated: Nome\tEmail\tTelefone
        return {
          nome: parts[0].trim(),
          email: parts[1].trim(),
          telefone: parts[2].trim(),
        };
      }

      // Sem TAB detectado — linha inválida
      return { nome: '', email: '', telefone: '' };
    }).filter(m => m.nome && m.email && m.telefone);
  };

  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkLoading(true);
    setBulkLogs([]);
    setBulkSummary(null);

    const medicos = parseBulkText(bulkText);

    if (medicos.length === 0) {
      setBulkLogs([{
        nome: '—',
        email: '—',
        telefone: '—',
        success: false,
        emailSent: false,
        whatsappSent: false,
        error: 'Nenhum registro válido encontrado. Use o formato: Nome [TAB] Email [TAB] Telefone',
      }]);
      setBulkLoading(false);
      return;
    }

    try {
      const response = await gatewayClient.post('/liberacao-medicos/liberar-massa', { medicos });

      if (response.success && response.results) {
        setBulkLogs(response.results);
        setBulkSummary({
          total: response.total,
          successCount: response.successCount,
          failCount: response.failCount,
        });
      } else {
        setBulkLogs([{
          nome: '—',
          email: '—',
          telefone: '—',
          success: false,
          emailSent: false,
          whatsappSent: false,
          error: response.error || 'Erro ao processar liberação em massa',
        }]);
      }
    } catch {
      setBulkLogs([{
        nome: '—',
        email: '—',
        telefone: '—',
        success: false,
        emailSent: false,
        whatsappSent: false,
        error: 'Erro de conexão com o servidor',
      }]);
    } finally {
      setBulkLoading(false);
    }
  };

  const renderLogEntry = (log: LogEntry, index: number) => (
    <div
      key={index}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        background: log.success ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${log.success ? '#bbf7d0' : '#fecaca'}`,
        fontSize: '13px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {log.success ? (
          <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />
        ) : (
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
        )}
        <strong style={{ color: log.success ? '#166534' : '#991b1b' }}>
          {log.nome}
        </strong>
        <span style={{ color: '#6b7280' }}>({log.email})</span>
      </div>

      {log.error && (
        <div style={{ color: '#991b1b', paddingLeft: '24px' }}>
          Erro: {log.error}
        </div>
      )}

      {log.success && (
        <div style={{ display: 'flex', gap: '16px', paddingLeft: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Mail size={14} color={log.emailSent ? '#16a34a' : '#dc2626'} />
            <span style={{ color: log.emailSent ? '#166534' : '#991b1b' }}>
              Email: {log.emailSent ? 'Enviado' : 'Não enviado'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MessageSquare size={14} color={log.whatsappSent ? '#16a34a' : '#dc2626'} />
            <span style={{ color: log.whatsappSent ? '#166534' : '#991b1b' }}>
              WhatsApp: {log.whatsappSent ? 'Enviado' : `Não enviado${log.whatsappError ? ` (${log.whatsappError})` : ''}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
  };

  return (
    <div style={{ padding: '32px', minHeight: '60vh', background: '#EBF3F6' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <UserCheck size={28} color="#1B4266" />
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
            Liberação de Conta
          </h1>
        </div>

        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          Libere o acesso para médicos que adquiriram fora do processo automatizado.
          Uma conta será criada com senha temporária e as credenciais serão enviadas por email e WhatsApp.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          <button
            onClick={() => setTab('individual')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: tab === 'individual' ? '#1B4266' : 'white',
              color: tab === 'individual' ? 'white' : '#6b7280',
              border: tab === 'individual' ? 'none' : '1px solid #d1d5db',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <User size={16} />
            Individual
          </button>
          <button
            onClick={() => setTab('massa')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: tab === 'massa' ? '#1B4266' : 'white',
              color: tab === 'massa' ? 'white' : '#6b7280',
              border: tab === 'massa' ? 'none' : '1px solid #d1d5db',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Users size={16} />
            Em Massa
          </button>
        </div>

        {/* Individual Tab */}
        {tab === 'individual' && (
          <form onSubmit={handleSubmitIndividual} style={{
            background: 'white',
            borderRadius: '0 12px 12px 12px',
            padding: '28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            <div>
              <label style={labelStyle}>Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Dr. João Silva"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="joao@email.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Telefone (com DDD)</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
                placeholder="(11) 99999-9999"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1B4266 0%, #153350 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UserCheck size={18} />
                  Liberar Conta
                </>
              )}
            </button>

            {logs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.map(renderLogEntry)}
              </div>
            )}
          </form>
        )}

        {/* Bulk Tab */}
        {tab === 'massa' && (
          <form onSubmit={handleSubmitBulk} style={{
            background: 'white',
            borderRadius: '0 12px 12px 12px',
            padding: '28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            <div>
              <label style={labelStyle}>
                Cole os dados dos médicos (um por linha)
              </label>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 8px 0' }}>
                Formato: Nome [TAB] Email [TAB] Telefone — Cole diretamente de uma planilha
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                required
                placeholder={`Dr. João Silva\tjoao@email.com\t11999999999\nDra. Maria Santos\tmaria@email.com\t21988888888`}
                rows={8}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
              />
            </div>

            {bulkText.trim() && (
              <div style={{
                padding: '10px 14px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#0369a1',
              }}>
                {parseBulkText(bulkText).length} registro(s) detectado(s)
              </div>
            )}

            <button
              type="submit"
              disabled={bulkLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                background: bulkLoading ? '#93c5fd' : 'linear-gradient(135deg, #1B4266 0%, #153350 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: bulkLoading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {bulkLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Users size={18} />
                  Liberar Todos
                </>
              )}
            </button>

            {bulkSummary && (
              <div style={{
                padding: '14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <span>Total: {bulkSummary.total}</span>
                <span style={{ color: '#16a34a' }}>Liberados: {bulkSummary.successCount}</span>
                {bulkSummary.failCount > 0 && (
                  <span style={{ color: '#dc2626' }}>Com erro: {bulkSummary.failCount}</span>
                )}
              </div>
            )}

            {bulkLogs.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {bulkLogs.map(renderLogEntry)}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
