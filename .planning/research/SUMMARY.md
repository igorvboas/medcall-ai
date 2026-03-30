# Project Research Summary

**Project:** Single-Microphone Presencial Consultation with Deepgram Diarization
**Domain:** Healthcare medical consultation transcription (pt-BR)
**Researched:** 2026-03-30
**Confidence:** MEDIUM

## Executive Summary

This project replaces the existing dual-microphone presencial consultation setup with a single shared microphone, relying on Deepgram's server-side diarization to distinguish doctor from patient. The existing stack (`@deepgram/sdk ^3.13.0`, Web Audio API, MediaRecorder, Socket.IO) requires zero new dependencies -- the work is configuration changes, response parsing, and frontend simplification. Deepgram already returns `speaker` and `speaker_confidence` per word when `diarize: true` is set; the current codebase enables this flag but completely discards the output.

The recommended approach is: keep the pre-recorded API with chunk-based processing, add `utterances: true` for pre-grouped speaker segments, create a separate `useSingleMicCapture` hook alongside the existing dual-mic hook, and implement manual speaker mapping where the doctor assigns roles after ~30 seconds of audio. The dual-mic code must remain intact as a fallback. A mode flag (`captureMode: 'single' | 'dual'`) drives all branching throughout the pipeline.

The dominant risk is diarization quality. The `nova-2` general model was not optimized for diarization, and the specialized `nova-2-meeting` model does not support pt-BR. Community reports indicate nova-2 frequently returns all speech as `speaker_0`. Additionally, the current 5-second chunk architecture is fundamentally unsuitable for diarization -- each pre-recorded API call is independent with no cross-chunk speaker persistence. Chunks must be accumulated to 30+ seconds server-side before sending to Deepgram. **A validation spike with real consultation audio is mandatory before committing to implementation.** If diarization accuracy is below acceptable thresholds with nova-2 + pt-BR, the entire approach may need reconsideration (Nova-3 upgrade or alternative service).

## Key Findings

### Recommended Stack

No new packages required. The entire change is configuration and code refactoring within the existing stack.

**Core technologies (unchanged):**
- `@deepgram/sdk ^3.13.0`: Already supports `diarize: true` + `utterances: true` on pre-recorded API. Do NOT upgrade to v4.x (breaking changes, zero benefit).
- `Web Audio API / MediaRecorder`: Simplifies from 2 recorders to 1. Existing `VoiceActivityDetector` reusable as-is.
- `Socket.IO ^4.8.1`: Add new `speakerMapping` event, make `speaker` field optional on `presencialAudioChunk`. No transport changes.

**Critical configuration changes:**
- Add `utterances: true` to Deepgram pre-recorded calls (returns speaker-grouped segments)
- Parse `speaker` and `speaker_confidence` from utterances/words (currently discarded)
- Accumulate 5s client chunks into 30s+ batches server-side before sending to Deepgram

**What NOT to use:** `wavesurfer.js`, `@ricky0123/vad-web`, Deepgram streaming API for presencial, `nova-2-meeting` (English only), client-side diarization, Nova-3 (out of scope).

### Expected Features

**Must have (table stakes):**
- Single microphone selection UI (replaces DualMicrophoneControl)
- Server-side chunk accumulation (30s batches) -- critical for diarization accuracy
- Speaker field extraction from Deepgram utterances response
- Manual speaker mapping UI ("Quem e Speaker 0?" with Medico/Paciente buttons)
- Cold-start warm-up indicator (banner during first ~30s)
- Speaker-labeled real-time transcription (existing component, new data source)
- Session data model update (single mic ID, speaker mapping, capture mode flag)

**Should have (competitive):**
- Active speaker indicator (color-coded, derived from incoming transcriptions)
- Speaker confidence visualization (flag segments with confidence < 0.6)
- Auto-suggest speaker mapping (keyword-density heuristic, doctor confirms)
- Incremental display during chunk accumulation (progressive reveal UX)

**Defer (v2+):**
- Post-consultation speaker correction (segment-level reassignment)
- 3+ speaker support (data model ready, UI deferred)
- Speaker voice profiles (auto-map across sessions)
- Streaming diarization for presencial

### Architecture Approach

The architecture adds a parallel single-mic path alongside the existing dual-mic flow, governed by a `captureMode: 'single' | 'dual'` flag set at session creation. The backend branches on this flag: dual-mic uses speaker from the Socket.IO payload (as today), single-mic extracts speaker from Deepgram utterances and applies a manual mapping. Three new frontend components are created alongside existing ones -- no existing files are deleted.

**Major components:**
1. `useSingleMicCapture.ts` (NEW) -- 1 MediaRecorder, 1 VAD, emits chunks without speaker field
2. `SingleMicrophoneControl.tsx` (NEW) -- single device selector with audio level indicator
3. `SpeakerMappingPanel.tsx` (NEW) -- displays speaker samples, lets doctor assign roles, emits mapping to backend
4. `presencialSessionManager.ts` (MODIFY) -- adds utterance extraction, speaker mapping state, retroactive mapping, chunk accumulation
5. `websocket/presencial.ts` (MODIFY) -- optional speaker field, new `speakerMapping` event, capture mode routing

**Key patterns:**
- Utterance-based speaker extraction (use `utterances: true`, not manual word grouping)
- Mode-based branching (explicit `captureMode` flag, not implicit detection)
- Deferred speaker mapping with retroactive assignment (buffer unmapped transcriptions, apply roles when confirmed)

### Critical Pitfalls

1. **Speaker ID non-persistence across chunks** -- Each pre-recorded API call is independent; speaker_0 in chunk #1 has no relationship to speaker_0 in chunk #5. Accumulate to 30s+ chunks server-side. This is the single most important architectural change.
2. **nova-2 diarization quality for pt-BR is unvalidated** -- `nova-2-meeting` (optimized for single-mic multi-speaker) only supports English. Community reports of nova-2 returning all speech as speaker_0. Must validate with real audio before building anything.
3. **Cold start: first 20-30s all speaker_0** -- Diarization needs to hear multiple speakers before differentiating. Show warm-up indicator, buffer initial audio, apply manual mapping retroactively.
4. **Breaking dual-mic while building single-mic** -- Keep all existing dual-mic code intact. Create new hooks/components alongside, never modify in-place. Dual-mic is the production fallback.
5. **Storing multi-speaker chunks as single-speaker entries** -- One chunk can contain both speakers. `processAudioChunkAndReturn()` must return `Transcription[]` (array), not single object. Each utterance becomes its own DB entry.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Diarization Validation Spike
**Rationale:** The biggest risk is that nova-2 diarization simply does not work well enough for pt-BR medical consultations. This must be validated before investing in code changes.
**Delivers:** Go/no-go decision with quantified accuracy metrics
**Addresses:** Pitfalls #1 (chunk sizing) and #2 (nova-2 quality)
**Tasks:** Record 5-10 real consultations, process through Deepgram pre-recorded API with various chunk sizes (5s, 15s, 30s, 60s), measure word-level speaker attribution accuracy. Define acceptance criteria (recommend >85% accuracy on >80% of consultations).
**Avoids:** Investing weeks in implementation only to discover diarization is unusable

### Phase 1: Backend Foundation (Chunk Accumulation + Speaker Extraction)
**Rationale:** Everything downstream depends on the backend producing correctly diarized, speaker-attributed transcriptions. This is the critical path.
**Delivers:** Backend that accumulates chunks, calls Deepgram with utterances, extracts speaker IDs, stores multi-speaker transcriptions correctly
**Addresses:** Server-side chunk accumulation, speaker field extraction, session data model update, multi-speaker storage format
**Uses:** Existing `@deepgram/sdk ^3.13.0` with `utterances: true` config
**Avoids:** Pitfalls #1 (chunk persistence), #3 (discarding speaker field), #6 (wrong storage format)

### Phase 2: Frontend Single-Mic Capture + Speaker Mapping
**Rationale:** Once the backend produces diarized output, the frontend needs to capture from a single mic and let the doctor map speakers.
**Delivers:** Single-mic audio capture, speaker mapping UI, cold-start warm-up indicator, mode toggle (single/dual)
**Addresses:** Single mic selection UI, manual speaker mapping, cold-start indicator, backward-compatible mode switching
**Implements:** `useSingleMicCapture`, `SingleMicrophoneControl`, `SpeakerMappingPanel`
**Avoids:** Pitfalls #4 (cold start UX), #5 (breaking dual-mic)

### Phase 3: Integration + Polish
**Rationale:** Wire frontend to backend, verify end-to-end flow, handle edge cases, ensure dual-mic still works.
**Delivers:** Complete single-mic consultation flow, retroactive speaker mapping, updated transcription display, verified webhook output
**Addresses:** Speaker-labeled real-time transcription, retroactive mapping when confirmed, webhook format correctness
**Avoids:** Pitfall #5 (dual-mic regression), #7 (no rollback strategy)

### Phase 4: Enhancements (v1.x)
**Rationale:** After core flow is validated in production, add polish features.
**Delivers:** Active speaker indicator, confidence visualization, auto-suggest mapping, incremental display
**Addresses:** All "should have" features from FEATURES.md

### Phase Ordering Rationale

- **Phase 0 before everything** because nova-2 pt-BR diarization quality is the existential risk. No point building if diarization does not work.
- **Phase 1 before Phase 2** because frontend cannot be tested without backend producing diarized data. Backend is the dependency.
- **Phase 2 creates new components alongside existing ones** (never modifies dual-mic code), preserving the rollback path.
- **Phase 3 is integration** -- only possible after both backend and frontend pieces exist.
- **Phase 4 is deferred** because core flow must be validated in real consultations first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0:** Needs hands-on experimentation with real audio. No amount of documentation reading replaces testing with actual pt-BR medical consultation recordings.
- **Phase 1:** The chunk accumulation strategy (how to buffer 5s client chunks into 30s server batches, how to handle the latency this introduces) needs detailed design. The FEATURES research flagged this as the "single most important architectural change."

Phases with standard patterns (skip research-phase):
- **Phase 2:** Frontend audio capture and UI components follow well-documented Web Audio API and React patterns. The architecture research provides explicit component specs.
- **Phase 3:** Integration testing and webhook verification are standard engineering work.
- **Phase 4:** All enhancement features are low-complexity, well-understood patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies needed. Deepgram SDK capabilities verified against official docs. Clear version compatibility. |
| Features | MEDIUM | Feature list is solid, but chunk accumulation impact on UX (30s latency) needs real-world validation. Competitor analysis shows this is standard in medical scribe apps. |
| Architecture | HIGH | Clear component boundaries, explicit build order, backward-compatible protocol changes. Codebase analysis directly verified against existing files. |
| Pitfalls | HIGH | Well-documented with community reports and official Deepgram discussions. Critical pitfalls (chunk sizing, nova-2 quality) confirmed by multiple sources. |

**Overall confidence:** MEDIUM

The stack, architecture, and pitfalls are well-understood. The medium overall rating is driven by one critical unknown: **whether nova-2 diarization produces acceptable accuracy for pt-BR medical consultations with accumulated chunks.** This cannot be answered by research alone -- it requires the Phase 0 validation spike.

### Gaps to Address

- **nova-2 pt-BR diarization accuracy:** No published benchmarks exist for this specific combination. Must be validated empirically in Phase 0.
- **Optimal chunk accumulation size:** Research suggests 30s+ but the exact sweet spot (30s vs 45s vs 60s) depends on real consultation audio patterns. Test in Phase 0.
- **Latency tolerance:** 30s chunk accumulation means ~30s delay before diarized text appears. Need to validate that doctors accept this latency. Consider interim non-diarized display.
- **endpointing/utterance_end_ms confusion in PROJECT.md:** These are streaming-only parameters but PROJECT.md lists them as targets for presencial (pre-recorded). Clarify during planning -- they do not apply to the pre-recorded API.
- **Nova-3 as fallback:** If nova-2 diarization fails, Nova-3 has a language-agnostic diarization model with 53% accuracy improvement. Currently out of scope but should be the contingency plan.

## Sources

### Primary (HIGH confidence)
- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- response format, speaker/speaker_confidence fields
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- utterance objects with speaker attribution
- [Deepgram Multichannel vs Diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization) -- confirms diarization is correct for single-mic
- [Deepgram Pre-recorded API Reference](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded) -- API parameters
- [GitHub Discussion #773: Diarization Delay](https://github.com/orgs/deepgram/discussions/773) -- 20-30s cold start on streaming, pre-recorded works better
- [GitHub Discussion #584: Diarization not working](https://github.com/orgs/deepgram/discussions/584) -- nova-2-meeting recommendation, model issues
- Codebase analysis of `presencialSessionManager.ts`, `deepgramService.ts`, `usePresencialAudioCapture.ts`, `presencial.ts`

### Secondary (MEDIUM confidence)
- [Deepgram Next-Gen Diarization](https://deepgram.com/learn/nextgen-speaker-diarization-and-language-detection-models) -- 53.1% accuracy improvement, language-agnostic
- [Deepgram Models & Languages Overview](https://developers.deepgram.com/docs/models-languages-overview) -- nova-2-meeting only supports English
- [AssemblyAI Medical Scribe Best Practices](https://www.assemblyai.com/docs/medical-scribe-best-practices) -- `speakers_expected`, role-based mapping patterns
- [GitHub Discussion #108: Streaming always speaker 0](https://github.com/orgs/deepgram/discussions/108) -- streaming diarization limitation
- [GitHub Discussion #1033: Diarization Inconsistencies](https://github.com/orgs/deepgram/discussions/1033) -- short audio clips degrade quality

### Tertiary (LOW confidence)
- [Commure Scribe AI Guide](https://www.commure.com/blog-scribe/ai-medical-scribe) -- SOAP generation, post-visit review patterns
- [AWS HealthScribe](https://aws.amazon.com/healthscribe/) -- turn-by-turn transcript with speaker roles
- [Rudder Analytics: Medical Transcription](https://rudderanalytics.com/2025/11/04/streamlining-medical-transcription-with-speaker-diarization/) -- general medical diarization patterns

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
