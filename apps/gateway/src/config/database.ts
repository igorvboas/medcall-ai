import { createClient } from '@supabase/supabase-js';
import { config } from './index';

// Configuração do cliente Supabase
export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Configurações específicas para o backend
    db: {
      schema: 'public',
    },
    // Timeout para operações
    global: {
      headers: {
        'x-application-name': 'medcall-gateway',
      },
    },
  }
);

// Teste de conexão
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Erro ao conectar com Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com Supabase estabelecida com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com Supabase:', error);
    return false;
  }
}

// Tipos para o banco de dados (básico por enquanto)
export interface CallSession {
  id: string;
  consultation_id?: string | null;
  session_type: 'presencial' | 'online';
  started_at: string;
  ended_at?: string;
  participants: Record<string, any>;
  consent: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Utterance {
  id: string;
  session_id: string;
  speaker: 'doctor' | 'patient' | 'system';
  start_ms: number;
  end_ms: number;
  text: string;
  is_final: boolean;
  confidence?: number;
  created_at: string;
}

export interface Suggestion {
  id: string;
  session_id: string;
  utterance_id?: string;
  type: 'question' | 'insight' | 'warning' | 'protocol';
  content: string;
  source?: string;
  confidence?: number;
  used: boolean;
  created_at: string;
}

// Helper para queries comuns
export const db = {
  // Sessões
  async createSession(data: Partial<CallSession>): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .insert(data)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar sessão:', error);
      return null;
    }
    
    return session;
  },

  async getSession(id: string): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Erro ao buscar sessão:', error);
      return null;
    }
    
    return session;
  },


  async getUtterancesBySession(sessionId: string): Promise<Utterance[]> {
    const { data: utterances, error } = await supabase
      .from('utterances')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar utterances:', error);
      return [];
    }
    
    return utterances || [];
  },

  // Alias para compatibilidade com o código existente
  async getSessionUtterances(sessionId: string): Promise<Utterance[]> {
    return this.getUtterancesBySession(sessionId);
  },

  async updateSession(id: string, data: Partial<CallSession>): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao atualizar sessão:', error);
      return false;
    }
    
    return true;
  },

  // Utterances
  async createUtterance(data: Partial<Utterance>): Promise<Utterance | null> {
    const { data: utterance, error } = await supabase
      .from('utterances')
      .insert(data)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar utterance:', error);
      return null;
    }
    
    return utterance;
  },

  async getSessionUtterances(sessionId: string, limit = 50): Promise<Utterance[]> {
    const { data: utterances, error } = await supabase
      .from('utterances')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Erro ao buscar utterances:', error);
      return [];
    }
    
    return utterances || [];
  },

  // Suggestions
  async createSuggestion(data: Partial<Suggestion>): Promise<Suggestion | null> {
    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .insert(data)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar sugestão:', error);
      return null;
    }
    
    return suggestion;
  },

  async getSessionSuggestions(sessionId: string): Promise<Suggestion[]> {
    const { data: suggestions, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar sugestões:', error);
      return [];
    }
    
    return suggestions || [];
  },

  async markSuggestionAsUsed(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('suggestions')
      .update({ used: true })
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao marcar sugestão como usada:', error);
      return false;
    }
    
    return true;
  },
};

export default supabase;