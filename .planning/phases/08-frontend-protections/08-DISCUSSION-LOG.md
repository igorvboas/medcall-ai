# Phase 8: Frontend Protections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 08-frontend-protections
**Areas discussed:** All areas delegated to Claude ("todas as etapas necessarias para o comprimento da fase 8")

---

## Mic Disconnect Alert

| Option | Description | Selected |
|--------|-------------|----------|
| Non-dismissible red banner | Stays visible until mic reconnects | x |
| Toast notification | Auto-hides after seconds | |
| Modal dialog | Blocks UI until acknowledged | |

**Selection:** Non-dismissible red banner — least intrusive while ensuring the doctor sees it. Auto-hiding toasts could be missed during a busy consultation. Modals are too disruptive.

---

## Silence Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse VoiceActivityDetector | Use existing getAudioLevel() with 30s threshold | x |
| New ML-based VAD | More accurate but adds bundle size | |
| No silence detection | Only detect disconnect | |

**Selection:** Reuse existing VoiceActivityDetector — already in the codebase, RMS-based detection is sufficient for "is the mic capturing anything?" check.

---

## Tab Close Protection

| Option | Description | Selected |
|--------|-------------|----------|
| Native beforeunload + flush | Browser dialog + save pending data | x |
| Custom modal | React modal with save button | |
| No protection (rely on incremental save) | Phase 5 saves every ~5s, minimal loss | |

**Selection:** Native beforeunload + flush — most reliable, browser guarantees the dialog. Custom modals can't prevent navigation. Phase 5 incremental save reduces data loss risk but beforeunload adds defense-in-depth.

---

## Claude's Discretion

All areas delegated to Claude. User consistently defers technical decisions across all phases (5, 6, 7, 8).

## Deferred Ideas

- PLOC-01: IndexedDB local audio persistence
- Audio waveform visualization
- Automatic mic switching
