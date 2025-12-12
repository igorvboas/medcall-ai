-- =====================================================
-- ADICIONAR COLUNA table_ref NA TABELA audit_logs
-- =====================================================
-- Migration: 011_add_table_ref_to_audit_logs.sql
-- Adiciona campo para referenciar tabela.coluna específica

-- Adicionar coluna table_ref
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS table_ref VARCHAR(255);

-- Criar índice para busca por table_ref
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_ref ON audit_logs(table_ref);

-- Comentário
COMMENT ON COLUMN audit_logs.table_ref IS 'Referência à tabela e coluna específica no formato: tabela.coluna (ex: a_sintese_analitica.sintese)';
