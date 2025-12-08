# 🚀 Como Rodar o Gateway Localmente (para Testes)

## Passo 1: Configurar Variáveis de Ambiente

Crie um arquivo `.env` em `apps/gateway/.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Supabase
SUPABASE_URL=https://yzjlhezmvdkwdhibyvwh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# LiveKit (opcional para transcrição)
LIVEKIT_URL=wss://tria-app-0hg0ktck.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# Porta
PORT=3001

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Passo 2: Instalar Dependências

```bash
cd apps/gateway
npm install
```

## Passo 3: Compilar TypeScript

```bash
npm run build
```

## Passo 4: Rodar o Gateway

```bash
npm start
```

Ou em modo desenvolvimento:
```bash
npm run dev
```

## Passo 5: Atualizar Frontend para Usar Gateway Local

No arquivo `apps/frontend/.env.local`:

```bash
NEXT_PUBLIC_GATEWAY_HTTP_URL=http://localhost:3001
```

## Passo 6: Testar

1. Gateway rodando em: http://localhost:3001
2. Teste o health check: http://localhost:3001/api/health
3. Acesse o frontend em: http://localhost:3000

Agora o Gateway estará rodando na sua máquina e você poderá testar sem depender do Google Cloud Run!

---

## 🔧 Troubleshooting

### Erro: "Port 3001 is already in use"
```bash
# Matar processo na porta 3001
npx kill-port 3001
```

### Erro: "Cannot find module"
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Environment variable missing"
Verifique se o arquivo `.env` está no lugar certo:
```bash
apps/gateway/.env  # <-- deve estar aqui
```

