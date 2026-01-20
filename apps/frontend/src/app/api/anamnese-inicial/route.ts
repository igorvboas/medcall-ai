import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { sendAnamneseEmail } from '@/lib/email-service';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';

// Rotas dinâmicas (usam cookies e service role)
export const dynamic = 'force-dynamic';

// Função helper para obter URL de produção (não preview)
function getProductionUrl(): string {
  // Prioridade 1: Variável explícita de produção
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Prioridade 2: URL de produção customizado
  if (process.env.NEXT_PUBLIC_PRODUCTION_URL) {
    return process.env.NEXT_PUBLIC_PRODUCTION_URL;
  }
  
  // Prioridade 3: Verificar VERCEL_URL (pode ser preview ou produção)
  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL;
    // Preview URLs contêm padrões específicos que indicam preview
    const isPreviewUrl = vercelUrl.includes('-j8ylavznu-') || 
                         vercelUrl.includes('git-') || 
                         vercelUrl.includes('-pr-') ||
                         vercelUrl.includes('vercel-dev');
    
    if (isPreviewUrl) {
      // Se for preview, tentar usar domínio de produção se configurado
      return process.env.VERCEL_PROJECT_PRODUCTION_URL || `https://${vercelUrl}`;
    } else {
      // Parece ser URL de produção
      return `https://${vercelUrl}`;
    }
  }
  
  // Fallback: localhost (desenvolvimento)
  return 'http://localhost:3000';
}

// GET /api/anamnese-inicial?patient_id=xxx - Buscar anamnese inicial de um paciente
// Permite acesso público para paciente preencher (sem autenticação)
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Usar service role key para bypass RLS em operações públicas
    // Tenta diferentes nomes de variáveis comuns
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY 
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseKey) {
      console.error('❌ Nenhuma chave Supabase configurada!');
      return NextResponse.json(
        { error: 'Configuração do servidor inválida' },
        { status: 500 }
      );
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient_id');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patient_id é obrigatório' },
        { status: 400 }
      );
    }

    const { data: anamnese, error } = await supabaseClient
      .from('a_cadastro_anamnese')
      .select('*')
      .eq('paciente_id', patientId)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar anamnese inicial:', error);
      console.error('  - Código:', error.code);
      console.error('  - Mensagem:', error.message);
      console.error('  - Detalhes:', error.details);
      return NextResponse.json(
        { 
          error: 'Erro ao buscar anamnese inicial',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ anamnese: anamnese || null });
  } catch (error: any) {
    console.error('❌ Erro no endpoint GET /api/anamnese-inicial:', error);
    console.error('  - Tipo:', typeof error);
    console.error('  - Mensagem:', error?.message);
    console.error('  - Stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}

// POST /api/anamnese-inicial - Criar/enviar anamnese inicial (médico envia para paciente)
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', user.id)
      .single();
    
    if (medicoError || !medico) {
      return NextResponse.json(
        { error: 'Médico não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { patient_id } = body;

    if (!patient_id) {
      return NextResponse.json(
        { error: 'patient_id é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o paciente pertence ao médico e buscar dados do paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, doctor_id, name, email')
      .eq('id', patient_id)
      .eq('doctor_id', medico.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado ou não pertence ao médico' },
        { status: 404 }
      );
    }

    // Verificar se já existe anamnese para este paciente
    const { data: existingAnamnese } = await supabase
      .from('a_cadastro_anamnese')
      .select('paciente_id')
      .eq('paciente_id', patient_id)
      .maybeSingle();

    if (existingAnamnese) {
      // Atualizar status para 'pendente' se já existir
      const { error: updateError } = await supabase
        .from('a_cadastro_anamnese')
        .update({ 
          status: 'pendente',
          updated_at: new Date().toISOString()
        })
        .eq('paciente_id', patient_id);

      if (updateError) {
        console.error('Erro ao atualizar anamnese:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar anamnese' },
          { status: 500 }
        );
      }

    // Gerar link para paciente preencher anamnese
    const baseUrl = getProductionUrl();
    const anamneseLink = `${baseUrl}/anamnese-inicial?paciente_id=${patient_id}`;

    // Enviar email para o paciente (se tiver email)
    let emailSent = false;
    if (patient.email) {
      try {
        const emailResult = await sendAnamneseEmail({
          to: patient.email,
          patientName: patient.name,
          anamneseLink: anamneseLink
        });
        emailSent = emailResult.success;
        if (!emailSent) {
          console.warn('⚠️ Email não foi enviado:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Erro ao tentar enviar email:', emailError);
        // Continua mesmo se o email falhar
      }
    }

      return NextResponse.json({ 
        message: emailSent 
          ? 'Anamnese reenviada para o paciente por email' 
          : 'Anamnese reenviada para o paciente',
        anamnese: { paciente_id: patient_id, status: 'pendente' },
        link: anamneseLink,
        emailSent: emailSent
      });
    }

    // Criar nova anamnese com status 'pendente'
    const { data: newAnamnese, error: insertError } = await supabase
      .from('a_cadastro_anamnese')
      .insert({
        paciente_id: patient_id,
        status: 'pendente'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar anamnese:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar anamnese inicial', details: insertError.message },
        { status: 500 }
      );
    }

    // Gerar link para paciente preencher anamnese
    const baseUrl = getProductionUrl();
    const anamneseLink = `${baseUrl}/anamnese-inicial?paciente_id=${patient_id}`;

    // Enviar email para o paciente (se tiver email)
    let emailSent = false;
    if (patient.email) {
      try {
        const emailResult = await sendAnamneseEmail({
          to: patient.email,
          patientName: patient.name,
          anamneseLink: anamneseLink
        });
        emailSent = emailResult.success;
        if (!emailSent) {
          console.warn('⚠️ Email não foi enviado:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Erro ao tentar enviar email:', emailError);
        // Continua mesmo se o email falhar
      }
    }

    return NextResponse.json({ 
      message: emailSent 
        ? 'Anamnese enviada para o paciente por email' 
        : 'Anamnese criada. Link copiado para área de transferência',
      anamnese: newAnamnese,
      link: anamneseLink,
      emailSent: emailSent
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Erro no endpoint POST /api/anamnese-inicial:', error);
    console.error('  - Tipo:', typeof error);
    console.error('  - Mensagem:', error?.message);
    console.error('  - Stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}

// PUT /api/anamnese-inicial - Atualizar anamnese (paciente preenchendo)
// Permite acesso público para paciente preencher (sem autenticação)
export async function PUT(request: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // Usar service role key para bypass RLS em operações públicas
    // Tenta diferentes nomes de variáveis comuns
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY 
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseKey) {
      console.error('❌ Nenhuma chave Supabase configurada!');
      return NextResponse.json(
        { error: 'Configuração do servidor inválida' },
        { status: 500 }
      );
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const body = await request.json();
    const { paciente_id, ...anamneseData } = body;

    if (!paciente_id) {
      return NextResponse.json(
        { error: 'paciente_id é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se anamnese existe
    const { data: existingAnamnese, error: checkError } = await supabaseClient
      .from('a_cadastro_anamnese')
      .select('paciente_id, status')
      .eq('paciente_id', paciente_id)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Erro ao verificar anamnese existente:', checkError);
    }

    console.log('📋 Anamnese existente:', existingAnamnese);

    // Preparar dados completos para upsert (incluindo paciente_id)
    // Sempre definir status como 'preenchida' quando paciente submete o formulário
    const upsertData: any = {
      paciente_id: paciente_id,  // Chave primária - necessário para upsert
      status: 'preenchida',       // SEMPRE atualizar status para 'preenchida'
      updated_at: new Date().toISOString()
    };

    // Campos novos que podem não existir ainda no schema cache
    const camposNovos = ['idade', 'tipo_saguineo']; // ATENÇÃO: coluna é tipo_saguineo (com 'g'), não tipo_sanguineo
    
    // Adicionar apenas campos que têm valores do formulário
    Object.keys(anamneseData).forEach(key => {
      const value = (anamneseData as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        // Converter arrays JSON para formato correto se necessário
        if (Array.isArray(value)) {
          upsertData[key] = value;
        } 
        // Converter idade para string (coluna é TEXT)
        else if (key === 'idade') {
          // Garantir que idade seja salva como string
          if (typeof value === 'number') {
            upsertData[key] = String(value);
          } else if (typeof value === 'string' && value.trim() !== '') {
            upsertData[key] = value.trim();
          }
        }
        // tipo_sanguineo do formulário precisa ser mapeado para tipo_saguineo (com 'g') do banco
        else if (key === 'tipo_sanguineo' && typeof value === 'string') {
          upsertData['tipo_saguineo'] = value.trim(); // Mapear para o nome correto da coluna
        }
        else {
          upsertData[key] = value;
        }
      }
    });

    console.log('📤 Dados para upsert:', JSON.stringify(upsertData, null, 2));
    console.log('🔑 paciente_id:', paciente_id);
    console.log('📋 Status atual na anamnese existente:', existingAnamnese?.status);
    console.log('🎯 Status que será definido: preenchida');
    console.log('🔍 Verificando campos idade e tipo_saguineo no upsertData:');
    console.log('  - idade:', upsertData.idade, '(tipo:', typeof upsertData.idade, ')');
    console.log('  - tipo_saguineo:', upsertData.tipo_saguineo, '(tipo:', typeof upsertData.tipo_saguineo, ')');

    // Usar upsert para garantir que sempre funcione (cria se não existir, atualiza se existir)
    // O onConflict garante que se já existir um registro com esse paciente_id, ele será atualizado
    let { data: updatedAnamnese, error } = await supabaseClient
      .from('a_cadastro_anamnese')
      .upsert(upsertData, {
        onConflict: 'paciente_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    console.log('✅ Resultado do upsert:', { updatedAnamnese, error });
    if (updatedAnamnese) {
      console.log('✅ Status após upsert:', updatedAnamnese.status);
      console.log('✅ updated_at após upsert:', updatedAnamnese.updated_at);
      console.log('🔍 Campos idade e tipo_saguineo após upsert:');
      console.log('  - idade:', updatedAnamnese.idade, '(tipo:', typeof updatedAnamnese.idade, ')');
      console.log('  - tipo_saguineo:', updatedAnamnese.tipo_saguineo, '(tipo:', typeof updatedAnamnese.tipo_saguineo, ')');
    }

    // Se houve erro no upsert, tratar os erros antes de continuar
    if (error) {
      console.error('❌ Erro ao atualizar anamnese:', error);
      console.error('  - Código:', error.code);
      console.error('  - Mensagem:', error.message);
      console.error('  - Detalhes:', error.details);
      console.error('  - Hint:', error.hint);
      console.error('  - Dados tentados:', JSON.stringify(upsertData, null, 2));
      
      // Verificar se é erro de coluna inexistente no schema cache (PGRST204)
      if (error.code === 'PGRST204' || (error.details && error.details.includes('schema cache'))) {
        // Tentar fazer o upsert sem os campos novos (idade e tipo_saguineo) temporariamente
        const upsertDataSemNovos = { ...upsertData };
        delete upsertDataSemNovos.idade;
        delete upsertDataSemNovos.tipo_saguineo;
        delete upsertDataSemNovos.tipo_sanguineo; // Também remover o nome incorreto se existir
        
        console.log('⚠️ Tentando salvar sem os campos novos (idade, tipo_saguineo) devido ao erro de schema cache...');
        console.log('📤 Dados para upsert (sem novos campos):', JSON.stringify(upsertDataSemNovos, null, 2));
        
        // Tentar novamente sem os campos novos
        const { data: updatedAnamneseRetry, error: retryError } = await supabaseClient
          .from('a_cadastro_anamnese')
          .upsert(upsertDataSemNovos, {
            onConflict: 'paciente_id',
            ignoreDuplicates: false
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('❌ Erro mesmo sem os campos novos:', retryError);
          return NextResponse.json(
            { 
              error: 'Erro ao atualizar anamnese', 
              details: 'As colunas "idade" e "tipo_saguineo" não estão disponíveis no schema cache. Por favor, recarregue o schema do PostgREST no Supabase ou aguarde alguns minutos para o cache ser atualizado.',
              code: error.code,
              hint: 'Execute: NOTIFY pgrst, \'reload schema\'; no banco de dados ou recarregue o schema via Supabase Dashboard',
              originalError: error.message,
              retryError: retryError.message
            },
            { status: 500 }
          );
        }
        
        // Se salvou sem os campos novos, continuar para disparar webhook
        updatedAnamnese = updatedAnamneseRetry;
        console.log('⚠️ Continuando após salvar sem campos novos (idade e tipo_sanguineo) - ainda vai disparar webhook');
        // Não retornar aqui, continuar para disparar webhook
      }
      
      // Verificar se é erro de coluna inexistente
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Erro ao atualizar anamnese', 
            details: 'Uma ou mais colunas não existem na tabela. Verifique se as colunas "idade" e "tipo_saguineo" foram criadas corretamente.',
            code: error.code,
            hint: error.hint,
            message: error.message
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar anamnese', 
          details: error.message || 'Erro desconhecido',
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      );
    }

    // Buscar dados completos do paciente para enviar ao webhook
    const { data: pacienteData, error: pacienteError } = await supabaseClient
      .from('patients')
      .select('id, name, email, doctor_id')
      .eq('id', paciente_id)
      .single();

    if (pacienteError) {
      console.error('⚠️ Erro ao buscar dados do paciente para webhook:', pacienteError);
    }

    // Disparar webhook para processar anamnese
    let webhookResponse = null;
    let webhookError = null;
    
    console.log('🚀 Iniciando disparo do webhook...');
    
    try {
      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();
      
      console.log('🔗 Webhook endpoint:', webhookEndpoints.anamnese);
      console.log('🔐 Webhook headers:', JSON.stringify(webhookHeaders, null, 2));
      
      const webhookPayload = {
        paciente_id: paciente_id,
        anamnese_data: updatedAnamnese,
        paciente_nome: pacienteData?.name || null,
        paciente_email: pacienteData?.email || null,
        doctor_id: pacienteData?.doctor_id || null,
        status: updatedAnamnese?.status || 'preenchida'
      };

      console.log('📤 Enviando anamnese para webhook:', webhookEndpoints.anamnese);
      console.log('📦 Payload do webhook:', JSON.stringify(webhookPayload, null, 2));

      const webhookFetch = await fetch(webhookEndpoints.anamnese, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify(webhookPayload),
      });

      if (webhookFetch.ok) {
        webhookResponse = await webhookFetch.json();
        console.log('✅ Webhook executado com sucesso:', webhookResponse);

        // Se o webhook retornar dados atualizados, salvar no banco
        if (webhookResponse && webhookResponse.anamnese_atualizada) {
          console.log('🔄 Atualizando anamnese com dados do webhook...');
          
          const webhookData = webhookResponse.anamnese_atualizada;
          
          // Preparar dados do webhook para atualização
          const webhookUpdateData: any = {
            paciente_id: paciente_id,
            updated_at: new Date().toISOString()
          };

          // Adicionar apenas campos válidos do webhook
          Object.keys(webhookData).forEach(key => {
            const value = webhookData[key];
            if (value !== undefined && value !== null && value !== '') {
              webhookUpdateData[key] = value;
            }
          });

          console.log('📤 Dados do webhook para atualizar:', JSON.stringify(webhookUpdateData, null, 2));

          // Atualizar anamnese com dados do webhook
          const { data: finalAnamnese, error: webhookUpdateError } = await supabaseClient
            .from('a_cadastro_anamnese')
            .upsert(webhookUpdateData, {
              onConflict: 'paciente_id',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (webhookUpdateError) {
            console.error('⚠️ Erro ao atualizar anamnese com dados do webhook:', webhookUpdateError);
          } else {
            console.log('✅ Anamnese atualizada com dados do webhook:', finalAnamnese);
            // Usar os dados atualizados como resposta
            if (finalAnamnese) {
              updatedAnamnese = finalAnamnese;
            }
          }
        }
      } else {
        const errorText = await webhookFetch.text();
        webhookError = {
          status: webhookFetch.status,
          statusText: webhookFetch.statusText,
          body: errorText
        };
        console.error('❌ Erro na resposta do webhook:', webhookError);
        console.error('  - Status:', webhookFetch.status);
        console.error('  - StatusText:', webhookFetch.statusText);
        console.error('  - Body:', errorText);
      }
    } catch (webhookErr) {
      webhookError = webhookErr instanceof Error ? webhookErr.message : 'Erro desconhecido';
      console.error('❌ Erro ao chamar webhook:', webhookError);
      console.error('  - Tipo:', typeof webhookErr);
      console.error('  - Stack:', webhookErr instanceof Error ? webhookErr.stack : 'N/A');
      // Não falhar a requisição se o webhook falhar, mas logar o erro
    }

    console.log('📊 Resumo final:');
    console.log('  - Webhook executado:', webhookResponse !== null ? 'Sim' : 'Não');
    console.log('  - Webhook erro:', webhookError || 'Nenhum');
    console.log('  - Anamnese final:', updatedAnamnese ? 'Salva' : 'Não salva');

    return NextResponse.json({ 
      message: 'Anamnese salva com sucesso',
      anamnese: updatedAnamnese,
      webhookExecutado: webhookResponse !== null,
      webhookErro: webhookError
    });

  } catch (error: any) {
    console.error('❌ Erro no endpoint PUT /api/anamnese-inicial:', error);
    console.error('  - Tipo:', typeof error);
    console.error('  - Mensagem:', error?.message);
    console.error('  - Stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}

