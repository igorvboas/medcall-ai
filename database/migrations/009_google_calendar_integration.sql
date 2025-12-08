-- =====================================================
-- Migration 009: Integração com Google Calendar
-- =====================================================
-- Esta migration adiciona as estruturas necessárias para
-- sincronização bidirecional com o Google Calendar

-- =====================================================
-- TABELA: google_calendar_tokens
-- Armazena tokens OAuth do Google Calendar por médico
-- =====================================================
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relacionamento com médico (1:1)
    medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
    
    -- Tokens OAuth (devem ser criptografados na aplicação)
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Calendário selecionado pelo médico
    calendar_id VARCHAR(255),
    calendar_name VARCHAR(255),
    
    -- Controle de sincronização
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados
    google_email VARCHAR(255), -- Email da conta Google conectada
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Cada médico só pode ter uma integração
    CONSTRAINT unique_medico_google_calendar UNIQUE (medico_id)
);

-- Índices para google_calendar_tokens
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_medico_id ON google_calendar_tokens(medico_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_sync_enabled ON google_calendar_tokens(sync_enabled);

-- Comentários
COMMENT ON TABLE google_calendar_tokens IS 'Armazena tokens OAuth do Google Calendar para cada médico';
COMMENT ON COLUMN google_calendar_tokens.access_token IS 'Token de acesso OAuth (criptografado na aplicação)';
COMMENT ON COLUMN google_calendar_tokens.refresh_token IS 'Token para renovar access_token (criptografado na aplicação)';
COMMENT ON COLUMN google_calendar_tokens.calendar_id IS 'ID do calendário Google selecionado para sincronização';
COMMENT ON COLUMN google_calendar_tokens.google_email IS 'Email da conta Google conectada';

-- =====================================================
-- ALTERAÇÕES NA TABELA consultations
-- Adiciona campos para rastrear sincronização
-- =====================================================

-- Campo para armazenar o ID do evento no Google Calendar
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);

-- Campo para armazenar o ID do calendário onde está o evento
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);

-- Status de sincronização
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'local_only' 
CHECK (sync_status IN ('synced', 'pending', 'error', 'local_only'));

-- Última sincronização do evento
ALTER TABLE consultations 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_consultations_google_event_id ON consultations(google_event_id);
CREATE INDEX IF NOT EXISTS idx_consultations_sync_status ON consultations(sync_status);

-- Comentários nos novos campos
COMMENT ON COLUMN consultations.google_event_id IS 'ID do evento correspondente no Google Calendar';
COMMENT ON COLUMN consultations.google_calendar_id IS 'ID do calendário Google onde o evento foi criado';
COMMENT ON COLUMN consultations.sync_status IS 'Status de sincronização: synced, pending, error, local_only';
COMMENT ON COLUMN consultations.last_synced_at IS 'Timestamp da última sincronização com Google Calendar';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS na nova tabela
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Médicos só podem ver/gerenciar seus próprios tokens
CREATE POLICY "Medicos can view own google calendar tokens" ON google_calendar_tokens
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = google_calendar_tokens.medico_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Medicos can insert own google calendar tokens" ON google_calendar_tokens
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = google_calendar_tokens.medico_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Medicos can update own google calendar tokens" ON google_calendar_tokens
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = google_calendar_tokens.medico_id 
        AND medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Medicos can delete own google calendar tokens" ON google_calendar_tokens
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.id = google_calendar_tokens.medico_id 
        AND medicos.user_auth = auth.uid()
    )
);

-- =====================================================
-- TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE TRIGGER update_google_calendar_tokens_updated_at 
    BEFORE UPDATE ON google_calendar_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNÇÃO AUXILIAR: Buscar token válido do médico
-- =====================================================

CREATE OR REPLACE FUNCTION get_medico_google_calendar_token(medico_uuid UUID)
RETURNS TABLE(
    token_id UUID,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    calendar_id VARCHAR,
    is_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gct.id,
        gct.access_token,
        gct.refresh_token,
        gct.token_expiry,
        gct.calendar_id,
        (gct.token_expiry < NOW()) as is_expired
    FROM google_calendar_tokens gct
    WHERE gct.medico_id = medico_uuid
    AND gct.sync_enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO AUXILIAR: Buscar consultas pendentes de sync
-- =====================================================

CREATE OR REPLACE FUNCTION get_consultations_pending_sync(medico_uuid UUID)
RETURNS TABLE(
    consultation_id UUID,
    patient_name VARCHAR,
    consultation_type VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    sync_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.patient_name,
        c.consultation_type,
        c.created_at,
        c.duration,
        c.sync_status
    FROM consultations c
    WHERE c.doctor_id = medico_uuid
    AND c.sync_status IN ('pending', 'error')
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTÁRIO FINAL
-- =====================================================

/*
ESTRUTURA CRIADA:

1. ✅ TABELA google_calendar_tokens:
   - Armazena tokens OAuth por médico
   - Relacionamento 1:1 com medicos
   - RLS configurado

2. ✅ CAMPOS em consultations:
   - google_event_id: ID do evento no Google
   - google_calendar_id: ID do calendário
   - sync_status: Status da sincronização
   - last_synced_at: Timestamp da última sync

3. ✅ FUNÇÕES auxiliares:
   - get_medico_google_calendar_token(): Busca token do médico
   - get_consultations_pending_sync(): Lista consultas pendentes

PRÓXIMOS PASSOS:
1. Executar esta migration no Supabase
2. Implementar criptografia de tokens na aplicação
3. Criar endpoints de OAuth
4. Implementar serviço de sincronização
*/
