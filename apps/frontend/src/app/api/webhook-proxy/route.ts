import { NextRequest, NextResponse } from 'next/server';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, payload } = body;

    if (!endpoint || !payload) {
      return NextResponse.json(
        { error: 'Endpoint e payload são obrigatórios' },
        { status: 400 }
      );
    }

    const webhookEndpoints = getWebhookEndpoints();
    const webhookHeaders = getWebhookHeaders();

    // Mapear endpoint para URL real
    const endpointMap: Record<string, string> = {
      'edicaoSolucao': webhookEndpoints.edicaoSolucao,
      'edicaoAnamnese': webhookEndpoints.edicaoAnamnese,
      'edicaoDiagnostico': webhookEndpoints.edicaoDiagnostico,
    };

    const webhookUrl = endpointMap[endpoint];
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Endpoint inválido' },
        { status: 400 }
      );
    }

    console.log('📤 [WEBHOOK-PROXY] Enviando para:', webhookUrl);
    console.log('📤 [WEBHOOK-PROXY] Payload:', payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 [WEBHOOK-PROXY] Resposta:', response.status, responseText);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data: responseText
    });

  } catch (error) {
    console.error('❌ [WEBHOOK-PROXY] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar webhook', details: String(error) },
      { status: 500 }
    );
  }
}

