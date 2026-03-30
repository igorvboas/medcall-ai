# Roadmap: Auton Health — Consulta Presencial com Microfone Unico

## Overview

This milestone replaces the dual-microphone presencial consultation setup with a single shared microphone, using Deepgram diarization to distinguish doctor from patient. The roadmap starts with a validation spike to confirm nova-2 diarization viability for pt-BR, then builds backend chunk accumulation and speaker extraction, followed by frontend single-mic capture and speaker mapping UI, and finishes with end-to-end integration ensuring backward compatibility with dual-mic mode.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Validation Spike** - Go/no-go decision on nova-2 diarization quality for pt-BR medical consultations
- [ ] **Phase 2: Backend Diarization** - Server accumulates chunks, calls Deepgram with utterances, extracts and stores speaker-attributed transcriptions
- [ ] **Phase 3: Frontend Single-Mic** - Doctor can capture audio from one microphone and map speakers to roles via UI
- [ ] **Phase 4: Integration & Compatibility** - End-to-end single-mic flow works, dual-mic mode preserved, webhook output correct

## Phase Details

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
- [ ] 02-01-PLAN.md — DB migration, diarization types, and storage functions
- [ ] 02-02-PLAN.md — Batch accumulator and diarized processing in presencialSessionManager
- [ ] 02-03-PLAN.md — Retroactive speaker mapping Socket.IO handler

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
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Validation Spike | 0/1 | Planning complete | - |
| 2. Backend Diarization | 0/3 | Planning complete | - |
| 3. Frontend Single-Mic | 0/TBD | Not started | - |
| 4. Integration & Compatibility | 0/TBD | Not started | - |
