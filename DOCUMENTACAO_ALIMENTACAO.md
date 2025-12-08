# 🍽️ Documentação - Solução Alimentação

Este documento descreve as tabelas e colunas do banco de dados utilizadas pela **Solução Alimentação** no sistema MedCall AI.

## 🗄️ Tabela Principal

### `s_gramaturas_alimentares`

Esta é a tabela principal que armazena todos os dados de alimentação (gramaturas e calorias por refeição).

**Filtro de busca:**
- **Coluna de ligação:** `paciente_id` (UUID) - **IMPORTANTE: usa paciente_id, não consulta_id**
- **Query:** `WHERE paciente_id = '{paciente_id}'`
- **Ordenação:** `ORDER BY created_at ASC` (ordem cronológica)

**Nota Importante:** 
- Esta tabela usa `paciente_id` como chave de ligação, não `consulta_id`
- Para buscar os dados, primeiro é necessário obter o `patient_id` da tabela `consultations`

## 📋 Colunas da Tabela

### Colunas de Identificação

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único do registro (Primary Key) |
| `paciente_id` | UUID | **Chave de ligação** com a tabela `patients` |
| `created_at` | TIMESTAMP | Data de criação do registro |
| `updated_at` | TIMESTAMP | Data da última atualização (se existir) |

### Colunas de Dados do Alimento

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `alimento` | VARCHAR/TEXT | Nome do alimento |
| `tipo_de_alimentos` | VARCHAR/TEXT | Tipo/categoria do alimento (opcional) |

### Colunas de Gramaturas e Calorias por Refeição

A tabela armazena dados para **4 refeições** diferentes. Cada refeição tem 2 colunas: gramatura (g) e calorias (kcal).

| Coluna | Tipo | Descrição | Refeição |
|--------|------|-----------|----------|
| `ref1_g` | NUMERIC/VARCHAR | Gramatura para refeição 1 | Café da Manhã |
| `ref1_kcal` | NUMERIC/VARCHAR | Calorias para refeição 1 | Café da Manhã |
| `ref2_g` | NUMERIC/VARCHAR | Gramatura para refeição 2 | Almoço |
| `ref2_kcal` | NUMERIC/VARCHAR | Calorias para refeição 2 | Almoço |
| `ref3_g` | NUMERIC/VARCHAR | Gramatura para refeição 3 | Café da Tarde |
| `ref3_kcal` | NUMERIC/VARCHAR | Calorias para refeição 3 | Café da Tarde |
| `ref4_g` | NUMERIC/VARCHAR | Gramatura para refeição 4 | Jantar |
| `ref4_kcal` | NUMERIC/VARCHAR | Calorias para refeição 4 | Jantar |

**Mapeamento de Refeições:**
- `ref1_*` → `cafe_da_manha` (Café da Manhã)
- `ref2_*` → `almoco` (Almoço)
- `ref3_*` → `cafe_da_tarde` (Café da Tarde)
- `ref4_*` → `jantar` (Jantar)

## 🔗 Relacionamentos

### Tabela: `consultations` (indireto)
- **Caminho:** `consultations.patient_id` → `s_gramaturas_alimentares.paciente_id`
- **Uso:** Para obter o `patient_id` a partir do `consulta_id`

### Tabela: `patients`
- **Coluna de ligação:** `patients.id` = `s_gramaturas_alimentares.paciente_id`
- **Uso:** Para identificar o paciente

### Tabela: `medicos` (indireto)
- **Caminho:** `medicos.user_auth` → `auth.users.id` → (autenticação)
- **Uso:** Para validar permissões (médico só vê seus próprios pacientes)

## 📊 Estrutura dos Dados

### Estrutura no Banco de Dados

Cada registro na tabela representa um alimento que pode aparecer em uma ou mais refeições:

```sql
-- Exemplo de registro
{
  id: "uuid",
  paciente_id: "uuid-do-paciente",
  alimento: "Frango grelhado",
  tipo_de_alimentos: "Proteína",
  ref1_g: null,        -- Não usado no café da manhã
  ref1_kcal: null,
  ref2_g: "150",       -- 150g no almoço
  ref2_kcal: "247",     -- 247 kcal no almoço
  ref3_g: null,        -- Não usado no café da tarde
  ref3_kcal: null,
  ref4_g: "100",       -- 100g no jantar
  ref4_kcal: "165",    -- 165 kcal no jantar
  created_at: "2024-01-01T00:00:00Z"
}
```

### Estrutura Após Processamento (Formato da API)

Após processar os dados, a API organiza por refeição:

```json
{
  "alimentacao_data": {
    "cafe_da_manha": [
      {
        "id": "uuid",
        "alimento": "Aveia",
        "tipo": "Cereal",
        "gramatura": "50",
        "kcal": "195"
      },
      {
        "id": "uuid",
        "alimento": "Banana",
        "tipo": "Fruta",
        "gramatura": "100",
        "kcal": "89"
      }
    ],
    "almoco": [
      {
        "id": "uuid",
        "alimento": "Frango grelhado",
        "tipo": "Proteína",
        "gramatura": "150",
        "kcal": "247"
      },
      {
        "id": "uuid",
        "alimento": "Arroz integral",
        "tipo": "Carboidrato",
        "gramatura": "100",
        "kcal": "111"
      }
    ],
    "cafe_da_tarde": [
      {
        "id": "uuid",
        "alimento": "Iogurte grego",
        "tipo": "Laticínio",
        "gramatura": "200",
        "kcal": "130"
      }
    ],
    "jantar": [
      {
        "id": "uuid",
        "alimento": "Salmão",
        "tipo": "Proteína",
        "gramatura": "120",
        "kcal": "248"
      }
    ]
  },
  "consulta_id": "uuid-da-consulta",
  "patient_id": "uuid-do-paciente"
}
```

### Estrutura de um Item de Alimentação

Cada item em qualquer refeição possui:

```json
{
  "id": "uuid-do-registro",
  "alimento": "Nome do alimento",
  "tipo": "Tipo/categoria do alimento",
  "gramatura": "Quantidade em gramas",
  "kcal": "Quantidade de calorias"
}
```

## 🔍 Queries SQL de Exemplo

### Buscar Dados de Alimentação (Passo a Passo)

```sql
-- 1. Primeiro, obter o patient_id da consulta
SELECT patient_id 
FROM consultations 
WHERE id = 'uuid-da-consulta';

-- 2. Depois, buscar os dados de alimentação
SELECT 
  id,
  paciente_id,
  alimento,
  tipo_de_alimentos,
  ref1_g,
  ref1_kcal,
  ref2_g,
  ref2_kcal,
  ref3_g,
  ref3_kcal,
  ref4_g,
  ref4_kcal,
  created_at
FROM s_gramaturas_alimentares
WHERE paciente_id = 'uuid-do-paciente'
ORDER BY created_at ASC;
```

### Buscar com JOIN (Query Completa)

```sql
-- Buscar alimentação com informações da consulta e paciente
SELECT 
  ga.*,
  c.id as consulta_id,
  c.status as consulta_status,
  p.name as paciente_nome,
  p.email as paciente_email
FROM s_gramaturas_alimentares ga
JOIN patients p ON ga.paciente_id = p.id
JOIN consultations c ON c.patient_id = p.id
WHERE c.id = 'uuid-da-consulta'
ORDER BY ga.created_at ASC;
```

### Buscar Alimentos de uma Refeição Específica

```sql
-- Buscar apenas alimentos do almoço (ref2)
SELECT 
  id,
  alimento,
  tipo_de_alimentos,
  ref2_g as gramatura,
  ref2_kcal as kcal
FROM s_gramaturas_alimentares
WHERE paciente_id = 'uuid-do-paciente'
  AND (ref2_g IS NOT NULL OR ref2_kcal IS NOT NULL)
ORDER BY created_at ASC;
```

### Contar Alimentos por Refeição

```sql
-- Contar quantos alimentos existem em cada refeição
SELECT 
  paciente_id,
  COUNT(*) FILTER (WHERE ref1_g IS NOT NULL OR ref1_kcal IS NOT NULL) as qtd_cafe_manha,
  COUNT(*) FILTER (WHERE ref2_g IS NOT NULL OR ref2_kcal IS NOT NULL) as qtd_almoco,
  COUNT(*) FILTER (WHERE ref3_g IS NOT NULL OR ref3_kcal IS NOT NULL) as qtd_cafe_tarde,
  COUNT(*) FILTER (WHERE ref4_g IS NOT NULL OR ref4_kcal IS NOT NULL) as qtd_jantar
FROM s_gramaturas_alimentares
WHERE paciente_id = 'uuid-do-paciente'
GROUP BY paciente_id;
```

## 🔧 Endpoints da API

### GET `/api/alimentacao/[consultaId]`

**Descrição:** Busca os dados de alimentação para uma consulta específica.

**Parâmetros:**
- `consultaId` (path): UUID da consulta

**Processamento:**
1. Busca o `patient_id` na tabela `consultations`
2. Busca todos os registros em `s_gramaturas_alimentares` para aquele `paciente_id`
3. Organiza os dados por refeição (cafe_da_manha, almoco, cafe_da_tarde, jantar)
4. Mapeia as colunas `ref1_*` → `cafe_da_manha`, `ref2_*` → `almoco`, etc.

**Resposta:**
```json
{
  "alimentacao_data": {
    "cafe_da_manha": [
      {
        "id": "uuid",
        "alimento": "Aveia",
        "tipo": "Cereal",
        "gramatura": "50",
        "kcal": "195"
      }
    ],
    "almoco": [
      {
        "id": "uuid",
        "alimento": "Frango grelhado",
        "tipo": "Proteína",
        "gramatura": "150",
        "kcal": "247"
      }
    ],
    "cafe_da_tarde": [],
    "jantar": []
  },
  "consulta_id": "uuid-da-consulta",
  "patient_id": "uuid-do-paciente"
}
```

**Query Interna:**
```typescript
// 1. Buscar patient_id
const { data: consulta } = await supabase
  .from('consultations')
  .select('patient_id')
  .eq('id', consultaId)
  .single();

// 2. Buscar dados de alimentação
const { data: gramaturasData } = await supabase
  .from('s_gramaturas_alimentares')
  .select('*')
  .eq('paciente_id', consulta.patient_id)
  .order('created_at', { ascending: true });
```

### POST `/api/alimentacao/[consultaId]/update-field`

**Descrição:** Atualiza ou cria um item de alimentação em uma refeição específica.

**Body (Opção 1 - Edição de Item):**
```json
{
  "refeicao": "almoco",
  "index": 0,
  "alimento": "Frango grelhado",
  "tipo": "Proteína",
  "gramatura": "150",
  "kcal": "247"
}
```

**Parâmetros:**
- `refeicao` (string): Uma das refeições: `cafe_da_manha`, `almoco`, `cafe_da_tarde`, `jantar`
- `index` (number, opcional): Índice do item no array (para atualizar existente)
- `alimento` (string): Nome do alimento
- `tipo` (string, opcional): Tipo/categoria do alimento
- `gramatura` (string, opcional): Quantidade em gramas
- `kcal` (string, opcional): Quantidade de calorias

**Mapeamento de Refeições:**
```typescript
const refeicaoMapping = {
  'cafe_da_manha': { g: 'ref1_g', kcal: 'ref1_kcal' },
  'almoco': { g: 'ref2_g', kcal: 'ref2_kcal' },
  'cafe_da_tarde': { g: 'ref3_g', kcal: 'ref3_kcal' },
  'jantar': { g: 'ref4_g', kcal: 'ref4_kcal' }
};
```

**Resposta:**
```json
{
  "success": true,
  "message": "Dados de alimentação salvos com sucesso"
}
```

**Processamento:**
1. Busca o `patient_id` da consulta
2. Se `index` for fornecido, atualiza o registro existente
3. Se não, cria um novo registro na tabela
4. Mapeia a refeição para as colunas corretas (`ref1_*`, `ref2_*`, etc.)

**Body (Opção 2 - Atualização Genérica):**
```json
{
  "fieldPath": "cafe_da_manha.0.gramatura",
  "value": "60"
}
```

**Nota:** Esta opção atualiza dados na coluna `alimentacao_data` da tabela `consultations` (método legado).

## 📝 Refeições Disponíveis

### 1. Café da Manhã (`cafe_da_manha`)
- **Colunas no banco:** `ref1_g`, `ref1_kcal`
- **Horário típico:** 6h - 9h
- **Exemplos:** Aveia, frutas, ovos, pão integral

### 2. Almoço (`almoco`)
- **Colunas no banco:** `ref2_g`, `ref2_kcal`
- **Horário típico:** 12h - 14h
- **Exemplos:** Proteínas, carboidratos, vegetais

### 3. Café da Tarde (`cafe_da_tarde`)
- **Colunas no banco:** `ref3_g`, `ref3_kcal`
- **Horário típico:** 15h - 17h
- **Exemplos:** Lanches, frutas, iogurte

### 4. Jantar (`jantar`)
- **Colunas no banco:** `ref4_g`, `ref4_kcal`
- **Horário típico:** 19h - 21h
- **Exemplos:** Proteínas leves, vegetais, sopas

## 🔄 Processamento de Dados

### Mapeamento de Refeições (Lendo do Banco)

```typescript
// Função usada para mapear dados do banco para o formato da API
gramaturasData.forEach((item: any) => {
  // Café da Manhã (ref1)
  if (item.ref1_g || item.ref1_kcal) {
    alimentacaoData.cafe_da_manha.push({
      id: item.id,
      alimento: item.alimento || '',
      tipo: item.tipo_de_alimentos || '',
      gramatura: item.ref1_g || '',
      kcal: item.ref1_kcal || ''
    });
  }
  
  // Almoço (ref2)
  if (item.ref2_g || item.ref2_kcal) {
    alimentacaoData.almoco.push({
      id: item.id,
      alimento: item.alimento || '',
      tipo: item.tipo_de_alimentos || '',
      gramatura: item.ref2_g || '',
      kcal: item.ref2_kcal || ''
    });
  }
  
  // Café da Tarde (ref3)
  if (item.ref3_g || item.ref3_kcal) {
    alimentacaoData.cafe_da_tarde.push({
      id: item.id,
      alimento: item.alimento || '',
      tipo: item.tipo_de_alimentos || '',
      gramatura: item.ref3_g || '',
      kcal: item.ref3_kcal || ''
    });
  }
  
  // Jantar (ref4)
  if (item.ref4_g || item.ref4_kcal) {
    alimentacaoData.jantar.push({
      id: item.id,
      alimento: item.alimento || '',
      tipo: item.tipo_de_alimentos || '',
      gramatura: item.ref4_g || '',
      kcal: item.ref4_kcal || ''
    });
  }
});
```

### Mapeamento de Refeições (Salvando no Banco)

```typescript
// Função usada para mapear dados da API para o formato do banco
const refeicaoMapping = {
  'cafe_da_manha': { g: 'ref1_g', kcal: 'ref1_kcal' },
  'almoco': { g: 'ref2_g', kcal: 'ref2_kcal' },
  'cafe_da_tarde': { g: 'ref3_g', kcal: 'ref3_kcal' },
  'jantar': { g: 'ref4_g', kcal: 'ref4_kcal' }
};

const campos = refeicaoMapping[refeicao];
const updateData = {
  alimento: alimento,
  tipo_de_alimentos: tipo || null,
  [campos.g]: gramatura || null,
  [campos.kcal]: kcal || null
};
```

## ⚠️ Notas Importantes

1. **Chave de Ligação:**
   - A tabela usa `paciente_id`, **não** `consulta_id`
   - Para buscar dados, primeiro obtenha o `patient_id` da tabela `consultations`

2. **Múltiplos Registros:**
   - Um alimento pode aparecer em múltiplas refeições (mesmo registro com diferentes `ref*_*`)
   - Um alimento pode aparecer em apenas uma refeição (outros `ref*_*` são `null`)

3. **Campos Opcionais:**
   - `tipo_de_alimentos` pode ser `null`
   - `gramatura` e `kcal` podem ser `null` se o alimento não for usado naquela refeição

4. **Ordenação:**
   - Os dados são ordenados por `created_at ASC` (mais antigo primeiro)
   - Isso mantém a ordem cronológica dos alimentos

5. **Estrutura de Dados:**
   - Cada registro na tabela representa um alimento
   - O mesmo alimento pode ter valores diferentes para diferentes refeições
   - A API organiza os dados por refeição para facilitar o uso no frontend

6. **Valores Nulos:**
   - Se um alimento não é usado em uma refeição, as colunas `ref*_g` e `ref*_kcal` são `null`
   - A API só inclui o item na refeição se pelo menos uma das colunas (`ref*_g` ou `ref*_kcal`) não for `null`

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
WHERE table_name = 's_gramaturas_alimentares'
ORDER BY ordinal_position;

-- Ver estrutura de um registro de exemplo
SELECT *
FROM s_gramaturas_alimentares
WHERE paciente_id = 'uuid-do-paciente'
LIMIT 5;

-- Verificar quantos alimentos existem por refeição
SELECT 
  COUNT(*) FILTER (WHERE ref1_g IS NOT NULL OR ref1_kcal IS NOT NULL) as cafe_manha,
  COUNT(*) FILTER (WHERE ref2_g IS NOT NULL OR ref2_kcal IS NOT NULL) as almoco,
  COUNT(*) FILTER (WHERE ref3_g IS NOT NULL OR ref3_kcal IS NOT NULL) as cafe_tarde,
  COUNT(*) FILTER (WHERE ref4_g IS NOT NULL OR ref4_kcal IS NOT NULL) as jantar
FROM s_gramaturas_alimentares
WHERE paciente_id = 'uuid-do-paciente';
```

## 📚 Referências no Código

- **API de Busca:** `apps/frontend/src/app/api/alimentacao/[consultaId]/route.ts`
- **API de Atualização:** `apps/frontend/src/app/api/alimentacao/[consultaId]/update-field/route.ts`
- **Frontend:** `apps/frontend/src/app/consultas/page.tsx` (componente `AlimentacaoSection`)

## 🎯 Resumo Rápido

| Item | Valor |
|------|-------|
| **Tabela Principal** | `s_gramaturas_alimentares` |
| **Chave de Ligação** | `paciente_id` (UUID) - **NÃO consulta_id** |
| **Colunas Principais** | `alimento`, `tipo_de_alimentos`, `ref1_*`, `ref2_*`, `ref3_*`, `ref4_*` |
| **Tipo de Dados** | VARCHAR/TEXT para nomes, NUMERIC/VARCHAR para gramaturas e calorias |
| **Filtro de Busca** | `WHERE paciente_id = '{uuid}'` |
| **Ordenação** | `ORDER BY created_at ASC` |
| **Refeições** | 4 refeições: cafe_da_manha, almoco, cafe_da_tarde, jantar |
| **Campos do Item** | id, alimento, tipo, gramatura, kcal |

## 💡 Exemplo de Uso Completo

```typescript
// 1. Buscar dados
const response = await fetch(`/api/alimentacao/${consultaId}`);
const { alimentacao_data } = await response.json();

// 2. Acessar itens de uma refeição
const alimentosAlmoco = alimentacao_data.almoco;
console.log(alimentosAlmoco[0].alimento); // "Frango grelhado"
console.log(alimentosAlmoco[0].gramatura); // "150"

// 3. Adicionar/Atualizar um alimento
await fetch(`/api/alimentacao/${consultaId}/update-field`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refeicao: 'almoco',
    alimento: 'Salmão',
    tipo: 'Proteína',
    gramatura: '120',
    kcal: '248'
  })
});
```

## 🔄 Diferenças Importantes

### Comparação com Outras Soluções

| Aspecto | Alimentação | Suplementação | Livro da Vida |
|---------|-------------|---------------|---------------|
| **Chave de Ligação** | `paciente_id` | `consulta_id` | `consulta_id` |
| **Estrutura** | Múltiplos registros | Um registro com arrays | Um registro com campos JSON |
| **Organização** | Por refeição (4 refeições) | Por categoria (4 categorias) | Por padrão (10 padrões) |
| **Tipo de Dados** | Colunas diretas | Arrays de JSON strings | Campos JSONB/TEXT |



