# Upload de Exames Laboratoriais

## Visão Geral

Esta funcionalidade permite aos médicos fazer upload de arquivos de exames laboratoriais durante a etapa de anamnese de consultas com status `VALIDATION`. O sistema processa automaticamente os arquivos, salva os links na base de dados e notifica sistemas externos via webhook.

## Funcionalidades Implementadas

### 1. Upload de Arquivos Múltiplos
- **Componente**: `FileUpload.tsx`
- **Localização**: `apps/frontend/src/components/FileUpload.tsx`
- **Recursos**:
  - Upload de múltiplos arquivos simultaneamente
  - Validação de tipos de arquivo (PDF, DOC, DOCX, JPG, PNG)
  - Validação de tamanho (máximo 10MB por arquivo)
  - Interface drag-and-drop
  - Preview dos arquivos selecionados
  - Indicadores de progresso

### 2. Seção de Upload de Exames
- **Componente**: `ExamesUploadSection.tsx`
- **Localização**: `apps/frontend/src/components/ExamesUploadSection.tsx`
- **Recursos**:
  - Aparece apenas para consultas com `status=VALIDATION` e `etapa=ANAMNESE`
  - Interface intuitiva com instruções claras
  - Processamento completo do fluxo de upload
  - Feedback visual do status do processamento

### 3. APIs de Backend

#### Upload de Arquivos
- **Endpoint**: `POST /api/upload-exames`
- **Função**: Upload de arquivos para o bucket `exames` do Supabase Storage
- **Validações**:
  - Autenticação do usuário
  - Verificação de permissões na consulta
  - Validação do status da consulta
  - Geração de URLs públicas

#### Atualização de Links
- **Endpoint**: `PATCH /api/anamnese/update-links-exames`
- **Função**: Atualiza o campo `links_exames` na tabela `a_observacao_clinica_lab`
- **Recursos**:
  - Cria ou atualiza registro existente
  - Busca médico na tabela `medicos`
  - Validação de permissões

#### Webhook Externo
- **Endpoint**: `POST /api/webhook/exames`
- **Função**: Envia dados para webhook externo da TRIA
- **URL**: `https://triahook.gst.dev.br/webhook/5d03fec8-6a3a-4399-8ddc-a4839e0db3ea/:input-at-exames-usi`
- **Dados enviados**: `consulta_id`, `medico_id`, `paciente_id`

#### Processamento Completo
- **Endpoint**: `POST /api/processar-exames`
- **Função**: Orquestra todo o processo de processamento
- **Fluxo**:
  1. Altera status da consulta para `PROCESSING`
  2. Salva links dos arquivos na tabela `a_observacao_clinica_lab`
  3. Chama webhook externo
  4. Retorna resultado consolidado

## Configuração do Banco de Dados

### Estrutura da Tabela
A tabela `a_observacao_clinica_lab` já possui o campo `links_exames text[] null` necessário para armazenar os links dos arquivos de exames. Não é necessária nenhuma migração adicional.

### Bucket do Supabase Storage
Certifique-se de que o bucket `exames` existe no Supabase Storage:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('exames', 'exames', false);
```

## Como Usar

### Para Médicos

1. **Acesse uma consulta** com status `VALIDATION` e etapa `ANAMNESE`
2. **Role até a seção** "Upload de Exames Laboratoriais"
3. **Selecione os arquivos**:
   - Clique em "Selecionar Arquivos" ou
   - Arraste e solte os arquivos na área indicada
4. **Clique em "Processar Exames"**
5. **Aguarde o processamento** (upload, salvamento e notificação)
6. **A página será recarregada** automaticamente após o sucesso

### Formatos Aceitos
- **Documentos**: PDF, DOC, DOCX
- **Imagens**: JPG, PNG
- **Tamanho máximo**: 10MB por arquivo
- **Quantidade máxima**: 10 arquivos por vez

## Logs e Debugging

O sistema inclui logs detalhados para debugging:

```javascript
console.log('🔍 DEBUG [REFERENCIA] Iniciando upload de arquivos de exames');
console.log('✅ Upload concluído para arquivo:', fileName);
console.log('🔍 DEBUG [REFERENCIA] Atualizando links de exames na tabela');
console.log('✅ Links de exames atualizados na tabela');
console.log('🔍 DEBUG [REFERENCIA] Enviando dados para webhook externo');
console.log('✅ Webhook executado com sucesso');
```

## Tratamento de Erros

### Erros de Upload
- Arquivo muito grande
- Tipo de arquivo não suportado
- Falha na conexão com Supabase Storage

### Erros de Processamento
- Falha na atualização da base de dados
- Erro na comunicação com webhook
- Problemas de permissão

### Recuperação
- Status da consulta é revertido em caso de falha crítica
- Arquivos já enviados são mantidos mesmo com falha no webhook
- Mensagens de erro claras para o usuário

## Segurança

### Autenticação
- Todas as APIs verificam autenticação via `getAuthenticatedSession()`
- Validação de permissões do médico na consulta

### Validação de Arquivos
- Verificação de tipos MIME
- Validação de extensões
- Limite de tamanho por arquivo

### Controle de Acesso
- Médicos só podem acessar suas próprias consultas
- Verificação de status da consulta antes do processamento

## Monitoramento

### Métricas Importantes
- Taxa de sucesso no upload
- Tempo de processamento
- Falhas no webhook externo
- Uso do storage

### Alertas
- Falhas críticas no processamento
- Problemas de conectividade com webhook
- Uso excessivo de storage

## Troubleshooting

### Problemas Comuns

1. **"Upload não permitido para este status"**
   - Verificar se a consulta tem status `VALIDATION`
   - Verificar se a etapa é `ANAMNESE`

2. **"Médico não encontrado"**
   - Verificar se o médico existe na tabela `medicos`
   - Verificar se `user_auth` está corretamente vinculado

3. **"Falha na comunicação com webhook"**
   - Verificar conectividade com a internet
   - Verificar se a URL do webhook está correta
   - Verificar logs do servidor externo

### Logs Úteis
```bash
# Verificar logs do Supabase
# Verificar logs do webhook externo
# Verificar logs da aplicação Next.js
```
