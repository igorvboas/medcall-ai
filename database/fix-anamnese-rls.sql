-- =====================================================
-- RLS POLICIES FOR ANAMNESE TABLES
-- =====================================================
-- Este arquivo configura as políticas de segurança RLS
-- para as 10 tabelas de anamnese integrativa
-- =====================================================

-- 1. Tabela: a_cadastro_prontuario
-- =====================================================
ALTER TABLE public.a_cadastro_prontuario ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: Médico pode ver seus próprios registros
DROP POLICY IF EXISTS "Medicos podem ver seus proprios cadastros" ON public.a_cadastro_prontuario;
CREATE POLICY "Medicos podem ver seus proprios cadastros"
ON public.a_cadastro_prontuario
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()::text
);

-- Política de INSERT: Médico pode inserir seus próprios registros
DROP POLICY IF EXISTS "Medicos podem inserir seus proprios cadastros" ON public.a_cadastro_prontuario;
CREATE POLICY "Medicos podem inserir seus proprios cadastros"
ON public.a_cadastro_prontuario
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()::text
);

-- Política de UPDATE: Médico pode atualizar seus próprios registros
DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios cadastros" ON public.a_cadastro_prontuario;
CREATE POLICY "Medicos podem atualizar seus proprios cadastros"
ON public.a_cadastro_prontuario
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 2. Tabela: a_objetivos_queixas
-- =====================================================
ALTER TABLE public.a_objetivos_queixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver seus proprios objetivos" ON public.a_objetivos_queixas;
CREATE POLICY "Medicos podem ver seus proprios objetivos"
ON public.a_objetivos_queixas
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir seus proprios objetivos" ON public.a_objetivos_queixas;
CREATE POLICY "Medicos podem inserir seus proprios objetivos"
ON public.a_objetivos_queixas
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios objetivos" ON public.a_objetivos_queixas;
CREATE POLICY "Medicos podem atualizar seus proprios objetivos"
ON public.a_objetivos_queixas
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 3. Tabela: a_historico_risco
-- =====================================================
ALTER TABLE public.a_historico_risco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver seus proprios historicos" ON public.a_historico_risco;
CREATE POLICY "Medicos podem ver seus proprios historicos"
ON public.a_historico_risco
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir seus proprios historicos" ON public.a_historico_risco;
CREATE POLICY "Medicos podem inserir seus proprios historicos"
ON public.a_historico_risco
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios historicos" ON public.a_historico_risco;
CREATE POLICY "Medicos podem atualizar seus proprios historicos"
ON public.a_historico_risco
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 4. Tabela: a_observacao_clinica_lab
-- =====================================================
ALTER TABLE public.a_observacao_clinica_lab ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver suas proprias observacoes" ON public.a_observacao_clinica_lab;
CREATE POLICY "Medicos podem ver suas proprias observacoes"
ON public.a_observacao_clinica_lab
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir suas proprias observacoes" ON public.a_observacao_clinica_lab;
CREATE POLICY "Medicos podem inserir suas proprias observacoes"
ON public.a_observacao_clinica_lab
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar suas proprias observacoes" ON public.a_observacao_clinica_lab;
CREATE POLICY "Medicos podem atualizar suas proprias observacoes"
ON public.a_observacao_clinica_lab
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 5. Tabela: a_historia_vida
-- =====================================================
ALTER TABLE public.a_historia_vida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver suas proprias historias" ON public.a_historia_vida;
CREATE POLICY "Medicos podem ver suas proprias historias"
ON public.a_historia_vida
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir suas proprias historias" ON public.a_historia_vida;
CREATE POLICY "Medicos podem inserir suas proprias historias"
ON public.a_historia_vida
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar suas proprias historias" ON public.a_historia_vida;
CREATE POLICY "Medicos podem atualizar suas proprias historias"
ON public.a_historia_vida
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 6. Tabela: a_setenios_eventos
-- =====================================================
ALTER TABLE public.a_setenios_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver seus proprios setenios" ON public.a_setenios_eventos;
CREATE POLICY "Medicos podem ver seus proprios setenios"
ON public.a_setenios_eventos
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir seus proprios setenios" ON public.a_setenios_eventos;
CREATE POLICY "Medicos podem inserir seus proprios setenios"
ON public.a_setenios_eventos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios setenios" ON public.a_setenios_eventos;
CREATE POLICY "Medicos podem atualizar seus proprios setenios"
ON public.a_setenios_eventos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 7. Tabela: a_ambiente_contexto
-- =====================================================
ALTER TABLE public.a_ambiente_contexto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver seus proprios ambientes" ON public.a_ambiente_contexto;
CREATE POLICY "Medicos podem ver seus proprios ambientes"
ON public.a_ambiente_contexto
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir seus proprios ambientes" ON public.a_ambiente_contexto;
CREATE POLICY "Medicos podem inserir seus proprios ambientes"
ON public.a_ambiente_contexto
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios ambientes" ON public.a_ambiente_contexto;
CREATE POLICY "Medicos podem atualizar seus proprios ambientes"
ON public.a_ambiente_contexto
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 8. Tabela: a_sensacao_emocoes
-- =====================================================
ALTER TABLE public.a_sensacao_emocoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver suas proprias sensacoes" ON public.a_sensacao_emocoes;
CREATE POLICY "Medicos podem ver suas proprias sensacoes"
ON public.a_sensacao_emocoes
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir suas proprias sensacoes" ON public.a_sensacao_emocoes;
CREATE POLICY "Medicos podem inserir suas proprias sensacoes"
ON public.a_sensacao_emocoes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar suas proprias sensacoes" ON public.a_sensacao_emocoes;
CREATE POLICY "Medicos podem atualizar suas proprias sensacoes"
ON public.a_sensacao_emocoes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 9. Tabela: a_preocupacoes_crencas
-- =====================================================
ALTER TABLE public.a_preocupacoes_crencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver suas proprias preocupacoes" ON public.a_preocupacoes_crencas;
CREATE POLICY "Medicos podem ver suas proprias preocupacoes"
ON public.a_preocupacoes_crencas
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir suas proprias preocupacoes" ON public.a_preocupacoes_crencas;
CREATE POLICY "Medicos podem inserir suas proprias preocupacoes"
ON public.a_preocupacoes_crencas
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar suas proprias preocupacoes" ON public.a_preocupacoes_crencas;
CREATE POLICY "Medicos podem atualizar suas proprias preocupacoes"
ON public.a_preocupacoes_crencas
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 10. Tabela: a_reino_miasma
-- =====================================================
ALTER TABLE public.a_reino_miasma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medicos podem ver seus proprios reinos" ON public.a_reino_miasma;
CREATE POLICY "Medicos podem ver seus proprios reinos"
ON public.a_reino_miasma
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem inserir seus proprios reinos" ON public.a_reino_miasma;
CREATE POLICY "Medicos podem inserir seus proprios reinos"
ON public.a_reino_miasma
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Medicos podem atualizar seus proprios reinos" ON public.a_reino_miasma;
CREATE POLICY "Medicos podem atualizar seus proprios reinos"
ON public.a_reino_miasma
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- =====================================================
-- FIM DAS POLÍTICAS RLS
-- =====================================================

-- Verificar se as políticas foram criadas corretamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename LIKE 'a_%'
ORDER BY tablename, policyname;

