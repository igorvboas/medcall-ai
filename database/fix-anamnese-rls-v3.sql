-- =====================================================
-- CORREÇÃO RLS ANAMNESE - VERSÃO 3 (CORRIGIDA)
-- =====================================================
-- Esta versão corrige o problema de "multiple rows returned"
-- que está causando o erro no maybeSingle()

-- 1. Primeiro, vamos limpar todas as políticas existentes
-- =====================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename LIKE 'a_%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. Verificar e limpar registros duplicados
-- =====================================================
-- Remove registros duplicados, mantendo apenas o mais recente
WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_cadastro_prontuario
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_cadastro_prontuario 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_objetivos_queixas
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_objetivos_queixas 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_historico_risco
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_historico_risco 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_observacao_clinica_lab
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_observacao_clinica_lab 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_historia_vida
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_historia_vida 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_setenios_eventos
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_setenios_eventos 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_ambiente_contexto
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_ambiente_contexto 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_sensacao_emocoes
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_sensacao_emocoes 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_preocupacoes_crencas
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_preocupacoes_crencas 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

WITH duplicates AS (
    SELECT 
        user_id,
        consulta_id,
        MAX(created_at) as latest_created_at
    FROM a_reino_miasma
    GROUP BY user_id, consulta_id
    HAVING COUNT(*) > 1
)
DELETE FROM a_reino_miasma 
WHERE (user_id, consulta_id, created_at) NOT IN (
    SELECT user_id, consulta_id, latest_created_at FROM duplicates
);

-- 3. Criar políticas RLS corretas
-- =====================================================
-- Políticas que permitem acesso baseado no user_id do médico autenticado

-- 1. a_cadastro_prontuario
ALTER TABLE public.a_cadastro_prontuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_cadastro_select" 
ON public.a_cadastro_prontuario
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_cadastro_insert" 
ON public.a_cadastro_prontuario
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_cadastro_update" 
ON public.a_cadastro_prontuario
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. a_objetivos_queixas
ALTER TABLE public.a_objetivos_queixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_objetivos_select" 
ON public.a_objetivos_queixas
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_objetivos_insert" 
ON public.a_objetivos_queixas
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_objetivos_update" 
ON public.a_objetivos_queixas
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. a_historico_risco
ALTER TABLE public.a_historico_risco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_historico_select" 
ON public.a_historico_risco
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_historico_insert" 
ON public.a_historico_risco
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_historico_update" 
ON public.a_historico_risco
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. a_observacao_clinica_lab
ALTER TABLE public.a_observacao_clinica_lab ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_observacao_select" 
ON public.a_observacao_clinica_lab
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_observacao_insert" 
ON public.a_observacao_clinica_lab
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_observacao_update" 
ON public.a_observacao_clinica_lab
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. a_historia_vida
ALTER TABLE public.a_historia_vida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_historia_select" 
ON public.a_historia_vida
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_historia_insert" 
ON public.a_historia_vida
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_historia_update" 
ON public.a_historia_vida
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. a_setenios_eventos
ALTER TABLE public.a_setenios_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_setenios_select" 
ON public.a_setenios_eventos
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_setenios_insert" 
ON public.a_setenios_eventos
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_setenios_update" 
ON public.a_setenios_eventos
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 7. a_ambiente_contexto
ALTER TABLE public.a_ambiente_contexto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_ambiente_select" 
ON public.a_ambiente_contexto
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_ambiente_insert" 
ON public.a_ambiente_contexto
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_ambiente_update" 
ON public.a_ambiente_contexto
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 8. a_sensacao_emocoes
ALTER TABLE public.a_sensacao_emocoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_sensacao_select" 
ON public.a_sensacao_emocoes
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_sensacao_insert" 
ON public.a_sensacao_emocoes
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_sensacao_update" 
ON public.a_sensacao_emocoes
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 9. a_preocupacoes_crencas
ALTER TABLE public.a_preocupacoes_crencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_preocupacoes_select" 
ON public.a_preocupacoes_crencas
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_preocupacoes_insert" 
ON public.a_preocupacoes_crencas
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_preocupacoes_update" 
ON public.a_preocupacoes_crencas
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 10. a_reino_miasma
ALTER TABLE public.a_reino_miasma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicos_reino_select" 
ON public.a_reino_miasma
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "medicos_reino_insert" 
ON public.a_reino_miasma
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "medicos_reino_update" 
ON public.a_reino_miasma
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Adicionar índices únicos para prevenir duplicatas futuras
-- =====================================================
-- Criar índices únicos para garantir que não haverá duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_a_cadastro_prontuario_unique 
ON a_cadastro_prontuario (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_objetivos_queixas_unique 
ON a_objetivos_queixas (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_historico_risco_unique 
ON a_historico_risco (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_observacao_clinica_lab_unique 
ON a_observacao_clinica_lab (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_historia_vida_unique 
ON a_historia_vida (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_setenios_eventos_unique 
ON a_setenios_eventos (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_ambiente_contexto_unique 
ON a_ambiente_contexto (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_sensacao_emocoes_unique 
ON a_sensacao_emocoes (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_preocupacoes_crencas_unique 
ON a_preocupacoes_crencas (user_id, consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_reino_miasma_unique 
ON a_reino_miasma (user_id, consulta_id);

-- 5. Verificar se as políticas foram criadas corretamente
-- =====================================================
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename LIKE 'a_%'
ORDER BY tablename, cmd;

-- 6. Verificar se os índices foram criados
-- =====================================================
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 'a_%' 
AND indexname LIKE '%_unique'
ORDER BY tablename;

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ RLS corrigido para tabelas de anamnese!';
    RAISE NOTICE '✅ Registros duplicados removidos!';
    RAISE NOTICE '✅ Índices únicos criados para prevenir duplicatas futuras!';
    RAISE NOTICE '✅ Políticas RLS baseadas em user_id criadas!';
END $$;
