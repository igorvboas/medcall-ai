'use client'

import React from 'react'
import PricingCard from './PricingCard'
import DecorativeDots from '../hero/DecorativeDots'

export default function PricingSection() {
  const plans = [
    {
      name: "Essencial",
      price: "997",
      period: "/mês",
      description: "1 profissional | Até 30 consultas/mês",
      features: [
        "167 agentes de IA especializados",
        "Método ADS completo (5 dimensões)",
        "Área do paciente com dashboard",
        "Dashboard profissional com métricas",
        "Gestão completa de pacientes",
        "Agenda com calendário integrado",
        "Planos atualizados em tempo real",
        "Suporte por email (24h)"
      ],
      buttonText: "Começar Teste",
      buttonAction: "https://www.asaas.com/c/6klr6sf7r2wgkezn"
    },
    {
      name: "Professional",
      price: "1.497",
      period: "/mês",
      description: "1 profissional | Até 80 consultas/mês",
      features: [
        "Tudo do Essencial +",
        "Análise automatizada de exames com IA",
        "Biblioteca de 500+ protocolos clínicos",
        "Relatórios de performance mensal",
        "Integrações (Zoom, Google Calendar)",
        "Suporte prioritário via WhatsApp (4h)",
        "Onboarding personalizado (sessão 1h)"
      ],
      buttonText: "Em breve",
      buttonAction: "",
      isPopular: true,
      disabled: true
    },
    {
      name: "Clínica",
      price: "2.997",
      period: "/mês",
      description: "Até 3 profissionais | Até 200 consultas/mês",
      features: [
        "Tudo do Professional +",
        "Dashboard de equipe (múltiplos profissionais)",
        "Benefícios gerenciais avançados",
        "Gestão centralizada de pacientes",
        "Suporte dedicado (resposta em 2h)",
        "Onboarding presencial (sessão 2h)",
        "API para integrações customizadas"
      ],
      buttonText: "Em breve",
      buttonAction: "",
      disabled: true
    },
    {
      name: "Enterprise",
      price: "5.997+",
      period: "/mês",
      description: "4+ profissionais | Consultas ilimitadas",
      features: [
        "Tudo da Clínica +",
        "Customizações específicas da clínica",
        "White label (sua marca na plataforma)",
        "API completa para integração total",
        "Account manager dedicado",
        "SLA garantido (uptime 99,9%)",
        "Treinamento completo da equipe",
        "Suporte premium 24/7"
      ],
      buttonText: "Em breve",
      buttonAction: "",
      disabled: true
    }
  ]

  return (
    <section id="checkout" className="relative bg-white py-16 lg:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Background Animado */}
      <DecorativeDots />

      {/* Conteúdo */}
      <div className="relative z-10 max-w-[1400px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[28px] lg:text-[38px] font-bold text-center mb-3">
          SELECIONE O SEU PLANO AUTON
        </h2>

        {/* Subtítulo */}
        <p className="text-[#4a5568] text-[16px] lg:text-[18px] text-center mb-12 lg:mb-16">
          Escolha o plano ideal para sua prática
        </p>

        {/* Grid de Cards de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16 lg:mb-20">
          {plans.map((plan, index) => (
            <PricingCard
              key={index}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              description={plan.description}
              features={plan.features}
              buttonText={plan.buttonText}
              buttonAction={plan.buttonAction}
              isPopular={plan.isPopular}
              disabled={plan.disabled}
              index={index}
            />
          ))}
        </div>

      </div>
    </section>
  )
}
