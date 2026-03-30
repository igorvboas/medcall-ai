# Feature Research

**Domain:** Single-microphone presencial medical consultation with Deepgram diarization
**Researched:** 2026-03-30
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single microphone selection UI | The whole point of the milestone -- eliminate dual-mic setup friction | LOW | Replace `DualMicrophoneControl` with a single dropdown + audio level meter. Persist selection to localStorage like current impl. |
| Real-time speaker-labeled transcription | Already exists for dual-mic; removing it would be a regression | MEDIUM | `PresencialTranscription` component already renders speaker-colored segments. Must now derive speaker from Deepgram's `speaker` field instead of which mic captured audio. |
| Speaker mapping prompt (speaker_0/speaker_1 to Medico/Paciente) | Without this, transcription is useless -- "Speaker 0 said X" means nothing to a doctor | MEDIUM | Show mapping UI after first ~30s when diarization stabilizes. Doctor clicks "I am Speaker 0" or "I am Speaker 1". Persist per session. |
| Cold-start indicator / warm-up UX | First 20-30s of diarization are unreliable (all attributed to speaker_0). Doctor needs to know why labels look wrong initially. | LOW | Banner: "Calibrando identificacao de falantes... (~30s)". Hide speaker labels or mark them as "provisional" during warm-up. Remove banner once both speaker_0 and speaker_1 appear in results. |
| Backend: single Deepgram connection extracting speaker field | Core plumbing -- without this, no diarization data reaches the frontend | HIGH | **CRITICAL ARCHITECTURE ISSUE:** Current 5-second chunks are far too short for diarization. Deepgram's pre-recorded diarization accuracy degrades severely with clips under 3 minutes. Must either (a) accumulate chunks into 30s+ batches before sending to Deepgram, or (b) switch to Deepgram streaming API for presencial (which has its own cold-start issue but improves over time). Recommendation: accumulate to 30s chunks. |
| Optimized Deepgram config (endpointing, utterance_end) | Already planned in PROJECT.md. Needed for diarization quality. | LOW | `endpointing: 800`, `utterance_end_ms: 2000`, `diarize: true`, `utterances: true`. These params are already partially present in `deepgramService.ts`. For pre-recorded, add `utterances: true` to get speaker-grouped segments. |
| Session data model update (remove dual-mic fields, add speaker mapping) | Backend `PresencialSession` interface has `doctorMicrophoneId` + `patientMicrophoneId` -- needs to become single mic + speaker mapping state | LOW | Replace with `microphoneId: string` and `speakerMapping: Record<number, 'doctor'\|'patient'>`. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Active speaker indicator in real-time | Shows which speaker (Medico/Paciente) is currently talking via visual pulse/highlight. Builds doctor confidence that the system is "listening correctly". | LOW | Derive from incoming transcription events -- when a new segment arrives with `speaker: X`, highlight the mapped role. Already have audio level meter infrastructure; repurpose it. |
| Speaker confidence visualization | Deepgram pre-recorded returns `speaker_confidence` per word. Show low-confidence segments with a subtle visual marker (e.g., lighter color, dashed border). Helps doctor know which segments to review. | LOW | Only available in pre-recorded API, not streaming. Parse `speaker_confidence` from word-level results. Threshold: < 0.6 = "uncertain". |
| Auto-detect speaker mapping from speech patterns | Instead of manual "I am Speaker 0" prompt, detect that the first speaker to say clinical terms (diagnostico, receita, medicamento) is likely the doctor. Use keyword density heuristic. | MEDIUM | NOT a replacement for manual mapping (per PROJECT.md out-of-scope: "Diarizacao automatica sem mapeamento manual"). But could be a suggested default: "Parece que Speaker 0 e o medico. Confirmar?" Doctor still clicks to confirm. |
| Chunk accumulation with incremental display | Accumulate 30s of audio, send to Deepgram, get diarized result, but display transcription progressively as segments arrive rather than in one 30s dump. | MEDIUM | UX trick: show a "processing..." indicator while accumulating, then render segments with staggered animation. Avoids the jarring experience of no transcription for 30s then a wall of text. |
| Post-consultation speaker correction | After consultation ends, allow doctor to review transcript and reassign individual segments to the correct speaker if diarization got them wrong. | HIGH | Adds an edit mode to `PresencialTranscription` where each segment gets a toggle (Medico/Paciente). Changes update `transcriptions_med` and `transcriptions` in DB. Industry standard in medical scribe apps (Commure, AWS HealthScribe). Defer to v1.x. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully automatic speaker-to-role mapping (no user confirmation) | "The AI should just know who is the doctor" | Deepgram diarization assigns arbitrary numeric IDs (0, 1) that can swap between sessions or even mid-session. Cold start makes first 30s unreliable. Auto-mapping without confirmation will silently misattribute medical statements. In healthcare, wrong attribution = liability. | Manual mapping with optional auto-suggestion. Doctor confirms with one click. |
| Real-time streaming diarization for presencial (instead of pre-recorded chunks) | Lower latency, feels more "live" | Deepgram streaming diarization has a 20-30s cold start where ALL speech goes to speaker_0. Pre-recorded API with accumulated chunks gives better diarization accuracy after the accumulation window. Switching to streaming requires refactoring the entire presencial audio pipeline and socket events. | Keep pre-recorded API but accumulate 30s+ chunks. Latency is acceptable for consultation transcription (not a real-time caption use case). |
| Support for 3+ speakers | "Sometimes a nurse is in the room" | Deepgram diarization can return speaker_2, speaker_3, etc., but mapping UI and cold-start handling become exponentially harder. Explicitly out of scope per PROJECT.md. | Design the mapping data model to support N speakers (`Record<number, string>`) but only expose 2-speaker UI for v1. |
| Word-level speaker editing in post-consultation review | "Let me fix individual words" | Diarization operates at word level, but editing at word level is UX nightmare. Words are 0.1-0.5s each; users cannot meaningfully review hundreds of words. | Segment-level correction (entire utterance/sentence reassigned to different speaker). Much more tractable UX. |
| Keeping 5-second chunk architecture for diarization | "It works for transcription, just add diarize=true" | **This is the biggest trap.** 5-second audio clips contain at most 1-2 short sentences. Deepgram cannot reliably distinguish speakers from 5s of audio -- it needs context across multiple speaker turns. The current architecture was designed for dual-mic where speaker identity comes from WHICH mic, not from the audio content. | Accumulate to 30s+ chunks for Deepgram diarization. Keep 5s client-side recording cycle for VAD and buffering, but batch them server-side before sending to Deepgram. |

## Feature Dependencies

```
[Single Mic Selection UI]
    |
    v
[Backend: Single Deepgram Connection + Chunk Accumulation (30s+)]
    |
    +---> [Speaker Field Extraction from Deepgram Response]
    |         |
    |         v
    |     [Speaker Mapping UI (manual: speaker_0 -> Medico)]
    |         |
    |         +---> [Real-time Speaker-Labeled Transcription]
    |         |         |
    |         |         +---> [Active Speaker Indicator]
    |         |         +---> [Speaker Confidence Visualization]
    |         |
    |         +---> [Cold-Start Indicator/Warm-up UX]
    |
    +---> [Session Data Model Update]
              |
              v
          [Post-Consultation Speaker Correction] (v1.x)

[Auto-Detect Speaker Mapping] --enhances--> [Speaker Mapping UI]

[Chunk Accumulation] --conflicts--> [5s Chunk Direct-to-Deepgram]
```

### Dependency Notes

- **Single Mic Selection UI** is the entry point; must ship first as it changes frontend audio capture.
- **Backend Chunk Accumulation** is the critical architectural change. Without it, diarization on 5s chunks will be unreliable. All speaker features depend on this.
- **Speaker Field Extraction** requires `utterances: true` + `diarize: true` on the Deepgram pre-recorded call and parsing `speaker` from words/utterances.
- **Speaker Mapping UI** depends on extraction working -- cannot map speakers if you cannot distinguish them.
- **Cold-Start Indicator** depends on mapping UI -- it guards the mapping interaction.
- **Post-Consultation Speaker Correction** depends on the full pipeline working and is deferred.
- **Chunk Accumulation CONFLICTS with current 5s direct-to-Deepgram pattern.** Server must buffer 5s client chunks and batch them into 30s+ before calling Deepgram. This is the single most important architectural change.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate single-mic presencial.

- [ ] **Single microphone selection UI** -- replaces DualMicrophoneControl, simplifies doctor setup
- [ ] **Server-side chunk accumulation (30s batches)** -- critical for diarization accuracy, cannot ship without this
- [ ] **Speaker field extraction from Deepgram response** -- parse `speaker` and `speaker_confidence` from words/utterances
- [ ] **Manual speaker mapping UI** -- one-time prompt: "Quem e Speaker 0?" with Medico/Paciente buttons
- [ ] **Cold-start warm-up indicator** -- banner during first 30s, provisional labels
- [ ] **Speaker-labeled real-time transcription** -- existing PresencialTranscription component with diarization-derived labels
- [ ] **Session data model update** -- single mic ID, speaker mapping state, updated Socket.IO events

### Add After Validation (v1.x)

Features to add once core single-mic flow is proven.

- [ ] **Active speaker indicator** -- add once mapping is reliable, low effort
- [ ] **Speaker confidence visualization** -- add once we have real-world data on confidence distributions
- [ ] **Auto-suggest speaker mapping** -- keyword-density heuristic to pre-select mapping, doctor confirms
- [ ] **Post-consultation speaker correction** -- edit mode in transcript review, segment-level reassignment
- [ ] **Incremental display during accumulation** -- show "processing" state with progressive reveal

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **3+ speaker support** -- data model ready, UI deferred
- [ ] **Speaker voice profiles** -- store doctor's voice signature to auto-map across sessions (requires Deepgram speaker recognition or custom embedding)
- [ ] **Streaming diarization for presencial** -- revisit if Deepgram improves cold-start behavior or if latency requirements change

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Single microphone selection UI | HIGH | LOW | P1 |
| Server-side chunk accumulation (30s) | HIGH | HIGH | P1 |
| Speaker field extraction | HIGH | MEDIUM | P1 |
| Manual speaker mapping UI | HIGH | MEDIUM | P1 |
| Cold-start warm-up indicator | MEDIUM | LOW | P1 |
| Speaker-labeled transcription (updated) | HIGH | LOW | P1 |
| Session data model update | HIGH | LOW | P1 |
| Active speaker indicator | MEDIUM | LOW | P2 |
| Speaker confidence visualization | LOW | LOW | P2 |
| Auto-suggest speaker mapping | MEDIUM | MEDIUM | P2 |
| Post-consultation speaker correction | HIGH | HIGH | P3 |
| Chunk accumulation incremental display | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | AWS HealthScribe | Commure Scribe | AssemblyAI Medical | Our Approach |
|---------|------------------|----------------|-------------------|--------------|
| Speaker diarization | Built-in, turn-by-turn transcript with speaker roles | Automatic with SOAP generation | 2.9% DER, `speakers_expected` param | Deepgram pre-recorded with 30s accumulated chunks, manual role mapping |
| Speaker mapping | Automatic (clinician/patient) | Automatic | Role-based or name-based configuration | Manual with auto-suggestion (v1.x) |
| Post-visit review | Full transcript with word-level references to source audio | SOAP note review with edit capability | Hybrid: streaming review + high-accuracy re-process | Segment-level speaker correction (v1.x) |
| Cold-start handling | N/A (full recording processed) | N/A (full recording processed) | keyterm priming, `speakers_expected=2` | Warm-up indicator + provisional labels for first 30s |
| Real-time display | No (batch processing) | Near real-time | Streaming + batch re-process | 30s batch with incremental reveal UX |

## Sources

- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- HIGH confidence: official documentation on diarize param, speaker/speaker_confidence fields, pre-recorded vs streaming support
- [Deepgram Working with Timestamps, Utterances, and Diarization](https://deepgram.com/learn/working-with-timestamps-utterances-and-speaker-diarization-in-deepgram) -- HIGH confidence: response format examples, combining utterances+diarize
- [Deepgram Next-Gen Diarization](https://deepgram.com/learn/nextgen-speaker-diarization-and-language-detection-models) -- MEDIUM confidence: 53.1% accuracy improvement, language-agnostic model
- [Deepgram Discussion #773: Diarization Delay on Livestream](https://github.com/orgs/deepgram/discussions/773) -- HIGH confidence: confirms 20-30s cold start on streaming, pre-recorded works correctly
- [Deepgram Discussion #475: Speaker Names](https://github.com/orgs/deepgram/discussions/475) -- HIGH confidence: confirms numeric-only speaker labels, no name mapping
- [Deepgram Discussion #1033: Diarization Inconsistencies Nova-2](https://github.com/orgs/deepgram/discussions/1033) -- MEDIUM confidence: confirms short audio clips degrade diarization quality
- [AssemblyAI Medical Scribe Best Practices](https://www.assemblyai.com/docs/medical-scribe-best-practices) -- HIGH confidence: `speakers_expected`, role-based mapping, post-visit review workflow
- [Commure Scribe AI Medical Scribe Guide](https://www.commure.com/blog-scribe/ai-medical-scribe) -- MEDIUM confidence: SOAP note generation, post-visit review patterns
- [AWS HealthScribe](https://aws.amazon.com/healthscribe/) -- MEDIUM confidence: turn-by-turn transcript with speaker roles, word-level references
- [Rudder Analytics: Medical Transcription with Speaker Diarization](https://rudderanalytics.com/2025/11/04/streamlining-medical-transcription-with-speaker-diarization/) -- LOW confidence: general medical diarization patterns

---
*Feature research for: Single-microphone presencial consultation with Deepgram diarization*
*Researched: 2026-03-30*
