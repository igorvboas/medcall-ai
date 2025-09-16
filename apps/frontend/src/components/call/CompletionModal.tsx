'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Brain, FileText, CheckCircle, ArrowRight, Calendar, User } from 'lucide-react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationData: {
    sessionId: string;
    consultationId: string;
    patientName: string;
    durationSeconds: number;
    suggestions: {
      total: number;
      used: number;
    };
    utterances: any[];
    usedSuggestions: any[];
  };
  onRedirectToConsultations: () => void;
}

export function CompletionModal({
  isOpen,
  onClose,
  consultationData,
  onRedirectToConsultations
}: CompletionModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRedirect = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      onRedirectToConsultations();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="completion-modal-overlay">
      <div className="completion-modal">
        <div className="completion-modal-header">
          <div className="completion-success-icon">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2>Consulta Finalizada com Sucesso!</h2>
          <button
            onClick={onClose}
            className="completion-modal-close"
            disabled={isRedirecting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="completion-modal-content">
          {/* Resumo Principal */}
          <div className="completion-summary">
            <div className="summary-item">
              <User className="w-5 h-5 text-blue-500" />
              <div>
                <span className="summary-label">Paciente</span>
                <span className="summary-value">{consultationData.patientName}</span>
              </div>
            </div>

            <div className="summary-item">
              <Clock className="w-5 h-5 text-green-500" />
              <div>
                <span className="summary-label">Duração</span>
                <span className="summary-value">{formatDuration(consultationData.durationSeconds)}</span>
              </div>
            </div>

            <div className="summary-item">
              <Calendar className="w-5 h-5 text-purple-500" />
              <div>
                <span className="summary-label">Finalizada em</span>
                <span className="summary-value">{formatDate(new Date())}</span>
              </div>
            </div>
          </div>

          {/* Estatísticas da IA */}
          <div className="completion-stats">
            <h3>
              <Brain className="w-5 h-5" />
              Estatísticas da IA
            </h3>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{consultationData.utterances.length}</div>
                <div className="stat-label">Falas Registradas</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">{consultationData.suggestions.total}</div>
                <div className="stat-label">Sugestões Geradas</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">{consultationData.suggestions.used}</div>
                <div className="stat-label">Sugestões Utilizadas</div>
              </div>
              
              <div className="stat-card">
                <div className="stat-number">
                  {consultationData.suggestions.total > 0 
                    ? Math.round((consultationData.suggestions.used / consultationData.suggestions.total) * 100)
                    : 0}%
                </div>
                <div className="stat-label">Taxa de Uso</div>
              </div>
            </div>
          </div>

          {/* Sugestões Utilizadas */}
          {consultationData.usedSuggestions.length > 0 && (
            <div className="completion-suggestions">
              <h3>
                <FileText className="w-5 h-5" />
                Sugestões Utilizadas
              </h3>
              
              <div className="suggestions-list">
                {consultationData.usedSuggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={suggestion.id} className="suggestion-item">
                    <div className="suggestion-number">{index + 1}</div>
                    <div className="suggestion-content">
                      <div className="suggestion-type">
                        {suggestion.type === 'question' && '❓ Pergunta'}
                        {suggestion.type === 'protocol' && '📋 Protocolo'}
                        {suggestion.type === 'warning' && '⚠️ Alerta'}
                        {suggestion.type === 'insight' && '💡 Insight'}
                      </div>
                      <div className="suggestion-text">{suggestion.content}</div>
                    </div>
                  </div>
                ))}
                
                {consultationData.usedSuggestions.length > 3 && (
                  <div className="more-suggestions">
                    +{consultationData.usedSuggestions.length - 3} sugestões adicionais
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="completion-actions">
            <button
              onClick={handleRedirect}
              className="btn btn-primary btn-large"
              disabled={isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <div className="loading-spinner" />
                  Redirecionando...
                </>
              ) : (
                <>
                  Ver Consulta Completa
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <button
              onClick={onClose}
              className="btn btn-outline"
              disabled={isRedirecting}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .completion-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .completion-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .completion-modal-header {
          display: flex;
          align-items: center;
          padding: 24px 24px 0 24px;
          position: relative;
        }

        .completion-success-icon {
          margin-right: 12px;
        }

        .completion-modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          flex: 1;
        }

        .completion-modal-close {
          position: absolute;
          top: 24px;
          right: 24px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .completion-modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .completion-modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .completion-modal-content {
          padding: 24px;
        }

        .completion-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .summary-item {
          display: flex;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .summary-item svg {
          margin-right: 12px;
          flex-shrink: 0;
        }

        .summary-item div {
          display: flex;
          flex-direction: column;
        }

        .summary-label {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .completion-stats {
          margin-bottom: 32px;
        }

        .completion-stats h3 {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .completion-stats h3 svg {
          margin-right: 8px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 16px;
        }

        .stat-card {
          text-align: center;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .completion-suggestions {
          margin-bottom: 32px;
        }

        .completion-suggestions h3 {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .completion-suggestions h3 svg {
          margin-right: 8px;
        }

        .suggestions-list {
          space-y: 12px;
        }

        .suggestion-item {
          display: flex;
          align-items: flex-start;
          padding: 16px;
          background: #f0f9ff;
          border-radius: 8px;
          border-left: 4px solid #0ea5e9;
        }

        .suggestion-number {
          background: #0ea5e9;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .suggestion-content {
          flex: 1;
        }

        .suggestion-type {
          font-size: 0.875rem;
          color: #0369a1;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .suggestion-text {
          font-size: 0.875rem;
          color: #1e293b;
          line-height: 1.5;
        }

        .more-suggestions {
          text-align: center;
          padding: 12px;
          color: #64748b;
          font-style: italic;
          background: #f8fafc;
          border-radius: 6px;
          margin-top: 8px;
        }

        .completion-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-outline {
          background: transparent;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .btn-outline:hover:not(:disabled) {
          background: #f9fafb;
          color: #374151;
        }

        .btn-large {
          padding: 14px 28px;
          font-size: 1rem;
        }

        .btn svg {
          margin-left: 8px;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .completion-modal {
            margin: 10px;
            max-height: calc(100vh - 20px);
          }

          .completion-summary {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .completion-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
