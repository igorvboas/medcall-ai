# Correções de Reconexão WebRTC e Transcrição

## Problemas Identificados e Resolvidos

### 1. ❌ **Vídeo não volta após refresh da página**
**Problema:** Quando o usuário fazia refresh, o stream de vídeo local não era corretamente anexado ao elemento de vídeo após a reconexão.

**Causa raiz:** 
- O elemento `localVideoRef.current` poderia não estar disponível no momento em que `fetchUserMedia()` tentava setar o `srcObject`
- Timing issue entre a criação do DOM e a obtenção do stream de mídia

**Solução implementada:**
- Adicionado lógica de retry com timeout para anexar o stream ao elemento de vídeo
- Função `attachVideoStream()` tenta até 10 vezes com delay de 100ms entre tentativas
- Aplicado tanto para vídeo local quanto remoto

**Arquivos modificados:**
- `apps/frontend/src/components/webrtc/ConsultationRoom.tsx` (linhas 2113-2128, 2201-2213, 2364-2418)

---

### 2. ❌ **Transcrições são perdidas na reconexão**
**Problema:** Ao fazer refresh ou reconectar, todo o histórico de transcrições era perdido, obrigando o usuário a começar do zero.

**Causa raiz:**
- As transcrições eram armazenadas apenas em memória no backend (`room.transcriptions`)
- O frontend não recebia o histórico ao reconectar
- Não havia lógica para restaurar transcrições anteriores no `TranscriptionManager`

**Solução implementada:**

#### Backend (Gateway):
- Modificado o evento `joinRoom` para incluir `transcriptionHistory` na resposta
- Histórico é enviado para host e participante em casos de:
  - Reconexão do host
  - Reconexão do participante
  - Entrada inicial na sala (caso já existam transcrições)

**Arquivos modificados:**
- `apps/gateway/src/websocket/rooms.ts` (linhas 264-275, 301-312, 346-357)

#### Frontend:
- Adicionada lógica para processar `roomData.transcriptionHistory` ao entrar/reconectar
- Cada transcrição histórica é restaurada no `TranscriptionManager`
- Implementado em 3 pontos de entrada:
  1. `rejoinRoom()` - reconexão geral
  2. `joinRoomAsHost()` - médico entrando/reconectando
  3. `joinRoomAsParticipant()` - paciente entrando/reconectando

**Arquivos modificados:**
- `apps/frontend/src/components/webrtc/ConsultationRoom.tsx` (linhas 388-408, 1192-1212, 1292-1312)

---

### 3. ❌ **Conexão OpenAI é perdida a cada refresh**
**Problema:** A cada refresh, uma nova conexão WebSocket com a OpenAI era criada, perdendo o contexto e causando desconexões desnecessárias.

**Causa raiz:**
- A conexão OpenAI era mantida no backend por usuário (`openAIConnections` Map)
- O frontend sempre tentava criar uma nova conexão sem verificar se já existia uma ativa
- Listeners antigos não eram limpos corretamente

**Solução implementada:**
- Modificado o evento `transcription:connect` para verificar se já existe uma conexão OpenAI ativa
- Se a conexão está aberta (readyState === OPEN), ela é reutilizada
- Listeners são reconfigurados para o novo socket do cliente
- Se a conexão está fechada, é removida e uma nova é criada

**Arquivos modificados:**
- `apps/gateway/src/websocket/rooms.ts` (linhas 469-526)

---

### 4. ❌ **WebRTC não reconecta adequadamente**
**Problema:** Após refresh, a conexão WebRTC não era reestabelecida corretamente, deixando o vídeo travado ou sem conexão.

**Causa raiz:**
- `PeerConnection` antiga não era fechada antes de criar uma nova
- ICE candidates podiam ser enviados/recebidos antes da conexão estar pronta
- Elementos de vídeo remoto podiam não estar disponíveis ao receber tracks

**Solução implementada:**

#### Limpeza de PeerConnection:
- Adicionada verificação para fechar `peerConnection` anterior antes de criar nova
- Evita acúmulo de conexões abertas e comportamento indefinido

**Arquivos modificados:**
- `apps/frontend/src/components/webrtc/ConsultationRoom.tsx` (linhas 2250-2259)

#### Tratamento de vídeo remoto:
- Função `attachRemoteStream()` com retry para anexar stream remoto
- Tratamento robusto de autoplay bloqueado pelo navegador
- Listeners para interação do usuário caso autoplay seja bloqueado

**Arquivos modificados:**
- `apps/frontend/src/components/webrtc/ConsultationRoom.tsx` (linhas 2364-2418)

---

### 5. ✅ **Endpoint REST para recuperar transcrições**
**Novo recurso:** Adicionado endpoint REST para recuperar histórico de transcrições de forma síncrona.

**Uso:**
```bash
GET /api/rooms/:roomId/transcriptions
```

**Resposta:**
```json
{
  "success": true,
  "roomId": "room-abc123",
  "transcriptions": [
    {
      "speaker": "Dr. João",
      "text": "Como você está se sentindo?",
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  ],
  "count": 1,
  "roomStatus": "active"
}
```

**Arquivos modificados:**
- `apps/gateway/src/routes/rooms.ts` (linhas 1-3, 51-124)
- `apps/gateway/src/websocket/rooms.ts` (linhas 937-944) - exportação do mapa `rooms`

---

## Resumo das Melhorias

### ✅ Reconexão robusta
- Vídeo local e remoto são anexados corretamente mesmo com delays no DOM
- PeerConnection é limpa adequadamente antes de reconectar
- ICE candidates são tratados corretamente

### ✅ Persistência de transcrições
- Histórico completo de transcrições é recuperado ao reconectar
- Backend envia automaticamente o histórico no `joinRoom`
- Frontend restaura transcrições no TranscriptionManager

### ✅ Eficiência de conexões
- Conexões OpenAI são reutilizadas quando possível
- Listeners são reconfigurados sem criar novas conexões
- Menos overhead e melhor uso de recursos

### ✅ Melhor experiência do usuário
- Refresh da página não perde mais dados
- Transcrições permanecem visíveis após reconexão
- Vídeo é restaurado automaticamente
- Processo de reconexão é transparente para o usuário

---

## Como Testar

### Teste 1: Refresh durante chamada ativa
1. Inicie uma consulta online
2. Verifique que vídeo local e remoto estão funcionando
3. Digite algumas mensagens/transcrições
4. Faça refresh da página (F5)
5. ✅ Verifique que:
   - Vídeo local volta a aparecer
   - Vídeo remoto volta a aparecer
   - Transcrições anteriores são restauradas
   - Nova conexão OpenAI reutiliza a existente

### Teste 2: Desconexão temporária de internet
1. Inicie uma consulta
2. Desconecte a internet por 5-10 segundos
3. Reconecte a internet
4. ✅ Verifique que a chamada é reestabelecida automaticamente

### Teste 3: Múltiplos refreshes
1. Inicie uma consulta
2. Faça refresh 3-4 vezes seguidas
3. ✅ Verifique que não há acúmulo de conexões ou erros no console

---

## Logs de Debug

Para acompanhar o processo de reconexão, procure por estes logs no console:

### Frontend:
```
🔄 Rejuntando à sala: room-xxx como doctor
✅ Rejuntado à sala com sucesso!
🔄 Restaurando N transcrições históricas...
✅ Transcrições históricas restauradas!
📹 [MÍDIA] ✅ Stream local atribuído ao elemento de vídeo
🔍 DEBUG [REFERENCIA] [WEBRTC] Atribuindo remote stream id=...
✅ WebRTC conectado com sucesso!
```

### Backend:
```
[userName] Solicitando conexão OpenAI na sala room-xxx
[userName] ✅ Reutilizando conexão OpenAI existente (reconexão)
🔄 Reconexão do host: userName na sala room-xxx
✅ [API] Retornado N transcrições para sala room-xxx
```

---

## Arquivos Modificados

### Backend (Gateway):
1. `apps/gateway/src/websocket/rooms.ts`
   - Linhas 264-275: Enviar histórico na reconexão do host
   - Linhas 301-312: Enviar histórico na reconexão do participante
   - Linhas 346-357: Enviar histórico na entrada na sala
   - Linhas 469-526: Reutilizar conexão OpenAI existente
   - Linhas 937-944: Exportar mapa de salas

2. `apps/gateway/src/routes/rooms.ts`
   - Linhas 1-3: Importar mapa de salas
   - Linhas 51-124: Endpoints REST para sala e transcrições

### Frontend:
1. `apps/frontend/src/components/webrtc/ConsultationRoom.tsx`
   - Linhas 388-408: Restaurar transcrições em `rejoinRoom()`
   - Linhas 1192-1212: Restaurar transcrições em `joinRoomAsHost()`
   - Linhas 1292-1312: Restaurar transcrições em `joinRoomAsParticipant()`
   - Linhas 2113-2128: Anexar vídeo local com retry
   - Linhas 2201-2213: Anexar vídeo local no retry de erro
   - Linhas 2250-2259: Limpar PeerConnection anterior
   - Linhas 2364-2418: Anexar vídeo remoto com retry e autoplay handling

---

## Próximos Passos (Opcional)

### Melhorias futuras sugeridas:
1. **Persistir transcrições em banco de dados em tempo real** (atualmente só salva ao finalizar sala)
2. **Indicador visual de reconexão** para o usuário
3. **Retry automático de ICE candidates** em caso de falha
4. **Métricas de qualidade de conexão** (latência, perda de pacotes)
5. **Snapshot periódico do estado da sala** para recuperação mais robusta

---

## Autor
Correções implementadas em: 12/11/2025

