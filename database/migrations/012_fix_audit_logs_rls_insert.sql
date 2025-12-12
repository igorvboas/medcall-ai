-- =====================================================
-- CORRIGIR RLS PARA PERMITIR INSERT DE LOGS DE AUDITORIA
-- =====================================================
-- Migration: 012_fix_audit_logs_rls_insert.sql
-- Adiciona política para permitir que usuários autenticados insiram logs

-- Remover política antiga se existir (pode não existir em todas as instalações)
DROP POLICY IF EXISTS "Authenticated users can insert audit_logs" ON audit_logs;

-- Criar política para permitir INSERT de usuários autenticados (médicos)
CREATE POLICY "Authenticated users can insert audit_logs" ON audit_logs
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.user_auth = auth.uid()
    )
);

-- Comentário
COMMENT ON POLICY "Authenticated users can insert audit_logs" ON audit_logs IS 
'Permite que médicos autenticados insiram logs de auditoria quando fazem alterações no sistema';
