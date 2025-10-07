'use client';

import { motion } from "framer-motion";

export function ProblemSolutionSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <section className="problem-solution-section">
      <div className="problem-solution-container">
        <motion.div 
          className="problem-solution-content"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Problem Section */}
          <motion.div className="problem-section" variants={itemVariants}>
            <div className="section-header">
              <span className="section-label">Desafios</span>
              <h2 className="section-title-refined">
                Os obstáculos que você enfrenta
                <span className="title-accent"> todos os dias</span>
              </h2>
              <p className="section-description">
                Identificamos os principais pontos de dor que afetam a qualidade do seu atendimento médico
              </p>
            </div>
            
            <div className="problem-list-refined">
              <motion.div className="problem-item-refined" variants={itemVariants}>
                <div className="problem-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="problem-content-refined">
                  <h3>Tempo perdido com documentação</h3>
                  <p>Você dedica mais tempo preenchendo prontuários do que realmente atendendo seus pacientes</p>
                </div>
              </motion.div>

              <motion.div className="problem-item-refined" variants={itemVariants}>
                <div className="problem-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709" />
                  </svg>
                </div>
                <div className="problem-content-refined">
                  <h3>Informações perdidas</h3>
                  <p>Detalhes importantes podem ser esquecidos ou mal registrados durante a consulta</p>
                </div>
              </motion.div>

              <motion.div className="problem-item-refined" variants={itemVariants}>
                <div className="problem-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="problem-content-refined">
                  <h3>Pressão constante</h3>
                  <p>Demanda crescente por mais consultas em menos tempo, comprometendo a qualidade</p>
                </div>
              </motion.div>

              <motion.div className="problem-item-refined" variants={itemVariants}>
                <div className="problem-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="problem-content-refined">
                  <h3>Risco de erros</h3>
                  <p>Ausência de apoio para decisões clínicas complexas e diagnósticos diferenciais</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Solution Section */}
          <motion.div className="solution-section" variants={itemVariants}>
            <div className="section-header">
              <span className="section-label solution-label">Solução</span>
              <h2 className="section-title-refined">
                Como a EVA
                <span className="title-accent"> transforma</span> sua prática
              </h2>
              <p className="section-description">
                Nossa plataforma de IA médica resolve cada um desses desafios de forma inteligente e eficiente
              </p>
            </div>
            
            <div className="solution-list-refined">
              <motion.div className="solution-item-refined" variants={itemVariants}>
                <div className="solution-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="solution-content-refined">
                  <h3>Transcrição inteligente</h3>
                  <p>IA transcreve automaticamente toda a conversa em tempo real, liberando você para focar no paciente</p>
                </div>
              </motion.div>

              <motion.div className="solution-item-refined" variants={itemVariants}>
                <div className="solution-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="solution-content-refined">
                  <h3>Sugestões clínicas</h3>
                  <p>Perguntas sugeridas, diagnósticos diferenciais e tratamentos baseados nas melhores práticas médicas</p>
                </div>
              </motion.div>

              <motion.div className="solution-item-refined" variants={itemVariants}>
                <div className="solution-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="solution-content-refined">
                  <h3>Documentação automática</h3>
                  <p>Prontuários completos gerados automaticamente com estrutura profissional e detalhamento preciso</p>
                </div>
              </motion.div>

              <motion.div className="solution-item-refined" variants={itemVariants}>
                <div className="solution-icon-refined">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div className="solution-content-refined">
                  <h3>Foco no cuidado</h3>
                  <p>Dedique seu tempo ao que realmente importa: a relação médico-paciente e o cuidado humanizado</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
