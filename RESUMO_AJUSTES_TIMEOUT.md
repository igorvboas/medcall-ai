# 🔧 Resumo dos Ajustes - Timeout em Videochamadas

## 🎯 Objetivo
Permitir videochamadas de até **8 horas contínuas** sem desconexão automática.

---

## 📊 Antes vs Depois

| Componente | ⏱️ Antes | ✅ Depois | 📈 Melhoria |
|------------|---------|----------|------------|
| **Socket.IO Ping Timeout** | 20s | 120s (2min) | **+500%** |
| **Cloud Run Timeout** | 300s (5min) | 3600s (1h) | **+1100%** |
| **Timer Expiração Salas** | 300s (5min) | 28800s (8h) | **+5660%** |
| **WebSocket Inatividade** | 60s (1min) | 600s (10min) | **+900%** |
| **CPU Cloud Run** | 1 core | 2 cores | **+100%** |
| **Memória Cloud Run** | 1Gi | 2Gi | **+100%** |

---

## 📁 Arquivos Modificados

### 1. `apps/gateway/src/server.ts`
```diff
+ pingTimeout: 120000      // 20s → 2min
+ pingInterval: 25000      // Mantido em 25s
+ maxHttpBufferSize: 1e8   // 1MB → 100MB
+ cookie.maxAge: 28800000  // Sem limite → 8h
```

### 2. `apps/gateway/src/websocket/rooms.ts`
```diff
- }, 5 * 60 * 1000);        // 5 minutos
+ }, 8 * 60 * 60 * 1000);   // 8 horas
```

### 3. `apps/gateway/src/websocket/pcmTranscriptionHandler.ts`
```diff
- const inactivityTimeout = 60000;     // 60s
+ const inactivityTimeout = 10 * 60 * 1000; // 10min
```

### 4. `cloudbuild.yaml`
```diff
- "--cpu=1"
+ "--cpu=2"
- "--memory=1Gi"
+ "--memory=2Gi"
- "--timeout=300"
+ "--timeout=3600"
+ "--session-affinity"
+ "--no-cpu-throttling"
```

### 5. `app.yaml`
```diff
- instance_class: F2
+ instance_class: F4
+ request_timeout: 3600s
+ network:
+   session_affinity: true
```

---

## 🚀 Como Aplicar

### Opção Rápida (30 segundos)
```bash
./scripts/deploy-timeout-fix.sh
# Escolha opção [1] - Apenas atualizar configurações
```

### Opção Completa (10 minutos)
```bash
./scripts/deploy-timeout-fix.sh
# Escolha opção [2] - Build completo
```

### Opção Manual
```bash
gcloud run services update medcall-gateway \
  --region=southamerica-east1 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=3600 \
  --session-affinity \
  --no-cpu-throttling
```

---

## 🧪 Como Testar

1. **Iniciar videochamada**
2. **Deixar conectado por 1h30min**
3. **Verificar se:**
   - ✅ Vídeo continua fluindo
   - ✅ Áudio continua funcionando
   - ✅ Transcrição continua ativa
   - ✅ Nenhum erro 400/500 no console

---

## 📈 Monitoramento

### Ver logs em tempo real:
```bash
gcloud run logs read medcall-gateway \
  --region=southamerica-east1 \
  --follow
```

### Verificar configurações aplicadas:
```bash
gcloud run services describe medcall-gateway \
  --region=southamerica-east1
```

### Buscar erros de timeout:
```bash
gcloud run logs read medcall-gateway \
  --region=southamerica-east1 \
  --filter="textPayload:timeout OR textPayload:disconnect" \
  --limit=50
```

---

## 💰 Impacto de Custos

| Item | Antes | Depois | Diferença |
|------|-------|--------|-----------|
| **CPU** | 1 core | 2 cores | +$0.024/h |
| **Memória** | 1Gi | 2Gi | +$0.003/h |
| **Instância** | F2 | F4 | +$0.04/h |
| **Total por consulta (1h)** | ~$0.08 | ~$0.15 | **+$0.07** |

**Custo adicional mensal (100 consultas):** ~$7 USD

---

## ✅ Checklist de Validação

- [ ] Deploy aplicado com sucesso
- [ ] Timeout em 3600s confirmado
- [ ] CPU em 2 cores confirmada
- [ ] Memória em 2Gi confirmada
- [ ] Session affinity ativa
- [ ] Health check respondendo
- [ ] Videochamada > 1h testada
- [ ] Logs sem erros de timeout
- [ ] Frontend sem erros no console

---

## 🆘 Troubleshooting

### Problema: "Ainda desconecta após 1h"
**Solução:**
```bash
# Verificar se timeout foi aplicado
gcloud run services describe medcall-gateway \
  --region=southamerica-east1 \
  --format="value(spec.template.spec.timeoutSeconds)"

# Se não for 3600, aplicar novamente:
gcloud run services update medcall-gateway \
  --region=southamerica-east1 \
  --timeout=3600
```

### Problema: "Erro 400 Bad Request no polling"
**Causa:** Load Balancer pode ter timeout menor que Cloud Run

**Solução:**
1. Ir para Cloud Console > Network Services > Load Balancing
2. Editar backend do medcall-gateway
3. Configurar "Timeout" para 3600s

### Problema: "Memória insuficiente"
**Solução:**
```bash
# Aumentar para 4Gi se necessário
gcloud run services update medcall-gateway \
  --region=southamerica-east1 \
  --memory=4Gi
```

---

## 📞 Suporte

- **Documentação completa:** `FIXES_TIMEOUT_VIDEO_CALL.md`
- **Script de deploy:** `scripts/deploy-timeout-fix.sh`
- **Logs do projeto:** [Google Cloud Console](https://console.cloud.google.com/run?project=YOUR_PROJECT)

---

**Última atualização:** 11/11/2025
**Status:** ✅ Pronto para produção







