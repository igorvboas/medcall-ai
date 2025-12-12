import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { auditTableField } from '@/lib/audit-table-field-helper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const { consultaId } = params;
    const body = await request.json();
    const { id, field, value } = body;

    if (!id || !field) {
      return NextResponse.json(
        { error: 'ID do exercício e campo são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('🔍 [UPDATE-EXERCICIO] Atualizando:', { id, field, value, consultaId });

    // Atualizar o campo específico na tabela s_exercicios_fisicos
    // Apenas pelo ID do exercício (sem filtro por consulta_id pois pode não existir)
    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .update({ [field]: value })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [UPDATE-EXERCICIO] Erro ao atualizar:', error);
      
      // Log detalhado para debug
      console.error('❌ [UPDATE-EXERCICIO] Detalhes:', {
        id,
        field,
        value,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      });
      
      return NextResponse.json(
        { error: 'Erro ao atualizar exercício', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('❌ [UPDATE-EXERCICIO] Nenhum registro encontrado com id:', id);
      return NextResponse.json(
        { error: 'Exercício não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ [UPDATE-EXERCICIO] Sucesso:', data);

    // Registrar auditoria
    const authResult = await getAuthenticatedSession();
    if (authResult?.user) {
      const { user } = authResult;
      const { data: medico } = await supabase
        .from('medicos')
        .select('id, name, email')
        .eq('user_auth', user.id)
        .single();

      // Buscar consulta para obter patient_id
      const { data: consultation } = await supabase
        .from('consultations')
        .select('patient_id, patient_name')
        .eq('id', consultaId)
        .single();

      // Buscar registro antes da atualização (se possível)
      const { data: existingRecord } = await supabase
        .from('s_exercicios_fisicos')
        .select('*')
        .eq('id', id)
        .single();

      if (medico && consultation) {
        await auditTableField({
          request,
          user_id: user.id,
          user_email: user.email || '',
          user_name: medico.name,
          consultaId,
          consultation,
          tableName: 's_exercicios_fisicos',
          fieldName: field,
          fieldPath: `s_exercicios_fisicos.${field}`,
          existingRecord: existingRecord || null,
          updatedRecord: data || null,
          wasCreated: false,
          resourceType: 'solucao'
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ [UPDATE-EXERCICIO] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
