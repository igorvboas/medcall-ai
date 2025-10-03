# 🤖 Sistema de Sugestões de IA - Consultas Online

## 📋 Visão Geral

Sistema que analisa transcrições de consultas online em tempo real e gera sugestões inteligentes usando ChatGPT. As sugestões aparecem **apenas na interface do médico (offerer/host)**.

---

## 🔄 Fluxo de Funcionamento

```
1. Paciente/Médico fala
   ↓
2. Transcrição é gerada via OpenAI Realtime API
   ↓
3. Transcrição salva em room.transcriptions
   ↓
4. A cada 5 transcrições → Análise de IA disparada
   ↓
5. suggestionService analisa contexto via ChatGPT
   ↓
6. Sugestões geradas e salvas no banco
   ↓
7. WebSocket emite 'ai:suggestions' APENAS para o médico
   ↓
8. Frontend do médico recebe e exibe no painel flutuante
   ↓
9. Médico pode copiar, usar ou descartar sugestões
```

---

## 🛠️ Arquivos Modificados/Criados

### Backend (Gateway)

#### 1. `apps/gateway/src/websocket/rooms.ts`
**Modificações:**
- Import do `suggestionService`
- Listener `sendTranscriptionToPeer` agora é `async`
- A cada 5 transcrições, dispara análise de IA:
  ```typescript
  if (room.transcriptions.length % 5 === 0) {
    // Preparar contexto
    // Chamar suggestionService.generateSuggestions()
    // Emitir 'ai:suggestions' para room.hostSocketId
  }
  ```

#### 2. `apps/gateway/src/services/suggestionService.ts`
**Status:** Já existia, não foi modificado (já está funcional)
- Analisa contexto da conversa
- Gera sugestões via ChatGPT
- Salva no banco de dados
- Emite eventos via WebSocket

---

### Frontend

#### 3. `apps/frontend/src/components/webrtc/SuggestionsPanel.tsx` ✨ NOVO
**Componente React:**
- Exibe lista de sugestões em painel flutuante
- Botões: Copiar, Descartar
- Estilos modernos com animações
- Cores baseadas em prioridade (critical, high, medium, low)
- Ícones diferentes por tipo de sugestão

**Props:**
```typescript
interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onUseSuggestion?: (suggestionId: string) => void;
  onDismissSuggestion?: (suggestionId: string) => void;
}
```

#### 4. `apps/frontend/src/components/webrtc/ConsultationRoom.tsx`
**Modificações:**
- Import do `SuggestionsPanel`
- Estado `aiSuggestions` para armazenar sugestões
- Listener no `setupSocketListeners()`:
  ```typescript
  socketRef.current.on('ai:suggestions', (data) => {
    setAiSuggestions(data.suggestions);
  });
  ```
- Renderização condicional:
  ```tsx
  {userType === 'doctor' && aiSuggestions.length > 0 && (
    <SuggestionsPanel ... />
  )}
  ```

#### 5. `apps/frontend/src/components/webrtc/webrtc-styles.css`
**Novos estilos:**
- `.suggestions-panel` - Painel flutuante
- `.suggestion-card` - Cards de sugestões
- `.suggestion-btn` - Botões de ação
- Animações `slideIn`
- Responsive design (mobile, tablet, desktop)

---

## 🎯 Tipos de Sugestões

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `question` | Pergunta para fazer ao paciente | "Há quanto tempo você sente essa dor?" |
| `insight` | Insight clínico | "Sintomas sugerem possível gastrite" |
| `warning` | Alerta de atenção | "⚠️ Dor torácica requer ECG urgente" |
| `protocol` | Baseado em protocolo médico | "Protocolo de dor torácica: avaliar sinais vitais" |
| `assessment` | Avaliação clínica | "Considere avaliar histórico familiar" |
| `followup` | Acompanhamento | "Agendar retorno em 7 dias" |

---

## 🎨 Prioridades e Cores

| Prioridade | Cor | Uso |
|------------|-----|-----|
| `critical` | 🔴 Vermelho | Emergências, sintomas graves |
| `high` | 🟠 Laranja | Alta urgência |
| `medium` | 🔵 Azul | Média importância |
| `low` | ⚪ Cinza | Baixa prioridade |

---

## ⚙️ Configurações

### Backend (suggestionService)
```typescript
MIN_SUGGESTION_INTERVAL = 10000; // 10 segundos entre sugestões
MAX_SUGGESTIONS_PER_SESSION = 20; // Máximo 20 sugestões por sessão
CONTEXT_WINDOW_SIZE = 10; // Últimas 10 transcrições analisadas
CONFIDENCE_THRESHOLD = 0.7; // Mínimo 70% de confiança
```

### Frontend (rooms.ts)
```typescript
if (room.transcriptions.length % 5 === 0) {
  // Dispara análise a cada 5 transcrições
}
```

**Para ajustar a frequência:**
- `% 5` = a cada 5 transcrições
- `% 3` = a cada 3 transcrições (mais frequente)
- `% 10` = a cada 10 transcrições (menos frequente)

---

## 🗄️ Banco de Dados

### Tabela: `suggestions`
```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES call_sessions(id),
  utterance_id UUID REFERENCES utterances(id),
  type VARCHAR(50),
  content TEXT,
  source VARCHAR(255),
  confidence DECIMAL(4,3),
  priority VARCHAR(10),
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

## 🚀 Como Testar

### 1. Iniciar Backend
```bash
cd apps/gateway
npm run dev
```

### 2. Iniciar Frontend
```bash
cd apps/frontend
npm run dev
```

### 3. Criar Consulta Online
1. Acesse como médico: `/consulta/nova`
2. Crie uma sala online
3. Entre na sala como médico
4. Paciente entra na sala

### 4. Gerar Sugestões
1. Fale pelo menos 5 frases completas (alterne entre médico/paciente)
2. Aguarde 2-3 segundos após a 5ª transcrição
3. Painel de sugestões aparecerá no canto superior direito

### 5. Interagir com Sugestões
- **Copiar:** Copia o texto da sugestão
- **Descartar:** Remove a sugestão do painel

---

## 🐛 Troubleshooting

### Sugestões não aparecem?

**Verificar logs do backend:**
```bash
# Procurar por:
🤖 [ROOM room-xxx] Disparando análise de IA (X transcrições)
✅ [ROOM room-xxx] N sugestões geradas
📤 [ROOM room-xxx] Sugestões enviadas para o médico
```

**Verificar logs do frontend:**
```bash
# Console do navegador (médico):
🤖 [MÉDICO] Sugestões de IA recebidas: N
```

### Painel não renderiza?

1. **Verificar userType:**
   ```javascript
   console.log('userType:', userType); // Deve ser 'doctor'
   ```

2. **Verificar sugestões:**
   ```javascript
   console.log('aiSuggestions:', aiSuggestions); // Deve ter itens
   ```

3. **Verificar CSS:**
   - Painel está em `position: absolute`
   - Pode estar sobreposto por outro elemento

---

## 📊 Performance

- **Latência de análise:** ~2-5 segundos (depende da OpenAI API)
- **Tamanho do contexto:** Últimas 10 transcrições (~500-1000 palavras)
- **Tokens por análise:** ~500-800 tokens (GPT-4)
- **Custo estimado:** $0.01-0.02 por análise

---

## 🔮 Melhorias Futuras

1. **Feedback de Sugestão Usada:**
   - Marcar sugestão como "usada" no banco
   - Analytics de taxa de uso

2. **Sugestões Contextuais:**
   - Integrar com histórico do paciente
   - RAG com protocolos médicos do banco

3. **Configurações Personalizadas:**
   - Médico pode ajustar frequência de sugestões
   - Filtrar tipos de sugestões

4. **Notificações:**
   - Badge de novas sugestões
   - Som de alerta para sugestões críticas

5. **Histórico de Sugestões:**
   - Ver todas as sugestões da sessão
   - Exportar relatório com sugestões

---

## 📝 Notas Técnicas

### Por que a cada 5 transcrições?
- **Menos de 5:** Pouco contexto, sugestões genéricas
- **Mais de 10:** Muito tempo sem feedback, menos útil
- **5 transcrições:** Balanço ideal entre contexto e frequência

### Por que apenas para o médico?
- **Privacidade:** Evita exposição de análise ao paciente
- **UX:** Médico precisa de suporte, paciente não
- **Segurança:** Evita ansiedade no paciente

### Por que ChatGPT e não Whisper?
- **Whisper:** Apenas transcrição (já usado)
- **ChatGPT:** Análise contextual e geração de sugestões
- **Combinação:** Whisper transcreve → ChatGPT analisa

---

## 📞 Suporte

- **Issues:** Reportar problemas no GitHub
- **Documentação:** Ver `SUGESTOES_IA_README.md` (consulta presencial)
- **Logs:** Sempre verificar logs do backend E frontend

---

**Desenvolvido com ❤️ para MedCall AI**
**Versão:** 1.0.0
**Data:** 2025-10-02

