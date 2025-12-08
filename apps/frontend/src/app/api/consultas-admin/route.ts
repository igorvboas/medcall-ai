import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// URL do Gateway para chamadas de admin
const GATEWAY_URL = process.env.GATEWAY_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

// Função helper para verificar se o usuário é admin
async function verifyAdmin(supabase: any, doctorAuthId: string) {
  const { data: medico, error: medicoError } = await supabase
    .from('medicos')
    .select('id, admin')
    .eq('user_auth', doctorAuthId)
    .single();
  
  if (medicoError || !medico) {
    return { isAdmin: false, error: 'Médico não encontrado no sistema' };
  }

  if (medico.admin !== true) {
    return { isAdmin: false, error: 'Acesso negado. Apenas administradores podem acessar este recurso.' };
  }

  return { isAdmin: true, medico };
}

// GET /api/consultas-admin - Listar todas as consultas abertas (apenas para admins)
export async function GET(request: NextRequest) {
  try {
    console.log('=== GET /api/consultas-admin ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;
    const doctorAuthId = user.id;

    // Verificar se o usuário é admin
    const adminCheck = await verifyAdmin(supabase, doctorAuthId);
    if (!adminCheck.isAdmin) {
      console.error('❌ Acesso negado:', adminCheck.error);
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.error?.includes('não encontrado') ? 404 : 403 }
      );
    }

    // Parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Buscar call_sessions com WebRTC ativo (conexão peer-to-peer real)
    // Esta é a forma correta de identificar chamadas realmente ativas
    const { data: activeSessions, error: sessionsError, count } = await supabase
      .from('call_sessions')
      .select(`
        id,
        room_id,
        consultation_id,
        status,
        webrtc_active,
        started_at,
        created_at
      `, { count: 'exact' })
      .eq('webrtc_active', true)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (sessionsError) {
      console.error('❌ Erro ao buscar sessões ativas:', sessionsError);
      return NextResponse.json(
        { error: 'Erro ao buscar sessões ativas' },
        { status: 500 }
      );
    }

    // Buscar informações adicionais: dados da consulta e do médico
    const enrichedConsultations = await Promise.all(
      (activeSessions || []).map(async (session) => {
        let consultation = null;
        let medicoEmail = null;
        let medicoName = null;

        // Buscar dados da consulta
        if (session.consultation_id) {
          const { data: consultationData } = await supabase
            .from('consultations')
            .select(`
              id,
              doctor_id,
              patient_id,
              status,
              consulta_inicio,
              patient_name,
              consultation_type,
              created_at
            `)
            .eq('id', session.consultation_id)
            .single();
          
          consultation = consultationData;

          // Buscar email do médico
          if (consultation?.doctor_id) {
            const { data: medicoData } = await supabase
              .from('medicos')
              .select('email, name')
              .eq('id', consultation.doctor_id)
              .single();
            
            medicoEmail = medicoData?.email || null;
            medicoName = medicoData?.name || null;
          }
        }

        return {
          id: consultation?.id || session.consultation_id || session.id,
          doctor_id: consultation?.doctor_id || null,
          patient_id: consultation?.patient_id || null,
          patient_name: consultation?.patient_name || 'Não identificado',
          consultation_type: consultation?.consultation_type || 'TELEMEDICINA',
          status: consultation?.status || 'RECORDING',
          consulta_inicio: consultation?.consulta_inicio || session.started_at,
          created_at: consultation?.created_at || session.created_at,
          medico_email: medicoEmail,
          medico_name: medicoName,
          room_id: session.room_id,
          session_status: session.status,
          webrtc_active: true, // Sempre true pois filtramos por isso
        };
      })
    );

    console.log(`✅ Encontradas ${enrichedConsultations.length} consultas abertas`);

    return NextResponse.json({
      consultations: enrichedConsultations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /api/consultas-admin:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/consultas-admin - Encerrar uma chamada (apenas para admins)
export async function POST(request: NextRequest) {
  try {
    console.log('=== POST /api/consultas-admin ===');
    
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase, user } = authResult;
    const doctorAuthId = user.id;

    // Verificar se o usuário é admin
    const adminCheck = await verifyAdmin(supabase, doctorAuthId);
    if (!adminCheck.isAdmin) {
      console.error('❌ Acesso negado:', adminCheck.error);
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.error?.includes('não encontrado') ? 404 : 403 }
      );
    }

    // Obter dados do body
    const body = await request.json();
    const { action, roomId, consultationId, reason } = body;

    if (action !== 'terminate') {
      return NextResponse.json(
        { error: 'Ação inválida. Use action: "terminate"' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId é obrigatório para encerrar a chamada' },
        { status: 400 }
      );
    }

    console.log(`🛑 [ADMIN] Encerramento solicitado para room: ${roomId}`);

    // Chamar endpoint do Gateway para encerrar a sala
    try {
      const gatewayResponse = await fetch(`${GATEWAY_URL}/api/rooms/admin/terminate/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Encerrado pelo administrador',
        }),
      });

      const gatewayData = await gatewayResponse.json();

      if (!gatewayResponse.ok) {
        console.error('❌ Erro do Gateway:', gatewayData);
        
        // Se a sala não foi encontrada no gateway, ainda assim atualizar o banco
        if (gatewayResponse.status === 404) {
          console.log('⚠️ Sala não encontrada no Gateway, atualizando banco diretamente...');
          
          // Atualizar call_session no banco
          await supabase
            .from('call_sessions')
            .update({
              status: 'ended',
              webrtc_active: false,
              ended_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('room_id', roomId);

          // Atualizar consulta se fornecida
          if (consultationId) {
            await supabase
              .from('consultations')
              .update({
                status: 'CANCELLED',
                notes: `Encerrado pelo administrador: ${reason || 'Encerramento administrativo'}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', consultationId);
          }

          return NextResponse.json({
            success: true,
            message: 'Chamada encerrada (sala não estava mais ativa no gateway)',
            roomId,
          });
        }

        return NextResponse.json(
          { error: gatewayData.error || 'Erro ao encerrar chamada no Gateway' },
          { status: gatewayResponse.status }
        );
      }

      console.log(`✅ [ADMIN] Chamada encerrada com sucesso: ${roomId}`);

      return NextResponse.json({
        success: true,
        message: 'Chamada encerrada com sucesso',
        roomId,
        gatewayResponse: gatewayData,
      });

    } catch (gatewayError) {
      console.error('❌ Erro ao conectar com Gateway:', gatewayError);
      
      // Fallback: atualizar diretamente no banco se gateway não estiver disponível
      console.log('⚠️ Gateway indisponível, atualizando banco diretamente...');
      
      await supabase
        .from('call_sessions')
        .update({
          status: 'ended',
          webrtc_active: false,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId);

      if (consultationId) {
        await supabase
          .from('consultations')
          .update({
            status: 'CANCELLED',
            notes: `Encerrado pelo administrador: ${reason || 'Encerramento administrativo'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', consultationId);
      }

      return NextResponse.json({
        success: true,
        message: 'Chamada encerrada (via banco de dados - gateway indisponível)',
        roomId,
        warning: 'Gateway não estava disponível, participantes podem não ter sido notificados',
      });
    }

  } catch (error) {
    console.error('Erro no endpoint POST /api/consultas-admin:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
