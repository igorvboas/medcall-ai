-- Migration: 008_add_webrtc_active_to_call_sessions
-- Descrição: Adiciona coluna para rastrear se há uma conexão WebRTC ativa na sessão
-- Data: 2024-12-05

-- Adicionar coluna webrtc_active
ALTER TABLE public.call_sessions
ADD COLUMN IF NOT EXISTS webrtc_active BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN public.call_sessions.webrtc_active IS 'Indica se há uma conexão WebRTC peer-to-peer ativa (host + participant conectados com offer/answer)';

-- Índice para facilitar busca de sessões com WebRTC ativo
CREATE INDEX IF NOT EXISTS idx_call_sessions_webrtc_active 
ON public.call_sessions (webrtc_active) 
WHERE webrtc_active = true;

-- Atualizar sessões antigas: se status = 'active', considerar webrtc_active como false
-- (não podemos saber se realmente tinham conexão WebRTC, então assumimos false por segurança)
UPDATE public.call_sessions
SET webrtc_active = false
WHERE webrtc_active IS NULL;
