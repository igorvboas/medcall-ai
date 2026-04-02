# Phase 6: Webhook Reliability & Finalization Guards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 06-webhook-reliability-finalization-guards
**Areas discussed:** Webhook retry strategy, Finalization mutex, Room cleanup on failure, Webhook deliveries table

---

## Webhook Retry Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| In-process setTimeout | Exponential backoff with 3 attempts (5s, 15s, 45s) | ✓ |
| Background job/cron | Separate process polls webhook_deliveries for pending | |
| Queue-based (Bull/BullMQ) | Redis-backed job queue for reliable delivery | |

**User's choice:** Deferred to Claude — "todas as areas necessarias para desenvolver"
**Notes:** In-process setTimeout selected for simplicity. No external dependencies needed. 3 attempts with exponential backoff (5s, 15s, 45s) provides reasonable retry window without complexity.

---

## Finalization Mutex

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory Set | `finalizingRooms: Set<string>` checked at handler entry | ✓ |
| Database advisory lock | PostgreSQL `pg_advisory_lock(roomId)` | |
| Database status check only | Check consultation.status before proceeding | |

**User's choice:** Deferred to Claude
**Notes:** In-memory Set selected. Node.js is single-threaded — the Set check is synchronous and guaranteed atomic in the event loop. Database advisory lock is overkill for single-process deployment.

---

## Room Cleanup on Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Keep alive, cleanup timer | Don't delete on DB failure, set 10min safety timer | ✓ |
| Immediate cleanup with log | Delete anyway, log critical error for manual recovery | |
| Keep alive indefinitely | Never auto-cleanup, require manual intervention | |

**User's choice:** Deferred to Claude
**Notes:** Keep alive with safety timer selected. Balances data preservation (room stays for retry) with memory leak prevention (10min timer ensures cleanup). Aligns with core value "nenhum dado pode ser perdido".

---

## Webhook Deliveries Table

| Option | Description | Selected |
|--------|-------------|----------|
| Full tracking | id, consultation_id, url, payload, status, attempts, response details, timestamps | ✓ |
| Minimal tracking | id, consultation_id, status, created_at only | |
| Log-based only | Use log_erros table, no dedicated table | |

**User's choice:** Deferred to Claude
**Notes:** Full tracking selected. The table serves dual purpose: outbox pattern for retry logic AND audit log for debugging webhook issues. Response body and error message fields enable diagnosis without checking server logs.

---

## Claude's Discretion

All four areas were deferred to Claude's judgment. User expressed trust to make all technical decisions needed for the phase.

## Deferred Ideas

None — all discussion stayed within Phase 6 scope.
