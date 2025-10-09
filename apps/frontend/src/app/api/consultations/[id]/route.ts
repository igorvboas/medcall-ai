import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/consultations/[id] - Buscar detalhes de uma consulta específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== GET /api/consultations/[id] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    const consultationId = params.id;

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Buscar consulta com dados relacionados
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          birth_date,
          gender,
          cpf,
          address,
          emergency_contact,
          emergency_phone,
          medical_history,
          allergies,
          current_medications
        )
      `)
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (consultationError || !consultation) {
      console.error('❌ Consulta não encontrada:', consultationError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Buscar transcrição se existir
    const { data: transcription } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('consultation_id', consultationId)
      .single();

    // Buscar arquivos de áudio se existirem
    const { data: audioFiles } = await supabase
      .from('audio_files')
      .select('*')
      .eq('consultation_id', consultationId);

    // Buscar documentos se existirem
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('consultation_id', consultationId);

    return NextResponse.json({
      consultation: {
        ...consultation,
        transcription,
        audioFiles: audioFiles || [],
        documents: documents || []
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/consultations/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH /api/consultations/[id] - Atualizar consulta
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('=== PATCH /api/consultations/[id] ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;
    const consultationId = params.id;

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Pegar os dados do body
    const body = await request.json();
    
    console.log('📝 Dados recebidos para atualização:', body);

    // Validar que a consulta pertence ao médico
    const { data: existingConsultation, error: checkError } = await supabase
      .from('consultations')
      .select('id')
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingConsultation) {
      console.error('❌ Consulta não encontrada ou não autorizada:', checkError);
      return NextResponse.json(
        { error: 'Consulta não encontrada ou você não tem permissão para editá-la' },
        { status: 404 }
      );
    }

    // Atualizar a consulta
    const { data: updatedConsultation, error: updateError } = await supabase
      .from('consultations')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar consulta:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar consulta' },
        { status: 500 }
      );
    }

    console.log('✅ Consulta atualizada com sucesso:', updatedConsultation);

    return NextResponse.json({
      consultation: updatedConsultation,
      message: 'Consulta atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro no endpoint PATCH /api/consultations/[id]:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}