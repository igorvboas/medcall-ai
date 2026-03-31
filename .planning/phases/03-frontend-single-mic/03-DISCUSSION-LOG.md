# Phase 3: Frontend Single-Mic - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 03-frontend-single-mic
**Areas discussed:** Mode toggle & mic selection, Speaker mapping panel, Active speaker indicator, Transcription update flow

---

## Gray Areas Selection

**User's choice:** "tudo que precisa ser visto para o meu projeto, voce é o especialista e entende todo contexto do projeto para tomar a melhor decisao" — User delegated all decisions to Claude as domain specialist for all 4 areas.

---

## Mode Toggle & Mic Selection

**Decision:** Toggle switch above mic selector, single dropdown in single-mic mode, localStorage persistence.

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Replace DualMicrophoneControl entirely | Simpler | Breaks backward compat | |
| Toggle above existing component | Preserves dual-mic, clean UX | Slightly more code | ✓ |
| Tab-based switcher | Visual clarity | More UI real estate | |

---

## Speaker Mapping Panel

**Decision:** Auto-popup after first diarized batch, compact card below transcription, "Remapear" in status bar.

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Always-visible sidebar panel | Persistent access | Wastes space | |
| Auto-popup after first batch | Natural timing, non-intrusive | 60s delay | ✓ |
| Modal dialog | Forced attention | Blocks workflow | |

---

## Active Speaker Indicator

**Decision:** Single AudioLevelIndicator + speaker status badge in recording bar.

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Dual waveform (split by speaker) | Visual separation | Requires real-time speaker data | |
| Single level + status badge | Simple, uses existing component | Less visual | ✓ |
| Colored border pulse on transcription | Intuitive | Hard to notice | |

---

## Transcription Update Flow

**Decision:** Gray UNKNOWN during accumulation, smooth replace on diarized batch, in-place label update on mapping.

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Wait for diarized batch (no preview) | Clean output | 60s of nothing | |
| Gray UNKNOWN + batch replace | Immediate feedback + accuracy | Needs transition logic | ✓ |
| Show raw text without any speaker | Simplest | Confusing when speakers change | |

---

## Claude's Discretion

- CSS animation details for transitions
- Toggle switch component choice
- Error handling for mic permissions
- Loading state during accumulation

## Deferred Ideas

None — all discussion stayed within phase scope.
