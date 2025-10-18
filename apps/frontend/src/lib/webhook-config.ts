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
  triggerSolucao: string;
  solucaoCriacaoEntregaveis: string;
  exames: string;
}

/**
 * Retorna a configuração de webhook baseada no ambiente
 */
export function getWebhookConfig(): WebhookConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    baseUrl: 'https://webhook.tc1.triacompany.com.br',
    authHeader: 'Vc1mgGDEcnyqLH3LoHGUXoLTUg2BRVSu'
  };
}

/**
 * Retorna os endpoints de webhook baseados no ambiente
 */
export function getWebhookEndpoints(): WebhookEndpoints {
  const config = getWebhookConfig();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const suffix = isDevelopment ? '-teste' : '';
  
  console.log('🔗 Webhook endpoints configurados:', {
    baseUrl: config.baseUrl,
    suffix,
    isDevelopment
  });
  
  return {
    anamnese: `${config.baseUrl}/webhook/usi-anamnese-preenchimento${suffix}`,
    edicaoAnamnese: `${config.baseUrl}/webhook/usi-input-edicao-anamnese${suffix}`,
    transcricao: `${config.baseUrl}/webhook/usi-input-transcricao${suffix}`,
    edicaoDiagnostico: `${config.baseUrl}/webhook/usi-input-edicao-diagnostico${suffix}`,
    diagnosticoPrincipal: `${config.baseUrl}/webhook/diagnostico-principal${suffix}`,
    edicaoSolucao: `${config.baseUrl}/webhook/usi-input-edicao-solucao${suffix}`,
    triggerSolucao: `${config.baseUrl}/webhook/usi-trigger-solucao${suffix}`,
    solucaoCriacaoEntregaveis: `${config.baseUrl}/webhook/usi-solucao-criacao-entregaveis${suffix}`,
    exames: `${config.baseUrl}/webhook/5d03fec8-6a3a-4399-8ddc-a4839e0db3ea/:input-at-exames-usi${suffix}`
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

