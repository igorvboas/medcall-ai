# Auton Health — Plataforma de Consulta Médica

## What This Is

Plataforma de saúde que permite consultas presenciais e online com transcrição automática via Deepgram. O sistema captura áudio da consulta, transcreve em tempo real, identifica quem está falando (médico ou paciente), e envia dados processados via webhook para pipeline de análise AI que gera prontuário estruturado.

## Core Value

Nenhum dado de consulta médica pode ser perdido — transcrição, gravação e prontuário devem ser resilientes a falhas de rede, crashes e race conditions.

## Current Milestone: v2.0 Robustez da Consulta Online

**Goal:** Garantir que consultas online nunca percam dados — transcrição salva incrementalmente durante a consulta, consolidada na finalização, e webhook disparado corretamente para o N8N.

**Target features (prioridade máxima):**
- Garantir que `transcription.raw_text` seja salvo durante a consulta (incremental)
- Garantir que `consultation.transcricao` seja salvo na finalização
- Garantir que o webhook seja disparado para N8N com payload correto, usando URL baseada em `NODE_ENV`

**Target features (robustez geral):**
- Persistência de transcrição incremental (não apenas em memória)
- Webhook outbox pattern com retry e tracking de entregas
- Guards de finalização (idempotência, mutex, status transitions)
- Limpeza de sessões órfãs em disconnect
- Reconexão WebSocket com rejoin automático de sala
- Proteção contra tab crash (beforeunload + persistência local)
- Detecção de mic desconectado/silencioso
- Integridade do banco (migrations faltantes, transações, constraints)
- Operações atômicas de transcrição (eliminar race condition read-modify-write)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Consulta presencial com 2 microfones — v0 (implementação atual)
- ✓ Transcrição Deepgram com nova-2 pt-BR — v0
- ✓ VAD client-side filtrando silêncio — v0
- ✓ Consulta remota com WebRTC + streaming Deepgram — v0
- ✓ Keywords médicos para boost de reconhecimento — v0
- ✓ Webhook de notificação ao finalizar consulta — v0
- ✓ Backend: Acumulação de chunks 60s+ para diarização confiável — Phase 2
- ✓ Backend: Extração de speaker + confidence dos utterances Deepgram — Phase 2
- ✓ Backend: Confidence threshold (0.7) para auto-assign vs "incerto" — Phase 2
- ✓ Backend: Mapeamento retroativo de speaker via Socket.IO — Phase 2

### Active

<!-- Current scope. Building toward these. -->

- [x] Transcrição incremental salva em `transcription.raw_text` durante a consulta — Validated in Phase 5
- [x] Transcrição consolidada salva em `consultation.transcricao` na finalização — Validated in Phase 5
- [x] Webhook disparado para N8N com payload correto e URL baseada em NODE_ENV — Validated in Phase 5
- [x] Operação atômica no save de transcrição (eliminar race condition read-modify-write) — Validated in Phase 5
- [ ] Webhook outbox pattern com retry e tracking de entregas
- [ ] Guards de finalização (idempotência, mutex, status transitions)
- [ ] Limpeza de sessões órfãs em disconnect WebSocket
- [ ] Reconexão WebSocket com rejoin automático de sala
- [ ] Proteção contra tab crash (beforeunload + persistência local)
- [ ] Detecção de mic desconectado/silencioso
- [ ] Migrations faltantes (transcriptions_med, recordings)
- [ ] Transações na finalização (atomicidade multi-table writes)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Troca de modelo para Nova-3 — testar separadamente depois, Nova-2 já funciona bem com pt-BR
- Diarização automática sem mapeamento manual — precisão insuficiente para atribuição automática de roles
- Suporte a 3+ speakers no mesmo microfone — foco em consulta 1:1
- Alterações na consulta remota — fluxo diferente, não impactado

## Context

- Revisão sistemática (REVISAO_SISTEMATICA_CONSULTAS.md) identificou 14 falhas críticas, 19 altas, 18 médias
- Transcrição atualmente salva em 3 locais: `transcriptions_med.text` (JSON), `transcriptions.raw_text`, `consultations.transcricao`
- `transcriptions_med` usa read-modify-write de JSON sem lock — race condition com falas simultâneas (FIXED: Phase 5 atomic RPC)
- `consultations.transcricao` agora lido do DB na finalização — crash antes disso ainda preserva raw_text (FIXED: Phase 5)
- Webhook centralizado em `webhookConfig.ts` com URLs por NODE_ENV (FIXED: Phase 5)
- Webhook sem retry — falha silenciosa perde pipeline de análise AI (anamnese, diagnóstico)
- Room deletada da memória mesmo quando DB write falha — perda irreversível
- Finalização pode ser disparada por HTTP e WebSocket simultaneamente — sem mutex
- Sessões órfãs ficam em RECORDING para sempre quando WebSocket desconecta
- NODE_ENV configurado em: gateway (.env:82), realtime-service (.env:87), frontend (.env:2)
- Webhook auth via env var WEBHOOK_AUTH_HEADER

## Constraints

- **Compatibilidade**: Não quebrar fluxo de consulta presencial (mic único/dual) nem remota
- **Banco**: Supabase (PostgreSQL) — JS client não suporta transactions, usar RPCs para atomicidade
- **Ambiente**: NODE_ENV = homolog|production|localhost — URLs de webhook dependem disso
- **Downtime**: Zero downtime — correções devem ser retrocompatíveis com consultas em andamento

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
*Last updated: 2026-03-31 after Phase 5 completion*
