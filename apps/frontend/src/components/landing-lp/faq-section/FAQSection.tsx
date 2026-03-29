'use client'

import React from 'react'
import FAQItem from './FAQItem'

interface FAQGroup {
  category: string
  items: { question: string; answer: string }[]
}

export default function FAQSection() {
  const faqGroups: FAQGroup[] = [
    {
      category: "Sobre o investimento",
      items: [
        {
          question: "A AUTON vale a pena para minha prática hoje?",
          answer: "Se você busca mais clareza diagnóstica, otimizar seu tempo e entregar um atendimento mais preciso, a AUTON foi criada exatamente para isso. Ela reduz o tempo de análise, organiza o raciocínio clínico e eleva o nível da sua consulta."
        },
        {
          question: "Como a AUTON impacta meu dia a dia?",
          answer: "Você ganha velocidade na análise de exames, apoio na identificação de causa raiz e mais segurança nas decisões clínicas. Isso se traduz em consultas mais objetivas, pacientes mais confiantes e menos retrabalho."
        }
      ]
    },
    {
      category: "Sobre retorno e resultado",
      items: [
        {
          question: "Em quanto tempo começo a ver resultado?",
          answer: "A maioria dos profissionais percebe impacto nas primeiras semanas. Principalmente na redução do tempo por consulta e na clareza do raciocínio clínico."
        },
        {
          question: "Preciso mudar minha forma de atender para usar a AUTON?",
          answer: "Não. A AUTON se adapta ao seu fluxo atual. Ela funciona como um suporte inteligente, potencializando o que você já faz — não substituindo sua forma de atuação."
        },
        {
          question: "A AUTON ajuda na retenção de pacientes?",
          answer: "Sim. Quando o paciente percebe um atendimento mais aprofundado e direcionado à causa raiz, a confiança aumenta — e com isso, a adesão ao tratamento e as indicações."
        }
      ]
    },
    {
      category: "Sobre a experiência do paciente",
      items: [
        {
          question: "O que meu paciente ganha com a AUTON?",
          answer: "Seu paciente recebe acesso a um painel exclusivo onde acompanha sua evolução clínica, visualiza exames, planos de tratamento e orientações — tudo em um só lugar. Isso aumenta o engajamento, a adesão ao tratamento e a percepção de valor do seu atendimento."
        }
      ]
    },
    {
      category: "Sobre segurança e decisão",
      items: [
        {
          question: "Existe algum risco em testar?",
          answer: "Não. Você pode testar sem compromisso e avaliar na prática como a AUTON se encaixa no seu atendimento."
        },
        {
          question: "Posso cancelar quando quiser?",
          answer: "Sim. Sem fidelidade, sem burocracia. Você continua apenas se fizer sentido para você."
        }
      ]
    }
  ]

  let globalIndex = 0

  return (
    <section className="bg-[#F9FAFB] py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[900px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[26px] lg:text-[36px] font-bold text-center mb-12 lg:mb-16">
          Perguntas Frequentes
        </h2>

        {/* Grupos de FAQs */}
        <div className="flex flex-col gap-10 lg:gap-12">
          {faqGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Subtítulo da Categoria */}
              <h3 className="text-[#1a365d] text-[18px] lg:text-[20px] font-semibold mb-4 lg:mb-5">
                {group.category}
              </h3>

              {/* Items da Categoria */}
              <div className="flex flex-col gap-4 lg:gap-5">
                {group.items.map((faq, itemIndex) => {
                  const currentIndex = globalIndex++
                  return (
                    <FAQItem
                      key={currentIndex}
                      question={faq.question}
                      answer={faq.answer}
                      index={currentIndex}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
