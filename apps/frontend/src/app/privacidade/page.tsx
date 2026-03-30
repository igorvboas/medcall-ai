'use client'

import React from 'react'
import Link from 'next/link'

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="text-[#6b7280] text-[14px] mb-10">
          Última atualização: 30 de março de 2026
        </p>

        <div className="space-y-8 text-[#374151] text-[15px] leading-relaxed">

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">1. Introdução</h2>
            <p>
              A Auton Health Ltda., inscrita no CNPJ sob o nº 64.493.228/0001-43 (&quot;Auton Health&quot;, &quot;nós&quot;),
              está comprometida com a proteção dos dados pessoais de seus usuários. Esta Política de
              Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações
              pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)
              e demais legislações aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">2. Dados que Coletamos</h2>
            <p>Podemos coletar os seguintes tipos de dados pessoais:</p>

            <h3 className="text-[#1a365d] text-[16px] font-semibold mt-4 mb-2">2.1. Dados fornecidos pelo usuário</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nome completo, e-mail, telefone e dados de cadastro profissional;</li>
              <li>Dados de pacientes cadastrados pelo profissional de saúde na Plataforma;</li>
              <li>Informações clínicas inseridas durante consultas (anamnese, evolução, prontuários);</li>
              <li>Documentos enviados ou gerados na Plataforma.</li>
            </ul>

            <h3 className="text-[#1a365d] text-[16px] font-semibold mt-4 mb-2">2.2. Dados coletados automaticamente</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Endereço IP, tipo de navegador e sistema operacional;</li>
              <li>Dados de uso da Plataforma (páginas acessadas, funcionalidades utilizadas);</li>
              <li>Cookies e tecnologias similares de rastreamento.</li>
            </ul>

            <h3 className="text-[#1a365d] text-[16px] font-semibold mt-4 mb-2">2.3. Dados de serviços integrados</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dados de calendário (Google Calendar) para sincronização de agenda;</li>
              <li>Dados de autenticação via provedores terceiros (Google OAuth).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">3. Dados Sensíveis de Saúde</h2>
            <p>
              A Plataforma processa dados sensíveis de saúde exclusivamente para a finalidade de assistência
              à saúde, conforme autorização prevista no art. 11, II, &quot;f&quot; da LGPD. Estes dados são tratados
              sob a responsabilidade do profissional de saúde que os inseriu, atuando como controlador dos
              dados de seus pacientes. A Auton Health atua como operadora desses dados, fornecendo a
              infraestrutura tecnológica necessária.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">4. Finalidade do Tratamento</h2>
            <p>Os dados pessoais são utilizados para:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Prestação dos serviços da Plataforma (consultas, prontuários, agendamento);</li>
              <li>Autenticação e segurança da conta do usuário;</li>
              <li>Processamento de pagamentos e gestão de assinaturas;</li>
              <li>Funcionamento dos recursos de inteligência artificial (transcrição, análise clínica);</li>
              <li>Sincronização com serviços integrados (calendários, e-mail);</li>
              <li>Comunicação sobre atualizações, suporte e novidades do serviço;</li>
              <li>Cumprimento de obrigações legais e regulatórias;</li>
              <li>Melhoria contínua da Plataforma e da experiência do usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">5. Compartilhamento de Dados</h2>
            <p>Seus dados podem ser compartilhados com:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Provedores de infraestrutura:</strong> serviços de hospedagem, banco de dados e armazenamento (Supabase, Vercel);</li>
              <li><strong>Serviços de IA:</strong> provedores de inteligência artificial para transcrição e análise, com dados anonimizados ou pseudonimizados quando possível;</li>
              <li><strong>Processadores de pagamento:</strong> para gestão de cobranças e assinaturas;</li>
              <li><strong>Integrações autorizadas:</strong> serviços como Google Calendar, mediante consentimento expresso do usuário;</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei ou determinação judicial.</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins
              de marketing.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">6. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em
              repouso. Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso
              não autorizado, destruição, perda ou alteração, incluindo:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Criptografia de dados sensíveis;</li>
              <li>Controle de acesso baseado em funções;</li>
              <li>Monitoramento e auditoria de acessos;</li>
              <li>Backups regulares;</li>
              <li>Políticas internas de segurança da informação.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">7. Retenção de Dados</h2>
            <p>
              Os dados pessoais são mantidos pelo período necessário ao cumprimento das finalidades
              descritas nesta Política. Dados clínicos são retidos conforme os prazos legais estabelecidos
              pela legislação de saúde (mínimo de 20 anos para prontuários médicos, conforme Resolução
              CFM nº 1.821/2007). Após o encerramento da conta, os dados serão anonimizados ou excluídos,
              exceto quando houver obrigação legal de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">8. Direitos do Titular</h2>
            <p>
              Em conformidade com a LGPD, você tem direito a:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter cópia deles;</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos ou desatualizados;</li>
              <li><strong>Anonimização ou eliminação:</strong> solicitar a anonimização ou exclusão de dados desnecessários;</li>
              <li><strong>Portabilidade:</strong> solicitar a transferência de seus dados a outro fornecedor;</li>
              <li><strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento;</li>
              <li><strong>Oposição:</strong> opor-se ao tratamento de dados quando aplicável;</li>
              <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades seus dados foram compartilhados.</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato pelo e-mail contato@autonhealth.com.br.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para o funcionamento da Plataforma (autenticação, preferências
              do usuário). Não utilizamos cookies de rastreamento para fins publicitários. Você pode
              configurar seu navegador para recusar cookies, mas isso pode afetar a funcionalidade
              da Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">10. Uso do Google Calendar</h2>
            <p>
              Quando você autoriza a integração com o Google Calendar, acessamos seus dados de calendário
              exclusivamente para:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Sincronizar seus compromissos e horários disponíveis;</li>
              <li>Criar e gerenciar eventos de consulta no seu calendário;</li>
              <li>Exibir sua agenda dentro da Plataforma.</li>
            </ul>
            <p className="mt-3">
              Não acessamos, armazenamos ou compartilhamos outros dados da sua conta Google além dos
              estritamente necessários para a funcionalidade de agenda. Você pode revogar esta autorização
              a qualquer momento nas configurações da Plataforma ou na sua conta Google.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">11. Alterações nesta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Notificaremos as alterações significativas
              por meio da Plataforma ou por e-mail. Recomendamos a consulta periódica desta página.
            </p>
          </section>

          <section>
            <h2 className="text-[#1a365d] text-[20px] font-semibold mb-3">12. Contato e Encarregado (DPO)</h2>
            <p>
              Para dúvidas, solicitações ou exercício de direitos relacionados à proteção de dados,
              entre em contato:
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
