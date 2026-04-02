'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'

export default function OnboardingPage() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4f8] to-white">
      {/* Header */}
      <header className="w-full py-6 px-6 lg:px-16 flex justify-center">
        <Image
          src="/logo-auton.png"
          alt="AUTON Health"
          width={160}
          height={48}
          priority
        />
      </header>

      {/* Hero */}
      <section className="max-w-[800px] mx-auto px-6 pt-8 pb-12 text-center">
        <h1 className="text-[#1a365d] text-[28px] lg:text-[40px] font-bold leading-tight mb-4">
          Bem-vindo à AUTON Health
        </h1>
        <p className="text-[#4a5568] text-[16px] lg:text-[18px] leading-relaxed mb-6">
          Estamos felizes por ter você conosco. Para garantir que você aproveite ao máximo
          a plataforma desde o primeiro dia, preparamos uma sessão de onboarding exclusiva.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0]">
            <div className="w-10 h-10 bg-[#1a365d] text-white rounded-full flex items-center justify-center text-[18px] font-bold mx-auto mb-3">
              1
            </div>
            <h3 className="text-[#1a365d] font-semibold text-[15px] mb-2">Agende sua sessão</h3>
            <p className="text-[#4a5568] text-[14px]">
              Escolha o melhor horário no calendário abaixo.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0]">
            <div className="w-10 h-10 bg-[#1a365d] text-white rounded-full flex items-center justify-center text-[18px] font-bold mx-auto mb-3">
              2
            </div>
            <h3 className="text-[#1a365d] font-semibold text-[15px] mb-2">Onboarding guiado</h3>
            <p className="text-[#4a5568] text-[14px]">
              Nossa equipe vai te guiar pela plataforma em uma sessão personalizada.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0]">
            <div className="w-10 h-10 bg-[#1a365d] text-white rounded-full flex items-center justify-center text-[18px] font-bold mx-auto mb-3">
              3
            </div>
            <h3 className="text-[#1a365d] font-semibold text-[15px] mb-2">Comece a usar</h3>
            <p className="text-[#4a5568] text-[14px]">
              Após o onboarding, você estará pronto para transformar seu atendimento.
            </p>
          </div>
        </div>
      </section>

      {/* Calendly */}
      <section className="max-w-[900px] mx-auto px-6 pb-16">
        <h2 className="text-[#1a365d] text-[22px] lg:text-[28px] font-bold text-center mb-6">
          Escolha o melhor horário para você
        </h2>
        <div
          className="calendly-inline-widget rounded-2xl overflow-hidden"
          data-url="https://calendly.com/ferramentas-triacompany/onboarding?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=17355d"
          style={{ minWidth: '320px', height: '700px' }}
        />
      </section>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-[#E2E8F0]">
        <p className="text-[#94A3B8] text-[14px]">
          AUTON Health &copy; {new Date().getFullYear()} — Todos os direitos reservados.
        </p>
      </footer>
    </div>
  )
}
