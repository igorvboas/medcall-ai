import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google-calendar/callback
 * Recebe o código de autorização do Google e troca por tokens
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Se o usuário cancelou ou houve erro
    if (error) {
      console.error('Erro no OAuth do Google:', error);
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=access_denied', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=no_code', request.url)
      );
    }

    // Verificar se usuário está autenticado
    const authResult = await getAuthenticatedSession();
    if (!authResult) {
      return NextResponse.redirect(
        new URL('/auth/signin?redirect=/agenda', request.url)
      );
    }

    const { supabase, user } = authResult;

    // Validar state (previne CSRF)
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        if (stateData.userId !== user.id) {
          console.error('State userId não corresponde ao usuário logado');
          return NextResponse.redirect(
            new URL('/agenda?google_calendar_error=invalid_state', request.url)
          );
        }
      } catch {
        console.error('Erro ao decodificar state');
      }
    }

    // Variáveis de ambiente
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=config_error', request.url)
      );
    }

    // Trocar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Erro ao trocar código por token:', errorData);
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token || !refresh_token) {
      console.error('Tokens incompletos:', tokens);
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=incomplete_tokens', request.url)
      );
    }

    // Obter informações do usuário Google (email)
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    let googleEmail = null;
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      googleEmail = userInfo.email;
    }

    // Buscar o médico associado ao usuário
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', user.id)
      .single();

    if (medicoError || !medico) {
      console.error('Médico não encontrado:', medicoError);
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=medico_not_found', request.url)
      );
    }

    // Calcular expiração do token
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Salvar ou atualizar tokens no banco
    const { error: upsertError } = await supabase
      .from('google_calendar_tokens')
      .upsert(
        {
          medico_id: medico.id,
          access_token,
          refresh_token,
          token_expiry: tokenExpiry.toISOString(),
          google_email: googleEmail,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'medico_id',
        }
      );

    if (upsertError) {
      console.error('Erro ao salvar tokens:', upsertError);
      return NextResponse.redirect(
        new URL('/agenda?google_calendar_error=save_failed', request.url)
      );
    }

    // Sucesso! Redirecionar para a agenda
    return NextResponse.redirect(
      new URL('/agenda?google_calendar_connected=true', request.url)
    );
  } catch (error) {
    console.error('Erro no callback do Google Calendar:', error);
    return NextResponse.redirect(
      new URL('/agenda?google_calendar_error=unknown', request.url)
    );
  }
}
