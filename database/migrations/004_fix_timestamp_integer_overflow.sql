-- =====================================================
-- MEDCALL AI - CORREÇÃO DE OVERFLOW DE TIMESTAMPS
-- =====================================================
-- Fix para o erro: value "1757602447877" is out of range for type integer
-- Altera start_ms e end_ms de INTEGER para BIGINT para suportar timestamps JavaScript

BEGIN;

-- Alterar colunas de timestamp para BIGINT
ALTER TABLE utterances 
    ALTER COLUMN start_ms TYPE BIGINT,
    ALTER COLUMN end_ms TYPE BIGINT;

-- Comentário explicativo
COMMENT ON COLUMN utterances.start_ms IS 'Timestamp de início em milissegundos (JavaScript Date.now())';
COMMENT ON COLUMN utterances.end_ms IS 'Timestamp de fim em milissegundos (JavaScript Date.now())';

-- Log da correção
INSERT INTO migration_log (migration_name, applied_at, description) VALUES 
(
    '004_fix_timestamp_integer_overflow',
    NOW(),
    'Corrigido overflow de timestamps: INTEGER -> BIGINT para start_ms e end_ms'
) ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
