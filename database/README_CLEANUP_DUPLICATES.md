# Correção de Registros Duplicados - Anamnese

## Problema Identificado

O erro `JSON object requested, multiple (or no) rows returned` está ocorrendo porque existem **múltiplos registros** com o mesmo `consulta_id` nas tabelas de anamnese.

### Logs do Erro:
```
✅ a_cadastro_prontuario: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_historico_risco: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_observacao_clinica_lab: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_historia_vida: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_setenios_eventos: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_ambiente_contexto: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_sensacao_emocoes: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_preocupacoes_crencas: ERRO - JSON object requested, multiple (or no) rows returned
✅ a_reino_miasma: ERRO - JSON object requested, multiple (or no) rows returned
```

### Causa Raiz:
- O método `.maybeSingle()` do Supabase espera **0 ou 1 registro**
- Quando existem múltiplos registros, ele lança um erro
- As tabelas de anamnese têm registros duplicados para o mesmo `consulta_id`

## Solução Implementada

### 1. Script SQL de Limpeza
**Arquivo:** `cleanup-duplicate-anamnese.sql`

Este script:
- ✅ Identifica todos os registros duplicados
- ✅ Remove duplicatas, **mantendo apenas o mais recente** (baseado em `created_at`)
- ✅ Cria índices únicos em `consulta_id` para **prevenir duplicatas futuras**
- ✅ Verifica os resultados após a limpeza

### 2. Modificação da API
**Arquivo:** `apps/frontend/src/app/api/anamnese/[consultaId]/route.ts`

Alteração feita:
- ❌ **Antes:** `.eq('consulta_id', consultaId).maybeSingle()`
- ✅ **Depois:** `.eq('consulta_id', consultaId).order('created_at', { ascending: false }).limit(1).single()`

**Por quê?**
- `.order('created_at', { ascending: false })` - ordena do mais recente para o mais antigo
- `.limit(1)` - pega apenas o primeiro registro (o mais recente)
- `.single()` - espera exatamente 1 registro (ou erro se não encontrar nada)

Isso garante que mesmo se houver duplicatas, a API sempre pegará o registro mais recente.

## Como Aplicar a Correção

### Passo 1: Executar o Script SQL
Execute o arquivo `cleanup-duplicate-anamnese.sql` no seu banco de dados Supabase:

```bash
# Via Supabase Dashboard
# 1. Acesse SQL Editor
# 2. Copie e cole o conteúdo de cleanup-duplicate-anamnese.sql
# 3. Execute
```

ou via linha de comando:
```bash
psql -h your-host -U postgres -d postgres -f cleanup-duplicate-anamnese.sql
```

### Passo 2: Verificar os Resultados
Após executar o script, você verá:
- Quantos registros duplicados foram encontrados
- Quantos registros foram removidos
- A confirmação de que os índices únicos foram criados

### Passo 3: Testar a API
A API já foi modificada para lidar com duplicatas caso ainda existam. Teste acessando:
```
GET /api/anamnese/{consultaId}
```

## Verificação de Sucesso

Execute estas queries para verificar que não há mais duplicatas:

```sql
-- Deve retornar 0 linhas (nenhuma duplicata)
SELECT consulta_id, COUNT(*) as quantidade
FROM a_cadastro_prontuario
GROUP BY consulta_id
HAVING COUNT(*) > 1;

-- Repita para todas as tabelas...
```

## Prevenção de Duplicatas Futuras

Os índices únicos criados garantem que:
- ✅ Cada `consulta_id` terá **apenas 1 registro** por tabela
- ✅ Tentativas de inserir duplicatas **serão bloqueadas automaticamente** pelo banco
- ✅ Erros serão claros se houver tentativa de inserção duplicada

## Resultado Esperado

Após aplicar esta correção:
- ✅ O endpoint `/api/anamnese/[consultaId]` funcionará sem erros
- ✅ Os dados de anamnese serão carregados corretamente na página de Diagnóstico
- ✅ Não haverá mais erros de "multiple rows returned"
- ✅ Duplicatas futuras serão prevenidas automaticamente

## Monitoramento

Para monitorar se tudo está funcionando:

```sql
-- Ver quantos registros por consulta (deve ser sempre 1 ou 0)
SELECT 
    'a_cadastro_prontuario' as tabela,
    COUNT(*) as total_registros,
    COUNT(DISTINCT consulta_id) as consultas_unicas,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT consulta_id) THEN '✅ SEM DUPLICATAS'
        ELSE '❌ TEM DUPLICATAS'
    END as status
FROM a_cadastro_prontuario;
```

