-- =====================================================
-- CRIAÇÃO DA TABELA MEDICOS E POLÍTICAS RLS
-- =====================================================
-- Este script cria a tabela medicos que está sendo usada no código
-- mas não existe no banco de dados atual

-- Criar tabela medicos
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

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_medicos_user_auth ON medicos(user_auth);
CREATE INDEX IF NOT EXISTS idx_medicos_email ON medicos(email);

-- Criar trigger para updated_at
CREATE TRIGGER update_medicos_updated_at 
    BEFORE UPDATE ON medicos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS na tabela medicos
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para medicos
CREATE POLICY "Medicos can view own record" ON medicos
FOR SELECT USING (user_auth = auth.uid());

CREATE POLICY "Medicos can update own record" ON medicos
FOR UPDATE USING (user_auth = auth.uid());

CREATE POLICY "Medicos can insert own record" ON medicos
FOR INSERT WITH CHECK (user_auth = auth.uid());

-- Comentário explicativo
COMMENT ON TABLE medicos IS 'Tabela de médicos com RLS baseado em user_auth = auth.uid()';

-- =====================================================
-- CORRIGIR POLÍTICAS RLS DA TABELA CONSULTATIONS
-- =====================================================
-- As políticas atuais usam doctor_id::text = auth.uid()::text
-- Mas agora precisamos usar a tabela medicos como intermediária

-- Remover políticas antigas
DROP POLICY IF EXISTS "Doctors can view own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can insert own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can delete own consultations" ON consultations;

-- Criar novas políticas que usam a tabela medicos
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
-- CORRIGIR POLÍTICAS RLS DA TABELA PATIENTS
-- =====================================================
-- Remover políticas antigas
DROP POLICY IF EXISTS "Doctors can view own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can insert own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can update own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can delete own patients" ON patients;

-- Criar novas políticas que usam a tabela medicos
CREATE POLICY "Doctors can view own patients" ON patients
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = patients.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can insert own patients" ON patients
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = patients.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can update own patients" ON patients
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = patients.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Doctors can delete own patients" ON patients
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = patients.doctor_id 
        AND medicos.user_auth = auth.uid()
    )
);

-- =====================================================
-- INSERIR DADOS DE EXEMPLO
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

-- Comentário final
COMMENT ON TABLE medicos IS 'Tabela de médicos criada para corrigir RLS - execute este script no Supabase';
