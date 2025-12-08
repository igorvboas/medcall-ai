'use client';

import { useState } from 'react';
import { Brain, Copy, Check, X, AlertTriangle, Lightbulb, MessageSquare, Power, PowerOff } from 'lucide-react';

interface Suggestion {
  id: string;
  type: 'question' | 'insight' | 'warning' | 'protocol' | 'next_steps' | 'followup' | 'assessment' | 'alert';
  content: string;
  confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  source?: string;
  used?: boolean;
  created_at: string;
}

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onUseSuggestion?: (suggestionId: string) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  onClose?: () => void;
}

export function SuggestionsPanel({ 
  suggestions, 
  onUseSuggestion, 
  onDismissSuggestion,
  enabled = true,
  onToggleEnabled,
  onClose
}: SuggestionsPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleCopy = (suggestion: Suggestion) => {
    navigator.clipboard.writeText(suggestion.content);
    setCopiedId(suggestion.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (suggestion: Suggestion) => {
    if (onUseSuggestion) {
      onUseSuggestion(suggestion.id);
    }
    handleCopy(suggestion);
  };

  const handleDismiss = (suggestionId: string) => {
    setDismissedIds(prev => new Set(prev).add(suggestionId));
    if (onDismissSuggestion) {
      onDismissSuggestion(suggestionId);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertTriangle className="w-4 h-4" />;
      case 'insight':
        return <Lightbulb className="w-4 h-4" />;
      case 'question':
      case 'assessment':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'medium':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'low':
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id) && !s.used);

  return (
    <div className="suggestions-panel">
      <div className="suggestions-header">
        <Brain className="w-5 h-5" />
        <h3>Sugestões de IA</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span className="suggestions-count">{visibleSuggestions.length}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="suggestions-close-btn"
              title="Fechar painel de sugestões"
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="suggestions-list">
        {visibleSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`suggestion-card ${getPriorityColor(suggestion.priority)}`}
          >
            <div className="suggestion-header">
              <div className="suggestion-type">
                {getIcon(suggestion.type)}
                <span>{suggestion.type}</span>
              </div>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="suggestion-dismiss"
                title="Descartar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="suggestion-content">
              <p>{suggestion.content}</p>
            </div>

            {suggestion.source && (
              <div className="suggestion-source">
                📚 {suggestion.source}
              </div>
            )}

            <div className="suggestion-actions">
              <button
                onClick={() => handleUse(suggestion)}
                className="suggestion-btn suggestion-btn-primary"
              >
                {copiedId === suggestion.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </button>
              <div className="suggestion-confidence">
                {Math.round(suggestion.confidence * 100)}% confiança
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

