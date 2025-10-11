-- =====================================================
-- CORRIGIR RLS DO BUCKET DOCUMENTS
-- =====================================================
-- Este script resolve o problema de RLS no bucket documents do Supabase Storage

-- 1. Remover políticas existentes do bucket documents (se existirem)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;

-- 2. Criar políticas para o bucket documents
-- Permitir upload para usuários autenticados
CREATE POLICY "Users can upload to documents bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Permitir visualização de arquivos no bucket documents
CREATE POLICY "Users can view documents bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents'
);

-- Permitir atualização de arquivos no bucket documents
CREATE POLICY "Users can update documents bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Permitir exclusão de arquivos no bucket documents
CREATE POLICY "Users can delete documents bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- 3. Verificar se o bucket documents existe e está público
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  updated_at = NOW();

-- Comentário final
COMMENT ON POLICY "Users can upload to documents bucket" ON storage.objects IS 
'Permite que usuários autenticados façam upload no bucket documents';

COMMENT ON POLICY "Users can view documents bucket" ON storage.objects IS 
'Permite que qualquer usuário visualize arquivos do bucket documents';

COMMENT ON POLICY "Users can update documents bucket" ON storage.objects IS 
'Permite que usuários autenticados atualizem arquivos no bucket documents';

COMMENT ON POLICY "Users can delete documents bucket" ON storage.objects IS 
'Permite que usuários autenticados excluam arquivos do bucket documents';
