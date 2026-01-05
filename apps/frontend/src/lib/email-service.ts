import { Resend } from 'resend';

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendAnamneseEmailParams {
  to: string;
  patientName: string;
  anamneseLink: string;
}

interface SendCredentialsEmailParams {
  to: string;
  patientName: string;
  email: string;
  password: string;
  loginUrl: string;
}

export async function sendCredentialsEmail({
  to,
  patientName,
  email,
  password,
  loginUrl
}: SendCredentialsEmailParams): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    // Verificar se RESEND_API_KEY está configurado
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado, email não será enviado');
      return { success: false, error: 'RESEND_API_KEY não configurado' };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appName = process.env.APP_NAME || 'TRIA';
    
    // Verificar se está em modo de teste (só pode enviar para email verificado)
    // Modo de teste = usando onboarding@resend.dev ou qualquer email @resend.dev
    const isTestMode = fromEmail.includes('@resend.dev');
    
    if (isTestMode) {
      const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
      // Se estiver em modo de teste e o destinatário não for o email verificado, avisar
      if (to !== verifiedEmail) {
        console.warn('⚠️ Resend em modo de teste - só pode enviar para:', verifiedEmail);
        console.warn('⚠️ Para enviar para outros emails, verifique um domínio no Resend');
        return { 
          success: false, 
          error: `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}. Para enviar para outros emails, verifique um domínio em resend.com/domains` 
        };
      }
    }

    console.log('📧 Enviando email de credenciais via Resend...');
    console.log('  - Para:', to);
    console.log('  - De:', fromEmail);
    console.log('  - Modo de teste?', isTestMode);
    console.log('  - Domínio verificado?', !isTestMode ? '✅ Sim' : '❌ Não (modo de teste)');

    console.log('📤 Preparando envio de email...');
    console.log('  - From:', `${appName} <${fromEmail}>`);
    console.log('  - To:', to);
    console.log(`  - Subject: Suas credenciais de acesso - ${appName}`);
    
    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: `Suas credenciais de acesso - ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Credenciais de Acesso</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Bem-vindo ao ${appName}!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Olá <strong>${patientName}</strong>,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Sua conta foi criada com sucesso! Use as credenciais abaixo para acessar o sistema:
            </p>
            
            <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <div style="margin-bottom: 15px;">
                <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 5px; font-size: 14px;">Email:</label>
                <div style="background: white; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 14px; color: #1f2937;">
                  ${email}
                </div>
              </div>
              
              <div>
                <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 5px; font-size: 14px;">Senha Temporária:</label>
                <div style="background: white; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 16px; color: #059669; font-weight: 600; letter-spacing: 1px;">
                  ${password}
                </div>
              </div>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #fbbf24; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⚠️ Importante:</strong> Por segurança, recomendamos que você altere esta senha após o primeiro acesso.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                Acessar Sistema
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Se você não solicitou esta conta, por favor ignore este email.
            </p>
            
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Bem-vindo ao ${appName}!

Olá ${patientName},

Sua conta foi criada com sucesso! Use as credenciais abaixo para acessar o sistema:

Email: ${email}
Senha Temporária: ${password}

URL de Login: ${loginUrl}

⚠️ Importante: Por segurança, recomendamos que você altere esta senha após o primeiro acesso.

Se você não solicitou esta conta, por favor ignore este email.
      `.trim()
    });

    if (error) {
      console.error('❌ Erro ao enviar email via Resend:');
      console.error('  - Tipo:', typeof error);
      console.error('  - Erro completo:', JSON.stringify(error, null, 2));
      console.error('  - Message:', error.message);
      console.error('  - Name:', error.name);
      
      // Tratar erro específico de modo de teste
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('only send testing emails') || errorMessage.includes('verify a domain')) {
        const message = `Resend está em modo de teste. Só é possível enviar para ${verifiedEmail}. Para enviar para outros emails, você precisa verificar um domínio em resend.com/domains e atualizar a variável RESEND_FROM_EMAIL no .env`;
        console.warn('⚠️', message);
        return { success: false, error: message };
      }
      
      return { success: false, error: errorMessage };
    }

    console.log('✅ Email aceito pelo Resend!');
    console.log('  - ID do email:', data?.id);
    console.log('  - Resposta completa:', JSON.stringify(data, null, 2));
    
    if (data?.id) {
      console.log('📧 Email enviado com ID:', data.id);
      console.log('📧 Verifique o status no dashboard do Resend: https://resend.com/emails');
      console.log('📧 IMPORTANTE: Verifique também a caixa de SPAM do destinatário!');
    }
    
    return { success: true, emailId: data?.id };
  } catch (err: any) {
    console.error('❌ Erro ao enviar email (catch):', err);
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

export async function sendAnamneseEmail({
  to,
  patientName,
  anamneseLink
}: SendAnamneseEmailParams): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    // Verificar se RESEND_API_KEY está configurado
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY não configurado, email não será enviado');
      return { success: false, error: 'RESEND_API_KEY não configurado' };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appName = process.env.APP_NAME || 'TRIA';
    
    // Verificar se está em modo de teste
    const isTestMode = fromEmail.includes('@resend.dev');
    
    if (isTestMode) {
      const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
      if (to !== verifiedEmail) {
        console.warn('⚠️ Resend em modo de teste - só pode enviar para:', verifiedEmail);
        return { 
          success: false, 
          error: `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}` 
        };
      }
    }

    console.log('📧 Enviando email de anamnese inicial via Resend...');
    console.log('  - Para:', to);
    console.log('  - Link:', anamneseLink);

    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: `Preencha sua Anamnese Inicial - ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Anamnese Inicial</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Anamnese Inicial</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Olá <strong>${patientName}</strong>,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Seu médico solicitou que você preencha sua <strong>Anamnese Inicial</strong>. Esta é uma etapa importante para que possamos realizar uma avaliação completa e personalizada.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Clique no botão abaixo para acessar o formulário:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a 
                href="${anamneseLink}" 
                style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
                Preencher Anamnese Inicial
              </a>
            </div>
            
            <div style="background: #f9fafb; border-left: 4px solid #1B4266; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>⏱️ Tempo estimado:</strong> 10-15 minutos<br>
                <strong>📋 Informações necessárias:</strong> Dados pessoais, histórico de saúde, preferências alimentares e atividades físicas
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Se você não solicitou este formulário ou tiver alguma dúvida, entre em contato com seu médico.
            </p>
            
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Anamnese Inicial

Olá ${patientName},

Seu médico solicitou que você preencha sua Anamnese Inicial. Esta é uma etapa importante para que possamos realizar uma avaliação completa e personalizada.

Acesse o link abaixo para preencher o formulário:

${anamneseLink}

Tempo estimado: 10-15 minutos

Se você não solicitou este formulário ou tiver alguma dúvida, entre em contato com seu médico.
      `.trim()
    });

    if (error) {
      console.error('❌ Erro ao enviar email de anamnese:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }

    console.log('✅ Email de anamnese aceito pelo Resend!');
    console.log('  - ID do email:', data?.id);
    
    return { success: true, emailId: data?.id };
  } catch (err: any) {
    console.error('❌ Erro ao enviar email de anamnese (catch):', err);
    return { success: false, error: err.message || 'Erro desconhecido ao enviar email' };
  }
}

