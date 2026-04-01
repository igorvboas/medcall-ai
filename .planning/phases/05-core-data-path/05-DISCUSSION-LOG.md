# Phase 5: Core Data Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 05-core-data-path
**Areas discussed:** Incremental save frequency, Race condition fix, Webhook centralization, Consolidation format

---

## Incremental Save Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| Every segment (~5s) | Persist each speech segment immediately, minimizes data loss window | ✓ |
| Batched (~30s) | Accumulate segments and persist periodically, fewer DB writes | |

**User's choice:** Deferred to Claude — "o que for necessario para implementar o que precisa ser implementado"
**Notes:** Claude selected every-segment save (~5s) to align with core value "nenhum dado pode ser perdido". The marginal DB load increase is acceptable given the criticality of not losing transcription data.

---

## Race Condition Fix

| Option | Description | Selected |
|--------|-------------|----------|
| SQL atomic append | `raw_text = raw_text \|\| new_text` via PostgreSQL RPC | ✓ |
| Application-level lock | Mutex/semaphore around read-modify-write | |
| Queue-based serialization | Process appends through a serial queue | |

**User's choice:** Deferred to Claude
**Notes:** Claude selected PostgreSQL RPC with atomic upsert. Simplest approach, eliminates the race at the database level. Application-level locks don't work across multiple server instances.

---

## Webhook URL Centralization

| Option | Description | Selected |
|--------|-------------|----------|
| Backend config file | New `webhookConfig.ts` with NODE_ENV-based URL map | ✓ |
| Environment variables | Full URLs in env vars per environment | |
| Shared constants package | Monorepo shared package for frontend + backend | |

**User's choice:** Deferred to Claude
**Notes:** Claude selected backend config file. Environment variables would require 4+ new vars. Shared package is over-engineered for this use case. A single file with a URL map is the simplest centralization.

---

## Consolidation Format

| Option | Description | Selected |
|--------|-------------|----------|
| Direct copy | Copy `transcriptions.raw_text` as-is to `consultations.transcricao` | ✓ |
| Reformatted | Strip timestamps, reformat speaker labels | |
| Structured JSON | Store as JSON array instead of text | |

**User's choice:** Deferred to Claude
**Notes:** Claude selected direct copy. The `[SPEAKER] (HH:mm:ss): text` format is already human-readable. No transformation needed — simpler code, fewer bugs.

---

## Claude's Discretion

All four areas were deferred to Claude's judgment. User expressed trust in Claude to make the technical decisions needed for the mapped corrections.

## Deferred Ideas

None — all discussion stayed within Phase 5 scope.
