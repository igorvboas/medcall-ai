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
  speaker_id?: string | null; // ✅ Nome real do médico/paciente
  doctor_name?: string | null; // ✅ Nome do médico para busca/filtro
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
      .from('transcriptions_med')
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
    try {
      // ✅ Garantir que session_id é fornecido
      if (!data.session_id) {
        console.error('❌ [SAVE] session_id é obrigatório para salvar transcrição');
        return null;
      }

      // ✅ Verificar se session_id existe na tabela call_sessions (validar foreign key)
      const { data: callSession, error: sessionError } = await supabase
        .from('call_sessions')
        .select('id')
        .eq('id', data.session_id)
        .maybeSingle();

      if (sessionError) {
        console.error('❌ [SAVE] Erro ao verificar session_id:', sessionError);
      }

      // ✅ Se a sessão não existe, criar automaticamente para permitir salvar transcrições
      if (!callSession) {
        console.warn(`⚠️ [SAVE] session_id ${data.session_id} não encontrado em call_sessions. Criando sessão automaticamente...`);
        
        try {
          // Criar sessão básica para permitir salvar transcrições
          const { data: newSession, error: createError } = await supabase
            .from('call_sessions')
            .insert({
              id: data.session_id,
              session_type: 'presencial', // Tipo padrão
              status: 'active',
              started_at: new Date().toISOString(),
              participants: {}
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ [SAVE] Erro ao criar sessão automaticamente:', createError);
            // Continuar mesmo assim - pode ser problema de RLS ou permissões
          } else {
            console.log(`✅ [SAVE] Sessão criada automaticamente: ${data.session_id}`);
          }
        } catch (createErr) {
          console.error('❌ [SAVE] Erro ao criar sessão:', createErr);
          // Continuar mesmo assim
        }
      }

      // ✅ Mapear campos conforme schema da tabela transcriptions_med
      const insertData: any = {
        id: data.id || undefined, // UUID gerado pelo banco se não fornecido
        session_id: data.session_id, // UUID obrigatório (foreign key para call_sessions)
        speaker: data.speaker || 'system', // 'doctor', 'patient' ou 'system'
        speaker_id: data.speaker_id || data.speaker || null, // ✅ Nome real do médico/paciente
        text: data.text || '',
        is_final: data.is_final !== undefined ? data.is_final : false,
        start_ms: data.start_ms || 0,
        end_ms: data.end_ms || null, // Opcional
        confidence: data.confidence !== undefined && data.confidence !== null 
          ? Number(data.confidence) 
          : null, // Opcional, numeric(4,3) - garantir que é número
        processing_status: 'completed', // 'pending', 'processing', 'completed', 'error'
        created_at: data.created_at || new Date().toISOString()
      };

      // ✅ Validar confidence está no range correto (0 a 1)
      if (insertData.confidence !== null && insertData.confidence !== undefined) {
        if (insertData.confidence < 0 || insertData.confidence > 1) {
          console.warn(`⚠️ [SAVE] Confidence fora do range (0-1): ${insertData.confidence}, ajustando...`);
          insertData.confidence = Math.max(0, Math.min(1, insertData.confidence));
        }
      }

      // ✅ Validar que text não está vazio
      if (!insertData.text || insertData.text.trim().length === 0) {
        console.warn('⚠️ [SAVE] Texto vazio, não salvando transcrição');
        return null;
      }

      console.log(`💾 [SAVE] Tentando salvar transcrição:`, {
        session_id: insertData.session_id,
        speaker: insertData.speaker,
        text_length: insertData.text.length,
        start_ms: insertData.start_ms,
        end_ms: insertData.end_ms
      });

      const { data: utterance, error } = await supabase
        .from('transcriptions_med')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [SAVE] Erro ao criar utterance no banco:', error);
        console.error('❌ [SAVE] Código do erro:', error.code);
        console.error('❌ [SAVE] Mensagem do erro:', error.message);
        console.error('❌ [SAVE] Detalhes do erro:', error.details);
        console.error('❌ [SAVE] Hint do erro:', error.hint);
        console.error('❌ [SAVE] Dados tentados:', {
          session_id: insertData.session_id,
          speaker: insertData.speaker,
          text: insertData.text?.substring(0, 50) + '...',
          start_ms: insertData.start_ms,
          end_ms: insertData.end_ms,
          confidence: insertData.confidence,
          is_final: insertData.is_final
        });
        return null;
      }
      
      console.log(`✅ [SAVE] Transcrição salva no banco (${insertData.speaker}):`, insertData.text?.substring(0, 50) + '...');
      return utterance;
    } catch (error) {
      console.error('❌ [SAVE] Erro ao criar utterance:', error);
      if (error instanceof Error) {
        console.error('❌ [SAVE] Stack trace:', error.stack);
      }
      return null;
    }
  },

  async getSessionUtterances(sessionId: string, limit = 50): Promise<Utterance[]> {
    const { data: utterances, error } = await supabase
      .from('transcriptions_med')
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

  /**
   * Retorna transcrições como array de conversas (formato JSON)
   * Busca do array salvo em transcriptions_med.text (JSON)
   */
  async getSessionConversations(sessionId: string): Promise<any[]> {
    try {
      // ✅ Buscar o registro único de transcrição para esta sessão
      const { data: transcription, error } = await supabase
        .from('transcriptions_med')
        .select('text')
        .eq('session_id', sessionId)
        .eq('processing_status', 'completed') // ✅ Flag para identificar registro único
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar conversas:', error);
        return [];
      }
      
      if (!transcription || !transcription.text) {
        return [];
      }
      
      // ✅ Parse do JSON do campo text
      try {
        const conversations = JSON.parse(transcription.text);
        return Array.isArray(conversations) ? conversations : [];
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON de conversas:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      return [];
    }
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
   * Adiciona uma transcrição ao array de conversas em transcriptions_med
   * Salva tudo em um único registro, atualizando o array conforme novas transcrições chegam
   */
  async addTranscriptionToSession(sessionId: string, transcription: {
    speaker: 'doctor' | 'patient' | 'system';
    speaker_id: string;
    text: string;
    confidence?: number;
    start_ms?: number;
    end_ms?: number;
    doctor_name?: string; // ✅ Nome do médico para busca/filtro
  }): Promise<boolean> {
    try {
      // ✅ Verificar se Supabase está configurado
      if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ [ARRAY-SAVE] Supabase não configurado!');
        console.error('❌ [ARRAY-SAVE] SUPABASE_URL:', config.SUPABASE_URL ? '✅' : '❌');
        console.error('❌ [ARRAY-SAVE] SUPABASE_SERVICE_ROLE_KEY:', config.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
        return false;
      }

      // ✅ Buscar se já existe um registro único para esta sessão
      // Usar processing_status = 'completed' como flag para identificar o registro único
      const { data: existingTranscription, error: fetchError } = await supabase
        .from('transcriptions_med')
        .select('*')
        .eq('session_id', sessionId)
        .eq('processing_status', 'completed') // ✅ Flag para identificar registro único
        .maybeSingle();

      if (fetchError) {
        // PGRST116 = no rows returned (é esperado quando não existe registro ainda)
        if (fetchError.code !== 'PGRST116') {
          console.error('❌ [ARRAY-SAVE] Erro ao buscar transcrição:', fetchError);
          console.error('❌ [ARRAY-SAVE] Código:', fetchError.code);
          console.error('❌ [ARRAY-SAVE] Mensagem:', fetchError.message);
          console.error('❌ [ARRAY-SAVE] Detalhes:', fetchError.details);
          console.error('❌ [ARRAY-SAVE] Hint:', fetchError.hint);
          return false;
        }
      }

      if (existingTranscription) {
        console.log(`✅ [ARRAY-SAVE] Registro existente encontrado: ${existingTranscription.id}`);
      } else {
        console.log(`📝 [ARRAY-SAVE] Nenhum registro encontrado, criando novo para sessão: ${sessionId}`);
      }

      // ✅ Criar novo item de conversa simplificado (só speaker e text)
      const conversationItem = {
        speaker: transcription.speaker, // 'doctor' ou 'patient'
        text: transcription.text
      };

      if (existingTranscription) {
        // ✅ Atualizar registro existente: adicionar ao array de conversas
        let conversations = [];
        try {
          const parsedText = existingTranscription.text || '[]';
          const parsed = JSON.parse(parsedText);
          // Garantir que é array
          if (Array.isArray(parsed)) {
            conversations = parsed;
          } else {
            console.warn('⚠️ [ARRAY-SAVE] Dados não são array, recriando...');
            conversations = [];
          }
        } catch (e) {
          console.warn('⚠️ [ARRAY-SAVE] Erro ao fazer parse do JSON, criando novo array:', e);
          conversations = [];
        }

        // Adicionar nova conversa ao array
        conversations.push(conversationItem);

        // ✅ Atualizar o registro único usando o ID específico
        // Se o nome do médico foi fornecido e ainda não está salvo, atualizar também
        const updateData: any = {
          text: JSON.stringify(conversations), // Array JSON simplificado no campo text
          end_ms: Date.now() // Atualizar timestamp de fim
        };
        
        // ✅ Se doctor_name foi fornecido e o registro não tem, atualizar
        if (transcription.doctor_name && !existingTranscription.doctor_name) {
          updateData.doctor_name = transcription.doctor_name;
        }
        
        const { data: updatedData, error: updateError } = await supabase
          .from('transcriptions_med')
          .update(updateData)
          .eq('id', existingTranscription.id) // ✅ Usar ID específico
          .select()
          .single();

        if (updateError) {
          console.error('❌ [ARRAY-SAVE] Erro ao atualizar transcrição:', updateError);
          console.error('❌ [ARRAY-SAVE] ID do registro:', existingTranscription.id);
          console.error('❌ [ARRAY-SAVE] Session ID:', sessionId);
          console.error('❌ [ARRAY-SAVE] Código:', updateError.code);
          console.error('❌ [ARRAY-SAVE] Mensagem:', updateError.message);
          console.error('❌ [ARRAY-SAVE] Detalhes:', updateError.details);
          console.error('❌ [ARRAY-SAVE] Hint:', updateError.hint);
          console.error('❌ [ARRAY-SAVE] Array size:', conversations.length);
          console.error('❌ [ARRAY-SAVE] Text length:', JSON.stringify(conversations).length);
          return false;
        }

        if (!updatedData) {
          console.warn(`⚠️ [ARRAY-SAVE] Nenhum registro foi atualizado! ID: ${existingTranscription.id}`);
          return false;
        }

        console.log(`✅ [ARRAY-SAVE] Transcrição adicionada: [${transcription.speaker}] "${transcription.text.substring(0, 50)}..." (Total: ${conversations.length})`);
        return true;
      } else {
        // ✅ Criar novo registro único com array inicial simplificado
        const conversations = [conversationItem];

        // ✅ Determinar speaker principal (primeiro speaker da conversa)
        const mainSpeaker = transcription.speaker;
        const mainSpeakerId = transcription.speaker_id;

        // ✅ Buscar nome do médico se não foi fornecido
        let doctorName = transcription.doctor_name;
        if (!doctorName && mainSpeaker === 'doctor') {
          // Tentar buscar da call_sessions
          try {
            const { data: callSession } = await supabase
              .from('call_sessions')
              .select('participants, metadata')
              .eq('id', sessionId)
              .maybeSingle();
            
            if (callSession?.participants?.host) {
              doctorName = callSession.participants.host;
            } else if (callSession?.metadata?.doctorName) {
              doctorName = callSession.metadata.doctorName;
            }
          } catch (e) {
            console.warn('⚠️ [ARRAY-SAVE] Erro ao buscar nome do médico:', e);
          }
        }

        const { data: newTranscription, error: insertError } = await supabase
          .from('transcriptions_med')
          .insert({
            session_id: sessionId,
            speaker: mainSpeaker, // ✅ Usar o speaker real (doctor ou patient)
            speaker_id: mainSpeakerId, // ✅ Usar o nome real
            text: JSON.stringify(conversations), // ✅ Array JSON simplificado no campo text
            is_final: true,
            start_ms: transcription.start_ms || Date.now(),
            end_ms: transcription.end_ms || Date.now(),
            confidence: transcription.confidence || 0.95,
            processing_status: 'completed', // ✅ Flag para identificar registro único
            doctor_name: doctorName || null, // ✅ Nome do médico (será adicionado como coluna)
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ [ARRAY-SAVE] Erro ao criar transcrição:', insertError);
          console.error('❌ [ARRAY-SAVE] Código:', insertError.code);
          console.error('❌ [ARRAY-SAVE] Mensagem:', insertError.message);
          console.error('❌ [ARRAY-SAVE] Detalhes:', insertError.details);
          console.error('❌ [ARRAY-SAVE] Hint:', insertError.hint);
          console.error('❌ [ARRAY-SAVE] Session ID:', sessionId);
          console.error('❌ [ARRAY-SAVE] Dados tentados:', {
            session_id: sessionId,
            speaker: mainSpeaker,
            speaker_id: mainSpeakerId,
            doctor_name: doctorName,
            text_length: JSON.stringify(conversations).length
          });
          return false;
        }

        console.log(`✅ [ARRAY-SAVE] Registro único criado: [${mainSpeaker}] "${transcription.text.substring(0, 50)}..."`);
        return true;
      }
    } catch (error) {
      console.error('❌ [ARRAY-SAVE] Erro ao adicionar transcrição:', error);
      if (error instanceof Error) {
        console.error('❌ [ARRAY-SAVE] Stack:', error.stack);
      }
      return false;
    }
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