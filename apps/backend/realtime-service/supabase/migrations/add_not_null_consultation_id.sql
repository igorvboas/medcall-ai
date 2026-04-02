-- Phase 7 (DBAS-02): NOT NULL constraint on transcriptions.consultation_id
-- Prevents orphan transcription rows without a consultation reference
-- RUN THIS IN SUPABASE SQL EDITOR

-- Step 1: Remove orphan rows where consultation_id is NULL (unusable data)
DELETE FROM transcriptions WHERE consultation_id IS NULL;

-- Step 2: Add NOT NULL constraint
-- Note: UNIQUE constraint on consultation_id already exists from Phase 5
-- (transcriptions_consultation_id_unique added in append_transcription_text.sql)
ALTER TABLE transcriptions ALTER COLUMN consultation_id SET NOT NULL;

-- Run in Supabase SQL Editor
