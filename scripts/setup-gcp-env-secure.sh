#!/bin/bash

# Script para configurar variáveis de ambiente no Google Cloud Run
# Este script lê os valores do arquivo .env.gcp (que não é commitado)

echo "🔧 Configurando variáveis de ambiente no Google Cloud Run..."

# Verificar se o arquivo .env.gcp existe
if [ ! -f ".env.gcp" ]; then
    echo "❌ Arquivo .env.gcp não encontrado!"
    echo "📝 Crie o arquivo .env.gcp com os valores reais das suas chaves de API"
    echo "📖 Veja o arquivo GOOGLE_CLOUD_ENV_SETUP.md para mais detalhes"
    exit 1
fi

# Carregar variáveis do arquivo .env.gcp
source .env.gcp

echo "✅ Carregando variáveis do arquivo .env.gcp..."

# Configurar variáveis de ambiente no Google Cloud Run
gcloud run services update medcall-gateway \
  --set-env-vars="LIVEKIT_URL=$LIVEKIT_URL" \
  --set-env-vars="LIVEKIT_API_KEY=$LIVEKIT_API_KEY" \
  --set-env-vars="LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET" \
  --set-env-vars="SUPABASE_URL=$SUPABASE_URL" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" \
  --set-env-vars="OPENAI_API_KEY=$OPENAI_API_KEY" \
  --set-env-vars="OPENAI_ORGANIZATION=$OPENAI_ORGANIZATION" \
  --set-env-vars="JWT_SECRET=$JWT_SECRET" \
  --set-env-vars="ENCRYPTION_KEY=$ENCRYPTION_KEY" \
  --region=southamerica-east1

echo "✅ Variáveis de ambiente configuradas com sucesso!"
echo "🔍 Testando a API..."

# Testar health check
echo "Testando health check..."
curl -s https://medcall-gateway-416450784258.southamerica-east1.run.app/health | jq .

echo "🎉 Configuração concluída! Teste a criação de sessões presenciais."
