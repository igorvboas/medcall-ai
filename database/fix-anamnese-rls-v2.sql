-- =====================================================
-- CORREÇÃO RLS ANAMNESE - VERSÃO 2 (MAIS PERMISSIVA)
-- =====================================================
-- Se o RLS anterior não funcionou, este é mais permissivo

-- OPÇÃO 1: RLS com políticas mais permissivas
-- =====================================================

-- Remover todas as políticas antigas primeiro
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

-- Criar políticas PERMISSIVAS para todos os usuários autenticados
-- (temporariamente sem verificar user_id)

-- 1. a_cadastro_prontuario
ALTER TABLE public.a_cadastro_prontuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_cadastro_prontuario
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_cadastro_prontuario
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_cadastro_prontuario
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. a_objetivos_queixas
ALTER TABLE public.a_objetivos_queixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_objetivos_queixas
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_objetivos_queixas
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_objetivos_queixas
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. a_historico_risco
ALTER TABLE public.a_historico_risco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_historico_risco
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_historico_risco
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_historico_risco
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. a_observacao_clinica_lab
ALTER TABLE public.a_observacao_clinica_lab ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_observacao_clinica_lab
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_observacao_clinica_lab
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_observacao_clinica_lab
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. a_historia_vida
ALTER TABLE public.a_historia_vida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_historia_vida
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_historia_vida
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_historia_vida
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. a_setenios_eventos
ALTER TABLE public.a_setenios_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_setenios_eventos
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_setenios_eventos
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_setenios_eventos
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 7. a_ambiente_contexto
ALTER TABLE public.a_ambiente_contexto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_ambiente_contexto
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_ambiente_contexto
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_ambiente_contexto
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 8. a_sensacao_emocoes
ALTER TABLE public.a_sensacao_emocoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_sensacao_emocoes
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_sensacao_emocoes
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_sensacao_emocoes
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 9. a_preocupacoes_crencas
ALTER TABLE public.a_preocupacoes_crencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_preocupacoes_crencas
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_preocupacoes_crencas
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_preocupacoes_crencas
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 10. a_reino_miasma
ALTER TABLE public.a_reino_miasma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para usuarios autenticados" 
ON public.a_reino_miasma
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert para usuarios autenticados" 
ON public.a_reino_miasma
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir update para usuarios autenticados" 
ON public.a_reino_miasma
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =====================================================
-- VERIFICAR RESULTADOS
-- =====================================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename LIKE 'a_%'
ORDER BY tablename, cmd;

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Políticas RLS criadas com sucesso para todas as tabelas de anamnese!';
    RAISE NOTICE '⚠️ ATENÇÃO: Estas políticas são PERMISSIVAS (permitem qualquer usuário autenticado).';
    RAISE NOTICE '   Considere adicionar filtros por user_id depois que confirmar que está funcionando.';
END $$;

