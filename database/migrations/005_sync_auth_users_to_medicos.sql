-- Sync new Supabase auth users into public.medicos automatically

-- 1) Ensure the target table exists with the expected columns (no-ops if already present)
--    We only create if it doesn't exist to avoid clobbering an existing definition
CREATE TABLE IF NOT EXISTS public.medicos (
  id uuid not null default extensions.uuid_generate_v4 (),
  email character varying(255) not null,
  name character varying(255) not null,
  phone character varying(20) null,
  cpf character varying(14) null,
  birth_date date null,
  is_doctor boolean null default false,
  specialty character varying(100) null,
  crm character varying(20) null,
  subscription_type character varying(20) null default 'FREE'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  user_auth uuid null references auth.users (id),
  constraint users_pkey primary key (id),
  constraint users_cpf_key unique (cpf),
  constraint users_email_key unique (email),
  constraint users_subscription_type_check check (
    (
      (subscription_type)::text = any (
        (
          array[
            'FREE'::character varying,
            'PRO'::character varying,
            'ENTERPRISE'::character varying
          ]
        )::text[]
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_medicos_user_auth ON public.medicos (user_auth);
CREATE INDEX IF NOT EXISTS idx_medicos_email ON public.medicos (email);

-- Keep updated_at fresh on updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_medicos_updated_at'
  ) THEN
    CREATE TRIGGER update_medicos_updated_at
      BEFORE UPDATE ON public.medicos
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Function to insert a corresponding medicos row when a new auth user is created
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_medicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- Try to resolve a display name from auth metadata; fallback to email local-part
  v_name := COALESCE(
    (NEW.raw_user_meta_data->>'name'),
    (NEW.raw_user_meta_data->>'full_name'),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.medicos (email, name, user_auth)
  VALUES (NEW.email, v_name, NEW.id)
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Trigger on auth.users for INSERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_sync_auth_user_to_medicos' AND n.nspname = 'auth' AND c.relname = 'users'
  ) THEN
    DROP TRIGGER trg_sync_auth_user_to_medicos ON auth.users;
  END IF;

  CREATE TRIGGER trg_sync_auth_user_to_medicos
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_auth_user_to_medicos();
END $$;

-- 4) Optional: keep medicos.email in sync if auth email changes
CREATE OR REPLACE FUNCTION public.sync_auth_user_email_to_medicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.medicos
      SET email = NEW.email,
          updated_at = now()
    WHERE user_auth = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_sync_auth_user_email_to_medicos' AND n.nspname = 'auth' AND c.relname = 'users'
  ) THEN
    DROP TRIGGER trg_sync_auth_user_email_to_medicos ON auth.users;
  END IF;

  CREATE TRIGGER trg_sync_auth_user_email_to_medicos
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_auth_user_email_to_medicos();
END $$;



-- 5) One-time backfill for existing auth.users without a medicos row
INSERT INTO public.medicos (email, name, user_auth)
SELECT 
  u.email,
  COALESCE(
    (u.raw_user_meta_data->>'name'),
    (u.raw_user_meta_data->>'full_name'),
    split_part(COALESCE(u.email, ''), '@', 1)
  ) AS name,
  u.id
FROM auth.users u
LEFT JOIN public.medicos m ON m.user_auth = u.id
WHERE m.user_auth IS NULL AND u.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
