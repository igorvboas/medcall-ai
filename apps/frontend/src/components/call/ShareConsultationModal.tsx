'use client';

import { useState } from 'react';
import { Copy, QrCode, Share2, X, CheckCircle, AlertCircle, User, Phone } from 'lucide-react';

interface ShareConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientUrl: string;
  sessionId: string;
  patientName: string;
}

export function ShareConsultationModal({
  isOpen,
  onClose,
  patientUrl,
  sessionId,
  patientName
}: ShareConsultationModalProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(patientUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      // Fallback para browsers mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = patientUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Consulta Online',
          text: `Link para sua consulta online com o médico`,
          url: patientUrl,
        });
      } catch (error) {
        console.error('Erro ao compartilhar:', error);
      }
    } else {
      // Fallback para copiar
      handleCopyLink();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Share2 size={24} />
            Compartilhar Consulta
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Informações da Consulta */}
          <div className="consultation-summary">
            <div className="summary-item">
              <User size={16} />
              <span>Paciente: {patientName}</span>
            </div>
            <div className="summary-item">
              <Phone size={16} />
              <span>Sessão: {sessionId.slice(0, 8)}...</span>
            </div>
          </div>

          {/* Link da Consulta */}
          <div className="link-section">
            <label className="link-label">Link para o Paciente:</label>
            <div className="link-container">
              <input
                type="text"
                value={patientUrl}
                readOnly
                className="link-input"
              />
              <button
                onClick={handleCopyLink}
                className={`copy-btn ${copySuccess ? 'success' : ''}`}
                title="Copiar link"
              >
                {copySuccess ? <CheckCircle size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {copySuccess && (
              <div className="success-message">
                <CheckCircle size={16} />
                Link copiado com sucesso!
              </div>
            )}
          </div>

          {/* Instruções */}
          <div className="instructions">
            <h4>Como compartilhar:</h4>
            <ol>
              <li>Copie o link acima clicando no botão de copiar</li>
              <li>Envie o link para o paciente via WhatsApp, SMS ou email</li>
              <li>O paciente deve acessar o link e configurar câmera/microfone</li>
              <li>A consulta iniciará automaticamente quando o paciente entrar</li>
            </ol>
          </div>

          {/* Avisos de Segurança */}
          <div className="security-notice">
            <AlertCircle size={16} />
            <div>
              <strong>Importante:</strong>
              <p>Este link é único e pessoal. Não compartilhe com outras pessoas além do paciente.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Fechar
          </button>
          
          <button onClick={handleShareNative} className="btn btn-primary">
            <Share2 size={16} />
            {navigator.share ? 'Compartilhar' : 'Copiar Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
