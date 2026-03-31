/**
 * Centralized webhook configuration for backend realtime-service.
 * All webhook dispatch points import from this file instead of hardcoding URLs.
 * Phase 5 (WBHK-02): Single source of truth for webhook URLs based on NODE_ENV.
 */

const WEBHOOK_URLS: Record<string, Record<string, string>> = {
  transcricao: {
    homolog: 'https://triahook.gst.dev.br/webhook/80a69a11-a580-40c2-95da-7eb19f103d59/:usi-analise-homolog',
    production: 'https://triahook.gst.dev.br/webhook/usi-analise-v2',
    localhost: 'https://triahook.gst.dev.br/webhook/80a69a11-a580-40c2-95da-7eb19f103d59/:usi-analise-homolog',
  },
};

/**
 * Detect current environment from NODE_ENV.
 * Returns 'homolog' | 'production' | 'localhost' per D-13.
 */
export function getEnv(): 'homolog' | 'production' | 'localhost' {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'homolog') return 'homolog';
  if (nodeEnv === 'production') return 'production';
  return 'localhost';
}

/**
 * Get webhook URL for a given type.
 * Per D-10: localhost uses homolog URL for dev testing.
 */
export function getWebhookUrl(type: 'transcricao'): string {
  const env = getEnv();
  return WEBHOOK_URLS[type][env];
}

/**
 * Get standard webhook headers.
 * Per D-11: Content-Type + Authorization from env.
 */
export function getWebhookHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': process.env.WEBHOOK_AUTH_HEADER || '',
  };
}
