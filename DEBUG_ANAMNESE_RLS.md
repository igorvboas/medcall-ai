# 🐛 Debug: Erro "Não autorizado" - Tabelas de Anamnese

## Problema
Ao acessar `/consultas?consulta_id=123456`, o sistema retorna erro "Não autorizado" ao tentar carregar dados das tabelas de anamnese.

## Possíveis Causas

### 1. RLS (Row Level Security) muito restritivo
As políticas de RLS podem estar bloqueando o acesso mesmo para usuários autenticados.

### 2. Tabelas vazias
As tabelas de anamnese podem não ter nenhum dado ainda.

### 3. Problema de autenticação
O token de autenticação pode não estar sendo passado corretamente para a API.

---

## 🔍 Passo a Passo para Debug

### PASSO 1: Verificar Autenticação

1. Abra o DevTools do navegador (F12)
2. Acesse a aba **Console**
3. Navegue para `/consultas?consulta_id=123456`
4. Procure pelos logs:
   - `🔐 Usuário autenticado: [ID]`
   - Se aparecer `❌ Falha na autenticação`, o problema é de auth

**Se falhou na autenticação:**
- Verifique se você está logado
- Limpe os cookies e faça login novamente
- Verifique se o Supabase está configurado corretamente

---

### PASSO 2: Testar RLS no Supabase

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute o script: `database/test-anamnese-access.sql`

**Resultados esperados:**
- Deve mostrar seu `user_id` e `email`
- Deve listar todas as 10 tabelas `a_*`
- Deve mostrar `rls_enabled = true` para todas as tabelas
- Deve mostrar as políticas criadas

**Se NÃO aparecer seu user_id:**
- Você não está autenticado no SQL Editor
- Tente fazer uma query simples: `SELECT auth.uid();`

---

### PASSO 3: Aplicar RLS Permissivo (Temporário)

Se o RLS está muito restritivo, vamos testá-lo com políticas mais permissivas:

1. No **Supabase SQL Editor**, execute:
   ```sql
   -- arquivo: database/fix-anamnese-rls-v2.sql
   ```

2. Este script cria políticas que permitem acesso a **QUALQUER usuário autenticado**
   - ⚠️ **Temporário para teste!** Depois deve ser ajustado para verificar `user_id`

3. Teste novamente: `/consultas?consulta_id=123456`

---

### PASSO 4: Verificar se Existem Dados

1. No **Supabase SQL Editor**, execute:
   ```sql
   SELECT COUNT(*) FROM a_cadastro_prontuario;
   SELECT COUNT(*) FROM a_objetivos_queixas;
   -- ... para cada tabela
   ```

**Se todas retornarem 0:**
- As tabelas estão vazias!
- Você precisa inserir dados de teste

---

### PASSO 5: Inserir Dados de Teste

1. Descubra os IDs necessários:
   ```sql
   -- Seu user_id
   SELECT id, email FROM auth.users WHERE email = 'seu-email@example.com';
   
   -- IDs de pacientes
   SELECT id, nome FROM pacientes LIMIT 5;
   
   -- IDs de consultas
   SELECT id FROM consultas ORDER BY created_at DESC LIMIT 5;
   ```

2. Abra o arquivo: `database/insert-test-anamnese.sql`

3. **Substitua** os valores no topo do arquivo:
   ```sql
   v_user_id TEXT := 'SEU_USER_ID_AQUI';  -- Cole aqui
   v_paciente_id TEXT := 'ID_PACIENTE_AQUI';  -- Cole aqui
   v_consulta_id TEXT := 'ID_CONSULTA_AQUI';  -- Cole aqui
   ```

4. Execute o script modificado

5. Teste novamente: `/consultas?consulta_id=ID_CONSULTA_AQUI`

---

### PASSO 6: Analisar Logs da API

Com os dados de teste inseridos, acesse a página novamente e verifique os logs:

**No Console do Navegador (F12):**
```
🔍 Buscando anamnese para consulta_id: 123456
📡 Status da resposta: 200
✅ Dados da anamnese recebidos: {...}
```

**No Terminal do Next.js:**
```
🔐 Usuário autenticado: abc-def-123
✅ a_cadastro_prontuario: OK
✅ a_objetivos_queixas: OK
❌ a_historico_risco: ERRO - new row violates row-level security
```

**Interpretação dos logs:**
- `Status 401` = problema de autenticação
- `Status 403` = problema de RLS
- `Status 200` com dados `null` = tabelas vazias (OK, design vai aparecer)
- Erros específicos em tabelas = RLS bloqueando aquela tabela específica

---

## 🛠️ Soluções Rápidas

### Solução 1: Desabilitar RLS (NÃO RECOMENDADO PARA PRODUÇÃO)
```sql
ALTER TABLE public.a_cadastro_prontuario DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.a_objetivos_queixas DISABLE ROW LEVEL SECURITY;
-- ... para cada tabela
```

### Solução 2: Política Super Permissiva (para desenvolvimento)
```sql
CREATE POLICY "allow_all_for_dev" ON public.a_cadastro_prontuario 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Solução 3: Verificar user_id nas tabelas
```sql
-- Ver quais user_ids existem nas tabelas
SELECT DISTINCT user_id FROM a_cadastro_prontuario;

-- Ver seu user_id
SELECT auth.uid();

-- Se forem diferentes, o RLS vai bloquear!
```

---

## ✅ Checklist de Verificação

- [ ] Estou autenticado no sistema?
- [ ] O RLS está habilitado nas tabelas?
- [ ] As políticas RLS foram criadas corretamente?
- [ ] Existem dados nas tabelas de anamnese?
- [ ] O `user_id` dos dados corresponde ao meu `auth.uid()`?
- [ ] Os logs no console mostram algum erro específico?
- [ ] O console do Next.js mostra os logs da API?

---

## 📞 Ainda com Problema?

Se ainda estiver com erro, me envie:

1. **Screenshot do console do navegador** com os logs
2. **Resultado da query:**
   ```sql
   SELECT auth.uid(), auth.email();
   SELECT * FROM a_cadastro_prontuario LIMIT 1;
   ```
3. **Mensagem de erro completa** que aparece na tela

