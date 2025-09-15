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
    
    const { supabase, session } = authResult;
    const doctorAuthId = session.user.id;
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
