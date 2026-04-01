# Pitfalls Research

**Domain:** Single-microphone diarization for presencial medical consultations (Deepgram)
**Researched:** 2026-03-30
**Confidence:** HIGH (code-verified + Deepgram official docs + community reports)

## Critical Pitfalls

### Pitfall 1: Speaker ID Non-Persistence Across Chunks (The Fundamental Flaw)

**What goes wrong:**
The current architecture sends 5-second audio chunks to Deepgram's pre-recorded API as independent requests. Each API call performs diarization in isolation -- speaker_0 in chunk #1 has NO guaranteed relationship to speaker_0 in chunk #5. Deepgram assigns speaker IDs based on clustering within a single audio file. Across separate API calls, the speaker who was `speaker_0` in one chunk could become `speaker_1` in the next, or every chunk could return only `speaker_0` because 5 seconds is insufficient for the clustering algorithm to detect two speakers.

**Why it happens:**
Pre-recorded API treats each request as a separate file. There is no session state between calls. Diarization is a clustering problem that requires sufficient audio context -- 5 seconds is often below the minimum needed for reliable speaker separation, especially when only one person speaks within a given chunk.

**How to avoid:**
1. **Increase chunk size significantly** -- 30-60 seconds minimum gives the diarizer enough context for speaker clustering. The current 5s chunks are almost certainly too short for reliable diarization.
2. **Alternatively, use streaming API** with a single long-lived WebSocket connection (the `deepgramService.ts` already implements streaming for remote consultations). Streaming diarization maintains speaker context across the entire session. However, note that streaming diarization has its own issues (Discussion #108 reports it always returning speaker_0).
3. **Hybrid approach:** Send chunks for transcription without diarization (current behavior), but also maintain a rolling buffer of the last 60-90 seconds. Periodically re-transcribe the buffer WITH diarization to retroactively assign speaker labels. This is complex but sidesteps the fundamental per-chunk limitation.
4. **Pragmatic approach:** Accept that per-chunk diarization will be unreliable. Use manual speaker mapping at session start (first speaker = doctor) and supplement with heuristics (medical terminology = likely doctor).

**Warning signs:**
- During testing, all words in a chunk attributed to `speaker_0`
- Speaker assignments flip between chunks (doctor becomes patient mid-conversation)
- Short chunks (< 10s of actual speech) consistently fail to diarize

**Phase to address:**
Phase 1 (Backend refactoring). This is an architectural decision that affects everything downstream. Must be resolved before building speaker mapping UI or data storage.

---

### Pitfall 2: nova-2 General Model Has Poor Diarization (nova-2-meeting Not Available for pt-BR)

**What goes wrong:**
Community reports (GitHub Discussion #584) confirm that `nova-2` (general) frequently fails to diarize, returning all words as `speaker_0`. The recommended fix is switching to `nova-2-meeting`, which is optimized for "conference room settings with multiple speakers and a single microphone" -- exactly this use case. However, `nova-2-meeting` only supports English (`en`, `en-US`). It does NOT support Portuguese (`pt-BR`).

**Why it happens:**
Deepgram's specialized model variants (meeting, phonecall, medical) have limited language support. The general `nova-2` model supports pt-BR but was not optimized for diarization in meeting-style scenarios. This creates a hard constraint: the best diarization model cannot be used with Portuguese.

**How to avoid:**
1. **Test extensively with `nova-2` + `diarize: true`** on real consultation audio before committing to this approach. Record several full consultations (15-30 min each) and measure diarization accuracy.
2. **Consider Nova-3** -- despite being out of scope for this milestone, Nova-3 has a next-generation diarization model trained on 100,000+ voices that is language-agnostic. If nova-2 diarization proves inadequate for pt-BR, Nova-3 may be the only viable path.
3. **Evaluate Deepgram's improved diarizer** (changelog entry) which claims "advanced speaker separation accurately identifies speakers in complex audio streams." Verify this applies to nova-2 with pt-BR.
4. **Have a fallback plan** -- if diarization quality is unacceptable, the dual-mic approach must remain available.

**Warning signs:**
- Test recordings consistently return single speaker
- Diarization only works when speakers have very different voice characteristics (male/female)
- Similar-sounding speakers (same gender, similar age) always merged into one speaker

**Phase to address:**
Phase 0 (Validation/Spike). This should be validated with real audio BEFORE any code changes. If diarization does not work adequately with nova-2 + pt-BR, the entire milestone approach needs reconsideration.

---

### Pitfall 3: Discarding the `speaker` Field Without Extracting Word-Level Speaker Data

**What goes wrong:**
The current `transcribeWithDeepgram()` method (line 100-143 of `presencialSessionManager.ts`) extracts only `transcript.transcript` (the full text) and `transcript.confidence`. It completely ignores the `words` array where each word has its own `speaker` property. When diarization is enabled, the speaker information is per-WORD, not per-transcript. The `transcript` string has no speaker annotations -- you must iterate `words` to extract who said what.

**Why it happens:**
The dual-mic system never needed per-word speaker extraction because the speaker was known from which microphone the audio came from. The `diarize: true` flag was already enabled but its output was never consumed. Developers assume the transcript text itself will somehow indicate the speaker, but Deepgram puts speaker labels only in the `words` array.

**How to avoid:**
1. Extract the `words` array from `transcript.words`
2. Group consecutive words by `speaker` ID to form speaker-attributed segments
3. Build a function like:
   ```typescript
   function groupWordsBySpeaker(words: DeepgramWord[]): { speaker: number; text: string; confidence: number }[]
   ```
4. Each resulting segment becomes a separate transcription entry with the appropriate speaker role
5. Also extract `speaker_confidence` (available in pre-recorded API) to flag low-confidence attributions

**Warning signs:**
- Transcription text appears correct but all attributed to same speaker
- No speaker differentiation visible in saved data despite `diarize: true`
- The `DeepgramTranscriptionResult` interface in `deepgramService.ts` (line 22-32) already defines `words` but WITHOUT the `speaker` field -- it must be extended

**Phase to address:**
Phase 1 (Backend refactoring). This is the core parsing change needed to make diarization functional.

---

### Pitfall 4: Cold Start -- First 20-30 Seconds All Attributed to speaker_0

**What goes wrong:**
Deepgram's diarization needs to hear multiple speakers before it can differentiate them. In the first 20-30 seconds (or in the pre-recorded API case, possibly the first several chunks), everything gets attributed to `speaker_0`. In a medical consultation, the doctor typically speaks first (greeting, asking what brings the patient in), so the first minute may be entirely doctor. The diarizer may never see enough patient speech in early chunks to establish a second speaker profile.

**Why it happens:**
Diarization is clustering-based. The algorithm needs voice samples from multiple speakers to create speaker embeddings. Until it hears a sufficiently different voice, it assigns everything to the first cluster. With 5-second chunks, the first 4-6 chunks might only contain the doctor speaking.

**How to avoid:**
1. **Buffer initial audio** -- do not attempt diarization on the first 30-60 seconds. Either:
   - Attribute initial audio to the doctor by default (since doctors typically start consultations)
   - Re-process the initial buffer once both speakers have been detected
2. **Manual first-speaker declaration** -- let the doctor indicate "I will speak first" in the UI. Use this as ground truth for early chunks.
3. **Calibration phase** -- have both speakers say a short phrase at the start ("Doctor: Olah. Patient: Olah.") to seed the diarizer with both voice profiles.
4. **With pre-recorded API chunks:** Buffer the first 60 seconds as one large chunk (instead of 5s chunks), send it with diarization, and use that to establish the speaker mapping for subsequent chunks.

**Warning signs:**
- First 5-10 transcription entries all show same speaker
- Speaker mapping becomes inverted after the first few minutes
- Doctor's greeting gets attributed to patient (or vice versa) in the final transcript

**Phase to address:**
Phase 2 (Speaker mapping logic). After the backend can extract speaker IDs, this phase handles the mapping and warm-up strategy.

---

### Pitfall 5: Breaking the Dual-Mic Flow While Building Single-Mic

**What goes wrong:**
The current system is deeply coupled to the dual-mic paradigm. The `AudioChunk` interface has `speaker: 'doctor' | 'patient'` coming FROM THE FRONTEND -- the frontend KNOWS who is speaking because each mic is assigned to a role. The `PresencialSession` interface has `doctorMicrophoneId` and `patientMicrophoneId`. The `usePresencialAudioCapture` hook creates TWO MediaRecorders. If you modify these to support single-mic, you risk breaking the existing dual-mic flow that is already working in production.

**Why it happens:**
The temptation is to modify the existing hooks and handlers in-place. But the dual-mic flow is the fallback if diarization quality is poor. Destroying the working path while building the experimental one leaves no safe retreat.

**How to avoid:**
1. **Keep dual-mic code intact** -- create new hooks/components alongside existing ones:
   - `useSingleMicAudioCapture.ts` (new) alongside `usePresencialAudioCapture.ts` (keep)
   - `SingleMicrophoneControl.tsx` (new) alongside `DualMicrophoneControl.tsx` (keep)
2. **Feature flag** -- add a toggle (environment variable or user setting) to switch between modes
3. **Shared backend handler** -- the `presencialAudioChunk` socket event can accept chunks from either mode. For dual-mic, `speaker` comes from frontend. For single-mic, `speaker` is determined server-side from diarization.
4. **Do NOT modify `PresencialSession` interface** until single-mic is validated. Add optional fields instead.

**Warning signs:**
- Tests for dual-mic start failing
- Doctor reports transcription stopped working after update
- No way to quickly revert to dual-mic without code changes

**Phase to address:**
Phase 1 (Backend refactoring). Structure the code for both modes from the start.

---

### Pitfall 6: Storing Diarized Transcriptions in Wrong Format

**What goes wrong:**
The current save path uses `saveTranscriptionIncrementally()` which writes to two tables:
- `transcriptions_med` (structured conversation array per session)
- `transcriptions` (raw_text append with `[MEDICO]`/`[PACIENTE]` labels)

The downstream webhook sends `[doctor]: text` / `[patient]: text` format. If diarization produces a chunk where speaker switches mid-sentence, the current one-chunk-one-speaker model breaks. A single 5s chunk might contain: doctor says "Como voce esta?" then patient says "Bem, obrigado" -- this is ONE chunk with TWO speakers.

**Why it happens:**
The current architecture assumes 1 chunk = 1 speaker (because each mic captures one person). With diarization, 1 chunk = potentially N speaker segments. The entire save/emit pipeline needs to handle multiple transcription entries from a single audio chunk.

**How to avoid:**
1. After extracting word-level speaker data from Deepgram, split into per-speaker segments
2. Each segment becomes a separate `Transcription` object with its own speaker role
3. Update `processAudioChunkAndReturn()` to return `Transcription[]` instead of `Transcription | null`
4. Update the socket emission to send multiple transcription events per chunk
5. Ensure `saveTranscriptionIncrementally()` handles multiple entries per chunk
6. Maintain correct ordering -- segments must be saved in chronological order, not grouped by speaker

**Warning signs:**
- Mixed-speaker text attributed to one person in the transcript
- "Doctor" says things the patient clearly said
- Raw text in database has wrong `[MEDICO]`/`[PACIENTE]` labels on mixed segments

**Phase to address:**
Phase 1 (Backend refactoring). Must be designed before the save pipeline is modified.

---

### Pitfall 7: No Rollback Strategy if Diarization Quality is Unacceptable

**What goes wrong:**
The team invests weeks building single-mic diarization, ships it, and discovers in production that diarization accuracy for pt-BR medical consultations is below 70%. Doctors lose trust in the system. There is no way to quickly revert because the dual-mic code was removed or entangled with single-mic changes.

**Why it happens:**
Diarization accuracy is highly dependent on real-world conditions: room acoustics, microphone quality, speaker distance, accent similarity, overlapping speech. Lab testing with clean audio gives optimistic results that do not reflect production environments (clinic rooms with AC noise, patients mumbling, etc.).

**How to avoid:**
1. **Validate with real audio first** (Phase 0 spike) -- record 5-10 real consultations, process them through the proposed pipeline, measure accuracy
2. **Define acceptance criteria** before building: "Diarization must correctly attribute >85% of words in >80% of consultations"
3. **Keep dual-mic as primary** and single-mic as "beta" option initially
4. **Implement a confidence dashboard** -- track diarization confidence scores per consultation, alert when quality drops
5. **Build a manual correction UI** -- let doctors fix speaker attributions post-consultation as a safety net

**Warning signs:**
- Average `speaker_confidence` below 0.6
- Doctors manually correcting >30% of transcriptions
- Complaints about wrong speaker attribution in generated medical records

**Phase to address:**
Phase 0 (Validation spike) and Phase 3 (UI with correction capabilities).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code speaker_0 = doctor | Simplifies mapping logic | Breaks when doctor is not first to speak, or when Deepgram assigns IDs differently | Never in production; acceptable for initial spike only |
| Skip word-level parsing, use transcript text only | Faster implementation | Loses all diarization data, makes single-mic useless | Never -- this defeats the purpose |
| Remove dual-mic code to simplify | Less code to maintain | No rollback path | Never during this milestone; can remove after 3+ months of stable single-mic |
| 5s chunks with diarization | No architecture change needed | Very poor diarization accuracy | Acceptable for spike/testing only; production needs larger chunks or streaming |
| Skip calibration/warm-up logic | Simpler UX, faster start | First 30-60s of every consultation misattributed | Only if doctor reviews all transcriptions post-consultation |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Deepgram pre-recorded API | Sending 5s chunks expecting cross-chunk speaker consistency | Each call is independent. Either use much larger chunks (30-60s) or switch to streaming for speaker-context persistence |
| Deepgram words array | Assuming `words[].speaker` is always present | `speaker` field only appears when `diarize: true` AND diarization succeeds. Must handle undefined/missing speaker gracefully |
| Deepgram `speaker_confidence` | Ignoring confidence values | Filter or flag words with `speaker_confidence < 0.5` for manual review |
| Deepgram model selection | Using `nova-2-meeting` for pt-BR | `nova-2-meeting` only supports English. Must use `nova-2` (general) for pt-BR |
| Socket.IO emission | Emitting one `presencialTranscription` per chunk | Single-mic chunks may contain multiple speaker segments; emit one event per segment |
| Database raw_text append | Appending entire chunk text with single speaker label | Must split chunk into per-speaker segments before appending |
| Webhook payload | Sending `[doctor]: mixed text` | Downstream webhook consumers expect clean speaker attribution; mixed text breaks downstream AI processing |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Diarization adds 3-4x latency to pre-recorded API | Transcriptions appear delayed, UI feels sluggish | Accept the latency or disable diarization for real-time display (re-diarize later) | Immediately -- every API call is slower |
| Larger chunks (30-60s) mean longer wait for first transcription | Doctor speaks for 30s before seeing any text | Show interim non-diarized text immediately, apply diarization retroactively | First consultation |
| Re-processing audio buffer for retroactive diarization | Double API costs, increased Deepgram usage | Budget for 1.5-2x current Deepgram costs; implement smart buffering | At scale (many concurrent consultations) |
| VAD with single mic discards chunks where both speak softly | Lost speech in quiet moments | Lower VAD threshold for single-mic mode; current threshold (0.08 RMS, 30% speech ratio, 1.5s min) tuned for single-speaker mic | Quiet patients, soft-spoken doctors |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full transcription text in console | PHI (Protected Health Information) in server logs | Truncate logged text to first 20 chars; use consultation ID for debugging |
| Sending raw transcription in webhook without speaker verification | Misattributed medical statements in patient record | Validate speaker attribution before triggering webhook; flag uncertain attributions |
| Storing speaker_id mapping in client-side state only | Lost on page refresh; could attribute all speech to wrong person | Store mapping server-side in session; client sends confirmation only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing speaker_0/speaker_1 labels to doctor | Confusing, not actionable | Show "Speaker A"/"Speaker B" with clear prompt to assign roles |
| Auto-mapping speakers without confirmation | Wrong assignments go unnoticed | Require explicit doctor confirmation: "Is this your voice?" with audio playback |
| No visual indicator of which speaker is active | Doctor cannot verify diarization is working | Real-time color-coded indicator showing current detected speaker |
| Removing mic selection entirely | Doctor cannot fall back to dual-mic | Keep mic count selector (1 mic / 2 mics) in UI |
| Showing diarized text as final/immutable | Doctor trusts incorrect attributions | Mark diarized attributions as "suggested" with edit capability |
| No indication of diarization confidence | Doctor trusts low-confidence attributions equally | Color-code or mark low-confidence segments |

## "Looks Done But Isn't" Checklist

- [ ] **Diarization extraction:** Words array is parsed AND speaker field is extracted -- verify `words[i].speaker` is not undefined
- [ ] **Speaker mapping:** speaker_0/speaker_1 correctly mapped to doctor/patient -- verify with audio where patient speaks first
- [ ] **Cold start handling:** First 30s of audio handled gracefully -- verify attribution accuracy on consultation opening
- [ ] **Multi-speaker chunks:** Single chunk with 2 speakers produces 2 separate transcription entries -- verify with overlapping speech audio
- [ ] **Database consistency:** Both `transcriptions_med` and `transcriptions` tables have correct speaker labels -- verify with database query after test consultation
- [ ] **Webhook format:** Downstream webhook receives correctly attributed `[doctor]`/`[patient]` labels -- verify webhook payload in logs
- [ ] **Dual-mic still works:** Original flow untouched -- run existing dual-mic consultation end-to-end after changes
- [ ] **Edge case: single speaker only:** Consultation where patient barely speaks -- verify doctor monologue is not split into 2 speakers
- [ ] **Edge case: very short utterances:** "Sim", "Nao", "Hmm" correctly attributed -- verify with test audio
- [ ] **Feature flag:** Can switch between single-mic and dual-mic without code deployment -- verify toggle works

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Speaker IDs inconsistent across chunks | MEDIUM | Implement post-processing that uses voice similarity to re-cluster speakers across all chunks at end of consultation |
| nova-2 diarization too poor for pt-BR | HIGH | Evaluate Nova-3, evaluate alternative services (AssemblyAI), or abandon single-mic approach |
| Dual-mic code broken during refactoring | LOW (if branched) / HIGH (if not) | Git revert to pre-refactor state; this is why feature branches and feature flags are critical |
| Wrong speaker mapping in production data | MEDIUM | Build admin tool to re-process consultations with corrected mapping; notify affected doctors |
| Cold start misattribution in saved records | LOW | Add post-consultation "review and correct" step; re-diarize full audio at end of session |
| Database has mixed speaker labels | HIGH | Migration script to re-process affected consultations; requires original audio chunks (not currently stored) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Speaker ID non-persistence across chunks | Phase 0 (Spike) | Test 5s chunks vs 30s chunks vs streaming; measure accuracy |
| nova-2 diarization quality for pt-BR | Phase 0 (Spike) | Process 5+ real consultation recordings; calculate word-level accuracy |
| Discarding speaker field from words | Phase 1 (Backend) | Unit test: parse Deepgram response, verify speaker extraction |
| Cold start attribution | Phase 2 (Speaker mapping) | Integration test: first 60s of consultation correctly handled |
| Breaking dual-mic flow | Phase 1 (Backend) | E2E test: dual-mic consultation still works after refactoring |
| Wrong transcription storage format | Phase 1 (Backend) | Integration test: multi-speaker chunk produces correct DB entries |
| No rollback strategy | Phase 0 (Spike) + Phase 1 (Backend) | Feature flag verified; dual-mic test suite passes |

## Sources

- [Deepgram Diarization Docs](https://developers.deepgram.com/docs/diarization) -- official feature documentation
- [Deepgram Multichannel vs Diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization) -- when to use each approach
- [Deepgram Models & Languages Overview](https://developers.deepgram.com/docs/models-languages-overview) -- nova-2-meeting only supports English
- [GitHub Discussion #108: Streaming diarization always returns speaker 0](https://github.com/orgs/deepgram/discussions/108) -- streaming diarization issues
- [GitHub Discussion #584: Diarization not working](https://github.com/orgs/deepgram/discussions/584) -- nova-2-meeting recommendation, model-specific issues
- [GitHub Discussion #475: Speaker diarization with speaker names](https://github.com/orgs/deepgram/discussions/475) -- speaker naming limitations
- [Deepgram Next-Gen Diarization Announcement](https://deepgram.com/learn/nextgen-speaker-diarization-and-language-detection-models) -- 53.1% accuracy improvement, language-agnostic model
- [Deepgram Improved Speaker Diarization Changelog](https://deepgram.com/changelog/improved-speaker-diarization) -- pre-recorded diarization improvements
- Codebase analysis: `presencialSessionManager.ts`, `deepgramService.ts`, `usePresencialAudioCapture.ts`, `presencial.ts` (websocket handler)

---
*Pitfalls research for: Single-microphone diarization for presencial medical consultations*
*Researched: 2026-03-30*
