-- Tabela de documentos com integração ZapSign
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  url TEXT NOT NULL,
  tipo TEXT DEFAULT 'PDF',
  -- ZapSign fields
  zapsign_doc_token TEXT,
  zapsign_signer_token TEXT,
  zapsign_status TEXT DEFAULT 'pending' CHECK (zapsign_status IN ('pending', 'signed', 'refused', 'link_opened', 'waiting')),
  zapsign_signed_url TEXT,
  zapsign_sign_url TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for doctor queries
CREATE INDEX IF NOT EXISTS idx_documentos_doctor_id ON documentos(doctor_id);
CREATE INDEX IF NOT EXISTS idx_documentos_zapsign_status ON documentos(zapsign_status);

-- RLS
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- Policy: doctors can only see their own documents
CREATE POLICY "Doctors can view own documents"
  ON documentos FOR SELECT
  USING (doctor_id IN (SELECT id FROM medicos WHERE user_auth = auth.uid()));

CREATE POLICY "Doctors can insert own documents"
  ON documentos FOR INSERT
  WITH CHECK (doctor_id IN (SELECT id FROM medicos WHERE user_auth = auth.uid()));

CREATE POLICY "Doctors can update own documents"
  ON documentos FOR UPDATE
  USING (doctor_id IN (SELECT id FROM medicos WHERE user_auth = auth.uid()));

CREATE POLICY "Doctors can delete own documents"
  ON documentos FOR DELETE
  USING (doctor_id IN (SELECT id FROM medicos WHERE user_auth = auth.uid()));
