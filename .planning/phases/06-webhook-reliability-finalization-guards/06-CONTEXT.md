# Phase 6: Webhook Reliability & Finalization Guards - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend changes to track webhook deliveries with automatic retry on failure, and protect the finalization process against duplicate invocations, status regressions, and premature memory cleanup. Builds on Phase 5's centralized webhook config and atomic transcription saves. No frontend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Webhook Delivery Tracking — Outbox Pattern (WBHK-03)
- **D-01:** Create `webhook_deliveries` table in Supabase with columns: `id` (UUID, PK), `consultation_id` (UUID, FK), `webhook_url` (TEXT), `payload` (JSONB), `status` (TEXT: 'pending'|'success'|'failed'), `attempts` (INT, default 0), `max_attempts` (INT, default 3), `last_attempt_at` (TIMESTAMPTZ), `response_status` (INT), `response_body` (TEXT), `error_message` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
- **D-02:** Every webhook dispatch writes a record to `webhook_deliveries` with status='pending' BEFORE making the HTTP call. On success, update to 'success'. On failure, update with error details and increment attempts.
- **D-03:** Create a database utility function `recordWebhookDelivery()` and `updateWebhookDelivery()` in `database.ts` for consistent tracking across all 3 dispatch points.

### Webhook Retry with Exponential Backoff (WBHK-04)
- **D-04:** In-process retry using `setTimeout` with exponential backoff: 3 attempts total, intervals of 5s, 15s, 45s. No external job scheduler needed — Node.js setTimeout is sufficient.
- **D-05:** Create a `dispatchWebhookWithRetry()` function in a new `webhookService.ts` (or extend `webhookConfig.ts`) that wraps the fetch call with retry logic and `webhook_deliveries` tracking. All 3 dispatch points call this function instead of raw `fetch()`.
- **D-06:** After max retries exhausted, mark delivery as 'failed' in `webhook_deliveries` and log via `logError()`. Do NOT block finalization — webhook retry is non-blocking.
- **D-07:** Retry only on network errors and 5xx responses. 4xx responses (except 429) are not retried — they indicate a payload/auth issue.

### Finalization Mutex — Duplicate Prevention (FINL-01)
- **D-08:** Use an in-memory `Set<string>` called `finalizingRooms` (or `finalizingSessions` for presencial). Check at the top of every finalization handler: if roomId/sessionId is in the set, return idempotently (success response, no error). If not, add it and proceed.
- **D-09:** Remove from the set only after finalization completes (success or unrecoverable failure). This prevents concurrent HTTP+WebSocket finalization from executing simultaneously.
- **D-10:** For the HTTP endpoint (`POST /api/rooms/finalize/:roomId`), return 200 with `{ already_finalizing: true }` if the room is already being finalized. For WebSocket (`endRoom`), call the callback with success (idempotent).

### Status Transition Guard (FINL-02)
- **D-11:** Before starting finalization, check current consultation status from the database. If status is already 'COMPLETED' or 'PROCESSING', return idempotently without re-executing finalization logic.
- **D-12:** Add a 'COMPLETED' status transition at the END of successful finalization (after all DB writes and webhook dispatch). Current code stops at 'PROCESSING' — add a final update to 'COMPLETED'.
- **D-13:** Status transitions are one-directional: CREATED → RECORDING → PROCESSING → COMPLETED. Never go backwards. Any attempt to set a lower status is a no-op.

### Room Preservation on DB Failure (FINL-03)
- **D-14:** Do NOT delete room/session from memory if any DB write fails during finalization. Only delete after ALL critical writes succeed (transcription consolidation + consultation status update).
- **D-15:** If DB write fails, keep the room in memory and log the error. The room remains available for retry (manual or automatic). Set a cleanup timer (e.g., 10 minutes) as a safety net — if no retry succeeds within the timer, clean up and log a critical error.
- **D-16:** Move room deletion to AFTER the try-catch block, gated by a `dbWriteSuccess` boolean flag.

### Finalization Idempotency (FINL-04)
- **D-17:** If `consultations.status` is already 'COMPLETED' when finalization is requested, return success without re-executing any logic. This makes retry safe — calling finalize twice produces the same result.
- **D-18:** If finalization partially completed (e.g., transcription saved but webhook not sent), re-running should skip already-completed steps. Use DB state (consultation status, webhook_deliveries status) to determine what still needs to happen.

### Claude's Discretion
- Whether to create `webhookService.ts` as a new file or extend `webhookConfig.ts`
- Internal retry timer implementation details (setTimeout vs setInterval)
- PostgreSQL migration file naming convention
- Error message formatting for `logError()` calls
- Whether `finalizingRooms` Set lives in a shared module or per-file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Webhook Dispatch (Phase 5 output)
- `apps/backend/realtime-service/src/config/webhookConfig.ts` — Centralized webhook URLs, `getWebhookUrl()`, `getWebhookHeaders()`, `getEnv()`. Wrap or extend for retry.
- `apps/backend/realtime-service/src/routes/rooms.ts` — HTTP finalization endpoint (line 214), webhook dispatch (line 332). First dispatch point to refactor.
- `apps/backend/realtime-service/src/websocket/rooms.ts` — WebSocket `endRoom` handler (line 1290), webhook dispatch (line 1539). Second dispatch point.
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — `endSession()` (line 814), webhook dispatch (line 890). Third dispatch point.

### Backend — Database & Error Logging
- `apps/backend/realtime-service/src/config/database.ts` — `logError()` (line 1381), `updateConsultation()` (line 429). Add `recordWebhookDelivery()` and `updateWebhookDelivery()` functions.
- `apps/backend/realtime-service/supabase/migrations/` — Location for new SQL migration creating `webhook_deliveries` table.

### Backend — Status Management
- `apps/backend/realtime-service/src/websocket/rooms.ts` — Room deletion (line 1591), status updates (line 1356). Room cleanup must be conditional on DB success.
- `apps/backend/realtime-service/src/websocket/presencial.ts` — `endPresencialSession` handler (line 209). Presencial finalization trigger.

### Systematic Review
- `REVISAO_SISTEMATICA_CONSULTAS.md` — Findings #3 (webhook no retry), #4 (room deleted on DB failure), #6 (duplicate finalization), #7 (status regression).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webhookConfig.ts` — Already centralized webhook URLs and headers. Can be extended with retry logic or wrapped by a new `webhookService.ts`.
- `logError()` in database.ts — Existing error logging to `log_erros` table. Use for failed webhook attempts and finalization errors.
- `supabase.rpc()` pattern — Established in Phase 5 for atomic operations. Can be used for status transition guards if needed.
- `presencialSessionManager.isProcessing` flag — Existing pattern for simple boolean guard (not a mutex, but shows the pattern is accepted in the codebase).

### Established Patterns
- Webhook dispatch: `fetch(getWebhookUrl('transcricao'), { method: 'POST', headers: getWebhookHeaders(), body: JSON.stringify(payload) })` — all 3 points follow this pattern from Phase 5.
- Error handling: try-catch with `logError()`, non-blocking.
- Room lifecycle: `rooms.get(roomId)` → process → `rooms.delete(roomId)`.
- Supabase client with service role key for direct DB access.

### Integration Points
- All 3 webhook dispatch points need to call `dispatchWebhookWithRetry()` instead of raw `fetch()`.
- All 3 finalization entry points need mutex check at the top.
- Room deletion in `websocket/rooms.ts` (line 1591) needs to be gated by `dbWriteSuccess`.
- New migration for `webhook_deliveries` table.

</code_context>

<specifics>
## Specific Ideas

- The `finalizingRooms` Set should be declared in a shared location (e.g., at the top of `rooms.ts` or in a shared state module) so both HTTP endpoint and WebSocket handler can check it.
- Status transition guard should query `consultations.status` from DB at the start of finalization — don't rely on in-memory room state for this check.
- The `webhook_deliveries` table serves as both outbox (tracking) and audit log — no separate audit table needed.
- Retry timers should use `setTimeout` chained, not `setInterval` — each retry is independent and may succeed or fail.
- The 'COMPLETED' status should only be set after webhook dispatch succeeds OR after all retry attempts are exhausted (webhook failure doesn't block completion status).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Webhook dashboard/monitoring is Phase 7+ (OBSV-01 in v2+ requirements).

</deferred>

---

*Phase: 06-webhook-reliability-finalization-guards*
*Context gathered: 2026-03-31*
