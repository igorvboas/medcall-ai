-- =============================================
-- Migration: Criar tabela recordings para armazenar metadados de gravações
-- Data: 2025-12-15
-- =============================================

-- Tabela para armazenar metadados das gravações de consultas
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    room_id VARCHAR(255),
    
    -- Informações do arquivo
    file_path TEXT NOT NULL,
    file_url TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    mime_type VARCHAR(50) DEFAULT 'video/webm',
    
    -- Status da gravação
    status VARCHAR(20) NOT NULL DEFAULT 'recording' 
        CHECK (status IN ('recording', 'processing', 'completed', 'error')),
    
    -- Metadados adicionais
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_consultation_id ON recordings(consultation_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);

-- Adicionar coluna recording_url na tabela call_sessions (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'call_sessions' AND column_name = 'recording_url'
    ) THEN
        ALTER TABLE call_sessions ADD COLUMN recording_url TEXT;
    END IF;
END $$;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recordings_updated_at ON recordings;
CREATE TRIGGER trigger_recordings_updated_at
    BEFORE UPDATE ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_recordings_updated_at();

-- RLS (Row Level Security) - Opcional, ajuste conforme necessário
-- ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Comentários na tabela
COMMENT ON TABLE recordings IS 'Armazena metadados das gravações de consultas médicas';
COMMENT ON COLUMN recordings.file_path IS 'Caminho do arquivo no Supabase Storage (bucket: consultas)';
COMMENT ON COLUMN recordings.file_url IS 'URL pública ou assinada para acesso ao arquivo';
COMMENT ON COLUMN recordings.duration_seconds IS 'Duração da gravação em segundos';
COMMENT ON COLUMN recordings.status IS 'Status: recording (gravando), processing (processando), completed (concluída), error (erro)';

