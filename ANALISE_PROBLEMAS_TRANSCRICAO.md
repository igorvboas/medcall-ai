# Análise dos Problemas de Transcrição

## 🔍 Análise dos Problemas

### 1. **Delay na Transcrição** ⏱️

**Causas identificadas:**

1. **Aguarda frase completa**: O sistema aguarda **1200ms de silêncio** antes de processar uma frase
   - Localização: `audioProcessor.ts` → `phraseEndSilenceMs = 1200`
   - Isso significa que após a pessoa parar de falar, ainda espera 1.2 segundos

2. **Processamento do Whisper**: A API Whisper leva tempo para processar (geralmente 1-3 segundos)

3. **Pipeline completo**: 
   - Captura → VAD → Agrupamento → Conversão WAV → Whisper → Pós-processamento → WebSocket
   - Total: ~2-5 segundos de delay

**Solução proposta:**
- Reduzir `phraseEndSilenceMs` para 600-800ms (mais responsivo)
- Processar chunks menores (3-5 segundos) ao invés de aguardar frase completa
- Usar streaming do Whisper (se disponível) para transcrições parciais

---

### 2. **Perda de Transcrição ao Reconectar** 💾

**Problema identificado:**

✅ **O backend JÁ processa tudo** - A transcrição está rodando no gateway, não no frontend
✅ **As transcrições SÃO salvas no banco** - Tabela `utterances` no Supabase
❌ **O frontend NÃO recupera histórico ao reconectar**

**Análise do código:**

1. **Gateway (`session:join` handler)**: 
   - Apenas confirma entrada na sessão
   - **NÃO envia histórico de transcrições**
   - Localização: `apps/gateway/src/websocket/index.ts:36-69`

2. **Frontend (`PresentialCallRoom.tsx`)**:
   - Ao conectar, apenas escuta novas transcrições
   - **NÃO busca histórico do banco**
   - Localização: `apps/frontend/src/components/call/PresentialCallRoom.tsx:174-176`

3. **Banco de dados**:
   - Função `getSessionUtterances()` existe e funciona
   - Localização: `apps/gateway/src/config/database.ts:170-183`

**Sua solução está CORRETA!** ✅

O backend já está processando tudo, mas falta:
- Enviar histórico ao reconectar
- Buscar histórico no frontend ao conectar

---

## ✅ Soluções Propostas

### Solução 1: Recuperar Histórico ao Reconectar (RECOMENDADO)

**Implementar no Gateway:**

Quando o usuário faz `session:join`, o gateway deve:
1. Buscar todas as utterances da sessão do banco
2. Enviar via WebSocket evento `transcription:history`
3. Frontend recebe e popula o estado

**Vantagens:**
- ✅ Mantém tudo no backend (já está assim)
- ✅ Não perde transcrições ao reconectar
- ✅ Funciona mesmo se página for atualizada
- ✅ Mudança mínima no código

**Implementação:**

```typescript
// Gateway: apps/gateway/src/websocket/index.ts
socket.on('session:join', async (data: SessionJoinData) => {
  const { sessionId, userId, role } = data;
  
  // ... código existente ...
  
  // ✅ NOVO: Buscar e enviar histórico de transcrições
  try {
    const { db } = await import('../config/database');
    const utterances = await db.getSessionUtterances(sessionId);
    
    // Enviar histórico completo
    socket.emit('transcription:history', {
      sessionId,
      utterances,
      count: utterances.length
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
  }
});
```

**Frontend:**

```typescript
// Frontend: PresentialCallRoom.tsx
socketInstance.on('transcription:history', (data) => {
  console.log('📜 Histórico de transcrições recebido:', data);
  if (data.utterances && Array.isArray(data.utterances)) {
    // Converter formato do banco para formato do frontend
    const formattedUtterances = data.utterances.map(u => ({
      id: u.id,
      speaker: u.speaker,
      text: u.text,
      timestamp: new Date(u.created_at),
      confidence: u.confidence || 0,
      isFinal: u.is_final !== false
    }));
    
    setUtterances(formattedUtterances);
  }
});
```

---

### Solução 2: Reduzir Delay (Opcional)

**Ajustes no AudioProcessor:**

```typescript
// apps/gateway/src/services/audioProcessor.ts

// Reduzir silêncio necessário para finalizar frase
private phraseEndSilenceMs = 600; // Era 1200, agora 600ms

// Processar chunks menores
private maxPhraseLength = 8000; // Era 15000, agora 8s

// Reduzir duração mínima de voz
private minVoiceDurationMs = 500; // Era 800, agora 500ms
```

**Trade-off:**
- ✅ Mais responsivo (menos delay)
- ⚠️ Pode processar frases incompletas
- ⚠️ Mais chamadas à API Whisper (mais custo)

---

## 🎯 Recomendação Final

**Sua análise está CORRETA!** O backend já processa tudo, mas falta recuperar histórico.

**Implementar na seguinte ordem:**

1. **PRIMEIRO**: Recuperar histórico ao reconectar (Solução 1)
   - Resolve o problema de perder transcrições
   - Mudança simples e segura

2. **DEPOIS**: Reduzir delay (Solução 2)
   - Testar com valores menores
   - Monitorar qualidade das transcrições

---

## 📝 Checklist de Implementação

### Para resolver perda de transcrição:

- [ ] Modificar `session:join` handler no gateway para buscar histórico
- [ ] Adicionar evento `transcription:history` no SessionNotifier
- [ ] Frontend escutar `transcription:history` ao conectar
- [ ] Popular estado com histórico recebido
- [ ] Testar: atualizar página durante consulta
- [ ] Testar: reconectar após queda de conexão

### Para reduzir delay:

- [ ] Ajustar `phraseEndSilenceMs` para 600-800ms
- [ ] Ajustar `minVoiceDurationMs` para 500ms
- [ ] Testar qualidade das transcrições
- [ ] Monitorar custos da API Whisper

---

## 🔍 Verificações Adicionais

**Confirmar que:**
- ✅ Transcrições estão sendo salvas no banco (`utterances` table)
- ✅ `getSessionUtterances()` funciona corretamente
- ✅ Frontend tem acesso ao `sessionId` ao reconectar
- ✅ WebSocket mantém sessão mesmo após reconexão

---

## 💡 Observação Importante

**O sistema JÁ está rodando no backend!** A transcrição não depende do frontend estar conectado. O problema é apenas que o frontend não recupera o histórico ao reconectar.

A solução é simples: enviar histórico ao reconectar. Isso mantém a arquitetura atual (tudo no backend) e resolve o problema de perder transcrições.


