-- =============================================
-- 015: Cadastro Tables (Alimentos, Refeicoes, Treinos, Suplementos)
-- =============================================

-- 1. Alimentos individuais
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

-- 2. Refeicoes completas
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

-- 3. Relacao refeicao <-> alimentos
CREATE TABLE IF NOT EXISTS cadastro_refeicao_alimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refeicao_id UUID NOT NULL REFERENCES cadastro_refeicoes(id) ON DELETE CASCADE,
  alimento_id UUID NOT NULL REFERENCES cadastro_alimentos(id) ON DELETE CASCADE,
  porcao_customizada TEXT,
  ordem INTEGER DEFAULT 0,
  observacao TEXT
);

-- 4. Treinos / Exercicios
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

-- 5. Suplementos unificado (suplemento, fitoterapico, homeopatia, floral_bach)
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

-- Indexes
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

-- Enable RLS
ALTER TABLE cadastro_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_refeicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_refeicao_alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_treinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_suplementos ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at trigger
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
