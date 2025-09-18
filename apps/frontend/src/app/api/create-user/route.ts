import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getAuthenticatedSession } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== TESTE DE CRIAÇÃO DE USUÁRIO ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const userId = user.id;
    
  console.log('✅ Usuário autenticado:', {
      id: userId,
      email: user.email,
      name: user.user_metadata?.name || user.email
    });
    
    // Verificar se usuário já existe
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError && userError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar usuário:', userError);
      return NextResponse.json({
        error: 'Erro ao verificar usuário',
        details: userError.message
      }, { status: 500 });
    }
    
    if (existingUser) {
      console.log('✅ Usuário já existe:', existingUser);
      return NextResponse.json({
        success: true,
        message: 'Usuário já existe',
        user: existingUser
      });
    }
    
    // Criar usuário
    console.log('🔄 Criando usuário...');
    const newUser = {
      id: userId,
      email: user.email!,
      name: user.user_metadata?.name || user.email!.split('@')[0],
      is_doctor: true,
      subscription_type: 'FREE'
    };
    
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return NextResponse.json({
        error: 'Erro ao criar usuário',
        details: createError.message,
        code: createError.code
      }, { status: 500 });
    }
    
    console.log('✅ Usuário criado:', createdUser);
    
    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: createdUser
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro geral:', message);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: message
    }, { status: 500 });
  }
}
