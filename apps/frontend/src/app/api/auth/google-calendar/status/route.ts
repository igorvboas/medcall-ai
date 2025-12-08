import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google-calendar/status
 * Retorna o status da integração com Google Calendar do usuário
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        connected: false,
        error: 'Médico não encontrado',
      });
    }

    // Buscar tokens do Google Calendar
    const { data: tokens, error: tokensError } = await supabase
      .from('google_calendar_tokens')
      .select('id, google_email, calendar_id, calendar_name, sync_enabled, last_sync_at, token_expiry')
      .eq('medico_id', medico.id)
      .single();

    if (tokensError || !tokens) {
      return NextResponse.json({
        connected: false,
      });
    }

    // Verificar se o token está expirado
    const isExpired = new Date(tokens.token_expiry) < new Date();

    return NextResponse.json({
      connected: true,
      syncEnabled: tokens.sync_enabled,
      googleEmail: tokens.google_email,
      calendarId: tokens.calendar_id,
      calendarName: tokens.calendar_name,
      lastSyncAt: tokens.last_sync_at,
      isExpired,
    });
  } catch (error) {
    console.error('Erro ao verificar status do Google Calendar:', error);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}
