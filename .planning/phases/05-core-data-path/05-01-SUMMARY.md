---
phase: 05-core-data-path
plan: 01
subsystem: database
tags: [postgresql, rpc, supabase, webhook, atomic-operations]

# Dependency graph
requires: []
provides:
  - "PostgreSQL RPC function append_transcription_text for atomic text upsert"
  - "Refactored appendConsultationTranscription using supabase.rpc()"
  - "Centralized webhookConfig.ts with getWebhookUrl, getWebhookHeaders, getEnv"
affects: [05-core-data-path]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PostgreSQL RPC upsert via supabase.rpc()", "Centralized config module per environment"]

key-files:
  created:
    - apps/backend/realtime-service/supabase/migrations/append_transcription_text.sql
    - apps/backend/realtime-service/src/config/webhookConfig.ts
  modified:
    - apps/backend/realtime-service/src/config/database.ts

key-decisions:
  - "Used INSERT ON CONFLICT upsert pattern instead of separate INSERT/UPDATE paths"
  - "CASE expression for newline handling avoids leading newline on empty raw_text"
  - "webhookConfig uses NODE_ENV only, no FRONTEND_URL fallback (simplification per D-09)"

patterns-established:
  - "Atomic DB operations via PostgreSQL RPC functions called through supabase.rpc()"
  - "Environment-based config modules exporting getter functions"

requirements-completed: [TRNS-03, TRNS-04, WBHK-02]

# Metrics
duration: 1min
completed: 2026-03-31
---

# Phase 5 Plan 1: Core Data Path Foundation Summary

**PostgreSQL RPC for atomic transcription append, refactored database.ts to eliminate race condition, and centralized webhook config module**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-31T23:36:37Z
- **Completed:** 2026-03-31T23:37:58Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created PostgreSQL RPC function `append_transcription_text` with INSERT ON CONFLICT upsert pattern, eliminating read-modify-write race condition
- Refactored `appendConsultationTranscription` from 48 lines of select+conditional insert/update to 12 lines using `supabase.rpc()`, preserving identical function signature
- Created `webhookConfig.ts` with environment-aware URL resolution matching frontend webhook-config.ts URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PostgreSQL RPC function** - `6b4d248` (feat)
2. **Task 2: Refactor appendConsultationTranscription to use RPC** - `68bd8ae` (feat)
3. **Task 3: Create centralized webhook configuration module** - `164c6b4` (feat)

## Files Created/Modified
- `apps/backend/realtime-service/supabase/migrations/append_transcription_text.sql` - PostgreSQL RPC function for atomic text upsert with UNIQUE constraint
- `apps/backend/realtime-service/src/config/database.ts` - Refactored appendConsultationTranscription to use supabase.rpc()
- `apps/backend/realtime-service/src/config/webhookConfig.ts` - Centralized webhook URLs and headers based on NODE_ENV

## Decisions Made
- Used INSERT ON CONFLICT upsert pattern to handle both first-segment insert and subsequent-segment append in a single SQL statement
- CASE expression handles empty/null raw_text to avoid leading newline (Pitfall 2 from research)
- webhookConfig.ts uses NODE_ENV directly without FRONTEND_URL fallback, as backend should not depend on frontend env vars (D-09)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**SQL migration must be run manually.** The file `apps/backend/realtime-service/supabase/migrations/append_transcription_text.sql` must be executed in the Supabase SQL Editor before deploying backend changes. This:
1. Adds UNIQUE constraint on `transcriptions.consultation_id`
2. Creates the `append_transcription_text` RPC function
3. Grants execute permission to `service_role`

If duplicate `consultation_id` values exist in the transcriptions table, manual deduplication is required before running the migration.

## Issues Encountered
None

## Next Phase Readiness
- All three artifacts (SQL RPC, refactored database.ts, webhookConfig.ts) are ready for Plan 02
- Plan 02 will wire these into finalization and webhook dispatch points
- SQL migration must be applied before Plan 02 backend deployment

---
*Phase: 05-core-data-path*
*Completed: 2026-03-31*
