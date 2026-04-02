# Phase 3: Frontend Single-Mic - Research

**Researched:** 2026-03-30
**Domain:** React/Next.js frontend - audio capture, Socket.IO events, speaker diarization UI
**Confidence:** HIGH

## Summary

This phase is a frontend-only implementation adding single-microphone support to the existing presencial consultation page. The codebase already has all foundational pieces: dual-mic capture hook, transcription display component, audio level indicator, Socket.IO integration, and the backend events from Phase 2 (`presencialDiarizedBatch`, `mapSpeakers`, `speakerMappingUpdated`). The work is primarily: (1) a new simplified audio capture hook, (2) a mode toggle with conditional rendering, (3) a speaker mapping panel, (4) extending the transcription display for UNKNOWN/diarized states, and (5) an active speaker indicator.

The existing code uses styled-jsx (CSS-in-JS via `<style jsx>` blocks), React hooks with refs for audio state, Socket.IO client for real-time communication, and localStorage for preference persistence. Radix UI Switch component (`@radix-ui/react-switch`) is already installed and ideal for the mode toggle. Framer Motion is available for smooth transitions between UNKNOWN and speaker-attributed transcriptions.

**Primary recommendation:** Build incrementally on existing patterns. The new `usePresencialSingleMicCapture` hook should mirror `usePresencialAudioCapture` but with a single MediaRecorder. The page.tsx orchestrates mode selection and conditionally renders components. No new libraries needed -- everything required is already in the dependency tree.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Toggle switch above mic selector: "Modo Single-Mic" / "Modo Dual-Mic". Default to dual-mic.
- D-02: Single-mic mode shows only 1 mic dropdown, reusing device enumeration from DualMicrophoneControl. Hide patient mic selector.
- D-03: Dual-mic mode renders existing DualMicrophoneControl unchanged -- zero regressions.
- D-04: Persist mode in localStorage key `presencial-mic-mode` ('single' | 'dual'). Restore on page load.
- D-05: Single-mic startPresencialSession emits `micMode: 'single'` with only `doctorMicrophoneId`.
- D-06: New hook `usePresencialSingleMicCapture.ts` -- 1 mic, 1 MediaRecorder, emits with `speaker: 'mixed'`. Reuse VAD logic.
- D-07: Mapping panel appears after first `presencialDiarizedBatch` event (~60s into consultation).
- D-08: Panel UI: compact card below transcription. "Quem e Speaker 0?" with 2 buttons: "Medico" / "Paciente". Auto-assign other.
- D-09: Emit `mapSpeakers` Socket.IO event with `{ sessionId, mapping: { speaker_0: 'doctor', speaker_1: 'patient' } }`.
- D-10: After `speakerMappingUpdated`, hide mapping panel. Show "Remapear" button in status bar.
- D-11: If consultation ends without mapping, transcriptions keep speaker_0/speaker_1 labels.
- D-12: Single-mic mode shows single AudioLevelIndicator for shared mic.
- D-13: After mapping, highlight active speaker label with pulse animation. Blue (#1B4266) for doctor, green (#10B981) for patient.
- D-14: Status badge: "Speaker 0 ativo" / "Medico falando" etc., based on last diarized batch's last utterance.
- D-15: During accumulation (~60s), show `presencialTranscription` events with speaker='UNKNOWN', gray styling (bg #F3F4F6, border #9CA3AF).
- D-16: When `presencialDiarizedBatch` arrives, replace UNKNOWN transcriptions with speaker-attributed ones using doctor/patient styling.
- D-17: Smooth transition: fade out gray, fade in colored items.
- D-18: After mapping, update all labels: replace "Speaker 0"/"Speaker 1" with "Medico"/"Paciente".
- D-19: Listen for `speakerMappingUpdated` and refresh labels in-place without re-fetch.
- D-20: `usePresencialSingleMicCapture.ts` -- single MediaRecorder, single AudioContext, 5s chunking, same VAD.
- D-21: Export `audioLevel` (single value) for AudioLevelIndicator.
- D-22: page.tsx selects hook based on mode: single -> new hook, dual -> existing hook.

### Claude's Discretion
- CSS animation details for speaker label transitions
- Exact toggle switch component (can use existing UI library or custom)
- Error handling for microphone permission denied in single-mic mode
- Loading state design during first 60s accumulation window

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FMIC-01 | Doctor can select 1 microphone for presencial consultation | New hook `usePresencialSingleMicCapture` with single device enumeration; reuse `loadAudioDevices` pattern from DualMicrophoneControl |
| FMIC-02 | Doctor can toggle between single-mic and dual-mic modes | Radix Switch component already installed; localStorage persistence pattern already used in codebase |
| FMIC-03 | Doctor can map speaker_0 to "Medico" and speaker_1 to "Paciente" via mapping panel | Backend `mapSpeakers` and `speakerMappingUpdated` events already implemented in Phase 2 |
| FMIC-04 | UI shows visual indicator of active speaker during consultation | Extend existing audio visualizer pattern; add status badge to status bar |
| FMIC-05 | Transcriptions displayed grouped by speaker with correct labels | Extend PresencialTranscription to handle UNKNOWN speaker, diarized batch replacement, and label updates |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^14.2.0 | App framework | Already in use, all pages follow App Router pattern |
| react | ^18.2.0 | UI library | Already in use |
| socket.io-client | ^4.8.1 | Real-time events | Already connected in page.tsx, all backend events use this |
| @radix-ui/react-switch | ^1.0.3 | Toggle switch component | Already installed, accessible, matches project's Radix usage |
| framer-motion | ^10.16.5 | Transition animations | Already installed, use for D-17 fade transitions |
| lucide-react | ^0.292.0 | Icons | Already in use throughout presencial components |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2.1.1 | Conditional classNames | When building dynamic class strings for speaker states |
| tailwind-merge | ^2.6.0 | Merge Tailwind classes | If combining Tailwind utility classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @radix-ui/react-switch | Custom toggle with styled-jsx | Radix is already installed, accessible by default, less code |
| framer-motion AnimatePresence | CSS transitions only | Framer provides exit animations for batch replacement (D-17), CSS alone cannot animate unmounting |

**Installation:** No new packages needed. All dependencies already present.

## Architecture Patterns

### New Files to Create
```
apps/frontend/src/
  hooks/
    usePresencialSingleMicCapture.ts    # New: single-mic audio capture hook
  components/presencial/
    MicModeToggle.tsx                    # New: mode toggle switch
    SingleMicrophoneControl.tsx          # New: single-mic device selector
    SpeakerMappingPanel.tsx              # New: speaker assignment panel
```

### Files to Modify
```
apps/frontend/src/
  app/(consulta)/consulta/presencial/page.tsx    # Add mode state, conditional hook, new listeners
  components/presencial/PresencialTranscription.tsx  # Add UNKNOWN styling, batch replacement, label updates
  types/transcription.ts                          # Already has UNKNOWN in Speaker union - no change needed
```

### Pattern 1: Conditional Hook Selection (D-22)
**What:** page.tsx selects which audio capture hook to use based on mic mode.
**When to use:** When the page needs to support two different capture strategies.
**Implementation approach:**
Both hooks must be called unconditionally (React rules of hooks), but only one is "active". The inactive hook simply receives empty/null params and does not start capture. Alternatively, create a wrapper hook `usePresencialCapture` that delegates internally.

```typescript
// Option A: Wrapper hook (recommended - cleaner)
function usePresencialCapture({ socket, mode, doctorMicrophoneId, patientMicrophoneId }) {
  // Internal state manages which capture strategy is active
  // Returns unified interface: { startCapture, stopCapture, isRecording, audioLevel, doctorLevel, patientLevel }
}

// Option B: Both hooks called, one dormant
// Risk: MediaRecorder cleanup issues if not carefully managed
```

**Recommendation:** Option A (wrapper hook) is cleaner but adds complexity. Given the CONTEXT.md decision D-22 explicitly says "page.tsx selects which hook", Option B with careful conditional usage (only passing valid params to the active hook) is the intended approach. The key constraint is that hooks cannot be called conditionally, so both must always be called. The inactive one should receive null socket to prevent any capture.

### Pattern 2: Socket Event-Driven State Machine for Transcriptions (D-15 through D-19)
**What:** Transcription display has three states: ACCUMULATING (gray UNKNOWN items), DIARIZED (speaker_0/speaker_1 labels), MAPPED (Medico/Paciente labels).
**When to use:** For the transcription lifecycle in single-mic mode.

```
State flow:
1. ACCUMULATING: presencialTranscription events arrive -> show as UNKNOWN (gray)
2. DIARIZED: presencialDiarizedBatch arrives -> replace UNKNOWN items for that batch with speaker-attributed items
3. MAPPED: speakerMappingUpdated arrives -> relabel all speaker_0/speaker_1 to Medico/Paciente
```

**Data structure consideration:** Each transcription item needs:
- `id`: unique identifier
- `batchId`: null during accumulation, set when diarized batch arrives
- `speakerId`: 'unknown' | 'speaker_0' | 'speaker_1'
- `mappedRole`: null | 'doctor' | 'patient' (set after mapping)
- `text`, `timestamp`, etc.

The batch replacement (D-16) requires correlating the UNKNOWN items with the diarized batch. Since the backend sends the full batch with proper text, the simplest approach is: when `presencialDiarizedBatch` arrives, remove the UNKNOWN items that fall within that batch's time window and insert the diarized items instead.

### Pattern 3: Existing Styled-JSX Pattern
**What:** All presencial components use `<style jsx>` blocks for component-scoped CSS.
**When to use:** For all new components in this phase.
**Note:** The codebase mixes styled-jsx with some Tailwind classes. New components should follow the same pattern as existing presencial components (primarily styled-jsx).

### Anti-Patterns to Avoid
- **Conditional hook calls:** Never put `usePresencialSingleMicCapture` inside an `if`. Both hooks must be called every render.
- **Mutating transcription array in place:** Always use `setTranscriptions(prev => ...)` with new array references for React to detect changes.
- **Forgetting to cleanup MediaStream tracks:** The existing hook pattern (stopCapture -> stop tracks) must be replicated in the new hook. Leaked MediaStream tracks keep the mic indicator active in the browser.
- **Relying on Socket.IO event ordering:** `presencialTranscription` and `presencialDiarizedBatch` may arrive in unexpected order. The UI must handle receiving diarized batches before or after individual transcriptions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible toggle switch | Custom div with click handler | `@radix-ui/react-switch` | Already installed, handles keyboard, ARIA, focus management |
| Mount/unmount animations | Manual CSS class toggling with timeouts | `framer-motion` AnimatePresence + motion.div | Exit animations require tracking unmounting elements, which framer handles |
| Audio device enumeration | New enumeration code | Extract from DualMicrophoneControl | Same `navigator.mediaDevices.enumerateDevices()` pattern, avoid duplication |
| VAD (Voice Activity Detection) | New VAD implementation | `VoiceActivityDetector` from audioUtils.ts | Already tested and tuned (threshold 0.08, 1.5s min speech) |

## Common Pitfalls

### Pitfall 1: React Hook Rules with Dual Hooks
**What goes wrong:** Calling hooks conditionally based on mic mode causes "rendered more hooks than previous render" error.
**Why it happens:** React requires hooks to be called in the same order every render.
**How to avoid:** Always call both hooks. Pass null/empty params to the inactive one so it does nothing. Or use a single wrapper hook.
**Warning signs:** Runtime crash on mode toggle.

### Pitfall 2: Batch Replacement Race Condition
**What goes wrong:** `presencialDiarizedBatch` arrives but the UNKNOWN transcriptions it should replace were not yet rendered, or were already replaced by a previous batch.
**Why it happens:** The 60s accumulation window means individual `presencialTranscription` events (from the per-chunk path) arrive continuously, while diarized batches arrive every ~60s covering the same time period.
**How to avoid:** Use a state machine approach. Tag each UNKNOWN transcription with a sequence range. When a diarized batch arrives, remove UNKNOWN items in that range and insert diarized items. Keep a `replacedBatches` set to avoid double-replacement.
**Warning signs:** Duplicate transcriptions appearing, or transcriptions disappearing unexpectedly.

### Pitfall 3: MediaRecorder Not Restarting After Stop
**What goes wrong:** In the existing dual-mic hook, the recording cycle is stop->onstop callback->restart. If the restart logic has a stale closure over `isRecordingRef`, the recorder silently stops.
**Why it happens:** The single-mic hook must replicate this exact pattern with refs.
**How to avoid:** Follow the exact same ref-based pattern from usePresencialAudioCapture. Use `isRecordingRef.current` (not state) in the onstop callback.
**Warning signs:** Audio capture stops after 5 seconds and never resumes.

### Pitfall 4: Speaker Mapping Panel Appearing at Wrong Time
**What goes wrong:** Mapping panel appears before any diarized data exists, or never appears because the event listener was not registered.
**Why it happens:** The `presencialDiarizedBatch` listener must be set up before the 60s mark, and the panel visibility must be driven by a state flag set on first batch receipt.
**How to avoid:** Register all Socket.IO listeners in the initial useEffect (not conditionally). Use a `firstBatchReceived` state flag.
**Warning signs:** Panel never appears even after 60s of recording.

### Pitfall 5: AudioContext Autoplay Policy
**What goes wrong:** `new AudioContext()` may start in "suspended" state on some browsers until user gesture.
**Why it happens:** Browser autoplay policies.
**How to avoid:** The existing code already handles this implicitly because `getUserMedia()` triggers user permission, which satisfies the autoplay policy. The new hook should call `getUserMedia()` before creating `AudioContext`, same as existing.
**Warning signs:** Audio level shows 0 even when speaking.

### Pitfall 6: Styled-JSX Scope in New Components
**What goes wrong:** Styles leak or don't apply when components are nested.
**Why it happens:** styled-jsx scopes styles to the component where `<style jsx>` is defined.
**How to avoid:** Each new component (MicModeToggle, SpeakerMappingPanel, SingleMicrophoneControl) should have its own `<style jsx>` block, following the pattern of DualMicrophoneControl.
**Warning signs:** Styles not applying or unexpected styling from parent.

## Code Examples

### Single-Mic Capture Hook Structure
```typescript
// Source: Pattern from usePresencialAudioCapture.ts (existing)
// apps/frontend/src/hooks/usePresencialSingleMicCapture.ts

interface UsePresencialSingleMicCaptureProps {
    socket: Socket | null;
    microphoneId: string;  // Single mic, not doctor/patient split
}

// Returns:
interface SingleMicCaptureReturn {
    isRecording: boolean;
    startCapture: (sessionId: string) => Promise<void>;
    stopCapture: () => void;
    audioLevel: number;  // Single level (D-21)
    pendingChunks: number;
}

// Key differences from dual hook:
// 1. Single MediaRecorder, single stream
// 2. speaker: 'mixed' in emit (not 'doctor'/'patient')
// 3. Single audioLevel output (not doctorLevel/patientLevel)
// 4. Same 5s stop/restart cycle via setInterval + onstop callback
```

### presencialDiarizedBatch Event Payload (from backend)
```typescript
// Source: presencialSessionManager.ts line 316-328
interface DiarizedBatchEvent {
    sessionId: string;
    batchId: string;
    utterances: Array<{
        speakerId: string;     // 'speaker_0' or 'speaker_1'
        text: string;
        startMs: number;
        endMs: number;
        diarizationConfidence: number;
        needsReview: boolean;
    }>;
}
```

### speakerMappingUpdated Event Payload (from backend)
```typescript
// Source: presencial.ts line 296-299
interface SpeakerMappingUpdatedEvent {
    sessionId: string;
    mapping: {
        speaker_0: 'doctor' | 'patient';
        speaker_1: 'doctor' | 'patient';
    };
}
```

### mapSpeakers Emit Payload (frontend sends to backend)
```typescript
// Source: presencial.ts line 219-243 (backend handler)
socket.emit('mapSpeakers', {
    sessionId: sessionId,
    mapping: {
        speaker_0: 'doctor',  // or 'patient'
        speaker_1: 'patient'  // or 'doctor'
    }
}, (response: { success: boolean; error?: string }) => {
    // Handle response
});
```

### Radix Switch Toggle Pattern
```typescript
// @radix-ui/react-switch is already installed (^1.0.3)
import * as Switch from '@radix-ui/react-switch';

// Usage in MicModeToggle:
<Switch.Root
    checked={mode === 'single'}
    onCheckedChange={(checked) => setMode(checked ? 'single' : 'dual')}
    className="switch-root"
>
    <Switch.Thumb className="switch-thumb" />
</Switch.Root>
```

### Framer Motion Batch Replacement Transition (D-17)
```typescript
import { AnimatePresence, motion } from 'framer-motion';

// In transcription list:
<AnimatePresence mode="popLayout">
    {transcriptions.map((t) => (
        <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
        >
            {/* Transcription item */}
        </motion.div>
    ))}
</AnimatePresence>
```

### Extended TranscriptionSegment Type (for internal state)
```typescript
// Extended type for single-mic mode state management
interface SingleMicTranscription extends TranscriptionSegment {
    batchId?: string;           // null during accumulation, set after diarized batch
    speakerId?: string;         // 'speaker_0' | 'speaker_1' | undefined
    mappedRole?: 'doctor' | 'patient' | null;  // Set after speakerMappingUpdated
    isUnknown?: boolean;        // true during accumulation phase
    diarizationConfidence?: number;
    needsReview?: boolean;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2 separate Deepgram connections | 1 connection with diarization | Phase 2 (2026-03) | Frontend now receives speaker_0/speaker_1 instead of doctor/patient from backend |
| Speaker known at capture time | Speaker identified by diarization | Phase 2 (2026-03) | UI must handle UNKNOWN -> speaker_X -> Medico/Paciente lifecycle |
| Per-chunk transcription only | Per-chunk + 60s batch diarization | Phase 2 (2026-03) | Two parallel data streams: individual transcriptions + diarized batches |

## Open Questions

1. **startPresencialSession Backend Handler**
   - What we know: Backend currently expects `doctorMicrophoneId` and `patientMicrophoneId` in the `startPresencialSession` event. D-05 says to add `micMode: 'single'` field.
   - What's unclear: Does the backend need any changes to handle single-mic mode, or does it work transparently since diarization already processes mixed audio?
   - Recommendation: The backend already accumulates all chunks regardless of speaker label and runs diarization. Sending `speaker: 'mixed'` instead of `speaker: 'doctor'/'patient'` should work with existing code since the accumulator just concatenates buffers. However, the per-chunk transcription path (which emits `presencialTranscription`) will label them as 'mixed' -- the frontend must handle this as UNKNOWN. **No backend changes needed for Phase 3** but verify the `speaker: 'mixed'` value does not break any backend validation.

2. **Batch Correlation Strategy**
   - What we know: UNKNOWN transcriptions from per-chunk path and diarized batches from accumulator cover the same audio.
   - What's unclear: Exact strategy to correlate which UNKNOWN items a diarized batch replaces.
   - Recommendation: Since batches are 60s windows and per-chunk transcriptions are 5s each, a time-based approach works: when a batch arrives, remove all UNKNOWN items whose timestamps fall within or before the batch window. Alternatively, simply replace ALL current UNKNOWN items when any batch arrives, since they will all be superseded.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | none -- see Wave 0 |
| Quick run command | `cd apps/frontend && npx tsc --noEmit` (type-check only) |
| Full suite command | `cd apps/frontend && npm run type-check && npm run lint` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FMIC-01 | Single mic selection and capture | manual | Browser test with mic hardware | N/A |
| FMIC-02 | Mode toggle persists and switches UI | manual + type-check | `npm run type-check` verifies types | N/A |
| FMIC-03 | Speaker mapping panel sends correct event | manual | Browser test with live session | N/A |
| FMIC-04 | Active speaker indicator updates | manual | Browser test with live diarized data | N/A |
| FMIC-05 | Transcriptions grouped by speaker | manual | Browser test with live session | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/frontend && npm run type-check`
- **Per wave merge:** `cd apps/frontend && npm run type-check && npm run lint`
- **Phase gate:** Full type-check + lint green, manual browser test

### Wave 0 Gaps
- No unit test framework configured -- all validation is type-checking + manual browser testing
- This is consistent with the existing codebase (no tests exist for any presencial components)
- Adding a test framework is out of scope for this phase

## Sources

### Primary (HIGH confidence)
- **Existing codebase** - Direct code review of all canonical reference files listed in CONTEXT.md
  - `usePresencialAudioCapture.ts` - Dual-mic hook pattern (exact template for new hook)
  - `DualMicrophoneControl.tsx` - Device enumeration, localStorage, level monitoring
  - `PresencialTranscription.tsx` - Speaker styling, auto-scroll, transcription rendering
  - `AudioLevelIndicator.tsx` - Level bar component
  - `page.tsx` - Full page orchestration, Socket.IO setup, state management
  - `audioUtils.ts` - VoiceActivityDetector, blobToBase64, getBestAudioMimeType
  - `transcription.ts` - TranscriptionSegment type with UNKNOWN speaker
- **Backend event handlers** - `presencial.ts` and `presencialSessionManager.ts` for exact event payloads
- **package.json** - Verified all recommended libraries are already installed

### Secondary (MEDIUM confidence)
- Radix UI Switch API -- based on installed version ^1.0.3, standard API
- Framer Motion AnimatePresence -- based on installed version ^10.16.5

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in package.json
- Architecture: HIGH - patterns directly derived from existing codebase, backend events verified in source
- Pitfalls: HIGH - identified from code review of actual hook implementations and React constraints

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- no external API changes expected)
