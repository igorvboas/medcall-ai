import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('=== VERIFICAR E CRIAR USUÁRIO ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    
    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 401 });
    }
    
    const userId = user.id;
    
    console.log('✅ Usuário autenticado:', {
      id: userId,
      email: session.user.email,
      name: session.user.user_metadata?.name || session.user.email
    });
    
    // Verificar se usuário já existe na tabela users
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao verificar usuário:', userError);
      return NextResponse.json({
        error: 'Erro ao verificar usuário',
        details: userError.message
      }, { status: 500 });
    }
    
    if (existingUser) {
      console.log('✅ Usuário já existe na tabela users:', existingUser);
      return NextResponse.json({
        success: true,
        message: 'Usuário já existe',
        user: existingUser
      });
    }
    
    // Criar usuário na tabela users usando service role para bypass RLS
    console.log('🔄 Criando usuário na tabela users...');
    const newUser = {
      id: userId,
      email: session.user.email!,
      name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
      is_doctor: true, // Assumir que é médico por padrão
      subscription_type: 'FREE'
    };
    
    // Usar service role para bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: createdUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert(newUser)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return NextResponse.json({
        error: 'Erro ao criar usuário',
        details: createError.message
      }, { status: 500 });
    }
    
    console.log('✅ Usuário criado com sucesso:', createdUser);
    
    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: createdUser
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
