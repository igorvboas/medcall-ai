---
phase: 02-backend-diarization
plan: 03
subsystem: api
tags: [socket.io, diarization, speaker-mapping, deepgram, supabase]

# Dependency graph
requires:
  - phase: 02-backend-diarization plan 01
    provides: db.updateSpeakerMapping and db.regenerateRawTextWithSpeakers methods
  - phase: 02-backend-diarization plan 02
    provides: presencialSessionManager.setIO method and batch diarization pipeline
provides:
  - mapSpeakers Socket.IO event handler for retroactive speaker role assignment
  - speakerMappingUpdated real-time event broadcast to room participants
  - Speaker mapping persistence in call_sessions.metadata
affects: [03-frontend-diarization, speaker-mapping-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [retroactive-speaker-mapping, metadata-merge-pattern]

key-files:
  created: []
  modified:
    - apps/backend/realtime-service/src/websocket/presencial.ts

key-decisions:
  - "Uses session.callSessionId (UUID) for transcriptions_med queries, sessionId (room_id) for call_sessions"
  - "Merges speakerMapping into existing metadata rather than overwriting"

patterns-established:
  - "mapSpeakers 4-step pipeline: update transcriptions_med, regenerate raw_text, persist metadata, emit event"

requirements-completed: [DIAR-06]

# Metrics
duration: 1min
completed: 2026-03-31
---

# Phase 02 Plan 03: mapSpeakers Event Handler Summary

**mapSpeakers Socket.IO handler for retroactive speaker-to-role mapping with 4-step pipeline: batch update transcriptions_med, regenerate raw_text labels, persist in metadata, broadcast to room**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-31T00:09:33Z
- **Completed:** 2026-03-31T00:10:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added mapSpeakers Socket.IO event handler with full validation (sessionId, mapping roles)
- Implemented 4-step speaker mapping pipeline: (1) batch update transcriptions_med speaker roles, (2) regenerate raw_text with MEDICO/PACIENTE labels, (3) persist mapping in call_sessions.metadata, (4) emit speakerMappingUpdated to room
- IO server reference was already wired to presencialSessionManager (from plan 02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire IO to session manager and add mapSpeakers event handler** - `2a7b291` (feat)

## Files Created/Modified
- `apps/backend/realtime-service/src/websocket/presencial.ts` - Added mapSpeakers Socket.IO handler with speaker validation, 4-step mapping pipeline, and error handling

## Decisions Made
- Used `session.callSessionId` (UUID) for transcriptions_med database queries and `sessionId` (room_id like 'pres-xxxx') for call_sessions metadata update, matching existing data model conventions
- Merged speakerMapping into existing call_sessions.metadata to preserve other metadata fields (doctorMicrophoneId, patientMicrophoneId, etc.)

## Deviations from Plan

None - plan executed exactly as written. The IO wiring (setIO) was already present from plan 02 execution, which was expected per the dependency chain.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend diarization pipeline is complete (all 3 plans executed)
- Frontend can now: receive presencialDiarizedBatch events, call mapSpeakers with speaker mapping, listen for speakerMappingUpdated confirmation
- Ready for Phase 03 (frontend diarization UI)

---
*Phase: 02-backend-diarization*
*Completed: 2026-03-31*
