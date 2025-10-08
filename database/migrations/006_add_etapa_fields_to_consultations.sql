-- =====================================================
-- Migration 006: Adicionar campos etapa e solucao_etapa à tabela consultations
-- =====================================================
-- Esta migration adiciona os campos necessários para controlar as etapas do workflow de consultas

-- Adicionar campo etapa
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS etapa VARCHAR(20) CHECK (etapa IN ('ANAMNESE', 'DIAGNOSTICO', 'SOLUCAO'));

-- Adicionar campo solucao_etapa
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS solucao_etapa VARCHAR(30) CHECK (solucao_etapa IN ('LTB', 'MENTALIDADE', 'ALIMENTACAO', 'SUPLEMENTACAO', 'ATIVIDADE_FISICA', 'HABITOS_DE_VIDA'));

-- Adicionar comentários para documentação
COMMENT ON COLUMN consultations.etapa IS 'Etapa atual do workflow da consulta: ANAMNESE, DIAGNOSTICO ou SOLUCAO';
COMMENT ON COLUMN consultations.solucao_etapa IS 'Quando etapa=SOLUCAO, define a sub-etapa específica: LTB, MENTALIDADE, ALIMENTACAO, SUPLEMENTACAO, ATIVIDADE_FISICA ou HABITOS_DE_VIDA';

-- Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_consultations_etapa ON consultations(etapa);
CREATE INDEX IF NOT EXISTS idx_consultations_solucao_etapa ON consultations(solucao_etapa);

-- Atualizar o status CHECK constraint para incluir VALIDATION
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check CHECK (status IN ('CREATED', 'RECORDING', 'PROCESSING', 'VALIDATION', 'COMPLETED', 'ERROR', 'CANCELLED'));

-- Comentário sobre a mudança no status
COMMENT ON COLUMN consultations.status IS 'Status da consulta: CREATED, RECORDING, PROCESSING, VALIDATION, COMPLETED, ERROR ou CANCELLED';

