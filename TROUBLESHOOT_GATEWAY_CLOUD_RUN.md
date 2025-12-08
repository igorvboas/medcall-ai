# 🔧 Troubleshooting: Gateway no Google Cloud Run

## Problema: WebSocket Failing / Gateway Inacessível

### ✅ Checklist de Verificação

#### 1. Service Status
- [ ] Acesse: https://console.cloud.google.com/run
- [ ] Verifique se o serviço `medcall-gateway` está **verde** (running)
- [ ] Se estiver vermelho/amarelo, clique em "LOGS" para ver erros

#### 2. Environment Variables
Variáveis **obrigatórias** que devem estar configuradas:

- [ ] `OPENAI_API_KEY` - Para transcrição
- [ ] `SUPABASE_URL` - Para banco de dados
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Para autenticação
- [ ] `PORT` - Deve ser **8080** (padrão Cloud Run)
- [ ] `NODE_ENV` - Deve ser **production**

**Como verificar:**
1. No Cloud Run, clique no serviço
2. Vá em "VARIABLES & SECRETS"
3. Confirme que todas estão configuradas

#### 3. Container Configuration

**Recursos Mínimos Recomendados:**
- [ ] **Memória:** 512 MB (mínimo) / 1 GB (recomendado)
- [ ] **CPU:** 1 vCPU
- [ ] **Timeout:** 300 segundos
- [ ] **Max instances:** 10
- [ ] **Min instances:** 0 (cold start) ou 1 (always warm)

**Como verificar:**
1. No Cloud Run, clique em "EDIT & DEPLOY NEW REVISION"
2. Vá em "Container, Networking, Security"
3. Verifique as configurações

#### 4. Networking & CORS

**Permitir Tráfego:**
- [ ] "Allow unauthenticated invocations" deve estar **ENABLED**
- [ ] Firewall deve permitir tráfego na porta 8080

**CORS Headers:**
O código já tem CORS configurado, mas confirme que o `FRONTEND_URL` está correto:
```
FRONTEND_URL=https://medcall-ai-frontend-v2.vercel.app
```

#### 5. Build & Deploy

**Dockerfile Correto?**
Verifique se existe `configs/docker/gateway.Dockerfile` com:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

**Cloud Build funcionando?**
- [ ] Verifique em https://console.cloud.google.com/cloud-build/builds
- [ ] Último build deve ter status **SUCCESS** (verde)

---

## 🚨 Problemas Comuns

### Problema 1: "Out of Memory"
**Sintoma:** Service crashes ou reinicia constantemente
**Solução:** Aumentar memória para 1 GB

### Problema 2: "Cold Start Timeout"
**Sintoma:** Primeira conexão sempre falha
**Solução:** 
- Aumentar timeout para 300s
- OU definir min instances = 1 (mantém sempre warm)

### Problema 3: "WebSocket Upgrade Failed"
**Sintoma:** Socket.IO conecta via polling mas não faz upgrade
**Solução:** Confirmar que Cloud Run permite WebSocket:
- Deve estar na versão **2nd generation** (não 1st gen)

### Problema 4: "Missing Environment Variable"
**Sintoma:** Logs mostram "undefined" ou "missing required"
**Solução:** Configurar TODAS as variáveis listadas acima

---

## 🔍 Ver Logs em Tempo Real

```bash
# Via gcloud CLI
gcloud run services logs tail medcall-gateway \
  --region=southamerica-east1 \
  --project=YOUR_PROJECT_ID

# Ou via Console
# https://console.cloud.google.com/run → Click service → "LOGS"
```

Procure por:
- ❌ "Error:"
- ❌ "EADDRINUSE"
- ❌ "Cannot connect"
- ❌ "Missing required"
- ❌ "undefined"

---

## 🚀 Forçar Novo Deploy

Se nada funcionar, force um novo deploy:

```bash
# 1. Via Console (mais fácil)
1. Cloud Run → Seu serviço
2. "EDIT & DEPLOY NEW REVISION"
3. Não mude nada
4. "DEPLOY"

# 2. Via gcloud CLI
cd apps/gateway
gcloud run deploy medcall-gateway \
  --source . \
  --region=southamerica-east1 \
  --platform=managed \
  --allow-unauthenticated
```

---

## ✅ Teste de Conectividade

Após deploy, teste:

```bash
# 1. Health Check
curl https://medcall-gateway-416450784258.southamerica-east1.run.app/api/health

# Deve retornar:
# {"status":"healthy", ...}

# 2. Socket.IO
# Abra o navegador em:
# https://medcall-gateway-416450784258.southamerica-east1.run.app/socket.io/
# Deve mostrar: "{"code":0,"message":"Transport unknown"}"
# (isso é normal - significa que o socket.io está respondendo)
```

---

## 📞 Se Nada Funcionar

**Opção 1:** Rodar Gateway localmente (veja: RUN_LOCAL_GATEWAY.md)

**Opção 2:** Criar novo serviço Cloud Run do zero:
1. Delete o serviço atual
2. Crie novo com configurações corretas
3. Redeploy

**Opção 3:** Considerar alternativa:
- Railway.app
- Render.com
- Heroku
(Todos suportam WebSocket nativamente)

