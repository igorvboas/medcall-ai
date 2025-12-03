-- =====================================================
-- MEDCALL AI - SCHEMA ADICIONAL PARA IA EM TEMPO REAL
-- =====================================================
-- Este script adiciona as tabelas necessárias para o MedCall AI
-- Mantém compatibilidade com o schema TRIA APP existente

-- Habilitar extensões necessárias para IA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- Para embeddings e RAG

-- =====================================================
-- TABELA DE SESSÕES DE CALL EM TEMPO REAL
-- =====================================================
CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relacionamento com consulta existente (opcional)
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    
    -- Tipo de sessão
    session_type VARCHAR(20) DEFAULT 'online' CHECK (session_type IN ('presencial', 'online')),
    
    -- Participantes da call
    participants JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Metadados da sessão
    room_name VARCHAR(255),
    room_id VARCHAR(255),
    
    -- Controle de estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'error')),
    consent BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadados adicionais
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- TABELA DE UTTERANCES (FALAS EM TEMPO REAL)
-- =====================================================
CREATE TABLE IF NOT EXISTS utterances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    
    -- Identificação do falante
    speaker VARCHAR(50) NOT NULL CHECK (speaker IN ('doctor', 'patient', 'system')),
    speaker_id VARCHAR(255),
    
    -- Conteúdo da fala
    text TEXT NOT NULL,
    is_final BOOLEAN DEFAULT false,
    
    -- Timing
    start_ms INTEGER NOT NULL,
    end_ms INTEGER,
    
    -- Metadados de qualidade
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Processamento
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE SUGESTÕES DA IA
-- =====================================================
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    
    -- Referência à utterance que gerou a sugestão (opcional)
    utterance_id UUID REFERENCES utterances(id) ON DELETE SET NULL,
    
    -- Tipo e conteúdo da sugestão
    type VARCHAR(50) NOT NULL CHECK (type IN ('question', 'insight', 'warning', 'protocol', 'next_steps', 'followup')),
    content TEXT NOT NULL,
    
    -- Fonte da sugestão
    source VARCHAR(255), -- Ex: "Manual DSM-5", "Protocolo Ansiedade"
    source_section VARCHAR(255), -- Ex: "Seção 3.1"
    
    -- Metadados de relevância
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Status de uso
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by VARCHAR(255),
    
    -- RAG context (se aplicável)
    rag_context JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA PARA KNOWLEDGE BASE (RAG)
-- =====================================================
CREATE TABLE IF NOT EXISTS kb_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    section VARCHAR(255),
    source VARCHAR(255) NOT NULL,
    
    -- Categoria médica
    specialty VARCHAR(100), -- Ex: "psiquiatria", "clinica_geral"
    category VARCHAR(100), -- Ex: "triagem", "diagnostico", "tratamento"
    subcategory VARCHAR(100), -- Ex: "ansiedade", "depressao"
    
    -- Metadados
    author VARCHAR(255),
    version VARCHAR(50),
    publication_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    
    -- Conteúdo do chunk
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    
    -- Embedding para busca semântica
    embedding vector(1536), -- OpenAI text-embedding-3-small
    
    -- Metadados do chunk
    start_char INTEGER,
    end_char INTEGER,
    token_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE CONTEXTO DE CONVERSA (SLIDING WINDOW)
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    
    -- Janela de contexto
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Resumo da janela
    summary TEXT,
    key_topics TEXT[],
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    
    -- Tópicos identificados
    topics JSONB DEFAULT '{}'::jsonb,
    
    -- Status de análise
    analysis_status VARCHAR(20) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'error')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para call_sessions
CREATE INDEX IF NOT EXISTS idx_call_sessions_consultation_id ON call_sessions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON call_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_room_name ON call_sessions(room_name);
CREATE INDEX IF NOT EXISTS idx_call_sessions_session_type ON call_sessions(session_type);

-- Índices para utterances
CREATE INDEX IF NOT EXISTS idx_utterances_session_id ON utterances(session_id);
CREATE INDEX IF NOT EXISTS idx_utterances_speaker ON utterances(speaker);
CREATE INDEX IF NOT EXISTS idx_utterances_is_final ON utterances(is_final);
CREATE INDEX IF NOT EXISTS idx_utterances_created_at ON utterances(created_at);
CREATE INDEX IF NOT EXISTS idx_utterances_timing ON utterances(start_ms, end_ms);

-- Índices para suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_session_id ON suggestions(session_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_utterance_id ON suggestions(utterance_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON suggestions(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_used ON suggestions(used);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at);

-- Índices para KB
CREATE INDEX IF NOT EXISTS idx_kb_documents_specialty ON kb_documents(specialty);
CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON kb_documents(category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_is_active ON kb_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id ON kb_chunks(document_id);

-- Índice para busca de embeddings (HNSW para performance)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kb_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índices para conversation_context
CREATE INDEX IF NOT EXISTS idx_conversation_context_session_id ON conversation_context(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_window ON conversation_context(window_start, window_end);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Usar a função update_updated_at_column já existente
CREATE TRIGGER update_call_sessions_updated_at 
    BEFORE UPDATE ON call_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_documents_updated_at 
    BEFORE UPDATE ON kb_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

-- Políticas para call_sessions
CREATE POLICY "Users can view sessions from their consultations" ON call_sessions 
FOR SELECT USING (
    consultation_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = call_sessions.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

CREATE POLICY "Users can insert sessions for their consultations" ON call_sessions 
FOR INSERT WITH CHECK (
    consultation_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = call_sessions.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

CREATE POLICY "Users can update their sessions" ON call_sessions 
FOR UPDATE USING (
    consultation_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = call_sessions.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

-- Políticas para utterances (via call_sessions)
CREATE POLICY "Users can view utterances from their sessions" ON utterances 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = utterances.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

CREATE POLICY "Users can insert utterances in their sessions" ON utterances 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = utterances.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

-- Políticas para suggestions (via call_sessions)
CREATE POLICY "Users can view suggestions from their sessions" ON suggestions 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = suggestions.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

CREATE POLICY "Users can insert suggestions in their sessions" ON suggestions 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = suggestions.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

CREATE POLICY "Users can update suggestions in their sessions" ON suggestions 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = suggestions.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

-- Políticas para KB (todo mundo pode ler, apenas admins podem escrever)
CREATE POLICY "Everyone can read active KB documents" ON kb_documents 
FOR SELECT USING (is_active = true);

CREATE POLICY "Everyone can read KB chunks" ON kb_chunks 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM kb_documents 
        WHERE kb_documents.id = kb_chunks.document_id 
        AND kb_documents.is_active = true
    )
);

-- Políticas para conversation_context (via call_sessions)
CREATE POLICY "Users can view context from their sessions" ON conversation_context 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM call_sessions cs
        LEFT JOIN consultations c ON cs.consultation_id = c.id
        WHERE cs.id = conversation_context.session_id 
        AND (cs.consultation_id IS NULL OR c.doctor_id::text = auth.uid()::text)
    )
);

-- =====================================================
-- FUNÇÕES ÚTEIS PARA IA
-- =====================================================

-- Função para buscar chunks similares (RAG)
CREATE OR REPLACE FUNCTION match_kb_chunks(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_specialty text DEFAULT NULL,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    similarity float,
    title text,
    source text,
    section text,
    specialty text,
    category text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.document_id,
        kc.content,
        (1 - (kc.embedding <=> query_embedding)) as similarity,
        kd.title,
        kd.source,
        kd.section,
        kd.specialty,
        kd.category
    FROM kb_chunks kc
    JOIN kb_documents kd ON kc.document_id = kd.id
    WHERE 
        kd.is_active = true
        AND (1 - (kc.embedding <=> query_embedding)) > similarity_threshold
        AND (filter_specialty IS NULL OR kd.specialty = filter_specialty)
        AND (filter_category IS NULL OR kd.category = filter_category)
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Função para obter estatísticas de sessão
CREATE OR REPLACE FUNCTION get_session_stats(session_uuid UUID)
RETURNS TABLE(
    total_utterances BIGINT,
    doctor_utterances BIGINT,
    patient_utterances BIGINT,
    total_suggestions BIGINT,
    used_suggestions BIGINT,
    session_duration_seconds INTEGER,
    avg_confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(u.id)::BIGINT as total_utterances,
        COUNT(CASE WHEN u.speaker = 'doctor' THEN 1 END)::BIGINT as doctor_utterances,
        COUNT(CASE WHEN u.speaker = 'patient' THEN 1 END)::BIGINT as patient_utterances,
        COUNT(s.id)::BIGINT as total_suggestions,
        COUNT(CASE WHEN s.used = true THEN 1 END)::BIGINT as used_suggestions,
        EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at))::INTEGER as session_duration_seconds,
        AVG(u.confidence) as avg_confidence
    FROM call_sessions cs
    LEFT JOIN utterances u ON cs.id = u.session_id
    LEFT JOIN suggestions s ON cs.id = s.session_id
    WHERE cs.id = session_uuid
    GROUP BY cs.id, cs.started_at, cs.ended_at;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS ÚTEIS PARA RELATÓRIOS
-- =====================================================

-- View para resumo de sessões
CREATE OR REPLACE VIEW session_summary AS
SELECT 
    cs.id,
    cs.consultation_id,
    cs.participants,
    cs.status,
    cs.started_at,
    cs.ended_at,
    EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at))::INTEGER as duration_seconds,
    COUNT(u.id) as total_utterances,
    COUNT(s.id) as total_suggestions,
    COUNT(CASE WHEN s.used = true THEN 1 END) as used_suggestions,
    AVG(u.confidence) as avg_confidence
FROM call_sessions cs
LEFT JOIN utterances u ON cs.id = u.session_id AND u.is_final = true
LEFT JOIN suggestions s ON cs.id = s.session_id
GROUP BY cs.id, cs.consultation_id, cs.participants, cs.status, cs.started_at, cs.ended_at;

-- =====================================================
-- DADOS INICIAIS PARA TESTE
-- =====================================================

-- Inserir alguns documentos de exemplo no KB
INSERT INTO kb_documents (id, title, source, specialty, category, subcategory, is_active) VALUES 
(
    uuid_generate_v4(),
    'Protocolo de Triagem - Transtornos de Ansiedade',
    'Manual de Procedimentos Clínicos',
    'psiquiatria',
    'triagem',
    'ansiedade',
    true
),
(
    uuid_generate_v4(),
    'Perguntas Padronizadas - Avaliação do Humor',
    'Guia de Consulta Psiquiátrica',
    'psiquiatria',
    'avaliacao',
    'humor',
    true
),
(
    uuid_generate_v4(),
    'Protocolo de Triagem - Clínica Geral',
    'Manual de Procedimentos Clínicos',
    'clinica_geral',
    'triagem',
    'geral',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Comentário final
COMMENT ON TABLE call_sessions IS 'Sessões de videochamada em tempo real com IA';
COMMENT ON TABLE utterances IS 'Falas transcritas em tempo real durante as calls';
COMMENT ON TABLE suggestions IS 'Sugestões geradas pela IA durante as calls';
COMMENT ON TABLE kb_documents IS 'Documentos da base de conhecimento médico';
COMMENT ON TABLE kb_chunks IS 'Chunks de texto com embeddings para RAG';
COMMENT ON TABLE conversation_context IS 'Contexto resumido de janelas de conversa';