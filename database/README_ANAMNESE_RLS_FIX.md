# Correção RLS para Tabelas de Anamnese

## Problema
O erro `JSON object requested, multiple (or no) rows returned` está ocorrendo no endpoint `/api/anamnese/[consultaId]` porque:

1. **Registros duplicados**: Existem múltiplos registros para a mesma combinação `user_id` + `consulta_id` nas tabelas de anamnese
2. **RLS inadequado**: As políticas de Row Level Security podem estar causando conflitos
3. **maybeSingle() falhando**: O método `maybeSingle()` espera 0 ou 1 registro, mas encontra múltiplos
4. **Type mismatch**: O `user_id` é tipo UUID mas estava sendo comparado com TEXT, causando erro `operator does not exist: uuid = text`

## Solução
O arquivo `fix-anamnese-rls-v3.sql` resolve o problema:

### 1. Remove registros duplicados
- Identifica registros duplicados por `user_id` + `consulta_id`
- Mantém apenas o registro mais recente (baseado em `created_at`)
- Remove os duplicados de todas as 10 tabelas de anamnese

### 2. Cria políticas RLS corretas
- Remove todas as políticas antigas
- Cria novas políticas baseadas em `user_id = auth.uid()` (UUID para UUID, sem cast)
- Permite SELECT, INSERT e UPDATE apenas para o médico autenticado
- Corrige o erro de type mismatch entre UUID e TEXT

### 3. Adiciona índices únicos
- Cria índices únicos em `(user_id, consulta_id)` para cada tabela
- Previne criação de duplicatas futuras

## Como Aplicar

### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Copie e execute o conteúdo de `fix-anamnese-rls-v3.sql`

### Opção 2: Via psql (linha de comando)
```bash
psql -h your-host -U postgres -d postgres -f fix-anamnese-rls-v3.sql
```

### Opção 3: Arquivo de aplicação rápida
```bash
psql -h your-host -U postgres -d postgres -f apply-anamnese-rls-fix.sql
```

## Tabelas Afetadas
- `a_cadastro_prontuario`
- `a_objetivos_queixas`
- `a_historico_risco`
- `a_observacao_clinica_lab`
- `a_historia_vida`
- `a_setenios_eventos`
- `a_ambiente_contexto`
- `a_sensacao_emocoes`
- `a_preocupacoes_crencas`
- `a_reino_miasma`

## Verificação
Após aplicar a correção, você pode verificar se funcionou:

```sql
-- Verificar políticas criadas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename LIKE 'a_%' 
ORDER BY tablename, cmd;

-- Verificar índices únicos
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename LIKE 'a_%' 
AND indexname LIKE '%_unique'
ORDER BY tablename;

-- Testar acesso (deve funcionar sem erro)
SELECT COUNT(*) FROM a_cadastro_prontuario;
```

## Resultado Esperado
Após aplicar esta correção:
- ✅ O endpoint `/api/anamnese/[consultaId]` deve funcionar sem erros
- ✅ Os dados de anamnese devem carregar corretamente na página de Diagnóstico
- ✅ Não haverá mais registros duplicados
- ✅ RLS funcionará corretamente baseado no usuário autenticado

## Backup Recomendado
Antes de aplicar, faça backup das tabelas afetadas:
```sql
-- Exemplo de backup (execute antes da correção)
CREATE TABLE a_cadastro_prontuario_backup AS SELECT * FROM a_cadastro_prontuario;
-- ... repita para outras tabelas
```
