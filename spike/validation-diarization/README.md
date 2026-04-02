## Validation Spike: Deepgram nova-2 Diarization for pt-BR

## Purpose

This spike validates whether Deepgram's nova-2 model can produce acceptable speaker diarization (separating doctor vs patient speech) for pt-BR medical consultations captured through a single microphone.

The spike processes real consultation audio at multiple chunk sizes (5s, 30s, 60s, full-file) and computes speaker attribution accuracy against manually annotated ground truth. The result is a quantified go/no-go decision on whether single-mic diarization is viable.

This is the existential risk gate for the single-mic consultation project. If nova-2 diarization does not produce acceptable speaker separation for pt-BR, the project needs a different approach.

## Prerequisites

- **Node.js** >= 18.0.0
- **DEEPGRAM_API_KEY** in `.env` file (see Setup)
- **Real consultation audio** (5-10 min, two speakers, single mic) placed in `audio/` directory
- ffmpeg is handled automatically by `@ffmpeg-installer/ffmpeg` (no system install needed)

## Setup

```bash
# Install dependencies
npm install

# Create .env with your Deepgram API key
# Option A: Copy from existing service
cp ../../apps/backend/realtime-service/.env .env

# Option B: Create manually
echo "DEEPGRAM_API_KEY=your_key_here" > .env
```

## Step 1: Prepare Ground Truth

1. Copy the template:
   ```bash
   cp ground-truth-template.json ground-truth.json
   ```

2. Listen to your audio file carefully

3. Edit `ground-truth.json`:
   - Set `audioFile` to your audio filename
   - Set `totalDurationSeconds` to the audio duration
   - For each segment of continuous speech by one person, add an entry with:
     - `start`: start time in seconds
     - `end`: end time in seconds
     - `speaker`: `"doctor"` or `"patient"`
     - `text_snippet`: first few words (for your reference)
   - Gaps between segments are OK (utterances in gaps will be skipped during analysis)

Example:
```json
{
  "audioFile": "consulta-2026-03-30.webm",
  "totalDurationSeconds": 420,
  "segments": [
    { "start": 0.0, "end": 15.0, "speaker": "doctor", "text_snippet": "Bom dia, como voce esta..." },
    { "start": 15.5, "end": 28.0, "speaker": "patient", "text_snippet": "Estou com dor de cabeca..." },
    { "start": 29.0, "end": 45.0, "speaker": "doctor", "text_snippet": "Ha quanto tempo sente..." }
  ]
}
```

## Step 2: Run Spike

```bash
npm run spike -- --audio audio/YOUR_FILE.webm
```

This will:
- Split the audio into chunks of 5s, 30s, 60s + process the full file
- Send each chunk to Deepgram pre-recorded API with `diarize: true` and `utterances: true`
- Save results to `results/results-5s.json`, `results/results-30s.json`, etc.
- Print a summary table with utterance counts and speaker distribution

## Step 3: Analyze Results

```bash
npm run analyze
```

This will:
- Load results from `results/` and ground truth from `ground-truth.json`
- Compute per-chunk-size accuracy metrics
- Print comparison table and go/no-go recommendation
- Save full analysis to `results/analysis.json`

## Results

| Chunk Size | Total Utterances | Unique Speakers | Distribution | Speaker Detection |
|------------|-----------------|-----------------|--------------|-------------------|
| 5s | 102 | 1 | S0:102 (100%) | FAIL — no diarization |
| 30s | 85 | 2 | S0:56, S1:29 | PARTIAL — 7/12 chunks detect 2 speakers |
| 60s | 74 | 2 | S0:31, S1:43 | PASS — all 6 chunks detect 2 speakers |
| full (342s) | 74 | 2 | S0:48, S1:26 | PASS — best possible result |

**Key observations:**
- 5s chunks: Deepgram cannot diarize with only 5s of context — returns only speaker_0
- 30s chunks: Diarization starts working but inconsistent (chunks 1,2,5,9 still single-speaker)
- 60s chunks: Reliable diarization in all chunks
- Full file: Best diarization, consistent speaker separation throughout

## Decision

**Status:** CONDITIONAL GO

**Date:** 2026-03-30

**Decision:** CONDITIONAL GO — diarization works with chunk sizes >= 60s

**Rationale:** nova-2 with pt-BR successfully identifies 2 distinct speakers when given sufficient audio context (60s+). The 5s chunk approach used in the current dual-mic system is incompatible with diarization — it requires accumulating chunks to at least 60s before sending to Deepgram. 30s is a borderline minimum (works in ~60% of chunks). 60s provides reliable detection in 100% of tested chunks.

**Optimal chunk size (if GO):** 60s minimum recommended. Consider 90s-120s for safety margin. Full-file processing gives best results but introduces latency proportional to consultation duration.

**Impact on architecture:**
- Backend must accumulate 5s client chunks into 60s+ batches before Deepgram API call
- This introduces ~60s latency for first transcription result (acceptable for presencial)
- Alternatively, use hybrid approach: show unattributed text during accumulation, then attribute speakers once 60s batch is processed

## Notes

- `speaker_0` / `speaker_1` are arbitrary per API call. The analysis script handles this by computing per-chunk speaker mapping against ground truth.
- 5s chunks are expected to perform poorly -- most 5s segments contain only one speaker, so diarization has nothing to separate. This confirms why larger chunks are needed.
- Full-file processing is the upper bound for diarization accuracy. If full-file accuracy is below 85%, chunked approaches will not improve it.
- The accuracy threshold is set at 85%. This can be adjusted based on medical context requirements.
- If NO-GO with nova-2, consider testing Nova-3 (which claims 53% improvement in diarization) as a follow-up before abandoning the single-mic approach.
