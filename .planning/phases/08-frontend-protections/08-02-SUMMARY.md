---
phase: 08-frontend-protections
plan: 02
subsystem: frontend
tags: [mic-monitoring, beforeunload, alerts, presencial, online]
dependency_graph:
  requires: [08-01]
  provides: [frontend-mic-alerts-wired, tab-close-protection-wired]
  affects:
    - apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx
    - apps/frontend/src/components/webrtc/ConsultationRoom.tsx
    - apps/frontend/src/hooks/usePresencialSingleMicCapture.ts
tech_stack:
  added: []
  patterns: [hook-composition, stream-monitoring, beforeunload-protection]
key_files:
  modified:
    - apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx
    - apps/frontend/src/components/webrtc/ConsultationRoom.tsx
    - apps/frontend/src/hooks/usePresencialSingleMicCapture.ts
decisions:
  - "streamToMonitor selects singleCapture.stream or dualCapture.doctorStream based on micMode"
  - "ConsultationRoom beforeunload triggers on isRecording OR isCallActive (WebRTC session loss)"
  - "MicAlertBanner placed after error/network banners for consistent alert hierarchy"
metrics:
  duration: 3min
  completed: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  deviations: 1
---

# Phase 8 Plan 2: Wire Hooks Into Consultation Pages Summary

Mic disconnect alerts, silence detection banners, and beforeunload tab protection wired into both presencial and online consultation pages using hooks from Plan 01.

## What Was Done

### Task 1: Wire hooks into presencial page.tsx (9e8c279)
- Added imports for `useMicMonitor`, `useBeforeUnloadProtection`, `MicAlertBanner`
- Added `streamToMonitor` that selects `singleCapture.stream` (single-mic) or `dualCapture.doctorStream` (dual-mic) based on `micMode`
- Called `useMicMonitor(streamToMonitor, activeCapture.isRecording)` for mic monitoring
- Called `useBeforeUnloadProtection(activeCapture.isRecording)` for tab close protection
- Placed `<MicAlertBanner>` after the error banner in JSX

### Task 2: Wire hooks into ConsultationRoom.tsx (4b164f7)
- Added imports for `useMicMonitor`, `useBeforeUnloadProtection`, `MicAlertBanner`
- Called `useMicMonitor(localStreamState, recordingState.isRecording)` -- `localStreamState` is already reactive useState
- Called `useBeforeUnloadProtection(recordingState.isRecording || isCallActive)` -- protects both recording and active WebRTC call
- Placed `<MicAlertBanner>` after `<NetworkWarning>` in JSX

### Task 3: Visual verification checkpoint
Documented as pending human verification. No code changes. The following needs manual testing:
- Presencial: mic disconnect (red banner), 30s silence (amber banner), tab close protection
- Online: same three protections via ConsultationRoom
- Accessibility: `role="alert"` and `aria-live="assertive"` on both banners

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exposed stream from usePresencialSingleMicCapture**
- **Found during:** Task 1
- **Issue:** Plan 01 exposed `doctorStream` from `usePresencialAudioCapture` but did NOT expose `stream` from `usePresencialSingleMicCapture`. The `streamToMonitor` selection requires both streams to be available as reactive state.
- **Fix:** Added `useState<MediaStream | null>(null)` for `stream`, set it when getUserMedia returns, and added `stream` to the return object.
- **Files modified:** `apps/frontend/src/hooks/usePresencialSingleMicCapture.ts`
- **Commit:** 9e8c279

## Known Stubs

None -- all hooks are fully wired with real data sources.

## Verification

All automated checks passed:
- `useMicMonitor`, `useBeforeUnloadProtection`, `MicAlertBanner` present in both files
- `streamToMonitor` correctly selects stream based on `micMode`
- No existing code modified -- only additions

## Self-Check: PASSED
