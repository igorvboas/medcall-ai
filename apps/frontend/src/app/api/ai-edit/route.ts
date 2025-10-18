import { NextRequest, NextResponse } from 'next/server';
import { getWebhookHeaders } from '@/lib/webhook-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhookUrl, ...requestBody } = body;
    
    console.log('🔍 Enviando requisição para webhook de edição IA:', requestBody);
    console.log('🔗 URL do webhook:', webhookUrl);
    
    console.log('🚀 Fazendo requisição POST para:', webhookUrl);
    console.log('📦 Body da requisição:', JSON.stringify(requestBody, null, 2));
    console.log('⏰ Timestamp da requisição:', new Date().toISOString());
    
    // Log para verificar se está sendo chamado
    console.log('✅ CONFIRMANDO: API ai-edit foi chamada com sucesso!');
    
    const webhookHeaders = getWebhookHeaders();
    console.log('🔐 Headers de autorização:', webhookHeaders);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        ...webhookHeaders,
        'User-Agent': 'MedCall-AI-Frontend/1.0',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Capturar o response body para debug
    const responseText = await response.text();
    console.log('📄 Response body:', responseText);

    if (!response.ok) {
      console.warn(`⚠️ Webhook responded with status: ${response.status}`);
      console.warn(`⚠️ Response body:`, responseText);
      
      // Para erro 404, retorna uma mensagem específica
      if (response.status === 404) {
        return NextResponse.json({ 
          success: false, 
          warning: 'Workflow não ativo',
          message: 'O workflow de IA não está ativo no n8n. Ative o workflow "usi-input-edicao-diagnostico" no n8n.',
          details: responseText
        });
      }
      // Para outros erros, retorna mensagem genérica
      return NextResponse.json({ 
        success: false, 
        warning: `Webhook retornou erro ${response.status}`,
        message: 'Serviço de IA temporariamente indisponível. Tente novamente mais tarde.',
        details: responseText
      });
    }

    console.log('✅ Webhook responded successfully:', responseText);
    
    return NextResponse.json({ success: true, result: responseText });
  } catch (error) {
    console.error('❌ Erro ao chamar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar edição com IA' },
      { status: 500 }
    );
  }
}
