export function ProblemSolutionSection() {
  return (
    <section className="problem-solution-section">
      <div className="problem-solution-container">
        <div className="problem-solution-content">
          <div className="problem-section">
            <h2 className="section-title">O problema que você enfrenta todos os dias</h2>
            <div className="problem-list">
              <div className="problem-item">
                <div className="problem-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="problem-content">
                  <h3>Perda de tempo com documentação</h3>
                  <p>Você gasta mais tempo preenchendo prontuários do que atendendo pacientes</p>
                </div>
              </div>
              <div className="problem-item">
                <div className="problem-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709" />
                  </svg>
                </div>
                <div className="problem-content">
                  <h3>Informações perdidas durante a consulta</h3>
                  <p>Detalhes importantes podem ser esquecidos ou mal anotados</p>
                </div>
              </div>
              <div className="problem-item">
                <div className="problem-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="problem-content">
                  <h3>Pressão por produtividade</h3>
                  <p>Mais pacientes, menos tempo para cada consulta</p>
                </div>
              </div>
              <div className="problem-item">
                <div className="problem-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="problem-content">
                  <h3>Risco de erros diagnósticos</h3>
                  <p>Sem apoio para decisões clínicas complexas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="solution-section">
            <h2 className="section-title">Como o TRIA resolve isso</h2>
            <div className="solution-list">
              <div className="solution-item">
                <div className="solution-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="solution-content">
                  <h3>Transcrição automática em tempo real</h3>
                  <p>Nossa IA transcreve toda a conversa automaticamente, sem você precisar anotar nada</p>
                </div>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="solution-content">
                  <h3>Sugestões clínicas inteligentes</h3>
                  <p>Receba perguntas sugeridas, diagnósticos diferenciais e tratamentos baseados nas melhores práticas</p>
                </div>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="solution-content">
                  <h3>Prontuário automático</h3>
                  <p>Documentação completa gerada automaticamente com base na transcrição</p>
                </div>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="solution-content">
                  <h3>Mais tempo para o paciente</h3>
                  <p>Foque no que realmente importa: o cuidado e a relação médico-paciente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
