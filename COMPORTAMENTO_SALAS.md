# 🚪 Comportamento de Salas - MedCall AI

## 📋 Resumo

Este documento explica como as salas de videochamada funcionam quando usuários entram, saem ou finalizam a sala.

---

## ✅ Botão "Finalizar Sala" - FUNCIONANDO CORRETAMENTE

### Quando o Host clica em "Finalizar Sala":

1. ✅ **Salva transcrições** no banco de dados Supabase
2. ✅ **Notifica o participante** que a sala foi finalizada
3. ✅ **Fecha todas as conexões** (host e participante)
4. ✅ **Remove a sala completamente** da memória
5. ✅ **Limpa todos os timers** e mapeamentos
6. ✅ **Libera recursos** (conexões OpenAI, WebSocket, etc.)

**Código:** `apps/gateway/src/websocket/rooms.ts` - evento `endRoom` (linhas 582-730)

### Quem pode finalizar?

- ✅ Apenas o **host (médico)** pode finalizar a sala
- ⚠️ Se o participante tentar, receberá erro: `"Apenas o host pode finalizar a sala"`

---

## 🔄 Comportamento de Desconexão/Reconexão (CORRIGIDO)

### Cenário 1: Host sai (participante ainda na sala)

```
Antes:  Host e Participante conectados
↓
Host desconecta (fecha navegador, perde internet, etc.)
↓
Status: Sala permanece ativa
Timer:  8 horas para permitir reconexão do host
↓
Host pode voltar e continuar a consulta
```

**Comportamento:**
- ✅ Sala **permanece aberta** por até **8 horas**
- ✅ Participante continua na sala normalmente
- ✅ Host pode **reconectar** e retomar a consulta
- ✅ Transcrições continuam sendo capturadas

### Cenário 2: Participante sai (host ainda na sala)

```
Antes:  Host e Participante conectados
↓
Participante desconecta
↓
Status: Sala fica "esperando participante"
Timer:  8 horas para permitir reconexão
↓
Participante pode voltar e reconectar
```

**Comportamento:**
- ✅ Sala **permanece aberta** por até **8 horas**
- ✅ Host continua na sala normalmente
- ✅ Participante pode **reconectar** a qualquer momento
- ✅ Vaga do participante é **liberada** (outro pode entrar)

### Cenário 3: AMBOS saem (sala fica vazia) ⭐ NOVO

```
Antes:  Host e Participante conectados
↓
Host desconecta
↓
Participante desconecta
↓
Status: Sala vazia detectada
Timer:  2 MINUTOS (janela de reconexão rápida)
↓
Se ninguém reconectar em 2 minutos → Sala é DELETADA automaticamente
```

**Comportamento:**
- ✅ Sala fica aberta por **apenas 2 minutos**
- ✅ Permite reconexão rápida (ex: queda de internet)
- ✅ Após 2 minutos → Sala é **limpa automaticamente**
- ✅ Economiza recursos do servidor
- ⚠️ Transcrições **NÃO são salvas** (use "Finalizar Sala" para salvar)

### Cenário 4: Host sai da sala "waiting" (sem participante)

```
Antes:  Host criou sala, mas nenhum participante entrou
↓
Host desconecta
↓
Status: Sala deletada IMEDIATAMENTE
```

**Comportamento:**
- ✅ Sala é **deletada na hora**
- ✅ Não desperdiça recursos com salas vazias
- ✅ Host precisa criar nova sala ao voltar

---

## ⏱️ Timers e Timeouts

| Situação | Tempo | Motivo |
|----------|-------|--------|
| **Sala ativa (1 pessoa conectada)** | 8 horas | Permitir consultas longas e reconexão |
| **Sala vazia (ambos saíram)** | 2 minutos | Reconexão rápida, mas limpar recursos |
| **Sala "waiting" vazia** | Imediato | Não desperdiçar recursos |
| **Inatividade WebSocket** | 10 minutos | Detectar conexões mortas |
| **Ping/Keepalive** | 25 segundos | Manter conexão viva |

---

## 🎯 Recomendações de Uso

### Para Médicos (Host):

1. ✅ **Use "Finalizar Sala"** ao terminar a consulta
   - Isso garante que transcrições sejam salvas
   - Libera recursos imediatamente
   - Fecha corretamente para o paciente

2. ⚠️ **Não feche o navegador sem finalizar**
   - Sala ficará "órfã" por 2 minutos
   - Transcrições podem não ser salvas
   - Paciente pode ficar esperando

3. ✅ **Em caso de queda de conexão:**
   - Você tem 8 horas para reconectar
   - Transcrições continuam sendo capturadas
   - Estado da sala é mantido

### Para Pacientes:

1. ✅ **Se perder conexão:**
   - Você pode reconectar imediatamente
   - Basta recarregar a página
   - A consulta continua do mesmo ponto

2. ⚠️ **Se ambos perderem conexão:**
   - Vocês têm 2 minutos para voltar
   - Após isso, sala é encerrada
   - Médico precisa criar nova sala

---

## 🔍 Monitoramento

### Ver logs de desconexão:

```bash
gcloud run logs read medcall-gateway \
  --region=southamerica-east1 \
  --filter="textPayload:desconectou" \
  --follow
```

### Ver logs de limpeza de salas:

```bash
gcloud run logs read medcall-gateway \
  --region=southamerica-east1 \
  --filter="textPayload:Limpando" \
  --follow
```

### Verificar salas ativas (no código):

O mapa `rooms` mantém todas as salas ativas. Para debug:

```typescript
// No console do servidor
console.log('Salas ativas:', rooms.size);
rooms.forEach((room, roomId) => {
  console.log(`${roomId}: ${room.status}, host: ${!!room.hostSocketId}, participant: ${!!room.participantSocketId}`);
});
```

---

## 🆘 Troubleshooting

### Problema: "Sala não fecha quando clico em Finalizar"

**Possíveis causas:**
1. Você não é o host da sala
2. Erro de rede ao enviar comando
3. Backend não recebeu o evento `endRoom`

**Solução:**
```javascript
// Verificar no console do navegador se evento foi enviado:
socket.emit('endRoom', { roomId: 'room-xxx' }, (response) => {
  console.log('Resposta:', response);
});
```

### Problema: "Sala foi deletada mas eu só saí por 1 minuto"

**Causa:** Ambos os participantes saíram da sala

**Solução:**
- Use "Finalizar Sala" antes de sair propositalmente
- Ou garanta que ao menos 1 pessoa fique na sala
- Timer de 2 minutos pode ser ajustado se necessário

### Problema: "Sala ficou 'órfã' e está consumindo recursos"

**Causa:** Bug no código ou crash do servidor

**Solução:**
```bash
# Reiniciar serviço (limpa todas as salas da memória)
gcloud run services update medcall-gateway \
  --region=southamerica-east1 \
  --max-instances=10
```

---

## 📊 Fluxograma Simplificado

```
┌─────────────────┐
│ Criar Sala      │
│ (status: waiting)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Participante    │ ◄── Timer: 8 horas de expiração
│ Entra           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ status: active  │ ◄── Consulta ativa
│ (Host + Paciente)│
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │ Finalizar   │   │ 1 pessoa    │   │ Ambos saem  │
  │ Sala (host) │   │ sai         │   │             │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │ Salva BD    │   │ Timer 8h    │   │ Timer 2min  │
  │ Deleta sala │   │ para        │   │ para        │
  │ ✅ FIM      │   │ reconexão   │   │ reconexão   │
  └─────────────┘   └─────────────┘   └──────┬──────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │ Ninguém     │
                                       │ voltou?     │
                                       │ Deleta sala │
                                       └─────────────┘
```

---

## 🔧 Arquivos Relacionados

- **Backend:** `apps/gateway/src/websocket/rooms.ts`
- **Frontend:** `apps/frontend/src/app/doctor/page.tsx` (botão finalizar)
- **Config:** `FIXES_TIMEOUT_VIDEO_CALL.md` (timeouts gerais)

---

**Última atualização:** 11/11/2025  
**Versão:** 2.0 (com limpeza automática de salas vazias)


