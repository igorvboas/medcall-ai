# Phase 2: Backend Diarization - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side changes to accumulate audio chunks from the client into 60s+ batches, send them to Deepgram pre-recorded API with diarization and utterances enabled, extract speaker attribution from the response, store diarized transcriptions in the database, and support retroactive speaker mapping when the doctor assigns roles. No frontend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Chunk Accumulation (DIAR-01)
- **D-01:** Timer-based accumulation with 60s window. Accumulate 5s client chunks in an in-memory buffer (Map<sessionId, AudioBuffer[]>). After 60s, concatenate all buffered chunks into a single audio payload and send to Deepgram pre-recorded API.
- **D-02:** Buffer size is trivial (~1.2MB per 60s at current chunk sizes). No need for disk-based buffering.
- **D-03:** Timer resets after each flush — continuous accumulation while session is active. On session end, flush any remaining buffer regardless of size.
- **D-04:** Minimum batch size: 60s (validated in Phase 1 spike). If session ends before 60s, send whatever is accumulated — diarization may be partial but text will still be transcribed.

### Deepgram API Configuration (DIAR-02)
- **D-05:** Add `utterances: true` to pre-recorded API calls alongside existing `diarize: true`. This returns speaker-attributed utterances instead of just words.
- **D-06:** Keep existing nova-2 model and pt-BR language. Keep existing medical keywords boost.
- **D-07:** Remove individual chunk processing for single-mic mode. Single-mic mode uses ONLY the batch accumulation path, not the per-chunk Deepgram calls.

### Transcription Delivery Timing
- **D-08:** Hybrid approach — during accumulation window, process individual chunks through Deepgram WITHOUT diarization (fast, unattributed) for immediate feedback to the doctor. When 60s batch completes with diarization, replace unattributed transcriptions with speaker-attributed ones.
- **D-09:** Emit `presencialTranscription` events for immediate unattributed text (speaker='unknown'). Emit `presencialDiarizedBatch` event when batch is processed with speaker labels. Frontend (Phase 3) will handle the replacement.

### Speaker Extraction (DIAR-03)
- **D-10:** Extract from Deepgram utterances response: `utterance.speaker` (int), `utterance.confidence` (float), `utterance.transcript` (string), `utterance.start`/`utterance.end` (float).
- **D-11:** Map Deepgram speaker IDs (0, 1) to internal speaker_id format: `speaker_0`, `speaker_1`. These are arbitrary per API call — role mapping (medico/paciente) happens separately via DIAR-06.

### Storage (DIAR-04)
- **D-12:** Store diarized transcriptions in existing `transcriptions_med` table. Use `speaker` field for role ('doctor'/'patient'/'unknown'), `speaker_id` for Deepgram speaker identifier ('speaker_0'/'speaker_1').
- **D-13:** Add `diarization_confidence` field (numeric) to track per-utterance confidence from Deepgram.
- **D-14:** Add `batch_id` field (varchar) to group utterances from the same 60s batch — enables retroactive updates.
- **D-15:** Continue dual-save: per-utterance to `transcriptions_med` + append to `transcriptions.raw_text` with speaker prefix format `[SPEAKER_0] (HH:mm:ss): text`.

### Confidence Threshold (DIAR-05)
- **D-16:** Threshold value: 0.7 (70%). Utterances with speaker_confidence >= 0.7 get auto-assigned speaker_id. Below 0.7 → speaker='unknown', needs_review=true.
- **D-17:** Add `needs_review` boolean field to `transcriptions_med` for flagging low-confidence utterances.
- **D-18:** Threshold is configurable via environment variable `DIARIZATION_CONFIDENCE_THRESHOLD` (default 0.7) — allows tuning without code changes.

### Retroactive Speaker Mapping (DIAR-06)
- **D-19:** New Socket.IO event `mapSpeakers` accepts mapping: `{ sessionId, mapping: { speaker_0: 'doctor', speaker_1: 'patient' } }`.
- **D-20:** On mapping received, batch UPDATE all `transcriptions_med` rows for that session: set `speaker` based on mapping, clear `needs_review` for mapped speakers.
- **D-21:** Also update `transcriptions.raw_text` — regenerate the full text with correct `[MEDICO]`/`[PACIENTE]` prefixes.
- **D-22:** Store mapping in `call_sessions.metadata` as `{ speakerMapping: { speaker_0: 'doctor', speaker_1: 'patient' } }` for persistence.
- **D-23:** Emit `speakerMappingUpdated` Socket.IO event to all room participants after DB update completes — frontend refreshes speaker labels.

### Claude's Discretion
- Internal buffer data structure implementation details (Map vs class)
- Error handling for Deepgram API failures during batch processing
- Logging strategy for debugging diarization results
- Timer implementation (setInterval vs setTimeout chain)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend Service
- `apps/backend/realtime-service/src/services/presencialSessionManager.ts` — Current chunk processing logic. Must be refactored for batch accumulation.
- `apps/backend/realtime-service/src/services/deepgramService.ts` — Current Deepgram API configuration. Has `diarize: true` already but discards speaker field.
- `apps/backend/realtime-service/src/websocket/presencial.ts` — Socket.IO event handlers for presencial sessions.

### Database
- `schema_prod.sql` — Production schema with `transcriptions_med`, `transcriptions`, `call_sessions` tables.

### Types
- `apps/backend/realtime-service/src/types/audio.ts` — AudioChunk interface.
- `apps/backend/realtime-service/src/types/transcription.ts` — Transcription types.

### Spike Results
- `spike/validation-diarization/README.md` — Validation results: 60s minimum chunks, CONDITIONAL GO decision.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `presencialSessionManager.ts` — Has session lifecycle (create/process/end), incremental save logic, anti-hallucination filter. Refactor to add batch accumulation.
- `deepgramService.ts` — Has Deepgram client setup, medical keywords, streaming connection management. Pre-recorded API path needs utterances extraction.
- `transcriptions_med` table — Already has `speaker`, `speaker_id`, `confidence` fields. Needs `diarization_confidence`, `batch_id`, `needs_review` additions.

### Established Patterns
- Socket.IO event pattern: `eventName` → handler in `presencial.ts` → service call → emit response
- Dual-save: per-utterance to `transcriptions_med` + text append to `transcriptions.raw_text`
- Audio arrives as base64, converted to Buffer for processing
- Anti-hallucination filtering via `isValidTranscriptionText()`

### Integration Points
- `presencial.ts` event handlers — add `mapSpeakers` event, modify `presencialAudioChunk` for accumulation mode
- `call_sessions.metadata` — already stores microphone IDs, extend with speaker mapping
- Webhook at session end — must include diarized transcription with speaker attribution

</code_context>

<specifics>
## Specific Ideas

- Phase 1 spike validated that 60s chunks detect 2 speakers in 100% of cases. Use this as the minimum batch size.
- DIAR-01 in REQUIREMENTS.md says "30s+" but Phase 1 validated 60s minimum — use 60s.
- Speaker IDs are arbitrary per Deepgram API call (speaker_0 in batch 1 might be speaker_1 in batch 2). The retroactive mapping (DIAR-06) handles this by letting the doctor assign roles once and applying to all.
- Current `presencialSessionManager.ts` processes chunks synchronously with `processAudioChunkAndReturn()`. The batch approach needs async processing with a timer.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-backend-diarization*
*Context gathered: 2026-03-30*
