-- =====================================================
-- LIMPEZA DE REGISTROS DUPLICADOS - ANAMNESE
-- =====================================================
-- Este script remove registros duplicados das tabelas de anamnese
-- mantendo apenas o registro mais recente (baseado em created_at)

-- IMPORTANTE: Faça backup antes de executar!

-- 1. Verificar duplicatas ANTES da limpeza
-- =====================================================
SELECT 'a_cadastro_prontuario' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_cadastro_prontuario
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_objetivos_queixas' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_objetivos_queixas
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_historico_risco' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_historico_risco
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_observacao_clinica_lab' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_observacao_clinica_lab
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_historia_vida' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_historia_vida
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_setenios_eventos' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_setenios_eventos
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_ambiente_contexto' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_ambiente_contexto
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_sensacao_emocoes' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_sensacao_emocoes
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_preocupacoes_crencas' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_preocupacoes_crencas
GROUP BY consulta_id
HAVING COUNT(*) > 1;

SELECT 'a_reino_miasma' as tabela, consulta_id, COUNT(*) as quantidade
FROM a_reino_miasma
GROUP BY consulta_id
HAVING COUNT(*) > 1;

-- 2. REMOVER DUPLICATAS (mantém o mais recente)
-- =====================================================

-- a_cadastro_prontuario
DELETE FROM a_cadastro_prontuario
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_cadastro_prontuario
    ORDER BY consulta_id, created_at DESC
);

-- a_objetivos_queixas
DELETE FROM a_objetivos_queixas
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_objetivos_queixas
    ORDER BY consulta_id, created_at DESC
);

-- a_historico_risco
DELETE FROM a_historico_risco
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_historico_risco
    ORDER BY consulta_id, created_at DESC
);

-- a_observacao_clinica_lab
DELETE FROM a_observacao_clinica_lab
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_observacao_clinica_lab
    ORDER BY consulta_id, created_at DESC
);

-- a_historia_vida
DELETE FROM a_historia_vida
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_historia_vida
    ORDER BY consulta_id, created_at DESC
);

-- a_setenios_eventos
DELETE FROM a_setenios_eventos
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_setenios_eventos
    ORDER BY consulta_id, created_at DESC
);

-- a_ambiente_contexto
DELETE FROM a_ambiente_contexto
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_ambiente_contexto
    ORDER BY consulta_id, created_at DESC
);

-- a_sensacao_emocoes
DELETE FROM a_sensacao_emocoes
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_sensacao_emocoes
    ORDER BY consulta_id, created_at DESC
);

-- a_preocupacoes_crencas
DELETE FROM a_preocupacoes_crencas
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_preocupacoes_crencas
    ORDER BY consulta_id, created_at DESC
);

-- a_reino_miasma
DELETE FROM a_reino_miasma
WHERE id NOT IN (
    SELECT DISTINCT ON (consulta_id) id
    FROM a_reino_miasma
    ORDER BY consulta_id, created_at DESC
);

-- 3. Criar índices únicos para prevenir duplicatas futuras
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_a_cadastro_prontuario_consulta_unique 
ON a_cadastro_prontuario (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_objetivos_queixas_consulta_unique 
ON a_objetivos_queixas (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_historico_risco_consulta_unique 
ON a_historico_risco (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_observacao_clinica_lab_consulta_unique 
ON a_observacao_clinica_lab (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_historia_vida_consulta_unique 
ON a_historia_vida (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_setenios_eventos_consulta_unique 
ON a_setenios_eventos (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_ambiente_contexto_consulta_unique 
ON a_ambiente_contexto (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_sensacao_emocoes_consulta_unique 
ON a_sensacao_emocoes (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_preocupacoes_crencas_consulta_unique 
ON a_preocupacoes_crencas (consulta_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_a_reino_miasma_consulta_unique 
ON a_reino_miasma (consulta_id);

-- 4. Verificar resultados APÓS a limpeza
-- =====================================================
SELECT 'a_cadastro_prontuario' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_cadastro_prontuario;

SELECT 'a_objetivos_queixas' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_objetivos_queixas;

SELECT 'a_historico_risco' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_historico_risco;

SELECT 'a_observacao_clinica_lab' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_observacao_clinica_lab;

SELECT 'a_historia_vida' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_historia_vida;

SELECT 'a_setenios_eventos' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_setenios_eventos;

SELECT 'a_ambiente_contexto' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_ambiente_contexto;

SELECT 'a_sensacao_emocoes' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_sensacao_emocoes;

SELECT 'a_preocupacoes_crencas' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_preocupacoes_crencas;

SELECT 'a_reino_miasma' as tabela, COUNT(*) as total_registros,
       COUNT(DISTINCT consulta_id) as consultas_unicas
FROM a_reino_miasma;

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Registros duplicados removidos!';
    RAISE NOTICE '✅ Índices únicos criados para prevenir duplicatas futuras!';
    RAISE NOTICE '✅ Agora cada consulta_id terá apenas 1 registro por tabela!';
END $$;

