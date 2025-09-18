import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getAuthenticatedSession } from '@/lib/supabase-server';

// Tipos locais para dados do médico
interface UpdateMedicoData {
  name?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  crm?: string;
  cpf?: string;
  birth_date?: string;
  subscription_type?: 'FREE' | 'PRO' | 'ENTERPRISE';
}

// GET /api/medico - Buscar dados do médico logado
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/medico ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;

    // Buscar médico na tabela medicos usando a FK do auth.users
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('*')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    return NextResponse.json({ medico });

  } catch (error) {
    console.error('Erro no endpoint GET /api/medico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/medico - Atualizar dados do médico logado
export async function PUT(request: NextRequest) {
  try {
    console.log('=== PUT /api/medico ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      console.log('❌ Não autorizado');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    console.log('✅ Doctor Auth ID:', doctorAuthId);
    
    const body: UpdateMedicoData = await request.json();
    console.log('📝 Dados recebidos:', body);

    // Validação básica
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Buscar médico na tabela medicos usando a FK do auth.users
    console.log('🔍 Buscando médico com user_auth:', doctorAuthId);
    
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name, email')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError) {
      console.error('❌ Erro ao buscar médico:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema', details: medicoError.message },
        { status: 404 }
      );
    }
    
    if (!medico) {
      console.log('❌ Médico não encontrado na tabela medicos');
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }
    
    console.log('✅ Médico encontrado:', medico);

    // Preparar dados para atualização
    const updateData = {
      ...body,
      name: body.name?.trim(),
      updated_at: new Date().toISOString()
    };
    
    // Limpar campos vazios
    Object.keys(updateData).forEach(key => {
      const value = (updateData as any)[key];
      if (value === '' || value === undefined || value === null) {
        delete (updateData as any)[key];
      }
    });
    
    console.log('💾 Dados para atualização:', updateData);

    const { data: updatedMedico, error } = await supabase
      .from('medicos')
      .update(updateData)
      .eq('id', medico.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar médico:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar dados do médico', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Médico atualizado:', updatedMedico);
    return NextResponse.json({ medico: updatedMedico });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro geral:', message);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: message },
      { status: 500 }
    );
  }
}
