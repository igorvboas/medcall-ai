#!/bin/bash

# Script para testar LiveKit
# Execute: ./scripts/test-livekit.sh

echo "🧪 Teste Completo de LiveKit"
echo "============================="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "apps/gateway/package.json" ]; then
    echo "❌ Execute este script a partir da raiz do projeto"
    exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Verificando configurações...${NC}"

# Verificar se o gateway está rodando
echo -e "${YELLOW}Verificando se o gateway está rodando...${NC}"
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway está rodando${NC}"
else
    echo -e "${RED}❌ Gateway não está rodando. Inicie com: cd apps/gateway && npm run dev${NC}"
    exit 1
fi

# Verificar se o frontend está rodando
echo -e "${YELLOW}Verificando se o frontend está rodando...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend está rodando${NC}"
else
    echo -e "${RED}❌ Frontend não está rodando. Inicie com: cd apps/frontend && npm run dev${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}2. Testando geração de token no gateway...${NC}"

# Testar geração de token
TOKEN_RESPONSE=$(curl -s http://localhost:3001/api/test/livekit/token)
if echo "$TOKEN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Token gerado com sucesso${NC}"
    echo "$TOKEN_RESPONSE" | jq '.data' 2>/dev/null || echo "$TOKEN_RESPONSE"
else
    echo -e "${RED}❌ Falha na geração de token${NC}"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}3. Testando saúde do LiveKit no gateway...${NC}"

# Testar saúde do LiveKit
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/test/livekit/health)
if echo "$HEALTH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ LiveKit está saudável${NC}"
    echo "$HEALTH_RESPONSE" | jq '.data' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}❌ LiveKit não está saudável${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}4. Testando sessão completa no gateway...${NC}"

# Testar sessão completa
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3001/api/test/livekit/session)
if echo "$SESSION_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Sessão criada com sucesso${NC}"
    echo "$SESSION_RESPONSE" | jq '.data' 2>/dev/null || echo "$SESSION_RESPONSE"
else
    echo -e "${RED}❌ Falha na criação de sessão${NC}"
    echo "$SESSION_RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}5. Executando teste Node.js no gateway...${NC}"

# Executar teste Node.js
cd apps/gateway
if npx tsx src/test-livekit.ts; then
    echo -e "${GREEN}✅ Teste Node.js passou${NC}"
else
    echo -e "${RED}❌ Teste Node.js falhou${NC}"
    exit 1
fi

cd ../..

echo ""
echo -e "${BLUE}6. Testando no browser...${NC}"

echo -e "${YELLOW}Abrindo página de teste no browser...${NC}"
echo -e "${YELLOW}Acesse: http://localhost:3000/test-livekit${NC}"

# Tentar abrir no browser (funciona no macOS e Linux)
if command -v open >/dev/null 2>&1; then
    open http://localhost:3000/test-livekit
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000/test-livekit
fi

echo ""
echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Acesse http://localhost:3000/test-livekit"
echo "2. Execute os testes no browser"
echo "3. Se algum teste falhar, verifique os logs no console"
echo "4. Para debug avançado, use o console do browser:"
echo "   - testCurrentSession()"
echo "   - testLiveKit(url, token)"
echo "   - new LiveKitDebugger()"
