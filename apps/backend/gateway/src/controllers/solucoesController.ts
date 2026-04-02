import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

// Mapeamento de rotas para tabelas
const TABLE_MAP: Record<string, string> = {
  'solucao-mentalidade': 's_agente_mentalidade_2',
  'solucao-suplementacao': 's_suplementacao2',
  'solucao-habitos-vida': 'a_solucao_habitos_vida',
  'solucao-ltb': 'a_solucao_ltb',
  'alimentacao': 's_gramaturas_alimentares',
  'atividade-fisica': 's_exercicios_fisicos'
};

/**
 * Helper genérico para buscar solução
 */
async function getSolucaoGeneric(tableName: string, consultaId: string) {
  console.log(`[getSolucaoGeneric] Buscando em ${tableName} para consulta ${consultaId}`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('consulta_id', consultaId)
    .maybeSingle();

  if (error) {
    console.error(`[getSolucaoGeneric] ❌ Erro em ${tableName}:`, JSON.stringify(error, null, 2));
    throw error;
  }

  console.log(`[getSolucaoGeneric] ✅ Resultado:`, data ? 'encontrado' : 'não encontrado');
  return data || null;
}

/**
 * Helper genérico para atualizar campo da solução
 */
async function updateSolucaoFieldGeneric(tableName: string, consultaId: string, updateData: any) {
  console.log(`[updateSolucaoFieldGeneric] Atualizando ${tableName} para consulta ${consultaId}`);
  console.log(`[updateSolucaoFieldGeneric] Dados:`, JSON.stringify(updateData, null, 2));

  // Verificar se já existe registro
  const { data: existing, error: existingError } = await supabase
    .from(tableName)
    .select('consulta_id')
    .eq('consulta_id', consultaId)
    .maybeSingle();

  if (existingError) {
    console.error(`[updateSolucaoFieldGeneric] ❌ Erro ao buscar existente:`, existingError);
  }

  if (existing) {
    // Atualizar
    console.log(`[updateSolucaoFieldGeneric] Registro existe, atualizando...`);
    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (error) {
      console.error(`[updateSolucaoFieldGeneric] ❌ Erro UPDATE:`, JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(`[updateSolucaoFieldGeneric] ✅ Atualizado com sucesso`);
    return data;
  } else {
    // Criar
    console.log(`[updateSolucaoFieldGeneric] Registro não existe, criando...`);
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        consulta_id: consultaId,
        ...updateData
      })
      .select()
      .single();

    if (error) {
      console.error(`[updateSolucaoFieldGeneric] ❌ Erro INSERT:`, JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(`[updateSolucaoFieldGeneric] ✅ Criado com sucesso`);
    return data;
  }
}

/**
 * GET /solucao-mentalidade/:consultaId
 */
export async function getSolucaoMentalidade(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getSolucaoMentalidade] Buscando para consulta:', consultaId);

    const data = await getSolucaoGeneric(TABLE_MAP['solucao-mentalidade'], consultaId);
    console.log('[getSolucaoMentalidade] Resultado:', data ? 'encontrado' : 'null');

    // Frontend espera mentalidade_data
    return res.json({ success: true, mentalidade_data: data });
  } catch (error: any) {
    console.error('[getSolucaoMentalidade] ❌ Erro:', error?.message || error);
    console.error('[getSolucaoMentalidade] ❌ Detalhes:', JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error?.message || 'Erro desconhecido'
    });
  }
}

/**
 * POST /solucao-mentalidade/:consultaId/update-field
 * Atualiza um campo da tabela s_agente_mentalidade_2
 * O frontend envia fieldPath: 'mentalidade_data.nome_coluna' (ex: mentalidade_data.padrao_01)
 * Mapeamos isso para a coluna real 'nome_coluna' (ex: padrao_01)
 */
export async function updateSolucaoMentalidadeField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { fieldPath, value } = req.body;

    console.log('[updateSolucaoMentalidadeField] 📝 Atualizando:', { consultaId, fieldPath, value });

    if (!fieldPath) {
      return res.status(400).json({ success: false, error: 'fieldPath é obrigatório' });
    }

    // Extrair o nome da coluna real
    // Esperado: mentalidade_data.NOME_COLUNA (ex: mentalidade_data.padrao_01)
    const parts = fieldPath.split('.');

    // Validação básica do formato
    if (parts[0] !== 'mentalidade_data' || parts.length < 2) {
      return res.status(400).json({ success: false, error: 'fieldPath deve começar com mentalidade_data.nome_coluna' });
    }

    // O nome da coluna é a segunda parte (ex: padrao_01, resumo_executivo, higiene_sono)
    let columnName = parts[1];

    // Lógica de atualização
    const updatePayload: any = {};

    // Se o path tiver mais de 2 partes (ex: mentalidade_data.higiene_sono.duracao_alvo),
    // precisamos fazer um merge manual, pois o Supabase/Postgres substituiria o JSON inteiro.
    if (parts.length > 2) {
      console.log(`[updateSolucaoMentalidadeField] 🔄 Atualização aninhada detectada para coluna '${columnName}'`);

      // 1. Buscar valor atual da coluna
      const { data: currentData, error: fetchError } = await supabase
        .from('s_agente_mentalidade_2')
        .select(columnName)
        .eq('consulta_id', consultaId)
        .single();

      if (fetchError) {
        console.error(`[updateSolucaoMentalidadeField] ❌ Erro ao buscar dados atuais:`, fetchError);
        throw fetchError;
      }

      let columnValue: any = currentData ? currentData[columnName] : {};
      // Garantir que é objeto
      if (!columnValue || typeof columnValue !== 'object') columnValue = {};

      // 2. Aplicar a atualização no objeto (deep set)
      let current: any = columnValue;
      for (let i = 2; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {}; // Criar caminho se não existir
        }
        current = current[key];
      }

      const lastKey = parts[parts.length - 1];
      current[lastKey] = value;

      // 3. Definir payload com o objeto completo atualizado
      updatePayload[columnName] = columnValue;

    } else {
      // Atualização direta da coluna (root level)
      updatePayload[columnName] = value;
    }

    // Salvar atualização
    const { data, error: updateError } = await supabase
      .from('s_agente_mentalidade_2')
      .update(updatePayload)
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (updateError) {
      // Se der erro de coluna não existe, tentamos dar uma dica melhor
      if (updateError.code === '42703') { // Undefined column
        console.error(`[updateSolucaoMentalidadeField] ❌ Coluna '${columnName}' não existe na tabela s_agente_mentalidade_2`);
        return res.status(400).json({ success: false, error: `Campo '${columnName}' inválido para esta solução.` });
      }

      console.error('[updateSolucaoMentalidadeField] ❌ Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('[updateSolucaoMentalidadeField] ✅ Atualizado com sucesso');
    return res.json({ success: true, solucao: data });
  } catch (error) {
    console.error('Erro ao atualizar solução mentalidade:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /solucao-suplementacao/:consultaId
 */
export async function getSolucaoSuplementacao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const data = await getSolucaoGeneric(TABLE_MAP['solucao-suplementacao'], consultaId);

    // Parse JSON strings in arrays (the table stores as text[] with JSON strings)
    let parsedData = null;
    if (data) {
      parsedData = {
        suplementos: (data.suplementos || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        fitoterapicos: (data.fitoterapicos || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        homeopatia: (data.homeopatia || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        florais_bach: (data.florais_bach || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        })
      };
    }

    // Return with key that frontend expects
    return res.json({ success: true, suplementacao_data: parsedData });
  } catch (error) {
    console.error('Erro ao buscar solução suplementação:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /solucao-suplementacao/:consultaId/update-field
 * Atualiza um campo específico de um item dentro de uma categoria de suplementação
 * Body: { category: 'suplementos'|'fitoterapicos'|'homeopatia'|'florais_bach', index: number, field: string, value: any }
 */
export async function updateSolucaoSuplementacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { category, index, field, value } = req.body;

    console.log('[updateSolucaoSuplementacaoField] 📝 Atualizando:', { consultaId, category, index, field, value });

    if (!category || index === undefined || !field) {
      return res.status(400).json({ success: false, error: 'category, index e field são obrigatórios' });
    }

    // Buscar dados existentes
    const { data: existing, error: fetchError } = await supabase
      .from('s_suplementacao2')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('[updateSolucaoSuplementacaoField] ❌ Erro ao buscar:', fetchError);
      throw fetchError;
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Registro de suplementação não encontrado' });
    }

    // Obter o array da categoria
    const categoryArray = existing[category] || [];

    // Parse cada item do array (são JSON strings)
    const parsedArray = categoryArray.map((item: string) => {
      try { return JSON.parse(item); } catch { return item; }
    });

    // Verificar se o índice existe
    if (index < 0 || index >= parsedArray.length) {
      return res.status(400).json({ success: false, error: 'Índice inválido' });
    }

    // Atualizar o campo do item específico
    parsedArray[index] = {
      ...parsedArray[index],
      [field]: value
    };

    // Converter de volta para JSON strings
    const updatedArray = parsedArray.map((item: any) => JSON.stringify(item));

    // Salvar no banco
    const { data, error: updateError } = await supabase
      .from('s_suplementacao2')
      .update({ [category]: updatedArray })
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (updateError) {
      console.error('[updateSolucaoSuplementacaoField] ❌ Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('[updateSolucaoSuplementacaoField] ✅ Atualizado com sucesso');
    return res.json({ success: true, solucao: data });
  } catch (error) {
    console.error('Erro ao atualizar solução suplementação:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/** Categorias válidas de suplementação */
const SUPLEMENTACAO_CATEGORIES = ['suplementos', 'fitoterapicos', 'homeopatia', 'florais_bach'] as const;

/** Item padrão para novo suplemento */
const DEFAULT_SUPLEMENTACAO_ITEM = {
  nome: '',
  objetivo: '',
  dosagem: '',
  horario: '',
  inicio: '',
  termino: ''
};

/**
 * POST /solucao-suplementacao/:consultaId/add-item
 * Adiciona um novo item manualmente em uma categoria de suplementação.
 * Body: { category: 'suplementos'|'fitoterapicos'|'homeopatia'|'florais_bach', item?: Partial<{ nome, objetivo, dosagem, horario, inicio, termino }> }
 */
export async function addSolucaoSuplementacaoItem(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { category, item: itemPayload } = req.body;

    if (!category || !SUPLEMENTACAO_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'category é obrigatória e deve ser: suplementos, fitoterapicos, homeopatia ou florais_bach'
      });
    }

    const newItem = { ...DEFAULT_SUPLEMENTACAO_ITEM, ...(itemPayload || {}) };

    const { data: existing, error: fetchError } = await supabase
      .from('s_suplementacao2')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('[addSolucaoSuplementacaoItem] ❌ Erro ao buscar:', fetchError);
      throw fetchError;
    }

    if (existing) {
      const categoryArray = existing[category] || [];
      const parsedArray = categoryArray.map((raw: string) => {
        try { return JSON.parse(raw); } catch { return raw; }
      });
      parsedArray.push(newItem);
      const updatedArray = parsedArray.map((obj: any) => JSON.stringify(obj));

      const { data, error: updateError } = await supabase
        .from('s_suplementacao2')
        .update({ [category]: updatedArray })
        .eq('consulta_id', consultaId)
        .select()
        .single();

      if (updateError) {
        console.error('[addSolucaoSuplementacaoItem] ❌ Erro ao atualizar:', updateError);
        throw updateError;
      }
      console.log('[addSolucaoSuplementacaoItem] ✅ Item adicionado na categoria existente');
      return res.json({ success: true, solucao: data });
    }

    const initialArrays: Record<string, string[]> = {
      suplementos: [],
      fitoterapicos: [],
      homeopatia: [],
      florais_bach: []
    };
    initialArrays[category] = [JSON.stringify(newItem)];

    const { data, error: insertError } = await supabase
      .from('s_suplementacao2')
      .insert({
        consulta_id: consultaId,
        ...initialArrays
      })
      .select()
      .single();

    if (insertError) {
      console.error('[addSolucaoSuplementacaoItem] ❌ Erro ao inserir:', insertError);
      throw insertError;
    }
    console.log('[addSolucaoSuplementacaoItem] ✅ Registro criado com novo item');
    return res.json({ success: true, solucao: data });
  } catch (error) {
    console.error('Erro ao adicionar item de suplementação:', error);
    return res.status(500).json({ success: false, error: 'Erro ao adicionar item' });
  }
}

/**
 * POST /solucao-suplementacao/:consultaId/delete-item
 * Remove um item de uma categoria de suplementação
 * Body: { category: 'suplementos'|'fitoterapicos'|'homeopatia'|'florais_bach', index: number }
 */
export async function deleteSolucaoSuplementacaoItem(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { category, index } = req.body;

    if (!category || !SUPLEMENTACAO_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: 'category inválida' });
    }
    if (index === undefined || index < 0) {
      return res.status(400).json({ success: false, error: 'index inválido' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('s_suplementacao2')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ success: false, error: 'Registro não encontrado' });

    const categoryArray = existing[category] || [];
    if (index >= categoryArray.length) {
      return res.status(400).json({ success: false, error: 'Índice fora do range' });
    }

    categoryArray.splice(index, 1);

    const { error: updateError } = await supabase
      .from('s_suplementacao2')
      .update({ [category]: categoryArray })
      .eq('consulta_id', consultaId);

    if (updateError) throw updateError;

    return res.json({ success: true });
  } catch (error) {
    console.error('[deleteSolucaoSuplementacaoItem] Erro:', error);
    return res.status(500).json({ success: false, error: 'Erro ao excluir item' });
  }
}

/**
 * GET /alimentacao/:consultaId
 * Tabela s_refeicao usa paciente (uuid), não consulta_id
 */
export async function getAlimentacao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getAlimentacao] 🔍 Iniciando busca para consulta:', consultaId);

    // Primeiro, buscar a consulta para obter o paciente_id
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .maybeSingle();

    console.log('[getAlimentacao] 📋 Resultado consulta:', { consulta, consultaError });

    if (consultaError) {
      console.error('[getAlimentacao] ❌ Erro ao buscar consulta:', consultaError);
      throw consultaError;
    }

    if (!consulta || !consulta.patient_id) {
      console.log('[getAlimentacao] ⚠️ Consulta não encontrada ou sem paciente');
      return res.json({ success: true, alimentacao_data: [] });
    }

    const patientId = consulta.patient_id;
    console.log('[getAlimentacao] 👤 Paciente ID encontrado:', patientId);

    // Buscar alimentação pelo paciente_id na nova tabela s_refeicao
    // Pegando o criado mais recentemente
    const { data, error } = await supabase
      .from('s_refeicao')
      .select('*')
      .eq('paciente', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[getAlimentacao] 🍽️ Registro encontrado:', data ? 'Sim' : 'Não');

    if (error) {
      console.error('[getAlimentacao] ❌ Erro ao buscar alimentação:', error);
      throw error;
    }

    if (!data) {
      return res.json({ success: true, alimentacao_data: [] });
    }

    // Transformar dados para o formato esperado pelo frontend
    const allRefs = [
      { id: 'ref_1', nome: 'Refeição 1', data: data.ref_1 },
      { id: 'ref_2', nome: 'Refeição 2', data: data.ref_2 },
      { id: 'ref_3', nome: 'Refeição 3', data: data.ref_3 },
      { id: 'ref_4', nome: 'Refeição 4', data: data.ref_4 },
      { id: 'ref_5', nome: 'Refeição 5', data: data.ref_5 },
      { id: 'ref_6', nome: 'Refeição 6', data: data.ref_6 },
      { id: 'ref_7', nome: 'Refeição 7', data: data.ref_7 },
      { id: 'ref_8', nome: 'Refeição 8', data: data.ref_8 },
      { id: 'ref_9', nome: 'Refeição 9', data: data.ref_9 },
      { id: 'ref_10', nome: 'Refeição 10', data: data.ref_10 }
    ];
    // Filtrar apenas refeicoes que tem dados
    const refeicoes = allRefs.filter(r => r.data != null);

    return res.json({ success: true, alimentacao_data: refeicoes, s_refeicao_id: data.id });
  } catch (error: any) {
    console.error('[getAlimentacao] ❌ Erro geral:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /alimentacao/:consultaId/add-refeicao
 * Adiciona uma refeicao ao protocolo (usa o proximo ref_ disponivel)
 */
export async function addRefeicaoToProtocol(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { consultaId } = req.params;
    const { refeicaoData, nome, targetSlot: requestedSlot } = req.body;

    // Buscar consulta para pegar paciente
    const { data: consulta } = await supabase
      .from('consultations').select('patient_id').eq('id', consultaId).maybeSingle();
    if (!consulta) return res.status(404).json({ success: false, error: 'Consulta não encontrada' });

    // Buscar registro existente
    const { data: existing } = await supabase
      .from('s_refeicao').select('*').eq('paciente', consulta.patient_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    // Encontrar proximo slot disponivel (ref_1 a ref_10)
    const slots = ['ref_1', 'ref_2', 'ref_3', 'ref_4', 'ref_5', 'ref_6', 'ref_7', 'ref_8', 'ref_9', 'ref_10'];
    let targetSlot: string | null = null;

    // Se requestedSlot foi fornecido (usado para reordenação), usar ele diretamente
    if (requestedSlot && slots.includes(requestedSlot)) {
      targetSlot = requestedSlot;
    }

    if (existing) {
      if (!targetSlot) {
        for (const slot of slots) {
          if (!existing[slot]) { targetSlot = slot; break; }
        }
      }
      if (!targetSlot) {
        return res.status(400).json({ success: false, error: 'Limite de 10 refeições atingido. Exclua uma antes de adicionar.' });
      }
      const { error } = await supabase
        .from('s_refeicao').update({ [targetSlot]: refeicaoData }).eq('id', existing.id);
      if (error) throw error;
    } else {
      targetSlot = targetSlot || 'ref_1';
      const { error } = await supabase
        .from('s_refeicao').insert({ paciente: consulta.patient_id, [targetSlot]: refeicaoData });
      if (error) throw error;
    }

    return res.json({ success: true, slot: targetSlot });
  } catch (error: any) {
    console.error('[addRefeicaoToProtocol] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /alimentacao/:consultaId/remove-refeicao
 * Remove uma refeicao do protocolo (limpa o ref_ especificado)
 */
export async function removeRefeicaoFromProtocol(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { consultaId } = req.params;
    const { refId } = req.body; // ex: 'ref_1'

    if (!refId || !['ref_1', 'ref_2', 'ref_3', 'ref_4', 'ref_5', 'ref_6', 'ref_7', 'ref_8', 'ref_9', 'ref_10'].includes(refId)) {
      return res.status(400).json({ success: false, error: 'refId inválido' });
    }

    const { data: consulta } = await supabase
      .from('consultations').select('patient_id').eq('id', consultaId).maybeSingle();
    if (!consulta) return res.status(404).json({ success: false, error: 'Consulta não encontrada' });

    const { data: existing } = await supabase
      .from('s_refeicao').select('id').eq('paciente', consulta.patient_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!existing) return res.status(404).json({ success: false, error: 'Registro não encontrado' });

    const { error } = await supabase
      .from('s_refeicao').update({ [refId]: null }).eq('id', existing.id);
    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[removeRefeicaoFromProtocol] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /alimentacao/:consultaId/add-alimento-to-meal
 * Adiciona um alimento a uma refeicao existente
 * Body: { refId: 'ref_1', alimento: { nome, gramas, kcal, categoria } }
 */
export async function addAlimentoToMeal(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { consultaId } = req.params;
    const { refId, alimento } = req.body;

    if (!refId || !alimento) {
      return res.status(400).json({ success: false, error: 'refId e alimento são obrigatórios' });
    }

    const { data: consulta } = await supabase
      .from('consultations').select('patient_id').eq('id', consultaId).maybeSingle();
    if (!consulta) return res.status(404).json({ success: false, error: 'Consulta não encontrada' });

    const { data: existing } = await supabase
      .from('s_refeicao').select('*').eq('paciente', consulta.patient_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, error: 'Registro de refeição não encontrado' });

    // Parse dados atuais do ref
    let currentData = existing[refId];
    if (typeof currentData === 'string') {
      try { currentData = JSON.parse(currentData); } catch { currentData = { principal: [], substituicoes: {} }; }
    }
    if (!currentData) currentData = { principal: [], substituicoes: {} };

    // Adicionar alimento ao principal
    const principal = currentData.principal || [];
    principal.push(alimento);
    currentData.principal = principal;

    // Salvar
    const { error } = await supabase
      .from('s_refeicao').update({ [refId]: currentData }).eq('id', existing.id);
    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[addAlimentoToMeal] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /alimentacao/:consultaId/remove-alimento-from-meal
 * Remove um alimento de uma refeicao pelo indice
 * Body: { refId: 'ref_1', itemIndex: 0 }
 */
export async function removeAlimentoFromMeal(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { consultaId } = req.params;
    const { refId, itemIndex } = req.body;

    if (!refId || itemIndex === undefined) {
      return res.status(400).json({ success: false, error: 'refId e itemIndex são obrigatórios' });
    }

    const { data: consulta } = await supabase
      .from('consultations').select('patient_id').eq('id', consultaId).maybeSingle();
    if (!consulta) return res.status(404).json({ success: false, error: 'Consulta não encontrada' });

    const { data: existing } = await supabase
      .from('s_refeicao').select('*').eq('paciente', consulta.patient_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, error: 'Registro não encontrado' });

    let currentData = existing[refId];
    if (typeof currentData === 'string') {
      try { currentData = JSON.parse(currentData); } catch { currentData = { principal: [], substituicoes: {} }; }
    }
    if (!currentData) return res.status(404).json({ success: false, error: 'Refeição não encontrada' });

    const principal = currentData.principal || [];
    if (itemIndex < 0 || itemIndex >= principal.length) {
      return res.status(400).json({ success: false, error: 'Índice inválido' });
    }

    principal.splice(itemIndex, 1);
    currentData.principal = principal;

    const { error } = await supabase
      .from('s_refeicao').update({ [refId]: currentData }).eq('id', existing.id);
    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[removeAlimentoFromMeal] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /alimentacao/:consultaId/update-field
 * Atualiza um campo específico de um alimento pelo ID do registro
 * Body: { id: number, field: string, value: any } ou { id: number, alimento, tipo, gramatura, kcal }
 */
export async function updateAlimentacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { id, field, value, alimento, tipo, gramatura, kcal } = req.body;

    console.log('[updateAlimentacaoField] 📝 Atualizando alimento:', { consultaId, alimentoId: id, body: req.body });

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID do alimento é obrigatório' });
    }

    // Construir objeto de atualização
    let updateData: Record<string, any> = {};

    if (field && value !== undefined) {
      // Formato { id, field, value }
      updateData[field] = value;
    } else {
      // Formato legado com campos específicos
      if (alimento !== undefined) updateData.alimento = alimento;
      if (tipo !== undefined) updateData.tipo_de_alimentos = tipo;
      if (gramatura !== undefined) updateData.gramatura = gramatura;
      if (kcal !== undefined) updateData.kcal = kcal;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    const { data, error } = await supabase
      .from('s_gramaturas_alimentares')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateAlimentacaoField] ❌ Erro:', error);
      throw error;
    }

    console.log('[updateAlimentacaoField] ✅ Atualizado:', data);
    return res.json({ success: true, alimentacao: data });
  } catch (error) {
    console.error('Erro ao atualizar alimentação:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * POST /alimentacao/:consultaId/reorder-meals
 * Reordena refeições trocando os slots ref_X
 * Body: { fromId: 'ref_1', toId: 'ref_3' }
 */
export async function reorderMeals(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Não autorizado' });

    const { consultaId } = req.params;
    const { fromId, toId } = req.body;
    const validSlots = ['ref_1', 'ref_2', 'ref_3', 'ref_4', 'ref_5', 'ref_6', 'ref_7', 'ref_8', 'ref_9', 'ref_10'];

    if (!fromId || !toId || !validSlots.includes(fromId) || !validSlots.includes(toId)) {
      return res.status(400).json({ success: false, error: 'Slots inválidos' });
    }

    // Buscar consulta para pegar paciente
    const { data: consulta } = await supabase
      .from('consultations').select('patient_id').eq('id', consultaId).maybeSingle();
    if (!consulta) return res.status(404).json({ success: false, error: 'Consulta não encontrada' });

    // Buscar registro de refeição
    const { data: current, error: fetchErr } = await supabase
      .from('s_refeicao')
      .select('*')
      .eq('paciente', consulta.patient_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !current) {
      return res.status(404).json({ success: false, error: 'Dados não encontrados' });
    }

    // Swap
    const fromData = current[fromId];
    const toData = current[toId];

    const { error: updateErr } = await supabase
      .from('s_refeicao')
      .update({ [fromId]: toData, [toId]: fromData })
      .eq('id', current.id);

    if (updateErr) {
      console.error('[reorderMeals] Erro:', updateErr);
      return res.status(500).json({ success: false, error: 'Erro ao reordenar' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao reordenar refeições:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * GET /atividade-fisica/:consultaId
 * Retorna múltiplos exercícios por consulta
 */
export async function getAtividadeFisica(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getAtividadeFisica] Buscando exercícios para consulta:', consultaId);

    // Buscar múltiplos exercícios (sem .single())
    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .select('*')
      .eq('consulta_id', consultaId);

    if (error) {
      console.error('[getAtividadeFisica] ❌ Erro:', error);
      throw error;
    }

    console.log('[getAtividadeFisica] ✅ Exercícios encontrados:', data?.length || 0);

    return res.json({ success: true, atividade_fisica_data: data || [] });
  } catch (error: any) {
    console.error('[getAtividadeFisica] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /atividade-fisica/:consultaId/update-field
 * Atualiza um campo específico de um exercício pelo ID do exercício
 * Body: { id: number, field: string, value: any }
 */
export async function updateAtividadeFisicaField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { id, field, value } = req.body;

    console.log('[updateAtividadeFisicaField] 📝 Atualizando exercício:', { consultaId, exercicioId: id, field, value });

    if (!id || !field) {
      return res.status(400).json({ success: false, error: 'ID e field são obrigatórios' });
    }

    // Atualizar o campo específico do exercício pelo seu ID
    const updateData: Record<string, any> = {};
    updateData[field] = value;

    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .update(updateData)
      .eq('id', id)
      .eq('consulta_id', consultaId) // Garantir que pertence à consulta certa
      .select()
      .single();

    if (error) {
      console.error('[updateAtividadeFisicaField] ❌ Erro:', error);
      throw error;
    }

    console.log('[updateAtividadeFisicaField] ✅ Atualizado:', data);
    return res.json({ success: true, atividadeFisica: data });
  } catch (error) {
    console.error('Erro ao atualizar atividade física:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /lista-exercicios-fisicos
 */
export async function addExercicioToProtocol(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { nome_exercicio, nome_treino, grupo_muscular, series, repeticoes, descanso, observacoes } = req.body;

    console.log('[addExercicioToProtocol] ➕ Adicionando exercício à consulta:', consultaId);

    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .insert({
        consulta_id: consultaId,
        nome_exercicio,
        nome_treino,
        grupo_muscular,
        series,
        repeticoes,
        descanso,
        observacoes
      })
      .select()
      .single();

    if (error) {
      console.error('[addExercicioToProtocol] ❌ Erro:', error);
      throw error;
    }

    console.log('[addExercicioToProtocol] ✅ Exercício adicionado:', data);
    return res.json({ success: true, exercicio: data });
  } catch (error: any) {
    console.error('[addExercicioToProtocol] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /atividade-fisica/:consultaId/delete-item
 * Remove um exercício do protocolo de atividade física
 * Body: { exercicioId: number }
 */
export async function removeExercicioFromProtocol(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { exercicioId } = req.body;

    console.log('[removeExercicioFromProtocol] 🗑️ Removendo exercício:', { consultaId, exercicioId });

    if (!exercicioId) {
      return res.status(400).json({ success: false, error: 'exercicioId é obrigatório' });
    }

    const { error } = await supabase
      .from('s_exercicios_fisicos')
      .delete()
      .eq('id', exercicioId)
      .eq('consulta_id', consultaId);

    if (error) {
      console.error('[removeExercicioFromProtocol] ❌ Erro:', error);
      throw error;
    }

    console.log('[removeExercicioFromProtocol] ✅ Exercício removido');
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[removeExercicioFromProtocol] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * GET /lista-exercicios-fisicos
 */
export async function getListaExerciciosFisicos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { search } = req.query;

    let query = supabase
      .from('exercicios_fisicos')
      .select('*');

    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    const { data: exercicios, error } = await query.limit(50);

    if (error) throw error;

    return res.json({ success: true, exercicios: exercicios || [] });
  } catch (error) {
    console.error('Erro ao buscar exercícios:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
