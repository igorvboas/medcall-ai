'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={handleOverlayClick}>
      <div className="confirm-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header com botão de fechar */}
        <button
          onClick={onClose}
          className="confirm-modal-close"
          aria-label="Fechar modal"
        >
          <X className="close-icon" />
        </button>

        {/* Ícone */}
        <div className={`confirm-icon-wrapper ${variant}`}>
          <AlertTriangle className="confirm-icon" />
        </div>

        {/* Conteúdo */}
        <div className="confirm-modal-content">
          <h2 className="confirm-modal-title">{title}</h2>
          <p className="confirm-modal-message">{message}</p>
        </div>

        {/* Botões de ação */}
        <div className="confirm-modal-actions">
          <button
            onClick={onClose}
            className="btn-confirm-cancel"
          >
            {cancelText}
          </button>
          
          <button
            onClick={handleConfirm}
            className={`btn-confirm-ok ${variant}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

