# Integração com Webhook de Transcrição

## 📋 Resumo das Alterações

Foi adicionada a funcionalidade de enviar as transcrições das consultas online para o webhook externo quando o médico clica no botão "Finalizar Consulta".

### Webhook Endpoint
```
POST https://webhook.tc1.triacompany.com.br/webhook/usi-input-transcricao
```

### Payload Enviado
```json
{
  "consultationId": "string",
  "doctorId": "string",
  "patientId": "string",
  "transcription": "string"
}
```

## 🔧 Arquivos Modificados

### 1. `apps/frontend/src/components/webrtc/ConsultationRoom.tsx`
- **Componente**: ConsultationRoom (sistema WebRTC)
- **Função modificada**: `endRoom` (linha ~1952)
- **Funcionalidade**: 
  - Busca o ID do médico da sessão autenticada do Supabase
  - Busca o ID do médico na tabela `medicos` usando `user_auth`
  - Envia a transcrição completa para o webhook
  - Mantém o fluxo original (salvar no banco e redirecionar)

### 2. `apps/frontend/src/components/livekit/MedicalConsultationRoom.tsx`
- **Componente**: MedicalConsultationRoom (sistema LiveKit)
- **Funções adicionadas**:
  - `sendTranscriptionToWebhook` (linha ~160): Função auxiliar para envio ao webhook
  - `handleEndCallWithWebhook` (linha ~218): Intercepta o fim da consulta
- **Botão modificado**: "Finalizar Consulta" (linha ~349)
- **Funcionalidade**: 
  - Apenas envia ao webhook se o usuário for médico (`userRole === 'doctor'`)
  - Busca o ID do médico da sessão autenticada
  - Envia a transcrição para o webhook
  - Chama o callback original `onEndCall`

## 🎯 Como os IDs são Obtidos

### Doctor ID
1. Busca a sessão autenticada do Supabase (`supabase.auth.getSession()`)
2. Busca o ID real do médico na tabela `medicos` com:
   ```sql
   SELECT id FROM medicos WHERE user_auth = session.user.id
   ```
3. Se não encontrar, retorna erro e não envia ao webhook

### Consultation ID
1. Busca o `consultation_id` na tabela `call_sessions` usando:
   ```sql
   SELECT consultation_id FROM call_sessions 
   WHERE room_name = roomId OR livekit_room_id = roomId
   ```
2. Se não encontrar em `call_sessions`, busca a última consulta do médico:
   ```sql
   SELECT id FROM consultations 
   WHERE doctor_id = doctorId 
   ORDER BY created_at DESC 
   LIMIT 1
   ```
3. Se ainda não encontrar, usa o `roomId` ou `sessionId` como fallback

### Patient ID
- **ConsultationRoom**: Usa o `patientId` passado como prop na URL
- **MedicalConsultationRoom**: Usa o `patientName` (TODO: melhorar para usar ID real)

## 🧪 Como Testar

### Teste Local

1. **Iniciar o frontend**:
   ```bash
   cd apps/frontend
   npm run dev
   ```

2. **Iniciar uma consulta online**:
   - Como médico, acesse a tela de nova consulta
   - Inicie uma consulta online
   - Fale algo para gerar transcrições

3. **Finalizar a consulta**:
   - Clique no botão "Finalizar Consulta" ou "Finalizar Sala"
   - Verifique o console do navegador:
     - ✅ Deve mostrar: `📤 Enviando transcrição para webhook`
     - ✅ Deve mostrar: `📦 Dados:` com o payload completo
     - ✅ Deve mostrar: `✅ Transcrição enviada para webhook com sucesso`

4. **Verificar o webhook**:
   - Acesse o sistema que recebe o webhook
   - Verifique se os dados foram recebidos corretamente

### Logs no Console

#### Sucesso:
```
✅ Médico ID encontrado: 550e8400-e29b-41d4-a716-446655440000
✅ Consultation ID encontrado em call_sessions: 660e8400-e29b-41d4-a716-446655440001
📦 Dados do webhook: {
  consultationId: "660e8400-e29b-41d4-a716-446655440001",
  doctorId: "550e8400-e29b-41d4-a716-446655440000",
  patientId: "pat-789",
  transcription: "Transcrição completa..."
}
✅ Transcrição enviada para webhook com sucesso
```

#### Fallback quando consulta não encontrada em call_sessions:
```
✅ Médico ID encontrado: 550e8400-e29b-41d4-a716-446655440000
⚠️ Consulta não encontrada em call_sessions, buscando em consultations...
✅ Consultation ID encontrado em consultations: 770e8400-e29b-41d4-a716-446655440002
📦 Dados do webhook: {...}
✅ Transcrição enviada para webhook com sucesso
```

#### Erro:
```
❌ Médico não encontrado: error details
```
ou
```
❌ Erro ao enviar para webhook: 500 Internal Server Error
```

### Teste com Mock do Webhook

Para testar sem o webhook real, você pode usar ferramentas como:

1. **Webhook.site**:
   - Acesse https://webhook.site
   - Copie a URL única gerada
   - Temporariamente substitua a URL do webhook no código

2. **RequestBin**:
   - Acesse https://requestbin.com
   - Crie um novo bin
   - Use a URL para testes

3. **Postman Mock Server**:
   - Configure um mock server
   - Teste as requisições

## ⚠️ Observações Importantes

### Tratamento de Erros
- Se o webhook falhar, o erro é registrado no console mas **NÃO bloqueia** o fluxo normal
- A consulta continua sendo finalizada e salva no banco de dados normalmente
- O médico é redirecionado mesmo se o webhook falhar

### Segurança
- As variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` devem estar configuradas
- A sessão do Supabase é usada para autenticação
- Apenas médicos enviam dados ao webhook (verificação por `userRole`)

### Performance
- A requisição ao webhook é **assíncrona** (não bloqueia a UI)
- Timeout padrão do `fetch` é respeitado
- Em caso de timeout, o erro é registrado mas não afeta o usuário

## 🔍 Debugging

### Verificar se a sessão está autenticada:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

### Verificar se o médico existe na tabela:
```sql
SELECT * FROM medicos WHERE user_auth = '<user_id>';
```

### Testar o webhook manualmente:
```bash
curl -X POST https://webhook.tc1.triacompany.com.br/webhook/usi-input-transcricao \
  -H "Content-Type: application/json" \
  -d '{
    "consultationId": "test-123",
    "doctorId": "doc-456",
    "patientId": "pat-789",
    "transcription": "Teste de transcrição"
  }'
```

## 📝 TODOs Futuros

1. **MedicalConsultationRoom**: 
   - Melhorar obtenção do `patientId` real ao invés de usar `patientName`
   - Buscar transcrição completa real do componente TranscriptionDisplay
2. **Retry Logic**: Adicionar tentativas automáticas em caso de falha temporária
3. **Queue**: Implementar fila de envio para garantir entrega
4. **Feedback Visual**: Mostrar indicador de envio ao usuário
5. **Webhook Status**: Adicionar dashboard para monitorar status dos envios
6. **Validação**: Adicionar validação dos IDs UUID antes de enviar ao webhook

## 📞 Suporte

Em caso de problemas, verifique:
1. Console do navegador para logs de erro
2. Network tab para ver a requisição HTTP
3. Configuração das variáveis de ambiente
4. Status do webhook externo

