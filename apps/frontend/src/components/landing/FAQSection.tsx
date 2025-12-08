'use client';

import { useState } from 'react';

export function FAQSection() {
  const [openItem, setOpenItem] = useState<number | null>(null);

  const faqs = [
    {
      question: "Como funciona a transcrição em tempo real?",
      answer: "Nossa IA utiliza tecnologia de reconhecimento de voz avançada para transcrever automaticamente toda a conversa durante a consulta. O sistema identifica automaticamente quem está falando (médico ou paciente) e gera a transcrição em tempo real com 95% de precisão."
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Sim, todos os dados são criptografados de ponta a ponta e armazenados em servidores seguros no Brasil. Cumprimos rigorosamente a LGPD e temos certificações de segurança. Você pode cancelar a qualquer momento e seus dados serão excluídos conforme solicitado."
    },
    {
      question: "Preciso de equipamentos especiais?",
      answer: "Não! O Auton Health funciona com qualquer computador, tablet ou smartphone. Você só precisa de um microfone (que já vem com a maioria dos dispositivos) e uma conexão com a internet. A configuração é feita em menos de 5 minutos."
    },
    {
      question: "Posso usar o sistema offline?",
      answer: "Após a configuração inicial, o sistema funciona offline para transcrição básica. No entanto, para sugestões clínicas avançadas e sincronização de dados, é necessária conexão com a internet."
    },
    {
      question: "Como são geradas as sugestões clínicas?",
      answer: "Nossas sugestões são baseadas em protocolos médicos reconhecidos, guidelines internacionais e evidências científicas. A IA analisa o contexto da conversa e sugere perguntas relevantes, diagnósticos diferenciais e tratamentos apropriados."
    },
    {
      question: "Posso integrar com meu sistema atual?",
      answer: "Sim! O Auton Health oferece APIs e integrações com os principais sistemas de gestão médica. Nossa equipe técnica ajuda na configuração e customização conforme suas necessidades específicas."
    },
    {
      question: "Há limite de consultas?",
      answer: "Depende do seu plano. O plano Starter inclui até 50 consultas por mês, o Professional oferece consultas ilimitadas, e o Enterprise é personalizado conforme sua necessidade. Você pode sempre fazer upgrade do plano."
    },
    {
      question: "Como funciona o suporte?",
      answer: "Oferecemos suporte por email para todos os planos, suporte prioritário para Professional e suporte 24/7 para Enterprise. Também temos documentação completa, tutoriais em vídeo e treinamentos personalizados."
    },
    {
      question: "Posso cancelar a qualquer momento?",
      answer: "Sim! Não há fidelidade ou multa por cancelamento. Você pode cancelar sua assinatura a qualquer momento através do painel de controle ou entrando em contato com nosso suporte."
    },
    {
      question: "O sistema funciona para todas as especialidades médicas?",
      answer: "Sim! O Auton Health foi desenvolvido para funcionar com qualquer especialidade médica. Nossas sugestões clínicas são adaptadas conforme a especialidade e podem ser customizadas para protocolos específicos da sua área."
    }
  ];

  const toggleItem = (index: number) => {
    setOpenItem(openItem === index ? null : index);
  };

  return (
    <section id="faq" className="faq-section">
      <div className="faq-container">
        <div className="faq-header">
          <h2 className="section-title">Perguntas Frequentes</h2>
          <p className="section-subtitle">
            Tire suas dúvidas sobre o Auton Health
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button 
                className="faq-question"
                onClick={() => toggleItem(index)}
                aria-expanded={openItem === index}
              >
                <span className="faq-question-text">{faq.question}</span>
                <svg 
                  className={`faq-icon ${openItem === index ? 'open' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`faq-answer ${openItem === index ? 'open' : ''}`}>
                <div className="faq-answer-content">
                  <p>{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="faq-cta">
          <h3>Ainda tem dúvidas?</h3>
          <p>Nossa equipe está pronta para ajudar você</p>
          <div className="faq-cta-buttons">
            <button className="btn btn-outline">
              Falar com Suporte
            </button>
            <button className="btn btn-primary">
              Agendar Demonstração
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
