import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Implementar lógica para gerar token
    return NextResponse.json({ 
      token: 'mock-token-' + Date.now(),
      expires: Date.now() + 3600000 // 1 hora
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar token' },
      { status: 500 }
    );
  }
}
