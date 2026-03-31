# Roadmap: Auton Health

## Milestones

- 🚧 **v1.0 Consulta Presencial com Microfone Unico** - Phases 1-4 (in progress)
- 📋 **v2.0 Robustez da Consulta Online** - Phases 5-8 (planned)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>🚧 v1.0 Consulta Presencial com Microfone Unico (Phases 1-4)</summary>

- [ ] **Phase 1: Validation Spike** - Go/no-go decision on nova-2 diarization quality for pt-BR medical consultations
- [ ] **Phase 2: Backend Diarization** - Server accumulates chunks, calls Deepgram with utterances, extracts and stores speaker-attributed transcriptions
- [ ] **Phase 3: Frontend Single-Mic** - Doctor can capture audio from one microphone and map speakers to roles via UI
- [ ] **Phase 4: Integration & Compatibility** - End-to-end single-mic flow works, dual-mic mode preserved, webhook output correct

</details>

### v2.0 Robustez da Consulta Online (Phases 5-8)

- [ ] **Phase 5: Core Data Path** - Transcription saved incrementally during consultation, consolidated at finalization, webhook fired correctly
- [ ] **Phase 6: Webhook Reliability & Finalization Guards** - Webhook delivery tracked with retry, finalization protected against duplicates and data loss
- [ ] **Phase 7: Session Resilience & DB Integrity** - Orphan sessions cleaned, WebSocket reconnection works, database operations are atomic
- [ ] **Phase 8: Frontend Protections** - Doctor alerted on mic issues, transcription survives tab crash

## Phase Details

<details>
<summary>🚧 v1.0 Phases (1-4) — Details</summary>

### Phase 1: Validation Spike
**Goal**: Team has quantified evidence that nova-2 diarization produces acceptable speaker attribution for pt-BR medical consultations, enabling a confident go/no-go decision
**Depends on**: Nothing (first phase)
**Requirements**: VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. A real consultation audio recording has been processed through Deepgram pre-recorded API with diarize+utterances enabled at multiple chunk sizes (5s, 30s, 60s)
  2. Accuracy metrics (% of utterances with correct speaker) are computed and documented for each chunk size
  3. A go/no-go decision is recorded with clear acceptance threshold (recommend >85% accuracy)
  4. If go: optimal chunk accumulation size is identified; if no-go: fallback strategy is documented
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Spike scripts + accuracy analysis + go/no-go decision

### Phase 2: Backend Diarization
**Goal**: Server produces correctly diarized, speaker-attributed transcriptions from accumulated audio chunks using Deepgram pre-recorded API
**Depends on**: Phase 1 (go decision required)
**Requirements**: DIAR-01, DIAR-02, DIAR-03, DIAR-04, DIAR-05, DIAR-06
**Success Criteria** (what must be TRUE):
  1. Server accumulates 5s client chunks into 30s+ batches before sending to Deepgram
  2. Deepgram responses include utterances with speaker IDs and confidence scores, and these are correctly parsed
  3. Transcriptions are stored in the database with speaker_id attribution (speaker_0, speaker_1)
  4. When a speaker mapping is provided (e.g., speaker_0 = medico), all existing transcriptions for that session are retroactively updated
  5. Utterances with confidence below threshold are marked as "incerto" rather than auto-assigned
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — DB migration, diarization types, and storage functions
- [x] 02-02-PLAN.md — Batch accumulator and diarized processing in presencialSessionManager
- [x] 02-03-PLAN.md — Retroactive speaker mapping Socket.IO handler

### Phase 3: Frontend Single-Mic
**Goal**: Doctor can conduct a presencial consultation using a single microphone, see speaker-labeled transcriptions, and assign speaker roles
**Depends on**: Phase 2 (needs backend producing diarized data)
**Requirements**: FMIC-01, FMIC-02, FMIC-03, FMIC-04, FMIC-05
**Success Criteria** (what must be TRUE):
  1. Doctor can select one microphone and start a presencial consultation in single-mic mode
  2. Doctor can toggle between single-mic and dual-mic mode before starting a consultation
  3. Doctor can assign speaker_0 and speaker_1 to "Medico" or "Paciente" via a mapping panel
  4. UI shows a visual indicator of which speaker is currently active during the consultation
  5. Transcriptions are displayed grouped by speaker with correct labels (Medico/Paciente)
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Single-mic capture hook, mode toggle, and single mic selector components
- [x] 03-02-PLAN.md — Speaker mapping panel and extended transcription display with three-state lifecycle
- [ ] 03-03-PLAN.md — Page.tsx integration: wiring all components, Socket.IO events, and active speaker indicator

### Phase 4: Integration & Compatibility
**Goal**: Complete single-mic consultation flow works end-to-end and dual-mic mode has zero regressions
**Depends on**: Phase 2, Phase 3
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. A full consultation can be completed using single-mic mode: audio capture, chunk accumulation, diarization, speaker mapping, and final transcription with correct speaker attribution
  2. A full consultation can be completed using dual-mic mode with no behavioral changes from the existing flow
  3. Webhook fired at consultation end includes transcription with correct speaker attribution for both modes
  4. Transcription data saved to the database is compatible with both single-mic and dual-mic modes (same schema, different source)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

</details>

### Phase 5: Core Data Path
**Goal**: Transcription data persists incrementally during the consultation and is consolidated at finalization, with webhook correctly notifying N8N
**Depends on**: Phase 4
**Requirements**: TRNS-01, TRNS-02, TRNS-03, TRNS-04, WBHK-01, WBHK-02
**Success Criteria** (what must be TRUE):
  1. During an active consultation, `transcriptions.raw_text` is updated incrementally (every new speech segment persists to DB within seconds, not only at session end)
  2. When the doctor finalizes a consultation, `consultations.transcricao` contains the complete consolidated transcription text
  3. The transcription save operation uses an atomic append (SQL concat or RPC) instead of read-modify-write, eliminating race conditions when concurrent speech segments arrive
  4. All transcription reads and writes use the `transcriptions` table as the single source of truth (not `transcriptions_med`)
  5. Upon finalization, a webhook fires to the correct N8N URL (determined by NODE_ENV) with the complete payload (consultationId, doctorId, patientId, transcription, env)
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — PostgreSQL RPC for atomic append, database.ts refactor, webhook config module
- [ ] 05-02-PLAN.md — Finalization DB-read consolidation and webhook centralization across all 3 dispatch points

### Phase 6: Webhook Reliability & Finalization Guards
**Goal**: Webhook delivery is tracked and retried on failure, and the finalization process is protected against duplicate invocations, status regressions, and premature memory cleanup
**Depends on**: Phase 5
**Requirements**: WBHK-03, WBHK-04, FINL-01, FINL-02, FINL-03, FINL-04
**Success Criteria** (what must be TRUE):
  1. Every webhook dispatch is recorded in a `webhook_deliveries` table with status, response code, and timestamp (outbox pattern)
  2. A failed webhook is automatically retried with exponential backoff (at least 3 attempts) without manual intervention
  3. If two finalization requests arrive simultaneously (HTTP + WebSocket), only one executes; the second returns idempotently without error
  4. A consultation that is already COMPLETED cannot regress to PROCESSING or RECORDING status
  5. If a database write fails during finalization, the in-memory room data is preserved (not deleted), allowing retry
**Plans**: TBD

### Phase 7: Session Resilience & DB Integrity
**Goal**: Sessions survive WebSocket disconnections gracefully, and database writes during finalization are atomic across multiple tables
**Depends on**: Phase 5 (needs core save path working), Phase 6 (needs finalization guards)
**Requirements**: SESS-01, SESS-02, DBAS-01, DBAS-02
**Success Criteria** (what must be TRUE):
  1. When a WebSocket disconnects during an active consultation, the session transitions to a "disconnected" state with a configurable timeout (not immediately deleted), and is cleaned up only after the timeout expires without reconnection
  2. When a WebSocket reconnects within the timeout window, the client automatically rejoins the room and transcription continues without data loss
  3. The finalization process writes to `transcriptions`, `consultations`, and `webhook_deliveries` atomically via a PostgreSQL RPC (all succeed or all roll back)
  4. The `transcriptions.consultation_id` column has a NOT NULL constraint enforced at the database level
**Plans**: TBD

### Phase 8: Frontend Protections
**Goal**: The doctor is alerted when microphone issues occur during recording, and transcription data is not lost on accidental tab closure
**Depends on**: Phase 5 (needs incremental save working to make beforeunload less critical but still valuable)
**Requirements**: AUDM-01, AUDM-02, SESS-03
**Success Criteria** (what must be TRUE):
  1. If the microphone is physically disconnected during an active consultation, the doctor sees an immediate visual alert indicating the mic was lost
  2. If the microphone captures prolonged silence (configurable threshold, e.g., 30+ seconds), the doctor sees a visual alert suggesting to check the mic
  3. If the doctor attempts to close or navigate away from the tab during an active recording, a browser confirmation dialog warns them and triggers a flush of any unsaved transcription data
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Validation Spike | v1.0 | 1/1 | Complete | - |
| 2. Backend Diarization | v1.0 | 3/3 | Complete | - |
| 3. Frontend Single-Mic | v1.0 | 2/3 | In progress | - |
| 4. Integration & Compatibility | v1.0 | 0/TBD | Not started | - |
| 5. Core Data Path | v2.0 | 0/2 | Not started | - |
| 6. Webhook Reliability & Finalization Guards | v2.0 | 0/TBD | Not started | - |
| 7. Session Resilience & DB Integrity | v2.0 | 0/TBD | Not started | - |
| 8. Frontend Protections | v2.0 | 0/TBD | Not started | - |
