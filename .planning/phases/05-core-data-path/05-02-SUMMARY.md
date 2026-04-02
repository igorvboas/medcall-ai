---
phase: 05-core-data-path
plan: 02
subsystem: api
tags: [webhook, transcription, supabase, finalization, crash-safe]

# Dependency graph
requires:
  - phase: 05-01
    provides: "PostgreSQL RPC for atomic transcription append, centralized webhookConfig.ts"
provides:
  - "All 3 finalization points read transcription from DB instead of in-memory arrays"
  - "All 3 webhook dispatch points use centralized webhookConfig.ts"
  - "All webhook payloads include tipo_consulta and env fields"
affects: [06-webhook-outbox, 07-finalization-guards]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DB-read finalization pattern: read transcriptions.raw_text -> copy to consultations.transcricao", "Centralized webhook dispatch via webhookConfig.ts"]

key-files:
  created: []
  modified:
    - apps/backend/realtime-service/src/routes/rooms.ts
    - apps/backend/realtime-service/src/websocket/rooms.ts
    - apps/backend/realtime-service/src/services/presencialSessionManager.ts

key-decisions:
  - "Removed db.saveConsultationTranscription() from finalization -- RPC handles incremental saves during consultation"
  - "All webhook payloads now read transcription from DB, not in-memory state -- crash-safe"

patterns-established:
  - "DB-read finalization: all finalization paths read from transcriptions.raw_text, never from room.transcriptions or session.transcriptions arrays"
  - "Webhook centralization: all dispatch points use getWebhookUrl/getWebhookHeaders/getEnv from webhookConfig.ts"

requirements-completed: [TRNS-01, TRNS-02, WBHK-01]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 05 Plan 02: Core Data Path Finalization Summary

**Refactored all 3 finalization endpoints to read transcription from DB (crash-safe) and all 3 webhook dispatch points to use centralized webhookConfig.ts with standardized payloads including tipo_consulta**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T23:40:27Z
- **Completed:** 2026-03-31T23:44:07Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- All 3 finalization points (HTTP, WebSocket, Presencial) now read transcription from `transcriptions.raw_text` in DB instead of in-memory arrays -- data survives crashes
- All 3 webhook dispatch points use centralized `webhookConfig.ts` -- no more hardcoded URLs scattered across 3 files
- All webhook payloads include `tipo_consulta` ('ONLINE' or 'PRESENCIAL') and `env` via `getEnv()` -- standardized per D-12, D-13
- Removed `db.saveConsultationTranscription()` calls from finalization -- RPC from Plan 01 handles incremental saves

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor routes/rooms.ts finalization and webhook dispatch** - `a56328e` (feat)
2. **Task 2: Refactor websocket/rooms.ts finalization and webhook dispatch** - `bb607ee` (feat)
3. **Task 3: Refactor presencialSessionManager.ts finalization and webhook dispatch** - `3cf1fd2` (feat)

## Files Created/Modified
- `apps/backend/realtime-service/src/routes/rooms.ts` - HTTP finalization reads transcription from DB, webhook uses centralized config
- `apps/backend/realtime-service/src/websocket/rooms.ts` - WebSocket endRoom reads transcription from DB, webhook uses centralized config
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` - Presencial saveTranscriptions reads from DB, webhook uses centralized config

## Decisions Made
- Removed `db.saveConsultationTranscription()` from finalization paths -- the RPC function from Plan 01 handles all incremental writes to `transcriptions` table during the consultation, so finalization only needs to copy `transcriptions.raw_text` to `consultations.transcricao`
- All webhook transcription payloads now read from DB rather than in-memory state -- ensures crash-safe data path end-to-end

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree branch did not have Plan 01 outputs (webhookConfig.ts, database.ts refactor). Resolved by merging `homolog` branch into the worktree branch before starting task execution.

## User Setup Required

None - no external service configuration required. (Note: The SQL migration from Plan 01 still needs to be run in Supabase SQL Editor if not done already.)

## Next Phase Readiness
- All 3 finalization and webhook dispatch points are now standardized
- Ready for webhook outbox pattern (retry + tracking) in future phase
- Ready for finalization guards (idempotency, mutex) in future phase

---
*Phase: 05-core-data-path*
*Completed: 2026-03-31*
