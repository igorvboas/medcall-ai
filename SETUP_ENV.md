# 🔐 Guia de Configuração de Variáveis de Ambiente

## ⚠️ IMPORTANTE

O erro **"Sala não encontrada ou expirada"** geralmente indica que as variáveis de ambiente não estão configuradas corretamente. Siga este guia para resolver.

---

## 📁 Arquivos de Configuração

Você precisa criar **2 arquivos `.env`**:

1. **Frontend**: `apps/frontend/.env.local`
2. **Gateway**: `apps/gateway/.env`

---

## 🎯 Passo a Passo

### 1️⃣ Configurar Frontend

```bash
# Copiar exemplo
cd apps/frontend
cp .env.example .env.local

# Editar o arquivo
nano .env.local
```

**Variáveis mínimas necessárias:**

```bash
# Supabase (você já tem configurado)
NEXT_PUBLIC_SUPABASE_URL=https://yzjlhezmvdkwdhibyvwh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gateway - URLs locais
NEXT_PUBLIC_GATEWAY_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_GATEWAY_URL=ws://localhost:3001

# LiveKit (OBRIGATÓRIO para consultas online)
NEXT_PUBLIC_LIVEKIT_URL=wss://tria-app-0hg0ktck.livekit.cloud
NEXT_PUBLIC_LIVEKIT_API_KEY=APIH... (pegue no dashboard LiveKit)
NEXT_PUBLIC_LIVEKIT_API_SECRET=sua_secret_key_aqui
```

---

### 2️⃣ Configurar Gateway

```bash
# Copiar exemplo
cd apps/gateway
cp .env.example .env

# Editar o arquivo
nano .env
```

**Variáveis mínimas necessárias:**

```bash
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# LiveKit (mesmas credenciais do frontend)
LIVEKIT_URL=wss://tria-app-0hg0ktck.livekit.cloud
LIVEKIT_API_KEY=APIH...
LIVEKIT_API_SECRET=sua_secret_key_aqui

# Supabase
SUPABASE_URL=https://yzjlhezmvdkwdhibyvwh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (SERVICE ROLE KEY)

# OpenAI
OPENAI_API_KEY=sk-proj-... (sua API key OpenAI)
OPENAI_ORGANIZATION=org-... (sua organização OpenAI - opcional)

# Security (GERE NOVAS CHAVES!)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

---

## 🔑 Como Obter as Credenciais

### LiveKit (para consultas online)

1. Acesse: https://cloud.livekit.io
2. Faça login e vá para seu projeto
3. Copie as credenciais:
   - **URL**: `wss://tria-app-0hg0ktck.livekit.cloud`
   - **API Key**: começa com `APIH...`
   - **API Secret**: string aleatória longa

### Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings > API**
4. Copie:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role**: `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NUNCA exponha no frontend!)

### OpenAI

1. Acesse: https://platform.openai.com/api-keys
2. Crie uma nova API Key
3. Copie a chave (começa com `sk-proj-...`)

### JWT_SECRET e ENCRYPTION_KEY

Gere chaves aleatórias seguras:

```bash
# No terminal Mac/Linux:
openssl rand -hex 32

# No terminal Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Execute **2 vezes** para gerar 2 chaves diferentes.

---

## ✅ Verificar Configuração

Após configurar, teste:

```bash
# 1. Testar Gateway
cd apps/gateway
npm run dev

# Em outro terminal:
curl http://localhost:3001/health

# Deve retornar: {"status":"ok", ...}
```

```bash
# 2. Testar Frontend
cd apps/frontend
npm run dev

# Abra: http://localhost:3000
```

---

## 🚨 Erros Comuns

### ❌ "Cannot find module" / "MODULE_NOT_FOUND"

**Solução:**
```bash
cd apps/gateway
npm install

cd ../frontend
npm install
```

### ❌ "Sala não encontrada ou expirada"

**Causas:**
1. Gateway não está rodando
2. Variáveis de ambiente faltando
3. LiveKit não configurado

**Solução:**
1. Verifique se `http://localhost:3001/health` responde
2. Verifique `.env` do gateway tem `LIVEKIT_*` configurado
3. Reinicie o gateway: `npm run dev`

### ❌ "ERR_CONNECTION_REFUSED" (Socket.IO)

**Causa:** Gateway não está rodando na porta 3001

**Solução:**
```bash
cd apps/gateway
npm run dev
```

### ❌ "Twilio credentials not configured"

**Isso é normal!** O sistema usa servidores TURN públicos automaticamente.

Se quiser usar Twilio (melhor performance):
1. Crie conta: https://www.twilio.com
2. Adicione as credenciais no `.env` do gateway

---

## 🔄 Reiniciar Servidores

Após alterar `.env`, sempre reinicie:

```bash
# Parar todos os servidores (Ctrl+C)

# Reiniciar gateway
cd apps/gateway && npm run dev

# Em outro terminal, reiniciar frontend
cd apps/frontend && npm run dev
```

---

## 📞 Suporte

Se os problemas persistirem após configurar corretamente:

1. Verifique logs do gateway no terminal
2. Abra DevTools do navegador (F12) e veja o Console
3. Procure por erros em vermelho

**Logs importantes:**
- ✅ `Socket.IO conectado` - Conexão OK
- ✅ `Conexão estabelecida com o servidor` - WebRTC OK
- ❌ `Twilio credentials not configured` - Normal, usa servidores públicos
- ❌ `ERR_CONNECTION_REFUSED` - Gateway não está rodando



