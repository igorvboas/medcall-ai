# Stack Research: Single-Microphone Diarization Support

**Domain:** Medical consultation transcription (presencial, single mic)
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

The existing stack (`@deepgram/sdk ^3.13.0`, Web Audio API VAD, MediaRecorder, Socket.IO) already supports everything needed for single-microphone diarization. No new libraries are required. The changes are entirely **configuration and code refactoring** -- not new dependencies.

Deepgram's pre-recorded API already returns `speaker` and `speaker_confidence` fields in every word object when `diarize: true` is set. The current codebase already passes `diarize: true` but **discards the speaker field** from the response. The work is: stop discarding it, add `utterances: true` for better speaker grouping, and refactor the frontend from dual-mic to single-mic capture.

## What Already Exists (No Changes Needed)

| Technology | Current Version | Status |
|------------|----------------|--------|
| `@deepgram/sdk` | `^3.13.0` | Sufficient -- diarize + utterances supported since v3.x |
| Web Audio API (VAD) | Browser native | Works unchanged for single stream |
| MediaRecorder API | Browser native | Simplifies to 1 recorder instead of 2 |
| Socket.IO | `^4.8.1` | No changes needed to transport layer |
| `audioUtils.ts` (VoiceActivityDetector) | Custom | Reusable as-is for single stream |

## Recommended Stack Changes

### Backend: Deepgram Configuration Changes

| Change | Current | New | Why |
|--------|---------|-----|-----|
| `utterances` param | Not set | `utterances: true` | Groups words into speaker-attributed utterances, eliminating manual word-by-word speaker grouping |
| `endpointing` | `300` (streaming) / not set (pre-recorded) | `800` (pre-recorded chunks context) | Longer endpointing gives diarization more context per chunk for better speaker separation |
| `utterance_end_ms` | `1000` (streaming) | `2000` (if using streaming path) | More buffer for diarization to settle speaker assignment |
| Response parsing | Ignores `speaker` field in words | Extract `speaker` + `speaker_confidence` from words array | Core feature -- map speaker_0/speaker_1 to doctor/patient |
| Chunk size | 5s | Consider 8-10s | Longer chunks give diarization significantly more context; 5s is minimal for speaker separation |

### Backend: No SDK Upgrade Needed

`@deepgram/sdk ^3.13.0` fully supports:
- `diarize: true` on pre-recorded API (returns `speaker: number` and `speaker_confidence: number` per word)
- `utterances: true` on pre-recorded API (returns utterance objects with speaker attribution)
- `smart_format: true`, `punctuate: true`, `numerals: true` (already configured)
- `keywords` boosting (already configured)

The latest SDK is v4.11.3 but upgrading is **not recommended** for this milestone -- it is a major version change with potential breaking API changes, and v3.x does everything needed.

### Frontend: Simplification (Remove, Don't Add)

| Action | Component | Detail |
|--------|-----------|--------|
| **Remove** | `DualMicrophoneControl.tsx` | Replace with `SingleMicrophoneControl.tsx` -- simpler, one device selector |
| **Refactor** | `usePresencialAudioCapture.ts` | Remove dual MediaRecorder/VAD/stream logic. Single MediaStream, single MediaRecorder, single VAD |
| **Add** | Speaker mapping UI | Simple toggle: "Quem esta falando agora?" or initial calibration step. No new library needed -- plain React state |
| **Add** | Active speaker indicator | Use existing `VoiceActivityDetector.getAudioLevel()` with color coding per mapped speaker. No new library |
| **Keep** | `audioUtils.ts` | `VoiceActivityDetector`, `blobToBase64`, `getBestAudioMimeType` all reusable unchanged |

### No New Frontend Libraries Needed

Audio visualization of speaker detection does NOT require a new library because:
1. The existing `VoiceActivityDetector` already uses Web Audio API `AnalyserNode` for RMS levels
2. Speaker identification comes from Deepgram server-side (not client-side) -- the frontend only needs to display which speaker Deepgram identified
3. A simple CSS progress bar (already implemented in `DualMicrophoneControl.tsx`) suffices for audio level display
4. Speaker labels (`Speaker 0` / `Speaker 1` mapped to Medico/Paciente) are text overlays, not audio visualizations

## Deepgram Pre-Recorded API Response Format (with diarize + utterances)

This is the response structure the backend needs to parse:

```typescript
// Words array (already partially parsed, just add speaker fields)
interface DiarizationWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
  speaker: number;              // NEW: 0, 1, etc.
  speaker_confidence: number;   // NEW: 0.0 - 1.0
}

// Utterances array (NEW -- enable with utterances: true)
interface DiarizationUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DiarizationWord[];
  speaker: number;              // Speaker for entire utterance
  id: string;                   // Utterance ID
}

// Access: result.results.utterances[] for pre-grouped speaker segments
// Access: result.results.channels[0].alternatives[0].words[] for word-level
```

## Speaker Mapping Strategy (No Library Needed)

The speaker mapping (speaker_0 -> doctor, speaker_1 -> patient) requires:

1. **Backend**: A `Map<number, 'doctor' | 'patient'>` per session, initially empty
2. **Frontend**: A UI element letting the doctor assign roles after the first ~30s of audio
3. **Protocol**: New Socket.IO event `mapSpeaker` to send mapping from frontend to backend
4. **Cold start handling**: Buffer transcriptions with raw speaker IDs until mapping is confirmed

This is pure application logic -- no external libraries.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Keep `@deepgram/sdk@^3.13.0` | Upgrade to v4.x | Breaking changes, unnecessary risk for zero benefit in this milestone |
| Pre-recorded API (chunks) | Switch to streaming API | Streaming diarization has worse cold start (20-30s all speaker_0). Pre-recorded handles shorter segments better. Architecture already works. |
| `utterances: true` param | Manual word-grouping by speaker | Deepgram already groups by speaker with utterances -- no need to re-implement |
| 8-10s chunk size | Keep 5s chunks | 5s is minimal for diarization context. Longer chunks improve speaker separation accuracy significantly. Trade-off: slightly higher latency for transcription display. |
| Manual speaker mapping | Automatic speaker detection | Cold start makes first 20-30s unreliable. Medical context requires certainty about who said what. Manual mapping is safer. |
| `nova-2` model | `nova-2-medical` or `nova-2-phonecall` | `nova-2` is already validated for pt-BR. Medical/phonecall variants may help diarization but need separate testing. Flag for post-milestone evaluation. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `wavesurfer.js` or audio visualization libraries | Over-engineered for showing which speaker is active. Adds bundle size for a CSS progress bar job. | Existing `VoiceActivityDetector.getAudioLevel()` + CSS |
| `@ricky0123/vad-web` or similar ML-based VAD | The current RMS-based VAD works well enough for chunk filtering. ML VAD adds complexity and bundle size. | Keep existing `VoiceActivityDetector` class |
| Deepgram streaming API for presencial | Streaming diarization has 20-30s cold start where all speech goes to speaker_0. Pre-recorded API handles this better per-chunk. | Keep pre-recorded API with chunk approach |
| `@deepgram/sdk@^4.x` or `@^5.x` | Major version upgrades with breaking changes. Zero benefit for this feature. | Stay on `^3.13.0` |
| Client-side speaker diarization (e.g., `pyannote` via WASM) | Massive complexity, poor browser performance, pt-BR support unknown | Server-side Deepgram diarization |
| Nova-3 model | Explicitly out of scope per PROJECT.md. Nova-2 works for pt-BR. | `nova-2` |

## Configuration Changes Summary

### Backend `presencialSessionManager.ts` -- Deepgram call changes

```typescript
// CURRENT
const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
  audioBuffer,
  {
    model: 'nova-2',
    language: 'pt-BR',
    smart_format: true,
    punctuate: true,
    numerals: true,
    diarize: true,       // Already set!
    keywords: [...]
  }
);

// NEW -- add utterances, adjust for better diarization
const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
  audioBuffer,
  {
    model: 'nova-2',
    language: 'pt-BR',
    smart_format: true,
    punctuate: true,
    numerals: true,
    diarize: true,       // Already set
    utterances: true,    // NEW: get pre-grouped speaker segments
    keywords: [...]
  }
);
```

### Frontend `usePresencialAudioCapture.ts` -- Simplification

```typescript
// CURRENT: 2 streams, 2 recorders, 2 VADs
// doctorStream + patientStream
// doctorRecorder + patientRecorder
// doctorVAD + patientVAD

// NEW: 1 stream, 1 recorder, 1 VAD
// singleStream
// singleRecorder
// singleVAD
// Speaker comes from Deepgram response, not from which mic captured it
```

### Socket.IO Event Changes

```typescript
// CURRENT event payload
socket.emit('presencialAudioChunk', {
  sessionId,
  speaker: 'doctor' | 'patient',  // Known from which mic
  audioChunk: base64Data,
  sequence,
  timestamp
});

// NEW event payload
socket.emit('presencialAudioChunk', {
  sessionId,
  audioChunk: base64Data,          // Speaker NOT known at capture time
  sequence,
  timestamp
  // speaker removed -- determined by Deepgram diarization
});

// NEW event -- speaker mapping
socket.emit('mapSpeaker', {
  sessionId,
  speakerId: 0,                    // Deepgram's speaker_0
  role: 'doctor'                   // Mapped by the doctor via UI
});

// UPDATED transcription event
io.to(sessionId).emit('presencialTranscription', {
  sessionId,
  speaker: 'doctor' | 'patient',  // Now from diarization mapping
  speakerId: 0,                    // Raw Deepgram speaker ID
  speakerConfidence: 0.85,         // NEW: confidence level
  text: '...',
  timestamp,
  sequence,
  isMapped: true                   // NEW: whether speaker mapping is confirmed
});
```

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@deepgram/sdk@^3.13.0` | 3.x latest | `diarize: true`, `utterances: true` | All features available |
| `socket.io@^4.8.1` | 4.x | `socket.io-client@^4.8.1` | No changes needed |
| `next@^14.2.0` | 14.x | React 18, Web Audio API | No changes needed |
| MediaRecorder API | Browser native | Chrome 49+, Firefox 25+, Safari 14.1+ | Already validated in current app |
| Web Audio API (AnalyserNode) | Browser native | All modern browsers | Already validated |

## Installation

```bash
# No new packages needed!
# The existing stack supports everything required.

# If you want to verify current Deepgram SDK version:
cd apps/backend/realtime-service && npm ls @deepgram/sdk
```

## Sources

- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- Response format with speaker + speaker_confidence fields (HIGH confidence)
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- Utterances combined with diarization for speaker-grouped segments (HIGH confidence)
- [Deepgram Multichannel vs Diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization) -- Confirms diarization is correct choice for single-mic (HIGH confidence)
- [Deepgram Discussion #773 - Diarization Delay](https://github.com/orgs/deepgram/discussions/773) -- Cold start issue: streaming has 20-30s delay, pre-recorded API works better (HIGH confidence)
- [Deepgram Discussion #108 - Diarize streaming always speaker 0](https://github.com/orgs/deepgram/discussions/108) -- Confirms streaming diarization limitation (MEDIUM confidence)
- [@deepgram/sdk npm](https://www.npmjs.com/package/@deepgram/sdk) -- Latest is v4.11.3, v3.x still supported (HIGH confidence)
- Codebase analysis: `deepgramService.ts`, `presencialSessionManager.ts`, `usePresencialAudioCapture.ts`, `audioUtils.ts` -- Direct code inspection (HIGH confidence)

---
*Stack research for: Single-microphone presencial consultation with Deepgram diarization*
*Researched: 2026-03-30*
