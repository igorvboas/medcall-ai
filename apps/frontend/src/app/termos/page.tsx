'use client'

import React from 'react'
import Link from 'next/link'

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="max-w-[900px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link href="/landing">
            <img src="/logo-black.svg" alt="Auton Health" className="h-10 w-auto" />
          </Link>
          <Link href="/landing" className="text-[#1a365d] text-[14px] font-medium hover:underline">
            Voltar ao início
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[900px] mx-auto px-6 py-12 lg:py-16">
        <h1 className="text-[#1a365d] text-[32px] lg:text-[40px] font-bold mb-2">
          Termos de Serviço
        </h1>
        <p className="text-[#6b7280] text-[14px] mb-10">
          Última atualização: 30 de março de 2026
        </p>

        <div className="space-y-8 text-[#374151] text-[15px] leading-relaxed">

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma Auton Health (&quot;Plataforma&quot;), operada pela Auton Health Ltda.,
              inscrita no CNPJ sob o nº 64.493.228/0001-43 (&quot;Auton Health&quot;, &quot;nós&quot;), você concorda integralmente
              com estes Termos de Serviço. Caso não concorde com qualquer disposição, recomendamos que não utilize
              a Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">2. Descrição do Serviço</h2>
            <p>
              A Auton Health é uma plataforma de tecnologia voltada para profissionais de saúde integrativa,
              que oferece funcionalidades como:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Agendamento e gestão de consultas online e presenciais;</li>
              <li>Teleconsultas por videoconferência;</li>
              <li>Transcrição e análise assistida por inteligência artificial;</li>
              <li>Gestão de prontuários e documentos clínicos;</li>
              <li>Integração com calendários e ferramentas externas;</li>
              <li>Gestão de pacientes e acompanhamento de tratamentos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">3. Cadastro e Conta</h2>
            <p>
              Para utilizar a Plataforma, é necessário criar uma conta fornecendo informações verdadeiras,
              completas e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais
              de acesso e por todas as atividades realizadas em sua conta. Caso tome conhecimento de qualquer
              uso não autorizado, notifique-nos imediatamente em contato@autonhealth.com.br.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">4. Responsabilidades do Usuário</h2>
            <p>Ao utilizar a Plataforma, o usuário se compromete a:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Utilizar o serviço em conformidade com a legislação vigente e com estes Termos;</li>
              <li>Não utilizar a Plataforma para fins ilícitos ou não autorizados;</li>
              <li>Manter seus dados cadastrais atualizados;</li>
              <li>Respeitar a propriedade intelectual da Auton Health e de terceiros;</li>
              <li>Não tentar acessar, de forma não autorizada, sistemas ou dados de outros usuários;</li>
              <li>Garantir que o uso das ferramentas de IA seja complementar à sua avaliação profissional,
                nunca substituindo o julgamento clínico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">5. Uso da Inteligência Artificial</h2>
            <p>
              A Plataforma utiliza recursos de inteligência artificial para auxiliar profissionais de saúde
              em tarefas como transcrição, análise e geração de documentos. Esses recursos são ferramentas
              de apoio e <strong>não substituem o julgamento clínico profissional</strong>. O profissional de
              saúde é o único responsável pelas decisões clínicas tomadas durante o atendimento.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">6. Planos e Pagamentos</h2>
            <p>
              A Plataforma oferece diferentes planos de assinatura. Os valores, condições e funcionalidades
              de cada plano estão disponíveis na página de planos. O pagamento é processado por plataformas
              de pagamento terceirizadas. A Auton Health reserva-se o direito de alterar os valores dos planos,
              mediante comunicação prévia aos usuários.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da Plataforma, incluindo software, design, textos, gráficos, logotipos e demais
              materiais, é de propriedade da Auton Health ou de seus licenciadores, protegido pelas leis de
              propriedade intelectual. É proibida a reprodução, distribuição ou modificação sem autorização
              prévia e por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">8. Limitação de Responsabilidade</h2>
            <p>
              A Auton Health não se responsabiliza por:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Decisões clínicas tomadas com base nas informações geradas pela Plataforma;</li>
              <li>Interrupções temporárias do serviço por motivos técnicos ou de manutenção;</li>
              <li>Danos decorrentes de uso indevido da Plataforma pelo usuário;</li>
              <li>Falhas em serviços de terceiros integrados à Plataforma (como provedores de pagamento ou calendários).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">9. Suspensão e Cancelamento</h2>
            <p>
              A Auton Health poderá suspender ou cancelar o acesso do usuário à Plataforma em caso de
              violação destes Termos, uso inadequado ou por determinação legal. O usuário pode cancelar
              sua conta a qualquer momento entrando em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">10. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos a qualquer momento. As alterações serão
              comunicadas por meio da Plataforma ou por e-mail. O uso continuado após as modificações
              constitui aceitação dos novos Termos.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">11. Legislação Aplicável e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
              da Comarca do Rio de Janeiro/RJ para dirimir quaisquer controvérsias decorrentes destes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">12. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes Termos, entre em contato conosco:
            </p>
            <ul className="mt-3 space-y-1">
              <li><strong>E-mail:</strong> contato@autonhealth.com.br</li>
              <li><strong>WhatsApp:</strong> (21) 97176-0439</li>
            </ul>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] py-8 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="text-[#9ca3af] text-[13px]">
            © 2026 Auton Health Ltda. CNPJ: 64.493.228/0001-43. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
