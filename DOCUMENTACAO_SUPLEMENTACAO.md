# 💊 Documentação - Solução Suplementação

Este documento descreve as tabelas e colunas do banco de dados utilizadas pela **Solução Suplementação** no sistema MedCall AI.

## 🗄️ Tabela Principal

### `s_suplementacao2`

Esta é a tabela principal que armazena todos os dados de suplementação.

**Filtro de busca:**
- **Coluna de ligação:** `consulta_id` (UUID)
- **Query:** `WHERE consulta_id = '{consulta_id}'`
- **Ordenação:** `ORDER BY created_at DESC LIMIT 1` (busca o registro mais recente)

**Nota:** Existe também a tabela `s_suplementacao` (sem o "2"), mas o código atual usa `s_suplementacao2`.

## 📋 Colunas da Tabela

### Colunas de Identificação

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único do registro (Primary Key) |
| `consulta_id` | UUID | **Chave de ligação** com a tabela `consultations` |
| `created_at` | TIMESTAMP | Data de criação do registro |
| `updated_at` | TIMESTAMP | Data da última atualização (se existir) |

### Colunas de Dados (Arrays de JSON Strings)

| Coluna | Tipo | Descrição | Estrutura |
|--------|------|-----------|-----------|
| `suplementos` | TEXT[] ou JSONB[] | Array de suplementos | Array de strings JSON (cada string é um objeto) |
| `fitoterapicos` | TEXT[] ou JSONB[] | Array de fitoterápicos | Array de strings JSON (cada string é um objeto) |
| `homeopatia` | TEXT[] ou JSONB[] | Array de homeopatia | Array de strings JSON (cada string é um objeto) |
| `florais_bach` | TEXT[] ou JSONB[] | Array de florais de Bach | Array de strings JSON (cada string é um objeto) |

**Importante:** 
- Os arrays são armazenados como **arrays de strings JSON**, não como JSONB direto
- Cada elemento do array é uma string JSON que precisa ser parseada
- Exemplo: `["{\"nome\":\"Vitamina D\",\"dosagem\":\"1000 UI\"}", "{\"nome\":\"Magnésio\",\"dosagem\":\"400mg\"}"]`

## 🔗 Relacionamentos

### Tabela: `consultations`
- **Coluna de ligação:** `consultations.id` = `s_suplementacao2.consulta_id`
- **Uso:** Para buscar os dados de suplementação de uma consulta específica

### Tabela: `medicos` (indireto)
- **Caminho:** `medicos.user_auth` → `auth.users.id` → (autenticação)
- **Uso:** Para validar permissões (médico só vê seus próprios pacientes)

### Tabela: `patients` (indireto)
- **Caminho:** `consultations.patient_id` → `patients.id`
- **Uso:** Para identificar o paciente da consulta

## 📊 Estrutura dos Dados JSON

### Estrutura de um Item de Suplementação

Cada item em qualquer uma das 4 categorias (`suplementos`, `fitoterapicos`, `homeopatia`, `florais_bach`) possui a seguinte estrutura:

```json
{
  "nome": "Nome do Suplemento/Fitoterápico/Homeopatia/Floral",
  "objetivo": "Objetivo do uso",
  "dosagem": "Dosagem recomendada",
  "horario": "Horário de administração",
  "inicio": "Data de início",
  "termino": "Data de término"
}
```

### Exemplo Completo de Dados

```json
{
  "id": "uuid-do-registro",
  "consulta_id": "uuid-da-consulta",
  "suplementos": [
    "{\"nome\":\"Vitamina D3\",\"objetivo\":\"Suporte ósseo e imunológico\",\"dosagem\":\"2000 UI\",\"horario\":\"Manhã com refeição\",\"inicio\":\"2024-01-01\",\"termino\":\"2024-03-01\"}",
    "{\"nome\":\"Magnésio\",\"objetivo\":\"Relaxamento muscular\",\"dosagem\":\"400mg\",\"horario\":\"À noite\",\"inicio\":\"2024-01-01\",\"termino\":\"2024-02-01\"}"
  ],
  "fitoterapicos": [
    "{\"nome\":\"Ashwagandha\",\"objetivo\":\"Redução de estresse\",\"dosagem\":\"600mg\",\"horario\":\"Manhã\",\"inicio\":\"2024-01-01\",\"termino\":\"2024-04-01\"}"
  ],
  "homeopatia": [],
  "florais_bach": [
    "{\"nome\":\"Rescue Remedy\",\"objetivo\":\"Ansiedade aguda\",\"dosagem\":\"4 gotas\",\"horario\":\"Sob demanda\",\"inicio\":\"2024-01-01\",\"termino\":\"2024-06-01\"}"
  ],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Após Parse (Formato Usado no Frontend)

Após fazer o parse dos arrays, os dados ficam assim:

```json
{
  "id": "uuid-do-registro",
  "consulta_id": "uuid-da-consulta",
  "suplementos": [
    {
      "nome": "Vitamina D3",
      "objetivo": "Suporte ósseo e imunológico",
      "dosagem": "2000 UI",
      "horario": "Manhã com refeição",
      "inicio": "2024-01-01",
      "termino": "2024-03-01"
    },
    {
      "nome": "Magnésio",
      "objetivo": "Relaxamento muscular",
      "dosagem": "400mg",
      "horario": "À noite",
      "inicio": "2024-01-01",
      "termino": "2024-02-01"
    }
  ],
  "fitoterapicos": [
    {
      "nome": "Ashwagandha",
      "objetivo": "Redução de estresse",
      "dosagem": "600mg",
      "horario": "Manhã",
      "inicio": "2024-01-01",
      "termino": "2024-04-01"
    }
  ],
  "homeopatia": [],
  "florais_bach": [
    {
      "nome": "Rescue Remedy",
      "objetivo": "Ansiedade aguda",
      "dosagem": "4 gotas",
      "horario": "Sob demanda",
      "inicio": "2024-01-01",
      "termino": "2024-06-01"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z"
}
```

## 🔍 Queries SQL de Exemplo

### Buscar Dados de Suplementação

```sql
-- Buscar dados completos de suplementação para uma consulta
SELECT 
  id,
  consulta_id,
  suplementos,
  fitoterapicos,
  homeopatia,
  florais_bach,
  created_at
FROM s_suplementacao2
WHERE consulta_id = 'uuid-da-consulta'
ORDER BY created_at DESC
LIMIT 1;
```

### Buscar com Dados da Consulta

```sql
-- Buscar suplementação com informações da consulta e paciente
SELECT 
  sup.*,
  c.id as consulta_id,
  c.status as consulta_status,
  p.name as paciente_nome,
  p.email as paciente_email
FROM s_suplementacao2 sup
JOIN consultations c ON sup.consulta_id = c.id
JOIN patients p ON c.patient_id = p.id
WHERE sup.consulta_id = 'uuid-da-consulta'
ORDER BY sup.created_at DESC
LIMIT 1;
```

### Contar Itens por Categoria

```sql
-- Contar quantos itens existem em cada categoria
SELECT 
  consulta_id,
  array_length(suplementos, 1) as qtd_suplementos,
  array_length(fitoterapicos, 1) as qtd_fitoterapicos,
  array_length(homeopatia, 1) as qtd_homeopatia,
  array_length(florais_bach, 1) as qtd_florais_bach
FROM s_suplementacao2
WHERE consulta_id = 'uuid-da-consulta'
ORDER BY created_at DESC
LIMIT 1;
```

### Parse de um Item Específico (PostgreSQL)

```sql
-- Extrair e parsear um item específico do array
SELECT 
  consulta_id,
  jsonb_array_elements_text(suplementos::jsonb)::jsonb as suplemento_item
FROM s_suplementacao2
WHERE consulta_id = 'uuid-da-consulta'
ORDER BY created_at DESC
LIMIT 1;
```

## 🔧 Endpoints da API

### GET `/api/solucao-suplementacao/[consultaId]`

**Descrição:** Busca os dados de suplementação para uma consulta específica.

**Parâmetros:**
- `consultaId` (path): UUID da consulta

**Resposta:**
```json
{
  "suplementacao_data": {
    "id": "uuid",
    "consulta_id": "uuid",
    "suplementos": [
      {
        "nome": "Vitamina D3",
        "objetivo": "Suporte ósseo",
        "dosagem": "2000 UI",
        "horario": "Manhã",
        "inicio": "2024-01-01",
        "termino": "2024-03-01"
      }
    ],
    "fitoterapicos": [],
    "homeopatia": [],
    "florais_bach": [],
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Query Interna:**
```typescript
supabase
  .from('s_suplementacao2')
  .select('*')
  .eq('consulta_id', consultaId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

**Processamento:**
- Os arrays são parseados de strings JSON para objetos JavaScript
- Função `parseJsonArray()` converte cada string JSON do array em objeto

### POST `/api/solucao-suplementacao/[consultaId]/update-field`

**Descrição:** Atualiza um campo específico de um item dentro de uma categoria.

**Body:**
```json
{
  "category": "suplementos",
  "index": 0,
  "field": "dosagem",
  "value": "3000 UI"
}
```

**Parâmetros:**
- `category` (string): Uma das categorias válidas: `suplementos`, `fitoterapicos`, `homeopatia`, `florais_bach`
- `index` (number): Índice do item no array (0-based)
- `field` (string): Campo a atualizar: `nome`, `objetivo`, `dosagem`, `horario`, `inicio`, `termino`
- `value` (string): Novo valor do campo

**Resposta:**
```json
{
  "success": true,
  "message": "Campo atualizado com sucesso",
  "updated_data": {
    "nome": "Vitamina D3",
    "objetivo": "Suporte ósseo",
    "dosagem": "3000 UI",
    "horario": "Manhã",
    "inicio": "2024-01-01",
    "termino": "2024-03-01"
  }
}
```

**Processamento:**
1. Busca o registro existente
2. Faz parse de todos os arrays
3. Atualiza o campo específico do item no índice
4. Converte de volta para arrays de strings JSON
5. Salva no banco

## 📝 Categorias de Suplementação

### 1. Suplementos (`suplementos`)
Suplementos vitamínicos, minerais e outros suplementos nutricionais.

**Exemplos:**
- Vitamina D3
- Magnésio
- Ômega-3
- Vitamina B12
- Ferro

### 2. Fitoterápicos (`fitoterapicos`)
Plantas medicinais e extratos vegetais.

**Exemplos:**
- Ashwagandha
- Valeriana
- Ginkgo Biloba
- Ginseng
- Curcumina

### 3. Homeopatia (`homeopatia`)
Medicamentos homeopáticos.

**Exemplos:**
- Arnica montana
- Nux vomica
- Pulsatilla
- Lycopodium

### 4. Florais de Bach (`florais_bach`)
Remédios florais de Bach.

**Exemplos:**
- Rescue Remedy
- Mimulus
- Rock Rose
- Star of Bethlehem

## 🔄 Processamento de Dados

### Parse de Arrays (Lendo do Banco)

```typescript
// Função usada para parsear arrays de strings JSON
const parseJsonArray = (arr: string[] | null): any[] => {
  if (!arr || !Array.isArray(arr)) return [];
  try {
    return arr.map(item => JSON.parse(item));
  } catch (error) {
    console.error('Erro ao fazer parse de array:', error);
    return [];
  }
};

// Uso:
const suplementos = parseJsonArray(suplementacaoRaw.suplementos);
// Resultado: [{ nome: "...", dosagem: "..." }, ...]
```

### Stringify de Arrays (Salvando no Banco)

```typescript
// Função usada para converter arrays de objetos em arrays de strings JSON
const stringifyJsonArray = (arr: any[]): string[] => {
  if (!arr || !Array.isArray(arr)) return [];
  try {
    return arr.map(item => JSON.stringify(item));
  } catch (error) {
    console.error('Erro ao fazer stringify de array:', error);
    return [];
  }
};

// Uso:
const suplementosParaSalvar = stringifyJsonArray(suplementos);
// Resultado: ["{\"nome\":\"...\",\"dosagem\":\"...\"}", ...]
```

## ⚠️ Notas Importantes

1. **Formato de Armazenamento:**
   - Os arrays são armazenados como **arrays de strings JSON**, não como JSONB direto
   - Cada elemento precisa ser parseado antes de usar
   - Ao salvar, os objetos precisam ser convertidos de volta para strings JSON

2. **Múltiplos Registros:**
   - Pode haver múltiplos registros para a mesma `consulta_id`
   - Sempre busca o mais recente (`ORDER BY created_at DESC LIMIT 1`)

3. **Arrays Vazios:**
   - Se uma categoria não tiver itens, o array será `[]` (vazio)
   - Não é `null`, mas um array vazio

4. **Campos do Item:**
   - Todos os campos (`nome`, `objetivo`, `dosagem`, `horario`, `inicio`, `termino`) são strings
   - Podem estar vazios (`""`) se não preenchidos

5. **Tabela vs Código:**
   - O código usa `s_suplementacao2` (com "2")
   - Existe também `s_suplementacao` (sem "2") que pode ser uma versão antiga
   - Verificar qual tabela está sendo usada no seu banco

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
WHERE table_name = 's_suplementacao2'
ORDER BY ordinal_position;

-- Ver estrutura de um registro de exemplo
SELECT *
FROM s_suplementacao2
LIMIT 1;

-- Verificar tipo de dados dos arrays
SELECT 
  consulta_id,
  pg_typeof(suplementos) as tipo_suplementos,
  array_length(suplementos, 1) as qtd_suplementos
FROM s_suplementacao2
LIMIT 1;
```

## 📚 Referências no Código

- **API de Busca:** `apps/frontend/src/app/api/solucao-suplementacao/[consultaId]/route.ts`
- **API de Atualização:** `apps/frontend/src/app/api/solucao-suplementacao/[consultaId]/update-field/route.ts`
- **Frontend:** `apps/frontend/src/app/consultas/page.tsx` (componente `SuplemementacaoSection`)
- **Interface TypeScript:** `SuplementacaoItem` (nome, objetivo, dosagem, horario, inicio, termino)

## 🎯 Resumo Rápido

| Item | Valor |
|------|-------|
| **Tabela Principal** | `s_suplementacao2` |
| **Chave de Ligação** | `consulta_id` (UUID) |
| **Colunas Principais** | `suplementos`, `fitoterapicos`, `homeopatia`, `florais_bach` |
| **Tipo de Dados** | Arrays de strings JSON (TEXT[] ou JSONB[]) |
| **Filtro de Busca** | `WHERE consulta_id = '{uuid}'` |
| **Ordenação** | `ORDER BY created_at DESC LIMIT 1` |
| **Categorias** | 4 categorias: suplementos, fitoterapicos, homeopatia, florais_bach |
| **Campos do Item** | nome, objetivo, dosagem, horario, inicio, termino |

## 💡 Exemplo de Uso Completo

```typescript
// 1. Buscar dados
const response = await fetch(`/api/solucao-suplementacao/${consultaId}`);
const { suplementacao_data } = await response.json();

// 2. Acessar itens
const primeiroSuplemento = suplementacao_data.suplementos[0];
console.log(primeiroSuplemento.nome); // "Vitamina D3"
console.log(primeiroSuplemento.dosagem); // "2000 UI"

// 3. Atualizar um campo
await fetch(`/api/solucao-suplementacao/${consultaId}/update-field`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'suplementos',
    index: 0,
    field: 'dosagem',
    value: '3000 UI'
  })
});
```



