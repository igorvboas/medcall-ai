-- Migration: Adicionar campo status à tabela a_cadastro_anamnese
-- Este campo permite rastrear o status da anamnese inicial:
-- - 'pendente': Médico enviou anamnese, paciente precisa preencher
-- - 'preenchida': Paciente preencheu a anamnese
-- - NULL: Nenhuma anamnese foi enviada ainda

-- Adicionar coluna status se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'a_cadastro_anamnese' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.a_cadastro_anamnese 
    ADD COLUMN status TEXT NULL;
    
    -- Criar índice para melhorar performance de consultas
    CREATE INDEX IF NOT EXISTS idx_anamnese_status 
    ON public.a_cadastro_anamnese(status);
    
    -- Comentário explicativo
    COMMENT ON COLUMN public.a_cadastro_anamnese.status IS 
    'Status da anamnese: pendente (paciente precisa preencher), preenchida (já foi preenchida), ou NULL (não enviada)';
  END IF;
END $$;

-- Adicionar campo updated_at se não existir (para rastrear quando foi atualizada)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'a_cadastro_anamnese' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.a_cadastro_anamnese 
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now();
  END IF;
END $$;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_anamnese_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_anamnese_updated_at ON public.a_cadastro_anamnese;
CREATE TRIGGER trigger_update_anamnese_updated_at
BEFORE UPDATE ON public.a_cadastro_anamnese
FOR EACH ROW
EXECUTE FUNCTION update_anamnese_updated_at();

