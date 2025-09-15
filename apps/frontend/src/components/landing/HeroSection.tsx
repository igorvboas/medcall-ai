'use client';

import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Revolucione suas consultas médicas com{' '}
              <span className="hero-title-accent">Inteligência Artificial</span>
            </h1>
            <p className="hero-subtitle">
              Transcreva consultas em tempo real, obtenha sugestões clínicas inteligentes 
              e automatize a documentação médica. Economize tempo e melhore a qualidade do atendimento.
            </p>
            <div className="hero-cta">
              <Link href="/auth/signup" className="btn btn-primary btn-large hero-cta-primary">
                Teste Grátis por 14 dias
              </Link>
              <Link href="#demo" className="btn btn-outline btn-large hero-cta-secondary">
                Ver Demonstração
              </Link>
            </div>
            <div className="hero-trust">
              <p className="hero-trust-text">Sem cartão de crédito • Configuração em 2 minutos</p>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-dashboard-preview">
              <div className="dashboard-mockup">
                <div className="mockup-header">
                  <div className="mockup-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="mockup-title">TRIA - Consulta em Andamento</div>
                </div>
                <div className="mockup-content">
                  <div className="mockup-sidebar">
                    <div className="mockup-patient-info">
                      <h4>Paciente</h4>
                      <p>João Silva, 45 anos</p>
                    </div>
                    <div className="mockup-anamnese">
                      <h4>Anamnese</h4>
                      <div className="mockup-field">
                        <span>Queixa Principal:</span>
                        <span>Dor de cabeça há 3 dias</span>
                      </div>
                    </div>
                  </div>
                  <div className="mockup-main">
                    <div className="mockup-transcription">
                      <div className="transcription-item doctor">
                        <span className="speaker">Dr. Maria</span>
                        <span className="text">Qual é sua queixa principal hoje?</span>
                      </div>
                      <div className="transcription-item patient">
                        <span className="speaker">Paciente</span>
                        <span className="text">Estou com dor de cabeça há 3 dias...</span>
                      </div>
                    </div>
                    <div className="mockup-suggestions">
                      <div className="suggestion-item">
                        <span className="type">Pergunta</span>
                        <span className="text">Intensidade da dor (0-10)?</span>
                      </div>
                      <div className="suggestion-item">
                        <span className="type">Diagnóstico</span>
                        <span className="text">Considerar cefaleia tensional</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
