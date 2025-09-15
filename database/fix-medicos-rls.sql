-- Política RLS para tabela medicos
-- Permite que usuários acessem apenas seus próprios dados

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can insert themselves" ON medicos;
DROP POLICY IF EXISTS "Users can update own data" ON medicos;
DROP POLICY IF EXISTS "Users can update own profile" ON medicos;
DROP POLICY IF EXISTS "Users can view own data" ON medicos;
DROP POLICY IF EXISTS "Users can view own profile" ON medicos;

-- Criar novas políticas RLS para medicos
CREATE POLICY "Medicos can view own record" ON medicos
FOR SELECT USING (user_auth = auth.uid());

CREATE POLICY "Medicos can update own record" ON medicos
FOR UPDATE USING (user_auth = auth.uid());

CREATE POLICY "Medicos can insert own record" ON medicos
FOR INSERT WITH CHECK (user_auth = auth.uid());

-- Verificar se RLS está habilitado
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE medicos IS 'Tabela de médicos com RLS baseado em user_auth = auth.uid()';
