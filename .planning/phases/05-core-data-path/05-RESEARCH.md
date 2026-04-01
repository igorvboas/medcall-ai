# Phase 5: Core Data Path - Research

**Researched:** 2026-03-31
**Domain:** Backend data persistence (Supabase/PostgreSQL), webhook centralization
**Confidence:** HIGH

## Summary

Phase 5 addresses three critical backend problems: (1) transcription data is lost on crash because finalization reads from in-memory state instead of the database, (2) the `appendConsultationTranscription()` function uses a read-modify-write pattern that causes race conditions when concurrent speech segments arrive, and (3) webhook URLs are hardcoded in three separate dispatch points with inconsistent payload structures.

The solution is well-scoped: create a PostgreSQL RPC function for atomic text append (upsert pattern), refactor all three `appendConsultationTranscription` call sites to use it, change finalization to read `transcriptions.raw_text` from the database instead of in-memory arrays, centralize webhook configuration into a single module, and standardize the webhook payload across all dispatch points.

All changes are backend-only, confined to the `apps/backend/realtime-service/src/` directory, and use existing Supabase infrastructure. No new libraries are needed.

**Primary recommendation:** Start with the PostgreSQL RPC function (it unblocks everything else), then refactor the append calls, then fix finalization consolidation, then centralize webhooks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Save to `transcriptions.raw_text` on every speech segment (~5s intervals). Ensure ALL transcription paths (online + presencial) consistently write incrementally.
- **D-02:** Use `transcriptions` table as the single source of truth for raw transcription text. `transcriptions_med` continues for structured conversation data.
- **D-03:** If a `transcriptions` record does not exist for the consultation, create it on first segment. Use `consultation_id` as the lookup key.
- **D-04:** Replace read-modify-write pattern with SQL-level atomic append: `raw_text = COALESCE(raw_text, '') || new_text`.
- **D-05:** Use Supabase `.rpc()` for the atomic append. Create PostgreSQL function `append_transcription_text(p_consultation_id, p_text)`.
- **D-06:** The RPC should handle both INSERT (first segment) and UPDATE (subsequent segments) -- upsert pattern.
- **D-07:** At finalization, read `transcriptions.raw_text` and copy directly to `consultations.transcricao`. No format transformation.
- **D-08:** This replaces building `consultations.transcricao` from in-memory `room.transcriptions` array.
- **D-09:** Create `apps/backend/realtime-service/src/config/webhookConfig.ts` for centralized webhook URLs based on `NODE_ENV`.
- **D-10:** URL map: `{ homolog: '...usi-analise-homolog', production: '...usi-analise-v2', localhost: '...usi-analise-homolog' }`.
- **D-11:** Export `getWebhookUrl(type: 'transcricao' | ...)` and `getWebhookHeaders()`.
- **D-12:** Standardize webhook payload: `{ consultationId, doctorId, patientId, transcription, consulta_finalizada, paciente_entrou_sala, tipo_consulta, env }`.
- **D-13:** The `env` field derives from `NODE_ENV`: 'homolog' | 'production' | 'localhost'.
- **D-14:** The `transcription` field contains full `transcriptions.raw_text` from DB at finalization, not from in-memory state.

### Claude's Discretion
- Internal implementation details of the PostgreSQL RPC function
- Error logging format for failed saves (use existing `logError()` pattern)
- Whether to add an index on `transcriptions.consultation_id` for faster lookups
- Naming conventions for new utility functions

### Deferred Ideas (OUT OF SCOPE)
None -- all decisions are implementation-level clarifications.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRNS-01 | Transcription saved incrementally to `transcriptions.raw_text` during consultation | Atomic RPC upsert replaces read-modify-write; all 3 call sites identified |
| TRNS-02 | Consolidated transcription saved to `consultations.transcricao` at finalization | Finalization reads from DB instead of memory; 3 finalization points identified |
| TRNS-03 | Save operation is atomic (eliminate race condition) | PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` with `COALESCE` concat |
| TRNS-04 | Use `transcriptions` table as single source of truth | Already the target table; `transcriptions_med` untouched |
| WBHK-01 | Webhook fires with correct payload | Standardized payload structure across all 3 dispatch points |
| WBHK-02 | Webhook URL determined by NODE_ENV, centralized | New `webhookConfig.ts` module; all dispatch points import from it |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | existing (project dep) | Database client + RPC calls | Already configured with service role key |
| PostgreSQL (via Supabase) | Supabase-managed | Atomic upsert via RPC function | Only way to get SQL-level atomicity from JS client |

### Supporting
No new libraries needed. All changes use existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL RPC | Supabase Edge Function | Over-engineered for a simple concat; RPC is simpler and lower latency |
| PostgreSQL RPC | Advisory locks + JS update | Still has JS round-trip; RPC eliminates it entirely |
| Centralized config module | Environment variables for each URL | URLs are complex paths, not suitable for env vars; config module is cleaner |

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/realtime-service/src/
  config/
    database.ts          # Existing -- appendConsultationTranscription refactored
    webhookConfig.ts     # NEW -- centralized webhook URL/headers
  services/
    transcriptionService.ts    # Modified -- use RPC for append
    presencialSessionManager.ts # Modified -- use RPC for append, DB read for finalization
  routes/
    rooms.ts             # Modified -- DB read for finalization, centralized webhook
  websocket/
    rooms.ts             # Modified -- DB read for finalization, centralized webhook
```

### Pattern 1: Atomic Text Append via PostgreSQL RPC
**What:** A PostgreSQL function that atomically appends text using `INSERT ... ON CONFLICT DO UPDATE`, called via `supabase.rpc()`.
**When to use:** Every time a new transcription segment arrives (both online and presencial paths).
**Example:**
```sql
-- PostgreSQL function (create via Supabase SQL Editor)
CREATE OR REPLACE FUNCTION append_transcription_text(
  p_consultation_id UUID,
  p_text TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO transcriptions (consultation_id, raw_text, language, model_used, created_at)
  VALUES (p_consultation_id, p_text, 'pt-BR', 'whisper-1-vad', NOW())
  ON CONFLICT (consultation_id)
  DO UPDATE SET
    raw_text = COALESCE(transcriptions.raw_text, '') || E'\n' || EXCLUDED.raw_text,
    updated_at = NOW();
END;
$$;
```

```typescript
// TypeScript call site
const { error } = await supabase.rpc('append_transcription_text', {
  p_consultation_id: consultationId,
  p_text: formattedLine  // e.g., "[MEDICO] (14:23:05): texto aqui"
});
```

### Pattern 2: DB-Read Consolidation at Finalization
**What:** At finalization, read `transcriptions.raw_text` from the database and copy to `consultations.transcricao`, instead of building from in-memory arrays.
**When to use:** All finalization endpoints (HTTP route, WebSocket endRoom, presencial endSession).
**Example:**
```typescript
// Read from DB (crash-safe)
const { data: transcription } = await supabase
  .from('transcriptions')
  .select('raw_text')
  .eq('consultation_id', consultationId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const fullText = transcription?.raw_text || '';

// Copy to consultations.transcricao
await db.updateConsultation(consultationId, {
  transcricao: fullText
});
```

### Pattern 3: Centralized Webhook Configuration
**What:** Single module exporting URL and headers based on `NODE_ENV`.
**When to use:** All webhook dispatch points import from this module instead of inline URL construction.
**Example:**
```typescript
// config/webhookConfig.ts
const WEBHOOK_URLS: Record<string, Record<string, string>> = {
  transcricao: {
    homolog: 'https://triahook.gst.dev.br/webhook/80a69a11-a580-40c2-95da-7eb19f103d59/:usi-analise-homolog',
    production: 'https://triahook.gst.dev.br/webhook/usi-analise-v2',
    localhost: 'https://triahook.gst.dev.br/webhook/80a69a11-a580-40c2-95da-7eb19f103d59/:usi-analise-homolog',
  },
};

export function getWebhookUrl(type: 'transcricao'): string {
  const env = getEnv();
  return WEBHOOK_URLS[type][env];
}

export function getWebhookHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': process.env.WEBHOOK_AUTH_HEADER || '',
  };
}

export function getEnv(): 'homolog' | 'production' | 'localhost' {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'homolog') return 'homolog';
  if (nodeEnv === 'production') return 'production';
  return 'localhost';
}
```

### Anti-Patterns to Avoid
- **Read-modify-write for concurrent data:** The current `appendConsultationTranscription()` reads `raw_text`, concatenates in JS, then writes back. Two concurrent calls can overwrite each other. Always use SQL-level operations for concurrent appends.
- **In-memory state as source of truth:** `room.transcriptions` array is lost on crash. DB is the only reliable source for finalization.
- **Hardcoded URLs inline:** Makes it impossible to audit or change webhook targets without searching the entire codebase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic text append | JS-level read-modify-write | PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` via RPC | Race conditions are impossible to fix in application code without locks |
| Upsert logic | Check-then-insert-or-update | `ON CONFLICT` clause in PostgreSQL | Atomic at DB level; no TOCTOU race |
| Environment detection | Multiple inline `if (isHomolog)` checks | Centralized `getEnv()` utility | DRY, single place to maintain |

**Key insight:** The Supabase JS client intentionally does not support SQL expressions in `.update()` -- this is by design, and `.rpc()` is the official escape hatch for operations that need SQL-level semantics.

## Common Pitfalls

### Pitfall 1: Missing UNIQUE Constraint on transcriptions.consultation_id
**What goes wrong:** The `ON CONFLICT (consultation_id)` clause requires a UNIQUE constraint or index on `consultation_id`. Without it, PostgreSQL will reject the function.
**Why it happens:** The `transcriptions` table may not have this constraint (it was designed for multiple transcription records per consultation).
**How to avoid:** Verify the table schema before creating the RPC. If no UNIQUE constraint exists, add one: `ALTER TABLE transcriptions ADD CONSTRAINT transcriptions_consultation_id_unique UNIQUE (consultation_id);` -- but first verify there are no duplicate `consultation_id` values in existing data.
**Warning signs:** RPC call returns "there is no unique or exclusion constraint matching the ON CONFLICT specification".

### Pitfall 2: Newline Handling in Concatenation
**What goes wrong:** The `E'\n'` separator between appended segments could result in double newlines or missing newlines if `raw_text` is empty.
**Why it happens:** `COALESCE(raw_text, '') || '\n' || new_text` produces a leading `\n` when `raw_text` is empty string.
**How to avoid:** Use `CASE WHEN raw_text IS NULL OR raw_text = '' THEN EXCLUDED.raw_text ELSE raw_text || E'\n' || EXCLUDED.raw_text END` in the UPDATE clause.
**Warning signs:** Transcription text starts with an empty line.

### Pitfall 3: Webhook Payload Inconsistency -- Missing tipo_consulta
**What goes wrong:** The online consultation webhook dispatch in `rooms.ts` and `websocket/rooms.ts` does not include `tipo_consulta`, while `presencialSessionManager.ts` sends `tipo_consulta: 'PRESENCIAL'`. N8N workflows may behave differently.
**How to avoid:** Standardize payload across all dispatch points per D-12. Online consultations should send `tipo_consulta: 'ONLINE'`.
**Warning signs:** N8N webhook handler produces different behavior for presencial vs online.

### Pitfall 4: Multiple Records in transcriptions for Same consultation_id
**What goes wrong:** The current code path in `rooms.ts` line 275 calls `db.saveConsultationTranscription()` which does an INSERT (not upsert), potentially creating a second record. If old records exist, the `ON CONFLICT` upsert would need to handle this.
**How to avoid:** Before adding the UNIQUE constraint, check for and clean up any duplicate records. After the constraint is added, remove the `saveConsultationTranscription()` call from the finalization path (the RPC handles inserts now).
**Warning signs:** `ALTER TABLE` fails with "could not create unique index" due to duplicates.

### Pitfall 5: Three Webhook Dispatch Points, Not Two
**What goes wrong:** The CONTEXT.md mentions "two webhook dispatch points to centralize" in rooms.ts, but there are actually THREE: (1) `routes/rooms.ts` line 340, (2) `websocket/rooms.ts` line 1562, (3) `presencialSessionManager.ts` line 927.
**Why it happens:** The WebSocket endRoom handler was not counted.
**How to avoid:** All three must be updated to use `webhookConfig.ts`. Grep for the webhook URL string to find all instances.
**Warning signs:** One dispatch point still uses hardcoded URLs after the refactor.

### Pitfall 6: Format Mismatch Between Incremental Save and Finalization Webhook
**What goes wrong:** The incremental save formats text as `[MEDICO] (14:23:05): text` but the webhook currently formats as `[doctor]: text` (from in-memory array). After the fix, the webhook reads from DB which uses the `[MEDICO]` format. This changes what N8N receives.
**Why it happens:** Different formatting in `saveTranscriptionIncrementally` vs the webhook builder.
**How to avoid:** This is actually the desired behavior per D-07 and D-14. Verify with the team that N8N can handle the `[MEDICO] (HH:mm:ss): text` format. The format is already human-readable and more informative.
**Warning signs:** N8N parsing breaks on the new format.

## Code Examples

### Current appendConsultationTranscription (race condition)
```typescript
// Source: apps/backend/realtime-service/src/config/database.ts:1027
// PROBLEM: Read-modify-write -- two concurrent calls can lose data
const { data: existing } = await supabase
  .from('transcriptions')
  .select('id, raw_text')
  .eq('consultation_id', consultationId)
  .maybeSingle();

const newText = existing.raw_text
  ? `${existing.raw_text}\n${formattedLine}`
  : formattedLine;

await supabase
  .from('transcriptions')
  .update({ raw_text: newText })
  .eq('id', existing.id);
```

### Fixed: Atomic Append via RPC
```typescript
// Replacement in database.ts
async appendConsultationTranscription(
  consultationId: string,
  textToAppend: string,
  speaker: string,
  timestamp: string
): Promise<boolean> {
  try {
    const formattedLine = `[${speaker}] (${timestamp}): ${textToAppend}`;
    const { error } = await supabase.rpc('append_transcription_text', {
      p_consultation_id: consultationId,
      p_text: formattedLine,
    });
    if (error) {
      console.error('[DB] Error in atomic append:', error);
      logError('Erro no append atomico de transcricao', 'error', consultationId, {
        error: error.message,
        code: error.code,
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[DB] Exception in appendConsultationTranscription:', e);
    return false;
  }
}
```

### Current Finalization (reads from memory -- crash-unsafe)
```typescript
// Source: apps/backend/realtime-service/src/routes/rooms.ts:271-291
// PROBLEM: room.transcriptions is in-memory -- lost on crash
const rawText = room.transcriptions
  .map((t: any) => `[${t.speaker}] (${t.timestamp || ''}): ${t.text}`)
  .join('\n');
await db.updateConsultation(consultationId, { transcricao: rawText });
```

### Fixed: Finalization reads from DB
```typescript
// Read persisted transcription
const { data: txn } = await supabase
  .from('transcriptions')
  .select('raw_text')
  .eq('consultation_id', consultationId)
  .maybeSingle();

const fullText = txn?.raw_text || '';
await db.updateConsultation(consultationId, { transcricao: fullText });
```

### Webhook Dispatch (centralized)
```typescript
import { getWebhookUrl, getWebhookHeaders, getEnv } from '../config/webhookConfig';

// Read transcription from DB (not memory)
const { data: txn } = await supabase
  .from('transcriptions')
  .select('raw_text')
  .eq('consultation_id', consultationId)
  .maybeSingle();

const webhookData = {
  consultationId,
  doctorId: consultation?.doctor_id || null,
  patientId: consultation?.patient_id || 'unknown',
  transcription: txn?.raw_text || '',
  consulta_finalizada: true,
  paciente_entrou_sala: true,
  tipo_consulta: 'ONLINE',  // or 'PRESENCIAL'
  env: getEnv(),
};

const response = await fetch(getWebhookUrl('transcricao'), {
  method: 'POST',
  headers: getWebhookHeaders(),
  body: JSON.stringify(webhookData),
});
```

## Inventory of All Change Points

### appendConsultationTranscription Call Sites (3 total)
| File | Line | Context | Change |
|------|------|---------|--------|
| `presencialSessionManager.ts` | 308 | Batch diarization append | Use refactored function (now calls RPC internally) |
| `presencialSessionManager.ts` | 794 | Incremental save per segment | Use refactored function |
| `transcriptionService.ts` | 703 | Online consultation segment | Use refactored function |

### Finalization / Consolidation Points (3 total)
| File | Line | Context | Change |
|------|------|---------|--------|
| `routes/rooms.ts` | 270-291 | HTTP finalize endpoint | Read `transcriptions.raw_text` from DB instead of `room.transcriptions` |
| `websocket/rooms.ts` | ~1484 | WebSocket endRoom | Read from DB instead of memory |
| `presencialSessionManager.ts` | 962-991 | `saveTranscriptions()` | Read from DB instead of `session.transcriptions` |

### Webhook Dispatch Points (3 total)
| File | Line | Context | Change |
|------|------|---------|--------|
| `routes/rooms.ts` | 317-353 | HTTP finalize webhook | Import from `webhookConfig.ts`, read transcription from DB |
| `websocket/rooms.ts` | 1539-1575 | WebSocket endRoom webhook | Import from `webhookConfig.ts`, read transcription from DB |
| `presencialSessionManager.ts` | 889-950 | Presencial finalization webhook | Import from `webhookConfig.ts`, read transcription from DB |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS read-modify-write | PostgreSQL RPC for atomic ops | Supabase recommendation | Eliminates race conditions without advisory locks |
| In-memory transcription array | Incremental DB persistence | Best practice | Crash-safe data path |

## Open Questions

1. **UNIQUE constraint on transcriptions.consultation_id**
   - What we know: The RPC `ON CONFLICT` clause requires a UNIQUE constraint. The current table may allow multiple records per consultation_id.
   - What is unclear: Whether duplicate consultation_id records exist in production data.
   - Recommendation: Query production data before adding constraint. If duplicates exist, consolidate them first. Add as part of the RPC creation SQL script. **Confidence: MEDIUM** -- need to verify schema.

2. **N8N compatibility with new transcription format**
   - What we know: The format changes from `[doctor]: text` to `[MEDICO] (HH:mm:ss): text` in webhook payload.
   - What is unclear: Whether N8N workflows parse the transcription field or treat it as opaque text.
   - Recommendation: Treat as opaque text (likely, since N8N forwards to AI for analysis). Flag for manual verification.

3. **Index on transcriptions.consultation_id**
   - What we know: Claude's discretion per CONTEXT.md. Lookups by consultation_id happen on every segment (~every 5s per consultation).
   - Recommendation: Add index. The UNIQUE constraint itself creates an index, so if the UNIQUE constraint is added, no separate index is needed.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). All changes use existing Supabase infrastructure and Node.js runtime already in use. The PostgreSQL function is created via Supabase SQL Editor (dashboard), not a local tool.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `database.ts`, `transcriptionService.ts`, `presencialSessionManager.ts`, `routes/rooms.ts`, `websocket/rooms.ts` -- direct code inspection of all change points
- Frontend `webhook-config.ts` -- reference for URL consistency
- [Supabase RPC Documentation](https://supabase.com/docs/reference/javascript/rpc) -- JavaScript client `.rpc()` API

### Secondary (MEDIUM confidence)
- PostgreSQL `INSERT ... ON CONFLICT` documentation -- standard SQL pattern, well-established
- [Supabase Creating API Routes](https://supabase.com/docs/guides/api/creating-routes) -- PostgreSQL function creation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, using existing Supabase client
- Architecture: HIGH -- all change points identified by direct code inspection, patterns are straightforward
- Pitfalls: HIGH -- race condition is clearly visible in code, UNIQUE constraint requirement is a known PostgreSQL behavior

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no fast-moving dependencies)
