/**
 * Configuração dinâmica de webhooks baseada no ambiente
 */

export interface WebhookConfig {
  baseUrl: string;
  authHeader: string;
}

export interface WebhookEndpoints {
  anamnese: string;
  edicaoAnamnese: string;
  transcricao: string;
  edicaoDiagnostico: string;
  diagnosticoPrincipal: string;
  edicaoSolucao: string;
  edicaoLivroDaVida: string;
  triggerSolucao: string;
  solucaoCriacaoEntregaveis: string;
  exames: string;
}

/**
 * Detecta o ambiente atual (homolog, development, production)
 */
function getEnvironment(): string {
  return process.env.NEXT_PUBLIC_ENV || process.env.NEXT_PUBLIC_NODE_ENV || process.env.NODE_ENV || 'production';
}

/**
 * Retorna a configuração de webhook baseada no ambiente
 */
export function getWebhookConfig(): WebhookConfig {
  const env = getEnvironment();
  const isHomolog = env === 'homolog';

  return {
    baseUrl: isHomolog
      ? 'https://triahook.gst.dev.br'
      : 'https://triahook.gst.dev.br',
    authHeader: process.env.NEXT_PUBLIC_WEBHOOK_AUTH_HEADER || ''
  };
}

/**
 * Retorna os endpoints de webhook baseados no ambiente
 */
export function getWebhookEndpoints(): WebhookEndpoints {
  const env = getEnvironment();
  const isHomolog = env === 'homolog';
  const isDevelopment = env === 'development';

  const suffix = isDevelopment ? '-teste' : '';

  const config = getWebhookConfig();
  const prodBase = 'https://triahook.gst.dev.br';
  const homologBase = 'https://triahook.gst.dev.br';

  console.log('🔗🔗 Webhook endpoints configurados:', {
    env,
    isHomolog,
    isDevelopment
  });

  if (isHomolog) {
    return {
      anamnese: `${homologBase}/webhook/usi-anamnese-preenchimento-homolog`,
      edicaoAnamnese: `${homologBase}/webhook/usi-input-edicao-analise-homolog`,
      transcricao: `${homologBase}/webhook/usi-analise-homolog`,
      edicaoDiagnostico: `${homologBase}/webhook/usi-input-edicao-diagnostico-homolog`,
      diagnosticoPrincipal: `${homologBase}/webhook/diagnostico-principal-homolog`,
      edicaoSolucao: `${homologBase}/webhook/usi-input-edicao-solucao-homolog`,
      edicaoLivroDaVida: `${prodBase}/webhook/usi-solucao-homolog`,
      triggerSolucao: `${homologBase}/webhook/usi-trigger-solucao-homolog`,
      solucaoCriacaoEntregaveis: `${homologBase}/webhook/usi-solucao-criacao-entregaveis-homolog`,
      exames: `${homologBase}/webhook/input-at-exames-usi-homolog`
    };
  }

  return {
    anamnese: `${config.baseUrl}/webhook/usi-anamnese-preenchimento-v2`,
    edicaoAnamnese: `${config.baseUrl}/webhook/usi-input-edicao-analise-v2`,
    transcricao: `${config.baseUrl}/webhook/usi-analise-v2`,
    edicaoDiagnostico: `${config.baseUrl}/webhook/usi-input-edicao-diagnostico-v2`,
    diagnosticoPrincipal: `${config.baseUrl}/webhook/diagnostico-principal-v2`,
    edicaoSolucao: `${config.baseUrl}/webhook/usi-input-edicao-solucao-v2`,
    edicaoLivroDaVida: `${config.baseUrl}/webhook/usi-solucao-livro-vida-v2`,
    triggerSolucao: `${config.baseUrl}/webhook/usi-trigger-solucao${suffix}`,
    solucaoCriacaoEntregaveis: `${config.baseUrl}/webhook/usi-solucao-criacao-entregaveis${suffix}`,
    exames: `${config.baseUrl}/webhook/input-at-exames-usi-v2`
  };
}

/**
 * Retorna os headers padrão para requisições de webhook
 */
export function getWebhookHeaders(): Record<string, string> {
  const config = getWebhookConfig();

  return {
    'Content-Type': 'application/json',
    'Authorization': config.authHeader
  };
}

