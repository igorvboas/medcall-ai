export function BenefitsSection() {
  return (
    <section className="benefits-section">
      <div className="benefits-container">
        <div className="benefits-header">
          <h2 className="section-title">Por que escolher o TRIA?</h2>
          <p className="section-subtitle">
            Transforme sua prática médica com tecnologia de ponta
          </p>
        </div>

        <div className="benefits-grid">
          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="benefit-title">Economia de Tempo</h3>
            <p className="benefit-description">
              Reduza em até 70% o tempo gasto com documentação médica
            </p>
            <div className="benefit-stat">
              <span className="stat-number">70%</span>
              <span className="stat-label">menos tempo</span>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="benefit-title">Maior Precisão</h3>
            <p className="benefit-description">
              Transcrição com 95% de precisão e sugestões baseadas em evidências
            </p>
            <div className="benefit-stat">
              <span className="stat-number">95%</span>
              <span className="stat-label">precisão</span>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="benefit-title">Segurança Total</h3>
            <p className="benefit-description">
              Dados criptografados e conformidade com LGPD garantida
            </p>
            <div className="benefit-stat">
              <span className="stat-number">100%</span>
              <span className="stat-label">seguro</span>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="benefit-title">Melhor Atendimento</h3>
            <p className="benefit-description">
              Mais tempo para ouvir e cuidar do paciente
            </p>
            <div className="benefit-stat">
              <span className="stat-number">+40%</span>
              <span className="stat-label">satisfação</span>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="benefit-title">Relatórios Detalhados</h3>
            <p className="benefit-description">
              Análises completas e métricas de performance
            </p>
            <div className="benefit-stat">
              <span className="stat-number">24/7</span>
              <span className="stat-label">disponível</span>
            </div>
          </div>

          <div className="benefit-card">
            <div className="benefit-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="benefit-title">Integração Fácil</h3>
            <p className="benefit-description">
              Conecta com seus sistemas existentes em minutos
            </p>
            <div className="benefit-stat">
              <span className="stat-number">5min</span>
              <span className="stat-label">setup</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
