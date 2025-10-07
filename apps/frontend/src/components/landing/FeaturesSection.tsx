'use client';

import { motion } from "framer-motion";

export function FeaturesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  return (
    <section id="features" className="features-section">
      <div className="features-container">
        <motion.div 
          className="features-header"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <span className="section-label features-label">Funcionalidades</span>
          <h2 className="section-title-refined">
            Tecnologia que faz
            <span className="title-accent"> a diferença</span>
          </h2>
          <p className="section-description">
            Descubra como nossa plataforma de IA revoluciona cada aspecto da sua prática médica
          </p>
        </motion.div>

        <motion.div 
          className="features-grid-refined"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div className="feature-card-refined" variants={itemVariants}>
            <div className="feature-visual-refined">
              <div className="feature-mockup-refined">
                <div className="mockup-screen-refined">
                  <div className="screen-header-refined">
                    <div className="recording-indicator-refined"></div>
                    <span>Transcrição em Tempo Real</span>
                  </div>
                  <div className="screen-content-refined">
                    <div className="transcription-line-refined doctor">
                      <span className="speaker-refined">Dr. Maria:</span>
                      <span className="text-refined">Qual é sua queixa principal?</span>
                    </div>
                    <div className="transcription-line-refined patient">
                      <span className="speaker-refined">Paciente:</span>
                      <span className="text-refined">Dor de cabeça há 3 dias...</span>
                    </div>
                    <div className="transcription-line-refined doctor">
                      <span className="speaker-refined">Dr. Maria:</span>
                      <span className="text-refined">Qual a intensidade da dor?</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content-refined">
              <h3 className="feature-title-refined">Transcrição em Tempo Real</h3>
              <p className="feature-description-refined">
                Nossa IA transcreve automaticamente toda a conversa durante a consulta, 
                com identificação precisa de quem está falando e contexto clínico.
              </p>
              <ul className="feature-list-refined">
                <li>Precisão superior a 95% na transcrição</li>
                <li>Identificação automática médico/paciente</li>
                <li>Funciona offline após configuração inicial</li>
                <li>Suporte completo a múltiplos idiomas</li>
              </ul>
            </div>
          </motion.div>

          <motion.div className="feature-card-refined reverse" variants={itemVariants}>
            <div className="feature-visual-refined">
              <div className="feature-mockup-refined">
                <div className="mockup-screen-refined">
                  <div className="screen-header-refined">
                    <span>Sugestões Inteligentes</span>
                  </div>
                  <div className="screen-content-refined">
                    <div className="suggestion-item-refined question">
                      <span className="type-refined">Pergunta Sugerida</span>
                      <span className="text-refined">Qual a intensidade da dor (0-10)?</span>
                    </div>
                    <div className="suggestion-item-refined diagnosis">
                      <span className="type-refined">Diagnóstico</span>
                      <span className="text-refined">Considerar cefaleia tensional</span>
                    </div>
                    <div className="suggestion-item-refined treatment">
                      <span className="type-refined">Tratamento</span>
                      <span className="text-refined">Analgésicos + relaxamento</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content-refined">
              <h3 className="feature-title-refined">Sugestões Clínicas Inteligentes</h3>
              <p className="feature-description-refined">
                Receba sugestões contextuais em tempo real de perguntas, diagnósticos diferenciais 
                e tratamentos baseados nas melhores práticas médicas atualizadas.
              </p>
              <ul className="feature-list-refined">
                <li>Perguntas sugeridas contextualizadas</li>
                <li>Diagnósticos diferenciais precisos</li>
                <li>Protocolos de tratamento atualizados</li>
                <li>Baseado em evidências científicas</li>
              </ul>
            </div>
          </motion.div>

          <motion.div className="feature-card-refined" variants={itemVariants}>
            <div className="feature-visual-refined">
              <div className="feature-mockup-refined">
                <div className="mockup-screen-refined">
                  <div className="screen-header-refined">
                    <span>Prontuário Automático</span>
                  </div>
                  <div className="screen-content-refined">
                    <div className="prontuario-section-refined">
                      <h4>Anamnese</h4>
                      <p>Paciente relata dor de cabeça há 3 dias...</p>
                    </div>
                    <div className="prontuario-section-refined">
                      <h4>Exame Físico</h4>
                      <p>PA: 120/80 mmHg, FC: 72 bpm...</p>
                    </div>
                    <div className="prontuario-section-refined">
                      <h4>Diagnóstico</h4>
                      <p>Cefaleia tensional</p>
                    </div>
                    <div className="prontuario-section-refined">
                      <h4>Conduta</h4>
                      <p>Analgésicos + orientações</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content-refined">
              <h3 className="feature-title-refined">Prontuário Automático</h3>
              <p className="feature-description-refined">
                Documentação médica completa gerada automaticamente com base na transcrição, 
                organizada em seções padronizadas e editável conforme sua necessidade.
              </p>
              <ul className="feature-list-refined">
                <li>Estruturação automática inteligente</li>
                <li>Seções padronizadas (anamnese, exame, diagnóstico)</li>
                <li>Edição e personalização completa</li>
                <li>Exportação para múltiplos formatos</li>
              </ul>
            </div>
          </motion.div>

          <motion.div className="feature-card-refined reverse" variants={itemVariants}>
            <div className="feature-visual-refined">
              <div className="feature-mockup-refined">
                <div className="mockup-screen-refined">
                  <div className="screen-header-refined">
                    <span>Análise e Relatórios</span>
                  </div>
                  <div className="screen-content-refined">
                    <div className="analytics-grid-refined">
                      <div className="analytics-item-refined">
                        <span className="metric-refined">127</span>
                        <span className="label-refined">Consultas/Mês</span>
                      </div>
                      <div className="analytics-item-refined">
                        <span className="metric-refined">18min</span>
                        <span className="label-refined">Tempo Médio</span>
                      </div>
                      <div className="analytics-item-refined">
                        <span className="metric-refined">94%</span>
                        <span className="label-refined">Satisfação</span>
                      </div>
                      <div className="analytics-item-refined">
                        <span className="metric-refined">2.3h</span>
                        <span className="label-refined">Tempo Economizado</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="feature-content-refined">
              <h3 className="feature-title-refined">Análise e Relatórios</h3>
              <p className="feature-description-refined">
                Dashboards inteligentes com métricas detalhadas de performance, tempo economizado 
                e insights valiosos sobre sua prática médica para tomada de decisões.
              </p>
              <ul className="feature-list-refined">
                <li>Métricas de produtividade em tempo real</li>
                <li>Análise de tempo economizado por consulta</li>
                <li>Monitoramento de satisfação dos pacientes</li>
                <li>Relatórios personalizáveis e exportáveis</li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
