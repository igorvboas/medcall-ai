# Phase 5: Core Data Path - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend changes to ensure transcription data persists incrementally during online consultations (not only at session end), is consolidated into `consultations.transcricao` at finalization, and the webhook fires to the correct N8N URL based on NODE_ENV with the complete payload. No frontend changes in this phase. No webhook retry or finalization guards (those are Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Incremental Transcription Save (TRNS-01, TRNS-04)
- **D-01:** Save to `transcriptions.raw_text` on every speech segment (~5s intervals) — minimizes data loss window. Current code already calls `appendConsultationTranscription()` in some paths; ensure ALL transcription paths (online + presencial) consistently write incrementally.
- **D-02:** Use `transcriptions` table as the single source of truth for raw transcription text. `transcriptions_med` continues to exist for structured conversation data but `transcriptions.raw_text` is the canonical text record.
- **D-03:** If a `transcriptions` record doesn't exist for the consultation, create it on first segment. Use `consultation_id` as the lookup key.

### Atomic Append — Race Condition Fix (TRNS-03)
- **D-04:** Replace the read-modify-write pattern in `appendConsultationTranscription()` with SQL-level atomic append: `raw_text = COALESCE(raw_text, '') || new_text`. This eliminates the race condition where concurrent segments could overwrite each other.
- **D-05:** Use Supabase `.rpc()` for the atomic append since the JS client's `.update()` doesn't support SQL expressions. Create a simple PostgreSQL function `append_transcription_text(p_consultation_id, p_text)` that does the atomic concat + upsert.
- **D-06:** The RPC should handle both INSERT (first segment) and UPDATE (subsequent segments) — upsert pattern.

### Transcription Consolidation at Finalization (TRNS-02)
- **D-07:** At finalization, read `transcriptions.raw_text` and copy directly to `consultations.transcricao`. No format transformation — the `[SPEAKER] (HH:mm:ss): text` format is already human-readable.
- **D-08:** This replaces the current pattern of building `consultations.transcricao` from in-memory `room.transcriptions` array (which is lost on crash).

### Webhook URL Centralization (WBHK-02)
- **D-09:** Create a single backend utility file `apps/backend/realtime-service/src/config/webhookConfig.ts` that exports webhook URLs based on `NODE_ENV`. All webhook dispatch points import from this file.
- **D-10:** URL map structure: `{ homolog: '...usi-analise-homolog', production: '...usi-analise-v2', localhost: '...usi-analise-homolog' }`. Localhost uses homolog URL for dev testing.
- **D-11:** Export a `getWebhookUrl(type: 'transcricao' | ...)` function and a `getWebhookHeaders()` function. Headers include `Content-Type: application/json` and `Authorization` from env.

### Webhook Payload (WBHK-01)
- **D-12:** Standardize webhook payload across all dispatch points: `{ consultationId, doctorId, patientId, transcription, consulta_finalizada, paciente_entrou_sala, tipo_consulta, env }`.
- **D-13:** The `env` field is derived from `NODE_ENV`: 'homolog' | 'production' | 'localhost'.
- **D-14:** The `transcription` field contains the full `transcriptions.raw_text` content (read from DB at finalization, not from in-memory state).

### Claude's Discretion
- Internal implementation details of the PostgreSQL RPC function
- Error logging format for failed saves (use existing `logError()` pattern)
- Whether to add an index on `transcriptions.consultation_id` for faster lookups
- Naming conventions for new utility functions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Transcription Save Path
- `apps/backend/realtime-service/src/config/database.ts` — `addTranscriptionToSession()` (line 631), `appendConsultationTranscription()` (line 1027), `updateConsultation()` (line 429). All three functions need changes.
- `apps/backend/realtime-service/src/services/transcriptionService.ts` — `sendTranscriptionToRoom()` (line 570), `saveTranscriptionToDatabase()`. Ensure incremental save is called here.
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — `saveTranscriptionIncrementally()` (line 771), `endSession()` (line 813), `saveTranscriptions()` (line 962). Finalization and consolidation path.

### Backend — Finalization & Webhook
- `apps/backend/realtime-service/src/routes/rooms.ts` — Finalization endpoint (line 213), webhook dispatch (lines 318-353, line 1562). Two webhook dispatch points to centralize.
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — Webhook dispatch (lines 889-950). Third webhook dispatch point.

### Frontend — Webhook Config (reference only)
- `apps/frontend/src/lib/webhook-config.ts` — Frontend webhook URLs. Backend should NOT depend on this file, but URLs must stay consistent.

### Systematic Review
- `REVISAO_SISTEMATICA_CONSULTAS.md` — Original systematic review identifying all 14 CRITICAL issues. Phase 5 addresses findings #1 (transcription not saved incrementally), #2 (race condition), #5 (webhook URL hardcoded).

### Environment
- `apps/backend/realtime-service/.env` — NODE_ENV, WEBHOOK_AUTH_HEADER, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `appendConsultationTranscription()` in database.ts — existing function that appends to `transcriptions.raw_text`. Needs to be refactored to use atomic SQL append instead of read-modify-write.
- `logError()` / `logWarning()` in database.ts — error logging pattern to `log_erros` table. Use for save failures.
- `aiPricingService.calculateAndUpdateConsultationCost()` — called at finalization, no changes needed but must remain in the flow.
- Supabase client with service role key — already configured for direct DB access bypassing RLS.

### Established Patterns
- All DB operations use `supabase.from('table').insert/update/select()` pattern
- No existing RPC calls — Phase 5 introduces the first one for atomic append
- Error handling: try-catch with `logError()`, non-blocking (errors don't crash session)
- Webhook dispatch: `fetch()` with try-catch, fire-and-forget (retry is Phase 6)

### Integration Points
- `transcriptionService.ts` — Online consultation transcription path. Must call atomic append on every segment.
- `presencialSessionManager.ts` — Presencial consultation path. Already has incremental save, needs atomic append.
- `rooms.ts` — HTTP finalization endpoint. Must read from DB (not memory) for consolidation + webhook.
- New file: `config/webhookConfig.ts` — centralized webhook configuration.
- New PostgreSQL function: `append_transcription_text()` — atomic upsert for transcription text.

</code_context>

<specifics>
## Specific Ideas

- The PostgreSQL RPC `append_transcription_text` should use `INSERT ... ON CONFLICT (consultation_id) DO UPDATE SET raw_text = COALESCE(transcriptions.raw_text, '') || EXCLUDED.raw_text` for atomic upsert behavior.
- The webhook centralization should maintain backward compatibility — same URLs, same headers, same payload structure. Only the source of the URL changes (from hardcoded to imported).
- When consolidating at finalization, read `transcriptions.raw_text` from DB rather than building from in-memory state — this ensures crash recovery works even if in-memory data was lost.
- The `transcriptions.consultation_id` NOT NULL constraint is Phase 7 scope (DBAS-02), but Phase 5 should ensure all new writes always include consultation_id.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All decisions are implementation-level clarifications of the mapped requirements.

</deferred>

---

*Phase: 05-core-data-path*
*Context gathered: 2026-03-31*
