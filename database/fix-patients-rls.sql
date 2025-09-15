-- Política RLS para tabela patients
-- Permite que médicos acessem apenas seus próprios pacientes

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can insert themselves" ON patients;
DROP POLICY IF EXISTS "Users can update own data" ON patients;
DROP POLICY IF EXISTS "Users can update own profile" ON patients;
DROP POLICY IF EXISTS "Users can view own data" ON patients;
DROP POLICY IF EXISTS "Users can view own profile" ON patients;

-- Criar novas políticas RLS para patients
-- SELECT: Médicos podem ver apenas seus próprios pacientes
CREATE POLICY "Medicos can view own patients" ON patients
FOR SELECT USING (
  doctor_id IN (
    SELECT id FROM medicos WHERE user_auth = auth.uid()
  )
);

-- INSERT: Médicos podem criar pacientes associados a eles
CREATE POLICY "Medicos can create patients" ON patients
FOR INSERT WITH CHECK (
  doctor_id IN (
    SELECT id FROM medicos WHERE user_auth = auth.uid()
  )
);

-- UPDATE: Médicos podem atualizar apenas seus próprios pacientes
CREATE POLICY "Medicos can update own patients" ON patients
FOR UPDATE USING (
  doctor_id IN (
    SELECT id FROM medicos WHERE user_auth = auth.uid()
  )
);

-- DELETE: Médicos podem deletar apenas seus próprios pacientes
CREATE POLICY "Medicos can delete own patients" ON patients
FOR DELETE USING (
  doctor_id IN (
    SELECT id FROM medicos WHERE user_auth = auth.uid()
  )
);

-- Verificar se RLS está habilitado
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE patients IS 'Tabela de pacientes com RLS baseado em doctor_id vinculado ao médico autenticado';
