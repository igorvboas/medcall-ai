'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FileText, Home } from 'lucide-react';

function ConsultaFinalizadaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientName = searchParams?.get('patientName') || 'Paciente';

  useEffect(() => {
    // Limpar qualquer estado de consulta do localStorage
    const roomId = searchParams?.get('roomId');
    if (roomId) {
      // Limpar consentimento da sala finalizada
      localStorage.removeItem(`consent_${roomId}`);
    }
  }, [searchParams]);

  return (
    <div className="consulta-finalizada-container">
      <div className="consulta-finalizada-content">
        <div className="consulta-finalizada-icon">
          <CheckCircle2 size={64} />
        </div>

        <h1>Consulta Finalizada</h1>

        <div className="consulta-finalizada-message">
          <p>Olá, <strong>{patientName}</strong>!</p>
          <p>A consulta foi finalizada pelo médico.</p>
        </div>

        <div className="consulta-finalizada-info">
          <div className="info-item">
            <FileText size={20} />
            <div>
              <h3>Transcrições Salvas</h3>
              <p>Todas as transcrições da consulta foram salvas com segurança.</p>
            </div>
          </div>

          <div className="info-item">
            <Clock size={20} />
            <div>
              <h3>Próximos Passos</h3>
              <p>O médico entrará em contato caso seja necessário algum acompanhamento.</p>
            </div>
          </div>
        </div>

        <div className="consulta-finalizada-actions">
          <button
            className="btn-home"
            onClick={() => router.push('/')}
          >
            <Home size={18} />
            Voltar para Home
          </button>
        </div>
      </div>

      <style jsx>{`
        .consulta-finalizada-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .consulta-finalizada-content {
          background: white;
          border-radius: 16px;
          padding: 48px 32px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
          animation: slideIn 0.4s ease-out;
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

        .consulta-finalizada-icon {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
        }

        .consulta-finalizada-icon svg {
          color: #10b981;
        }

        .consulta-finalizada-content h1 {
          margin: 0 0 24px 0;
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
        }

        .consulta-finalizada-message {
          margin-bottom: 32px;
        }

        .consulta-finalizada-message p {
          margin: 8px 0;
          font-size: 16px;
          color: #4b5563;
          line-height: 1.6;
        }

        .consulta-finalizada-message strong {
          color: #1f2937;
          font-weight: 600;
        }

        .consulta-finalizada-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
          text-align: left;
        }

        .info-item {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border-left: 4px solid #667eea;
        }

        .info-item svg {
          color: #667eea;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-item h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .info-item p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .consulta-finalizada-actions {
          display: flex;
          justify-content: center;
        }

        .btn-home {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-home:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 640px) {
          .consulta-finalizada-content {
            padding: 32px 24px;
          }

          .consulta-finalizada-content h1 {
            font-size: 24px;
          }

          .info-item {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default function ConsultaFinalizadaPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Carregando...</div>
      </div>
    }>
      <ConsultaFinalizadaContent />
    </Suspense>
  );
}

