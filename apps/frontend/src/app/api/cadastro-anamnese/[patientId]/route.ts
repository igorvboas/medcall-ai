import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/cadastro-anamnese/[patientId] - Buscar dados do cadastro de anamnese do paciente
export async function GET(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const { patientId } = params;

    if (!patientId) {
      return NextResponse.json(
        { error: 'ID do paciente não fornecido' },
        { status: 400 }
      );
    }

    // Verificar autenticação
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      console.error('❌ Falha na autenticação: Sessão não encontrada');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { supabase, user } = authResult;
    console.log('✅ Usuário autenticado:', user.id);
    console.log('🔍 Buscando cadastro anamnese para paciente_id:', patientId);

    // Buscar dados da tabela a_cadastro_anamnese
    const { data, error } = await supabase
      .from('a_cadastro_anamnese')
      .select('*')
      .eq('paciente_id', patientId)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar cadastro anamnese:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados do cadastro de anamnese' },
        { status: 500 }
      );
    }

    if (!data) {
      console.log('ℹ️ Nenhum cadastro de anamnese encontrado para o paciente:', patientId);
      return NextResponse.json(null);
    }

    console.log('✅ Dados do cadastro anamnese encontrados:', Object.keys(data).length, 'campos');
    
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Erro ao buscar dados do cadastro de anamnese:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do cadastro de anamnese', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/cadastro-anamnese/[patientId] - Atualizar campo do cadastro de anamnese
export async function PATCH(
  request: NextRequest,
  { params }: { params: { patientId: string } }
) {
  try {
    const { patientId } = params;
    const body = await request.json();
    const { fieldName, value } = body;

    if (!patientId) {
      return NextResponse.json(
        { error: 'ID do paciente não fornecido' },
        { status: 400 }
      );
    }

    if (!fieldName) {
      return NextResponse.json(
        { error: 'Nome do campo não fornecido' },
        { status: 400 }
      );
    }

    // Verificar autenticação
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { supabase, user } = authResult;
    console.log('✅ Usuário autenticado:', user.id);
    console.log('📝 Atualizando campo:', fieldName, 'para paciente:', patientId);

    // Atualizar o campo específico
    const { data, error } = await supabase
      .from('a_cadastro_anamnese')
      .update({ [fieldName]: value, updated_at: new Date().toISOString() })
      .eq('paciente_id', patientId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar campo:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar campo do cadastro de anamnese' },
        { status: 500 }
      );
    }

    console.log('✅ Campo atualizado com sucesso');
    
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Erro ao atualizar cadastro de anamnese:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar cadastro de anamnese', details: error.message },
      { status: 500 }
    );
  }
}

