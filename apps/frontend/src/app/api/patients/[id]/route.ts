import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// Tipos locais para pacientes
interface UpdatePatientData {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  status?: 'active' | 'inactive' | 'archived';
}

// Helper function para obter Supabase client autenticado e ID do médico
async function getAuthenticatedSupabase() {
  const authResult = await getAuthenticatedSession();
  
  if (!authResult) {
    throw new Error('Não autorizado');
  }
  
  const { supabase, session } = authResult;
  const doctorAuthId = session.user.id;

  // ✅ Buscar médico na tabela medicos usando a FK do auth.users
  const { data: medico, error: medicoError } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', doctorAuthId)
    .single();
  
  if (medicoError || !medico) {
    throw new Error('Médico não encontrado no sistema');
  }
  
  return { supabase, doctorId: medico.id }; // ✅ Retornar medicos.id, não auth.users.id
}

// GET /api/patients/[id] - Buscar paciente específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, doctorId } = await getAuthenticatedSupabase();
    const patientId = params.id;

    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('doctor_id', doctorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Paciente não encontrado' },
          { status: 404 }
        );
      }
      console.error('Erro ao buscar paciente:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar paciente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient });

  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro no endpoint GET /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/patients/[id] - Atualizar paciente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, doctorId } = await getAuthenticatedSupabase();
    const patientId = params.id;
    const body: UpdatePatientData = await request.json();

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: fetchError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('doctor_id', doctorId)
      .single();

    if (fetchError || !existingPatient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar paciente
    const { data: patient, error } = await supabase
      .from('patients')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', patientId)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar paciente:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar paciente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient });

  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro no endpoint PUT /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/patients/[id] - Deletar paciente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, doctorId } = await getAuthenticatedSupabase();
    const patientId = params.id;

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: fetchError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('doctor_id', doctorId)
      .single();

    if (fetchError || !existingPatient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    // Deletar paciente
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('doctor_id', doctorId);

    if (error) {
      console.error('Erro ao deletar paciente:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar paciente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Paciente deletado com sucesso' });

  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro no endpoint DELETE /api/patients/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
