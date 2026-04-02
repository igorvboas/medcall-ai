# Phase 7: Session Resilience & DB Integrity - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend changes to handle WebSocket disconnections gracefully (orphan session cleanup + reconnection with room rejoin), and make finalization DB writes atomic via a PostgreSQL RPC transaction. Also adds a NOT NULL constraint on `transcriptions.consultation_id`. Builds on Phase 5's atomic append RPC and Phase 6's finalization guards. No frontend changes in this phase — the frontend already has reconnection state management (`useConnectionState.ts`), this phase adds the backend support.

</domain>

<decisions>
## Implementation Decisions

### Orphan Session Cleanup on Disconnect (SESS-01)
- **D-01:** When a WebSocket disconnects during an active consultation, the room transitions to a "disconnected" state instead of being immediately deleted. The room data stays in memory, and a cleanup timer starts.
- **D-02:** Configurable disconnect timeout: 5 minutes for host disconnect, 3 minutes for participant disconnect. These values align with the existing `resetRoomExpiration` pattern which already implements smart timeouts based on room occupancy (3 min empty, 15 min with 1 person).
- **D-03:** During the disconnect timeout window, transcription is paused (Deepgram connection closed per existing `closeOpenAIConnection` behavior), but all room/session data is preserved in memory for potential reconnection.
- **D-04:** After timeout expires without reconnection, run cleanup: update `consultations.status` to a terminal state, update `call_sessions.status` to 'ended', then delete the room from memory. Log via `logError()` for observability.
- **D-05:** For presencial sessions (`presencial.ts`): add a disconnect handler with timeout. Current implementation logs disconnect but does nothing — add the same timeout-based cleanup pattern. Use `presencialSessionManager` to handle the cleanup logic.

### WebSocket Reconnection with Room Rejoin (SESS-02)
- **D-06:** Client reconnects by calling the existing `joinRoom` (online) or `joinPresencialSession` (presencial) with the same credentials. Backend detects that the room already exists and restores socket mapping instead of creating a new room.
- **D-07:** On successful rejoin, backend sends transcription history from DB (`transcriptions.raw_text`) so the client can restore its display. The `joinRoom` handler already returns `transcriptionHistory` — ensure this works for reconnection scenarios too.
- **D-08:** On rejoin, cancel the disconnect cleanup timer so the session continues normally. Use `clearTimeout` on the stored timer reference.
- **D-09:** Backend marks the room as "reconnected" (clear the disconnected state) and resumes normal operation. Deepgram connection is re-established when the client starts sending audio again (existing behavior — no change needed).

### Atomic Finalization via PostgreSQL RPC (DBAS-01)
- **D-10:** Create a PostgreSQL RPC function `finalize_consultation(p_consultation_id, p_transcription, p_status, p_duration_minutes)` that performs all critical finalization writes in a single transaction: (1) copy transcription to `consultations.transcricao`, (2) update `consultations.status` to 'COMPLETED', (3) update `consultations.duration` and `updated_at`, (4) update `call_sessions.status` to 'ended' and `ended_at`.
- **D-11:** The RPC replaces the sequential individual `supabase.from().update()` calls in the finalization paths. All 3 finalization entry points call this single RPC instead of making 3-4 separate DB writes.
- **D-12:** The `webhook_deliveries` insert is NOT part of this transaction — it's handled separately by `webhookService.ts` (fire-and-forget, non-blocking per Phase 6 D-06). Webhook tracking has its own retry logic and should not block/rollback the finalization transaction.
- **D-13:** If the RPC fails (transaction rolled back), the finalization is treated as failed — room preserved in memory per Phase 6 D-14/D-15, and the 10-minute safety timer applies.

### NOT NULL Constraint on transcriptions.consultation_id (DBAS-02)
- **D-14:** Create a SQL migration that: (1) deletes orphan rows where `consultation_id IS NULL` (these are unusable data without a consultation reference), (2) adds `ALTER TABLE transcriptions ALTER COLUMN consultation_id SET NOT NULL`.
- **D-15:** The UNIQUE constraint on `consultation_id` already exists (added in Phase 5 for the atomic append RPC). The NOT NULL constraint is additive and doesn't conflict.
- **D-16:** Verify that all code paths that INSERT into `transcriptions` always provide a `consultation_id`. The Phase 5 RPC `append_transcription_text` already requires `p_consultation_id` — no code change needed for that path.

### Claude's Discretion
- Internal implementation of the disconnect state tracking (boolean flag on room object vs. separate Map)
- Exact log messages for disconnect/reconnect/cleanup events
- Whether to create the finalization RPC in its own migration file or combine with the NOT NULL migration
- PostgreSQL function parameter names and return type
- Whether presencial disconnect timeout differs from online timeout

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Disconnect & Reconnection
- `apps/backend/realtime-service/src/websocket/rooms.ts` — `socket.on('disconnect')` handler (line 1632), `resetRoomExpiration()` (line 218), `cleanExpiredRoom()` (line 105), `joinRoom` handler. Current disconnect handler nullifies socket IDs and resets expiration timer but doesn't have explicit "disconnected" state.
- `apps/backend/realtime-service/src/websocket/presencial.ts` — `socket.on('disconnect')` handler (line 404). Currently only logs — needs orphan cleanup.
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — Session lifecycle management. Needs disconnect timeout logic.
- `apps/frontend/src/hooks/useConnectionState.ts` — Frontend reconnection state machine (RECONNECTING, RECONNECT_ATTEMPT, RECONNECT_SUCCESS, RECONNECT_FAILED). Already handles client-side reconnection states — backend needs to support the rejoin.

### Backend — Finalization & DB Writes
- `apps/backend/realtime-service/src/routes/rooms.ts` — HTTP finalization with sequential DB writes (Phase 6 modified). Replace sequential writes with single RPC call.
- `apps/backend/realtime-service/src/websocket/rooms.ts` — WebSocket `endRoom` with sequential DB writes (Phase 6 modified). Replace with single RPC call.
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — `endSession()` with sequential DB writes. Replace with single RPC call.
- `apps/backend/realtime-service/src/shared/finalizationGuard.ts` — Mutex and status guards (Phase 6). Unchanged — still needed around the RPC call.

### Backend — Database & Migrations
- `apps/backend/realtime-service/src/config/database.ts` — Supabase client, `logError()`, `updateConsultation()`. Add `finalizeConsultation()` wrapper for the new RPC.
- `apps/backend/realtime-service/supabase/migrations/append_transcription_text.sql` — Phase 5 RPC + UNIQUE constraint. Reference for migration pattern.
- `apps/backend/realtime-service/supabase/migrations/create_webhook_deliveries.sql` — Phase 6 migration. Reference for migration pattern.

### Systematic Review
- `REVISAO_SISTEMATICA_CONSULTAS.md` — Findings #8 (orphaned sessions on disconnect), #9 (no reconnection support), #10 (finalization not atomic), #11 (consultation_id nullable).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resetRoomExpiration()` and `roomTimers` Map — Existing timeout pattern for room cleanup. Can be extended or adapted for disconnect-specific timeouts.
- `cleanExpiredRoom()` — Existing cleanup function that handles room deletion, user mapping cleanup, call_sessions update. Can serve as the template for disconnect cleanup.
- `supabase.rpc()` — Established pattern from Phase 5 (`append_transcription_text`). Same pattern for `finalize_consultation`.
- `useConnectionState.ts` — Frontend already has full reconnection state machine with RECONNECTING → RECONNECT_ATTEMPT → RECONNECT_SUCCESS/FAILED flow. Backend just needs to support the rejoin.
- `joinRoom` handler — Already returns `transcriptionHistory` and handles re-joining an existing room. May need minor adjustments for reconnection vs. fresh join.

### Established Patterns
- Room lifecycle: `rooms.get(roomId)` → process → `rooms.delete(roomId)` with timer-based cleanup.
- Socket mapping: `socketToRoom`, `userToRoom` Maps for bidirectional lookup.
- Timer management: `roomTimers` Map stores timeout references, cleared on room activity.
- PostgreSQL RPC: `supabase.rpc('function_name', { params })` for atomic operations.
- Error handling: try-catch with `logError()`, non-blocking.

### Integration Points
- Disconnect handler in `rooms.ts` needs enhanced state tracking (not just null socket IDs).
- Disconnect handler in `presencial.ts` needs actual cleanup logic (currently a no-op).
- All 3 finalization paths need to call `finalizeConsultation()` RPC instead of sequential writes.
- New SQL migration for `finalize_consultation` RPC + NOT NULL constraint.

</code_context>

<specifics>
## Specific Ideas

- The disconnect handler should set a `disconnectedAt` timestamp on the room object, so on rejoin the backend knows how long the disconnect lasted (useful for logging/metrics).
- The `joinRoom` handler already checks if the user was previously in the room and handles re-joining — verify this works correctly for the disconnect-reconnect scenario.
- The `finalize_consultation` RPC should return success/failure boolean so the caller can set `dbWriteSuccess` accordingly (maintaining Phase 6's conditional room deletion pattern).
- For the NOT NULL migration, run a COUNT of NULL rows first in a dry-run query to assess impact before deleting.
- The presencial disconnect timeout should match the session's `isProcessing` flag — if processing is in progress, extend the timeout or skip cleanup entirely.

</specifics>

<deferred>
## Deferred Ideas

- **OBSV-02**: Alerts for prolonged orphaned sessions — Phase 7 does cleanup, but alerting/monitoring is v2+ scope.
- Frontend reconnection UI improvements (progress indicator, retry button) — backend-only phase, frontend has basic support already.

</deferred>

---

*Phase: 07-session-resilience-db-integrity*
*Context gathered: 2026-03-31*
