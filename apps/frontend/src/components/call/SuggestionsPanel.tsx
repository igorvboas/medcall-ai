'use client';

import { useState } from 'react';
import { Brain, CheckCircle, Clock, Power, PowerOff, X } from 'lucide-react';

interface Suggestion {
  id: string;
  type: 'question' | 'diagnosis' | 'treatment';
  text: string;
  confidence: number;
  timestamp: string;
  used: boolean;
  used_at?: string;
}

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onSuggestionUsed?: (suggestionId: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  onClose?: () => void;
}

export function SuggestionsPanel({ 
  suggestions, 
  onSuggestionUsed,
  enabled = true,
  onToggleEnabled,
  onClose
}: SuggestionsPanelProps) {
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'question':
        return '❓';
      case 'diagnosis':
        return '🔍';
      case 'treatment':
        return '💡';
      default:
        return '🧠';
    }
  };

  const getSuggestionTypeLabel = (type: string) => {
    switch (type) {
      case 'question':
        return 'Pergunta';
      case 'diagnosis':
        return 'Diagnóstico';
      case 'treatment':
        return 'Tratamento';
      default:
        return 'Sugestão';
    }
  };

  const handleToggle = () => {
    if (onToggleEnabled) {
      onToggleEnabled(!enabled);
    }
  };

  const visibleSuggestions = enabled ? suggestions : [];

  return (
    <div className="suggestions-panel">
      <div className="suggestions-header">
        <h4>
          <Brain className="w-4 h-4" />
          Sugestões de IA
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {enabled && <span className="suggestion-count">{visibleSuggestions.length} sugestões</span>}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title="Fechar painel de sugestões"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      <div className="suggestions-content">
        {!enabled ? (
          <div className="suggestions-empty">
            <PowerOff className="w-8 h-8 opacity-50" />
            <p>Sugestões de IA desativadas</p>
            <span>Clique no botão acima para ativar</span>
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <div className="suggestions-empty">
            <Brain className="w-8 h-8 opacity-50" />
            <p>Aguardando sugestões...</p>
          </div>
        ) : (
          visibleSuggestions.map((suggestion) => (
            <div 
              key={suggestion.id} 
              className={`suggestion suggestion-${suggestion.type} ${suggestion.used ? 'used' : ''}`}
            >
              <div className="suggestion-header">
                <div className="suggestion-type">
                  <span className="type-icon">{getSuggestionIcon(suggestion.type)}</span>
                  <span className="type-label">{getSuggestionTypeLabel(suggestion.type)}</span>
                </div>
                <div className="suggestion-meta">
                  <Clock className="w-3 h-3" />
                  <span className="timestamp">
                    {new Date(suggestion.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="confidence">
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="suggestion-text">
                {suggestion.text}
              </div>
              
              {suggestion.used ? (
                <div className="suggestion-status used">
                  <CheckCircle className="w-4 h-4" />
                  <span>Usada em {new Date(suggestion.used_at!).toLocaleTimeString()}</span>
                </div>
              ) : (
                <div className="suggestion-actions">
                  <button
                    onClick={() => onSuggestionUsed?.(suggestion.id)}
                    className="btn btn-sm btn-primary"
                    disabled={suggestion.used}
                  >
                    Marcar como Usada
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
