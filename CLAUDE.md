<!-- GSD:project-start source:PROJECT.md -->
## Project

**Auton Health — Plataforma de Consulta Médica**

Plataforma de saúde que permite consultas presenciais e online com transcrição automática via Deepgram. O sistema captura áudio da consulta, transcreve em tempo real, identifica quem está falando (médico ou paciente), e envia dados processados via webhook para pipeline de análise AI que gera prontuário estruturado.

**Core Value:** Nenhum dado de consulta médica pode ser perdido — transcrição, gravação e prontuário devem ser resilientes a falhas de rede, crashes e race conditions.

### Constraints

- **Compatibilidade**: Não quebrar fluxo de consulta presencial (mic único/dual) nem remota
- **Banco**: Supabase (PostgreSQL) — JS client não suporta transactions, usar RPCs para atomicidade
- **Ambiente**: NODE_ENV = homolog|production|localhost — URLs de webhook dependem disso
- **Downtime**: Zero downtime — correções devem ser retrocompatíveis com consultas em andamento
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Summary
## What Already Exists (No Changes Needed)
| Technology | Current Version | Status |
|------------|----------------|--------|
| `@deepgram/sdk` | `^3.13.0` | Sufficient -- diarize + utterances supported since v3.x |
| Web Audio API (VAD) | Browser native | Works unchanged for single stream |
| MediaRecorder API | Browser native | Simplifies to 1 recorder instead of 2 |
| Socket.IO | `^4.8.1` | No changes needed to transport layer |
| `audioUtils.ts` (VoiceActivityDetector) | Custom | Reusable as-is for single stream |
## Recommended Stack Changes
### Backend: Deepgram Configuration Changes
| Change | Current | New | Why |
|--------|---------|-----|-----|
| `utterances` param | Not set | `utterances: true` | Groups words into speaker-attributed utterances, eliminating manual word-by-word speaker grouping |
| `endpointing` | `300` (streaming) / not set (pre-recorded) | `800` (pre-recorded chunks context) | Longer endpointing gives diarization more context per chunk for better speaker separation |
| `utterance_end_ms` | `1000` (streaming) | `2000` (if using streaming path) | More buffer for diarization to settle speaker assignment |
| Response parsing | Ignores `speaker` field in words | Extract `speaker` + `speaker_confidence` from words array | Core feature -- map speaker_0/speaker_1 to doctor/patient |
| Chunk size | 5s | Consider 8-10s | Longer chunks give diarization significantly more context; 5s is minimal for speaker separation |
### Backend: No SDK Upgrade Needed
- `diarize: true` on pre-recorded API (returns `speaker: number` and `speaker_confidence: number` per word)
- `utterances: true` on pre-recorded API (returns utterance objects with speaker attribution)
- `smart_format: true`, `punctuate: true`, `numerals: true` (already configured)
- `keywords` boosting (already configured)
### Frontend: Simplification (Remove, Don't Add)
| Action | Component | Detail |
|--------|-----------|--------|
| **Remove** | `DualMicrophoneControl.tsx` | Replace with `SingleMicrophoneControl.tsx` -- simpler, one device selector |
| **Refactor** | `usePresencialAudioCapture.ts` | Remove dual MediaRecorder/VAD/stream logic. Single MediaStream, single MediaRecorder, single VAD |
| **Add** | Speaker mapping UI | Simple toggle: "Quem esta falando agora?" or initial calibration step. No new library needed -- plain React state |
| **Add** | Active speaker indicator | Use existing `VoiceActivityDetector.getAudioLevel()` with color coding per mapped speaker. No new library |
| **Keep** | `audioUtils.ts` | `VoiceActivityDetector`, `blobToBase64`, `getBestAudioMimeType` all reusable unchanged |
### No New Frontend Libraries Needed
## Deepgram Pre-Recorded API Response Format (with diarize + utterances)
## Speaker Mapping Strategy (No Library Needed)
## Alternatives Considered
| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Keep `@deepgram/sdk@^3.13.0` | Upgrade to v4.x | Breaking changes, unnecessary risk for zero benefit in this milestone |
| Pre-recorded API (chunks) | Switch to streaming API | Streaming diarization has worse cold start (20-30s all speaker_0). Pre-recorded handles shorter segments better. Architecture already works. |
| `utterances: true` param | Manual word-grouping by speaker | Deepgram already groups by speaker with utterances -- no need to re-implement |
| 8-10s chunk size | Keep 5s chunks | 5s is minimal for diarization context. Longer chunks improve speaker separation accuracy significantly. Trade-off: slightly higher latency for transcription display. |
| Manual speaker mapping | Automatic speaker detection | Cold start makes first 20-30s unreliable. Medical context requires certainty about who said what. Manual mapping is safer. |
| `nova-2` model | `nova-2-medical` or `nova-2-phonecall` | `nova-2` is already validated for pt-BR. Medical/phonecall variants may help diarization but need separate testing. Flag for post-milestone evaluation. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `wavesurfer.js` or audio visualization libraries | Over-engineered for showing which speaker is active. Adds bundle size for a CSS progress bar job. | Existing `VoiceActivityDetector.getAudioLevel()` + CSS |
| `@ricky0123/vad-web` or similar ML-based VAD | The current RMS-based VAD works well enough for chunk filtering. ML VAD adds complexity and bundle size. | Keep existing `VoiceActivityDetector` class |
| Deepgram streaming API for presencial | Streaming diarization has 20-30s cold start where all speech goes to speaker_0. Pre-recorded API handles this better per-chunk. | Keep pre-recorded API with chunk approach |
| `@deepgram/sdk@^4.x` or `@^5.x` | Major version upgrades with breaking changes. Zero benefit for this feature. | Stay on `^3.13.0` |
| Client-side speaker diarization (e.g., `pyannote` via WASM) | Massive complexity, poor browser performance, pt-BR support unknown | Server-side Deepgram diarization |
| Nova-3 model | Explicitly out of scope per PROJECT.md. Nova-2 works for pt-BR. | `nova-2` |
## Configuration Changes Summary
### Backend `presencialSessionManager.ts` -- Deepgram call changes
### Frontend `usePresencialAudioCapture.ts` -- Simplification
### Socket.IO Event Changes
## Version Compatibility
| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@deepgram/sdk@^3.13.0` | 3.x latest | `diarize: true`, `utterances: true` | All features available |
| `socket.io@^4.8.1` | 4.x | `socket.io-client@^4.8.1` | No changes needed |
| `next@^14.2.0` | 14.x | React 18, Web Audio API | No changes needed |
| MediaRecorder API | Browser native | Chrome 49+, Firefox 25+, Safari 14.1+ | Already validated in current app |
| Web Audio API (AnalyserNode) | Browser native | All modern browsers | Already validated |
## Installation
# No new packages needed!
# The existing stack supports everything required.
# If you want to verify current Deepgram SDK version:
## Sources
- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization) -- Response format with speaker + speaker_confidence fields (HIGH confidence)
- [Deepgram Utterances Docs](https://developers.deepgram.com/docs/utterances) -- Utterances combined with diarization for speaker-grouped segments (HIGH confidence)
- [Deepgram Multichannel vs Diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization) -- Confirms diarization is correct choice for single-mic (HIGH confidence)
- [Deepgram Discussion #773 - Diarization Delay](https://github.com/orgs/deepgram/discussions/773) -- Cold start issue: streaming has 20-30s delay, pre-recorded API works better (HIGH confidence)
- [Deepgram Discussion #108 - Diarize streaming always speaker 0](https://github.com/orgs/deepgram/discussions/108) -- Confirms streaming diarization limitation (MEDIUM confidence)
- [@deepgram/sdk npm](https://www.npmjs.com/package/@deepgram/sdk) -- Latest is v4.11.3, v3.x still supported (HIGH confidence)
- Codebase analysis: `deepgramService.ts`, `presencialSessionManager.ts`, `usePresencialAudioCapture.ts`, `audioUtils.ts` -- Direct code inspection (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
