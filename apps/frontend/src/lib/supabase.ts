import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase usando variáveis NEXT_PUBLIC_ para client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug das variáveis de ambiente
/**
console.log('DEBUG ENV VARS:', {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***defined***' : undefined,
  supabaseUrl,
  supabaseAnonKey: supabaseAnonKey ? '***defined***' : undefined
});
 */
// Função para verificar se as variáveis estão configuradas
function getSupabaseConfigStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key');
}

// Verificar se as variáveis estão configuradas
const isSupabaseConfigured = getSupabaseConfigStatus();

console.log('Supabase configurado:', isSupabaseConfigured);

// Aguardar que as variáveis sejam carregadas antes de criar o cliente
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Variáveis de ambiente do Supabase não encontradas. Usando valores de fallback.');
}

// Função para aguardar carregamento das variáveis de ambiente
export function waitForSupabaseConfig(): Promise<boolean> {
  return new Promise((resolve) => {
    if (isSupabaseConfigured) {
      resolve(true);
      return;
    }
    
    // Aguardar um pouco para as variáveis carregarem
    setTimeout(() => {
      const newCheck = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      resolve(newCheck);
    }, 100);
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
  }
);

// Função para buscar pacientes do médico logado
export async function getPatients() {
  // Verificar configuração dinamicamente
  const isConfigured = getSupabaseConfigStatus();
  //console.log('🔍 isConfigured (dinâmico):', isConfigured);
  
  // Se o Supabase não estiver configurado, retornar pacientes mock
  if (!isConfigured) {
    console.warn('⚠️ Supabase não configurado, usando dados mock');
    return [
      { id: '1', name: 'MOC - João Silva', email: 'joao@email.com', phone: '(11) 99999-9999', city: 'São Paulo', status: 'active' },
      { id: '2', name: 'MOC - Maria Santos', email: 'maria@email.com', phone: '(11) 88888-8888', city: 'Rio de Janeiro', status: 'active' },
      { id: '3', name: 'MOC - Pedro Oliveira', email: 'pedro@email.com', phone: '(11) 77777-7777', city: 'Belo Horizonte', status: 'active' },
    ];
  }

  
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*');

    if (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      return [];
    }

    console.log('✅ Pacientes encontrados:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('💥 Erro na conexão com Supabase:', error);
    return [];
  }
}

// Função para criar nova consulta
export async function createConsultation(consultationData: {
  patient_id: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  patient_name: string;
}) {
  // Se o Supabase não estiver configurado, simular criação da consulta
  if (!isSupabaseConfigured) {
    console.warn('Supabase não configurado, simulando criação de consulta');
    const mockConsultation = {
      id: `mock-${Date.now()}`,
      ...consultationData,
      status: 'CREATED',
      created_at: new Date().toISOString(),
    };
    
    // Simular delay da API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return mockConsultation;
  }

  try {
    const { data, error } = await supabase
      .from('consultations')
      .insert([
        {
          ...consultationData,
          status: 'CREATED',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar consulta:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro na criação da consulta:', error);
    throw error;
  }
}
