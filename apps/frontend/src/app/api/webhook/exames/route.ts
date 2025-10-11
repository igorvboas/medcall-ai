import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedSession } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG [REFERENCIA] Iniciando chamada para webhook de exames');
    
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

    const body = await request.json();
    const { consultaId } = body;

    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta não fornecido' },
        { status: 400 }
      );
    }

    console.log(`🔍 DEBUG [REFERENCIA] Enviando dados para webhook para consulta ${consultaId}`);

    // Buscar dados da consulta
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('id, doctor_id, patient_id, status')
      .eq('id', consultaId)
      .single();

    if (consultaError || !consulta) {
      console.error('❌ Consulta não encontrada:', consultaError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o médico tem acesso à consulta
    if (consulta.doctor_id !== user.id) {
      console.error('❌ Médico não tem acesso à consulta');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Buscar dados do médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', user.id)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado na tabela medicos:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado' },
        { status: 404 }
      );
    }

    // Buscar dados do paciente
    const { data: paciente, error: pacienteError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', consulta.patient_id)
      .single();

    if (pacienteError || !paciente) {
      console.error('❌ Paciente não encontrado:', pacienteError);
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    // Preparar dados para o webhook
    const webhookData = {
      consulta_id: consultaId,
      medico_id: medico.id,
      paciente_id: paciente.id
    };

    console.log('🔍 DEBUG [REFERENCIA] Dados do webhook:', webhookData);

    // Fazer requisição para o webhook externo
    const webhookUrl = 'https://webhook.tc1.triacompany.com.br/webhook/5d03fec8-6a3a-4399-8ddc-a4839e0db3ea/:input-at-exames-usi';
    
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('❌ Erro na resposta do webhook:', {
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          body: errorText
        });
        
        return NextResponse.json({
          success: false,
          error: 'Falha na comunicação com o webhook',
          details: {
            status: webhookResponse.status,
            statusText: webhookResponse.statusText,
            response: errorText
          }
        }, { status: 500 });
      }

      const webhookResult = await webhookResponse.json();
      console.log('✅ Webhook executado com sucesso:', webhookResult);

      return NextResponse.json({
        success: true,
        message: 'Webhook executado com sucesso',
        webhookResponse: webhookResult,
        consultaId,
        medicoId: medico.id,
        pacienteId: paciente.id
      });

    } catch (webhookError) {
      console.error('❌ Erro na requisição para o webhook:', webhookError);
      
      return NextResponse.json({
        success: false,
        error: 'Erro na comunicação com o webhook',
        details: webhookError instanceof Error ? webhookError.message : 'Erro desconhecido'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Erro geral no webhook de exames:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
