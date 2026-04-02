/**
 * Finalization guard module: mutex Set and status transition logic.
 * Phase 6 (FINL-01, FINL-02): Prevents duplicate finalization and status regression.
 * Shared across HTTP route (routes/rooms.ts), WebSocket handler (websocket/rooms.ts),
 * and presencial handler (websocket/presencial.ts).
 */

// Per D-08: In-memory Set prevents concurrent finalization of the same room/session
const finalizingRooms = new Set<string>();

/**
 * Try to acquire finalization lock for a room/session.
 * Per D-08: If already in the set, return false (already finalizing).
 * Per D-09: Caller MUST call releaseFinalizationLock() in a finally block.
 */
export function tryAcquireFinalizationLock(id: string): boolean {
  if (finalizingRooms.has(id)) return false;
  finalizingRooms.add(id);
  return true;
}

/**
 * Release finalization lock after finalization completes or fails.
 * Per D-09: Remove only after finalization completes (success or unrecoverable failure).
 * Per Pitfall 2: Always call in a finally block to prevent permanent lock.
 */
export function releaseFinalizationLock(id: string): void {
  finalizingRooms.delete(id);
}

/**
 * Status transition order. One-directional per D-13:
 * CREATED -> RECORDING -> PROCESSING -> COMPLETED
 */
const STATUS_ORDER: Record<string, number> = {
  'CREATED': 0,
  'RECORDING': 1,
  'PROCESSING': 2,
  'COMPLETED': 3,
};

/**
 * Check if a status transition is valid (forward-only).
 * Per D-13: Never go backwards. Any attempt to set a lower status is a no-op.
 */
export function canTransitionTo(currentStatus: string, targetStatus: string): boolean {
  const currentRank = STATUS_ORDER[currentStatus] ?? -1;
  const targetRank = STATUS_ORDER[targetStatus] ?? -1;
  return targetRank > currentRank;
}

/**
 * Check if a status is terminal (no further transitions allowed).
 * Per D-11, D-17: If status is COMPLETED, finalization returns idempotently.
 */
export function isTerminalStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'PROCESSING';
}
