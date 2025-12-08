'use client';

import { motion } from "framer-motion";

export function BenefitsSection() {
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
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut"
      }
    }
  };

  return (
    <section className="benefits-section">
      <div className="benefits-container">
        <motion.div 
          className="benefits-header"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <span className="section-label benefits-label">Vantagens</span>
          <h2 className="section-title-refined">
            Por que escolher o
            <span className="title-accent"> Auton Health?</span>
          </h2>
          <p className="section-description">
            Transforme sua prática médica com tecnologia de ponta e resultados comprovados
          </p>
        </motion.div>

        <motion.div 
          className="benefits-grid-refined"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Economia de Tempo</h3>
              <p className="benefit-description-refined">
                Reduza drasticamente o tempo gasto com documentação médica e foque no que realmente importa
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">70%</span>
                <span className="stat-label-refined">menos tempo em registros</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Maior Precisão</h3>
              <p className="benefit-description-refined">
                Transcrição com alta precisão e sugestões clínicas baseadas em evidências científicas
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">95%</span>
                <span className="stat-label-refined">precisão na transcrição</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Segurança Total</h3>
              <p className="benefit-description-refined">
                Dados criptografados com conformidade total à LGPD e padrões internacionais de segurança
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">100%</span>
                <span className="stat-label-refined">conformidade LGPD</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Melhor Atendimento</h3>
              <p className="benefit-description-refined">
                Dedique mais tempo para ouvir, examinar e cuidar dos seus pacientes com qualidade superior
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">+40%</span>
                <span className="stat-label-refined">satisfação dos pacientes</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Relatórios Inteligentes</h3>
              <p className="benefit-description-refined">
                Análises completas e métricas de performance com insights valiosos para sua prática
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">24/7</span>
                <span className="stat-label-refined">monitoramento disponível</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="benefit-card-refined" variants={itemVariants}>
            <div className="benefit-icon-refined">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="benefit-content-refined">
              <h3 className="benefit-title-refined">Integração Simples</h3>
              <p className="benefit-description-refined">
                Conecta facilmente com seus sistemas existentes em poucos minutos, sem complicações
              </p>
              <div className="benefit-stat-refined">
                <span className="stat-number-refined">5min</span>
                <span className="stat-label-refined">tempo de configuração</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
