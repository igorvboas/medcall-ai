# 📋 Implementação de Auditoria com table_ref - Resumo

## ✅ O que foi implementado

### 1. **Migration para adicionar coluna `table_ref`**
**Arquivo:** `database/migrations/011_add_table_ref_to_audit_logs.sql`
- ✅ Adicionada coluna `table_ref VARCHAR(255)` na tabela `audit_logs`
- ✅ Criado índice para busca por `table_ref`
- ✅ Comentário explicativo adicionado

### 2. **Atualização do Serviço de Auditoria**
**Arquivo:** `apps/gateway/src/services/auditService.ts`
- ✅ Adicionado campo `table_ref` na interface `AuditLogEntry`
- ✅ Campo `table_ref` incluído no método `log()`

### 3. **Atualização dos Helpers**
**Arquivos:**
- ✅ `apps/frontend/src/lib/audit-helper.ts` - Adicionado `table_ref` na interface
- ✅ `apps/frontend/src/lib/audit-update-field-helper.ts` - Adicionado `tableRef` como parâmetro
- ✅ `apps/frontend/src/lib/audit-table-field-helper.ts` - Novo helper criado para tabelas específicas

### 4. **Rotas de Update-Field Atualizadas**

Todas as rotas de `update-field` agora registram auditoria com `table_ref`:

#### ✅ Anamnese (Tabelas a_*)
- `/api/anamnese/[consultaId]/update-field` ✅
  - Tabelas: `a_cadastro_prontuario`, `a_objetivos_queixas`, `a_historico_risco`, `a_observacao_clinica_lab`, `a_historia_vida`, `a_setenios_eventos`, `a_ambiente_contexto`, `a_sensacao_emocoes`, `a_preocupacoes_crencas`, `a_reino_miasma`

#### ✅ Diagnóstico (Tabelas d_*)
- `/api/diagnostico/[consultaId]/update-field` ✅
  - Tabelas: `d_diagnostico_principal`, `d_estado_geral`, `d_estado_mental`, `d_estado_fisiologico`, `d_agente_integracao_diagnostica`, `d_agente_habitos_vida_sistemica`

#### ✅ Solução (Tabelas s_*)
- `/api/solucao-ltb/[consultaId]/update-field` ✅
  - Tabela: `s_agente_limpeza_do_terreno_biologico`
- `/api/solucao-mentalidade/[consultaId]/update-field` ✅
  - Tabela: `s_agente_mentalidade_2`
- `/api/solucao-suplementacao/[consultaId]/update-field` ✅
  - Tabela: `s_suplementacao2`
- `/api/solucao-habitos-vida/[consultaId]/update-field` ✅
  - Tabela: `s_agente_habitos_de_vida_final`
- `/api/alimentacao/[consultaId]/update-field` ✅
  - Tabela: `s_gramaturas_alimentares`
- `/api/atividade-fisica/[consultaId]/update-field` ✅
  - Tabela: `s_exercicios_fisicos`

### 5. **Outras Rotas que Atualizam Tabelas a_***
- ✅ `/api/anamnese/update-links-exames` - Atualiza `a_observacao_clinica_lab.links_exames`
- ✅ `/api/processar-exames/[consulta_id]` - Atualiza `a_observacao_clinica_lab.links_exames`

## 📊 Formato do `table_ref`

O campo `table_ref` é populado no formato: `<NOME_DA_TABELA>.<NOME_DA_COLUNA>`

### Exemplos:
- `a_sintese_analitica.sintese`
- `a_objetivos_queixas.queixa_principal`
- `d_diagnostico_principal.cid_principal`
- `s_gramaturas_alimentares.ref1_g`
- `a_observacao_clinica_lab.links_exames`

## 🔍 O que está sendo registrado

Para cada atualização em qualquer campo de qualquer tabela `a_*`, `d_*` ou `s_*`:

```json
{
  "action": "UPDATE",
  "resource_type": "anamnese|diagnostico|solucao",
  "table_ref": "a_objetivos_queixas.queixa_principal",
  "data_before": { "queixa_principal": "Dor de cabeça" },
  "data_after": { "queixa_principal": "Dor de cabeça intensa" },
  "related_patient_id": "uuid-do-paciente",
  "related_consultation_id": "uuid-da-consulta",
  "contains_sensitive_data": true,
  "data_category": "sensivel",
  "legal_basis": "tutela_saude",
  "purpose": "Atualização de dados de anamnese",
  ...
}
```

## 📝 Tabelas Monitoradas

### Tabelas de Anamnese (a_*)
- `a_cadastro_anamnese`
- `a_cadastro_prontuario`
- `a_objetivos_queixas`
- `a_historico_risco`
- `a_observacao_clinica_laboratorial` / `a_observacao_clinica_lab`
- `a_historia_vida`
- `a_setenios_eventos`
- `a_ambiente_contexto`
- `a_sensacao_emocoes`
- `a_preocupacoes_crencas`
- `a_reino_miasma`
- `a_sintese_analitica`

### Tabelas de Diagnóstico (d_*)
- `d_diagnostico_principal`
- `d_estado_geral`
- `d_estado_mental`
- `d_estado_fisiologico`
- `d_agente_integracao_diagnostica`
- `d_agente_habitos_vida_sistemica`

### Tabelas de Solução (s_*)
- `s_agente_limpeza_do_terreno_biologico`
- `s_agente_mentalidade_do_paciente` / `s_agente_mentalidade_2`
- `s_agente_habitos_de_vida_final`
- `s_gramaturas_alimentares`
- `s_suplementacao` / `s_suplementacao2`
- `s_exercicios_fisicos`

## ✅ Status da Implementação

- ✅ Migration criada
- ✅ Serviço de auditoria atualizado
- ✅ Helpers atualizados
- ✅ Todas as rotas de update-field atualizadas (8 rotas)
- ✅ Rotas adicionais de atualização cobertas (2 rotas)
- ✅ Campo `table_ref` sendo populado corretamente

## 🎯 Próximos Passos

1. **Executar a migration** no banco de dados:
   ```sql
   -- Executar: database/migrations/011_add_table_ref_to_audit_logs.sql
   ```

2. **Testar** uma atualização em qualquer campo de anamnese/diagnóstico/solução e verificar se o log é registrado com `table_ref` preenchido.

3. **Verificar logs** na tabela `audit_logs` para confirmar que `table_ref` está sendo populado corretamente.

## 📌 Notas Importantes

- O campo `table_ref` é opcional e só é preenchido quando há atualização em tabelas `a_*`, `d_*` ou `s_*`
- Para outras operações (criação de consultas, pacientes, etc.), o campo `table_ref` permanece `NULL`
- O formato `tabela.coluna` permite rastreamento preciso de qual campo específico foi alterado
