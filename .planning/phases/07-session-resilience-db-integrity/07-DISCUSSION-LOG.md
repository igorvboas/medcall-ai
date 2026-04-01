# Phase 7: Session Resilience & DB Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 07-session-resilience-db-integrity
**Mode:** Auto (--auto flag, all defaults selected by Claude)
**Areas discussed:** Disconnect timeout, Reconnection protocol, Atomic finalization RPC, NOT NULL migration

---

## Disconnect Timeout Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed timeout (5min all) | Same timeout for host and participant | |
| Smart timeout by role | 5min host, 3min participant (matches existing pattern) | ✓ |
| No timeout (immediate cleanup) | Delete room on disconnect | |

**Selection:** [auto] Smart timeout by role — recommended. Aligns with existing `resetRoomExpiration` logic which already differentiates by occupancy count.

---

## Reconnection Protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing joinRoom handler | Client calls joinRoom again, backend restores mapping | ✓ |
| New dedicated reconnect event | Create separate Socket.IO event for reconnection | |
| Automatic server-side rejoin | Server re-adds socket on reconnect detection | |

**Selection:** [auto] Reuse existing joinRoom — recommended. Frontend already has reconnection state machine in useConnectionState.ts. Backend joinRoom handler already handles re-joining existing rooms. Minimal new code.

---

## Atomic Finalization RPC

| Option | Description | Selected |
|--------|-------------|----------|
| Single RPC for critical writes only | Transaction covers transcription + status + call_sessions | ✓ |
| Full RPC including webhook tracking | Transaction also covers webhook_deliveries insert | |
| Keep sequential writes, add manual rollback | No RPC, add compensating actions on failure | |

**Selection:** [auto] Single RPC for critical writes only — recommended. Webhook tracking is fire-and-forget (Phase 6 D-06) and has its own retry logic. Including it in the transaction would make webhook failures roll back the finalization, which contradicts D-06.

---

## NOT NULL Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Delete NULL rows + add constraint | Clean up orphans, then enforce NOT NULL | ✓ |
| Set default value + add constraint | Update NULLs to a sentinel UUID, then enforce | |
| Add constraint with CHECK only | Use CHECK constraint instead of NOT NULL | |

**Selection:** [auto] Delete NULL rows + add constraint — recommended. Transcription rows without consultation_id are unusable (no way to associate them with a consultation). UNIQUE constraint from Phase 5 already prevents duplicates.

---

## Claude's Discretion

All four areas were auto-resolved using recommended defaults per --auto flag. User has consistently deferred technical decisions to Claude in Phases 5 and 6.

## Deferred Ideas

- OBSV-02: Orphaned session alerts/monitoring — v2+ scope
- Frontend reconnection UI improvements — backend-only phase
