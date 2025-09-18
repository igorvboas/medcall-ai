# Script PowerShell para configurar variáveis de ambiente no Google Cloud Run
# Este script lê os valores do arquivo .env.gcp

Write-Host "🔧 Configurando variáveis de ambiente no Google Cloud Run..." -ForegroundColor Green

# Verificar se o arquivo .env.gcp existe
if (-not (Test-Path ".env.gcp")) {
    Write-Host "❌ Arquivo .env.gcp não encontrado!" -ForegroundColor Red
    Write-Host "📝 Crie o arquivo .env.gcp com os valores reais das suas chaves de API" -ForegroundColor Yellow
    Write-Host "📖 Veja o arquivo GOOGLE_CLOUD_ENV_SETUP.md para mais detalhes" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Carregando variáveis do arquivo .env.gcp..." -ForegroundColor Green

# Ler o arquivo .env.gcp e extrair as variáveis
$envContent = Get-Content ".env.gcp"
$envVars = @{}

foreach ($line in $envContent) {
    if ($line -match "^([^#][^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Configurar variáveis de ambiente no Google Cloud Run
Write-Host "🚀 Configurando variáveis no Google Cloud Run..." -ForegroundColor Blue

gcloud run services update medcall-gateway `
  --set-env-vars="LIVEKIT_URL=$($envVars['LIVEKIT_URL'])" `
  --set-env-vars="LIVEKIT_API_KEY=$($envVars['LIVEKIT_API_KEY'])" `
  --set-env-vars="LIVEKIT_API_SECRET=$($envVars['LIVEKIT_API_SECRET'])" `
  --set-env-vars="SUPABASE_URL=$($envVars['SUPABASE_URL'])" `
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=$($envVars['SUPABASE_SERVICE_ROLE_KEY'])" `
  --set-env-vars="OPENAI_API_KEY=$($envVars['OPENAI_API_KEY'])" `
  --set-env-vars="OPENAI_ORGANIZATION=$($envVars['OPENAI_ORGANIZATION'])" `
  --set-env-vars="JWT_SECRET=$($envVars['JWT_SECRET'])" `
  --set-env-vars="ENCRYPTION_KEY=$($envVars['ENCRYPTION_KEY'])" `
  --region=southamerica-east1

Write-Host "✅ Variáveis de ambiente configuradas com sucesso!" -ForegroundColor Green
Write-Host "🔍 Testando a API..." -ForegroundColor Blue

# Testar health check
Write-Host "Testando health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://medcall-gateway-416450784258.southamerica-east1.run.app/health" -Method Get
    Write-Host "✅ API funcionando: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Erro ao testar API: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "🎉 Configuração concluída! Teste a criação de sessões presenciais." -ForegroundColor Green
