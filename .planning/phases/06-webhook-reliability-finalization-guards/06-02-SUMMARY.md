---
phase: "06-webhook-reliability-finalization-guards"
plan: "02"
subsystem: "realtime-service finalization paths"
tags: [mutex, finalization-guard, webhook-retry, conditional-cleanup, status-transition]
dependency_graph:
  requires: ["06-01"]
  provides: ["guarded-finalization", "webhook-retry-all-paths", "conditional-room-cleanup"]
  affects: ["routes/rooms.ts", "websocket/rooms.ts", "websocket/presencial.ts", "presencialSessionManager.ts"]
tech_stack:
  added: []
  patterns: ["mutex-lock-with-finally", "dbWriteSuccess-conditional-cleanup", "fire-and-forget-webhook", "terminal-status-guard"]
key_files:
  modified:
    - apps/backend/realtime-service/src/routes/rooms.ts
    - apps/backend/realtime-service/src/websocket/rooms.ts
    - apps/backend/realtime-service/src/websocket/presencial.ts
    - apps/backend/realtime-service/src/services/presencialSessionManager.ts
decisions:
  - "Lock released in finally block to prevent permanent deadlock on exceptions"
  - "COMPLETED status set after all DB writes (not before) to ensure data integrity"
  - "Webhook dispatched after COMPLETED status set, fire-and-forget (no await)"
  - "Room/session preserved in memory on DB failure with 10-min safety timer"
  - "Removed unused node-fetch import from presencialSessionManager"
metrics:
  duration_seconds: 344
  completed: "2026-04-01T00:46:23Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 06 Plan 02: Wire Guards and WebhookService into All Finalization Paths Summary

Mutex finalization guard, terminal-status check, conditional room cleanup, and dispatchWebhookWithRetry wired into all 3 finalization entry points (HTTP route, WebSocket endRoom, presencial endSession).

## What Was Done

### Task 1: HTTP finalization route (routes/rooms.ts) [4d42a7f]

- Added `tryAcquireFinalizationLock` at handler entry; returns 200 with `already_finalizing: true` on conflict
- Added `isTerminalStatus` check against DB; returns 200 with `already_completed: true` for COMPLETED consultations
- Wrapped DB writes in `try-finally` with `releaseFinalizationLock` in `finally`
- Added `dbWriteSuccess` flag; room deleted only when DB writes succeed
- Added 10-minute safety timer for room cleanup on DB failure
- Set `status: 'COMPLETED'` after all DB writes succeed
- Replaced raw `fetch(webhookUrl, ...)` with `dispatchWebhookWithRetry` (fire-and-forget)
- Removed `getWebhookUrl`/`getWebhookHeaders` imports (moved to webhookService)

### Task 2: WebSocket endRoom handler (websocket/rooms.ts) [2f20325]

- Added `tryAcquireFinalizationLock` after host verification; returns idempotent callback on conflict
- Added `isTerminalStatus` check from DB before proceeding
- Wrapped DB writes in `try-finally` with `releaseFinalizationLock` in `finally`
- Added `dbWriteSuccess` flag; room + timer + mapping cleanup only when DB writes succeed
- Added 10-minute safety timer for cleanup on DB failure
- Set `status: 'COMPLETED'` after all DB writes succeed
- Replaced raw `fetch` with `dispatchWebhookWithRetry`
- Participant notification (`roomEnded` emit) remains outside dbWriteSuccess check (always fires)

### Task 3: Presencial finalization (presencial.ts + presencialSessionManager.ts) [cf7d7d0]

- **presencial.ts**: Added `tryAcquireFinalizationLock(sessionId)` in `endPresencialSession` handler with inner `try-finally` for lock release
- **presencialSessionManager.ts**: Added `isTerminalStatus` check at start of `endSession()`
- Added `dbWriteSuccess` flag wrapping all DB writes (saveTranscriptions, consultation update, call_session update, pricing)
- Set `status: 'COMPLETED'` after DB writes succeed
- Replaced raw `fetch` webhook with `dispatchWebhookWithRetry` (fire-and-forget)
- Conditional cleanup: 5-min timer on success, 10-min safety timer on DB failure
- Removed unused `node-fetch` import and `getWebhookUrl`/`getWebhookHeaders`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused node-fetch import from presencialSessionManager.ts**
- **Found during:** Task 3
- **Issue:** After replacing raw fetch with dispatchWebhookWithRetry, the `import fetch from 'node-fetch'` was unused
- **Fix:** Removed the import to avoid lint/build warnings
- **Files modified:** presencialSessionManager.ts
- **Commit:** cf7d7d0

## Known Stubs

None -- all functionality is wired to real implementations.

## Decisions Made

1. **Lock in finally block**: `releaseFinalizationLock` always in `finally` to prevent permanent lock on any exception path
2. **COMPLETED after all writes**: Status set to COMPLETED only after all DB writes succeed, ensuring data integrity before marking terminal
3. **Fire-and-forget webhook**: `dispatchWebhookWithRetry` called without await, per D-06 (non-blocking finalization)
4. **Room preserved on failure**: On DB error, room stays in memory for potential retry; 10-minute safety timer prevents permanent leak
