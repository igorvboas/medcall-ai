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
  // Estado opcional da sessão para permitir atualizações (e.g., 'ended')
  status?: string;
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
  // Expandir tipos suportados para alinhar com AISuggestion
  type: 'question' | 'insight' | 'warning' | 'protocol' | 'alert' | 'followup' | 'assessment';
  content: string;
  source?: string;
  confidence?: number;
  // Tornar prioridade obrigatória para alinhar com AISuggestion
  priority: 'low' | 'medium' | 'high' | 'critical';
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

  // Mantemos apenas a versão com suporte a limite

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

  // Consultations helpers
  async updateConsultation(id: string, data: any): Promise<boolean> {
    const { error } = await supabase
      .from('consultations')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Erro ao atualizar consulta:', error);
      return false;
    }
    return true;
  },

  async createTranscription(data: any): Promise<any | null> {
    const { data: row, error } = await supabase
      .from('transcriptions')
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar transcrição:', error);
      return null;
    }
    return row;
  },

  async createDocument(data: any): Promise<any | null> {
    const { data: row, error } = await supabase
      .from('documents')
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar documento:', error);
      return null;
    }
    return row;
  },

  // ==================== FUNÇÕES PARA WEBRTC ROOMS ====================

  /**
   * Busca médico pelo user_auth (Supabase Auth ID)
   */
  async getDoctorByAuth(userAuthId: string): Promise<any | null> {
    const { data: doctor, error } = await supabase
      .from('medicos')
      .select('*')
      .eq('user_auth', userAuthId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar médico:', error);
      return null;
    }
    
    return doctor;
  },

  /**
   * Cria uma nova consulta
   */
  async createConsultation(data: {
    doctor_id: string;
    patient_id: string;
    patient_name: string;
    consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
    status?: string;
    patient_context?: string;
  }): Promise<any | null> {
    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert({
        ...data,
        status: data.status || 'CREATED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar consulta:', error);
      return null;
    }
    
    return consultation;
  },

  /**
   * Atualiza call_session com consultation_id
   */
  async updateCallSession(roomId: string, data: {
    consultation_id?: string;
    status?: string;
    ended_at?: string;
    metadata?: any;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('livekit_room_id', roomId); // Buscar por livekit_room_id que é o roomId
    
    if (error) {
      console.error('Erro ao atualizar call_session:', error);
      return false;
    }
    
    return true;
  },

  /**
   * Cria call_session ao criar sala
   */
  async createCallSession(data: {
    livekit_room_id: string;
    room_name: string;
    session_type: string;
    participants: any;
    metadata?: any;
  }): Promise<any | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .insert({
        ...data,
        status: 'active',
        consent: true,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar call_session:', error);
      return null;
    }
    
    return session;
  },

  /**
   * Salva transcrição completa da consulta
   */
  async saveConsultationTranscription(data: {
    consultation_id: string;
    raw_text: string;
    language?: string;
    model_used?: string;
  }): Promise<any | null> {
    const { data: transcription, error } = await supabase
      .from('transcriptions')
      .insert({
        ...data,
        language: data.language || 'pt-BR',
        model_used: data.model_used || 'gpt-4o-realtime-preview-2024-12-17',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao salvar transcrição:', error);
      return null;
    }
    
    return transcription;
  },
};

export default supabase;