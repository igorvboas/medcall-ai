#!/bin/bash

# Script para configurar variáveis de ambiente no Google Cloud Run
# Execute este script após fazer deploy do código
# 
# IMPORTANTE: Substitua os valores [SEU_VALOR] pelos valores reais antes de executar!

echo "🔧 Configurando variáveis de ambiente no Google Cloud Run..."
echo "⚠️  IMPORTANTE: Configure os valores reais no script antes de executar!"

# Configurar variáveis de ambiente
# Substitua [SEU_VALOR] pelos valores reais das suas chaves
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

echo "✅ Variáveis de ambiente configuradas com sucesso!"
echo "🔍 Testando a API..."

# Testar health check
echo "Testando health check..."
curl -s https://medcall-gateway-416450784258.southamerica-east1.run.app/health | jq .

echo "🎉 Configuração concluída! Teste a criação de sessões presenciais."
