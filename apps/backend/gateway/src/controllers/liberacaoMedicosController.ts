import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { config } from '../config';
import crypto from 'crypto';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * Normaliza o número de telefone para formato internacional (DDI+DDD+número).
 * Retorna null se o número for inválido.
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');

  // Já tem DDI (55) + DDD + número (13 dígitos para celular BR)
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits;
  }

  // Tem DDD + número (11 dígitos para celular BR)
  if (digits.length === 11) {
    return '55' + digits;
  }

  // Tem DDI + DDD + número fixo (12 dígitos)
  if (digits.length === 12 && digits.startsWith('55')) {
    return digits;
  }

  // Tem DDD + número fixo (10 dígitos)
  if (digits.length === 10) {
    return '55' + digits;
  }

  // Número inválido
  return null;
}

/**
 * Envia mensagem WhatsApp via Evolution API.
 */
async function sendWhatsApp(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  const evoUrl = process.env.EVO_SERVICE_URL;
  const evoInstance = process.env.EVO_INSTANCE_NAME;
  const evoApiKey = process.env.EVO_APIKEY;

  if (!evoUrl || !evoInstance || !evoApiKey) {
    return { sent: false, error: 'Evolution API não configurada (EVO_SERVICE_URL, EVO_INSTANCE_NAME ou EVO_APIKEY ausente)' };
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { sent: false, error: `Número inválido: "${phone}". Deve conter DDI+DDD+número (ex: 5511999999999)` };
  }

  try {
    const baseUrl = evoUrl.endsWith('/') ? evoUrl.slice(0, -1) : evoUrl;
    const url = `${baseUrl}/message/sendText/${evoInstance}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoApiKey,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ [WHATSAPP] Erro na resposta:', response.status, errorBody);
      return { sent: false, error: `Evolution API retornou ${response.status}` };
    }

    console.log('✅ [WHATSAPP] Mensagem enviada para:', normalizedPhone);
    return { sent: true };
  } catch (err) {
    console.error('❌ [WHATSAPP] Exceção ao enviar:', err);
    return { sent: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

/**
 * Constrói a mensagem de boas-vindas para WhatsApp.
 */
function buildWhatsAppMessage(nome: string, email: string): string {
  const appName = process.env.APP_NAME || 'Auton Health';

  return `Olá *${nome}*! 👋

Seu acesso à plataforma *${appName}* já está liberado! ✅

Suas credenciais de acesso foram enviadas no seu e-mail (*${email}*). Verifique sua caixa de entrada e também a pasta de spam.

🌐 Acesse a plataforma: https://autonhealth.com.br/auth/signin

⚠️ *Importante:* Recomendamos que altere sua senha após o primeiro acesso em Configurações.

_Esta é uma mensagem automática._`;
}

function getSupabaseAdmin() {
  return createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );
}

/**
 * Lógica core de liberação de um médico. Retorna resultado detalhado.
 */
async function liberarMedicoCore(nome: string, email: string, telefone: string): Promise<{
  success: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  whatsappError?: string;
  userId?: string;
  error?: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const supabaseAdmin = getSupabaseAdmin();

  // 1. Criar usuário no Supabase Auth (se já existir, o erro é tratado abaixo)
  const password = generateRandomPassword();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      name: nome,
      role: 'doctor',
      phone: telefone,
      created_by: 'manual_release',
    },
  });

  if (authError) {
    console.error('❌ [LIBERACAO] Erro ao criar usuário auth:', authError);
    const isDuplicate = authError.message?.toLowerCase().includes('already') ||
      authError.message?.toLowerCase().includes('exists') ||
      authError.status === 422;
    return {
      success: false,
      emailSent: false,
      whatsappSent: false,
      error: isDuplicate
        ? 'Já existe um usuário cadastrado com este email'
        : 'Erro ao criar conta: ' + authError.message,
    };
  }

  console.log('✅ [LIBERACAO] Usuário auth criado:', authData.user?.id);

  // 2. Buscar o doctor_id criado pelo trigger
  const { data: medico } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', authData.user!.id)
    .single();

  if (!medico) {
    console.error('❌ [LIBERACAO] Médico não encontrado após trigger');
    return {
      success: false,
      emailSent: false,
      whatsappSent: false,
      error: 'Erro interno: registro de médico não foi criado pelo trigger',
    };
  }

  // 3. Criar registro em assinaturas
  const { error: assinaturaError } = await supabase
    .from('assinaturas')
    .insert({
      doctor_id: medico.id,
      email: normalizedEmail,
      assinatura_ativa: true,
      env: 'auton-manual',
      event: 'MANUAL_RELEASE',
      created_at: new Date().toISOString(),
    });

  if (assinaturaError) {
    console.error('❌ [LIBERACAO] Erro ao criar assinatura:', assinaturaError);
    return {
      success: false,
      emailSent: false,
      whatsappSent: false,
      error: 'Erro ao criar assinatura: ' + assinaturaError.message,
    };
  }

  console.log('✅ [LIBERACAO] Assinatura criada para:', normalizedEmail, 'doctor_id:', medico.id);

  // 4. Enviar email com credenciais
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      const appName = process.env.APP_NAME || 'Auton Health';
      const frontendUrl = process.env.FRONTEND_URL || 'https://autonhealth.com.br';

      const isTestMode = fromEmail.includes('@resend.dev');
      const recipientEmail = isTestMode
        ? (process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br')
        : normalizedEmail;

      const resend = getResend();
      const { error: emailError } = await resend.emails.send({
        from: `${appName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `Sua conta foi criada - ${appName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Conta Criada</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Bem-vindo ao ${appName}!</h1>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Olá <strong>${nome}</strong>,
              </p>

              <p style="font-size: 16px; margin-bottom: 20px;">
                Sua conta no <strong>${appName}</strong> foi criada com sucesso! Abaixo estão suas credenciais de acesso:
              </p>

              <div style="background: #f9fafb; border: 2px solid #1B4266; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <div style="margin-bottom: 15px;">
                  <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">E-mail:</strong>
                  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600;">
                    ${normalizedEmail}
                  </div>
                </div>
                <div>
                  <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Senha temporária:</strong>
                  <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600;">
                    ${password}
                  </div>
                </div>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a
                  href="${frontendUrl}/auth/signin"
                  style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
                  Acessar Plataforma
                </a>
              </div>

              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Importante:</strong> Recomendamos que você altere sua senha após o primeiro acesso em Configurações.
                </p>
              </div>

              <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
                Este é um email automático, por favor não responda.
              </p>
            </div>
          </body>
          </html>
        `
      });

      if (emailError) {
        console.error('⚠️ [LIBERACAO] Erro ao enviar email:', emailError);
      } else {
        emailSent = true;
        console.log('✅ [LIBERACAO] Email enviado para:', recipientEmail);
      }
    } catch (emailErr) {
      console.error('⚠️ [LIBERACAO] Exceção ao enviar email:', emailErr);
    }
  } else {
    console.warn('⚠️ [LIBERACAO] RESEND_API_KEY não configurada, email não enviado');
  }

  // 5. Enviar WhatsApp com credenciais
  const whatsappMessage = buildWhatsAppMessage(nome, normalizedEmail);
  const whatsappResult = await sendWhatsApp(telefone, whatsappMessage);

  return {
    success: true,
    emailSent,
    whatsappSent: whatsappResult.sent,
    whatsappError: whatsappResult.error,
    userId: authData.user?.id,
  };
}

/**
 * POST /liberacao-medicos/liberar
 * Libera um único médico
 */
export async function liberarMedico(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { nome, email, telefone } = req.body;

    if (!nome || !email || !telefone) {
      res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: nome, email, telefone'
      });
      return;
    }

    const result = await liberarMedicoCore(nome, email, telefone);

    if (!result.success) {
      res.status(result.error?.includes('Já existe') ? 409 : 500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Médico liberado com sucesso',
      emailSent: result.emailSent,
      whatsappSent: result.whatsappSent,
      whatsappError: result.whatsappError,
      userId: result.userId,
    });
  } catch (error) {
    console.error('❌ [LIBERACAO] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * POST /liberacao-medicos/liberar-massa
 * Libera médicos em massa. Body: { medicos: [{ nome, email, telefone }] }
 */
export async function liberarMedicosMassa(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { medicos } = req.body;

    if (!Array.isArray(medicos) || medicos.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Envie um array "medicos" com pelo menos um item',
      });
      return;
    }

    const results: Array<{
      nome: string;
      email: string;
      telefone: string;
      success: boolean;
      emailSent: boolean;
      whatsappSent: boolean;
      whatsappError?: string;
      error?: string;
    }> = [];

    for (const medico of medicos) {
      const { nome, email, telefone } = medico;

      if (!nome || !email || !telefone) {
        results.push({
          nome: nome || '—',
          email: email || '—',
          telefone: telefone || '—',
          success: false,
          emailSent: false,
          whatsappSent: false,
          error: 'Campos obrigatórios: nome, email, telefone',
        });
        continue;
      }

      try {
        const result = await liberarMedicoCore(nome.trim(), email.trim(), telefone.trim());
        results.push({
          nome,
          email,
          telefone,
          success: result.success,
          emailSent: result.emailSent,
          whatsappSent: result.whatsappSent,
          whatsappError: result.whatsappError,
          error: result.error,
        });
      } catch (err) {
        results.push({
          nome,
          email,
          telefone,
          success: false,
          emailSent: false,
          whatsappSent: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Processados: ${successCount} liberados, ${failCount} com erro`,
      total: results.length,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    console.error('❌ [LIBERACAO MASSA] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
