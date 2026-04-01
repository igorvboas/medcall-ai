# Phase 7: Session Resilience & DB Integrity - Research

**Researched:** 2026-03-31
**Domain:** WebSocket disconnect/reconnect handling, PostgreSQL transactional RPCs via Supabase
**Confidence:** HIGH

## Summary

Phase 7 addresses two distinct but related concerns: (1) WebSocket session resilience -- ensuring sessions survive disconnections gracefully with timeout-based cleanup and automatic reconnection, and (2) database integrity -- making finalization writes atomic via a PostgreSQL RPC and adding a NOT NULL constraint on `transcriptions.consultation_id`.

The codebase already has strong foundations for both concerns. The `rooms.ts` disconnect handler already nullifies socket IDs and calls `resetRoomExpiration()` with smart timeout logic (3/15/30 min). The `joinRoom` handler already detects host/participant reconnection and restores socket mappings. The `supabase.rpc()` pattern is established from Phase 5's `append_transcription_text`. This phase primarily extends existing patterns rather than introducing new ones.

The presencial disconnect handler (`presencial.ts` line 404) is a no-op that only logs -- it needs actual cleanup logic. The three finalization paths (HTTP `finalize/:roomId`, WebSocket `endRoom`, presencial `endSession`) each make 3-5 sequential DB writes that need consolidation into a single RPC call.

**Primary recommendation:** Extend the existing room expiration system with explicit disconnect state tracking, and create a `finalize_consultation` PostgreSQL RPC that wraps the critical finalization writes in a transaction.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When a WebSocket disconnects during an active consultation, the room transitions to a "disconnected" state instead of being immediately deleted. The room data stays in memory, and a cleanup timer starts.
- **D-02:** Configurable disconnect timeout: 5 minutes for host disconnect, 3 minutes for participant disconnect. These values align with the existing `resetRoomExpiration` pattern which already implements smart timeouts based on room occupancy (3 min empty, 15 min with 1 person).
- **D-03:** During the disconnect timeout window, transcription is paused (Deepgram connection closed per existing `closeOpenAIConnection` behavior), but all room/session data is preserved in memory for potential reconnection.
- **D-04:** After timeout expires without reconnection, run cleanup: update `consultations.status` to a terminal state, update `call_sessions.status` to 'ended', then delete the room from memory. Log via `logError()` for observability.
- **D-05:** For presencial sessions (`presencial.ts`): add a disconnect handler with timeout. Current implementation logs disconnect but does nothing -- add the same timeout-based cleanup pattern. Use `presencialSessionManager` to handle the cleanup logic.
- **D-06:** Client reconnects by calling the existing `joinRoom` (online) or `joinPresencialSession` (presencial) with the same credentials. Backend detects that the room already exists and restores socket mapping instead of creating a new room.
- **D-07:** On successful rejoin, backend sends transcription history from DB (`transcriptions.raw_text`) so the client can restore its display. The `joinRoom` handler already returns `transcriptionHistory` -- ensure this works for reconnection scenarios too.
- **D-08:** On rejoin, cancel the disconnect cleanup timer so the session continues normally. Use `clearTimeout` on the stored timer reference.
- **D-09:** Backend marks the room as "reconnected" (clear the disconnected state) and resumes normal operation. Deepgram connection is re-established when the client starts sending audio again (existing behavior -- no change needed).
- **D-10:** Create a PostgreSQL RPC function `finalize_consultation(p_consultation_id, p_transcription, p_status, p_duration_minutes)` that performs all critical finalization writes in a single transaction: (1) copy transcription to `consultations.transcricao`, (2) update `consultations.status` to 'COMPLETED', (3) update `consultations.duration` and `updated_at`, (4) update `call_sessions.status` to 'ended' and `ended_at`.
- **D-11:** The RPC replaces the sequential individual `supabase.from().update()` calls in the finalization paths. All 3 finalization entry points call this single RPC instead of making 3-4 separate DB writes.
- **D-12:** The `webhook_deliveries` insert is NOT part of this transaction -- it's handled separately by `webhookService.ts` (fire-and-forget, non-blocking per Phase 6 D-06). Webhook tracking has its own retry logic and should not block/rollback the finalization transaction.
- **D-13:** If the RPC fails (transaction rolled back), the finalization is treated as failed -- room preserved in memory per Phase 6 D-14/D-15, and the 10-minute safety timer applies.
- **D-14:** Create a SQL migration that: (1) deletes orphan rows where `consultation_id IS NULL` (these are unusable data without a consultation reference), (2) adds `ALTER TABLE transcriptions ALTER COLUMN consultation_id SET NOT NULL`.
- **D-15:** The UNIQUE constraint on `consultation_id` already exists (added in Phase 5 for the atomic append RPC). The NOT NULL constraint is additive and doesn't conflict.
- **D-16:** Verify that all code paths that INSERT into `transcriptions` always provide a `consultation_id`. The Phase 5 RPC `append_transcription_text` already requires `p_consultation_id` -- no code change needed for that path.

### Claude's Discretion
- Internal implementation of the disconnect state tracking (boolean flag on room object vs. separate Map)
- Exact log messages for disconnect/reconnect/cleanup events
- Whether to create the finalization RPC in its own migration file or combine with the NOT NULL migration
- PostgreSQL function parameter names and return type
- Whether presencial disconnect timeout differs from online timeout

### Deferred Ideas (OUT OF SCOPE)
- **OBSV-02**: Alerts for prolonged orphaned sessions -- Phase 7 does cleanup, but alerting/monitoring is v2+ scope.
- Frontend reconnection UI improvements (progress indicator, retry button) -- backend-only phase, frontend has basic support already.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | Sessoes orfas limpas automaticamente apos timeout de inatividade no disconnect WebSocket | Existing `resetRoomExpiration`/`cleanExpiredRoom` pattern extended with disconnect-specific state and configurable timeouts (D-01 through D-05) |
| SESS-02 | Reconexao WebSocket com rejoin automatico de sala (manter transcricao fluindo) | Existing `joinRoom` handler already handles reconnection for host/participant; needs disconnect timer cancellation on rejoin (D-06 through D-09) |
| DBAS-01 | Transacoes na finalizacao (atomicidade multi-table writes via RPC PostgreSQL) | New `finalize_consultation` RPC wrapping consultations + call_sessions updates in single transaction; replaces 3-5 sequential writes across 3 finalization paths (D-10 through D-13) |
| DBAS-02 | `consultation_id` NOT NULL em tabela `transcriptions` | SQL migration to delete orphan rows then add NOT NULL constraint; UNIQUE already exists from Phase 5 (D-14 through D-16) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | Existing in project | Supabase client for `supabase.rpc()` calls | Already used; JS client lacks transaction support, RPCs are the established workaround |
| PostgreSQL `plpgsql` | Supabase-hosted | Transaction-wrapped RPC functions | Established pattern from Phase 5 `append_transcription_text` |
| Socket.IO | `^4.8.1` | WebSocket transport with built-in reconnection | Already in use; has `disconnect`/`reconnect` events built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `setTimeout`/`clearTimeout` | Built-in | Disconnect cleanup timers | Timer-based orphan session cleanup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory disconnect state on room object | Separate `disconnectedRooms` Map | Separate Map adds indirection; room object flag is simpler and co-located with room data. Recommend flag on room object. |
| Single combined migration file | Separate migration files for RPC and NOT NULL | Separate files are cleaner for rollback, but combined is simpler since both are Phase 7. Recommend separate for clarity. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/realtime-service/
  src/
    websocket/
      rooms.ts              # Extended disconnect handler + rejoin timer cancellation
      presencial.ts          # New disconnect handler with timeout cleanup
    services/
      presencialSessionManager.ts  # Extended with disconnect cleanup method
    config/
      database.ts            # New finalizeConsultation() wrapper for RPC
    shared/
      finalizationGuard.ts   # Unchanged -- still needed around RPC call
  supabase/migrations/
    finalize_consultation.sql     # New RPC function
    add_not_null_consultation_id.sql  # NOT NULL constraint migration
```

### Pattern 1: Disconnect State Tracking on Room Object
**What:** Add `disconnectedAt: string | null` and `disconnectTimer: NodeJS.Timeout | null` properties to the room object. When a disconnect occurs, set `disconnectedAt` to current ISO timestamp and start a cleanup timer. On rejoin, clear both fields and cancel the timer.
**When to use:** For online rooms in `rooms.ts`.
**Example:**
```typescript
// In disconnect handler
if (room) {
  room.disconnectedAt = new Date().toISOString();
  // Clear existing room expiration timer
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }
  // Start disconnect-specific timer
  const timeoutMs = (socket.id === room.hostSocketId) ? 5 * 60 * 1000 : 3 * 60 * 1000;
  const timer = setTimeout(() => cleanDisconnectedRoom(roomId), timeoutMs);
  roomTimers.set(roomId, timer); // Reuse existing roomTimers Map
}

// In joinRoom handler (on reconnection)
if (room.disconnectedAt) {
  room.disconnectedAt = null;
  // Timer cancellation happens via resetRoomExpiration() which already clears roomTimers
}
```

### Pattern 2: PostgreSQL Finalization RPC
**What:** A `plpgsql` function that wraps multiple table updates in a single transaction. Returns a boolean or JSON result indicating success/failure.
**When to use:** All 3 finalization paths call this instead of sequential writes.
**Example:**
```sql
CREATE OR REPLACE FUNCTION finalize_consultation(
  p_consultation_id UUID,
  p_transcription TEXT,
  p_status TEXT DEFAULT 'COMPLETED',
  p_duration_minutes NUMERIC DEFAULT NULL,
  p_call_session_room_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Copy transcription to consultations.transcricao
  UPDATE consultations
  SET transcricao = p_transcription,
      status = p_status,
      consulta_finalizada = true,
      consulta_fim = NOW(),
      duracao = p_duration_minutes,
      updated_at = NOW()
  WHERE id = p_consultation_id;

  -- 2. Update call_sessions if room_id provided
  IF p_call_session_room_id IS NOT NULL THEN
    UPDATE call_sessions
    SET status = 'ended',
        ended_at = NOW(),
        webrtc_active = false
    WHERE room_id = p_call_session_room_id;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;  -- Re-raise to trigger transaction rollback
END;
$$;
```

### Pattern 3: Presencial Disconnect Cleanup
**What:** The presencial `socket.on('disconnect')` handler currently only logs. It needs to start a cleanup timer that calls `presencialSessionManager.cleanupDisconnectedSession(sessionId)` after timeout.
**When to use:** `presencial.ts` disconnect handler.
**Example:**
```typescript
socket.on('disconnect', (reason) => {
  console.log(`[PRESENCIAL] ${userName} desconectado: ${reason}`);
  const sessionId = /* lookup from socket */;
  if (sessionId) {
    const session = presencialSessionManager.getSession(sessionId);
    if (session && session.status === 'active') {
      session.disconnectedAt = new Date().toISOString();
      // Start cleanup timer (5 min for presencial since it's always the doctor)
      const timer = setTimeout(() => {
        presencialSessionManager.cleanupDisconnectedSession(sessionId);
      }, 5 * 60 * 1000);
      // Store timer reference for cancellation on rejoin
    }
  }
});
```

### Anti-Patterns to Avoid
- **Sequential DB writes without error aggregation:** Current finalization makes 3-5 separate writes where failure of one doesn't stop the others. The RPC ensures all-or-nothing atomicity.
- **Immediate room deletion on disconnect:** Current behavior nullifies socket IDs but relies on the generic room expiration timer. Phase 7 adds explicit "disconnected" state with shorter, configurable timeouts.
- **Cleaning up presencial sessions on disconnect:** Currently `presencial.ts` disconnect handler is a no-op. Orphaned presencial sessions leak memory indefinitely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-table atomic writes | Sequential `supabase.from().update()` calls with manual rollback | PostgreSQL RPC (`plpgsql` function) | JS Supabase client has no transaction support; sequential writes leave partial state on failure |
| Disconnect timer management | Custom timer tracking system | Existing `roomTimers` Map + `setTimeout`/`clearTimeout` | Pattern already proven in `startRoomExpiration`/`resetRoomExpiration` |
| Client reconnection protocol | Custom reconnection handshake | Existing `joinRoom`/`joinPresencialSession` handlers | Already handle host/participant re-joining with socket remapping |

**Key insight:** The Supabase JS client explicitly does not support multi-statement transactions. The project already solved this with RPCs in Phase 5. Phase 7 extends the same pattern to finalization writes.

## Common Pitfalls

### Pitfall 1: Timer Reference Leak on Room Deletion
**What goes wrong:** If a room is deleted (by finalization) while a disconnect timer is active, the timer fires on a non-existent room, causing undefined behavior or errors.
**Why it happens:** The disconnect timer and finalization can race -- user disconnects, then reconnects and finalizes before the timer fires.
**How to avoid:** Always clear disconnect timers when the room is finalized or deleted. The existing pattern of clearing `roomTimers` in `cleanExpiredRoom` and `endRoom` already handles this, but ensure the new disconnect timer uses the same `roomTimers` Map.
**Warning signs:** "Room not found" errors in cleanup timer callbacks.

### Pitfall 2: Presencial Session ID Lookup from Socket
**What goes wrong:** In `presencial.ts`, there's no direct mapping from `socket.id` to `sessionId` -- the session is identified by `consultationId` or doctor credentials, not socket ID.
**Why it happens:** The presencial namespace doesn't use the same `socketToRoom` pattern as online rooms.
**How to avoid:** Store a `socketToSession` mapping in the presencial namespace, or use the `userName` (which is the doctor's auth ID) to look up the active session via `presencialSessionManager`.
**Warning signs:** `sessionId` is undefined in the disconnect handler.

### Pitfall 3: RPC Parameter Mismatch Between Paths
**What goes wrong:** The three finalization paths compute duration differently -- `routes/rooms.ts` uses `calculateDuration(room.createdAt)` in seconds then divides by 60, while `presencialSessionManager.ts` computes it from `session.startTime`. If the RPC expects minutes but one path sends seconds, data is corrupted.
**Why it happens:** Each finalization path was developed independently with slightly different duration calculations.
**How to avoid:** Standardize all callers to pass `durationMinutes` (float) to the RPC. Document the expected unit in the function signature.
**Warning signs:** Consultation duration values that are 60x too large or too small.

### Pitfall 4: NOT NULL Migration Fails on Existing Data
**What goes wrong:** `ALTER TABLE transcriptions ALTER COLUMN consultation_id SET NOT NULL` fails if any rows have `consultation_id IS NULL`.
**Why it happens:** The migration must DELETE orphan rows first, but if run out of order or if new NULL rows are inserted between the DELETE and ALTER, it fails.
**How to avoid:** Run DELETE and ALTER in the same transaction (single SQL script). The migration SQL should be: `DELETE FROM transcriptions WHERE consultation_id IS NULL; ALTER TABLE transcriptions ALTER COLUMN consultation_id SET NOT NULL;`
**Warning signs:** Migration error "column consultation_id of relation transcriptions contains null values".

### Pitfall 5: Disconnect During Active Finalization
**What goes wrong:** If the host disconnects while finalization is in progress (RPC call in flight), the disconnect timer starts. When finalization completes, the room is deleted. Then the disconnect timer fires on a deleted room.
**Why it happens:** Disconnect and finalization are independent events that can overlap.
**How to avoid:** In the disconnect handler, check if finalization is in progress (via `finalizingRooms` Set). If so, skip starting the disconnect timer -- finalization will handle cleanup.
**Warning signs:** Double cleanup attempts logged for the same room.

### Pitfall 6: endRoom Fallback Consultation Creation Bypasses RPC
**What goes wrong:** The `endRoom` handler has a fallback path that creates a new consultation if `room.consultationId` is null (lines 1407-1455). This path would need to be updated to use the RPC too, but the RPC assumes a consultation already exists.
**Why it happens:** Edge case where no consultation was created before finalization.
**How to avoid:** The RPC should only be called when `consultationId` is known. The fallback creation path continues with sequential writes (it's creating, not finalizing). Document this exception clearly.
**Warning signs:** Fallback consultations not getting atomic treatment.

## Code Examples

### Calling the Finalization RPC from TypeScript
```typescript
// In database.ts -- new wrapper function
export async function finalizeConsultation(params: {
  consultationId: string;
  transcription: string;
  status?: string;
  durationMinutes?: number;
  callSessionRoomId?: string;
}): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('finalize_consultation', {
      p_consultation_id: params.consultationId,
      p_transcription: params.transcription,
      p_status: params.status || 'COMPLETED',
      p_duration_minutes: params.durationMinutes || null,
      p_call_session_room_id: params.callSessionRoomId || null,
    });
    if (error) {
      console.error('[DB] finalize_consultation RPC failed:', error);
      logError('finalize_consultation RPC falhou', 'error', params.consultationId, {
        error: error.message,
        code: error.code,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[DB] Exception in finalizeConsultation:', e);
    return false;
  }
}
```

### Disconnect Handler Extension for rooms.ts
```typescript
socket.on('disconnect', () => {
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) { socketToRoom.delete(socket.id); return; }

  const room = rooms.get(roomId);
  if (!room) { socketToRoom.delete(socket.id); return; }

  const isHost = socket.id === room.hostSocketId;

  // Nullify socket references (existing behavior)
  if (isHost) {
    room.hostSocketId = null;
    db.setWebRTCActive(roomId, false);
  }
  if (socket.id === room.participantSocketId) {
    room.participantSocketId = null;
    if (room.participantUserName) userToRoom.delete(room.participantUserName);
    room.participantUserName = null;
    db.setWebRTCActive(roomId, false);
  }

  // NEW: Set disconnected state
  room.disconnectedAt = new Date().toISOString();

  // Use disconnect-specific timeout (D-02)
  // Skip if finalization is already in progress
  const timeoutMs = isHost ? 5 * 60 * 1000 : 3 * 60 * 1000;

  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
  }
  const timer = setTimeout(() => cleanDisconnectedRoom(roomId), timeoutMs);
  roomTimers.set(roomId, timer);

  closeOpenAIConnection(userName, 'usuario desconectou');
  socketToRoom.delete(socket.id);
});
```

### Reconnection Timer Cancellation in joinRoom
```typescript
// Inside joinRoom handler, after detecting reconnection:
if (room.disconnectedAt) {
  console.log(`[REJOIN] Clearing disconnect state for room ${roomId}`);
  room.disconnectedAt = null;
  // resetRoomExpiration already clears and resets the timer
}
resetRoomExpiration(roomId);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential DB writes via Supabase JS | PostgreSQL RPCs for atomicity | Phase 5 (current milestone) | Established pattern -- Phase 7 extends it to finalization |
| Immediate socket cleanup on disconnect | Timer-based expiration with reconnection window | Already exists in `startRoomExpiration` | Phase 7 adds explicit disconnect state and shorter timeouts |

**Deprecated/outdated:**
- The `closeOpenAIConnection` function is a stub (Realtime API was removed). It's called but does nothing. No impact on Phase 7.

## Open Questions

1. **RPC Return Type: Boolean vs JSON**
   - What we know: Phase 5's `append_transcription_text` returns VOID. The finalization RPC needs to communicate success/failure.
   - What's unclear: Whether to return a simple BOOLEAN or a JSON with details (e.g., which tables were updated).
   - Recommendation: Return BOOLEAN for simplicity. The caller only needs success/failure. If it fails, the error propagates via the EXCEPTION handler and Supabase returns the error in the response.

2. **Cost Calculation Inside or Outside RPC**
   - What we know: `aiPricingService.calculateAndUpdateConsultationCost()` runs after DB writes in all finalization paths. It's non-blocking and failure doesn't block finalization.
   - What's unclear: Whether this should be inside the RPC transaction or remain outside.
   - Recommendation: Keep outside the RPC. It's a separate concern, calls its own DB updates, and shouldn't cause finalization rollback if it fails.

3. **PROCESSING vs COMPLETED Status in RPC**
   - What we know: Current finalization first sets status to PROCESSING, does work, then sets COMPLETED. The RPC should set the final status directly.
   - What's unclear: Whether intermediate PROCESSING state is still needed for any downstream consumers.
   - Recommendation: The RPC should accept the target status as a parameter (default COMPLETED). The caller can pass PROCESSING if intermediate state is needed, then call again with COMPLETED. But per the current flow, the RPC should set COMPLETED directly since all critical work is done atomically.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test files exist in the backend |
| Config file | None -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | Disconnect triggers timeout-based cleanup | manual-only | Manual: disconnect WebSocket during active session, verify room persists for 5 min then cleans up | N/A |
| SESS-02 | Reconnection within timeout restores session | manual-only | Manual: disconnect, reconnect within timeout, verify transcription history sent | N/A |
| DBAS-01 | Finalization RPC is atomic (all or nothing) | manual-only | Manual: call `finalize_consultation` RPC via Supabase SQL editor, verify all tables updated atomically | N/A |
| DBAS-02 | `consultation_id` NOT NULL enforced | manual-only | Manual: attempt INSERT with NULL consultation_id, verify rejection | N/A |

### Sampling Rate
- **Per task commit:** Manual verification of the specific behavior changed
- **Per wave merge:** Manual end-to-end test: full consultation with disconnect/reconnect
- **Phase gate:** All 4 success criteria verified manually

### Wave 0 Gaps
- No test infrastructure exists for the backend. All verification is manual.
- Justification: Backend is a real-time WebSocket service with Supabase dependency -- unit testing would require extensive mocking. Manual verification is appropriate for this phase scope.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `rooms.ts` disconnect handler (line 1632), `startRoomExpiration` (line 163), `cleanExpiredRoom` (line 105), `joinRoom` (line 547) -- direct code inspection
- Codebase analysis: `presencial.ts` disconnect handler (line 404) -- confirms no-op behavior
- Codebase analysis: `presencialSessionManager.ts` `endSession()` (line 816) -- sequential DB writes to replace
- Codebase analysis: `routes/rooms.ts` `finalize/:roomId` (line 217) -- sequential DB writes to replace
- Codebase analysis: `finalizationGuard.ts` -- mutex and status transition patterns (unchanged by this phase)
- Codebase analysis: `append_transcription_text.sql` -- established PostgreSQL RPC pattern
- Codebase analysis: `database.ts` `appendConsultationTranscription()` (line 1027) -- established `supabase.rpc()` call pattern
- Codebase analysis: `useConnectionState.ts` -- frontend reconnection state machine (RECONNECTING, RECONNECT_ATTEMPT, etc.)

### Secondary (MEDIUM confidence)
- Supabase documentation: JS client does not support multi-statement transactions; RPCs are the recommended approach -- confirmed by project constraint in CLAUDE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all patterns established
- Architecture: HIGH - extending existing disconnect/timer/RPC patterns with clear codebase evidence
- Pitfalls: HIGH - identified from direct code analysis of the three finalization paths and disconnect handlers

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependency changes expected)
