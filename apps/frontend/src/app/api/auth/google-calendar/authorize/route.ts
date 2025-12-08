import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Escopos necessários para o Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * GET /api/auth/google-calendar/authorize
 * Inicia o fluxo OAuth redirecionando para o Google
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se usuário está autenticado
    const authResult = await getAuthenticatedSession();
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { user } = authResult;

    // Variáveis de ambiente
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('Variáveis GOOGLE_CALENDAR_* não configuradas');
      return NextResponse.json(
        { error: 'Configuração do Google Calendar incompleta' },
        { status: 500 }
      );
    }

    // Gerar state para prevenir CSRF (inclui o user_id)
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64');

    // Construir URL de autorização do Google
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline'); // Para obter refresh_token
    authUrl.searchParams.set('prompt', 'consent'); // Força mostrar tela de consentimento
    authUrl.searchParams.set('state', state);

    // Redirecionar para o Google
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Erro ao iniciar OAuth do Google Calendar:', error);
    return NextResponse.json(
      { error: 'Erro interno ao iniciar autorização' },
      { status: 500 }
    );
  }
}
