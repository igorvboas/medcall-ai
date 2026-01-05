import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// GET /api/exames/[consultaId] - Buscar exames de uma consulta
export async function GET(
  request: NextRequest,
  { params }: { params: { consultaId: string } }
) {
  try {
    const authResult = await getAuthenticatedSession();
    
    if (!authResult) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const { supabase } = authResult;
    const consultaId = params.consultaId;

    // Buscar links de exames da tabela a_observacao_clinica_lab
    const { data: observacaoLab, error: observacaoError } = await supabase
      .from('a_observacao_clinica_lab')
      .select('links_exames')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (observacaoError && observacaoError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar exames:', observacaoError);
      return NextResponse.json(
        { error: 'Erro ao buscar exames' },
        { status: 500 }
      );
    }

    const linksExames = observacaoLab?.links_exames || [];
    
    // Processar links para criar lista de exames
    const exames = linksExames.map((url: string, index: number) => {
      // Extrair nome do arquivo da URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1] || `exame-${index + 1}.pdf`;
      
      // Tentar extrair nome do exame removendo timestamp e hash
      // Formato esperado: exames/{consultaId}/{timestamp}_{hash}.{ext}
      const fileExtension = fileName.split('.').pop() || 'pdf';
      // Por enquanto, vamos usar um nome genérico baseado no índice
      // TODO: Melhorar extração de nome do arquivo se houver metadados
      const examName = `Exame ${index + 1}`;
      
      // Tentar extrair data da URL ou usar data atual
      // Como não temos data específica, vamos usar a data de criação do registro
      const createdAt = observacaoLab?.created_at || new Date().toISOString();
      const examDate = new Date(createdAt).toLocaleDateString('pt-BR');
      
      // Determinar tipo do exame baseado na extensão
      let examType = 'Sangue'; // padrão
      const ext = fileExtension.toLowerCase();
      if (ext === 'pdf') {
        examType = 'Sangue';
      } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
        examType = 'Imagem';
      } else if (['doc', 'docx'].includes(ext)) {
        examType = 'Documento';
      }

      return {
        id: `exame-${index}`,
        nome: examName,
        dataAnexo: examDate,
        tipo: examType,
        url: url,
        fileName: fileName
      };
    });

    return NextResponse.json({
      exames: exames,
      total: exames.length
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar exames:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}

