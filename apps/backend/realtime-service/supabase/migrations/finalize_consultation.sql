-- Phase 7 (DBAS-01): Atomic finalization via PostgreSQL RPC
-- Replaces sequential DB writes with a single transaction for consultations + call_sessions
-- RUN THIS IN SUPABASE SQL EDITOR

CREATE OR REPLACE FUNCTION finalize_consultation(
  p_consultation_id UUID,
  p_transcription TEXT,
  p_status TEXT DEFAULT 'COMPLETED',
  p_duration_minutes NUMERIC DEFAULT NULL,
  p_call_session_room_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Step 1: Update consultation with transcription, status, and duration
  UPDATE consultations
  SET
    transcricao = p_transcription,
    status = p_status,
    consulta_finalizada = true,
    consulta_fim = NOW(),
    duracao = p_duration_minutes,
    updated_at = NOW()
  WHERE id = p_consultation_id;

  -- Step 2: Update call_sessions only if room_id is provided (online consultations)
  IF p_call_session_room_id IS NOT NULL THEN
    UPDATE call_sessions
    SET
      status = 'ended',
      ended_at = NOW(),
      webrtc_active = false
    WHERE room_id = p_call_session_room_id;
  END IF;

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION finalize_consultation TO service_role;
