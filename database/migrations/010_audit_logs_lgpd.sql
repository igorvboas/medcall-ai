-- =====================================================
-- MEDCALL AI - SISTEMA DE LOGS DE AUDITORIA LGPD
-- =====================================================
-- Este script implementa logs detalhados para compliance LGPD
-- Registra: quem acessou, quando, qual informação e contexto
-- Migration: 010_audit_logs_lgpd.sql

-- =====================================================
-- TABELA PRINCIPAL DE LOGS DE AUDITORIA
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- =====================================================
    -- QUEM ACESSOU
    -- =====================================================
    user_id UUID,                                    -- ID do usuário (pode ser null para acessos anônimos/sistema)
    user_email VARCHAR(255),                         -- Email do usuário no momento do acesso
    user_role VARCHAR(50),                           -- Papel do usuário (medico, admin, paciente, sistema)
    user_name VARCHAR(255),                          -- Nome do usuário para referência
    
    -- =====================================================
    -- QUANDO ACESSOU
    -- =====================================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- =====================================================
    -- QUAL INFORMAÇÃO FOI ACESSADA/MODIFICADA
    -- =====================================================
    resource_type VARCHAR(100) NOT NULL,             -- Tipo de recurso: patients, consultations, anamnese, transcriptions, etc.
    resource_id UUID,                                -- ID do recurso específico
    resource_description TEXT,                       -- Descrição legível do recurso (ex: "Paciente João Silva")
    
    -- =====================================================
    -- TIPO DE OPERAÇÃO
    -- =====================================================
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'CREATE',           -- Criação de registro
        'READ',             -- Leitura/Visualização
        'UPDATE',           -- Atualização
        'DELETE',           -- Exclusão
        'EXPORT',           -- Exportação de dados
        'DOWNLOAD',         -- Download de arquivo
        'UPLOAD',           -- Upload de arquivo
        'LOGIN',            -- Login no sistema
        'LOGOUT',           -- Logout do sistema
        'LOGIN_FAILED',     -- Tentativa de login falha
        'PASSWORD_CHANGE',  -- Alteração de senha
        'PERMISSION_CHANGE',-- Alteração de permissões
        'SHARE',            -- Compartilhamento de dados
        'CONSENT_GRANTED',  -- Consentimento concedido
        'CONSENT_REVOKED',  -- Consentimento revogado
        'DATA_REQUEST',     -- Solicitação de dados (direito LGPD)
        'DATA_PORTABILITY', -- Portabilidade de dados (direito LGPD)
        'DATA_ERASURE',     -- Exclusão de dados (direito LGPD)
        'ANONYMIZATION',    -- Anonimização de dados
        'ACCESS_DENIED',    -- Acesso negado
        'BULK_OPERATION',   -- Operação em lote
        'SYSTEM_ACTION'     -- Ação automática do sistema
    )),
    
    -- =====================================================
    -- CONTEXTO DO ACESSO
    -- =====================================================
    ip_address INET,                                 -- Endereço IP do cliente
    user_agent TEXT,                                 -- User-Agent do navegador/app
    session_id VARCHAR(255),                         -- ID da sessão
    request_id VARCHAR(255),                         -- ID único da requisição para rastreamento
    endpoint VARCHAR(500),                           -- Endpoint/rota acessada
    http_method VARCHAR(10),                         -- Método HTTP (GET, POST, etc.)
    
    -- =====================================================
    -- DADOS PARA COMPLIANCE LGPD
    -- =====================================================
    data_category VARCHAR(100),                      -- Categoria do dado: pessoal, sensivel, anonimizado
    legal_basis VARCHAR(100),                        -- Base legal LGPD: consentimento, contrato, obrigacao_legal, etc.
    purpose TEXT,                                    -- Finalidade do tratamento
    data_fields_accessed TEXT[],                     -- Lista de campos acessados
    contains_sensitive_data BOOLEAN DEFAULT false,   -- Indica se envolve dados sensíveis (saúde, biometria, etc.)
    
    -- =====================================================
    -- DADOS ANTES E DEPOIS (PARA MODIFICAÇÕES)
    -- =====================================================
    data_before JSONB,                               -- Estado dos dados antes da modificação
    data_after JSONB,                                -- Estado dos dados após a modificação
    changes_summary TEXT,                            -- Resumo legível das alterações
    
    -- =====================================================
    -- RESULTADO DA OPERAÇÃO
    -- =====================================================
    success BOOLEAN DEFAULT true,                    -- Se a operação foi bem sucedida
    error_code VARCHAR(50),                          -- Código de erro (se falhou)
    error_message TEXT,                              -- Mensagem de erro (se falhou)
    
    -- =====================================================
    -- METADADOS ADICIONAIS
    -- =====================================================
    metadata JSONB DEFAULT '{}'::jsonb,              -- Dados adicionais flexíveis
    
    -- =====================================================
    -- RELACIONAMENTOS (OPCIONAL)
    -- =====================================================
    related_patient_id UUID,                         -- ID do paciente relacionado (para buscas rápidas)
    related_consultation_id UUID,                    -- ID da consulta relacionada
    related_session_id UUID                          -- ID da sessão de call relacionada
);

-- =====================================================
-- TABELA DE SOLICITAÇÕES LGPD (Direitos do Titular)
-- =====================================================
CREATE TABLE IF NOT EXISTS lgpd_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Solicitante
    requester_user_id UUID,
    requester_email VARCHAR(255) NOT NULL,
    requester_name VARCHAR(255),
    requester_cpf VARCHAR(14),                       -- CPF para verificação de identidade
    
    -- Tipo de solicitação
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'ACCESS',           -- Acesso aos dados pessoais
        'CORRECTION',       -- Correção de dados incorretos
        'DELETION',         -- Exclusão de dados
        'PORTABILITY',      -- Portabilidade para outro fornecedor
        'REVOKE_CONSENT',   -- Revogação de consentimento
        'OBJECTION',        -- Objeção ao tratamento
        'INFORMATION'       -- Informações sobre tratamento
    )),
    
    -- Status do processamento
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending',          -- Aguardando processamento
        'in_progress',      -- Em processamento
        'awaiting_verification', -- Aguardando verificação de identidade
        'completed',        -- Concluído
        'rejected',         -- Rejeitado (com justificativa)
        'cancelled'         -- Cancelado pelo solicitante
    )),
    
    -- Detalhes da solicitação
    description TEXT,
    scope TEXT[],                                    -- Quais dados/recursos são afetados
    
    -- Processamento
    assigned_to UUID,                                -- Responsável pelo processamento
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    response TEXT,                                   -- Resposta ao solicitante
    rejection_reason TEXT,                           -- Motivo da rejeição (se aplicável)
    
    -- Arquivos
    attachments JSONB DEFAULT '[]'::jsonb,           -- Documentos anexados
    exported_data_url TEXT,                          -- URL para download dos dados (portabilidade)
    
    -- Prazo legal (LGPD: 15 dias)
    deadline_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA DE CONSENTIMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Titular dos dados
    user_id UUID,
    patient_id UUID,                                 -- Se for paciente
    email VARCHAR(255),
    cpf VARCHAR(14),
    
    -- Tipo de consentimento
    consent_type VARCHAR(100) NOT NULL,              -- Ex: 'data_processing', 'marketing', 'data_sharing', 'research'
    consent_version VARCHAR(20),                     -- Versão do termo de consentimento
    
    -- Status
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Contexto
    purpose TEXT NOT NULL,                           -- Finalidade específica
    legal_basis VARCHAR(100),                        -- Base legal
    data_categories TEXT[],                          -- Categorias de dados afetados
    third_parties TEXT[],                            -- Terceiros com quem dados podem ser compartilhados
    retention_period VARCHAR(100),                   -- Período de retenção
    
    -- Como foi obtido
    collection_method VARCHAR(50) CHECK (collection_method IN (
        'web_form',
        'mobile_app',
        'verbal',
        'written',
        'electronic_signature',
        'api'
    )),
    ip_address INET,
    user_agent TEXT,
    
    -- Documentação
    consent_document_url TEXT,                       -- URL do termo assinado
    signature_data JSONB,                            -- Dados da assinatura digital
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadados
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_patient ON audit_logs(related_patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_related_consultation ON audit_logs(related_consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_contains_sensitive ON audit_logs(contains_sensitive_data);
CREATE INDEX IF NOT EXISTS idx_audit_logs_data_category ON audit_logs(data_category);

-- Índice composto para consultas frequentes (quem acessou o quê quando)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_resource_time 
    ON audit_logs(user_id, resource_type, created_at DESC);

-- Índice para busca por período
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc 
    ON audit_logs(created_at DESC);

-- Índices para lgpd_requests
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_requester_email ON lgpd_requests(requester_email);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON lgpd_requests(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_request_type ON lgpd_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_created_at ON lgpd_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_deadline ON lgpd_requests(deadline_at);

-- Índices para consent_records
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_email ON consent_records(email);
CREATE INDEX IF NOT EXISTS idx_consent_records_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_granted ON consent_records(granted);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para updated_at em lgpd_requests
CREATE TRIGGER update_lgpd_requests_updated_at 
    BEFORE UPDATE ON lgpd_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em consent_records
CREATE TRIGGER update_consent_records_updated_at 
    BEFORE UPDATE ON consent_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_logs (apenas admins podem ler, sistema pode inserir)
-- Nota: Usuários comuns não devem ter acesso aos logs de auditoria
CREATE POLICY "Service role can manage audit_logs" ON audit_logs
FOR ALL USING (auth.role() = 'service_role');

-- Permitir que usuários autenticados (médicos) possam inserir logs de auditoria
CREATE POLICY "Authenticated users can insert audit_logs" ON audit_logs
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.user_auth = auth.uid()
    )
);

CREATE POLICY "Admins can read audit_logs" ON audit_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.user_auth = auth.uid() 
        AND medicos.admin = true
    )
);

-- Políticas para lgpd_requests
CREATE POLICY "Users can view their own LGPD requests" ON lgpd_requests
FOR SELECT USING (requester_user_id = auth.uid());

CREATE POLICY "Users can create LGPD requests" ON lgpd_requests
FOR INSERT WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Admins can manage LGPD requests" ON lgpd_requests
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM medicos 
        WHERE medicos.user_auth = auth.uid() 
        AND medicos.admin = true
    )
);

-- Políticas para consent_records
CREATE POLICY "Users can view their own consents" ON consent_records
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own consents" ON consent_records
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Service role can manage consents" ON consent_records
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para registrar log de auditoria
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id UUID,
    p_user_email VARCHAR(255),
    p_user_role VARCHAR(50),
    p_action VARCHAR(50),
    p_resource_type VARCHAR(100),
    p_resource_id UUID DEFAULT NULL,
    p_resource_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_request_id VARCHAR(255) DEFAULT NULL,
    p_endpoint VARCHAR(500) DEFAULT NULL,
    p_http_method VARCHAR(10) DEFAULT NULL,
    p_data_category VARCHAR(100) DEFAULT NULL,
    p_legal_basis VARCHAR(100) DEFAULT NULL,
    p_purpose TEXT DEFAULT NULL,
    p_data_fields_accessed TEXT[] DEFAULT NULL,
    p_contains_sensitive_data BOOLEAN DEFAULT false,
    p_data_before JSONB DEFAULT NULL,
    p_data_after JSONB DEFAULT NULL,
    p_changes_summary TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_code VARCHAR(50) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_related_patient_id UUID DEFAULT NULL,
    p_related_consultation_id UUID DEFAULT NULL,
    p_related_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, resource_type, resource_id, resource_description,
        ip_address, user_agent, session_id, request_id, endpoint, http_method,
        data_category, legal_basis, purpose, data_fields_accessed, contains_sensitive_data,
        data_before, data_after, changes_summary,
        success, error_code, error_message,
        metadata, related_patient_id, related_consultation_id, related_session_id
    ) VALUES (
        p_user_id, p_user_email, p_user_role,
        p_action, p_resource_type, p_resource_id, p_resource_description,
        p_ip_address, p_user_agent, p_session_id, p_request_id, p_endpoint, p_http_method,
        p_data_category, p_legal_basis, p_purpose, p_data_fields_accessed, p_contains_sensitive_data,
        p_data_before, p_data_after, p_changes_summary,
        p_success, p_error_code, p_error_message,
        p_metadata, p_related_patient_id, p_related_consultation_id, p_related_session_id
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- Função para buscar logs de um usuário específico
CREATE OR REPLACE FUNCTION get_user_audit_logs(
    p_user_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_action VARCHAR(50) DEFAULT NULL,
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    log_id UUID,
    action VARCHAR(50),
    resource_type VARCHAR(100),
    resource_id UUID,
    resource_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    success BOOLEAN,
    changes_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id as log_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.resource_description,
        al.created_at,
        al.ip_address,
        al.success,
        al.changes_summary
    FROM audit_logs al
    WHERE al.user_id = p_user_id
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
        AND (p_action IS NULL OR al.action = p_action)
        AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Função para buscar logs de acesso a dados de um paciente
CREATE OR REPLACE FUNCTION get_patient_data_access_logs(
    p_patient_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    log_id UUID,
    accessed_by_email VARCHAR(255),
    accessed_by_name VARCHAR(255),
    accessed_by_role VARCHAR(50),
    action VARCHAR(50),
    resource_type VARCHAR(100),
    data_fields_accessed TEXT[],
    accessed_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    purpose TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id as log_id,
        al.user_email as accessed_by_email,
        al.user_name as accessed_by_name,
        al.user_role as accessed_by_role,
        al.action,
        al.resource_type,
        al.data_fields_accessed,
        al.created_at as accessed_at,
        al.ip_address,
        al.purpose
    FROM audit_logs al
    WHERE al.related_patient_id = p_patient_id
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    ORDER BY al.created_at DESC;
END;
$$;

-- Função para gerar relatório de acesso (para atender solicitações LGPD)
CREATE OR REPLACE FUNCTION generate_lgpd_access_report(
    p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'generated_at', NOW(),
        'patient_id', p_patient_id,
        'total_accesses', (
            SELECT COUNT(*) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'accesses_by_action', (
            SELECT jsonb_object_agg(action, count)
            FROM (
                SELECT action, COUNT(*) as count 
                FROM audit_logs 
                WHERE related_patient_id = p_patient_id
                GROUP BY action
            ) t
        ),
        'accesses_by_resource', (
            SELECT jsonb_object_agg(resource_type, count)
            FROM (
                SELECT resource_type, COUNT(*) as count 
                FROM audit_logs 
                WHERE related_patient_id = p_patient_id
                GROUP BY resource_type
            ) t
        ),
        'unique_users_accessed', (
            SELECT COUNT(DISTINCT user_id) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'first_access', (
            SELECT MIN(created_at) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'last_access', (
            SELECT MAX(created_at) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'sensitive_data_accesses', (
            SELECT COUNT(*) FROM audit_logs 
            WHERE related_patient_id = p_patient_id 
            AND contains_sensitive_data = true
        )
    ) INTO v_report;
    
    RETURN v_report;
END;
$$;

-- =====================================================
-- VIEWS PARA RELATÓRIOS
-- =====================================================

-- View de resumo diário de acessos
CREATE OR REPLACE VIEW audit_daily_summary AS
SELECT 
    DATE(created_at) as date,
    action,
    resource_type,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_events,
    COUNT(CASE WHEN contains_sensitive_data = true THEN 1 END) as sensitive_data_events
FROM audit_logs
GROUP BY DATE(created_at), action, resource_type
ORDER BY DATE(created_at) DESC, action, resource_type;

-- View de acessos a dados sensíveis
CREATE OR REPLACE VIEW sensitive_data_access_view AS
SELECT 
    al.id,
    al.user_email,
    al.user_role,
    al.action,
    al.resource_type,
    al.resource_description,
    al.data_fields_accessed,
    al.purpose,
    al.legal_basis,
    al.created_at,
    al.ip_address
FROM audit_logs al
WHERE al.contains_sensitive_data = true
ORDER BY al.created_at DESC;

-- =====================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================================
COMMENT ON TABLE audit_logs IS 'Logs de auditoria detalhados para compliance LGPD - registra todos os acessos e modificações de dados';
COMMENT ON TABLE lgpd_requests IS 'Solicitações de direitos do titular de dados conforme LGPD (acesso, correção, exclusão, portabilidade)';
COMMENT ON TABLE consent_records IS 'Registro de consentimentos de tratamento de dados';

COMMENT ON COLUMN audit_logs.action IS 'Tipo de operação realizada (CREATE, READ, UPDATE, DELETE, EXPORT, etc.)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Tipo do recurso acessado (patients, consultations, transcriptions, etc.)';
COMMENT ON COLUMN audit_logs.data_category IS 'Categoria do dado conforme LGPD: pessoal, sensivel, anonimizado';
COMMENT ON COLUMN audit_logs.legal_basis IS 'Base legal para tratamento: consentimento, contrato, obrigacao_legal, interesse_legitimo, etc.';
COMMENT ON COLUMN audit_logs.contains_sensitive_data IS 'Indica se a operação envolve dados sensíveis (saúde, biometria, origem racial, etc.)';

COMMENT ON FUNCTION log_audit IS 'Função para registrar eventos no log de auditoria';
COMMENT ON FUNCTION get_user_audit_logs IS 'Busca logs de auditoria de um usuário específico';
COMMENT ON FUNCTION get_patient_data_access_logs IS 'Busca todos os acessos aos dados de um paciente (para atender direito de acesso LGPD)';
COMMENT ON FUNCTION generate_lgpd_access_report IS 'Gera relatório consolidado de acessos para atender solicitações LGPD';
