'use client';

import { Brain, CheckCircle, Clock } from 'lucide-react';

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
}

export function SuggestionsPanel({ suggestions, onSuggestionUsed }: SuggestionsPanelProps) {
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

  return (
    <div className="suggestions-panel">
      <div className="suggestions-header">
        <h4>
          <Brain className="w-4 h-4" />
          Sugestões de IA
        </h4>
        <span className="suggestion-count">{suggestions.length} sugestões</span>
      </div>
      
      <div className="suggestions-content">
        {suggestions.length === 0 ? (
          <div className="suggestions-empty">
            <Brain className="w-8 h-8 opacity-50" />
            <p>Aguardando sugestões...</p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
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
