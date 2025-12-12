import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';
import { logAudit, getAuditContext, sanitizeData } from '@/lib/audit-helper';

// Tipos locais para pacientes
interface CreatePatientData {
  name: string;
  email?: string;
  phone?: string;
  cep?: string;
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
  profile_pic?: string;
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
      const { data: anamneses } = await supabase
        .from('a_cadastro_anamnese')
        .select('paciente_id, status')
        .in('paciente_id', patientIds);
      
      if (anamneses) {
        anamneses.forEach(an => {
          anamnesesMap[an.paciente_id] = { status: an.status };
        });
      }
    }
    
    // Processar pacientes adicionando status da anamnese
    const processedPatients = patients?.map(patient => ({
      ...patient,
      anamnese: anamnesesMap[patient.id] || null
    })) || [];

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar pacientes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      patients: processedPatients,
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

    // Registrar log de auditoria
    const auditContext = getAuditContext(request);
    await logAudit({
      user_id: doctorId,
      user_email: user.email,
      user_name: medico.name,
      user_role: 'medico',
      action: 'CREATE',
      resource_type: 'patients',
      resource_id: patient.id,
      resource_description: `Paciente: ${patient.name}`,
      related_patient_id: patient.id,
      ...auditContext,
      http_method: 'POST',
      data_category: 'sensivel',
      legal_basis: 'tutela_saude',
      purpose: 'Cadastro de novo paciente',
      contains_sensitive_data: true,
      data_after: sanitizeData(patient),
      metadata: {
        has_cpf: !!patient.cpf,
        has_email: !!patient.email,
        has_medical_history: !!patient.medical_history
      }
    });

    return NextResponse.json({ patient }, { status: 201 });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}