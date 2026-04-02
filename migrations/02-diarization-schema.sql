-- Migration: Add diarization support columns to transcriptions_med
-- Phase 02-01: Schema foundation for speaker diarization
-- Decisions: D-12, D-13, D-14, D-17

-- Add new columns for diarization support
ALTER TABLE public.transcriptions_med
  ADD COLUMN IF NOT EXISTS diarization_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS batch_id varchar(255),
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Per D-12: Relax speaker constraint to allow 'unknown' (for unattributed transcriptions)
ALTER TABLE public.transcriptions_med DROP CONSTRAINT IF EXISTS utterances_speaker_check;
ALTER TABLE public.transcriptions_med ADD CONSTRAINT utterances_speaker_check
  CHECK (speaker IN ('doctor', 'patient', 'system', 'unknown'));

-- Add diarization_confidence check constraint (0.0 to 1.0)
ALTER TABLE public.transcriptions_med ADD CONSTRAINT diarization_confidence_check
  CHECK (diarization_confidence IS NULL OR (diarization_confidence >= 0 AND diarization_confidence <= 1));

-- Index for retroactive speaker mapping queries (DIAR-06 needs fast lookup by session+speaker_id)
CREATE INDEX IF NOT EXISTS idx_transcriptions_med_session_speaker_id
  ON public.transcriptions_med(session_id, speaker_id);

-- Index for batch grouping (DIAR-04 batch queries)
CREATE INDEX IF NOT EXISTS idx_transcriptions_med_batch_id
  ON public.transcriptions_med(batch_id);
