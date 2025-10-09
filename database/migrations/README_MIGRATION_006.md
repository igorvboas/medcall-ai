# Migration 006: Adicionar Campos de Etapa às Consultas

## Descrição
Esta migration adiciona os campos `etapa` e `solucao_etapa` à tabela `consultations` para permitir o controle do workflow das consultas.

## Campos Adicionados

### `etapa`
- **Tipo**: VARCHAR(20)
- **Valores permitidos**: 'ANAMNESE', 'DIAGNOSTICO', 'SOLUCAO'
- **Descrição**: Define a etapa atual do workflow da consulta

### `solucao_etapa`
- **Tipo**: VARCHAR(30)
- **Valores permitidos**: 'LTB', 'MENTALIDADE', 'ALIMENTACAO', 'SUPLEMENTACAO', 'ATIVIDADE_FISICA', 'HABITOS_DE_VIDA'
- **Descrição**: Quando etapa=SOLUCAO, define a sub-etapa específica

### Alteração no campo `status`
- **Adicionado**: Valor 'VALIDATION' à lista de status permitidos
- **Valores completos**: 'CREATED', 'RECORDING', 'PROCESSING', 'VALIDATION', 'COMPLETED', 'ERROR', 'CANCELLED'

## Como Executar

### Opção 1: Via Supabase Dashboard
1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Copie e cole o conteúdo do arquivo `006_add_etapa_fields_to_consultations.sql`
5. Execute a query (clique em **Run**)

### Opção 2: Via CLI (se estiver usando Supabase local)
```bash
supabase db push
```

### Opção 3: Via psql
```bash
psql -h [SEU_HOST] -U [SEU_USUARIO] -d [SEU_DATABASE] -f database/migrations/006_add_etapa_fields_to_consultations.sql
```

## Verificação

Após executar a migration, você pode verificar se foi aplicada corretamente executando:

```sql
-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'consultations' 
  AND column_name IN ('etapa', 'solucao_etapa');

-- Verificar os índices criados
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'consultations' 
  AND indexname IN ('idx_consultations_etapa', 'idx_consultations_solucao_etapa');
```

## Impacto
- **Tabelas afetadas**: `consultations`
- **Dados existentes**: Não serão afetados (campos são opcionais/nullable)
- **Performance**: Índices adicionados para otimizar consultas por etapa
- **Compatibilidade**: Retrocompatível - consultas existentes continuam funcionando

## Rollback

Caso precise reverter a migration:

```sql
-- Remover colunas
ALTER TABLE consultations DROP COLUMN IF EXISTS etapa;
ALTER TABLE consultations DROP COLUMN IF EXISTS solucao_etapa;

-- Remover índices
DROP INDEX IF EXISTS idx_consultations_etapa;
DROP INDEX IF EXISTS idx_consultations_solucao_etapa;

-- Reverter constraint do status
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check 
CHECK (status IN ('CREATED', 'RECORDING', 'PROCESSING', 'COMPLETED', 'ERROR', 'CANCELLED'));
```

## Fluxo de Uso

1. **Consulta criada**: `status=PROCESSING`, `etapa=null`, `solucao_etapa=null`
2. **Processamento concluído**: `status=VALIDATION`, `etapa=ANAMNESE`
3. **Anamnese aprovada**: Botão "Salvar Alterações" → `etapa=DIAGNOSTICO`
4. **Diagnóstico aprovado**: `etapa=SOLUCAO`, `solucao_etapa=LTB` (ou outra opção)
5. **Fluxo completo**: `status=COMPLETED`

