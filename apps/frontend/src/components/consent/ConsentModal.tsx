'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Shield, Video, Mic } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
  onReject: () => void;
  patientName?: string;
}

export function ConsentModal({ onAccept, onReject, patientName }: ConsentModalProps) {
  const [hasRead, setHasRead] = useState(false);
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="consent-modal-overlay">
      <div className="consent-modal">
        <div className="consent-modal-header">
          <Shield size={32} className="consent-icon" />
          <h2>Termo de Consentimento</h2>
        </div>

        <div className="consent-modal-content">
          <div className="consent-greeting">
            <p>Olá, <strong>{patientName || 'Paciente'}</strong>!</p>
            <p>Antes de iniciar a consulta, precisamos do seu consentimento para:</p>
          </div>

          <div className="consent-items">
            <div className="consent-item">
              <Video size={20} />
              <div>
                <h4>Gravação de Vídeo e Áudio</h4>
                <p>A consulta será gravada em vídeo e áudio para fins médicos, documentação e análise clínica.</p>
              </div>
            </div>

            <div className="consent-item">
              <Mic size={20} />
              <div>
                <h4>Transcrição em Tempo Real</h4>
                <p>Sua fala será transcrita automaticamente durante a consulta para facilitar o registro médico e análise.</p>
              </div>
            </div>

            <div className="consent-item">
              <FileText size={20} />
              <div>
                <h4>Armazenamento de Dados</h4>
                <p>Os dados da consulta (vídeo, áudio e transcrições) serão armazenados de forma segura e confidencial, seguindo as normas de proteção de dados médicos.</p>
              </div>
            </div>

            <div className="consent-item">
              <Shield size={20} />
              <div>
                <h4>Privacidade e Confidencialidade</h4>
                <p>Seus dados serão tratados com total confidencialidade, conforme a legislação de proteção de dados pessoais (LGPD) e normas éticas médicas.</p>
              </div>
            </div>
          </div>

          <div className="consent-warning">
            <AlertCircle size={20} />
            <p>
              <strong>Importante:</strong> Ao aceitar, você concorda com a gravação e processamento dos dados da consulta. 
              Você pode solicitar a interrupção da gravação a qualquer momento durante a consulta.
            </p>
          </div>

          <div className="consent-checkbox-container">
            <label className="consent-checkbox-label">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  if (e.target.checked) {
                    setHasRead(true);
                  }
                }}
              />
              <span>Li e compreendi os termos acima. Aceito o consentimento para gravação e transcrição da consulta.</span>
            </label>
          </div>
        </div>

        <div className="consent-modal-actions">
          <button
            className="consent-button reject"
            onClick={onReject}
          >
            Não Aceito
          </button>
          <button
            className="consent-button accept"
            onClick={onAccept}
            disabled={!accepted}
          >
            <CheckCircle2 size={18} />
            Aceitar e Entrar na Consulta
          </button>
        </div>
      </div>

      <style jsx>{`
        .consent-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .consent-modal {
          background: white;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .consent-modal-header {
          padding: 24px 24px 16px;
          border-bottom: 2px solid #e5e7eb;
          text-align: center;
        }

        .consent-icon {
          color: #3b82f6;
          margin-bottom: 12px;
        }

        .consent-modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
        }

        .consent-modal-content {
          padding: 24px;
        }

        .consent-greeting {
          margin-bottom: 24px;
        }

        .consent-greeting p {
          margin: 8px 0;
          color: #4b5563;
          font-size: 15px;
        }

        .consent-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 24px;
        }

        .consent-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border-left: 3px solid #3b82f6;
        }

        .consent-item svg {
          color: #3b82f6;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .consent-item h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .consent-item p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .consent-warning {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 8px;
          border-left: 3px solid #f59e0b;
          margin-bottom: 24px;
        }

        .consent-warning svg {
          color: #f59e0b;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .consent-warning p {
          margin: 0;
          font-size: 14px;
          color: #92400e;
          line-height: 1.5;
        }

        .consent-checkbox-container {
          margin-bottom: 24px;
        }

        .consent-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .consent-checkbox-label:hover {
          background: #e5e7eb;
        }

        .consent-checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          margin-top: 2px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .consent-checkbox-label span {
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
        }

        .consent-modal-actions {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          border-top: 2px solid #e5e7eb;
        }

        .consent-button {
          flex: 1;
          padding: 14px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .consent-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .consent-button.reject {
          background: #f3f4f6;
          color: #6b7280;
        }

        .consent-button.reject:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .consent-button.accept {
          background: #3b82f6;
          color: white;
        }

        .consent-button.accept:hover:not(:disabled) {
          background: #2563eb;
        }

        @media (max-width: 640px) {
          .consent-modal {
            max-width: 100%;
            margin: 0;
            border-radius: 0;
            max-height: 100vh;
          }

          .consent-modal-actions {
            flex-direction: column;
          }

          .consent-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

