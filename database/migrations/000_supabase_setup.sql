-- =====================================================
-- CONFIGURAÇÃO COMPLETA DO SUPABASE PARA TRIA APP
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELA DE USUÁRIOS (MÉDICOS)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    birth_date DATE,
    is_doctor BOOLEAN DEFAULT false,
    specialty VARCHAR(100),
    crm VARCHAR(20),
    subscription_type VARCHAR(20) DEFAULT 'FREE' CHECK (subscription_type IN ('FREE', 'PRO', 'ENTERPRISE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE PACIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(2),
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('M', 'F', 'O')),
    cpf VARCHAR(14) UNIQUE,
    address TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE CONSULTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL, -- Mantido para compatibilidade
    patient_context TEXT,
    consultation_type VARCHAR(20) NOT NULL CHECK (consultation_type IN ('PRESENCIAL', 'TELEMEDICINA')),
    status VARCHAR(20) DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'RECORDING', 'PROCESSING', 'COMPLETED', 'ERROR', 'CANCELLED')),
    duration INTEGER, -- Duração em segundos
    recording_url TEXT,
    notes TEXT,
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    next_appointment DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE TRANSCRIÇÕES
-- =====================================================
CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    summary TEXT,
    key_points TEXT[],
    diagnosis TEXT,
    treatment TEXT,
    observations TEXT,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    processing_time DECIMAL(5,2), -- Tempo em segundos
    language VARCHAR(10) DEFAULT 'pt-BR',
    model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE ARQUIVOS DE ÁUDIO
-- =====================================================
CREATE TABLE IF NOT EXISTS audio_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL, -- Tamanho em bytes
    duration INTEGER, -- Duração em segundos
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'audio-files',
    is_processed BOOLEAN DEFAULT false,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE DOCUMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SUMMARY', 'PRESCRIPTION', 'REPORT', 'NOTES', 'CUSTOM')),
    format VARCHAR(20) DEFAULT 'text',
    storage_path TEXT,
    storage_bucket VARCHAR(100) DEFAULT 'documents',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SUMMARY', 'PRESCRIPTION', 'REPORT', 'NOTES', 'CUSTOM')),
    is_public BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_name ON consultations(patient_name);

-- Índices para transcrições
CREATE INDEX IF NOT EXISTS idx_transcriptions_consultation_id ON transcriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at);

-- Índices para arquivos de áudio
CREATE INDEX IF NOT EXISTS idx_audio_files_consultation_id ON audio_files(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_uploaded_at ON audio_files(uploaded_at);

-- Índices para pacientes
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários (cada usuário vê apenas seus próprios dados)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Políticas para pacientes (médicos veem apenas seus pacientes) (APAGUEI ESSAS RLS PARA TESTAR VOLTAR DEPOIS)
CREATE POLICY "Doctors can view own patients" ON patients FOR SELECT USING (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can insert own patients" ON patients FOR INSERT WITH CHECK (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can update own patients" ON patients FOR UPDATE USING (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can delete own patients" ON patients FOR DELETE USING (doctor_id::text = auth.uid()::text);

-- Políticas para consultas (médicos veem apenas suas consultas)
CREATE POLICY "Doctors can view own consultations" ON consultations FOR SELECT USING (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can insert own consultations" ON consultations FOR INSERT WITH CHECK (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can update own consultations" ON consultations FOR UPDATE USING (doctor_id::text = auth.uid()::text);
CREATE POLICY "Doctors can delete own consultations" ON consultations FOR DELETE USING (doctor_id::text = auth.uid()::text);

-- Políticas para transcrições (médicos veem apenas transcrições de suas consultas)
CREATE POLICY "Doctors can view own transcriptions" ON transcriptions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = transcriptions.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);
CREATE POLICY "Doctors can insert own transcriptions" ON transcriptions FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = transcriptions.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

-- Políticas para arquivos de áudio (médicos veem apenas arquivos de suas consultas)
CREATE POLICY "Doctors can view own audio files" ON audio_files FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = audio_files.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);
CREATE POLICY "Doctors can insert own audio files" ON audio_files FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = audio_files.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

-- Políticas para documentos (médicos veem apenas documentos de suas consultas)
CREATE POLICY "Doctors can view own documents" ON documents FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = documents.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);
CREATE POLICY "Doctors can insert own documents" ON documents FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM consultations 
        WHERE consultations.id = documents.consultation_id 
        AND consultations.doctor_id::text = auth.uid()::text
    )
);

-- Políticas para templates (médicos veem apenas seus templates + templates públicos)
CREATE POLICY "Users can view own templates" ON templates FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users can view public templates" ON templates FOR SELECT USING (is_public = true);
CREATE POLICY "Users can insert own templates" ON templates FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (user_id::text = auth.uid()::text);

-- =====================================================
-- DADOS INICIAIS DE EXEMPLO
-- =====================================================

-- Inserir usuário médico de exemplo
INSERT INTO users (id, email, name, phone, is_doctor, specialty, crm, subscription_type) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'medico@tria.com', 'Dr. Felipe Porto', '(11) 99999-9999', true, 'Clínico Geral', '12345-SP', 'PRO')
ON CONFLICT (id) DO NOTHING;

-- Inserir pacientes de exemplo
INSERT INTO patients (id, doctor_id, name, email, phone, city, state, status) VALUES 
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Marcos Paulo', 'marcos.paulo@triacompaby.com.br', '1232939293', 'Goiânia', 'GO', 'active'),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Jeferson', 'jeferson@triacompany.com.br', '11999999999', 'São Paulo', 'SP', 'active')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- CONFIGURAÇÃO DO STORAGE
-- =====================================================

-- Criar buckets para armazenamento
-- NOTA: Execute estes comandos no painel do Supabase Storage

-- Bucket para arquivos de áudio
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', false);

-- Bucket para documentos
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para estatísticas de consultas por médico
CREATE OR REPLACE VIEW consultation_stats AS
SELECT 
    u.id as doctor_id,
    u.name as doctor_name,
    COUNT(c.id) as total_consultations,
    COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END) as completed_consultations,
    COUNT(CASE WHEN c.status = 'RECORDING' THEN 1 END) as recording_consultations,
    AVG(c.duration) as avg_duration,
    COUNT(t.id) as total_transcriptions,
    COUNT(af.id) as total_audio_files
FROM users u
LEFT JOIN consultations c ON u.id = c.doctor_id
LEFT JOIN transcriptions t ON c.id = t.consultation_id
LEFT JOIN audio_files af ON c.id = af.consultation_id
WHERE u.is_doctor = true
GROUP BY u.id, u.name;

-- View para histórico completo do paciente
CREATE OR REPLACE VIEW patient_history AS
SELECT 
    p.id as patient_id,
    p.name as patient_name,
    p.email as patient_email,
    p.phone as patient_phone,
    c.id as consultation_id,
    c.consultation_type,
    c.status,
    c.duration,
    c.created_at as consultation_date,
    c.patient_context,
    t.raw_text as transcription_text,
    t.summary as transcription_summary,
    t.confidence,
    af.filename as audio_filename,
    af.size as audio_size,
    af.duration as audio_duration
FROM patients p
LEFT JOIN consultations c ON p.id = c.patient_id
LEFT JOIN transcriptions t ON c.id = t.consultation_id
LEFT JOIN audio_files af ON c.id = af.consultation_id
ORDER BY p.name, c.created_at DESC;

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para buscar estatísticas de um paciente
CREATE OR REPLACE FUNCTION get_patient_stats(patient_uuid UUID)
RETURNS TABLE(
    total_consultations BIGINT,
    completed_consultations BIGINT,
    total_duration BIGINT,
    total_transcriptions BIGINT,
    total_audio_files BIGINT,
    last_consultation_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(c.id)::BIGINT,
        COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END)::BIGINT,
        COALESCE(SUM(c.duration), 0)::BIGINT,
        COUNT(t.id)::BIGINT,
        COUNT(af.id)::BIGINT,
        MAX(c.created_at)
    FROM patients p
    LEFT JOIN consultations c ON p.id = c.patient_id
    LEFT JOIN transcriptions t ON c.id = t.consultation_id
    LEFT JOIN audio_files af ON c.id = af.consultation_id
    WHERE p.id = patient_uuid
    GROUP BY p.id;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar consultas de um paciente
CREATE OR REPLACE FUNCTION get_patient_consultations(patient_uuid UUID)
RETURNS TABLE(
    consultation_id UUID,
    consultation_type VARCHAR(20),
    status VARCHAR(20),
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    patient_context TEXT,
    has_transcription BOOLEAN,
    has_audio BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.consultation_type,
        c.status,
        c.duration,
        c.created_at,
        c.patient_context,
        (EXISTS(SELECT 1 FROM transcriptions t WHERE t.consultation_id = c.id)),
        (EXISTS(SELECT 1 FROM audio_files af WHERE af.consultation_id = c.id))
    FROM consultations c
    WHERE c.patient_id = patient_uuid
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

/*
ESTRUTURA COMPLETA IMPLEMENTADA:

1. ✅ TABELAS PRINCIPAIS:
   - users (médicos)
   - patients (pacientes)
   - consultations (consultas)
   - transcriptions (transcrições)
   - audio_files (arquivos de áudio)
   - documents (documentos)
   - templates (templates)

2. ✅ RELACIONAMENTOS:
   - Médicos têm pacientes
   - Consultas pertencem a médicos e pacientes
   - Transcrições e áudios pertencem a consultas
   - Documentos pertencem a consultas

3. ✅ SEGURANÇA:
   - RLS habilitado em todas as tabelas
   - Políticas de acesso por usuário
   - Médicos veem apenas seus dados

4. ✅ PERFORMANCE:
   - Índices nas colunas mais consultadas
   - Views para consultas complexas
   - Funções para operações comuns

5. ✅ FUNCIONALIDADES:
   - Estatísticas de consultas
   - Histórico completo de pacientes
   - Busca por nome de paciente
   - Controle de status de consultas

PARA USAR:
1. Execute este SQL no Supabase
2. Configure as variáveis de ambiente
3. O sistema funcionará 100% dinâmico
*/
