# Phase 3: Frontend Single-Mic - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend changes to support single-microphone presencial consultations. Doctor can select one microphone, toggle between single-mic and dual-mic modes, see speaker-labeled transcriptions from the diarization backend (Phase 2), and assign speaker roles via a mapping panel. No backend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Mode Toggle & Mic Selection (FMIC-01, FMIC-02)
- **D-01:** Add a toggle switch above the microphone selector: "Modo Single-Mic" / "Modo Dual-Mic". Default to dual-mic to preserve backward compatibility.
- **D-02:** In single-mic mode, show only 1 microphone dropdown (reuse the existing device enumeration from DualMicrophoneControl). Hide the patient microphone selector.
- **D-03:** In dual-mic mode, render the existing DualMicrophoneControl component unchanged — zero regressions.
- **D-04:** Persist the mode preference in localStorage key `presencial-mic-mode` ('single' | 'dual'). Restore on page load.
- **D-05:** When starting session in single-mic mode, emit `startPresencialSession` with a new field `micMode: 'single'` and only `doctorMicrophoneId` (no `patientMicrophoneId`).
- **D-06:** Create a new hook `usePresencialSingleMicCapture.ts` that captures from 1 mic with 1 MediaRecorder. Emits `presencialAudioChunk` with `speaker: 'mixed'` (backend handles diarization). Reuse VAD logic from existing hook.

### Speaker Mapping Panel (FMIC-03)
- **D-07:** Mapping panel appears automatically after the first `presencialDiarizedBatch` event is received (around 60s into consultation).
- **D-08:** Panel UI: compact card below the transcription area. Shows "Quem é Speaker 0?" with 2 buttons: "Médico" and "Paciente". Once one is selected, the other speaker is auto-assigned.
- **D-09:** On selection, emit `mapSpeakers` Socket.IO event with `{ sessionId, mapping: { speaker_0: 'doctor', speaker_1: 'patient' } }`.
- **D-10:** After mapping confirmed (via `speakerMappingUpdated` event), hide the mapping panel. Show a small "Remapear" button in the status bar to allow re-mapping if the doctor made a mistake.
- **D-11:** If the consultation ends without mapping, all transcriptions remain with speaker_0/speaker_1 labels (no forced mapping — doctor can map post-consultation in a future phase).

### Active Speaker Indicator (FMIC-04)
- **D-12:** In single-mic mode, show a single AudioLevelIndicator (reuse existing component) for the shared microphone.
- **D-13:** After speaker mapping is done, show which speaker is active by highlighting the speaker label in the transcription area with a pulse animation. Use existing blue (#1B4266) for doctor and green (#10B981) for patient.
- **D-14:** Add a small status badge in the recording status bar: "Speaker 0 ativo" / "Speaker 1 ativo" (before mapping) or "Médico falando" / "Paciente falando" (after mapping). Update based on the most recent diarized batch's last utterance speaker.

### Transcription Display (FMIC-05)
- **D-15:** During the accumulation window (first ~60s), show incoming `presencialTranscription` events with speaker='UNKNOWN' using gray styling (background #F3F4F6, gray left border #9CA3AF, generic speaker icon).
- **D-16:** When `presencialDiarizedBatch` event arrives, replace all UNKNOWN transcriptions for that batch with properly speaker-attributed transcriptions using existing doctor (blue) / patient (green) styling.
- **D-17:** The replacement should be a smooth transition: fade out gray items, fade in colored items with speaker labels.
- **D-18:** After speaker mapping, update all displayed transcription labels: replace "Speaker 0" / "Speaker 1" with "Médico" / "Paciente" names.
- **D-19:** Listen for `speakerMappingUpdated` event and refresh all displayed transcription labels in-place without re-fetching from server.

### Audio Capture Hook (FMIC-01)
- **D-20:** Create `usePresencialSingleMicCapture.ts` — simplified version of existing dual hook. Single MediaRecorder, single AudioContext, same 5s chunking, same VAD logic.
- **D-21:** Export `audioLevel` (single value, not doctorLevel/patientLevel) for the AudioLevelIndicator.
- **D-22:** The presencial page.tsx selects which hook to use based on mic mode: single-mic → `usePresencialSingleMicCapture`, dual-mic → `usePresencialAudioCapture` (existing).

### Claude's Discretion
- CSS animation details for speaker label transitions
- Exact toggle switch component (can use existing UI library or custom)
- Error handling for microphone permission denied in single-mic mode
- Loading state design during first 60s accumulation window

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Components
- `apps/frontend/src/components/presencial/DualMicrophoneControl.tsx` — Current dual-mic selector. Reuse device enumeration, level indicators.
- `apps/frontend/src/components/presencial/PresencialTranscription.tsx` — Current transcription display with speaker styling. Extend for UNKNOWN speaker and batch replacement.
- `apps/frontend/src/components/presencial/AudioLevelIndicator.tsx` — Reusable audio level meter.

### Hooks & Utilities
- `apps/frontend/src/hooks/usePresencialAudioCapture.ts` — Current dual-mic capture hook. Pattern for new single-mic hook.
- `apps/frontend/src/lib/audioUtils.ts` — VoiceActivityDetector, blobToBase64, formatDuration. Reuse in single-mic hook.

### Page
- `apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx` — Main orchestration page. Add mode toggle, conditional hook, mapping panel.

### Types
- `apps/frontend/src/types/transcription.ts` — TranscriptionSegment type with Speaker union ('MEDICO' | 'PACIENTE' | 'SISTEMA' | 'UNKNOWN').

### Backend Events (Phase 2 outputs)
- `presencialDiarizedBatch` — New event from Phase 2, carries diarized utterances with speaker_id
- `mapSpeakers` — Socket.IO event to send speaker mapping to backend
- `speakerMappingUpdated` — Confirmation event after backend applies mapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DualMicrophoneControl.tsx` — Device enumeration logic, level bars, localStorage persistence. Can extract device selector into shared component.
- `PresencialTranscription.tsx` — Speaker color scheme (blue doctor, green patient), auto-scroll, timestamp formatting. Extend with UNKNOWN styling.
- `AudioLevelIndicator.tsx` — Standalone level meter, works with single or dual output.
- `VoiceActivityDetector` class — Complete VAD implementation, directly reusable in single-mic hook.
- `TranscriptionSegment` type — Already has 'UNKNOWN' in Speaker union.

### Established Patterns
- Socket.IO connection managed in page.tsx with useEffect cleanup
- Audio hooks return `{ startCapture, stopCapture, isCapturing, levels }` interface
- Components use Tailwind CSS with inline styles for dynamic values
- localStorage for user preferences persistence

### Integration Points
- `page.tsx` — Add mode toggle state, conditional hook selection, mapping panel rendering
- Socket.IO listeners — Add `presencialDiarizedBatch` and `speakerMappingUpdated` listeners
- `startPresencialSession` event — Add `micMode` field

</code_context>

<specifics>
## Specific Ideas

- The toggle should be visually clear — doctor needs to understand the difference instantly
- Mapping panel should feel natural, not intrusive — appears after 60s when first diarized batch arrives
- "Remapear" button should be accessible but not prominent — small text link in status bar
- Gray UNKNOWN transcriptions during accumulation should not look like errors — use subtle neutral styling
- Transition from UNKNOWN → speaker-attributed should feel smooth, not jarring

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-frontend-single-mic*
*Context gathered: 2026-03-31*
