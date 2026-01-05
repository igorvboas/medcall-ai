import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedSession } from '@/lib/supabase-server';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';
import { auditTableField } from '@/lib/audit-table-field-helper';

export async function POST(request: NextRequest, { params }: { params: { consulta_id: string } }) {
  try {
    console.log('🔍 DEBUG [REFERENCIA] Iniciando processamento de exames');
    
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

    // Buscar médico na tabela medicos
    const doctorAuthId = user.id;
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }

    // Obter consulta_id dos parâmetros da URL
    const consultaId = params.consulta_id;
    
    if (!consultaId) {
      return NextResponse.json(
        { error: 'ID da consulta não fornecido na URL' },
        { status: 400 }
      );
    }

    // Obter arquivos do FormData
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo foi enviado' },
        { status: 400 }
      );
    }

    console.log(`🔍 DEBUG [REFERENCIA] Processando ${files.length} arquivos para consulta ${consultaId}`);

    // 1. Buscar consulta pelo ID (antes de processar arquivos)
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('id, doctor_id, patient_id, patient_name, status, etapa')
      .eq('id', consultaId)
      .single();

    if (consultaError || !consulta) {
      console.error('❌ Consulta não encontrada:', consultaError);
      return NextResponse.json(
        { error: 'Consulta não encontrada' },
        { status: 404 }
      );
    }

    console.log('✅ Consulta encontrada:', consulta.id);

    // 0. ALTERAR STATUS DA CONSULTA PARA PROCESSING
    console.log('🔍 DEBUG [REFERENCIA] Alterando status da consulta para PROCESSING');
    const { error: statusUpdateError } = await supabase
      .from('consultations')
      .update({ 
        status: 'PROCESSING',
        updated_at: new Date().toISOString()
      })
      .eq('id', consultaId);

    if (statusUpdateError) {
      console.error('❌ Erro ao atualizar status da consulta:', statusUpdateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar status da consulta' },
        { status: 500 }
      );
    }

    console.log('✅ Status da consulta alterado para PROCESSING');

    // 1. SALVAR ARQUIVOS NO BUCKET DOCUMENTS (PÚBLICO)
    console.log('🔍 DEBUG [REFERENCIA] Salvando arquivos no bucket documents');
    
    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        console.log(`🔍 DEBUG [REFERENCIA] Upload iniciado para arquivo: ${file.name}`);
        
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `exames/${consultaId}/${timestamp}_${randomString}.${fileExtension}`;

        // Converter File para ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Upload para o bucket 'documents' do Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(uniqueFileName, uint8Array, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Erro no upload do arquivo ${file.name}:`, uploadError);
          errors.push({
            fileName: file.name,
            error: uploadError.message
          });
          continue;
        }

        // Obter URL pública do arquivo
        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(uniqueFileName);

        const uploadedFile = {
          fileName: file.name,
          originalName: file.name,
          storagePath: uniqueFileName,
          publicUrl: publicUrlData.publicUrl,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString()
        };

        uploadedFiles.push(uploadedFile);
        console.log(`✅ Upload concluído para arquivo: ${file.name}`);

      } catch (fileError) {
        console.error(`❌ Erro ao processar arquivo ${file.name}:`, fileError);
        errors.push({
          fileName: file.name,
          error: fileError instanceof Error ? fileError.message : 'Erro desconhecido'
        });
      }
    }

    if (uploadedFiles.length === 0) {
      console.error('❌ Nenhum arquivo foi enviado com sucesso');
      return NextResponse.json({
        success: false,
        error: 'Falha no upload de todos os arquivos',
        errors
      }, { status: 500 });
    }

    console.log(`✅ ${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`);

    // 2. ATUALIZAR TABELA A_OBSERVACAO_CLINICA_LAB
    console.log('🔍 DEBUG [REFERENCIA] Atualizando links de exames na tabela a_observacao_clinica_lab');
    
    const linksExames = uploadedFiles.map(file => file.publicUrl);

    // Buscar registro na tabela a_observacao_clinica_lab filtrando por consulta_id
    const { data: existingRecord, error: fetchError } = await supabase
      .from('a_observacao_clinica_lab')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    let linksUpdateResult;

    if (existingRecord) {
      // Atualizar registro existente
      console.log('🔍 DEBUG [REFERENCIA] Atualizando registro existente');
      linksUpdateResult = await supabase
        .from('a_observacao_clinica_lab')
        .update({
          links_exames: linksExames
        })
        .eq('consulta_id', consultaId);
    } else {
      // Criar novo registro
      console.log('🔍 DEBUG [REFERENCIA] Criando novo registro');
      linksUpdateResult = await supabase
        .from('a_observacao_clinica_lab')
        .insert({
          user_id: user.id.toString(),
          paciente_id: consulta.patient_id.toString(),
          consulta_id: consultaId.toString(),
          links_exames: linksExames
        });
    }

    if (linksUpdateResult.error) {
      console.error('❌ Erro ao atualizar links de exames:', linksUpdateResult.error);
      
      // Registrar auditoria de erro
      if (medico) {
        await auditTableField({
          request,
          user_id: user.id,
          user_email: user.email || '',
          user_name: medico.name,
          consultaId,
          consultation: {
            patient_id: consulta.patient_id?.toString(),
            patient_name: consulta.patient_name
          },
          tableName: 'a_observacao_clinica_lab',
          fieldName: 'links_exames',
          fieldPath: 'a_observacao_clinica_lab.links_exames',
          existingRecord: existingRecord || null,
          updatedRecord: null,
          wasCreated: !existingRecord,
          resourceType: 'anamnese'
        });
      }
      
      // Reverter status da consulta baseado na etapa
      const { data: consultaAtualizada } = await supabase
        .from('consultations')
        .select('etapa')
        .eq('id', consultaId)
        .single();
      
      let statusToRevert = 'VALIDATION';
      if (consultaAtualizada?.etapa === 'ANAMNESE') {
        statusToRevert = 'VALID_ANAMNESE';
      } else if (consultaAtualizada?.etapa === 'DIAGNOSTICO') {
        statusToRevert = 'VALID_DIAGNOSTICO';
      } else if (consultaAtualizada?.etapa === 'SOLUCAO') {
        statusToRevert = 'VALID_SOLUCAO';
      }
      
      await supabase
        .from('consultations')
        .update({ status: statusToRevert })
        .eq('id', consultaId);
      
      return NextResponse.json(
        { error: 'Erro ao salvar links de exames' },
        { status: 500 }
      );
    }

    console.log('✅ Links de exames atualizados na tabela a_observacao_clinica_lab');

    // Buscar registro atualizado para auditoria
    const { data: updatedRecord } = await supabase
      .from('a_observacao_clinica_lab')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    // Registrar log de auditoria
    if (medico) {
      await auditTableField({
        request,
        user_id: user.id,
        user_email: user.email || '',
        user_name: medico.name,
        consultaId,
        consultation: {
          patient_id: consulta.patient_id?.toString(),
          patient_name: consulta.patient_name
        },
        tableName: 'a_observacao_clinica_lab',
        fieldName: 'links_exames',
        fieldPath: 'a_observacao_clinica_lab.links_exames',
        existingRecord: existingRecord || null,
        updatedRecord: updatedRecord || null,
        wasCreated: !existingRecord,
        resourceType: 'anamnese'
      });
    }

    // 3. FAZER REQUISIÇÃO HTTP PARA O WEBHOOK EXTERNO
    console.log('🔍 DEBUG [REFERENCIA] Enviando dados para webhook externo');
    
    const webhookData = {
      consulta_id: consultaId,
      medico_id: consulta.doctor_id,
      paciente_id: consulta.patient_id
    };

    const webhookEndpoints = getWebhookEndpoints();
    const webhookHeaders = getWebhookHeaders();
    
    try {
      console.log('🔍 DEBUG [REFERENCIA] Dados do webhook:', webhookData);
      
      const webhookResponse = await fetch(webhookEndpoints.exames, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify(webhookData),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('❌ Erro na resposta do webhook:', {
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
          body: errorText
        });
        
        // Não reverter o status aqui, pois os arquivos já foram processados
        return NextResponse.json({
          success: false,
          warning: 'Arquivos processados, mas falha na comunicação com webhook',
          details: {
            status: webhookResponse.status,
            statusText: webhookResponse.statusText,
            response: errorText
          },
          consultaId,
          linksExames
        });
      }

      const webhookResult = await webhookResponse.json();
      console.log('✅ Webhook executado com sucesso');

      return NextResponse.json({
        success: true,
        message: 'Processamento de exames concluído com sucesso',
        consultaId,
        linksExames,
        webhookResponse: webhookResult,
        medicoId: consulta.doctor_id,
        pacienteId: consulta.patient_id
      });

    } catch (webhookError) {
      console.error('❌ Erro na requisição para o webhook:', webhookError);
      
      // Não reverter o status aqui, pois os arquivos já foram processados
      return NextResponse.json({
        success: false,
        warning: 'Arquivos processados, mas falha na comunicação com webhook',
        details: webhookError instanceof Error ? webhookError.message : 'Erro desconhecido',
        consultaId,
        linksExames
      });
    }

  } catch (error: any) {
    console.error('❌ Erro geral no processamento de exames:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
