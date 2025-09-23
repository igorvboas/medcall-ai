# Configuração de Variáveis de Ambiente no Google Cloud

## ⚠️ IMPORTANTE: Segurança

**NUNCA commite secrets no Git!** Use sempre o Google Cloud Console para configurar variáveis sensíveis.

## 🔧 Como Configurar Variáveis de Ambiente

### **Método 1: Google Cloud Console (Recomendado)**

1. **Acesse o Google Cloud Console:**
   - Vá para: https://console.cloud.google.com/
   - Selecione o projeto: `medcall-ai`

2. **Navegue para Cloud Run:**
   - Menu lateral → "Cloud Run"
   - Clique no serviço: `medcall-gateway`

3. **Configure as Variáveis:**
   - Clique em "EDIT & DEPLOY NEW REVISION"
   - Vá para a aba "Variables & Secrets"
   - Adicione as seguintes variáveis:

```bash
# LiveKit Configuration
LIVEKIT_URL = wss://tria-app-0hg0ktck.livekit.cloud
LIVEKIT_API_KEY = [SUA_LIVEKIT_API_KEY]
LIVEKIT_API_SECRET = [SUA_LIVEKIT_API_SECRET]

# Supabase Configuration
SUPABASE_URL = https://yzjlhezmvdkwdhibyvwh.supabase.co
SUPABASE_SERVICE_ROLE_KEY = [SUA_SUPABASE_SERVICE_ROLE_KEY]

# OpenAI Configuration
OPENAI_API_KEY = [SUA_OPENAI_API_KEY]
OPENAI_ORGANIZATION = [SUA_OPENAI_ORGANIZATION]

# Security
JWT_SECRET = [SEU_JWT_SECRET_32_CHARS]
ENCRYPTION_KEY = [SUA_ENCRYPTION_KEY_32_CHARS]
```

4. **Deploy:**
   - Clique em "DEPLOY"

### **Método 2: Google Cloud CLI**

```bash
# Configurar variáveis de ambiente
gcloud run services update medcall-gateway \
  --set-env-vars="LIVEKIT_URL=wss://tria-app-0hg0ktck.livekit.cloud" \
  --set-env-vars="LIVEKIT_API_KEY=[SUA_LIVEKIT_API_KEY]" \
  --set-env-vars="LIVEKIT_API_SECRET=[SUA_LIVEKIT_API_SECRET]" \
  --set-env-vars="SUPABASE_URL=https://yzjlhezmvdkwdhibyvwh.supabase.co" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=[SUA_SUPABASE_SERVICE_ROLE_KEY]" \
  --set-env-vars="OPENAI_API_KEY=[SUA_OPENAI_API_KEY]" \
  --set-env-vars="OPENAI_ORGANIZATION=[SUA_OPENAI_ORGANIZATION]" \
  --set-env-vars="JWT_SECRET=[SEU_JWT_SECRET_32_CHARS]" \
  --set-env-vars="ENCRYPTION_KEY=[SUA_ENCRYPTION_KEY_32_CHARS]" \
  --region=southamerica-east1
```

## 🔍 Verificação

Após configurar as variáveis, teste a API:

```bash
# Testar health check
curl https://medcall-gateway-416450784258.southamerica-east1.run.app/health

# Testar criação de sessão
curl -X POST https://medcall-gateway-416450784258.southamerica-east1.run.app/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "session_type": "presencial",
    "participants": {
      "doctor": {"id": "doc1", "name": "Dr. Teste"},
      "patient": {"id": "pat1", "name": "Paciente Teste"}
    },
    "consent": true
  }'
```

## 📝 Próximos Passos

1. ✅ Configure as variáveis no Google Cloud Console
2. ✅ Faça deploy do código atualizado: `gcloud app deploy`
3. ✅ Teste a criação de sessões presenciais
4. ✅ Verifique os logs para confirmar que não há mais erros 500

## 🚨 Segurança

- **NUNCA** commite este arquivo com secrets reais
- **SEMPRE** use variáveis de ambiente para secrets
- **ROTACIONE** as chaves periodicamente
- **MONITORE** o uso das APIs para detectar vazamentos

## 🔐 TLS/SSL (LiveKit Cloud) – Checklist rápido

1) URL correta (sempre WSS):

```
LIVEKIT_URL=wss://tria-app-0hg0ktck.livekit.cloud
```

2) Certificados raiz no container do Gateway (Cloud Run):

- Dockerfile (Debian/Bookworm base já usada):

```
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
```

3) Proxy corporativo/CA interna (se aplicável):

- Suba a CA como Secret e monte no container, aponte:

```
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca_interna.pem
```

4) Hora/NTP correta do ambiente.

5) Testes dentro do container:

```
curl -sv https://tria-app-0hg0ktck.livekit.cloud/settings/regions | cat
node -e "require('https').get('https://tria-app-0hg0ktck.livekit.cloud/settings/regions',r=>console.log(r.statusCode)).on('error',e=>console.error(e))"
```

Se aparecer "invalid peer certificate: UnknownIssuer", faltam CAs ou há proxy MITM sem CA instalada.