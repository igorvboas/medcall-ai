export function PricingSection() {
  return (
    <section id="pricing" className="pricing-section">
      <div className="pricing-container">
        <div className="pricing-header">
          <h2 className="section-title">Planos que cabem no seu bolso</h2>
          <p className="section-subtitle">
            Escolha o plano ideal para sua prática médica
          </p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-header-card">
              <h3 className="pricing-plan">Starter</h3>
              <p className="pricing-description">Perfeito para médicos iniciantes</p>
              <div className="pricing-price">
                <span className="price-currency">R$</span>
                <span className="price-amount">97</span>
                <span className="price-period">/mês</span>
              </div>
            </div>
            <div className="pricing-features">
              <ul className="features-list">
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Até 50 consultas/mês</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Transcrição em tempo real</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Sugestões básicas</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Prontuário automático</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Suporte por email</span>
                </li>
              </ul>
            </div>
            <div className="pricing-cta">
              <button className="btn btn-outline btn-large pricing-btn">
                Começar Teste Grátis
              </button>
            </div>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-badge">Mais Popular</div>
            <div className="pricing-header-card">
              <h3 className="pricing-plan">Professional</h3>
              <p className="pricing-description">Ideal para clínicas e consultórios</p>
              <div className="pricing-price">
                <span className="price-currency">R$</span>
                <span className="price-amount">197</span>
                <span className="price-period">/mês</span>
              </div>
            </div>
            <div className="pricing-features">
              <ul className="features-list">
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Consultas ilimitadas</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Transcrição em tempo real</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Sugestões avançadas</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Prontuário automático</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Relatórios detalhados</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Integração com sistemas</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Suporte prioritário</span>
                </li>
              </ul>
            </div>
            <div className="pricing-cta">
              <button className="btn btn-primary btn-large pricing-btn">
                Começar Teste Grátis
              </button>
            </div>
          </div>

          <div className="pricing-card">
            <div className="pricing-header-card">
              <h3 className="pricing-plan">Enterprise</h3>
              <p className="pricing-description">Para grandes clínicas e hospitais</p>
              <div className="pricing-price">
                <span className="price-currency">R$</span>
                <span className="price-amount">497</span>
                <span className="price-period">/mês</span>
              </div>
            </div>
            <div className="pricing-features">
              <ul className="features-list">
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Tudo do Professional</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Múltiplos usuários</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Customizações avançadas</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>API dedicada</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Suporte 24/7</span>
                </li>
                <li className="feature-item">
                  <svg className="feature-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Treinamento personalizado</span>
                </li>
              </ul>
            </div>
            <div className="pricing-cta">
              <button className="btn btn-outline btn-large pricing-btn">
                Falar com Vendas
              </button>
            </div>
          </div>
        </div>

        <div className="pricing-guarantee">
          <div className="guarantee-content">
            <svg className="guarantee-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="guarantee-text">
              <h4>Garantia de 14 dias</h4>
              <p>Teste grátis sem compromisso. Cancele quando quiser.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
