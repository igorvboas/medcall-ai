import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { sendAnamneseEmail } from '@/lib/email-service';

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

    // Adicionar apenas campos que têm valores do formulário
    Object.keys(anamneseData).forEach(key => {
      const value = (anamneseData as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        // Converter arrays JSON para formato correto se necessário
        if (Array.isArray(value)) {
          upsertData[key] = value;
        } else {
          upsertData[key] = value;
        }
      }
    });

    console.log('📤 Dados para upsert:', JSON.stringify(upsertData, null, 2));
    console.log('🔑 paciente_id:', paciente_id);
    console.log('📋 Status atual na anamnese existente:', existingAnamnese?.status);
    console.log('🎯 Status que será definido: preenchida');

    // Usar upsert para garantir que sempre funcione (cria se não existir, atualiza se existir)
    // O onConflict garante que se já existir um registro com esse paciente_id, ele será atualizado
    const { data: updatedAnamnese, error } = await supabaseClient
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
    }

    if (error) {
      console.error('❌ Erro ao atualizar anamnese:', error);
      console.error('  - Código:', error.code);
      console.error('  - Mensagem:', error.message);
      console.error('  - Detalhes:', error.details);
      console.error('  - Hint:', error.hint);
      console.error('  - Dados tentados:', JSON.stringify(updateData, null, 2));
      return NextResponse.json(
        { 
          error: 'Erro ao atualizar anamnese', 
          details: error.message,
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Anamnese salva com sucesso',
      anamnese: updatedAnamnese
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

