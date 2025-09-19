-- =====================================================
-- CORREÇÃO RLS PARA TRANSCRIPTIONS E DOCUMENTS
-- =====================================================
-- Este script resolve os erros RLS nas tabelas transcriptions e documents
-- Erro: "new row violates row-level security policy for table transcriptions/documents"

-- =====================================================
-- 1. VERIFICAR SE TABELA MEDICOS EXISTE
-- =====================================================
-- Se a tabela medicos não existir, criar primeiro
CREATE TABLE IF NOT EXISTS medicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_auth UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    birth_date DATE,
    specialty VARCHAR(100),
    crm VARCHAR(20),
    subscription_type VARCHAR(20) DEFAULT 'FREE' CHECK (subscription_type IN ('FREE', 'PRO', 'ENTERPRISE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_medicos_user_auth ON medicos(user_auth);
CREATE INDEX IF NOT EXISTS idx_medicos_email ON medicos(email);

-- Habilitar RLS na tabela medicos
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para medicos
DROP POLICY IF EXISTS "Medicos can view own record" ON medicos;
DROP POLICY IF EXISTS "Medicos can update own record" ON medicos;
DROP POLICY IF EXISTS "Medicos can insert own record" ON medicos;

CREATE POLICY "Medicos can view own record" ON medicos
FOR SELECT USING (user_auth = auth.uid());

CREATE POLICY "Medicos can update own record" ON medicos
FOR UPDATE USING (user_auth = auth.uid());

CREATE POLICY "Medicos can insert own record" ON medicos
FOR INSERT WITH CHECK (user_auth = auth.uid());

-- =====================================================
-- 2. CORRIGIR POLÍTICAS RLS PARA TRANSCRIPTIONS
-- =====================================================
-- Remover políticas antigas que podem estar causando problemas
DROP POLICY IF EXISTS "Doctors can view own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Doctors can insert own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Doctors can update own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Doctors can delete own transcriptions" ON transcriptions;

-- Criar novas políticas que usam a tabela medicos
CREATE POLICY "Doctors can view own transcriptions" ON transcriptions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = transcriptions.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can insert own transcriptions" ON transcriptions
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = transcriptions.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can update own transcriptions" ON transcriptions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = transcriptions.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can delete own transcriptions" ON transcriptions
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = transcriptions.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

-- =====================================================
-- 3. CORRIGIR POLÍTICAS RLS PARA DOCUMENTS
-- =====================================================
-- Remover políticas antigas que podem estar causando problemas
DROP POLICY IF EXISTS "Doctors can view own documents" ON documents;
DROP POLICY IF EXISTS "Doctors can insert own documents" ON documents;
DROP POLICY IF EXISTS "Doctors can update own documents" ON documents;
DROP POLICY IF EXISTS "Doctors can delete own documents" ON documents;

-- Criar novas políticas que usam a tabela medicos
CREATE POLICY "Doctors can view own documents" ON documents
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = documents.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can insert own documents" ON documents
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = documents.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can update own documents" ON documents
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = documents.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can delete own documents" ON documents
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM consultations c
        JOIN medicos m ON m.id = c.doctor_id
        WHERE c.id = documents.consultation_id 
        AND m.user_auth = auth.uid()
    )
);

-- =====================================================
-- 4. CORRIGIR POLÍTICAS RLS PARA CONSULTATIONS
-- =====================================================
-- Garantir que as consultas também estejam corretas
DROP POLICY IF EXISTS "Doctors can view own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can insert own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can delete own consultations" ON consultations;

CREATE POLICY "Doctors can view own consultations" ON consultations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = consultations.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can insert own consultations" ON consultations
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = consultations.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can update own consultations" ON consultations
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = consultations.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can delete own consultations" ON consultations
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = consultations.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

-- =====================================================
-- 5. MIGRAR DADOS SE NECESSÁRIO
-- =====================================================
-- Migrar dados da tabela users para medicos (se necessário)
INSERT INTO medicos (id, user_auth, name, email, phone, specialty, crm, subscription_type)
SELECT 
    id,
    id as user_auth, -- Assumindo que o ID do user é o mesmo do auth.users
    name,
    email,
    phone,
    specialty,
    crm,
    subscription_type
FROM users 
WHERE is_doctor = true
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 6. ATUALIZAR REFERÊNCIAS SE NECESSÁRIO
-- =====================================================
-- Atualizar consultations para usar IDs de medicos em vez de users
UPDATE consultations 
SET doctor_id = (
    SELECT m.id 
    FROM medicos m 
    WHERE m.user_auth = consultations.doctor_id
)
WHERE EXISTS (
    SELECT 1 
    FROM medicos m 
    WHERE m.user_auth = consultations.doctor_id
    AND m.id != consultations.doctor_id
);

-- Atualizar patients para usar IDs de medicos em vez de users
UPDATE patients 
SET doctor_id = (
    SELECT m.id 
    FROM medicos m 
    WHERE m.user_auth = patients.doctor_id
)
WHERE EXISTS (
    SELECT 1 
    FROM medicos m 
    WHERE m.user_auth = patients.doctor_id
    AND m.id != patients.doctor_id
);

-- =====================================================
-- 7. VERIFICAÇÕES FINAIS
-- =====================================================
-- Comentários explicativos
COMMENT ON TABLE medicos IS 'Tabela de médicos - RLS baseado em user_auth = auth.uid()';

-- Verificar se as tabelas estão com RLS habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'transcriptions' 
        AND relrowsecurity = true
    ) THEN
        RAISE NOTICE 'Habilitando RLS na tabela transcriptions';
        ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'documents' 
        AND relrowsecurity = true
    ) THEN
        RAISE NOTICE 'Habilitando RLS na tabela documents';
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Script de correção RLS executado com sucesso!';
    RAISE NOTICE 'Políticas RLS atualizadas para usar tabela medicos em vez de users';
    RAISE NOTICE 'Tabelas transcriptions e documents agora devem permitir INSERT corretamente';
END $$;
