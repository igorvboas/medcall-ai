# Explicação: Sistema de Transcrição em Tempo Real no Gateway

## 📋 Visão Geral

O sistema de transcrição em tempo real funciona através de um pipeline que captura áudio do frontend, processa no gateway e envia para a API Whisper da OpenAI, retornando as transcrições em tempo real via WebSocket.

---

## 🔄 Fluxo Completo da Transcrição

### 1. **Captura de Áudio no Frontend**

#### Para Consultas Presenciais (`PresentialCallRoom`)
- O frontend usa o hook `useAudioForker` para capturar áudio de dois microfones (médico e paciente)
- Cada chunk de áudio é enviado via WebSocket com o evento:
  - `presential:audio:doctor` - para áudio do médico
  - `presential:audio:patient` - para áudio do paciente
- Os dados são enviados como `Float32Array` convertido para array serializável

**Arquivo:** `apps/frontend/src/components/call/PresentialCallRoom.tsx`

```typescript
socket.emit(`presential:audio:${data.channel}`, {
  sessionId,
  audioData: Array.from(data.audioData), // Float32Array → Array
  timestamp: data.timestamp,
  sampleRate: data.sampleRate
});
```

#### Para Consultas Online (`OnlineCallRoom`)
- Usa LiveKit para captura de áudio
- Pode usar `useTranscriptionWebSocket` ou `RealtimeTranscription`
- Envia áudio via eventos específicos do LiveKit

---

### 2. **Recepção no Gateway** (`audioHandler.ts`)

O gateway recebe os chunks de áudio através dos handlers:

```typescript
socket.on('presential:audio:doctor', (data: PresentialAudioData) => {
  // Converte array de volta para Float32Array
  const float32AudioData = new Float32Array(data.audioData);
  
  // Valida se há dados não-zerados
  if (!hasNonZeroData) {
    console.warn('⚠️ DADOS ZERADOS RECEBIDOS');
    return;
  }
  
  // Cria chunk de áudio e envia para processamento
  const audioChunk: AudioChunk = {
    sessionId,
    channel: 'doctor',
    audioData: float32AudioData,
    timestamp,
    sampleRate
  };
  
  audioProcessor.processAudioChunk(audioChunk);
});
```

**Arquivo:** `apps/gateway/src/websocket/audioHandler.ts` (linhas 24-88)

---

### 3. **Processamento de Áudio** (`audioProcessor.ts`)

O `AudioProcessor` é responsável por:

#### a) **Voice Activity Detection (VAD)**
- Detecta se há voz no chunk usando RMS (Root Mean Square)
- Threshold configurável: `vadThreshold = 0.05`
- Só processa chunks com atividade de voz detectada

#### b) **Agrupamento em Frases Completas**
- **Modo atual:** Processa apenas frases completas (não chunks parciais)
- Mantém buffers separados por canal (doctor/patient)
- Aguarda silêncio de `1200ms` para finalizar uma frase
- Máximo de `15 segundos` por frase

#### c) **Normalização de Áudio**
- Normaliza o áudio para 85% do máximo para evitar clipping
- Melhora a qualidade da transcrição

#### d) **Conversão para WAV**
- Converte `Float32Array` para buffer WAV completo (com header)
- Formato: PCM 16-bit, mono, 44.1kHz (ou sampleRate recebido)

**Arquivo:** `apps/gateway/src/services/audioProcessor.ts`

**Fluxo no AudioProcessor:**
```
processAudioChunk()
  ↓
detectVoiceActivity() → Se tem voz:
  ↓
Adiciona ao phraseBuffer
  ↓
Aguarda silêncio de 1200ms
  ↓
flushPhraseBuffer()
  ↓
normalizeAudio()
  ↓
float32ToWavBuffer()
  ↓
emit('audio:processed', processedChunk)
```

---

### 4. **Envio para ASR Service** (`asrService.ts`)

Quando o `AudioProcessor` emite `audio:processed`, o handler em `audioHandler.ts` captura:

```typescript
const onAudioProcessed = (processedChunk: any) => {
  if (processedChunk.sessionId === sessionId) {
    // Enviar para ASR (Whisper)
    asrService.processAudio(processedChunk)
      .then((transcription) => {
        if (transcription) {
          // Proteção contra duplicação
          if (sentTranscriptionIds.has(transcription.id)) {
            return; // Já foi enviado
          }
          
          sentTranscriptionIds.add(transcription.id);
          
          // Enviar para frontend via WebSocket
          notifier.emitTranscriptionUpdate(sessionId, utterance);
          
          // Trigger geração de sugestões
          triggerSuggestionGeneration(sessionId, utterance, notifier);
        }
      });
  }
};
```

**Arquivo:** `apps/gateway/src/websocket/audioHandler.ts` (linhas 293-350)

---

### 5. **Transcrição com Whisper** (`asrService.ts`)

O `ASRService` processa o áudio:

#### a) **Validações Pré-Envio**
- Verifica tamanho máximo: 25MB
- Verifica duração máxima: 25 minutos
- Valida formato WAV (RIFF signature, headers, etc.)
- Verifica se há dados não-zerados

#### b) **Chamada à API Whisper**
```typescript
const formData = new FormData();
formData.append('model', 'whisper-1');
formData.append('file', audioBuffer, { filename: 'audio.wav' });
formData.append('language', 'pt');
formData.append('response_format', 'verbose_json');
formData.append('temperature', '0.0');
formData.append('prompt', 'Contexto médico em português brasileiro...');

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    ...formData.getHeaders()
  },
  body: formData
});
```

#### c) **Pós-Processamento**
- Remove ruídos comuns (`[música]`, `(tosse)`, etc.)
- Corrige espaçamento
- Capitaliza primeira letra
- Adiciona pontuação se necessário

#### d) **Fallback**
- Se Whisper não estiver disponível ou falhar, usa `generateRealBasedTranscription()`
- Gera transcrições simuladas baseadas em características do áudio

**Arquivo:** `apps/gateway/src/services/asrService.ts`

---

### 6. **Salvamento no Banco de Dados**

Após receber a transcrição do Whisper:

```typescript
await db.createUtterance({
  id: transcription.id,
  session_id: transcription.sessionId,
  speaker: transcription.speaker, // 'doctor' ou 'patient'
  text: transcription.text,
  confidence: transcription.confidence,
  start_ms: transcription.startTime,
  end_ms: transcription.endTime,
  is_final: transcription.is_final,
  created_at: transcription.timestamp
});
```

**Arquivo:** `apps/gateway/src/services/asrService.ts` (linhas 294-311)

---

### 7. **Envio para Frontend via WebSocket**

O `SessionNotifier` emite a transcrição:

```typescript
notifier.emitTranscriptionUpdate(sessionId, utterance);
```

Que internamente faz:
```typescript
this.io.to(`session:${sessionId}`).emit('transcription:update', {
  sessionId,
  utterance: {
    id: transcription.id,
    speaker: transcription.speaker,
    text: transcription.text,
    timestamp: transcription.timestamp,
    confidence: transcription.confidence
  },
  timestamp: new Date().toISOString()
});
```

**Arquivo:** `apps/gateway/src/websocket/index.ts` (linhas 266-272)

---

### 8. **Recepção no Frontend**

O frontend escuta o evento `transcription:update`:

```typescript
socket.on('transcription:update', (data: any) => {
  const newEntry: TranscriptionEntry = {
    id: data.id,
    speaker: data.speaker,
    text: data.text,
    timestamp: new Date(data.timestamp),
    confidence: data.confidence,
    isFinal: data.isFinal,
    language: data.language || 'pt-BR'
  };
  
  setTranscriptions(prev => {
    // Atualiza ou adiciona nova transcrição
    const existingIndex = prev.findIndex(entry => 
      entry.id === newEntry.id || 
      (!newEntry.isFinal && entry.speaker === newEntry.speaker && !entry.isFinal)
    );
    
    if (existingIndex >= 0) {
      const updated = [...prev];
      updated[existingIndex] = newEntry;
      return updated;
    } else {
      return [...prev, newEntry];
    }
  });
});
```

**Arquivo:** `apps/frontend/src/components/livekit/RealtimeTranscription.tsx` (linhas 241-267)

---

## 🛡️ Proteções e Controles

### 1. **Proteção contra Duplicação**
- `sentTranscriptionIds`: Set de IDs já enviados
- Verifica antes de enviar para evitar transcrições duplicadas

### 2. **Proteção contra Race Conditions**
- `globalProcessingLock`: Lock global por canal
- `processingInProgress`: Flag de processamento em andamento
- `lastProcessedTimestamp`: Proteção temporal (mínimo 8s entre processamentos)

### 3. **Validação de Dados**
- Verifica se dados não estão zerados
- Valida formato WAV antes de enviar para Whisper
- Verifica tamanho e duração do áudio

### 4. **Limpeza de Recursos**
- Remove listeners quando sessão termina
- Limpa buffers quando sessão é finalizada
- Limpeza periódica do Set de IDs enviados

---

## ⚙️ Configurações Importantes

### AudioProcessor
- `vadThreshold`: 0.05 (sensibilidade de detecção de voz)
- `minVoiceDurationMs`: 800ms (duração mínima de voz)
- `phraseEndSilenceMs`: 1200ms (silêncio que indica fim de frase)
- `maxPhraseLength`: 15000ms (máximo 15s por frase)

### ASRService
- `model`: 'whisper-1'
- `language`: 'pt' (português)
- `temperature`: 0.0 (máxima determinação)
- `response_format`: 'verbose_json'

---

## 🔍 Pontos de Debug

O sistema tem logs detalhados em cada etapa:

1. **AUDIO_RECEPTION**: Quando áudio é recebido do frontend
2. **AUDIO_PROCESSING**: Quando começa a processar áudio
3. **TRANSCRIPTION_SEND**: Quando envia para Whisper
4. **TRANSCRIPTION_RECEIVED**: Quando recebe transcrição do Whisper
5. **WEBSOCKET_SEND**: Quando envia para frontend via WebSocket

---

## 🚨 Problemas Comuns e Soluções

### 1. **Dados Zerados Recebidos**
- **Causa:** Frontend não está capturando áudio corretamente
- **Solução:** Verificar permissões de microfone, dispositivos selecionados

### 2. **Transcrições Duplicadas**
- **Causa:** Race condition ou múltiplos listeners
- **Solução:** Sistema já tem proteções, mas verificar se listeners estão sendo removidos corretamente

### 3. **Whisper Timeout**
- **Causa:** Áudio muito grande ou API lenta
- **Solução:** Timeout de 30s configurado, verificar tamanho do áudio

### 4. **Buffer WAV Inválido**
- **Causa:** Conversão incorreta ou dados corrompidos
- **Solução:** Validação pré-envio já implementada

---

## 📊 Fluxo Visual Simplificado

```
Frontend (Microfone)
    ↓
WebSocket: presential:audio:doctor/patient
    ↓
Gateway: audioHandler.ts
    ↓
AudioProcessor: processAudioChunk()
    ↓
VAD Detection → Agrupa em frases
    ↓
Normaliza → Converte para WAV
    ↓
Emit: audio:processed
    ↓
ASRService: processAudio()
    ↓
Whisper API (OpenAI)
    ↓
Pós-processamento
    ↓
Salva no Banco (utterances)
    ↓
SessionNotifier: emitTranscriptionUpdate()
    ↓
WebSocket: transcription:update
    ↓
Frontend: Atualiza UI
```

---

## 🔗 Arquivos Principais

1. **Gateway:**
   - `apps/gateway/src/websocket/audioHandler.ts` - Handlers de áudio
   - `apps/gateway/src/services/audioProcessor.ts` - Processamento de áudio
   - `apps/gateway/src/services/asrService.ts` - Serviço de transcrição (Whisper)
   - `apps/gateway/src/websocket/index.ts` - SessionNotifier

2. **Frontend:**
   - `apps/frontend/src/components/call/PresentialCallRoom.tsx` - Captura de áudio presencial
   - `apps/frontend/src/components/livekit/RealtimeTranscription.tsx` - Componente de transcrição
   - `apps/frontend/src/hooks/useAudioForker.ts` - Hook para captura dual

---

## 📝 Notas Importantes

1. **Modo de Processamento:** Atualmente processa apenas **frases completas**, não chunks parciais
2. **Canais Separados:** Doctor e Patient são processados separadamente
3. **Proteção Temporal:** Mínimo de 8 segundos entre processamentos do mesmo canal
4. **Fallback:** Se Whisper falhar, usa transcrição simulada baseada em características do áudio
5. **Geração de Sugestões:** Após cada transcrição, triggera geração de sugestões de IA

---

Este documento explica o fluxo completo do sistema de transcrição em tempo real. Se precisar de mais detalhes sobre alguma parte específica, posso aprofundar!


