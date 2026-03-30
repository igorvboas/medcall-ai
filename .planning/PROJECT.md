# Auton Health — Consulta Presencial com Microfone Único

## What This Is

Plataforma de saúde que permite consultas presenciais e remotas com transcrição automática via Deepgram. O sistema captura áudio da consulta, transcreve em tempo real, e identifica quem está falando (médico ou paciente) para gerar prontuário estruturado.

## Core Value

Médico consegue realizar consulta presencial com transcrição automática usando apenas 1 microfone, com identificação correta de quem está falando.

## Current Milestone: v1.0 Consulta Presencial com Microfone Único

**Goal:** Eliminar a necessidade de 2 microfones na consulta presencial, usando diarização do Deepgram para identificar médico vs paciente com apenas 1 microfone.

**Target features:**
- Spike de validação com áudio real antes de implementar
- UI simplificada com seleção de 1 microfone + toggle dual/single mode
- Mapeamento de speaker (speaker_0/speaker_1 → médico/paciente) via UI
- Backend: acumulação de chunks 30s+ para diarização confiável
- Backend: extração de speaker + confidence dos utterances Deepgram
- Backward compatibility com modo dual-mic existente

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Consulta presencial com 2 microfones — v0 (implementação atual)
- ✓ Transcrição Deepgram com nova-2 pt-BR — v0
- ✓ VAD client-side filtrando silêncio — v0
- ✓ Consulta remota com WebRTC + streaming Deepgram — v0
- ✓ Keywords médicos para boost de reconhecimento — v0
- ✓ Webhook de notificação ao finalizar consulta — v0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Frontend: Seleção de microfone único (remover dual mic)
- [ ] Frontend: Mapeamento manual speaker → role na UI
- [ ] Frontend: Indicador visual de speaker ativo em tempo real
- [ ] Backend: Conexão Deepgram única recebendo áudio misto
- [ ] Backend: Extração do campo `speaker` dos words do Deepgram
- [ ] Backend: Mapeamento speaker_id → role (médico/paciente)
- [ ] Backend: Acumulação de chunks 30s+ para diarização confiável
- [ ] Backend: Confidence threshold para auto-assign vs manual
- [ ] Backend: Mapeamento retroativo de speaker
- [ ] Frontend: Toggle entre modo single-mic e dual-mic

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Troca de modelo para Nova-3 — testar separadamente depois, Nova-2 já funciona bem com pt-BR
- Diarização automática sem mapeamento manual — precisão insuficiente para atribuição automática de roles
- Suporte a 3+ speakers no mesmo microfone — foco em consulta 1:1
- Alterações na consulta remota — fluxo diferente, não impactado

## Context

- Sistema atual usa `usePresencialAudioCapture.ts` com dual MediaRecorder (1 por mic)
- `DualMicrophoneControl.tsx` permite seleção de dispositivos separados para médico e paciente
- Backend `presencialSessionManager.ts` processa chunks de 5s via Deepgram pre-recorded API
- `deepgramService.ts` já tem `diarize: true` mas o campo `speaker` nos words é descartado
- Deepgram retorna `speaker: 0`, `speaker: 1` nos words — precisa mapear para roles
- Cold start: primeiros 20-30s tudo atribuído a speaker_0 (limitação conhecida do Deepgram)
- Frontend envia chunks via Socket.IO evento `presencialAudioChunk` com campo `speaker: 'doctor'|'patient'`
- Chunks passam por VAD (threshold 0.08 RMS, min 1.5s speech, 30% speech ratio)

## Constraints

- **API**: Deepgram pre-recorded API (chunks acumulados 60s+) — não streaming para presencial
- **Língua**: pt-BR — diarização é language-agnostic, transcrição precisa de pt-BR
- **Modelo**: Nova-2 — manter modelo atual, não migrar para Nova-3 neste milestone
- **Compatibilidade**: Manter fluxo de consulta remota e dual-mic intactos
- **Nota**: `endpointing` e `utterance_end_ms` são params de streaming API — não se aplicam à pre-recorded API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Usar diarização Deepgram ao invés de 2 mics | Simplifica setup, UX melhor para médico | ✓ Good — CONDITIONAL GO validado em Phase 1 |
| Mapeamento manual de speaker (não automático) | Cold start + precisão insuficiente para auto-atribuição | — Pending |
| Chunks mínimos de 60s (não 30s) para diarização | Spike mostrou: 5s=falha, 30s=parcial, 60s=confiável | ✓ Good — validado empiricamente |
| Manter backward compat com dual-mic | Médico escolhe modo na UI, sem risco de regressão | — Pending |
| endpointing/utterance_end_ms removidos do escopo | São params de streaming API, não se aplicam a pre-recorded | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after milestone v1.0 initialization*
