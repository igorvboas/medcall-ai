# 📚 Documentação - Solução Livro da Vida

Este documento descreve as tabelas e colunas do banco de dados utilizadas pela **Solução Livro da Vida** no sistema MedCall AI.

## 🗄️ Tabela Principal

### `s_agente_mentalidade_2`

Esta é a tabela principal que armazena todos os dados do Livro da Vida.

**Filtro de busca:**
- **Coluna de ligação:** `consulta_id` (UUID)
- **Query:** `WHERE consulta_id = '{consulta_id}'`
- **Ordenação:** `ORDER BY created_at DESC LIMIT 1` (busca o registro mais recente)

## 📋 Colunas da Tabela

### Colunas de Identificação

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único do registro (Primary Key) |
| `consulta_id` | UUID | **Chave de ligação** com a tabela `consultations` |
| `created_at` | TIMESTAMP | Data de criação do registro |
| `updated_at` | TIMESTAMP | Data da última atualização (se existir) |

### Colunas de Dados

| Coluna | Tipo | Descrição | Estrutura |
|--------|------|-----------|-----------|
| `resumo_executivo` | JSONB/TEXT | Resumo executivo do Livro da Vida | String (texto longo) |
| `padrao_01` | JSONB/TEXT | Primeiro padrão identificado | Objeto JSON (ver estrutura abaixo) |
| `padrao_02` | JSONB/TEXT | Segundo padrão identificado | Objeto JSON |
| `padrao_03` | JSONB/TEXT | Terceiro padrão identificado | Objeto JSON |
| `padrao_04` | JSONB/TEXT | Quarto padrão identificado | Objeto JSON |
| `padrao_05` | JSONB/TEXT | Quinto padrão identificado | Objeto JSON |
| `padrao_06` | JSONB/TEXT | Sexto padrão identificado | Objeto JSON |
| `padrao_07` | JSONB/TEXT | Sétimo padrão identificado | Objeto JSON |
| `padrao_08` | JSONB/TEXT | Oitavo padrão identificado | Objeto JSON |
| `padrao_09` | JSONB/TEXT | Nono padrão identificado | Objeto JSON |
| `padrao_10` | JSONB/TEXT | Décimo padrão identificado | Objeto JSON |
| `higiene_sono` | JSONB/TEXT | Dados de higiene do sono | Objeto JSON (ver estrutura abaixo) |

**Nota:** 
- Os campos `padrao_XX` podem ser `null` se não houver dados para aquele padrão.
- O campo `higiene_sono` pode não existir na tabela atual (verificar estrutura do banco).

## 🔗 Relacionamentos

### Tabela: `consultations`
- **Coluna de ligação:** `consultations.id` = `s_agente_mentalidade_2.consulta_id`
- **Uso:** Para buscar os dados do Livro da Vida de uma consulta específica

### Tabela: `medicos` (indireto)
- **Caminho:** `medicos.user_auth` → `auth.users.id` → (autenticação)
- **Uso:** Para validar permissões (médico só vê seus próprios pacientes)

### Tabela: `patients` (indireto)
- **Caminho:** `consultations.patient_id` → `patients.id`
- **Uso:** Para identificar o paciente da consulta

## 📊 Estrutura dos Dados JSON

### `resumo_executivo`
```json
"Lucas, após análise profunda de sua trajetória, foram identificados 8 padrões mentais..."
```
**Tipo:** String (texto longo)

### `padrao_XX` (Estrutura do Objeto JSON)

Cada padrão (`padrao_01` até `padrao_10`) possui a seguinte estrutura:

```json
{
  "padrao": "Nome do Padrão",
  "categorias": ["categoria1", "categoria2"],
  "prioridade": 1,
  "areas_impacto": ["area1", "area2"],
  "origem_estimada": {
    "periodo": "Gestação e Primeira Infância (0-7 anos)",
    "contexto_provavel": "Descrição do contexto..."
  },
  "conexoes_padroes": {
    "raiz_de": ["Padrão 1", "Padrão 2"],
    "explicacao": "Explicação das conexões...",
    "alimentado_por": ["Padrão X"],
    "relacionado_com": ["Padrão Y"]
  },
  "manifestacoes_atuais": [
    "Manifestação 1",
    "Manifestação 2"
  ],
  "orientacoes_transformacao": [
    {
      "nome": "Nome da Orientação",
      "passo": 1,
      "como_fazer": "Instruções detalhadas...",
      "o_que_fazer": "O que fazer...",
      "porque_funciona": "Explicação científica..."
    }
  ]
}
```

**Nota:** Alguns campos podem variar ou estar ausentes dependendo do padrão.

### `higiene_sono` (Campo Adicional)

Embora não esteja explicitamente na tabela `s_agente_mentalidade_2` no código atual, o frontend espera um campo `higiene_sono` que pode estar:

1. **Armazenado dentro de `resumo_executivo`** como parte do JSON
2. **Em uma tabela separada** (não identificada no código atual)
3. **Gerado dinamicamente** no frontend

**Estrutura esperada de `higiene_sono`:**
```json
{
  "horario_dormir_recomendado": "23:00",
  "horario_acordar_recomendado": "07:00",
  "duracao_alvo": "8h",
  "janela_sono_semana": "23:00-07:00",
  "janela_sono_fds": "23:00-07:00",
  "consistencia_horario": "Variação máxima ±30min",
  "rotina_pre_sono": [
    "22:00 - Desligar telas",
    "22:20 - Banho morno"
  ],
  "gatilhos_evitar": [
    "Cafeína após 16h",
    "Exercício intenso noturno"
  ],
  "progressao_ajuste": "Reduzir horário...",
  "observacoes_clinicas": "Sono cronicamente curto..."
}
```

## 🔍 Queries SQL de Exemplo

### Buscar Dados do Livro da Vida

```sql
-- Buscar dados completos do Livro da Vida para uma consulta
SELECT 
  id,
  consulta_id,
  resumo_executivo,
  padrao_01,
  padrao_02,
  padrao_03,
  padrao_04,
  padrao_05,
  padrao_06,
  padrao_07,
  padrao_08,
  padrao_09,
  padrao_10,
  created_at
FROM s_agente_mentalidade_2
WHERE consulta_id = 'uuid-da-consulta'
ORDER BY created_at DESC
LIMIT 1;
```

### Buscar com Dados da Consulta

```sql
-- Buscar Livro da Vida com informações da consulta e paciente
SELECT 
  ltv.*,
  c.id as consulta_id,
  c.status as consulta_status,
  p.name as paciente_nome,
  p.email as paciente_email
FROM s_agente_mentalidade_2 ltv
JOIN consultations c ON ltv.consulta_id = c.id
JOIN patients p ON c.patient_id = p.id
WHERE ltv.consulta_id = 'uuid-da-consulta'
ORDER BY ltv.created_at DESC
LIMIT 1;
```

### Buscar Apenas Padrões Preenchidos

```sql
-- Buscar apenas os padrões que não são NULL
SELECT 
  consulta_id,
  padrao_01,
  padrao_02,
  padrao_03,
  padrao_04,
  padrao_05,
  padrao_06,
  padrao_07,
  padrao_08,
  padrao_09,
  padrao_10
FROM s_agente_mentalidade_2
WHERE consulta_id = 'uuid-da-consulta'
  AND (
    padrao_01 IS NOT NULL OR
    padrao_02 IS NOT NULL OR
    padrao_03 IS NOT NULL OR
    padrao_04 IS NOT NULL OR
    padrao_05 IS NOT NULL OR
    padrao_06 IS NOT NULL OR
    padrao_07 IS NOT NULL OR
    padrao_08 IS NOT NULL OR
    padrao_09 IS NOT NULL OR
    padrao_10 IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 1;
```

## 🔧 Endpoints da API

### GET `/api/solucao-mentalidade/[consultaId]`

**Descrição:** Busca os dados do Livro da Vida para uma consulta específica.

**Parâmetros:**
- `consultaId` (path): UUID da consulta

**Resposta:**
```json
{
  "mentalidade_data": {
    "id": "uuid",
    "resumo_executivo": "texto...",
    "padrao_01": { /* objeto JSON */ },
    "padrao_02": { /* objeto JSON */ },
    "padrao_03": null,
    "padrao_04": null,
    // ... até padrao_10
    "created_at": "2024-01-01T00:00:00Z",
    "consulta_id": "uuid"
  }
}
```

**Query Interna:**
```typescript
supabase
  .from('s_agente_mentalidade_2')
  .select('*')
  .eq('consulta_id', consultaId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

### POST `/api/solucao-mentalidade/[consultaId]/update-field`

**Descrição:** Atualiza um campo específico do Livro da Vida.

**Body:**
```json
{
  "fieldPath": "mentalidade_data.resumo_executivo",
  "value": "Novo texto do resumo..."
}
```

**Campos atualizáveis:**
- `mentalidade_data.resumo_executivo`
- `mentalidade_data.padrao_01` até `padrao_10`
- `mentalidade_data.higiene_sono.*` (se existir na tabela)

## 📝 Notas Importantes

1. **Formato dos Dados:**
   - Os campos `padrao_XX` e `resumo_executivo` podem ser armazenados como **TEXT** (string JSON) ou **JSONB** (objeto JSON nativo)
   - O código faz `JSON.parse()` ao buscar, então sempre trata como string JSON

2. **Múltiplos Registros:**
   - Pode haver múltiplos registros para a mesma `consulta_id`
   - Sempre busca o mais recente (`ORDER BY created_at DESC LIMIT 1`)

3. **Campos Opcionais:**
   - Todos os `padrao_XX` podem ser `null`
   - `resumo_executivo` pode ser `null` ou string vazia

4. **Higiene do Sono:**
   - O campo `higiene_sono` é usado no frontend, mas não está explicitamente na query da API
   - Pode estar armazenado em outro lugar ou ser gerado dinamicamente
   - Verificar se existe uma coluna `higiene_sono` na tabela `s_agente_mentalidade_2`

## 🔍 Verificação no Banco

Para verificar a estrutura real da tabela no Supabase:

```sql
-- Ver todas as colunas da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 's_agente_mentalidade_2'
ORDER BY ordinal_position;

-- Ver estrutura de um registro de exemplo
SELECT *
FROM s_agente_mentalidade_2
LIMIT 1;
```

## 📚 Referências no Código

- **API de Busca:** `apps/frontend/src/app/api/solucao-mentalidade/[consultaId]/route.ts`
- **API de Atualização:** `apps/frontend/src/app/api/solucao-mentalidade/[consultaId]/update-field/route.ts`
- **Frontend:** `apps/frontend/src/app/consultas/page.tsx` (componente `MentalidadeSection`)
- **Webhook:** `apps/frontend/src/lib/webhook-config.ts` (endpoint `edicaoLivroDaVida`)

## 🎯 Resumo Rápido

| Item | Valor |
|------|-------|
| **Tabela Principal** | `s_agente_mentalidade_2` |
| **Chave de Ligação** | `consulta_id` (UUID) |
| **Colunas Principais** | `resumo_executivo`, `padrao_01` até `padrao_10` |
| **Tipo de Dados** | JSONB/TEXT (objetos JSON) |
| **Filtro de Busca** | `WHERE consulta_id = '{uuid}'` |
| **Ordenação** | `ORDER BY created_at DESC LIMIT 1` |

