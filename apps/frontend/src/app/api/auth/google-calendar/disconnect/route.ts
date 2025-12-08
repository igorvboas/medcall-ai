import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/google-calendar/disconnect
 * Remove a integração com Google Calendar do usuário
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se usuário está autenticado
    const authResult = await getAuthenticatedSession();
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { supabase, user } = authResult;

    // Buscar o médico associado ao usuário
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

    // Buscar tokens antes de deletar (para revogar no Google)
    const { data: tokens } = await supabase
      .from('google_calendar_tokens')
      .select('access_token')
      .eq('medico_id', medico.id)
      .single();

    // Revogar token no Google (opcional, mas recomendado)
    if (tokens?.access_token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`,
          { method: 'POST' }
        );
      } catch (revokeError) {
        console.warn('Erro ao revogar token no Google:', revokeError);
        // Continua mesmo se falhar a revogação
      }
    }

    // Deletar tokens do banco
    const { error: deleteError } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('medico_id', medico.id);

    if (deleteError) {
      console.error('Erro ao deletar tokens:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao desconectar' },
        { status: 500 }
      );
    }

    // Limpar referências de sync nas consultas (opcional)
    await supabase
      .from('consultations')
      .update({
        google_event_id: null,
        google_calendar_id: null,
        sync_status: 'local_only',
        last_synced_at: null,
      })
      .eq('doctor_id', medico.id)
      .not('google_event_id', 'is', null);

    return NextResponse.json({
      success: true,
      message: 'Google Calendar desconectado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao desconectar Google Calendar:', error);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}
