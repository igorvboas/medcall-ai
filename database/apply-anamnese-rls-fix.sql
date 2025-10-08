-- =====================================================
-- APLICAR CORREÇÃO RLS ANAMNESE
-- =====================================================
-- Execute este arquivo para corrigir o problema de RLS
-- nas tabelas de anamnese que está causando o erro
-- "JSON object requested, multiple (or no) rows returned"

\i fix-anamnese-rls-v3.sql

-- Verificar se a correção funcionou
SELECT 
    'Verificação final' as status,
    COUNT(*) as total_tabelas
FROM pg_policies
WHERE tablename LIKE 'a_%';

-- Teste rápido de acesso (deve funcionar sem erro)
SELECT 'a_cadastro_prontuario' as tabela, COUNT(*) as registros FROM a_cadastro_prontuario;
SELECT 'a_objetivos_queixas' as tabela, COUNT(*) as registros FROM a_objetivos_queixas;
