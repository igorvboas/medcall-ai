import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { sendAnamneseEmail } from '@/lib/email-service';

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : 'http://localhost:3000');
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : 'http://localhost:3000');
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

    // Preparar dados para atualização, removendo campos undefined/null vazios
    // IMPORTANTE: status deve ser sempre 'preenchida' quando o paciente salva
    const updateData: any = {
      status: 'preenchida', // SEMPRE definir como preenchida
      updated_at: new Date().toISOString()
    };

    // Adicionar apenas campos que têm valores (mas não sobrescrever o status)
    Object.keys(anamneseData).forEach(key => {
      // Ignorar 'status' se vier no formData (não deve sobrescrever)
      if (key === 'status') {
        console.log('⚠️ Campo "status" ignorado do formData, usando "preenchida"');
        return;
      }
      
      const value = (anamneseData as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        // Converter arrays JSON para formato correto se necessário
        if (Array.isArray(value)) {
          updateData[key] = value;
        } else {
          updateData[key] = value;
        }
      }
    });
    
    // Garantir que status está sempre como 'preenchida'
    updateData.status = 'preenchida';
    console.log('✅ Status garantido como "preenchida" no updateData');

    console.log('💾 Atualizando anamnese para paciente_id:', paciente_id);
    console.log('💾 Dados para atualização:', JSON.stringify(updateData, null, 2));
    
    // Como paciente_id é PRIMARY KEY, só pode haver um registro por paciente
    // Primeiro verificar se existe, depois atualizar ou criar
    const { data: existingAnamnese } = await supabaseClient
      .from('a_cadastro_anamnese')
      .select('paciente_id, status')
      .eq('paciente_id', paciente_id)
      .maybeSingle();
    
    console.log('🔍 Anamnese existente:', existingAnamnese);
    
    let updatedAnamnese;
    let error;
    
    if (existingAnamnese) {
      // Atualizar registro existente usando paciente_id (PRIMARY KEY)
      console.log('📝 Atualizando registro existente...');
      const { data, error: updateError } = await supabaseClient
        .from('a_cadastro_anamnese')
        .update(updateData)
        .eq('paciente_id', paciente_id) // Usar PRIMARY KEY diretamente
        .select('paciente_id, status, updated_at')
        .single();
      
      updatedAnamnese = data;
      error = updateError;
      
      if (data) {
        console.log('✅ Registro atualizado. Status retornado:', data.status);
      }
    } else {
      // Criar novo registro se não existir
      console.log('➕ Criando novo registro...');
      const { data, error: insertError } = await supabaseClient
        .from('a_cadastro_anamnese')
        .insert({
          paciente_id: paciente_id,
          ...updateData
        })
        .select('paciente_id, status, updated_at')
        .single();
      
      updatedAnamnese = data;
      error = insertError;
      
      if (data) {
        console.log('✅ Novo registro criado. Status:', data.status);
      }
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

    console.log('✅ Anamnese atualizada com sucesso:', updatedAnamnese);
    console.log('✅ Status atualizado para:', updatedAnamnese?.status);

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

