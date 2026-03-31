-- Add url_audio column to consultations table
-- Stores the public URL of the full consultation audio in Supabase storage
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS url_audio text NULL;

COMMENT ON COLUMN consultations.url_audio IS 'URL publica do audio completo da consulta no Supabase Storage';
