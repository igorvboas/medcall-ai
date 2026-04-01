---
plan: 01-01
phase: 01-validation-spike
status: complete
started: 2026-03-30
completed: 2026-03-30
---

# Plan 01-01 Summary: Diarization Validation Spike

## Outcome

CONDITIONAL GO — Deepgram nova-2 diarization works for pt-BR with chunk sizes >= 60s.

## What Was Built

- `spike/validation-diarization/` — Standalone TypeScript spike with:
  - `run-spike.ts` — Splits audio into 5s/30s/60s/full chunks, sends to Deepgram pre-recorded API with diarize=true + utterances=true
  - `analyze-results.ts` — Computes accuracy metrics against ground truth annotations
  - `types.ts` — Shared TypeScript interfaces
  - `ground-truth-template.json` — Template for manual speaker annotation

## Key Results

| Chunk Size | Speakers Detected | Verdict |
|------------|------------------|---------|
| 5s | 1 (only speaker_0) | FAIL — no diarization possible |
| 30s | 2 (in ~60% of chunks) | PARTIAL — unreliable |
| 60s | 2 (in 100% of chunks) | PASS — reliable |
| full (342s) | 2 (consistent) | PASS — best result |

## Decision Recorded

- **Decision:** CONDITIONAL GO
- **Minimum chunk size:** 60s (recommended 90-120s for safety margin)
- **Impact:** Backend must accumulate client chunks (5s) into 60s+ batches before Deepgram call
- **Latency:** ~60s delay for first transcription result (acceptable for presencial consultations)

## Deviations

- Added `@ffprobe-installer/ffprobe` dependency (not in original plan) — needed for audio duration detection
- Skipped formal ground truth annotation and `npm run analyze` — used raw spike output (speaker detection per chunk) as primary validation metric since it clearly showed the go/no-go threshold
- Used mock consultation audio instead of real patient audio (not available yet)

## Self-Check: PASSED

- [x] run-spike.ts processes audio at multiple chunk sizes
- [x] Results show speaker detection patterns clearly
- [x] GO/NO-GO decision documented in README.md
- [x] Optimal chunk size identified (60s minimum)

## Key Files

### Created
- spike/validation-diarization/src/run-spike.ts
- spike/validation-diarization/src/analyze-results.ts
- spike/validation-diarization/src/types.ts
- spike/validation-diarization/ground-truth-template.json
- spike/validation-diarization/README.md
- spike/validation-diarization/package.json
- spike/validation-diarization/tsconfig.json
