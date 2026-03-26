import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { whatsappService } from '../services/whatsapp.service';
import { Resend } from 'resend';
import crypto from 'crypto';

// Lazy Resend instance
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Eventos que ativam a assinatura
const ACTIVATION_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
// Eventos que desativam a assinatura
const DEACTIVATION_EVENTS = [
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_INACTIVE',
];
// Eventos que reativam
const REACTIVATION_EVENTS = ['PAYMENT_RESTORED'];

/**
 * Gera senha aleatória de 12 caracteres
 */
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Busca dados do cliente na API do Asaas
 */
async function fetchAsaasCustomer(customerId: string): Promise<{
  name: string;
  email: string;
  phone: string;
} | null> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    console.error('❌ [ASAAS] ASAAS_API_KEY não configurada');
    return null;
  }

  try {
    const baseUrl = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
    const response = await fetch(`${baseUrl}/customers/${customerId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [ASAAS] Erro ao buscar customer:', response.status, await response.text());
      return null;
    }

    const customer = await response.json() as any;
    return {
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || customer.mobilePhone || '',
    };
  } catch (error) {
    console.error('❌ [ASAAS] Erro ao buscar customer:', error);
    return null;
  }
}

/**
 * Envia email de boas-vindas com link de definição de senha
 */
async function sendWelcomeEmail(email: string, name: string, password: string, recoveryLink: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ [ASAAS] RESEND_API_KEY não configurada, pulando envio de email');
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const appName = 'AUTON Health';

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [email],
      subject: `Bem-vindo à ${appName} — Defina sua senha de acesso`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a365d 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Bem-vindo à ${appName}</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Olá <strong>${name}</strong>,
            </p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Seu pagamento foi confirmado e sua conta na <strong>${appName}</strong> já está pronta!
              Clique no botão abaixo para definir sua senha e começar a usar a plataforma.
            </p>

            <div style="background: #f9fafb; border: 2px solid #1a365d; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <div style="margin-bottom: 12px;">
                <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Seu e-mail de acesso:</strong>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1a365d; font-weight: 600;">
                  ${email}
                </div>
              </div>
              <div>
                <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Sua senha temporária:</strong>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1a365d; font-weight: 600;">
                  ${password}
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a
                href="${recoveryLink}"
                style="display: inline-block; background: linear-gradient(135deg, #1a365d 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(26, 54, 93, 0.3);">
                Definir Senha e Acessar
              </a>
            </div>

            <div style="background: #f0f4f8; border-left: 4px solid #1a365d; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #4a5568;">
                <strong>Próximo passo:</strong> Após definir sua senha, agende seu onboarding em
                <a href="https://autonhealth.com.br/onboarding" style="color: #1a365d; font-weight: 600;">autonhealth.com.br/onboarding</a>
              </p>
            </div>

            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ [ASAAS] Erro ao enviar email de boas-vindas:', error);
    } else {
      console.log('✅ [ASAAS] Email de boas-vindas enviado:', data?.id);
    }
  } catch (error) {
    console.error('❌ [ASAAS] Erro ao enviar email:', error);
  }
}

/**
 * Envia 2 mensagens via WhatsApp:
 * 1. Boas-vindas
 * 2. Credenciais de acesso (email + senha)
 */
async function sendWelcomeWhatsApp(phone: string, name: string, email: string, password: string): Promise<void> {
  if (!phone) return;

  try {
    // Mensagem 1: Boas-vindas
    const welcomeMessage =
      `Olá ${name}! 👋\n\n` +
      `Seja bem-vindo(a) à *AUTON Health*!\n\n` +
      `Seu pagamento foi confirmado e sua conta já está pronta para uso.\n\n` +
      `Agende seu onboarding para aproveitar ao máximo a plataforma:\n` +
      `🔗 https://autonhealth.com.br/onboarding\n\n` +
      `Qualquer dúvida, estamos à disposição!`;

    await whatsappService.sendText({ number: phone, text: welcomeMessage });
    console.log('✅ [ASAAS] WhatsApp de boas-vindas enviado para:', phone);

    // Pequeno delay entre mensagens
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mensagem 2: Credenciais
    const credentialsMessage =
      `🔐 *Seus dados de acesso à AUTON Health:*\n\n` +
      `📧 *Email:* ${email}\n` +
      `🔑 *Senha temporária:* ${password}\n\n` +
      `Acesse em: https://autonhealth.com.br\n\n` +
      `⚠️ Recomendamos que altere sua senha após o primeiro acesso.`;

    await whatsappService.sendText({ number: phone, text: credentialsMessage });
    console.log('✅ [ASAAS] WhatsApp de credenciais enviado para:', phone);
  } catch (error) {
    console.error('❌ [ASAAS] Erro ao enviar WhatsApp:', error);
  }
}

/**
 * POST /webhooks/asaas
 * Recebe webhooks do Asaas e processa pagamentos
 */
export async function handleAsaasWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Validar token do webhook
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (webhookToken) {
      const receivedToken = req.headers['asaas-access-token'] as string;
      if (receivedToken !== webhookToken) {
        console.warn('⚠️ [ASAAS] Token de webhook inválido');
        res.status(401).json({ error: 'Token inválido' });
        return;
      }
    }

    const { event, payment, subscription } = req.body;
    // Asaas envia "payment" para eventos de pagamento e "subscription" para eventos de assinatura
    const data = payment || subscription;

    if (!event || !data) {
      res.status(400).json({ error: 'Payload inválido: event e payment/subscription são obrigatórios' });
      return;
    }

    console.log(`🔔 [ASAAS] Webhook recebido: ${event} | ID: ${data.id} | Customer: ${data.customer}`);

    // ========== EVENTOS DE ATIVAÇÃO ==========
    if (ACTIVATION_EVENTS.includes(event)) {
      // Buscar dados do cliente na API do Asaas
      const customer = await fetchAsaasCustomer(data.customer);
      if (!customer || !customer.email) {
        console.error('❌ [ASAAS] Não foi possível obter dados do cliente');
        res.status(500).json({ error: 'Falha ao buscar dados do cliente no Asaas' });
        return;
      }

      const email = customer.email.toLowerCase().trim();

      // Upsert em assinaturas
      const { error: upsertError } = await supabase
        .from('assinaturas')
        .upsert(
          {
            email,
            customer_id: data.customer,
            value: data.value,
            subscription_id: data.subscription || data.id || null,
            cycle: data.cycle || null,
            event,
            assinatura_ativa: true,
            env: process.env.NODE_ENV || 'production',
          },
          { onConflict: 'email' }
        );

      if (upsertError) {
        console.error('❌ [ASAAS] Erro ao upsert assinaturas:', upsertError);
        // Tentar insert se upsert falhar (sem unique constraint em email)
        const { error: insertError } = await supabase.from('assinaturas').insert({
          email,
          customer_id: data.customer,
          value: data.value,
          subscription_id: data.subscription || data.id || null,
          cycle: data.cycle || null,
          event,
          assinatura_ativa: true,
          env: process.env.NODE_ENV || 'production',
        });

        if (insertError) {
          console.error('❌ [ASAAS] Erro ao inserir assinaturas:', insertError);
          res.status(500).json({ error: 'Falha ao salvar assinatura' });
          return;
        }
      }

      console.log('✅ [ASAAS] Assinatura salva para:', email);

      // Tentar criar usuário (se já existir, o Supabase retorna erro)
      const password = generatePassword();
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: customer.name,
          role: 'doctor',
        },
      });

      if (createError) {
        // Se o usuário já existe, apenas atualizar a assinatura
        if (createError.message?.includes('already') || createError.message?.includes('exists')) {
          console.log('ℹ️ [ASAAS] Usuário já existe, apenas atualizando assinatura:', email);
          res.json({ success: true, message: 'Assinatura atualizada, usuário já existe' });
          return;
        }
        console.error('❌ [ASAAS] Erro ao criar usuário:', createError);
        res.status(500).json({ error: 'Falha ao criar usuário' });
        return;
      }

      console.log('✅ [ASAAS] Usuário criado:', newUser.user?.id);

      // Gerar link de recovery para definir senha
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autonhealth.com.br';
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${frontendUrl}/auth/reset-password`,
        },
      });

      if (linkError) {
        console.error('❌ [ASAAS] Erro ao gerar link de recovery:', linkError);
      }

      const recoveryLink = linkData?.properties?.action_link || `${frontendUrl}/auth/reset-password`;

      // Enviar notificações em paralelo
      await Promise.allSettled([
        sendWelcomeEmail(email, customer.name, password, recoveryLink),
        sendWelcomeWhatsApp(customer.phone, customer.name, email, password),
      ]);

      res.json({ success: true, message: 'Usuário criado e notificações enviadas' });
      return;
    }

    // ========== EVENTOS DE DESATIVAÇÃO ==========
    if (DEACTIVATION_EVENTS.includes(event)) {
      const customer = await fetchAsaasCustomer(data.customer);
      const email = customer?.email?.toLowerCase().trim();

      if (email) {
        await supabase
          .from('assinaturas')
          .update({ assinatura_ativa: false, event })
          .eq('email', email);

        console.log(`⚠️ [ASAAS] Assinatura desativada: ${email} | Evento: ${event}`);
      }

      res.json({ success: true, message: 'Assinatura desativada' });
      return;
    }

    // ========== EVENTOS DE REATIVAÇÃO ==========
    if (REACTIVATION_EVENTS.includes(event)) {
      const customer = await fetchAsaasCustomer(data.customer);
      const email = customer?.email?.toLowerCase().trim();

      if (email) {
        await supabase
          .from('assinaturas')
          .update({ assinatura_ativa: true, event })
          .eq('email', email);

        console.log(`✅ [ASAAS] Assinatura reativada: ${email} | Evento: ${event}`);
      }

      res.json({ success: true, message: 'Assinatura reativada' });
      return;
    }

    // Evento não tratado
    console.log(`ℹ️ [ASAAS] Evento não tratado: ${event}`);
    res.json({ success: true, message: `Evento ${event} recebido` });
  } catch (error) {
    console.error('❌ [ASAAS] Erro no webhook:', error);
    res.status(500).json({
      error: 'Erro interno ao processar webhook',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
