# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-30 — Milestone v1.0 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Médico consegue realizar consulta presencial com transcrição automática usando apenas 1 microfone, com identificação correta de quem está falando.
**Current focus:** Defining requirements

## Accumulated Context

- Feasibility study completed: Deepgram diarization viable for single-mic with caveats
- Cold start (20-30s) is main limitation — all speech attributed to speaker_0 initially
- Current codebase already has diarize=true but discards speaker field from response
- Architecture change: from 2 Deepgram connections (1 per mic) to 1 connection with diarization
