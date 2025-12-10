import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// Tipos locais para pacientes
interface CreatePatientData {
  name: string;
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
}

// GET /api/patients - Listar pacientes do médico logado
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/patients ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorAuthId = user.id;

    // ✅ Buscar médico na tabela medicos usando a FK do auth.users
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status') as 'active' | 'inactive' | 'archived' | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('doctor_id', medico.id) // ✅ Usar medicos.id, não auth.users.id
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: patients, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar pacientes' },
        { status: 500 }
      );
    }

    // Buscar status das anamneses para cada paciente
    const patientIds = patients?.map(p => p.id) || [];
    let anamnesesMap: Record<string, any> = {};
    
    if (patientIds.length > 0) {
      console.log('🔍 Buscando anamneses para pacientes:', patientIds);
      
      // Buscar anamneses - usar DISTINCT ON ou pegar o mais recente de cada paciente
      // Primeiro, buscar todas as anamneses ordenadas por updated_at (mais recente primeiro)
      const { data: anamneses, error: anamnesesError } = await supabase
        .from('a_cadastro_anamnese')
        .select('paciente_id, status, updated_at, created_at')
        .in('paciente_id', patientIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      // Se houver múltiplos registros para o mesmo paciente, pegar apenas o mais recente
      const anamnesesByPatient: Record<string, any> = {};
      if (anamneses) {
        anamneses.forEach(an => {
          const patientId = String(an.paciente_id);
          
          // Se ainda não tem registro para este paciente, ou se este é mais recente
          if (!anamnesesByPatient[patientId]) {
            anamnesesByPatient[patientId] = an;
          } else {
            // Comparar datas para pegar o mais recente
            const currentDate = an.updated_at ? new Date(an.updated_at) : (an.created_at ? new Date(an.created_at) : new Date(0));
            const existingDate = anamnesesByPatient[patientId].updated_at 
              ? new Date(anamnesesByPatient[patientId].updated_at) 
              : (anamnesesByPatient[patientId].created_at ? new Date(anamnesesByPatient[patientId].created_at) : new Date(0));
            
            if (currentDate > existingDate) {
              anamnesesByPatient[patientId] = an;
            }
          }
        });
      }
      
      const uniqueAnamneses = Object.values(anamnesesByPatient);
      
      console.log('🔍 Anamneses antes da deduplicação:', anamneses?.length || 0);
      console.log('🔍 Anamneses após deduplicação:', uniqueAnamneses.length);
      
      if (anamnesesError) {
        console.error('❌ Erro ao buscar anamneses:', anamnesesError);
        console.error('  - Código:', anamnesesError.code);
        console.error('  - Mensagem:', anamnesesError.message);
        console.error('  - Detalhes:', anamnesesError.details);
      }
      
      if (uniqueAnamneses && uniqueAnamneses.length > 0) {
        console.log('📝 Anamneses encontradas (após deduplicação):', JSON.stringify(uniqueAnamneses, null, 2));
        console.log('📝 Total de anamneses únicas:', uniqueAnamneses.length);
        
        uniqueAnamneses.forEach(an => {
          console.log(`  - paciente_id: ${an.paciente_id}, status: ${an.status} (tipo: ${typeof an.status})`);
          // Normalizar o status para lowercase para comparação consistente
          const normalizedStatus = an.status ? String(an.status).toLowerCase() : null;
          anamnesesMap[an.paciente_id] = { 
            status: normalizedStatus,
            updated_at: an.updated_at 
          };
        });
        
        console.log('📝 Mapa de anamneses criado:', JSON.stringify(anamnesesMap, null, 2));
      } else {
        console.log('⚠️ Nenhuma anamnese encontrada para os pacientes:', patientIds);
        if (anamneses && anamneses.length > 0) {
          console.log('⚠️ Mas foram encontradas anamneses antes da deduplicação:', anamneses.length);
        }
      }
    }
    
    // Processar pacientes adicionando status da anamnese
    const processedPatients = patients?.map(patient => {
      // Tentar encontrar anamnese usando o ID do paciente (pode ser UUID ou string)
      let anamnese = anamnesesMap[patient.id] || null;
      
      // Se não encontrou, tentar buscar por todas as chaves do mapa (pode haver diferença de tipo)
      if (!anamnese) {
        const patientIdStr = String(patient.id);
        for (const [key, value] of Object.entries(anamnesesMap)) {
          if (String(key) === patientIdStr) {
            anamnese = value;
            console.log(`  ✅ Encontrado por conversão de tipo: ${patient.name} (${patient.id} = ${key})`);
            break;
          }
        }
      }
      
      console.log(`  Paciente ${patient.name} (ID: ${patient.id}, tipo: ${typeof patient.id}): anamnese =`, anamnese);
      
      return {
        ...patient,
        anamnese: anamnese
      };
    }) || [];
    
    console.log('✅ Pacientes processados com anamnese:', processedPatients.map(p => ({
      name: p.name,
      id: p.id,
      anamnese: p.anamnese
    })));

    return NextResponse.json({
      patients: processedPatients || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/patients:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/patients - Criar novo paciente
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/patients ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      console.log('❌ Não autorizado');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, session, user } = authResult;
    const doctorId = user.id;
    console.log('✅ Doctor ID:', doctorId);
    
    const body: CreatePatientData = await request.json();
    console.log('📝 Dados recebidos:', body);

    // Validação básica
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // ✅ Buscar médico na tabela medicos usando a FK do auth.users
    console.log('🔍 Buscando médico com user_auth:', doctorId);
    
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name, email')
      .eq('user_auth', doctorId)
      .single();
    
    if (medicoError) {
      console.error('❌ Erro ao buscar médico:', medicoError);
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema', details: medicoError.message },
        { status: 404 }
      );
    }
    
    if (!medico) {
      console.log('❌ Médico não encontrado na tabela medicos');
      return NextResponse.json(
        { error: 'Médico não encontrado no sistema' },
        { status: 404 }
      );
    }
    
    console.log('✅ Médico encontrado:', medico);

    // Preparar dados para inserção usando o ID do médico (não do auth.users)
    const patientData = {
      ...body,
      doctor_id: medico.id, // ✅ Usar medicos.id, não auth.users.id
      name: body.name.trim(),
      status: 'active'
    };
    
    // Limpar campos vazios
    Object.keys(patientData).forEach(key => {
      const value = (patientData as any)[key];
      if (value === '' || value === undefined || value === null) {
        delete (patientData as any)[key];
      }
    });
    
    console.log('💾 Dados para inserção:', patientData);

    const { data: patient, error } = await supabase
      .from('patients')
      .insert(patientData)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar paciente:', error);
      return NextResponse.json(
        { error: 'Erro ao criar paciente', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Paciente criado:', patient);
    return NextResponse.json({ patient }, { status: 201 });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}