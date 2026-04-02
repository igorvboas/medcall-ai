---
phase: 03-frontend-single-mic
plan: 02
subsystem: frontend
tags: [speaker-mapping, transcription-display, framer-motion, diarization-ui]
dependency_graph:
  requires: [03-01]
  provides: [SpeakerMappingPanel, PresencialTranscription-three-state]
  affects: [03-03]
tech_stack:
  added: []
  patterns: [AnimatePresence-transitions, three-state-display, speaker-resolution]
key_files:
  created:
    - apps/frontend/src/components/presencial/SpeakerMappingPanel.tsx
  modified:
    - apps/frontend/src/components/presencial/PresencialTranscription.tsx
decisions:
  - "Speaker mapping uses two-button UI with auto-assign of complementary role"
  - "Three-state display: UNKNOWN (gray) -> Speaker 0/1 (muted colors) -> Medico/Paciente (full colors)"
  - "Dual-mic rendering path preserved unchanged for backward compatibility"
metrics:
  duration: 2min
  completed: "2026-03-31T00:58:42Z"
  tasks: 2
  files: 2
---

# Phase 03 Plan 02: Speaker Mapping Panel and Transcription Display Summary

Speaker mapping panel with two-button role assignment and extended transcription display handling UNKNOWN/diarized/mapped speaker states with framer-motion transitions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SpeakerMappingPanel component | 580151f | SpeakerMappingPanel.tsx |
| 2 | Extend PresencialTranscription for three-state display | f7b319b | PresencialTranscription.tsx |

## What Was Built

### SpeakerMappingPanel (Task 1)
- Compact card asking "Quem e Speaker 0?" with Medico (blue) and Paciente (green) buttons
- Auto-assigns complementary role when one button is clicked (speaker_0=doctor implies speaker_1=patient)
- AnimatePresence for smooth panel show/hide transitions
- Remapear text link button shown after mapping is set, allowing re-mapping
- Props: visible, onMap, isMapped, onRemap

### PresencialTranscription Three-State Display (Task 2)
- **UNKNOWN state**: Gray background (#F3F4F6), gray border (#9CA3AF), MessageCircle icon, "Processando..." label
- **Diarized pre-mapping**: Speaker 0 with muted blue (#6B8DAF), Speaker 1 with muted green (#6EE7B7)
- **Mapped post-mapping**: Resolves speaker_0/speaker_1 to Medico/Paciente using speakerMapping prop with full blue/green colors
- AnimatePresence with popLayout mode for smooth batch replacement transitions
- New props: speakerMapping (nullable mapping object), micMode ('single' | 'dual')
- Dual-mic mode rendering completely preserved -- activates only when micMode === 'single'

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all components are fully functional with their defined props interfaces.

## Verification

TypeScript compilation passed with zero errors for both tasks.
