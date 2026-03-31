-- Phase 5 (TRNS-03): Atomic transcription append - eliminates race condition in appendConsultationTranscription
-- RUN THIS IN SUPABASE SQL EDITOR before deploying the backend changes

-- Step 1: Add UNIQUE constraint on consultation_id (required for ON CONFLICT upsert)
-- If this fails due to duplicate consultation_id values, you must manually deduplicate
-- the transcriptions table first (keep the most recent record per consultation_id).
ALTER TABLE transcriptions
  ADD CONSTRAINT transcriptions_consultation_id_unique UNIQUE (consultation_id);

-- Step 2: Create the atomic append function (upsert pattern)
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
    raw_text = CASE
      WHEN transcriptions.raw_text IS NULL OR transcriptions.raw_text = ''
      THEN EXCLUDED.raw_text
      ELSE transcriptions.raw_text || E'\n' || EXCLUDED.raw_text
    END,
    updated_at = NOW();
END;
$$;

-- Step 3: Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION append_transcription_text TO service_role;
