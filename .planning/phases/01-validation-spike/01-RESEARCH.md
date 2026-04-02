# Phase 1: Validation Spike - Research

**Researched:** 2026-03-30
**Domain:** Deepgram nova-2 diarization quality validation for pt-BR medical consultations
**Confidence:** HIGH

## Summary

This phase is a **pure investigation spike** -- no production code changes, no deployments. The goal is to write a standalone Node.js script that sends real consultation audio to Deepgram's pre-recorded API with `diarize: true` + `utterances: true` at multiple chunk sizes (5s, 30s, 60s), then computes accuracy metrics to produce a go/no-go decision on whether nova-2 diarization is viable for pt-BR medical consultations.

The existing codebase already uses `@deepgram/sdk ^3.13.0` with `diarize: true` on the pre-recorded API, but completely discards the `speaker` field from the response. The spike script can reuse the same SDK and API key. The critical unknowns are: (1) whether nova-2 produces usable speaker separation for pt-BR at all (the specialized `nova-2-meeting` model does NOT support pt-BR), and (2) what minimum chunk size produces acceptable diarization accuracy (5s chunks are almost certainly too short for speaker clustering).

**Primary recommendation:** Create a standalone `spike/` directory with a Node.js script that processes one or more real audio recordings at multiple chunk sizes, outputs per-utterance speaker attribution with accuracy metrics, and records a go/no-go decision with the optimal chunk size.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VAL-01 | Medico pode executar spike de validacao com audio real de consulta para medir acuracia da diarizacao nova-2 + pt-BR | Deepgram pre-recorded API with `diarize: true` + `utterances: true` returns speaker-attributed utterances; script processes audio at multiple chunk sizes |
| VAL-02 | Sistema reporta metricas de acuracia (% de utterances com speaker correto) para decisao go/no-go | Script computes % correct speaker attribution per chunk size against manual ground truth, outputs comparison table and recommendation |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@deepgram/sdk` | `^3.13.0` | Pre-recorded transcription with diarization | Already in project; v3.x supports `diarize` + `utterances` on pre-recorded API |
| Node.js | `>=18.0.0` | Script runtime | Already required by project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs/path` (built-in) | N/A | Read audio files from disk | Loading test audio recordings |
| `dotenv` | `^17.2.2` | Load DEEPGRAM_API_KEY from .env | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js spike script | Python script with requests | Node matches production stack; no reason to introduce Python |
| Manual accuracy counting | Automated accuracy script | Manual is acceptable for 1-3 test recordings; automate only if needed |

**Installation:**
```bash
# No new packages needed -- spike script uses existing @deepgram/sdk
# Just ensure the realtime-service dependencies are installed
cd apps/backend/realtime-service && npm install
```

**Version verification:** `@deepgram/sdk` latest on npm is `5.0.0` (major version change). Project uses `^3.13.0` which is correct -- do NOT upgrade for this spike.

## Architecture Patterns

### Recommended Spike Structure
```
spike/
  validation-diarization/
    README.md               # Instructions, results, go/no-go decision
    run-spike.ts            # Main script: loads audio, sends to Deepgram, outputs metrics
    analyze-results.ts      # (optional) Separate analysis if needed
    audio/                  # Test audio files (gitignored)
    results/                # Output JSON with per-chunk-size metrics
      results-5s.json
      results-30s.json
      results-60s.json
      results-full.json
    ground-truth.json       # Manual annotation: which utterances belong to doctor vs patient
```

### Pattern 1: Chunked Audio Processing
**What:** Split a full consultation audio file into chunks of varying sizes (5s, 30s, 60s), send each chunk independently to Deepgram pre-recorded API with `diarize: true` + `utterances: true`, collect speaker attribution results.
**When to use:** This is the core of the spike -- testing how chunk size affects diarization quality.
**Example:**
```typescript
// Source: Deepgram Utterances docs + existing presencialSessionManager.ts pattern
import { createClient } from '@deepgram/sdk';
import fs from 'fs';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

async function transcribeChunk(audioBuffer: Buffer): Promise<{
  utterances: Array<{
    speaker: number;
    transcript: string;
    confidence: number;
    start: number;
    end: number;
    words: Array<{ word: string; speaker: number; speaker_confidence: number }>;
  }>;
}> {
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-2',
      language: 'pt-BR',
      smart_format: true,
      punctuate: true,
      diarize: true,
      utterances: true,
    }
  );

  if (error) throw new Error(`Deepgram error: ${JSON.stringify(error)}`);

  return {
    utterances: result.results?.utterances || [],
  };
}
```

### Pattern 2: Full-File vs Chunked Comparison
**What:** Process the SAME audio file both as a single complete file AND as chunks of various sizes. The full-file result serves as the "best possible" baseline.
**When to use:** Always -- this comparison reveals how much accuracy degrades with smaller chunks.
**Example:**
```typescript
const CHUNK_SIZES_SECONDS = [5, 30, 60];

async function runComparison(audioPath: string) {
  const fullAudio = fs.readFileSync(audioPath);

  // Baseline: full file
  const fullResult = await transcribeChunk(fullAudio);

  // Chunked: split and process independently
  for (const chunkSize of CHUNK_SIZES_SECONDS) {
    const chunks = splitAudioIntoChunks(fullAudio, chunkSize);
    const chunkResults = [];
    for (const chunk of chunks) {
      chunkResults.push(await transcribeChunk(chunk));
    }
    // Compare chunkResults speaker attribution against fullResult
  }
}
```

### Pattern 3: Ground Truth Comparison
**What:** Create a manual annotation file listing who actually spoke each segment (doctor or patient), then compare Deepgram's speaker attribution against this ground truth.
**When to use:** For computing the accuracy metric (% of utterances with correct speaker).
**Example:**
```json
// ground-truth.json
{
  "audioFile": "consulta-2026-03-28.webm",
  "segments": [
    { "start": 0.0, "end": 15.2, "speaker": "doctor", "text_snippet": "Bom dia, como voce esta..." },
    { "start": 15.3, "end": 22.1, "speaker": "patient", "text_snippet": "Estou bem, doutor..." }
  ]
}
```

### Anti-Patterns to Avoid
- **Hardcoding speaker_0 = doctor:** Deepgram assigns speaker IDs based on clustering, not order of appearance. speaker_0 could be the patient.
- **Testing with clean/studio audio only:** Real consultation audio has background noise, overlapping speech, AC hum. Use real recordings.
- **Skipping the full-file baseline:** Without the full-file result, there is no way to know if poor chunked results are due to chunk size vs. inherent model limitation.
- **Testing with only 1 recording:** Diarization quality varies by audio conditions. Test with at least 2-3 distinct recordings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio chunking | Custom PCM splitter | `ffmpeg` CLI to split audio files | ffmpeg handles format detection, sample-accurate splitting, header regeneration |
| Speaker grouping from words | Manual word-by-word grouping | `utterances: true` parameter | Deepgram returns pre-grouped utterances with speaker attribution |
| Audio format conversion | Custom encoder | `ffmpeg` for converting to WAV/WebM | Deepgram accepts multiple formats but WAV is most reliable for testing |

**Key insight:** The spike script should be as simple as possible -- its purpose is to MEASURE, not to BUILD. Use ffmpeg for audio manipulation and let Deepgram do the heavy lifting.

## Common Pitfalls

### Pitfall 1: Audio Format Issues with Pre-Recorded API
**What goes wrong:** Sending WebM chunks that were split at arbitrary byte boundaries rather than proper audio frame boundaries, causing Deepgram to reject or misparse the audio.
**Why it happens:** Naive byte-level splitting of compressed audio (WebM/Opus) produces invalid containers. Each chunk must be a valid, standalone audio file.
**How to avoid:** Use `ffmpeg` to split audio: `ffmpeg -i input.webm -ss START -t DURATION -c copy output_chunk.webm`. This produces valid WebM files for each chunk. Alternatively, convert to WAV first (PCM) where byte-level splitting is valid.
**Warning signs:** Deepgram returns empty transcripts, errors about invalid audio, or `duration: 0`.

### Pitfall 2: Speaker IDs Are Arbitrary Per API Call
**What goes wrong:** Assuming speaker_0 in chunk #1 is the same person as speaker_0 in chunk #2. Each pre-recorded API call assigns speaker IDs independently.
**Why it happens:** Pre-recorded API has no session state between calls. Speaker clustering is done within each audio file separately.
**How to avoid:** For the spike, this IS the thing being measured. Document per-chunk speaker ID consistency. For the accuracy metric, map speaker IDs per chunk based on which speaker has the most words matching the ground truth.
**Warning signs:** Speaker assignments flip between consecutive chunks.

### Pitfall 3: 5-Second Chunks Too Short for Diarization
**What goes wrong:** 5-second chunks contain only one speaker or insufficient audio for the clustering algorithm. All utterances attributed to speaker_0.
**Why it happens:** Deepgram's diarization needs multiple speakers within the same audio file to distinguish them. 5 seconds often captures only one person speaking.
**How to avoid:** This is expected behavior -- the spike is specifically testing this. The 5s test confirms WHY larger chunks are needed.
**Warning signs:** All chunks return only `speaker: 0` with no `speaker: 1`.

### Pitfall 4: No Real Consultation Audio Available
**What goes wrong:** The spike cannot run because there are no real pt-BR medical consultation recordings to test with.
**Why it happens:** Privacy concerns, no recording infrastructure in place, recordings exist but are not accessible.
**How to avoid:** Identify audio source BEFORE writing the script. Options: (a) Record a mock consultation between two people speaking Portuguese, (b) Use an existing consultation recording if available, (c) As a last resort, use a pt-BR two-speaker podcast as proxy.
**Warning signs:** Spike is "ready" but blocked on audio input.

### Pitfall 5: Ignoring speaker_confidence in Results
**What goes wrong:** Reporting only binary correct/incorrect without analyzing confidence scores. A "correct" attribution with 0.3 confidence is not the same as one with 0.95 confidence.
**Why it happens:** Focusing only on the headline accuracy number.
**How to avoid:** Include speaker_confidence distribution in results. Report: (a) % correct overall, (b) % correct where confidence > 0.7, (c) average confidence per chunk size.
**Warning signs:** High accuracy percentage but low average confidence suggests fragile results.

## Code Examples

### Deepgram Pre-Recorded API Call with Diarize + Utterances
```typescript
// Source: Deepgram official docs (https://developers.deepgram.com/docs/utterances)
// Verified: utterance response includes speaker field when diarize=true

const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
  audioBuffer,
  {
    model: 'nova-2',
    language: 'pt-BR',
    smart_format: true,
    punctuate: true,
    diarize: true,
    utterances: true,
  }
);

// Access utterances (pre-grouped by speaker)
const utterances = result.results?.utterances || [];
// Each utterance: { speaker: number, transcript: string, confidence: number,
//                    start: number, end: number, id: string,
//                    words: [{ word, speaker, speaker_confidence, ... }] }

// Access word-level (for granular analysis)
const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];
// Each word: { word: string, speaker: number, speaker_confidence: number,
//              start: number, end: number, confidence: number }
```

### Audio Splitting with ffmpeg
```bash
# Split a full consultation into 30-second chunks
# Creates chunk_000.webm, chunk_001.webm, etc.
ffmpeg -i consulta.webm -f segment -segment_time 30 -c copy chunk_%03d.webm

# Or extract a specific time range
ffmpeg -i consulta.webm -ss 00:00:00 -t 00:00:30 -c copy chunk_0_30s.webm

# Convert to WAV for more reliable processing
ffmpeg -i consulta.webm -ar 16000 -ac 1 consulta.wav
```

### Accuracy Computation
```typescript
interface GroundTruth {
  segments: Array<{ start: number; end: number; speaker: 'doctor' | 'patient' }>;
}

interface UtteranceResult {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
}

function computeAccuracy(
  utterances: UtteranceResult[],
  groundTruth: GroundTruth,
  speakerMapping: Map<number, 'doctor' | 'patient'>
): { correct: number; total: number; accuracy: number } {
  let correct = 0;
  let total = 0;

  for (const utt of utterances) {
    const midpoint = (utt.start + utt.end) / 2;
    const gtSegment = groundTruth.segments.find(
      s => midpoint >= s.start && midpoint <= s.end
    );
    if (!gtSegment) continue;

    total++;
    const mappedSpeaker = speakerMapping.get(utt.speaker);
    if (mappedSpeaker === gtSegment.speaker) {
      correct++;
    }
  }

  return { correct, total, accuracy: total > 0 ? correct / total : 0 };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nova-2-meeting for diarization | nova-2 general (only option for pt-BR) | N/A | nova-2-meeting only supports English; pt-BR must use general model |
| @deepgram/sdk v3.x | @deepgram/sdk v5.0.0 (latest) | 2025 | v5 is latest but v3 is what the project uses; no upgrade needed for spike |
| Manual word grouping | `utterances: true` parameter | Available since early 2024 | Deepgram pre-groups utterances by speaker; eliminates manual word iteration |

**Deprecated/outdated:**
- `@deepgram/sdk` v4.x: Superseded by v5.0.0 on npm. Project uses v3.x which is stable and sufficient.
- `nova-2-meeting`: Only supports English. Not usable for pt-BR.

## Open Questions

1. **Availability of real consultation audio**
   - What we know: The system records 5s WebM chunks during consultations. Full recordings may not be stored.
   - What's unclear: Whether a complete consultation recording exists or can be obtained.
   - Recommendation: If no real recording exists, record a 5-10 minute mock consultation between two Portuguese speakers. One person plays doctor (asks medical questions), the other plays patient (answers). Use a single microphone in a typical clinic room.

2. **ffmpeg availability on development machine**
   - What we know: ffmpeg is needed to split audio files into chunks for testing.
   - What's unclear: Whether ffmpeg is installed on the developer's machine.
   - Recommendation: Check with `ffmpeg -version`. If missing, install via `brew install ffmpeg` (macOS).

3. **Acceptable accuracy threshold**
   - What we know: Research recommends >85% accuracy as go threshold.
   - What's unclear: Whether 85% is acceptable for medical context or if higher is needed.
   - Recommendation: Start with 85% as the baseline. Document results at all levels so the team can make an informed decision.

4. **Nova-3 as fallback**
   - What we know: Nova-3 has a language-agnostic diarization model with 53% accuracy improvement over nova-2. It is explicitly out of scope.
   - What's unclear: Whether Nova-3 supports pt-BR with the same API parameters.
   - Recommendation: If nova-2 fails the spike (<85% accuracy), test Nova-3 as a quick follow-up before abandoning the single-mic approach entirely.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Spike script | Yes | v24.14.0 | -- |
| @deepgram/sdk | Deepgram API calls | Yes | ^3.13.0 (in project) | -- |
| DEEPGRAM_API_KEY | API authentication | Assumed (in .env) | -- | Cannot proceed without it |
| ffmpeg | Audio splitting | Unknown | -- | Install via `brew install ffmpeg`; or use manual audio tools |
| Real consultation audio | Testing material | Unknown | -- | Record mock consultation |

**Missing dependencies with no fallback:**
- DEEPGRAM_API_KEY must be available in environment

**Missing dependencies with fallback:**
- ffmpeg: install with `brew install ffmpeg` if missing
- Real consultation audio: record mock consultation as fallback

## Sources

### Primary (HIGH confidence)
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- Verified utterance response format with speaker field when diarize=true
- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- speaker and speaker_confidence fields per word
- Codebase: `presencialSessionManager.ts` -- Confirmed `diarize: true` already passed, speaker field discarded (lines 100-143)
- Codebase: `deepgramService.ts` -- Confirmed `DeepgramTranscriptionResult.words` does not include speaker field (lines 22-32)

### Secondary (MEDIUM confidence)
- [Deepgram JS SDK v3 Blog](https://deepgram.com/learn/upgraded-the-deepgram-javascript-sdk-v3) -- SDK v3 API structure
- [GitHub Discussion #584](https://github.com/orgs/deepgram/discussions/584) -- nova-2 diarization issues, nova-2-meeting English-only
- [Deepgram Models & Languages](https://developers.deepgram.com/docs/models-languages-overview) -- nova-2-meeting language support

### Tertiary (LOW confidence)
- Community reports of nova-2 returning all speech as speaker_0 -- needs validation with actual pt-BR audio (this is what the spike tests)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; existing @deepgram/sdk v3 verified to support diarize + utterances on pre-recorded API
- Architecture: HIGH -- Spike is a standalone script with well-defined inputs/outputs; minimal complexity
- Pitfalls: HIGH -- Well-documented in project research (PITFALLS.md) and Deepgram community discussions
- Accuracy methodology: MEDIUM -- Ground truth annotation approach is standard but manual; accuracy depends on quality of annotations

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- Deepgram API and SDK are not changing for this version)
