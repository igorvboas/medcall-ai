import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

const ZAPSIGN_API_URL = 'https://api.zapsign.com.br/api/v1';
const ZAPSIGN_API_TOKEN = process.env.ZAPSIGN_API_TOKEN || '';

async function getMedicoId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('medicos')
    .select('id')
    .eq('user_auth', userId)
    .maybeSingle();
  return data?.id || null;
}

/**
 * GET /documentos
 * Lista todos os documentos do médico autenticado
 */
export async function getDocumentos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { data, error } = await supabase
      .from('documentos')
      .select('*, patients(name)')
      .eq('doctor_id', medicoId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getDocumentos] Erro:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar documentos' });
    }

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('[getDocumentos] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * GET /documentos/:id
 * Busca um documento específico
 */
export async function getDocumento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('documentos')
      .select('*, patients(name)')
      .eq('id', id)
      .eq('doctor_id', medicoId)
      .maybeSingle();

    if (error) {
      console.error('[getDocumento] Erro:', error);
      return res.status(500).json({ success: false, error: 'Erro ao buscar documento' });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('[getDocumento] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /documentos
 * Cria um novo documento
 */
export async function createDocumento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { nome, descricao, url, tipo, patient_id, consultation_id } = req.body;

    if (!nome || !url) {
      return res.status(400).json({ success: false, error: 'Nome e URL são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        doctor_id: medicoId,
        patient_id: patient_id || null,
        consultation_id: consultation_id || null,
        nome,
        descricao: descricao || null,
        url,
        tipo: tipo || 'PDF',
        zapsign_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[createDocumento] Erro:', error);
      return res.status(500).json({ success: false, error: 'Erro ao criar documento' });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('[createDocumento] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * DELETE /documentos/:id
 * Exclui um documento
 */
export async function deleteDocumento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { id } = req.params;

    // Verificar se o documento pertence ao médico
    const { data: doc } = await supabase
      .from('documentos')
      .select('id, zapsign_doc_token')
      .eq('id', id)
      .eq('doctor_id', medicoId)
      .maybeSingle();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }

    // Se tiver token ZapSign, deletar no ZapSign também
    if (doc.zapsign_doc_token) {
      try {
        await fetch(`${ZAPSIGN_API_URL}/docs/${doc.zapsign_doc_token}/`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${ZAPSIGN_API_TOKEN}` },
        });
      } catch (zapErr) {
        console.error('[deleteDocumento] Erro ao deletar no ZapSign:', zapErr);
      }
    }

    const { error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id)
      .eq('doctor_id', medicoId);

    if (error) {
      console.error('[deleteDocumento] Erro:', error);
      return res.status(500).json({ success: false, error: 'Erro ao excluir documento' });
    }

    return res.json({ success: true, message: 'Documento excluído com sucesso' });
  } catch (error) {
    console.error('[deleteDocumento] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /documentos/:id/sign
 * Envia o documento para assinatura via ZapSign
 */
export async function signDocumento(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    if (!ZAPSIGN_API_TOKEN) {
      return res.status(500).json({ success: false, error: 'ZapSign não configurado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    // Buscar dados do médico para o signatário
    const { data: medico } = await supabase
      .from('medicos')
      .select('id, name, user_auth')
      .eq('id', medicoId)
      .maybeSingle();

    if (!medico) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { id } = req.params;

    const { data: doc, error: docError } = await supabase
      .from('documentos')
      .select('*')
      .eq('id', id)
      .eq('doctor_id', medicoId)
      .maybeSingle();

    if (docError || !doc) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }

    if (doc.zapsign_status === 'signed') {
      return res.status(400).json({ success: false, error: 'Documento já está assinado' });
    }

    // Se já tem token ZapSign, retornar URL de assinatura existente
    if (doc.zapsign_doc_token && doc.zapsign_sign_url) {
      return res.json({
        success: true,
        data: {
          sign_url: doc.zapsign_sign_url,
          doc_token: doc.zapsign_doc_token,
        },
      });
    }

    // Criar documento no ZapSign via URL
    const zapsignPayload = {
      name: doc.nome,
      url_pdf: doc.url,
      lang: 'pt-br',
      signers: [
        {
          name: medico.name || 'Médico',
          email: req.user.email || '',
          auth_mode: 'assinaturaTela',
          send_automatic_email: false,
        },
      ],
    };

    console.log('[signDocumento] Criando documento no ZapSign:', doc.nome);

    const zapsignResponse = await fetch(`${ZAPSIGN_API_URL}/docs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZAPSIGN_API_TOKEN}`,
      },
      body: JSON.stringify(zapsignPayload),
    });

    if (!zapsignResponse.ok) {
      const errorText = await zapsignResponse.text();
      console.error('[signDocumento] Erro ZapSign:', errorText);
      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar documento para assinatura',
        details: errorText,
      });
    }

    const zapsignData = await zapsignResponse.json() as any;
    console.log('[signDocumento] Documento criado no ZapSign:', zapsignData.token);

    const signerToken = zapsignData.signers?.[0]?.token || null;
    const signUrl = zapsignData.signers?.[0]?.sign_url || null;

    // Atualizar documento com dados do ZapSign
    const { error: updateError } = await supabase
      .from('documentos')
      .update({
        zapsign_doc_token: zapsignData.token,
        zapsign_signer_token: signerToken,
        zapsign_sign_url: signUrl,
        zapsign_status: 'waiting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[signDocumento] Erro ao atualizar documento:', updateError);
    }

    return res.json({
      success: true,
      data: {
        sign_url: signUrl,
        doc_token: zapsignData.token,
        signer_token: signerToken,
      },
    });
  } catch (error) {
    console.error('[signDocumento] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * GET /documentos/:id/status
 * Consulta o status de assinatura no ZapSign e atualiza local
 */
export async function getSignStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const medicoId = await getMedicoId(req.user.id);
    if (!medicoId) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { id } = req.params;

    const { data: doc } = await supabase
      .from('documentos')
      .select('*')
      .eq('id', id)
      .eq('doctor_id', medicoId)
      .maybeSingle();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documento não encontrado' });
    }

    if (!doc.zapsign_doc_token) {
      return res.json({
        success: true,
        data: { status: doc.zapsign_status, signed_url: null },
      });
    }

    // Consultar status no ZapSign
    const zapsignResponse = await fetch(
      `${ZAPSIGN_API_URL}/docs/${doc.zapsign_doc_token}/`,
      {
        headers: { Authorization: `Bearer ${ZAPSIGN_API_TOKEN}` },
      }
    );

    if (!zapsignResponse.ok) {
      return res.json({
        success: true,
        data: { status: doc.zapsign_status, signed_url: doc.zapsign_signed_url },
      });
    }

    const zapsignData = await zapsignResponse.json() as any;

    // Mapear status do ZapSign
    let newStatus = doc.zapsign_status;
    if (zapsignData.status === 'signed') {
      newStatus = 'signed';
    } else if (zapsignData.status === 'refused') {
      newStatus = 'refused';
    } else if (zapsignData.status === 'link-opened') {
      newStatus = 'link_opened';
    }

    const signedUrl = zapsignData.signed_file || doc.zapsign_signed_url;

    // Atualizar status local se mudou
    if (newStatus !== doc.zapsign_status || signedUrl !== doc.zapsign_signed_url) {
      await supabase
        .from('documentos')
        .update({
          zapsign_status: newStatus,
          zapsign_signed_url: signedUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    return res.json({
      success: true,
      data: {
        status: newStatus,
        signed_url: signedUrl,
      },
    });
  } catch (error) {
    console.error('[getSignStatus] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /documentos/webhook/zapsign
 * Webhook chamado pelo ZapSign quando o status de um documento muda.
 * Não requer autenticação (chamado externamente pelo ZapSign).
 */
export async function zapsignWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;

    console.log('[zapsignWebhook] Payload recebido:', JSON.stringify(payload, null, 2));

    // ZapSign envia doc_token no payload
    const docToken = payload.doc_token || payload.token;
    if (!docToken) {
      console.warn('[zapsignWebhook] Payload sem doc_token');
      return res.status(200).json({ success: true, message: 'Ignorado - sem doc_token' });
    }

    // Buscar documento pelo zapsign_doc_token
    const { data: doc, error: findError } = await supabase
      .from('documentos')
      .select('id, zapsign_status')
      .eq('zapsign_doc_token', docToken)
      .maybeSingle();

    if (findError || !doc) {
      console.warn('[zapsignWebhook] Documento não encontrado para token:', docToken);
      return res.status(200).json({ success: true, message: 'Documento não encontrado' });
    }

    // Mapear status do ZapSign
    let newStatus = doc.zapsign_status;
    const zapStatus = payload.status || payload.doc_status;

    if (zapStatus === 'signed' || zapStatus === 'document_signed') {
      newStatus = 'signed';
    } else if (zapStatus === 'refused' || zapStatus === 'document_refused') {
      newStatus = 'refused';
    } else if (zapStatus === 'link-opened' || zapStatus === 'signer_link_opened') {
      newStatus = 'link_opened';
    }

    const signedUrl = payload.signed_file || payload.signed_file_url || null;

    console.log(`[zapsignWebhook] Atualizando doc ${doc.id}: ${doc.zapsign_status} -> ${newStatus}`);

    // Atualizar no banco
    const { error: updateError } = await supabase
      .from('documentos')
      .update({
        zapsign_status: newStatus,
        ...(signedUrl ? { zapsign_signed_url: signedUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id);

    if (updateError) {
      console.error('[zapsignWebhook] Erro ao atualizar:', updateError);
    }

    return res.status(200).json({ success: true, message: 'Status atualizado' });
  } catch (error) {
    console.error('[zapsignWebhook] Erro:', error);
    // Sempre retornar 200 para o ZapSign não reenviar
    return res.status(200).json({ success: true, message: 'Erro processado' });
  }
}
