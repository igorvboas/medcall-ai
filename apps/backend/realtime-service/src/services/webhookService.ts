/**
 * Webhook dispatch service with outbox pattern and exponential backoff retry.
 * Phase 6 (WBHK-03, WBHK-04): All webhook dispatch points call dispatchWebhookWithRetry()
 * instead of raw fetch().
 */

import { getWebhookUrl, getWebhookHeaders } from '../config/webhookConfig';
import { recordWebhookDelivery, updateWebhookDelivery, logError } from '../config/database';

const RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s per D-04

export interface WebhookPayload {
  consultationId: string;
  doctorId: string | null;
  patientId: string;
  transcription: string;
  consulta_finalizada: boolean;
  paciente_entrou_sala: boolean;
  tipo_consulta: 'ONLINE' | 'PRESENCIAL';
  env: string;
}

/**
 * Dispatch webhook with outbox tracking and automatic retry.
 * Per D-02: Records 'pending' BEFORE HTTP call. Updates to 'success'/'failed' after.
 * Per D-06: Non-blocking -- never blocks finalization. Fire-and-forget with internal error handling.
 * Per D-07: Retries only on network errors and 5xx. 4xx (except 429) not retried.
 */
export function dispatchWebhookWithRetry(
  consultationId: string,
  webhookData: WebhookPayload,
  webhookType: 'transcricao' = 'transcricao'
): void {
  // Fire-and-forget: wrap in async IIFE with top-level catch per Pitfall 1
  (async () => {
    try {
      const webhookUrl = getWebhookUrl(webhookType);

      // Record pending delivery BEFORE attempt (per D-02)
      const deliveryId = await recordWebhookDelivery({
        consultation_id: consultationId,
        webhook_url: webhookUrl,
        payload: webhookData as unknown as Record<string, any>,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
      });

      if (!deliveryId) {
        console.error(`[WEBHOOK] Falha ao registrar delivery para consultation ${consultationId} -- prosseguindo com dispatch sem tracking`);
      }

      await attemptWebhookWithRetry(deliveryId, webhookUrl, webhookData, 0, consultationId);
    } catch (error) {
      // Top-level catch: NEVER let an exception escape (per Pitfall 1)
      console.error(`[WEBHOOK] Erro fatal no dispatchWebhookWithRetry:`, error);
      await logError(
        'Erro fatal no dispatchWebhookWithRetry',
        'error',
        consultationId,
        { error: error instanceof Error ? error.message : String(error) }
      ).catch(() => {}); // logError itself should not throw
    }
  })();
}

async function attemptWebhookWithRetry(
  deliveryId: string | null,
  url: string,
  payload: WebhookPayload,
  attempt: number,
  consultationId: string
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getWebhookHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[WEBHOOK] Webhook enviado com sucesso (${res.status}) para consultation ${consultationId}`);
      if (deliveryId) {
        await updateWebhookDelivery(deliveryId, {
          status: 'success',
          attempts: attempt + 1,
          response_status: res.status,
          last_attempt_at: new Date().toISOString(),
        });
      }
      return;
    }

    // 4xx (except 429) -- do not retry, it's a payload/auth issue (per D-07)
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const body = await res.text().catch(() => '');
      console.warn(`[WEBHOOK] HTTP ${res.status} - nao retentavel para consultation ${consultationId}`);
      if (deliveryId) {
        await updateWebhookDelivery(deliveryId, {
          status: 'failed',
          attempts: attempt + 1,
          response_status: res.status,
          response_body: body.substring(0, 1000),
          error_message: `HTTP ${res.status} - not retryable`,
          last_attempt_at: new Date().toISOString(),
        });
      }
      return;
    }

    // 5xx or 429 -- retry (per D-07)
    throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    const nextAttempt = attempt + 1;
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (deliveryId) {
      await updateWebhookDelivery(deliveryId, {
        attempts: nextAttempt,
        error_message: errorMsg,
        last_attempt_at: new Date().toISOString(),
      });
    }

    if (nextAttempt >= 3) {
      console.error(`[WEBHOOK] Falhou apos 3 tentativas para consultation ${consultationId}: ${errorMsg}`);
      if (deliveryId) {
        await updateWebhookDelivery(deliveryId, { status: 'failed' });
      }
      await logError(
        'Webhook falhou apos 3 tentativas',
        'error',
        consultationId,
        { deliveryId, error: errorMsg, attempts: nextAttempt }
      ).catch(() => {});
      return;
    }

    // Schedule retry with exponential backoff (per D-04)
    const delay = RETRY_DELAYS[nextAttempt - 1] || 45000;
    console.log(`[WEBHOOK] Tentativa ${nextAttempt}/3 falhou para consultation ${consultationId}. Retry em ${delay / 1000}s...`);
    setTimeout(() => {
      attemptWebhookWithRetry(deliveryId, url, payload, nextAttempt, consultationId)
        .catch((err) => {
          console.error(`[WEBHOOK] Erro no retry ${nextAttempt}:`, err);
        });
    }, delay);
  }
}
