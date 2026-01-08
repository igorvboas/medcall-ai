-- Migration: 013_update_user_sync_trigger.sql
-- Update trigger to handle 'clinic' role registration

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_medicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_clinica_id uuid;
BEGIN
  -- Try to resolve a display name from auth metadata
  v_name := COALESCE(
    (NEW.raw_user_meta_data->>'name'),
    (NEW.raw_user_meta_data->>'full_name'),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  -- Get role from metadata (default to 'doctor' if null)
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'doctor');

  -- Logic for Clinic Registration
  IF v_role = 'clinic' THEN
    -- 1. Create entry in 'clinicas' table
    INSERT INTO public.clinicas (user_auth, nome, email, created_at)
    VALUES (NEW.id, v_name, NEW.email, now())
    RETURNING id INTO v_clinica_id;

    -- 2. Create entry in 'medicos' table LINKED to this clinic
    -- The clinic admin is also created as a doctor/user in 'medicos'
    INSERT INTO public.medicos (email, name, user_auth, clinica_id, is_doctor, clinica_admin)
    VALUES (NEW.email, v_name, NEW.id, v_clinica_id, true, true) -- Admin set to true
    ON CONFLICT (email) DO NOTHING;
    
  ELSE
    -- Logic for Independent Doctor (current logic)
    INSERT INTO public.medicos (email, name, user_auth, is_doctor)
    VALUES (NEW.email, v_name, NEW.id, true)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is still active (it should already be, but good to verify)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_auth_user_to_medicos'
--   ) THEN
--     CREATE TRIGGER trg_sync_auth_user_to_medicos
--       AFTER INSERT ON auth.users
--       FOR EACH ROW
--       EXECUTE FUNCTION public.sync_auth_user_to_medicos();
--   END IF;
-- END $$;
