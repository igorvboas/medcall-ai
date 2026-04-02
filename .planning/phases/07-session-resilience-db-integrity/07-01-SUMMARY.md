---
phase: 07-session-resilience-db-integrity
plan: 01
subsystem: database
tags: [postgresql, rpc, supabase, migrations, atomicity]

requires:
  - phase: 05-core-data-path
    provides: append_transcription_text RPC pattern and UNIQUE constraint on transcriptions.consultation_id
  - phase: 06-webhook-reliability-finalization-guards
    provides: finalizationGuard mutex pattern and webhookService (excluded from this transaction per D-12)
provides:
  - finalize_consultation PostgreSQL RPC for atomic finalization writes
  - NOT NULL constraint on transcriptions.consultation_id
  - finalizeConsultation() TypeScript wrapper in database.ts
affects: [07-02, 07-03]

tech-stack:
  added: []
  patterns: [PostgreSQL RPC with EXCEPTION handler for atomic multi-table updates]

key-files:
  created:
    - apps/backend/realtime-service/supabase/migrations/finalize_consultation.sql
    - apps/backend/realtime-service/supabase/migrations/add_not_null_consultation_id.sql
  modified:
    - apps/backend/realtime-service/src/config/database.ts

key-decisions:
  - "webhook_deliveries excluded from finalization transaction per D-12 (separate retry logic)"
  - "RETURNS BOOLEAN for RPC to maintain Phase 6 dbWriteSuccess conditional pattern"

patterns-established:
  - "Multi-table atomic RPC: single plpgsql function with EXCEPTION WHEN OTHERS THEN RAISE for rollback"

requirements-completed: [DBAS-01, DBAS-02]

duration: 2min
completed: 2026-04-01
---

# Phase 7 Plan 01: DB Foundation Summary

**PostgreSQL RPC finalize_consultation for atomic consultation+call_session writes, with NOT NULL constraint on transcriptions.consultation_id**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T01:25:04Z
- **Completed:** 2026-04-01T01:26:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created finalize_consultation RPC with 5 parameters (consultation_id, transcription, status, duration_minutes, call_session_room_id) in a single PostgreSQL transaction
- Added NOT NULL constraint on transcriptions.consultation_id with orphan row cleanup
- Added finalizeConsultation() exported wrapper function to database.ts with error handling via logError

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migrations for finalize_consultation RPC and NOT NULL constraint** - `6a7e443` (feat)
2. **Task 2: Add finalizeConsultation() wrapper to database.ts** - `755676a` (feat)

## Files Created/Modified
- `apps/backend/realtime-service/supabase/migrations/finalize_consultation.sql` - PostgreSQL RPC for atomic finalization (UPDATE consultations + conditional UPDATE call_sessions)
- `apps/backend/realtime-service/supabase/migrations/add_not_null_consultation_id.sql` - Orphan cleanup + NOT NULL constraint migration
- `apps/backend/realtime-service/src/config/database.ts` - Added finalizeConsultation() standalone export with supabase.rpc call

## Decisions Made
- webhook_deliveries is NOT part of the finalization transaction (per D-12) -- handled separately by webhookService
- RPC returns BOOLEAN so callers can set dbWriteSuccess for Phase 6 conditional room deletion pattern
- Function placed as standalone export (not inside db object) matching Phase 6 recordWebhookDelivery pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**SQL migrations must be run manually in Supabase SQL Editor:**
1. Run `finalize_consultation.sql` first
2. Run `add_not_null_consultation_id.sql` second (depends on no NULL consultation_id rows existing)

## Next Phase Readiness
- finalize_consultation RPC ready for Plans 02 and 03 to wire into all 3 finalization paths
- finalizeConsultation() wrapper importable from database.ts
- TypeScript compilation verified clean

---
*Phase: 07-session-resilience-db-integrity*
*Completed: 2026-04-01*
