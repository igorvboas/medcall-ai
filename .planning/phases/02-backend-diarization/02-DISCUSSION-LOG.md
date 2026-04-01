# Phase 2: Backend Diarization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 02-backend-diarization
**Areas discussed:** Chunk accumulation strategy, Transcription delivery timing, Confidence threshold behavior, Retroactive mapping mechanics

---

## Gray Areas Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Chunk accumulation strategy | How to buffer 5s client chunks into 60s+ batches | |
| Transcription delivery timing | Immediate vs delayed feedback during accumulation | |
| Confidence threshold behavior | Auto-assign threshold and handling of uncertain utterances | |
| Retroactive mapping mechanics | DB update strategy when doctor maps speakers | |

**User's choice:** "a melhor opcao para o meu projeto. voce como especialista deve buscar o que precisar" — User delegated all decisions to Claude as domain specialist.

---

## Chunk Accumulation Strategy

**Decision:** Timer-based 60s window with in-memory buffer.

| Option | Pros | Cons |
|--------|------|------|
| Timer-based (60s) | Simple, predictable, matches spike results | Fixed latency regardless of speech activity |
| Size-based (N bytes) | Adapts to speech density | Unpredictable timing, may not reach 60s of audio |
| Hybrid (timer + minimum size) | Best of both | More complex implementation |

**Selected:** Timer-based (60s) — simplicity wins, validated in Phase 1.

---

## Transcription Delivery Timing

**Decision:** Hybrid approach — immediate unattributed text + deferred diarized replacement.

| Option | Pros | Cons |
|--------|------|------|
| Wait for batch | Clean output, no replacements | 60s of silence in UI |
| Immediate unattributed + batch replace | Real-time feedback, eventual accuracy | More complex, needs replacement logic |
| Parallel streams | Best UX | Most complex implementation |

**Selected:** Immediate unattributed + batch replace — best UX vs complexity tradeoff.

---

## Confidence Threshold Behavior

**Decision:** 0.7 threshold, configurable via env var.

| Option | Pros | Cons |
|--------|------|------|
| Fixed 0.5 | More utterances auto-assigned | Higher error rate |
| Fixed 0.7 | Good balance | Some correct utterances flagged |
| Fixed 0.9 | Very accurate auto-assign | Too many "incerto" flags |
| Configurable (default 0.7) | Tunable per deployment | Slightly more setup |

**Selected:** Configurable with 0.7 default — allows tuning without code changes.

---

## Retroactive Mapping Mechanics

**Decision:** Batch DB update + Socket.IO broadcast + metadata persistence.

| Option | Pros | Cons |
|--------|------|------|
| DB update only | Simple | Frontend stale until refresh |
| DB update + Socket.IO event | Real-time frontend update | More events to handle |
| DB update + Socket.IO + raw_text regeneration | Complete consistency | Most work, but necessary |

**Selected:** Full approach (DB + Socket.IO + raw_text regen) — data consistency across all storage.

---

## Claude's Discretion

- Internal buffer data structure (Map vs class)
- Error handling for Deepgram failures
- Logging and debugging strategy
- Timer implementation details

## Deferred Ideas

None — all discussion stayed within phase scope.
