-- Migration 007: Renomear coluna livekit_room_id para room_id
-- Esta migration renomeia a coluna para um nome mais genérico

-- Renomear a coluna na tabela call_sessions
ALTER TABLE call_sessions 
RENAME COLUMN livekit_room_id TO room_id;

-- Criar índice se não existir (para melhor performance nas buscas)
CREATE INDEX IF NOT EXISTS idx_call_sessions_room_id ON call_sessions(room_id);

