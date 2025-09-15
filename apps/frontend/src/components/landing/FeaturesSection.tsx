export function FeaturesSection() {
  return (
    <section id="features" className="features-section">
      <div className="features-container">
        <div className="features-header">
          <h2 className="section-title">Funcionalidades que fazem a diferença</h2>
          <p className="section-subtitle">
            Tecnologia avançada para modernizar sua prática médica
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-visual">
              <div className="feature-mockup">
                <div className="mockup-screen">
                  <div className="screen-header">
                    <div className="recording-indicator"></div>
                    <span>Transcrição em Tempo Real</span>
                  </div>
                  <div className="screen-content">
                    <div className="transcription-line doctor">
                      <span className="speaker">Dr. Maria:</span>
                      <span className="text">Qual é sua queixa principal?</span>
                    </div>
                    <div className="transcription-line patient">
                      <span className="speaker">Paciente:</span>
                      <span className="text">Dor de cabeça há 3 dias...</span>
                    </div>
                    <div className="transcription-line doctor">
                      <span className="speaker">Dr. Maria:</span>
                      <span className="text">Qual a intensidade da dor?</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Transcrição em Tempo Real</h3>
              <p className="feature-description">
                Nossa IA transcreve automaticamente toda a conversa durante a consulta, 
                com identificação automática de quem está falando.
              </p>
              <ul className="feature-list">
                <li>Precisão de 95% na transcrição</li>
                <li>Identificação automática médico/paciente</li>
                <li>Funciona offline após configuração</li>
                <li>Suporte a múltiplos idiomas</li>
              </ul>
            </div>
          </div>

          <div className="feature-card reverse">
            <div className="feature-visual">
              <div className="feature-mockup">
                <div className="mockup-screen">
                  <div className="screen-header">
                    <span>Sugestões Inteligentes</span>
                  </div>
                  <div className="screen-content">
                    <div className="suggestion-item question">
                      <span className="type">Pergunta Sugerida</span>
                      <span className="text">Qual a intensidade da dor (0-10)?</span>
                    </div>
                    <div className="suggestion-item diagnosis">
                      <span className="type">Diagnóstico</span>
                      <span className="text">Considerar cefaleia tensional</span>
                    </div>
                    <div className="suggestion-item treatment">
                      <span className="type">Tratamento</span>
                      <span className="text">Analgésicos + relaxamento</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Sugestões Clínicas Inteligentes</h3>
              <p className="feature-description">
                Receba sugestões contextuais de perguntas, diagnósticos diferenciais 
                e tratamentos baseados nas melhores práticas médicas.
              </p>
              <ul className="feature-list">
                <li>Perguntas sugeridas em tempo real</li>
                <li>Diagnósticos diferenciais</li>
                <li>Protocolos de tratamento</li>
                <li>Baseado em evidências científicas</li>
              </ul>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-visual">
              <div className="feature-mockup">
                <div className="mockup-screen">
                  <div className="screen-header">
                    <span>Prontuário Automático</span>
                  </div>
                  <div className="screen-content">
                    <div className="prontuario-section">
                      <h4>Anamnese</h4>
                      <p>Paciente relata dor de cabeça há 3 dias...</p>
                    </div>
                    <div className="prontuario-section">
                      <h4>Exame Físico</h4>
                      <p>PA: 120/80 mmHg, FC: 72 bpm...</p>
                    </div>
                    <div className="prontuario-section">
                      <h4>Diagnóstico</h4>
                      <p>Cefaleia tensional</p>
                    </div>
                    <div className="prontuario-section">
                      <h4>Conduta</h4>
                      <p>Analgésicos + orientações</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Prontuário Automático</h3>
              <p className="feature-description">
                Documentação completa gerada automaticamente com base na transcrição, 
                organizada em seções padronizadas.
              </p>
              <ul className="feature-list">
                <li>Estruturação automática do prontuário</li>
                <li>Seções padronizadas (anamnese, exame, diagnóstico)</li>
                <li>Edição e personalização</li>
                <li>Exportação para PDF</li>
              </ul>
            </div>
          </div>

          <div className="feature-card reverse">
            <div className="feature-visual">
              <div className="feature-mockup">
                <div className="mockup-screen">
                  <div className="screen-header">
                    <span>Análise e Relatórios</span>
                  </div>
                  <div className="screen-content">
                    <div className="analytics-grid">
                      <div className="analytics-item">
                        <span className="metric">127</span>
                        <span className="label">Consultas/Mês</span>
                      </div>
                      <div className="analytics-item">
                        <span className="metric">18min</span>
                        <span className="label">Tempo Médio</span>
                      </div>
                      <div className="analytics-item">
                        <span className="metric">94%</span>
                        <span className="label">Satisfação</span>
                      </div>
                      <div className="analytics-item">
                        <span className="metric">2.3h</span>
                        <span className="label">Tempo Economizado</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Análise e Relatórios</h3>
              <p className="feature-description">
                Dashboards completos com métricas de performance, tempo economizado 
                e insights sobre sua prática médica.
              </p>
              <ul className="feature-list">
                <li>Métricas de produtividade</li>
                <li>Tempo economizado por consulta</li>
                <li>Análise de satisfação</li>
                <li>Relatórios personalizáveis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
