---
phase: 02-backend-diarization
plan: 01
subsystem: database
tags: [supabase, typescript, diarization, deepgram, postgresql]

# Dependency graph
requires:
  - phase: 01-validation-spike
    provides: "Validated diarization approach with 60s chunks"
provides:
  - "Schema migration for diarization columns on transcriptions_med"
  - "TypeScript interfaces for diarization data structures (DiarizedUtterance, AudioAccumulator, SpeakerMapping, BatchResult)"
  - "Database functions: saveDiarizedUtterances, updateSpeakerMapping, regenerateRawTextWithSpeakers"
affects: [02-backend-diarization]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-utterance-row-storage, batch-id-grouping, retroactive-speaker-mapping]

key-files:
  created:
    - migrations/02-diarization-schema.sql
    - apps/backend/realtime-service/src/types/diarization.ts
  modified:
    - apps/backend/realtime-service/src/config/database.ts

key-decisions:
  - "Speaker 'unknown' added as valid speaker role for pre-mapping utterances"
  - "Per-utterance rows (not JSON arrays) for diarized transcriptions — enables SQL queries by speaker/batch"

patterns-established:
  - "Diarized utterances stored as individual rows with batch_id for grouping"
  - "Speaker mapping is retroactive — insert as 'unknown', then UPDATE when doctor assigns roles"

requirements-completed: [DIAR-04, DIAR-05]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 02 Plan 01: Schema, Types & Storage Functions Summary

**Database migration adding diarization columns to transcriptions_med, 6 TypeScript interfaces for Deepgram diarization data, and 3 new storage functions for per-utterance save/speaker mapping/text regeneration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T00:01:12Z
- **Completed:** 2026-03-31T00:02:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration SQL adds diarization_confidence, batch_id, needs_review columns and relaxes speaker constraint to include 'unknown'
- 6 TypeScript interfaces covering internal data model and Deepgram response structures
- saveDiarizedUtterances() batch-inserts per-utterance rows with full diarization metadata
- updateSpeakerMapping() retroactively assigns doctor/patient roles to all session utterances
- regenerateRawTextWithSpeakers() rebuilds formatted raw_text with [MEDICO]/[PACIENTE] labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL and diarization types** - `d68f06e` (feat)
2. **Task 2: Add diarization storage functions to database.ts** - `4fad87d` (feat)

## Files Created/Modified
- `migrations/02-diarization-schema.sql` - Schema migration: 3 new columns, relaxed speaker constraint, 2 indexes
- `apps/backend/realtime-service/src/types/diarization.ts` - 6 interfaces: DiarizedUtterance, AudioAccumulator, SpeakerMapping, BatchResult, DeepgramWordWithSpeaker, DeepgramDiarizedUtterance
- `apps/backend/realtime-service/src/config/database.ts` - 3 new methods: saveDiarizedUtterances, updateSpeakerMapping, regenerateRawTextWithSpeakers

## Decisions Made
- Speaker 'unknown' added as valid role for pre-mapping utterances (per D-12)
- Per-utterance rows with batch_id grouping (not JSON arrays) for queryability
- Time format HH:mm:ss for regenerated raw_text speaker labels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**Migration must be applied manually** to the Supabase database:
- Run `migrations/02-diarization-schema.sql` against the production/staging database
- This adds columns and indexes; it does not drop or modify existing data

## Next Phase Readiness
- Types file ready for import by Plans 02 and 03
- Database functions ready to be called from chunk accumulation (Plan 02) and speaker mapping (Plan 03)
- Migration SQL ready to be applied to database

---
*Phase: 02-backend-diarization*
*Completed: 2026-03-31*

## Self-Check: PASSED

All files exist. All commits verified.
