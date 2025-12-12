# 🚀 Deploy do Frontend na Vercel

## 📋 Pré-requisitos

1. ✅ Conta na Vercel configurada
2. ✅ Repositório GitHub conectado
3. ✅ Backend (Gateway) deployado no Cloud Run
4. ✅ Variáveis de ambiente configuradas

## 🔧 Configuração na Vercel

### 1. Conectar Repositório
- Acesse [vercel.com](https://vercel.com)
- Clique em "New Project"
- Selecione seu repositório `medcall-ai`

### 2. Configurar Build Settings
A Vercel deve detectar automaticamente que é um projeto Next.js, mas configure:

- **Framework Preset**: Next.js
- **Root Directory**: `apps/frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 3. Configurar Variáveis de Ambiente

Na seção "Environment Variables" da Vercel, adicione:

#### 🔑 OBRIGATÓRIAS:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_SUPABASE_SERVICE_ROLE_KEY=

# LiveKit
NEXT_PUBLIC_LIVEKIT_URL=
NEXT_PUBLIC_LIVEKIT_API_KEY=
NEXT_PUBLIC_LIVEKIT_API_SECRET=

# Gateway (URL do seu Cloud Run)
NEXT_PUBLIC_GATEWAY_URL=
NEXT_PUBLIC_GATEWAY_HTTP_URL=

# OpenAI
OPENAI_API_KEY=
OPENAI_ORGANIZATION=

# Security
JWT_SECRET=
ENCRYPTION_KEY=
```

#### 🔧 OPCIONAIS:
```bash
# Application
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# AI Settings
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=500

# Audio Processing
VAD_SILENCE_THRESHOLD_MS=1200
MAX_AUDIO_DURATION_MS=300000
AUDIO_SAMPLE_RATE=16000
```

### 4. Deploy
- Clique em "Deploy"
- Aguarde o build completar
- Teste a aplicação

## 🔗 URLs Importantes

Após o deploy, você terá:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://medcall-gateway-416450784258.southamerica-east1.run.app`

## 🧪 Testando o Deploy

1. **Health Check**: `https://your-app.vercel.app/api/test`
2. **Landing Page**: `https://your-app.vercel.app`
3. **Login**: `https://your-app.vercel.app/auth/signin`

## 🚨 Troubleshooting

### Erro de Build
- Verifique se todas as variáveis de ambiente estão configuradas
- Confirme se o `NEXT_PUBLIC_GATEWAY_URL` aponta para o Cloud Run correto

### Erro de Conexão com Gateway
- Verifique se o Cloud Run está rodando
- Confirme se as URLs estão corretas (HTTP vs WebSocket)

### Erro de Supabase
- Verifique se as chaves do Supabase estão corretas
- Confirme se o projeto Supabase está ativo

## 📝 Próximos Passos

1. ✅ Configurar domínio customizado (opcional)
2. ✅ Configurar SSL/HTTPS (automático na Vercel)
3. ✅ Configurar monitoramento
4. ✅ Configurar CI/CD para deploys automáticos
