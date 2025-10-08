-- =====================================================
-- TESTE DE ACESSO ÀS TABELAS DE ANAMNESE
-- =====================================================
-- Execute este script para verificar se o RLS está funcionando

-- 1. Verificar se o usuário está autenticado
SELECT 
    auth.uid() as user_id_atual,
    auth.email() as email_atual;

-- 2. Verificar se as tabelas existem
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name LIKE 'a_%'
ORDER BY table_name;

-- 3. Verificar RLS habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename LIKE 'a_%'
ORDER BY tablename;

-- 4. Verificar políticas RLS
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

-- 5. Testar SELECT em cada tabela (vai mostrar se o RLS está bloqueando)
SELECT 'a_cadastro_prontuario' as tabela, COUNT(*) as total FROM a_cadastro_prontuario;
SELECT 'a_objetivos_queixas' as tabela, COUNT(*) as total FROM a_objetivos_queixas;
SELECT 'a_historico_risco' as tabela, COUNT(*) as total FROM a_historico_risco;
SELECT 'a_observacao_clinica_lab' as tabela, COUNT(*) as total FROM a_observacao_clinica_lab;
SELECT 'a_historia_vida' as tabela, COUNT(*) as total FROM a_historia_vida;
SELECT 'a_setenios_eventos' as tabela, COUNT(*) as total FROM a_setenios_eventos;
SELECT 'a_ambiente_contexto' as tabela, COUNT(*) as total FROM a_ambiente_contexto;
SELECT 'a_sensacao_emocoes' as tabela, COUNT(*) as total FROM a_sensacao_emocoes;
SELECT 'a_preocupacoes_crencas' as tabela, COUNT(*) as total FROM a_preocupacoes_crencas;
SELECT 'a_reino_miasma' as tabela, COUNT(*) as total FROM a_reino_miasma;

-- 6. Verificar dados com user_id
SELECT 
    'a_cadastro_prontuario' as tabela,
    COUNT(*) as total,
    COUNT(DISTINCT user_id) as usuarios_distintos,
    array_agg(DISTINCT user_id) as user_ids
FROM a_cadastro_prontuario
GROUP BY 1;

-- 7. Se você souber seu user_id, teste diretamente (substitua o ID):
-- SELECT * FROM a_cadastro_prontuario WHERE user_id = 'SEU_USER_ID_AQUI';

