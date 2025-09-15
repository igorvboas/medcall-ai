-- =====================================================
-- CORREÇÃO IMEDIATA DO RLS PARA CONSULTAÇÕES
-- =====================================================
-- Este script resolve o erro "new row violates row-level security policy for table consultations"

-- 1. PRIMEIRO: Criar a tabela medicos se não existir
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

-- 2. Criar índices
CREATE INDEX IF NOT EXISTS idx_medicos_user_auth ON medicos(user_auth);
CREATE INDEX IF NOT EXISTS idx_medicos_email ON medicos(email);

-- 3. Habilitar RLS na tabela medicos
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas da tabela medicos (se existirem)
DROP POLICY IF EXISTS "Medicos can view own record" ON medicos;
DROP POLICY IF EXISTS "Medicos can update own record" ON medicos;
DROP POLICY IF EXISTS "Medicos can insert own record" ON medicos;

-- 5. Criar políticas RLS para medicos
CREATE POLICY "Medicos can view own record" ON medicos
FOR SELECT USING (user_auth = auth.uid());

CREATE POLICY "Medicos can update own record" ON medicos
FOR UPDATE USING (user_auth = auth.uid());

CREATE POLICY "Medicos can insert own record" ON medicos
FOR INSERT WITH CHECK (user_auth = auth.uid());

-- 6. Remover políticas antigas da tabela consultations
DROP POLICY IF EXISTS "Doctors can view own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can insert own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can delete own consultations" ON consultations;

-- 7. Criar novas políticas RLS para consultations usando medicos
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

-- 8. Remover políticas antigas da tabela patients
DROP POLICY IF EXISTS "Doctors can view own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can insert own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can update own patients" ON patients;
DROP POLICY IF EXISTS "Doctors can delete own patients" ON patients;

-- 9. Criar novas políticas RLS para patients usando medicos
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

-- 10. Migrar dados de users para medicos (apenas se necessário)
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

-- 11. Atualizar patients para usar IDs de medicos em vez de users
-- (Apenas se patients.doctor_id estiver referenciando users.id em vez de medicos.id)
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
);

-- 12. Atualizar consultations para usar IDs de medicos em vez de users
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
);

-- Comentário final
COMMENT ON TABLE medicos IS 'Tabela de médicos criada para corrigir RLS - execute este script no Supabase para resolver erro de criação de consultas';
