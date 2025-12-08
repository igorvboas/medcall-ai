/**
 * EXEMPLO PRÁTICO DE INTEGRAÇÃO - Sistema de Pacientes
 * 
 * Este arquivo contém exemplos de código prontos para usar
 * no seu sistema externo de pacientes.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// 1. CONFIGURAÇÃO DO CLIENTE SUPABASE
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente para operações do cliente (frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (apenas para operações administrativas no backend)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================
// 2. AUTENTICAÇÃO DO PACIENTE
// ============================================

/**
 * Faz login do paciente usando email e senha
 * Retorna o usuário autenticado e os dados do paciente
 */
export async function loginPaciente(email: string, password: string) {
  try {
    // 1. Autenticar no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('❌ Erro na autenticação:', authError);
      return {
        success: false,
        error: authError.message,
        user: null,
        paciente: null
      };
    }

    // 2. Buscar dados do paciente usando user_auth
    const userAuthId = authData.user.id;
    const paciente = await buscarPacientePorUserAuth(userAuthId);

    if (!paciente) {
      return {
        success: false,
        error: 'Paciente não encontrado no sistema',
        user: authData.user,
        paciente: null
      };
    }

    return {
      success: true,
      error: null,
      user: authData.user,
      paciente: paciente
    };

  } catch (error: any) {
    console.error('💥 Erro no login:', error);
    return {
      success: false,
      error: error.message || 'Erro ao fazer login',
      user: null,
      paciente: null
    };
  }
}

/**
 * Faz logout do paciente
 */
export async function logoutPaciente() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('❌ Erro ao fazer logout:', error);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

// ============================================
// 3. BUSCAR DADOS DO PACIENTE
// ============================================

/**
 * Busca paciente pelo user_auth (ID do Supabase Auth)
 * Esta é a forma RECOMENDADA de buscar o paciente
 */
export async function buscarPacientePorUserAuth(userAuthId: string) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_auth', userAuthId)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar paciente:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('💥 Erro ao buscar paciente:', error);
    return null;
  }
}

/**
 * Busca paciente pelo email
 * Útil para verificar se o paciente existe antes de criar
 */
export async function buscarPacientePorEmail(email: string) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      // Se não encontrou, retorna null (não é erro)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('❌ Erro ao buscar paciente:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('💥 Erro ao buscar paciente:', error);
    return null;
  }
}

/**
 * Busca paciente logado (usando a sessão atual)
 */
export async function buscarPacienteLogado() {
  try {
    // 1. Verificar se há sessão ativa
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return null;
    }

    // 2. Buscar paciente usando user_auth
    return await buscarPacientePorUserAuth(session.user.id);

  } catch (error) {
    console.error('💥 Erro ao buscar paciente logado:', error);
    return null;
  }
}

// ============================================
// 4. ATUALIZAR DADOS DO PACIENTE
// ============================================

/**
 * Atualiza dados do paciente
 * O paciente só pode atualizar seus próprios dados
 */
export async function atualizarPaciente(
  userAuthId: string,
  dados: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    birth_date?: string;
    gender?: 'M' | 'F' | 'O';
    cpf?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    medical_history?: string;
    allergies?: string;
    current_medications?: string;
  }
) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .update({
        ...dados,
        updated_at: new Date().toISOString()
      })
      .eq('user_auth', userAuthId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar paciente:', error);
      return {
        success: false,
        error: error.message,
        paciente: null
      };
    }

    return {
      success: true,
      error: null,
      paciente: data
    };

  } catch (error: any) {
    console.error('💥 Erro ao atualizar paciente:', error);
    return {
      success: false,
      error: error.message || 'Erro ao atualizar paciente',
      paciente: null
    };
  }
}

// ============================================
// 5. VERIFICAR SESSÃO ATIVA
// ============================================

/**
 * Verifica se há uma sessão ativa e retorna o paciente
 */
export async function verificarSessao() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return {
        autenticado: false,
        user: null,
        paciente: null
      };
    }

    const paciente = await buscarPacientePorUserAuth(session.user.id);

    return {
      autenticado: true,
      user: session.user,
      paciente: paciente
    };

  } catch (error) {
    console.error('💥 Erro ao verificar sessão:', error);
    return {
      autenticado: false,
      user: null,
      paciente: null
    };
  }
}

// ============================================
// 6. EXEMPLO DE USO NO COMPONENTE REACT
// ============================================

/**
 * Hook React para gerenciar autenticação do paciente
 * 
 * IMPORTANTE: Este hook requer React. Use apenas em componentes React.
 * 
 * Exemplo de uso:
 * 
 * import { useState, useEffect } from 'react';
 * 
 * function MeuComponente() {
 *   const { paciente, loading, login, logout } = usePacienteAuth();
 *   
 *   if (loading) return <div>Carregando...</div>;
 *   if (!paciente) return <LoginForm onLogin={login} />;
 *   
 *   return <Dashboard paciente={paciente} onLogout={logout} />;
 * }
 */
export function usePacienteAuth() {
  // ⚠️ Este hook requer React - importe useState e useEffect no seu componente
  // const [paciente, setPaciente] = useState<any>(null);
  // const [loading, setLoading] = useState(true);
  
  // useEffect(() => {
    async function carregarPaciente() {
      const resultado = await verificarSessao();
      setPaciente(resultado.paciente);
      setLoading(false);
    }

    carregarPaciente();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const p = await buscarPacientePorUserAuth(session.user.id);
          setPaciente(p);
        } else {
          setPaciente(null);
        }
        setLoading(false);
      }
    );

  //   return () => {
  //     subscription.unsubscribe();
  //   };
  // }, []);
  
  // const login = async (email: string, password: string) => {
  //   const resultado = await loginPaciente(email, password);
  //   if (resultado.success) {
  //     setPaciente(resultado.paciente);
  //   }
  //   return resultado;
  // };
  
  // const logout = async () => {
  //   await logoutPaciente();
  //   setPaciente(null);
  // };
  
  // return {
  //   paciente,
  //   loading,
  //   login,
  //   logout
  // };
  
  // ⚠️ Implementação completa requer React hooks
  // Veja o exemplo completo no guia: GUIA_INTEGRACAO_SISTEMA_PACIENTES.md
}

// ============================================
// 7. EXEMPLO DE PÁGINA DE LOGIN
// ============================================

/**
 * Exemplo de componente de login
 * 
 * export default function LoginPage() {
 *   const [email, setEmail] = useState('');
 *   const [password, setPassword] = useState('');
 *   const [error, setError] = useState<string | null>(null);
 *   const router = useRouter();
 * 
 *   async function handleSubmit(e: React.FormEvent) {
 *     e.preventDefault();
 *     setError(null);
 * 
 *     const resultado = await loginPaciente(email, password);
 * 
 *     if (resultado.success) {
 *       router.push('/dashboard');
 *     } else {
 *       setError(resultado.error || 'Erro ao fazer login');
 *     }
 *   }
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input
 *         type="email"
 *         value={email}
 *         onChange={(e) => setEmail(e.target.value)}
 *         placeholder="Email"
 *         required
 *       />
 *       <input
 *         type="password"
 *         value={password}
 *         onChange={(e) => setPassword(e.target.value)}
 *         placeholder="Senha"
 *         required
 *       />
 *       {error && <p style={{ color: 'red' }}>{error}</p>}
 *       <button type="submit">Entrar</button>
 *     </form>
 *   );
 * }
 */

// ============================================
// 8. QUERY SQL DIRETA (Se necessário)
// ============================================

/**
 * Se você precisar fazer queries SQL diretas:
 * 
 * SELECT * FROM patients WHERE user_auth = 'uuid-do-usuario';
 * 
 * Ou com JOIN para buscar dados do médico:
 * 
 * SELECT 
 *   p.*,
 *   m.name as doctor_name,
 *   m.email as doctor_email
 * FROM patients p
 * JOIN medicos m ON p.doctor_id = m.id
 * WHERE p.user_auth = 'uuid-do-usuario';
 */

