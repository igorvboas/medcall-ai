# Script PowerShell para testar LiveKit
# Execute: .\scripts\test-livekit.ps1

Write-Host "🧪 Teste Completo de LiveKit" -ForegroundColor Blue
Write-Host "=============================" -ForegroundColor Blue
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "apps/gateway/package.json")) {
    Write-Host "❌ Execute este script a partir da raiz do projeto" -ForegroundColor Red
    exit 1
}

Write-Host "1. Verificando configurações..." -ForegroundColor Blue

# Verificar se o gateway está rodando
Write-Host "Verificando se o gateway está rodando..." -ForegroundColor Yellow
try {
    $gatewayResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Gateway está rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Gateway não está rodando. Inicie com: cd apps/gateway && npm run dev" -ForegroundColor Red
    exit 1
}

# Verificar se o frontend está rodando
Write-Host "Verificando se o frontend está rodando..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Frontend está rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend não está rodando. Inicie com: cd apps/frontend && npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testando geração de token no gateway..." -ForegroundColor Blue

# Testar geração de token
try {
    $tokenResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/test/livekit/token" -UseBasicParsing
    $tokenData = $tokenResponse.Content | ConvertFrom-Json
    
    if ($tokenData.success) {
        Write-Host "✅ Token gerado com sucesso" -ForegroundColor Green
        Write-Host "Token length: $($tokenData.data.tokenLength)" -ForegroundColor Gray
        Write-Host "Identity: $($tokenData.data.identity)" -ForegroundColor Gray
        Write-Host "Room: $($tokenData.data.room)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Falha na geração de token" -ForegroundColor Red
        Write-Host $tokenResponse.Content
        exit 1
    }
} catch {
    Write-Host "❌ Erro ao testar geração de token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3. Testando saúde do LiveKit no gateway..." -ForegroundColor Blue

# Testar saúde do LiveKit
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/test/livekit/health" -UseBasicParsing
    $healthData = $healthResponse.Content | ConvertFrom-Json
    
    if ($healthData.success) {
        Write-Host "✅ LiveKit está saudável" -ForegroundColor Green
        Write-Host "Status: $($healthData.data.status)" -ForegroundColor Gray
        Write-Host "Config: $($healthData.data.checks.config)" -ForegroundColor Gray
        Write-Host "Token: $($healthData.data.checks.tokenGeneration)" -ForegroundColor Gray
        Write-Host "Connection: $($healthData.data.checks.connection)" -ForegroundColor Gray
    } else {
        Write-Host "❌ LiveKit não está saudável" -ForegroundColor Red
        Write-Host $healthResponse.Content
        exit 1
    }
} catch {
    Write-Host "❌ Erro ao testar saúde do LiveKit: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "4. Testando sessão completa no gateway..." -ForegroundColor Blue

# Testar sessão completa
try {
    $sessionResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/test/livekit/session" -Method POST -UseBasicParsing
    $sessionData = $sessionResponse.Content | ConvertFrom-Json
    
    if ($sessionData.success) {
        Write-Host "✅ Sessão criada com sucesso" -ForegroundColor Green
        Write-Host "Room: $($sessionData.data.session.room)" -ForegroundColor Gray
        Write-Host "Identity: $($sessionData.data.session.identity)" -ForegroundColor Gray
        Write-Host "Connection: $($sessionData.data.session.connectionEstablished)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Falha na criação de sessão" -ForegroundColor Red
        Write-Host $sessionResponse.Content
        exit 1
    }
} catch {
    Write-Host "❌ Erro ao testar sessão: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "5. Executando teste Node.js no gateway..." -ForegroundColor Blue

# Executar teste Node.js
Push-Location apps/gateway
try {
    $testResult = & npx tsx src/test-livekit.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Teste Node.js passou" -ForegroundColor Green
    } else {
        Write-Host "❌ Teste Node.js falhou" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro ao executar teste Node.js: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "6. Testando no browser..." -ForegroundColor Blue

Write-Host "Abrindo página de teste no browser..." -ForegroundColor Yellow
Write-Host "Acesse: http://localhost:3000/test-livekit" -ForegroundColor Yellow

# Abrir no browser
try {
    Start-Process "http://localhost:3000/test-livekit"
} catch {
    Write-Host "Não foi possível abrir o browser automaticamente" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Todos os testes passaram!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Acesse http://localhost:3000/test-livekit"
Write-Host "2. Execute os testes no browser"
Write-Host "3. Se algum teste falhar, verifique os logs no console"
Write-Host "4. Para debug avançado, use o console do browser:"
Write-Host "   - testCurrentSession()"
Write-Host "   - testLiveKit(url, token)"
Write-Host "   - new LiveKitDebugger()"
