/**
 * Centralized webhook configuration.
 * Phase 5/6: All webhook dispatch points use these functions instead of hardcoded URLs.
 * URL selection based on NODE_ENV per project constraints.
 */

type Environment = 'homolog' | 'production' | 'localhost';

const WEBHOOK_URLS: Record<string, Record<Environment, string>> = {
  transcricao: {
    production: 'https://triahook.gst.dev.br/webhook/usi-analise-v2',
    homolog: 'https://triahook.gst.dev.br/webhook/usi-analise-v2',
    localhost: 'https://triahook.gst.dev.br/webhook/usi-analise-v2',
  },
};

/**
 * Get the current environment from NODE_ENV.
 * Maps 'development' -> 'localhost', 'production' -> 'production', default -> 'homolog'.
 */
export function getEnv(): Environment {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'development') return 'localhost';
  return 'homolog';
}

/**
 * Get the webhook URL for a given webhook type.
 */
export function getWebhookUrl(type: 'transcricao'): string {
  const env = getEnv();
  return WEBHOOK_URLS[type]?.[env] || WEBHOOK_URLS.transcricao.homolog;
}

/**
 * Get standard webhook headers including auth.
 */
export function getWebhookHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': process.env.WEBHOOK_AUTH_HEADER || '',
  };
}
