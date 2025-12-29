import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/supabase-server';

// Tipo para os logs de auditoria
interface AuditLog {
    id: string;
    created_at: string;
    table_ref: string | null;
    medico_solicitation: string | null;
    data_before: Record<string, any> | null;
    data_after: Record<string, any> | null;
    action: string;
    user_name: string | null;
}

// GET /api/audit-logs/[consultaId] - Buscar histórico de alterações de um campo
export async function GET(
    request: NextRequest,
    { params }: { params: { consultaId: string } }
) {
    try {
        console.log('=== GET /api/audit-logs/[consultaId] ===');

        const authResult = await getAuthenticatedSession();

        if (!authResult) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { supabase } = authResult;
        const consultaId = params.consultaId;

        // Pegar o fieldPath da query string
        const { searchParams } = new URL(request.url);
        const fieldPath = searchParams.get('fieldPath');

        if (!fieldPath) {
            return NextResponse.json(
                { error: 'fieldPath é obrigatório' },
                { status: 400 }
            );
        }

        console.log('🔍 Buscando audit logs para:', { consultaId, fieldPath });

        // Buscar logs de auditoria filtrados
        const { data: auditLogs, error: logsError } = await supabase
            .from('audit_logs')
            .select(`
        id,
        created_at,
        table_ref,
        medico_solicitation,
        data_before,
        data_after,
        action,
        user_name
      `)
            .eq('related_consultation_id', consultaId)
            .eq('table_ref', fieldPath)
            .order('created_at', { ascending: true });

        console.log('📊 Query executada:', {
            related_consultation_id: consultaId,
            table_ref: fieldPath,
            resultsCount: auditLogs?.length || 0,
            error: logsError
        });

        if (logsError) {
            console.error('❌ Erro ao buscar audit logs:', logsError);
            return NextResponse.json(
                { error: 'Erro ao buscar histórico de alterações' },
                { status: 500 }
            );
        }

        console.log(`✅ Encontrados ${auditLogs?.length || 0} registros de auditoria`);

        // Processar logs para extrair apenas o campo específico
        const processedLogs = (auditLogs || []).map((log: AuditLog) => {
            // Extrair o nome do campo do fieldPath (último segmento após o ponto)
            const fieldParts = fieldPath.split('.');
            const fieldName = fieldParts[fieldParts.length - 1];

            // Função auxiliar para extrair o valor do campo
            const extractFieldValue = (data: any): any => {
                if (!data) return null;

                try {
                    // Se for string, fazer parse
                    let parsed = data;
                    if (typeof data === 'string') {
                        parsed = JSON.parse(data);
                    }

                    // Se for array, pegar o primeiro elemento
                    if (Array.isArray(parsed)) {
                        parsed = parsed[0];
                    }

                    // Agora pegar o campo específico
                    if (parsed && typeof parsed === 'object') {
                        return parsed[fieldName] ?? null;
                    }

                    return null;
                } catch (e) {
                    console.error('Erro ao parsear dados:', e);
                    return null;
                }
            };

            const valueBefore = extractFieldValue(log.data_before);
            const valueAfter = extractFieldValue(log.data_after);

            console.log('📝 Processando log:', {
                id: log.id,
                fieldName,
                valueBefore,
                valueAfter,
                medico_solicitation: log.medico_solicitation
            });

            return {
                id: log.id,
                created_at: log.created_at,
                medico_solicitation: log.medico_solicitation,
                value_before: valueBefore,
                value_after: valueAfter,
                user_name: log.user_name
            };
        });

        return NextResponse.json({
            logs: processedLogs,
            total: processedLogs.length
        });

    } catch (error) {
        console.error('Erro no endpoint GET /api/audit-logs/[consultaId]:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
