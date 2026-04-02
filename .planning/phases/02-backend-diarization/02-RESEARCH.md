# Phase 2: Backend Diarization - Research

**Researched:** 2026-03-30
**Domain:** Deepgram pre-recorded API diarization, audio batch accumulation, speaker attribution storage
**Confidence:** HIGH

## Summary

This phase transforms the presencial session audio pipeline from per-chunk-immediate-transcription to a hybrid model: immediate unattributed transcriptions for responsiveness, plus 60s batch processing with diarization for speaker attribution. The Deepgram pre-recorded API already has `diarize: true` in the codebase but the speaker data is discarded. Adding `utterances: true` to the API call provides structured speaker-attributed utterances with start/end times, speaker IDs, and speaker_confidence scores.

The main architectural change is introducing a timer-based audio accumulator in `presencialSessionManager.ts` that buffers 5s client chunks into 60s batches. The existing `processAudioChunkAndReturn()` continues for immediate feedback (without diarization), and a new batch processing path sends concatenated audio to Deepgram with `utterances: true` + `diarize: true`. The database schema needs three new columns on `transcriptions_med` (`diarization_confidence`, `batch_id`, `needs_review`) and the speaker constraint must be relaxed to allow 'unknown'. A new Socket.IO event `mapSpeakers` enables retroactive speaker mapping.

**Primary recommendation:** Refactor `presencialSessionManager.ts` to add batch accumulation as a parallel path alongside existing per-chunk processing. Do NOT remove per-chunk processing -- it provides immediate unattributed feedback. The batch path replaces unattributed entries with diarized ones when ready.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Timer-based accumulation with 60s window. Accumulate 5s client chunks in an in-memory buffer (Map<sessionId, AudioBuffer[]>). After 60s, concatenate all buffered chunks into a single audio payload and send to Deepgram pre-recorded API.
- **D-02:** Buffer size is trivial (~1.2MB per 60s at current chunk sizes). No need for disk-based buffering.
- **D-03:** Timer resets after each flush -- continuous accumulation while session is active. On session end, flush any remaining buffer regardless of size.
- **D-04:** Minimum batch size: 60s (validated in Phase 1 spike). If session ends before 60s, send whatever is accumulated.
- **D-05:** Add `utterances: true` to pre-recorded API calls alongside existing `diarize: true`.
- **D-06:** Keep existing nova-2 model and pt-BR language. Keep existing medical keywords boost.
- **D-07:** Remove individual chunk processing for single-mic mode. Single-mic mode uses ONLY the batch accumulation path, not the per-chunk Deepgram calls.
- **D-08:** Hybrid approach -- during accumulation window, process individual chunks through Deepgram WITHOUT diarization (fast, unattributed) for immediate feedback. When 60s batch completes with diarization, replace unattributed transcriptions with speaker-attributed ones.
- **D-09:** Emit `presencialTranscription` events for immediate unattributed text (speaker='unknown'). Emit `presencialDiarizedBatch` event when batch is processed with speaker labels.
- **D-10:** Extract from Deepgram utterances: `utterance.speaker` (int), `utterance.confidence` (float), `utterance.transcript` (string), `utterance.start`/`utterance.end` (float).
- **D-11:** Map Deepgram speaker IDs (0, 1) to internal speaker_id format: `speaker_0`, `speaker_1`.
- **D-12:** Store diarized transcriptions in existing `transcriptions_med` table. Use `speaker` field for role ('doctor'/'patient'/'unknown'), `speaker_id` for Deepgram speaker identifier ('speaker_0'/'speaker_1').
- **D-13:** Add `diarization_confidence` field (numeric) to track per-utterance confidence from Deepgram.
- **D-14:** Add `batch_id` field (varchar) to group utterances from the same 60s batch.
- **D-15:** Continue dual-save: per-utterance to `transcriptions_med` + append to `transcriptions.raw_text` with speaker prefix format `[SPEAKER_0] (HH:mm:ss): text`.
- **D-16:** Threshold value: 0.7 (70%). Utterances with speaker_confidence >= 0.7 get auto-assigned speaker_id. Below 0.7 -> speaker='unknown', needs_review=true.
- **D-17:** Add `needs_review` boolean field to `transcriptions_med` for flagging low-confidence utterances.
- **D-18:** Threshold is configurable via environment variable `DIARIZATION_CONFIDENCE_THRESHOLD` (default 0.7).
- **D-19:** New Socket.IO event `mapSpeakers` accepts mapping: `{ sessionId, mapping: { speaker_0: 'doctor', speaker_1: 'patient' } }`.
- **D-20:** On mapping received, batch UPDATE all `transcriptions_med` rows for that session: set `speaker` based on mapping, clear `needs_review` for mapped speakers.
- **D-21:** Also update `transcriptions.raw_text` -- regenerate the full text with correct `[MEDICO]`/`[PACIENTE]` prefixes.
- **D-22:** Store mapping in `call_sessions.metadata` as `{ speakerMapping: { speaker_0: 'doctor', speaker_1: 'patient' } }` for persistence.
- **D-23:** Emit `speakerMappingUpdated` Socket.IO event to all room participants after DB update completes.

### Claude's Discretion
- Internal buffer data structure implementation details (Map vs class)
- Error handling for Deepgram API failures during batch processing
- Logging strategy for debugging diarization results
- Timer implementation (setInterval vs setTimeout chain)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIAR-01 | Servidor acumula chunks de 5s do cliente em batches de 30s+ antes de enviar ao Deepgram | Timer-based accumulation in presencialSessionManager.ts; user locked 60s window (D-01). Buffer is in-memory Map<sessionId, {chunks, timer, batchNumber}>. |
| DIAR-02 | Servidor envia `utterances: true` + `diarize: true` ao Deepgram pre-recorded API | Add `utterances: true` to existing `transcribeWithDeepgram()` options. Already has `diarize: true`. SDK v3.13.0 supports both options. |
| DIAR-03 | Servidor extrai `speaker` e `speaker_confidence` de cada utterance do response Deepgram | Response `result.results.utterances[]` contains: speaker (int), confidence (float), transcript (string), start/end (float). Word-level has speaker_confidence. |
| DIAR-04 | Servidor armazena transcricoes com speaker_id atribuido (speaker_0, speaker_1) | Requires schema migration: add `diarization_confidence`, `batch_id`, `needs_review` columns. Relax speaker CHECK constraint to include 'unknown'. Change storage pattern from JSON-array-in-single-row to per-utterance rows. |
| DIAR-05 | Servidor usa confidence threshold para decidir auto-assign vs marcar como "incerto" | Configurable via `DIARIZATION_CONFIDENCE_THRESHOLD` env var (default 0.7). Below threshold: speaker='unknown', needs_review=true. |
| DIAR-06 | Servidor suporta mapeamento retroativo de speaker | New `mapSpeakers` Socket.IO event. Batch UPDATE on transcriptions_med + regenerate transcriptions.raw_text. Store mapping in call_sessions.metadata. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @deepgram/sdk | 3.13.0 | Pre-recorded transcription with diarization | Already installed and configured in the project |
| @supabase/supabase-js | (existing) | Database operations for transcriptions_med, transcriptions, call_sessions | Already the project's database layer |
| socket.io | (existing) | Real-time events for transcription delivery and speaker mapping | Already the project's real-time transport |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | (existing or crypto.randomUUID) | Generate batch_id for grouping utterances | Each 60s batch flush |

No new dependencies are required. All libraries are already in the project.

## Architecture Patterns

### Current Architecture (to be refactored)
```
Client (5s chunks) --> presencialAudioChunk event
  --> presencialSessionManager.processAudioChunkAndReturn()
    --> transcribeWithDeepgram() (per-chunk, diarize:true but speaker discarded)
    --> saveTranscriptionIncrementally() (JSON array in single transcriptions_med row)
    --> emit presencialTranscription (with known speaker from mic assignment)
```

### Target Architecture (hybrid)
```
Client (5s chunks) --> presencialAudioChunk event
  |
  |--> [IMMEDIATE PATH] transcribeWithDeepgram() WITHOUT diarization
  |    --> emit presencialTranscription (speaker='unknown')
  |    --> save to transcriptions_med (speaker='unknown', no batch_id)
  |
  |--> [ACCUMULATOR] buffer chunk in Map<sessionId, AudioBuffer[]>
       --> After 60s timer fires:
           --> Concatenate buffered chunks
           --> transcribeWithDeepgram() WITH utterances:true + diarize:true
           --> Parse utterances: extract speaker, speaker_confidence, transcript, timing
           --> Apply confidence threshold (0.7)
           --> Replace unattributed transcriptions with diarized ones
           --> Save per-utterance to transcriptions_med (with batch_id, speaker_id, diarization_confidence)
           --> Update transcriptions.raw_text with [SPEAKER_0] prefixes
           --> emit presencialDiarizedBatch to room
```

### Recommended File Structure Changes
```
apps/backend/realtime-service/src/
  services/
    presencialSessionManager.ts  # REFACTOR: add batch accumulator, timer, diarized processing
  websocket/
    presencial.ts                # ADD: mapSpeakers event handler, modify presencialAudioChunk
  types/
    transcription.ts             # ADD: DiarizedUtterance, SpeakerMapping, BatchResult interfaces
```

### Pattern: Audio Buffer Accumulator (Claude's Discretion -- recommended approach)

Use a dedicated `Map` alongside the session `Map`:

```typescript
interface AudioAccumulator {
  chunks: Buffer[];
  timer: NodeJS.Timeout | null;
  batchNumber: number;
  startTime: Date;
  totalDurationMs: number; // track accumulated duration from chunk count * 5000ms
}

// In presencialSessionManager:
private accumulators = new Map<string, AudioAccumulator>();
```

**Timer recommendation:** Use `setTimeout` chain (not `setInterval`). After each 60s flush completes, set a new timeout. This prevents overlapping batch processing if Deepgram API is slow.

```typescript
private startAccumulator(sessionId: string): void {
  const acc: AudioAccumulator = {
    chunks: [],
    timer: null,
    batchNumber: 0,
    startTime: new Date(),
    totalDurationMs: 0,
  };
  this.accumulators.set(sessionId, acc);
  this.scheduleFlush(sessionId);
}

private scheduleFlush(sessionId: string): void {
  const acc = this.accumulators.get(sessionId);
  if (!acc) return;

  acc.timer = setTimeout(async () => {
    await this.flushBatch(sessionId);
    // Schedule next flush only after current one completes
    if (this.accumulators.has(sessionId)) {
      this.scheduleFlush(sessionId);
    }
  }, 60_000);
}
```

### Pattern: Deepgram Pre-Recorded with Utterances

```typescript
// Add utterances: true to existing transcribeWithDeepgram options
const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
  concatenatedBuffer,
  {
    model: 'nova-2',
    language: 'pt-BR',
    smart_format: true,
    punctuate: true,
    numerals: true,
    diarize: true,
    utterances: true,  // NEW: returns structured utterances with speaker attribution
    keywords: [/* existing medical keywords */],
  }
);

// Extract utterances (NEW path)
const utterances = result?.results?.utterances || [];
for (const utt of utterances) {
  const speakerId = `speaker_${utt.speaker}`;  // 0 -> 'speaker_0', 1 -> 'speaker_1'

  // Get speaker_confidence from word-level data (utterance-level confidence is transcription confidence)
  const avgSpeakerConfidence = utt.words.reduce(
    (sum, w) => sum + ((w as any).speaker_confidence || 0), 0
  ) / (utt.words.length || 1);

  const threshold = parseFloat(process.env.DIARIZATION_CONFIDENCE_THRESHOLD || '0.7');
  const isConfident = avgSpeakerConfidence >= threshold;

  // Store utterance
  await saveUtterance({
    session_id: callSessionId,
    speaker: isConfident ? 'unknown' : 'unknown',  // stays 'unknown' until mapSpeakers
    speaker_id: isConfident ? speakerId : null,
    text: utt.transcript,
    start_ms: Math.round(utt.start * 1000),
    end_ms: Math.round(utt.end * 1000),
    confidence: utt.confidence,
    diarization_confidence: avgSpeakerConfidence,
    batch_id: batchId,
    needs_review: !isConfident,
  });
}
```

### Pattern: Retroactive Speaker Mapping

```typescript
// Socket.IO handler in presencial.ts
socket.on('mapSpeakers', async (data, callback) => {
  const { sessionId, mapping } = data;
  // mapping: { speaker_0: 'doctor', speaker_1: 'patient' }

  // 1. Batch update transcriptions_med
  for (const [speakerKey, role] of Object.entries(mapping)) {
    await supabase
      .from('transcriptions_med')
      .update({ speaker: role, needs_review: false })
      .eq('session_id', callSessionId)
      .eq('speaker_id', speakerKey);
  }

  // 2. Regenerate transcriptions.raw_text
  const { data: allUtterances } = await supabase
    .from('transcriptions_med')
    .select('*')
    .eq('session_id', callSessionId)
    .order('start_ms', { ascending: true });

  const rawText = allUtterances.map(u => {
    const label = u.speaker === 'doctor' ? 'MEDICO' : u.speaker === 'patient' ? 'PACIENTE' : 'SPEAKER';
    const ts = formatTimestamp(u.start_ms);
    return `[${label}] (${ts}): ${u.text}`;
  }).join('\n');

  await supabase
    .from('transcriptions')
    .update({ raw_text: rawText })
    .eq('consultation_id', consultationId);

  // 3. Store mapping in call_sessions.metadata
  await supabase
    .from('call_sessions')
    .update({ metadata: { ...existingMetadata, speakerMapping: mapping } })
    .eq('room_id', sessionId);

  // 4. Notify room
  io.to(sessionId).emit('speakerMappingUpdated', { sessionId, mapping });
  callback({ success: true });
});
```

### Anti-Patterns to Avoid
- **Modifying existing dual-mic flow:** This phase is single-mic ONLY. The `deepgramService.ts` (streaming) is for dual-mic WebRTC and must NOT be touched.
- **Removing per-chunk immediate transcription:** D-08 requires hybrid approach. Keep immediate feedback path for responsiveness.
- **Using utterance-level `confidence` as speaker confidence:** `utterance.confidence` is transcription accuracy, NOT speaker attribution confidence. Use word-level `speaker_confidence` averaged across the utterance.
- **Assuming speaker IDs are consistent across batches:** speaker_0 in batch 1 might be speaker_1 in batch 2. The retroactive mapping (DIAR-06) handles this -- doctor maps speakers once after hearing them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio concatenation | Custom audio format parser | `Buffer.concat()` on raw WebM chunks | Deepgram handles format detection; concatenated WebM chunks work as-is |
| Speaker diarization | Custom speaker separation | Deepgram `diarize: true` + `utterances: true` | Validated in Phase 1 spike; nova-2 handles pt-BR |
| UUID generation | Custom ID generator | `crypto.randomUUID()` (Node 19+) or `uuid` package | For batch_id generation |
| Timer management | Custom scheduler | `setTimeout` chain pattern | Simple, prevents overlap, easy to clear on session end |

## Common Pitfalls

### Pitfall 1: JSON Array vs Per-Utterance Storage Mismatch
**What goes wrong:** Current `addTranscriptionToSession()` stores ALL transcriptions as a JSON array in a SINGLE `transcriptions_med` row (the `text` field contains `[{speaker, text}, ...]`). The diarization design (D-12 through D-17) expects per-utterance rows with individual `speaker_id`, `diarization_confidence`, `batch_id`, `needs_review` columns.
**Why it happens:** The current storage pattern was designed for real-time streaming where a single accumulating document made sense. Diarization needs per-utterance queryability for retroactive mapping.
**How to avoid:** Create a NEW storage function for diarized utterances that inserts individual rows. Keep the existing `addTranscriptionToSession()` for the immediate (unattributed) feedback path. When diarized batch arrives, either: (a) delete the unattributed entries and insert diarized ones, or (b) mark unattributed entries as superseded.
**Warning signs:** If retroactive `mapSpeakers` UPDATE queries don't match any rows, the storage pattern is wrong.

### Pitfall 2: WebM Chunk Concatenation May Not Work
**What goes wrong:** Concatenating 12 separate 5s WebM files into one buffer and sending to Deepgram. WebM has a header structure -- naive concatenation creates an invalid file.
**Why it happens:** Each 5s chunk from the browser is a complete WebM file with its own header.
**How to avoid:** The spike already validated this works with Deepgram -- Deepgram's pre-recorded API is robust to this. BUT verify the spike used the same audio format the client sends. If issues arise, the fallback is to send chunks as separate API calls and merge results (but this defeats diarization). Alternative: use PCM/WAV format which IS concatenation-safe.
**Warning signs:** Deepgram returns errors or truncated transcription from concatenated buffer.

### Pitfall 3: Speaker CHECK Constraint on transcriptions_med
**What goes wrong:** The database has `CONSTRAINT utterances_speaker_check CHECK (((speaker)::text = ANY ((ARRAY['doctor', 'patient', 'system'])::text[])))`. Inserting `speaker='unknown'` will fail with a constraint violation.
**Why it happens:** The schema was designed for dual-mic mode where speaker is always known.
**How to avoid:** Add 'unknown' to the CHECK constraint in the migration: `ALTER TABLE transcriptions_med DROP CONSTRAINT utterances_speaker_check; ALTER TABLE transcriptions_med ADD CONSTRAINT utterances_speaker_check CHECK (speaker IN ('doctor', 'patient', 'system', 'unknown'));`
**Warning signs:** INSERT errors with "new row violates check constraint" when trying to save unattributed transcriptions.

### Pitfall 4: speaker_confidence Not on Utterance Object
**What goes wrong:** Code tries to access `utterance.speaker_confidence` -- this field does not exist on the utterance level.
**Why it happens:** Deepgram provides `speaker_confidence` only at the **word level**, not the utterance level. The utterance's `confidence` field is transcription accuracy, not speaker attribution confidence.
**How to avoid:** Average `word.speaker_confidence` across all words in the utterance to compute utterance-level diarization confidence.
**Warning signs:** `diarization_confidence` is always 0 or undefined in the database.

### Pitfall 5: Timer Not Cleaned Up on Session End
**What goes wrong:** Session ends but the 60s timer is still running. Timer fires after session cleanup, tries to flush to a deleted session.
**Why it happens:** `endSession()` doesn't clear the accumulator timer.
**How to avoid:** In `endSession()`: (1) clear the timer via `clearTimeout`, (2) flush remaining buffer immediately, (3) delete the accumulator entry.
**Warning signs:** "Session not found" errors appearing ~60s after a session ends.

### Pitfall 6: Inconsistent Speaker IDs Across Batches
**What goes wrong:** Deepgram assigns speaker_0 to the doctor in batch 1 but speaker_0 to the patient in batch 2. The retroactive mapping then incorrectly labels all speaker_0 entries as "doctor."
**Why it happens:** Deepgram's speaker IDs are arbitrary per API call. There is no cross-call speaker consistency.
**How to avoid:** This is a known limitation acknowledged in CONTEXT.md. The speaker mapping via DIAR-06 is session-level, not batch-level. The doctor must listen and identify which speaker_id corresponds to which role. For MVP, accept this limitation. For future improvement (v2), consider voice fingerprinting across batches.
**Warning signs:** Speaker labels flip between batches in the transcription view.

## Code Examples

### Deepgram Pre-Recorded Response Structure (from official docs)

```typescript
// result.results.utterances[] when utterances: true + diarize: true
interface DeepgramUtterance {
  start: number;           // seconds (e.g., 0.41874)
  end: number;             // seconds (e.g., 5.42518)
  confidence: number;      // transcription confidence (e.g., 0.88211584)
  channel: number;         // always 0 for single-channel
  transcript: string;      // full utterance text
  speaker: number;         // 0 or 1 (from diarization)
  id: string;              // UUID
  words: DeepgramWord[];
}

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;         // transcription confidence
  speaker: number;            // 0 or 1
  speaker_confidence: number; // 0.0 to 1.0 -- THIS is what we need for threshold
  punctuated_word: string;
}
```

### Database Migration SQL

```sql
-- Add new columns for diarization support
ALTER TABLE public.transcriptions_med
  ADD COLUMN IF NOT EXISTS diarization_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS batch_id varchar(255),
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Relax speaker constraint to allow 'unknown'
ALTER TABLE public.transcriptions_med DROP CONSTRAINT IF EXISTS utterances_speaker_check;
ALTER TABLE public.transcriptions_med ADD CONSTRAINT utterances_speaker_check
  CHECK (speaker IN ('doctor', 'patient', 'system', 'unknown'));

-- Index for retroactive speaker mapping queries
CREATE INDEX IF NOT EXISTS idx_transcriptions_med_session_speaker_id
  ON public.transcriptions_med(session_id, speaker_id);

-- Index for batch grouping
CREATE INDEX IF NOT EXISTS idx_transcriptions_med_batch_id
  ON public.transcriptions_med(batch_id);
```

### Buffer Concatenation for Batch Processing

```typescript
private async flushBatch(sessionId: string): Promise<void> {
  const acc = this.accumulators.get(sessionId);
  if (!acc || acc.chunks.length === 0) return;

  const batchId = `batch-${sessionId}-${acc.batchNumber++}`;
  const chunksToProcess = [...acc.chunks];
  acc.chunks = []; // Clear immediately for next accumulation window

  // Concatenate all chunks into single buffer
  const concatenated = Buffer.concat(chunksToProcess);

  console.log(`[DIARIZATION] Flushing batch ${batchId}: ${chunksToProcess.length} chunks, ${concatenated.length} bytes`);

  try {
    const { result, error } = await this.deepgramClient.listen.prerecorded.transcribeFile(
      concatenated,
      {
        model: 'nova-2',
        language: 'pt-BR',
        smart_format: true,
        punctuate: true,
        numerals: true,
        diarize: true,
        utterances: true,
        keywords: [/* existing medical keywords */],
      }
    );

    if (error) throw new Error(`Deepgram error: ${JSON.stringify(error)}`);

    const utterances = result?.results?.utterances || [];
    await this.processDiarizedUtterances(sessionId, batchId, utterances);
  } catch (err) {
    console.error(`[DIARIZATION] Batch ${batchId} failed:`, err);
    // Don't lose audio -- could re-queue or log for manual recovery
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-chunk Deepgram with speaker from mic ID | Batch 60s with diarization | Phase 2 (this) | Speaker attribution no longer requires 2 mics |
| JSON array in single transcriptions_med row | Per-utterance rows with batch_id | Phase 2 (this) | Enables retroactive mapping queries |
| Speaker always known at capture time | Speaker assigned post-processing or via mapping | Phase 2 (this) | Introduces 'unknown' speaker state |

## Open Questions

1. **WebM concatenation reliability**
   - What we know: Phase 1 spike validated 60s chunks work with Deepgram
   - What's unclear: Whether the spike concatenated WebM chunks or used pre-split audio files. If client sends complete WebM files per chunk, concatenation creates invalid WebM.
   - Recommendation: Test early in implementation. If concatenation fails, consider: (a) accumulating raw PCM instead of WebM, or (b) using ffmpeg to merge WebM files before sending.

2. **Transition from JSON-array storage to per-utterance rows**
   - What we know: Current code uses a single `transcriptions_med` row with JSON array in `text` field per session. New design needs per-utterance rows.
   - What's unclear: Whether existing queries/reports depend on the single-row JSON pattern.
   - Recommendation: For the immediate (unattributed) path during accumulation, continue using the existing JSON-array pattern. For diarized batches, use new per-utterance rows. This minimizes changes to existing code paths.

3. **How the immediate path and diarized path coexist in transcriptions_med**
   - What we know: D-08 says immediate unattributed, then replace with diarized.
   - What's unclear: Exact replacement mechanism -- delete and re-insert? Or mark old rows as superseded?
   - Recommendation: Use the existing JSON-array row for immediate feedback (no schema change needed). When diarized batch arrives, insert new per-utterance rows with batch_id. The JSON-array row stays as a "draft" and the per-utterance rows are the "final." Frontend (Phase 3) can display per-utterance rows when available, falling back to JSON-array.

## Sources

### Primary (HIGH confidence)
- Deepgram SDK v3.13.0 TypeScript types -- `SyncPrerecordedResponse.d.ts` verified Utterance interface and WordBase with speaker_confidence
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- response structure with utterances array
- [Deepgram Diarization Docs](https://developers.deepgram.com/docs/diarization) -- word-level speaker_confidence field
- Project source: `presencialSessionManager.ts` -- current transcription pipeline
- Project source: `presencial.ts` -- current Socket.IO event handlers
- Project source: `database.ts` -- current addTranscriptionToSession (JSON-array pattern)
- Project source: `schema_prod.sql` -- transcriptions_med table schema with constraints

### Secondary (MEDIUM confidence)
- [Deepgram Timestamps/Utterances/Diarization Guide](https://deepgram.com/learn/working-with-timestamps-utterances-and-speaker-diarization-in-deepgram) -- practical usage patterns
- Phase 1 spike `README.md` -- 60s minimum chunk validation, CONDITIONAL GO decision

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new deps needed
- Architecture: HIGH -- existing code thoroughly analyzed, Deepgram API structure verified from SDK types and docs
- Pitfalls: HIGH -- identified from actual schema constraints, existing storage patterns, and API response structure analysis
- Storage migration: MEDIUM -- JSON-array to per-utterance transition needs careful handling, open question on coexistence

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- Deepgram SDK and project architecture unlikely to change)
