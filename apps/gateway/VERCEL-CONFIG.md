# Configuração para Vercel

## Variáveis de Ambiente Necessárias

### No Gateway (Google Cloud Run / Vercel Functions)

As seguintes variáveis de ambiente devem estar configuradas:

```bash
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# OpenAI (OBRIGATÓRIO para transcrições)
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION=org-... (opcional)

# Outras
NODE_ENV=production
PORT=3001
```

### No Frontend (Vercel)

As seguintes variáveis de ambiente devem estar configuradas:

```bash
# Gateway URL (OBRIGATÓRIO)
NEXT_PUBLIC_GATEWAY_HTTP_URL=https://seu-gateway.run.app
# ou
NEXT_PUBLIC_GATEWAY_URL=https://seu-gateway.run.app

# Outras variáveis do frontend
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Verificação de Problemas

### 1. WebSocket não conecta

**Sintoma:** `WebSocket connection to 'wss://...' failed`

**Causas possíveis:**
- `NEXT_PUBLIC_GATEWAY_HTTP_URL` não está configurada na Vercel
- Gateway não está rodando ou não aceita WebSocket
- URL do gateway está incorreta

**Solução:**
1. Verificar se `NEXT_PUBLIC_GATEWAY_HTTP_URL` está configurada na Vercel
2. Verificar se o gateway está rodando e acessível
3. Verificar se o gateway suporta WebSocket (deve usar Socket.IO)

### 2. "Não conectado à OpenAI"

**Sintoma:** `[TRANSCRIPTION ERROR] Erro: Não conectado à OpenAI`

**Causas possíveis:**
- `OPENAI_API_KEY` não está configurada no gateway
- Gateway não está conseguindo conectar à OpenAI
- WebSocket do gateway não está funcionando

**Solução:**
1. Verificar se `OPENAI_API_KEY` está configurada no gateway
2. Verificar logs do gateway para erros de conexão OpenAI
3. Verificar se o gateway está processando eventos `transcription:connect`

### 3. Transcrições não salvam no banco

**Sintoma:** Transcrições aparecem na tela mas não salvam no banco

**Causas possíveis:**
- `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` não configuradas no gateway
- RLS (Row Level Security) bloqueando inserts
- `callSessionId` não está sendo criado

**Solução:**
1. Verificar variáveis Supabase no gateway
2. Verificar logs do gateway para erros de insert
3. Verificar se `callSessionId` está sendo criado corretamente

## Como Verificar Logs

### Gateway (Google Cloud Run)
```bash
gcloud run services logs read medcall-gateway --limit 200 | grep -E "\[AUTO-SAVE\]|\[ARRAY-SAVE\]|\[CALL_SESSION\]|OPENAI|WebSocket"
```

### Frontend (Vercel)
- Vá em: Deployments → Seu deployment → Functions → Ver logs
- Procure por: `WebSocket`, `transcription`, `OPENAI`

## Checklist de Deploy

- [ ] Gateway tem `OPENAI_API_KEY` configurada
- [ ] Gateway tem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas
- [ ] Frontend tem `NEXT_PUBLIC_GATEWAY_HTTP_URL` configurada
- [ ] Gateway está acessível e respondendo
- [ ] WebSocket está funcionando (testar conexão)
- [ ] Logs não mostram erros de conexão

