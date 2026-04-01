# Phase 6: Webhook Reliability & Finalization Guards - Research

**Researched:** 2026-03-31
**Domain:** Backend reliability patterns (outbox, retry, mutex, idempotency)
**Confidence:** HIGH

## Summary

Phase 6 addresses six requirements across two domains: (1) webhook delivery tracking and retry, and (2) finalization process safety guards. The codebase has 3 webhook dispatch points (HTTP rooms.ts, WebSocket rooms.ts, presencialSessionManager.ts) that all follow the same `fetch(getWebhookUrl(), { headers: getWebhookHeaders(), body })` pattern from Phase 5. All three need to be refactored to use a single `dispatchWebhookWithRetry()` function.

The finalization code currently deletes rooms/sessions from memory unconditionally after the try-catch block (rooms.ts line 1591, presencialSessionManager.ts line 941), regardless of whether DB writes succeeded. There is no mutex preventing concurrent HTTP + WebSocket finalization, and the status lifecycle stops at 'PROCESSING' -- never reaching 'COMPLETED'. These are all fixable with in-process patterns (no external dependencies needed).

**Primary recommendation:** Create a `webhookService.ts` that owns dispatch+retry+tracking, a `finalizationGuard.ts` that owns the mutex Set and status transition logic, and a SQL migration for `webhook_deliveries`. All changes are backend-only, in-process, zero new dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `webhook_deliveries` table schema (UUID PK, consultation_id FK, webhook_url, payload JSONB, status TEXT, attempts INT, max_attempts INT, last_attempt_at, response_status INT, response_body TEXT, error_message TEXT, created_at, updated_at)
- D-02: Write 'pending' record BEFORE HTTP call; update to 'success'/'failed' after
- D-03: `recordWebhookDelivery()` and `updateWebhookDelivery()` in database.ts
- D-04: In-process setTimeout retry with exponential backoff: 3 attempts, 5s/15s/45s intervals
- D-05: `dispatchWebhookWithRetry()` in new webhookService.ts wrapping fetch + retry + tracking
- D-06: After max retries, mark 'failed' and logError(). Non-blocking -- never block finalization
- D-07: Retry only on network errors and 5xx. 4xx (except 429) not retried
- D-08: In-memory `Set<string>` called `finalizingRooms` -- check at top of every finalization handler
- D-09: Remove from set only after finalization completes (success or unrecoverable failure)
- D-10: HTTP returns 200 `{ already_finalizing: true }`. WebSocket callback with success (idempotent)
- D-11: Check DB status before finalization. If COMPLETED or PROCESSING, return idempotently
- D-12: Add COMPLETED status at END of successful finalization (after all DB writes + webhook dispatch)
- D-13: Status one-directional: CREATED -> RECORDING -> PROCESSING -> COMPLETED. Never go backwards
- D-14: Do NOT delete room/session from memory if DB write fails. Only delete after ALL critical writes succeed
- D-15: Keep room in memory on DB failure, log error, set 10-minute cleanup timer as safety net
- D-16: Move room deletion to AFTER try-catch, gated by `dbWriteSuccess` boolean flag
- D-17: If status already COMPLETED, return success without re-executing
- D-18: Re-running finalization skips already-completed steps using DB state

### Claude's Discretion
- Whether to create `webhookService.ts` as a new file or extend `webhookConfig.ts`
- Internal retry timer implementation (setTimeout vs setInterval)
- PostgreSQL migration file naming convention
- Error message formatting for logError() calls
- Whether `finalizingRooms` Set lives in a shared module or per-file

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope. Webhook dashboard/monitoring is Phase 7+ (OBSV-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WBHK-03 | Registro de entregas de webhook em tabela `webhook_deliveries` (outbox pattern) | SQL migration for table, `recordWebhookDelivery()` / `updateWebhookDelivery()` in database.ts, pending->success/failed lifecycle |
| WBHK-04 | Retry automatico com backoff exponencial em caso de falha do webhook | `dispatchWebhookWithRetry()` in webhookService.ts, setTimeout chain at 5s/15s/45s, retry only on network+5xx errors |
| FINL-01 | Guard contra finalizacao duplicada (mutex/flag isFinalizing por room) | In-memory `Set<string>` checked at top of all 3 finalization entry points, idempotent response for duplicates |
| FINL-02 | Guard de status transition (nao regredir COMPLETED para PROCESSING) | DB status check before finalization, one-directional state machine, add COMPLETED terminal state |
| FINL-03 | Room nao deletada da memoria se DB write falhou | `dbWriteSuccess` boolean flag, conditional room.delete, 10-min safety cleanup timer |
| FINL-04 | Finalizacao idempotente (retry seguro sem duplicar dados) | Check consultation status + webhook_deliveries status to skip already-completed steps |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `setTimeout` | N/A (Node 24.14) | Exponential backoff retry scheduling | No external scheduler needed for 3 retries with short intervals. In-process is simpler and sufficient. |
| `@supabase/supabase-js` | Already installed | DB operations for webhook_deliveries table | Already the project's DB client. Use for insert/update on tracking table. |
| `fetch` (Node built-in) | Node 24 native | HTTP webhook dispatch | Already used in all 3 dispatch points. No change needed. |

### Supporting
No new libraries needed. This phase is purely architectural refactoring of existing patterns.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process setTimeout retry | Bull/BullMQ with Redis | Overkill for 3 retries. Adds Redis dependency. Only needed if retries must survive server restarts. |
| In-memory Set mutex | PostgreSQL advisory locks | Adds DB round-trip latency to every finalization. In-memory is fine for single-process Node server. |
| Custom outbox pattern | pg-boss or graphile-worker | Full job queue is overkill. The outbox table is simple INSERT/UPDATE. |

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/realtime-service/src/
  services/
    webhookService.ts          # NEW: dispatchWebhookWithRetry(), retry logic
  config/
    webhookConfig.ts           # EXISTING: getWebhookUrl(), getWebhookHeaders()
    database.ts                # MODIFIED: add recordWebhookDelivery(), updateWebhookDelivery()
  shared/
    finalizationGuard.ts       # NEW: finalizingRooms Set, status transition checks
  routes/
    rooms.ts                   # MODIFIED: use webhookService + finalizationGuard
  websocket/
    rooms.ts                   # MODIFIED: use webhookService + finalizationGuard, conditional room deletion
    presencial.ts              # MODIFIED: use finalizationGuard
  services/
    presencialSessionManager.ts # MODIFIED: use webhookService + finalizationGuard, conditional session deletion
  supabase/migrations/
    create_webhook_deliveries.sql # NEW: webhook_deliveries table
```

### Pattern 1: Outbox Pattern for Webhook Tracking
**What:** Write a 'pending' record to `webhook_deliveries` BEFORE making the HTTP call. Update status after.
**When to use:** Every webhook dispatch.
**Example:**
```typescript
// In webhookService.ts
async function dispatchWebhookWithRetry(
  consultationId: string,
  webhookData: WebhookPayload,
  webhookType: 'transcricao'
): Promise<void> {
  const webhookUrl = getWebhookUrl(webhookType);

  // Record pending delivery BEFORE attempt
  const deliveryId = await recordWebhookDelivery({
    consultation_id: consultationId,
    webhook_url: webhookUrl,
    payload: webhookData,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
  });

  // Attempt with retry
  await attemptWebhookWithRetry(deliveryId, webhookUrl, webhookData, 0);
}
```

### Pattern 2: setTimeout Chain for Exponential Backoff
**What:** Chain setTimeout calls with increasing delays. Each attempt is independent.
**When to use:** On webhook failure (network error or 5xx).
**Example:**
```typescript
const RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s

async function attemptWebhookWithRetry(
  deliveryId: string,
  url: string,
  payload: WebhookPayload,
  attempt: number
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getWebhookHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await updateWebhookDelivery(deliveryId, {
        status: 'success',
        attempts: attempt + 1,
        response_status: res.status,
        last_attempt_at: new Date().toISOString(),
      });
      return;
    }

    // 4xx (except 429) -- do not retry, it's a payload/auth issue
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const body = await res.text().catch(() => '');
      await updateWebhookDelivery(deliveryId, {
        status: 'failed',
        attempts: attempt + 1,
        response_status: res.status,
        response_body: body.substring(0, 1000),
        error_message: `HTTP ${res.status} - not retryable`,
        last_attempt_at: new Date().toISOString(),
      });
      return;
    }

    // 5xx or 429 -- retry
    throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    const nextAttempt = attempt + 1;
    await updateWebhookDelivery(deliveryId, {
      attempts: nextAttempt,
      error_message: error instanceof Error ? error.message : String(error),
      last_attempt_at: new Date().toISOString(),
    });

    if (nextAttempt >= 3) {
      await updateWebhookDelivery(deliveryId, { status: 'failed' });
      await logError('Webhook falhou apos 3 tentativas', 'error', /* consultationId from payload */);
      return;
    }

    // Schedule retry with backoff
    setTimeout(() => {
      attemptWebhookWithRetry(deliveryId, url, payload, nextAttempt);
    }, RETRY_DELAYS[nextAttempt - 1]);
  }
}
```

### Pattern 3: In-Memory Mutex with Set
**What:** A shared `Set<string>` prevents concurrent finalization of the same room/session.
**When to use:** At the top of every finalization handler.
**Example:**
```typescript
// finalizationGuard.ts
const finalizingRooms = new Set<string>();

export function tryAcquireFinalizationLock(id: string): boolean {
  if (finalizingRooms.has(id)) return false;
  finalizingRooms.add(id);
  return true;
}

export function releaseFinalizationLock(id: string): void {
  finalizingRooms.delete(id);
}
```

### Pattern 4: Status Transition Guard
**What:** One-directional status machine. Query DB status before proceeding.
**When to use:** Start of finalization, and any status update.
**Example:**
```typescript
const STATUS_ORDER: Record<string, number> = {
  'CREATED': 0,
  'RECORDING': 1,
  'PROCESSING': 2,
  'COMPLETED': 3,
};

export function canTransitionTo(current: string, next: string): boolean {
  return (STATUS_ORDER[next] ?? -1) > (STATUS_ORDER[current] ?? -1);
}
```

### Pattern 5: Conditional Room Deletion with dbWriteSuccess Flag
**What:** Track whether critical DB writes succeeded. Only delete room if they did.
**When to use:** After the finalization try-catch block.
**Example:**
```typescript
let dbWriteSuccess = false;
try {
  // ... DB writes (transcription consolidation, consultation status update)
  dbWriteSuccess = true;
} catch (dbError) {
  console.error('DB write failed:', dbError);
  logError('Finalizacao DB write falhou - room preservada na memoria', 'error', consultationId);
}

// Webhook dispatch (non-blocking, happens regardless of dbWriteSuccess)
dispatchWebhookWithRetry(consultationId, webhookData, 'transcricao');

// Room cleanup -- ONLY if DB writes succeeded
if (dbWriteSuccess) {
  rooms.delete(roomId);
} else {
  // Safety net: clean up after 10 minutes if no retry succeeds
  setTimeout(() => {
    if (rooms.has(roomId)) {
      rooms.delete(roomId);
      logError('Room cleanup timer - room removida apos 10min sem retry', 'error', consultationId);
    }
  }, 10 * 60 * 1000);
}
```

### Anti-Patterns to Avoid
- **Deleting room before DB write confirmation:** Current code deletes room unconditionally at line 1591 of websocket/rooms.ts. This loses data if DB writes fail.
- **Blocking finalization on webhook delivery:** Webhook dispatch must be fire-and-forget with async retry. Never `await` the full retry chain.
- **Using setInterval for retry:** setInterval fires repeatedly regardless of success. Use chained setTimeout -- each retry is triggered only if the previous failed.
- **Relying on in-memory state for status checks:** Status must be checked from DB, not from the in-memory room object, because another process/handler may have updated it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for delivery IDs | Custom ID generator | `crypto.randomUUID()` (Node 24 built-in) or let Supabase `gen_random_uuid()` handle it | Built-in, no dependency |
| Exponential backoff calculation | Manual math per retry | Constant array `[5000, 15000, 45000]` | Only 3 attempts -- a formula is overkill |
| Database transactions | Manual multi-step with rollback | Supabase RPC (PostgreSQL function) if atomicity needed | Supabase JS client does not support transactions |

**Key insight:** This phase uses only in-process patterns (Set, setTimeout, boolean flags). No external infrastructure is needed. The complexity is in correctly wiring the patterns into 3 existing dispatch points and 3 existing finalization paths, not in the patterns themselves.

## Common Pitfalls

### Pitfall 1: Fire-and-Forget Losing Error Context
**What goes wrong:** `dispatchWebhookWithRetry()` is called without await, so unhandled promise rejections crash the process.
**Why it happens:** The function is intentionally non-blocking, but internal errors in the retry chain bubble up.
**How to avoid:** The top-level function must catch ALL errors internally. Never let an exception escape `dispatchWebhookWithRetry()`. Wrap the entire chain in try-catch and log to `logError()`.
**Warning signs:** Unhandled promise rejection warnings in console.

### Pitfall 2: Mutex Never Released on Crash
**What goes wrong:** If finalization throws an unhandled exception, the roomId stays in `finalizingRooms` forever, blocking all future attempts.
**Why it happens:** The `releaseFinalizationLock()` call is skipped when the code path crashes.
**How to avoid:** Use try-finally pattern: `try { ... } finally { releaseFinalizationLock(id); }`
**Warning signs:** Room shows as "already finalizing" permanently even after errors.

### Pitfall 3: Presencial Session Manager Has Different Cleanup Pattern
**What goes wrong:** `presencialSessionManager.ts` uses a 5-minute setTimeout for session deletion (line 940-943), not an immediate `sessions.delete()`. The refactoring must handle this differently from rooms.ts.
**Why it happens:** Different codepaths have different cleanup strategies.
**How to avoid:** In presencialSessionManager, move the existing setTimeout cleanup to be conditional on `dbWriteSuccess`. If DB fails, use the 10-minute safety timer instead of the 5-minute one.
**Warning signs:** Sessions cleaned up even when DB writes failed.

### Pitfall 4: Status Check Race Condition
**What goes wrong:** Two finalization requests both check DB status (both see 'RECORDING'), both proceed.
**Why it happens:** The DB status check is not atomic with the status update.
**How to avoid:** The in-memory Set mutex (FINL-01) prevents this. The Set check happens BEFORE the DB check. As long as the Set is checked first, only one handler enters the finalization code path.
**Warning signs:** Duplicate webhook dispatches for the same consultation.

### Pitfall 5: Webhook Retry After Room Deletion
**What goes wrong:** Room is deleted from memory, then a webhook retry fires and tries to access room data.
**Why it happens:** Retry uses setTimeout which fires after room cleanup.
**How to avoid:** `dispatchWebhookWithRetry()` must receive all needed data as parameters (not room references). The webhook payload is captured at dispatch time, not looked up during retry.
**Warning signs:** "Room not found" errors during webhook retry.

### Pitfall 6: COMPLETED Status Set Before Webhook
**What goes wrong:** If COMPLETED is set before webhook dispatch, and webhook fails, the finalization is marked complete but webhook was never sent.
**Why it happens:** Decision D-12 says set COMPLETED at END of finalization.
**How to avoid:** Per the specific note in CONTEXT.md: COMPLETED should be set after webhook dispatch succeeds OR after all retries exhausted. Webhook failure should not block COMPLETED status permanently. Set COMPLETED after initiating webhook dispatch (fire-and-forget), since retries track independently in `webhook_deliveries`.
**Warning signs:** Consultations stuck at PROCESSING because webhook never succeeded.

## Code Examples

### SQL Migration: webhook_deliveries table
```sql
-- Phase 6 (WBHK-03): Webhook delivery tracking (outbox pattern)
-- RUN THIS IN SUPABASE SQL EDITOR

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES consultations(id),
  webhook_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by consultation
CREATE INDEX idx_webhook_deliveries_consultation_id ON webhook_deliveries(consultation_id);

-- Index for finding pending/failed deliveries (useful for future monitoring)
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status != 'success';

-- Grant access to service_role
GRANT ALL ON webhook_deliveries TO service_role;
```

### Database Helper: recordWebhookDelivery
```typescript
// In database.ts
export async function recordWebhookDelivery(data: {
  consultation_id: string;
  webhook_url: string;
  payload: Record<string, any>;
  status?: string;
  attempts?: number;
  max_attempts?: number;
}): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('webhook_deliveries')
    .insert({
      consultation_id: data.consultation_id,
      webhook_url: data.webhook_url,
      payload: data.payload,
      status: data.status || 'pending',
      attempts: data.attempts || 0,
      max_attempts: data.max_attempts || 3,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao registrar webhook delivery:', error);
    return null;
  }
  return row.id;
}

export async function updateWebhookDelivery(
  id: string,
  data: Partial<{
    status: string;
    attempts: number;
    last_attempt_at: string;
    response_status: number;
    response_body: string;
    error_message: string;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar webhook delivery:', error);
    return false;
  }
  return true;
}
```

### Finalization Guard Module
```typescript
// finalizationGuard.ts
const finalizingRooms = new Set<string>();

export function tryAcquireFinalizationLock(id: string): boolean {
  if (finalizingRooms.has(id)) return false;
  finalizingRooms.add(id);
  return true;
}

export function releaseFinalizationLock(id: string): void {
  finalizingRooms.delete(id);
}

const STATUS_ORDER: Record<string, number> = {
  'CREATED': 0,
  'RECORDING': 1,
  'PROCESSING': 2,
  'COMPLETED': 3,
};

export function canTransitionTo(currentStatus: string, targetStatus: string): boolean {
  const currentRank = STATUS_ORDER[currentStatus] ?? -1;
  const targetRank = STATUS_ORDER[targetStatus] ?? -1;
  return targetRank > currentRank;
}

export function isTerminalStatus(status: string): boolean {
  return status === 'COMPLETED';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fire-and-forget webhooks | Outbox pattern with tracking table | Industry standard | Audit trail, retry capability |
| No retry on failure | Exponential backoff retry | Industry standard | Higher delivery rate |
| No concurrent protection | In-memory mutex | Common pattern | Prevents duplicate processing |
| Unconditional cleanup | Conditional cleanup on success | Common pattern | Data preservation on failure |

## Open Questions

1. **Webhook dispatch timing relative to COMPLETED status**
   - What we know: D-12 says set COMPLETED at END, D-06 says webhook retry is non-blocking
   - What's unclear: Should COMPLETED wait for first webhook attempt, or just fire-and-forget immediately?
   - Recommendation: Set COMPLETED after initiating dispatch (not after all retries). The webhook_deliveries table tracks delivery independently. This avoids consultations stuck at PROCESSING.

2. **Presencial finalization entry point**
   - What we know: `endPresencialSession` in presencial.ts calls `presencialSessionManager.endSession()`. The mutex check should happen in the socket handler, not deep inside endSession().
   - What's unclear: Should presencialSessionManager.endSession() also check, or only the socket handler?
   - Recommendation: Check in the socket handler (presencial.ts line 209) for consistency with rooms.ts pattern. The manager focuses on business logic.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 3 webhook dispatch points, all 3 finalization handlers, room/session deletion code
- `webhookConfig.ts` -- Phase 5 centralized webhook config (verified)
- `database.ts` -- `logError()` signature, `updateConsultation()` pattern (verified)
- `presencialSessionManager.ts` -- `isProcessing` flag pattern, session cleanup timer (verified)
- `append_transcription_text.sql` -- Existing migration naming convention (verified)

### Secondary (MEDIUM confidence)
- Outbox pattern is a well-established distributed systems pattern. No external verification needed.
- Exponential backoff with setTimeout chain is standard Node.js practice.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies. All patterns use existing Node.js and Supabase primitives.
- Architecture: HIGH - Direct code inspection of all affected files. Integration points clearly identified.
- Pitfalls: HIGH - Identified from actual code patterns (unconditional room deletion, missing mutex, status lifecycle gap).

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable patterns, no external dependency risk)
