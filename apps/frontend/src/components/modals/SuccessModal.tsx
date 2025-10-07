'use client';

import { useEffect } from 'react';
import { X, Check } from 'lucide-react';
import './SuccessModal.css';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  showDontShowAgain?: boolean;
  onDontShowAgainChange?: (checked: boolean) => void;
  dontShowAgain?: boolean;
}

export function SuccessModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  showDontShowAgain = false,
  onDontShowAgainChange,
  dontShowAgain = false
}: SuccessModalProps) {
  // Fechar modal com ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="success-modal-overlay" onClick={onClose}>
      <div className="success-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header com botão de fechar */}
        <button
          onClick={onClose}
          className="success-modal-close"
          aria-label="Fechar modal"
        >
          <X className="close-icon" />
        </button>

        {/* Ícone de sucesso */}
        <div className="success-icon-wrapper">
          <div className="success-icon-bg">
            <Check className="success-icon" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="success-modal-content">
          <h2 className="success-modal-title">{title}</h2>
          <p className="success-modal-message">{message}</p>
        </div>

        {/* Checkbox "Não mostrar novamente" */}
        {showDontShowAgain && (
          <div className="dont-show-again-wrapper">
            <label className="dont-show-again-label">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => onDontShowAgainChange?.(e.target.checked)}
                className="dont-show-again-checkbox"
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Não mostrar novamente</span>
            </label>
          </div>
        )}

        {/* Botões de ação */}
        <div className="success-modal-actions">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          
          <button
            onClick={onConfirm}
            className="btn btn-primary"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}


