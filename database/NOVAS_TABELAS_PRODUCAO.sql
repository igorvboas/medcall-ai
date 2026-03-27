-- =============================================
-- NOVAS TABELAS - RODAR NO BANCO DE PRODUCAO
-- Criadas durante desenvolvimento no homolog
-- Data: 2026-03-23
-- =============================================
-- INSTRUCOES:
-- 1. Abra o SQL Editor do Supabase de PRODUCAO
-- 2. Cole TODO o conteudo deste arquivo
-- 3. Execute
-- 4. Verifique que as 5 tabelas foram criadas
-- =============================================


-- =============================================
-- 015: Cadastro Tables
-- Alimentos, Refeicoes, Treinos, Suplementos
-- =============================================

-- 1. Alimentos individuais (ex: "Frango grelhado 150g")
CREATE TABLE IF NOT EXISTS cadastro_alimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  porcao TEXT,
  calorias INTEGER,
  proteinas NUMERIC(6,1),
  carboidratos NUMERIC(6,1),
  gorduras NUMERIC(6,1),
  fibras NUMERIC(6,1),
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Refeicoes completas (ex: "Cafe da manha proteico")
-- Compostas por alimentos da tabela cadastro_alimentos
CREATE TABLE IF NOT EXISTS cadastro_refeicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Relacao N:N entre refeicoes e alimentos
-- Permite montar refeicoes com alimentos cadastrados
CREATE TABLE IF NOT EXISTS cadastro_refeicao_alimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refeicao_id UUID NOT NULL REFERENCES cadastro_refeicoes(id) ON DELETE CASCADE,
  alimento_id UUID NOT NULL REFERENCES cadastro_alimentos(id) ON DELETE CASCADE,
  porcao_customizada TEXT,
  ordem INTEGER DEFAULT 0,
  observacao TEXT
);

-- 4. Exercicios / Treinos individuais
CREATE TABLE IF NOT EXISTS cadastro_treinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  grupo_muscular TEXT,
  series INTEGER,
  repeticoes TEXT,
  descanso TEXT,
  equipamento TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Suplementos UNIFICADO
-- tipo: 'suplemento', 'fitoterapico', 'homeopatia', 'floral_bach'
CREATE TABLE IF NOT EXISTS cadastro_suplementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'suplemento',
  categoria TEXT,
  descricao TEXT,
  dosagem TEXT,
  horario TEXT,
  objetivo TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_cadastro_alimentos_doctor ON cadastro_alimentos(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_alimentos_favorito ON cadastro_alimentos(doctor_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS idx_cadastro_refeicoes_doctor ON cadastro_refeicoes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_refeicoes_favorito ON cadastro_refeicoes(doctor_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS idx_cadastro_refeicao_alimentos_refeicao ON cadastro_refeicao_alimentos(refeicao_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_refeicao_alimentos_alimento ON cadastro_refeicao_alimentos(alimento_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_treinos_doctor ON cadastro_treinos(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_treinos_favorito ON cadastro_treinos(doctor_id, favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS idx_cadastro_suplementos_doctor ON cadastro_suplementos(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_suplementos_tipo ON cadastro_suplementos(doctor_id, tipo);
CREATE INDEX IF NOT EXISTS idx_cadastro_suplementos_favorito ON cadastro_suplementos(doctor_id, favorito) WHERE favorito = true;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE cadastro_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_refeicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_refeicao_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_treinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_suplementos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUTO-UPDATE updated_at TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_cadastro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cadastro_alimentos_updated') THEN
    CREATE TRIGGER trg_cadastro_alimentos_updated BEFORE UPDATE ON cadastro_alimentos FOR EACH ROW EXECUTE FUNCTION update_cadastro_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cadastro_refeicoes_updated') THEN
    CREATE TRIGGER trg_cadastro_refeicoes_updated BEFORE UPDATE ON cadastro_refeicoes FOR EACH ROW EXECUTE FUNCTION update_cadastro_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cadastro_treinos_updated') THEN
    CREATE TRIGGER trg_cadastro_treinos_updated BEFORE UPDATE ON cadastro_treinos FOR EACH ROW EXECUTE FUNCTION update_cadastro_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cadastro_suplementos_updated') THEN
    CREATE TRIGGER trg_cadastro_suplementos_updated BEFORE UPDATE ON cadastro_suplementos FOR EACH ROW EXECUTE FUNCTION update_cadastro_updated_at();
  END IF;
END $$;


-- =============================================
-- ALTERACOES EM TABELAS EXISTENTES
-- =============================================

-- Reestruturar a_cadastro_anamnese para suportar multiplas anamneses por paciente
-- Antes: paciente_id era PRIMARY KEY (1 anamnese por paciente)
-- Depois: id UUID como PK, consulta_id para vincular a consulta especifica
-- IMPORTANTE: rodar na ordem exata

-- 1. Adicionar coluna id UUID
ALTER TABLE a_cadastro_anamnese ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 2. Adicionar coluna consulta_id
ALTER TABLE a_cadastro_anamnese ADD COLUMN IF NOT EXISTS consulta_id UUID;

-- 3. Remover a PK antiga (paciente_id)
ALTER TABLE a_cadastro_anamnese DROP CONSTRAINT IF EXISTS a_cadastro_anamnese_pkey;

-- 4. Criar nova PK com id
ALTER TABLE a_cadastro_anamnese ADD PRIMARY KEY (id);

-- 5. Index para buscar anamneses por paciente e consulta
CREATE INDEX IF NOT EXISTS idx_anamnese_paciente ON a_cadastro_anamnese(paciente_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_consulta ON a_cadastro_anamnese(consulta_id);

-- Expandir s_refeicao de 4 para 10 refeicoes
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_5 jsonb NULL;
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_6 jsonb NULL;
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_7 jsonb NULL;
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_8 jsonb NULL;
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_9 jsonb NULL;
ALTER TABLE s_refeicao ADD COLUMN IF NOT EXISTS ref_10 jsonb NULL;


-- =============================================
-- TABELAS CRIADAS PELO DEV (estrutura separada)
-- Exercicios, Fitoterapicos, Prescricoes
-- =============================================

-- Catalogo global de exercicios
CREATE TABLE IF NOT EXISTS cadastro_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  grupo_muscular TEXT,
  descricao TEXT,
  url_tutorial TEXT,
  equipamento TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogo global de fitoterapicos
CREATE TABLE IF NOT EXISTS cadastro_fitoterapicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT,
  descricao TEXT,
  objetivo TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescricoes de suplementos (por medico)
CREATE TABLE IF NOT EXISTS cadastro_suplemento_prescricao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  suplemento_id UUID REFERENCES cadastro_suplementos(id) ON DELETE CASCADE,
  dosagem TEXT,
  horarios JSONB DEFAULT '[]'::jsonb,
  descricao TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescricoes de fitoterapicos (por medico)
CREATE TABLE IF NOT EXISTS cadastro_fitoterapico_prescricao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  fitoterapico_id UUID REFERENCES cadastro_fitoterapicos(id) ON DELETE CASCADE,
  dosagem TEXT,
  horarios JSONB DEFAULT '[]'::jsonb,
  descricao TEXT,
  favorito BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relacao treino <-> exercicios
CREATE TABLE IF NOT EXISTS cadastro_treino_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id UUID REFERENCES cadastro_treinos(id) ON DELETE CASCADE,
  exercicio_id UUID REFERENCES cadastro_exercicios(id) ON DELETE CASCADE,
  series INTEGER,
  repeticoes TEXT,
  descanso TEXT,
  observacao TEXT,
  ordem INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES para novas tabelas
CREATE INDEX IF NOT EXISTS idx_cadastro_exercicios_grupo ON cadastro_exercicios(grupo_muscular);
CREATE INDEX IF NOT EXISTS idx_cadastro_supl_prescricao_doctor ON cadastro_suplemento_prescricao(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_fito_prescricao_doctor ON cadastro_fitoterapico_prescricao(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cadastro_treino_exercicios_treino ON cadastro_treino_exercicios(treino_id);

-- =============================================
-- NOVAS TABELAS ADICIONADAS DEPOIS
-- (este bloco sera atualizado conforme novas tabelas forem criadas)
-- =============================================
