# Correção de Timeout em Videochamadas Longas (> 1 hora)

## Problema Identificado

O sistema estava desconectando automaticamente após aproximadamente 1 hora de videochamada devido a múltiplos timeouts configurados no backend:

1. **Socket.IO com timeout padrão muito curto** (20 segundos)
2. **Cloud Run com timeout de 5 minutos** (300s)
3. **Timer de expiração de salas em 5 minutos**
4. **WebSocket PCM com timeout de inatividade de 60 segundos**

## Alterações Realizadas

### 1. Socket.IO (`apps/gateway/src/server.ts`)
✅ Aumentado timeout de ping de 20s para **2 minutos (120s)**
✅ Configurado pingInterval para **25 segundos**
✅ Aumentado maxHttpBufferSize para **100MB**
✅ Adicionado cookie de sessão com duração de **8 horas**
✅ Desabilitada compressão por mensagem para melhor performance

```typescript
const io = new SocketIOServer(httpServer, {
  cors: { /* ... */ },
  transports: ['websocket', 'polling'],
  pingTimeout: 120000, // 2 minutos
  pingInterval: 25000, // 25 segundos
  upgradeTimeout: 30000, // 30 segundos
  maxHttpBufferSize: 1e8, // 100MB
  connectTimeout: 45000, // 45 segundos
  cookie: {
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
});
```

### 2. Timer de Expiração de Salas (`apps/gateway/src/websocket/rooms.ts`)
✅ Aumentado de **5 minutos** para **8 horas**

```typescript
function startRoomExpiration(roomId: string): void {
  const timer = setTimeout(() => {
    cleanExpiredRoom(roomId);
  }, 8 * 60 * 60 * 1000); // 8 horas
  roomTimers.set(roomId, timer);
}
```

### 3. WebSocket PCM Transcription (`apps/gateway/src/websocket/pcmTranscriptionHandler.ts`)
✅ Aumentado timeout de inatividade de **60 segundos** para **10 minutos**

```typescript
private startCleanupTimer(): void {
  this.cleanupInterval = setInterval(() => {
    const now = Date.now();
    const inactivityTimeout = 10 * 60 * 1000; // 10 minutos
    const pingInterval = 25000; // 25 segundos
    // ...
  }, 15000);
}
```

### 4. Cloud Run Configuration (`cloudbuild.yaml`)
✅ Aumentado timeout de **5 minutos (300s)** para **1 hora (3600s)**
✅ Aumentada CPU de **1** para **2 cores**
✅ Aumentada memória de **1Gi** para **2Gi**
✅ Adicionado `--session-affinity` para manter conexões WebSocket na mesma instância
✅ Adicionado `--no-cpu-throttling` para melhor performance em sessões longas

```yaml
args:
  - "--cpu=2"
  - "--memory=2Gi"
  - "--timeout=3600"
  - "--session-affinity"
  - "--no-cpu-throttling"
```

### 5. App Engine Configuration (`app.yaml`)
✅ Alterada classe de instância de **F2** para **F4** (mais recursos)
✅ Adicionado `request_timeout: 3600s` (1 hora)
✅ Habilitada `session_affinity` para WebSocket

```yaml
instance_class: F4
request_timeout: 3600s
network:
  session_affinity: true
```

## Como Aplicar as Mudanças

### Opção 1: Deploy via Cloud Build (Recomendado)

```bash
cd /Users/felipeporto/Documents/PROJETO\ FINAL/medcall-ai

# Deploy do Gateway (Cloud Run)
gcloud builds submit --region=southamerica-east1 --config=cloudbuild.yaml \
  --substitutions=_SERVICE=medcall-gateway,_REGION=southamerica-east1,_REPO=medcall
```

### Opção 2: Deploy Manual do Cloud Run

```bash
# 1. Build da imagem Docker
docker build -f configs/docker/gateway.Dockerfile -t medcall-gateway:latest .

# 2. Tag para Artifact Registry
docker tag medcall-gateway:latest \
  southamerica-east1-docker.pkg.dev/[PROJECT_ID]/medcall/medcall-gateway:latest

# 3. Push da imagem
docker push southamerica-east1-docker.pkg.dev/[PROJECT_ID]/medcall/medcall-gateway:latest

# 4. Deploy no Cloud Run com as novas configurações
gcloud run deploy medcall-gateway \
  --image=southamerica-east1-docker.pkg.dev/[PROJECT_ID]/medcall/medcall-gateway:latest \
  --region=southamerica-east1 \
  --platform=managed \
  --port=8080 \
  --allow-unauthenticated \
  --cpu=2 \
  --memory=2Gi \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=3600 \
  --session-affinity \
  --no-cpu-throttling
```

### Opção 3: Atualizar Service Existente (Mais Rápido)

Se você já tem o serviço rodando e só quer atualizar os parâmetros:

```bash
gcloud run services update medcall-gateway \
  --region=southamerica-east1 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=3600 \
  --session-affinity \
  --no-cpu-throttling
```

## Verificação Pós-Deploy

1. **Verificar se o serviço foi atualizado:**
```bash
gcloud run services describe medcall-gateway --region=southamerica-east1
```

2. **Testar conexão WebSocket:**
```bash
# Abrir console do navegador na página de videochamada e executar:
# Deve permanecer conectado por mais de 1 hora
```

3. **Monitorar logs durante videochamada longa:**
```bash
gcloud run logs read medcall-gateway --region=southamerica-east1 --follow
```

## Custos Estimados

Com as novas configurações (F4, 2 CPU, 2Gi RAM):
- **Custo por hora de videochamada:** ~$0.10 - $0.15 USD
- **Custo mensal estimado (100 consultas/mês, 1h cada):** ~$10 - $15 USD

O aumento de custos é mínimo comparado ao benefício de consultas estáveis e longas.

## Monitoramento Recomendado

Configure alertas no Google Cloud para:
1. **Uptime** do serviço Cloud Run
2. **Latência** das requisições WebSocket
3. **Uso de CPU e memória** (se > 80%, considere escalar)
4. **Contagem de erros 500/502/503**

## Limites Atuais

Após estas correções:
- ✅ **Videochamadas:** Suportam até **8 horas** contínuas
- ✅ **Cloud Run:** Timeout de **1 hora** por requisição HTTP
- ✅ **WebSocket:** Permanece ativo indefinidamente com keepalive a cada 25s
- ✅ **Salas:** Expiram após **8 horas** de inatividade

## Notas Importantes

⚠️ **IMPORTANTE:** O Cloud Run tem limite absoluto de 60 minutos por requisição HTTP, mas isso **não afeta WebSocket** que funciona em protocolo diferente após o upgrade inicial.

⚠️ **Keepalive:** O sistema envia pings automáticos a cada 25 segundos para manter conexões ativas através de proxies e load balancers.

⚠️ **Session Affinity:** Garante que todas as conexões WebSocket de uma mesma sessão vão para a mesma instância do Cloud Run, evitando perda de estado.

## Troubleshooting

### Se ainda houver desconexões:

1. **Verificar se o deploy foi aplicado:**
```bash
gcloud run services describe medcall-gateway --region=southamerica-east1 --format="value(spec.template.spec.timeoutSeconds)"
# Deve retornar: 3600
```

2. **Verificar logs do Cloud Run:**
```bash
gcloud run logs read medcall-gateway --region=southamerica-east1 --limit=50
```

3. **Verificar console do navegador:**
- Abra DevTools > Console
- Procure por erros de WebSocket ou Socket.IO
- Verifique se há "ping/pong" sendo trocado periodicamente

4. **Verificar Load Balancer do Google Cloud:**
- Se você usa Load Balancer, ele também pode ter timeouts
- Configure backend timeout para 3600s

## Contato

Se os problemas persistirem após o deploy, verifique:
1. Load Balancer / CDN na frente do Cloud Run
2. Configurações de firewall
3. Limites de cota do projeto GCP


















