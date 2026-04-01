# Architecture Research: Single-Mic Diarization Integration

**Domain:** Healthcare presencial consultation transcription
**Researched:** 2026-03-30
**Confidence:** HIGH

## System Overview

### Current Architecture (Dual-Mic)

```
FRONTEND                                    BACKEND (realtime-service)
+---------------------------------+         +------------------------------------+
| presencial/page.tsx             |         | websocket/presencial.ts            |
|   DualMicrophoneControl         |         |   'startPresencialSession'         |
|   usePresencialAudioCapture     |         |   'presencialAudioChunk'           |
|     doctorRecorder (5s chunks)  |         |   'endPresencialSession'           |
|     patientRecorder (5s chunks) |         +------------------------------------+
|     VAD per stream              |                    |
+---------------------------------+                    v
         |                              +------------------------------------+
         | Socket.IO                    | presencialSessionManager.ts        |
         | 'presencialAudioChunk'       |   processAudioChunkAndReturn()     |
         | { speaker: 'doctor'|         |     transcribeWithDeepgram()       |
         |   'patient',                 |     speaker = chunk.speaker        |
         |   audioChunk: base64 }       |     saveTranscriptionIncrementally |
         |                              +------------------------------------+
         v                                             |
   io.emit('presencialTranscription')                  v
   { speaker, text, timestamp }           Deepgram Pre-recorded API
                                          { diarize: true } (speaker ignored)
```

**Problem:** Speaker identity comes from which MediaRecorder sent the chunk (`speaker` field in Socket.IO payload). Deepgram's diarize response already contains `speaker: 0|1` in each word, but it is completely discarded. Two separate getUserMedia streams, two MediaRecorders, two VAD instances.

### Target Architecture (Single-Mic)

```
FRONTEND                                    BACKEND (realtime-service)
+---------------------------------+         +------------------------------------+
| presencial/page.tsx             |         | websocket/presencial.ts            |
|   SingleMicrophoneControl (NEW) |         |   'startPresencialSession'         |
|   useSingleMicCapture (NEW)     |         |   'presencialAudioChunk' (MODIFIED)|
|     1 MediaRecorder (5s chunks) |         |   'speakerMapping' (NEW)           |
|     1 VAD instance              |         |   'endPresencialSession'           |
+---------------------------------+         +------------------------------------+
         |                                             |
         | Socket.IO                                   v
         | 'presencialAudioChunk'       +------------------------------------+
         | { audioChunk: base64,        | presencialSessionManager.ts        |
         |   sequence, timestamp }      |   processAudioChunkAndReturn()     |
         | (NO speaker field)           |     transcribeWithDeepgram()       |
         |                              |       + utterances: true (NEW)     |
         v                              |     extractSpeakerFromUtterances() |
                                        |     mapSpeakerToRole() (NEW)      |
  io.emit('presencialTranscription')    |     saveTranscriptionIncrementally |
  { speaker, text, timestamp,           +------------------------------------+
    speakerId: 0|1 (NEW) }                            |
                                                       v
                                          Deepgram Pre-recorded API
                                          { diarize: true, utterances: true }
                                          Response: utterances[].speaker = 0|1
```

## Component Responsibilities

### Components to MODIFY (existing files)

| Component | File | What Changes | Why |
|-----------|------|--------------|-----|
| presencial/page.tsx | `apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx` | Add mode toggle (single/dual), swap mic control component based on mode, add speaker mapping UI, handle new `speakerMapping` Socket.IO event | Entry point -- must support both modes |
| usePresencialAudioCapture | `apps/frontend/src/hooks/usePresencialAudioCapture.ts` | NO CHANGE -- keep for dual-mic backward compat | Backward compatibility |
| presencialSessionManager | `apps/backend/realtime-service/src/services/presencialSessionManager.ts` | Add `speakerMapping` state to PresencialSession, modify `transcribeWithDeepgram` to request `utterances: true`, add speaker extraction logic from utterances response, modify `processAudioChunkAndReturn` to accept optional speaker param | Core processing change |
| websocket/presencial.ts | `apps/backend/realtime-service/src/websocket/presencial.ts` | Modify `presencialAudioChunk` handler to make `speaker` optional, add `speakerMapping` event handler, pass captureMode to session creation | Socket.IO protocol change |
| PresencialTranscription | `apps/frontend/src/components/presencial/PresencialTranscription.tsx` | Add cold-start indicator for unmapped speakers, handle `speakerId` field for highlighting active speaker | UI refinement |

### Components to CREATE (new files)

| Component | File | Responsibility |
|-----------|------|----------------|
| SingleMicrophoneControl | `apps/frontend/src/components/presencial/SingleMicrophoneControl.tsx` | Single mic selector dropdown, audio level indicator, simpler than DualMicrophoneControl |
| useSingleMicCapture | `apps/frontend/src/hooks/useSingleMicCapture.ts` | 1 getUserMedia, 1 MediaRecorder, 1 VAD, emits chunks WITHOUT speaker field |
| SpeakerMappingPanel | `apps/frontend/src/components/presencial/SpeakerMappingPanel.tsx` | Shows speaker_0 and speaker_1 with sample text, lets doctor assign roles (doctor/patient), emits mapping to backend |

### Components UNCHANGED

| Component | File | Why No Change |
|-----------|------|---------------|
| DualMicrophoneControl | `apps/frontend/src/components/presencial/DualMicrophoneControl.tsx` | Preserved for dual-mic mode |
| deepgramService.ts | `apps/backend/realtime-service/src/services/deepgramService.ts` | Used for streaming (remote consultations), not presencial |
| TranscriptionSegment type | `apps/frontend/src/types/transcription.ts` | Already has the `speaker` field as union type, no change needed |
| database.ts functions | `addTranscriptionToSession`, `appendConsultationTranscription` | Already accept `speaker: 'doctor' | 'patient'`, no schema change |

## Architectural Patterns

### Pattern 1: Utterance-Based Speaker Extraction

**What:** Use Deepgram's `utterances: true` parameter alongside `diarize: true` in the pre-recorded API call. Instead of parsing individual words and reassembling sentences, use the pre-segmented utterance objects which already contain `speaker`, `transcript`, and timing.

**When to use:** Always for single-mic mode. This is strictly better than word-level parsing.

**Why this over word-level parsing:** A single 5s chunk can contain speech from both speakers. Word-level parsing requires grouping consecutive words by speaker and joining them -- error-prone and duplicates logic Deepgram already does. Utterances give you clean segments with speaker IDs directly.

**Trade-offs:** Requires `utterances: true` in the API call (no extra cost, same API). One chunk may produce 0, 1, or multiple transcriptions (vs. exactly 0 or 1 in dual-mic mode).

**Implementation:**

```typescript
// In transcribeWithDeepgram() -- add utterances: true
const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
        model: 'nova-2',
        language: 'pt-BR',
        smart_format: true,
        punctuate: true,
        numerals: true,
        diarize: true,
        utterances: true,  // NEW -- get pre-segmented speaker utterances
        keywords: [/* existing keywords */],
    }
);

// Extract utterances with speaker info
const utterances = result?.results?.utterances || [];
// Each utterance: { speaker: 0|1, transcript: string, start, end, confidence, words[] }

// For single-mic mode, return array of transcriptions (one per utterance)
return utterances.map(u => ({
    text: u.transcript,
    speakerId: u.speaker,        // 0 or 1
    confidence: u.confidence,
    start: u.start,
    end: u.end
}));
```

### Pattern 2: Mode-Based Branching (Capture Mode Flag)

**What:** The session stores a `captureMode: 'single' | 'dual'` flag set at session creation time. All downstream logic branches on this flag rather than detecting the mode implicitly.

**When to use:** Throughout the pipeline -- frontend sends the mode in `startPresencialSession`, backend stores it in the session, processing logic branches on it.

**Trade-offs:** Small amount of conditional logic, but much cleaner than trying to auto-detect from payload shape. Explicit is better than implicit.

**Implementation:**

```typescript
// PresencialSession interface -- add captureMode
interface PresencialSession {
    // ... existing fields ...
    captureMode: 'single' | 'dual';
    speakerMapping: Map<number, 'doctor' | 'patient'> | null;  // null until mapped
}

// In processAudioChunkAndReturn -- branch on mode
if (session.captureMode === 'single') {
    // Use utterance-based extraction, return multiple transcriptions
    const utterances = await this.transcribeWithDeepgramDiarized(audioBuffer, session);
    for (const utt of utterances) {
        const role = session.speakerMapping?.get(utt.speakerId) || 'unknown';
        // ... save with role
    }
} else {
    // Existing dual-mic logic -- speaker comes from the chunk payload
    const result = await this.transcribeWithDeepgram(audioBuffer, speaker, 'pt-BR');
    // ... existing logic
}
```

### Pattern 3: Deferred Speaker Mapping with Retroactive Assignment

**What:** During the cold start period (first ~20-30s), Deepgram assigns all speech to speaker_0. Transcriptions are stored with raw `speakerId` (0 or 1). When the doctor manually maps speakers (e.g., "speaker_0 = doctor"), all existing transcriptions with that speakerId are retroactively updated.

**When to use:** Always in single-mic mode. The mapping happens in-memory on the session first, then persists to DB.

**Trade-offs:** Frontend must handle an "unmapped" state gracefully. Slight complexity in retroactive updates. But this is necessary because Deepgram diarization cold start is a known limitation.

**Implementation:**

```typescript
// Backend: speakerMapping event handler
socket.on('speakerMapping', async (data, callback) => {
    const { sessionId, mappings } = data;
    // mappings: { 0: 'doctor', 1: 'patient' }

    const session = presencialSessionManager.getSession(sessionId);
    session.speakerMapping = new Map(Object.entries(mappings).map(
        ([k, v]) => [parseInt(k), v as 'doctor' | 'patient']
    ));

    // Retroactively update all existing transcriptions in memory
    for (const t of session.transcriptions) {
        if (t.speakerId !== undefined && session.speakerMapping.has(t.speakerId)) {
            t.speaker = session.speakerMapping.get(t.speakerId)!;
        }
    }

    // Re-save to DB (overwrite transcriptions_med and transcriptions raw_text)
    await presencialSessionManager.resaveAllTranscriptions(session);

    callback({ success: true });
});
```

## Data Flow

### Single-Mic Audio Chunk Flow

```
[Doctor speaks into shared mic]
    |
    v
[Browser: 1 MediaRecorder captures mixed audio]
    | (every 5s, stop/restart cycle)
    v
[useSingleMicCapture: VAD check -- discard silence]
    | (if speech detected)
    v
[Socket.IO: emit 'presencialAudioChunk']
    { sessionId, audioChunk: base64, sequence, timestamp }
    (NO speaker field)
    |
    v
[presencial.ts: handler receives chunk]
    | (checks session.captureMode === 'single')
    v
[presencialSessionManager.processAudioChunkAndReturn()]
    | (single-mic path)
    v
[transcribeWithDeepgram() with utterances: true]
    | Deepgram returns: utterances[{ speaker: 0|1, transcript, ... }]
    v
[For each utterance:]
    |-- Map speaker ID to role via session.speakerMapping
    |-- If no mapping yet, store as speakerId only (role = 'unknown')
    |-- Create Transcription object
    |-- saveTranscriptionIncrementally()
    v
[Socket.IO: emit 'presencialTranscription' per utterance]
    { speaker: 'doctor'|'patient'|'unknown', text, speakerId: 0|1, timestamp }
    |
    v
[Frontend: page.tsx receives transcription]
    |-- If speaker === 'unknown', show with neutral styling + raw speakerId label
    |-- If mapped, show with doctor/patient styling (existing logic)
```

### Speaker Mapping Flow

```
[After ~20-30s, Deepgram starts returning speaker: 0 AND speaker: 1]
    |
    v
[Frontend: SpeakerMappingPanel shows]
    "Speaker 0 said: 'Bom dia, como voce esta se sentindo?'"
    "Speaker 1 said: 'Estou com dor de cabeca ha 3 dias'"
    [Button: Speaker 0 = Medico]  [Button: Speaker 0 = Paciente]
    |
    v
[Socket.IO: emit 'speakerMapping']
    { sessionId, mappings: { 0: 'doctor', 1: 'patient' } }
    |
    v
[Backend: retroactively update all transcriptions]
    |-- Update in-memory session.transcriptions[].speaker
    |-- Re-save to transcriptions_med and transcriptions raw_text
    |-- Emit 'speakerMappingConfirmed' + 'transcriptionsUpdated' to frontend
    v
[Frontend: re-render all transcriptions with correct speaker labels]
```

### Key Data Flow Differences: Dual-Mic vs Single-Mic

| Aspect | Dual-Mic (current) | Single-Mic (new) |
|--------|--------------------|--------------------|
| getUserMedia calls | 2 | 1 |
| MediaRecorder instances | 2 | 1 |
| VAD instances | 2 | 1 |
| Chunks per 5s interval | 0-2 (one per active mic) | 0-1 |
| Socket.IO payload `speaker` field | Required: `'doctor'` or `'patient'` | Absent |
| Deepgram API params | `diarize: true` (result ignored) | `diarize: true, utterances: true` |
| Transcriptions per chunk | 0 or 1 | 0 to N (one per utterance in chunk) |
| Speaker assignment | From payload field | From Deepgram `utterance.speaker` + mapping |
| Cold start handling | N/A (mic = identity) | First ~20-30s all speaker_0, needs manual mapping |

## Recommended Project Structure (changes only)

```
apps/frontend/src/
  hooks/
    usePresencialAudioCapture.ts        # KEEP (dual-mic mode)
    useSingleMicCapture.ts              # NEW
  components/presencial/
    DualMicrophoneControl.tsx           # KEEP (dual-mic mode)
    SingleMicrophoneControl.tsx         # NEW
    SpeakerMappingPanel.tsx             # NEW
    PresencialTranscription.tsx         # MODIFY (handle unknown speaker)
  app/(consulta)/consulta/presencial/
    page.tsx                            # MODIFY (mode toggle, new components)

apps/backend/realtime-service/src/
  services/
    presencialSessionManager.ts         # MODIFY (utterance extraction, speaker mapping)
  websocket/
    presencial.ts                       # MODIFY (optional speaker, new events)
```

### Structure Rationale

- **Separate hooks (useSingleMicCapture vs usePresencialAudioCapture):** The audio capture logic is fundamentally different (1 stream vs 2). Attempting to merge them into one hook with conditionals would create fragile, hard-to-test code. Two focused hooks is cleaner. The page.tsx selects which hook to use based on mode.
- **Separate mic controls (Single vs Dual):** Same reasoning. The UI for selecting 1 mic vs 2 mics is different enough to warrant separate components. Shared logic (device enumeration, level monitoring) can be extracted to a shared utility if needed.
- **SpeakerMappingPanel is new and separate:** It has no analog in dual-mic mode. It appears only after the first multi-speaker transcription arrives. Clean separation.

## Integration Points

### Socket.IO Protocol Changes

| Event | Current Payload | New Payload (single-mic) | Backward Compatible? |
|-------|----------------|--------------------------|---------------------|
| `startPresencialSession` | `{ consultationId, doctorMicrophoneId, patientMicrophoneId }` | `{ consultationId, microphoneId, captureMode: 'single' }` | YES -- backend checks for `captureMode` field; if absent, assumes `'dual'` |
| `presencialAudioChunk` | `{ sessionId, speaker, audioChunk, sequence, timestamp }` | `{ sessionId, audioChunk, sequence, timestamp }` (no speaker) | YES -- backend checks `session.captureMode`; if `'dual'`, requires `speaker` field; if `'single'`, ignores it |
| `speakerMapping` (NEW) | N/A | `{ sessionId, mappings: { 0: 'doctor', 1: 'patient' } }` | YES -- new event, ignored if not sent |
| `presencialTranscription` | `{ sessionId, speaker, text, timestamp, sequence }` | `{ sessionId, speaker, text, timestamp, sequence, speakerId?: number }` | YES -- `speakerId` is optional, existing frontend ignores unknown fields |

### Deepgram API Changes

| Parameter | Current | New (single-mic) |
|-----------|---------|-------------------|
| `diarize` | `true` (result ignored) | `true` (result used) |
| `utterances` | not set | `true` |
| `endpointing` | not set (default) | `800` (more context for diarization) |
| `utterance_end_ms` | not set (default) | `2000` (better speaker separation) |

Note: `endpointing` and `utterance_end_ms` are NOT available on the pre-recorded API -- they are streaming-only parameters. For pre-recorded, the chunk duration (5s) provides the context window. The PROJECT.md mentions these as target configs, but they only apply if you switch to streaming. For pre-recorded chunks, the relevant tuning is chunk size (currently 5s) -- longer chunks give Deepgram more context for diarization accuracy.

**IMPORTANT CORRECTION:** The PROJECT.md lists `endpointing: 800ms` and `utterance_end_ms: 2000ms` as target configurations. These parameters exist on the Deepgram **streaming** API (used in `deepgramService.ts` for remote consultations), but do NOT apply to the **pre-recorded** API used for presencial consultations. The presencial flow sends 5-second WebM chunks to the pre-recorded endpoint. Diarization quality for pre-recorded depends on chunk length and audio quality, not endpointing settings. This should be clarified during planning.

### Internal Boundaries

| Boundary | Communication | Considerations |
|----------|---------------|----------------|
| page.tsx <-> useSingleMicCapture | React hook return values | Hook returns `{ isRecording, startCapture, stopCapture, audioLevel, pendingChunks }` -- simpler API than dual-mic hook (no doctorLevel/patientLevel) |
| page.tsx <-> SpeakerMappingPanel | Props + callback | Panel receives transcriptions array, emits `onMappingConfirmed({ 0: 'doctor', 1: 'patient' })` |
| presencial.ts <-> presencialSessionManager | Direct method calls | Manager's `processAudioChunkAndReturn` needs to return an array of Transcription objects for single-mic mode (vs single object for dual-mic) |
| Session memory <-> Database | Incremental writes | Multiple transcriptions per chunk means multiple DB writes per chunk. Consider batching if performance is an issue (unlikely at this scale). |

## Anti-Patterns

### Anti-Pattern 1: Merging Single and Dual Hooks

**What people do:** Modify `usePresencialAudioCapture.ts` to conditionally create 1 or 2 MediaRecorders based on a mode prop.
**Why it is wrong:** The hook is already complex with refs, closures, and async lifecycle. Adding conditional branching doubles the test surface and makes bugs harder to trace. The two modes share almost no capture logic.
**Do this instead:** Create `useSingleMicCapture.ts` as a separate hook. The page component selects which hook to call. Shared utilities (blobToBase64, getBestAudioMimeType, VoiceActivityDetector) are already in `audioUtils.ts`.

### Anti-Pattern 2: Auto-Detecting Speaker Roles

**What people do:** Try to automatically determine which speaker is the doctor (e.g., by analyzing who speaks first, or by voice characteristics).
**Why it is wrong:** Deepgram's cold start assigns everything to speaker_0 for the first 20-30 seconds. The first speaker could be either person. Voice analysis requires ML models not in scope. This leads to incorrect attribution that undermines the entire transcription.
**Do this instead:** Manual mapping via the SpeakerMappingPanel. The doctor clicks a button to assign roles after Deepgram starts distinguishing speakers. Simple, reliable, correct.

### Anti-Pattern 3: Reassembling Utterances from Words

**What people do:** Parse `result.channels[0].alternatives[0].words[]`, group consecutive words by `speaker` field, join them into sentences.
**Why it is wrong:** Deepgram already does this with `utterances: true`. Re-implementing it means handling edge cases (speaker changes mid-sentence, punctuation, word ordering) that Deepgram handles correctly.
**Do this instead:** Use `utterances: true` and read `result.utterances[]` directly. Each utterance has `speaker`, `transcript`, timing, and confidence.

### Anti-Pattern 4: Storing Speaker Mapping in Frontend Only

**What people do:** Keep the speaker-to-role mapping in React state only, and convert speakerId to role when rendering.
**Why it is wrong:** The backend saves transcriptions incrementally to the database. If the mapping only exists in the frontend, the DB records will have raw speakerIds instead of roles. If the page refreshes, the mapping is lost. The webhook at session end sends transcription data from the backend -- it needs role labels.
**Do this instead:** Send the mapping to the backend via Socket.IO. Store it in the session. Backend applies mapping before saving to DB. Frontend is just the UI for selecting the mapping.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1-10 concurrent consultations) | In-memory sessions in presencialSessionManager singleton is fine. No changes needed. |
| 50+ concurrent consultations | Deepgram API rate limits may matter. Pre-recorded API has generous limits but monitor. Consider request queuing. |
| Cold start mitigation | Not a scaling issue but a UX issue. Consider increasing chunk size from 5s to 8-10s for single-mic mode to give Deepgram more context per chunk. This improves diarization accuracy at the cost of higher latency. |

### Scaling Priorities

1. **First bottleneck:** Deepgram API latency per chunk. Currently ~1-2s per 5s chunk. With single-mic producing potentially more utterances per chunk, the response size is slightly larger but latency is the same. Not a concern.
2. **Second bottleneck:** Multiple DB writes per chunk (one per utterance). At current scale (single-digit concurrent consultations), this is negligible. If needed, batch writes.

## Build Order (Dependency-Aware)

The following order minimizes blocked work and builds from backend to frontend:

1. **Backend: Modify `presencialSessionManager.ts`** -- Add `captureMode` and `speakerMapping` to session interface. Add utterance extraction logic. Add `resaveAllTranscriptions` method. This is the core change everything depends on. Can be tested with manual API calls.

2. **Backend: Modify `websocket/presencial.ts`** -- Make `speaker` optional in `presencialAudioChunk` handler. Add `speakerMapping` event handler. Add `captureMode` to `startPresencialSession`. Depends on (1).

3. **Frontend: Create `useSingleMicCapture.ts`** -- Independent of backend changes. 1 MediaRecorder, 1 VAD, emits chunks without speaker field. Can be tested in isolation.

4. **Frontend: Create `SingleMicrophoneControl.tsx`** -- Independent. Simple mic selector. Can use DualMicrophoneControl as template, remove the second mic.

5. **Frontend: Create `SpeakerMappingPanel.tsx`** -- Independent. Shows speaker samples, emits mapping. Can be built as a standalone component.

6. **Frontend: Modify `presencial/page.tsx`** -- Wire everything together. Mode toggle, conditional rendering, new hooks and components. Depends on (3), (4), (5).

7. **Frontend: Modify `PresencialTranscription.tsx`** -- Handle `speakerId` field and "unknown" speaker state. Minor change, can be done alongside (6).

8. **End-to-end testing and cold start tuning** -- Test the full flow, adjust chunk timing if needed, verify retroactive mapping works.

## Sources

- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- HIGH confidence, official documentation
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- HIGH confidence, official documentation
- [Deepgram Pre-recorded API Reference](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded) -- HIGH confidence, official documentation
- Codebase analysis of existing files -- HIGH confidence, direct code reading

---
*Architecture research for: Single-microphone diarization integration into existing presencial consultation system*
*Researched: 2026-03-30*
