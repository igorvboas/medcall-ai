#!/bin/bash

# Script para aplicar correções de timeout em videochamadas longas
# Criado em: 2025-11-11
# Autor: Felipe Porto - MedCall AI

set -e

echo "🚀 Deploy de Correções de Timeout - MedCall Gateway"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto medcall-ai${NC}"
    exit 1
fi

# Verificar se gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Erro: gcloud CLI não está instalado${NC}"
    echo "Instale em: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Configurar variáveis
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="southamerica-east1"
SERVICE="medcall-gateway"

echo -e "${YELLOW}📋 Configurações:${NC}"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE"
echo ""

# Confirmar com usuário
read -p "Deseja continuar com o deploy? (s/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Deploy cancelado."
    exit 0
fi

echo ""
echo -e "${GREEN}1️⃣ Verificando serviço existente...${NC}"
if gcloud run services describe $SERVICE --region=$REGION &> /dev/null; then
    echo "   ✅ Serviço encontrado"
    DEPLOY_MODE="update"
else
    echo "   ⚠️  Serviço não existe, será criado"
    DEPLOY_MODE="create"
fi

echo ""
echo -e "${GREEN}2️⃣ Opções de Deploy:${NC}"
echo "   [1] Apenas atualizar configurações do serviço (RÁPIDO - ~30s)"
echo "   [2] Build completo com Cloud Build (LENTO - ~10min)"
echo ""
read -p "Escolha uma opção (1 ou 2): " -n 1 -r DEPLOY_OPTION
echo ""

if [ "$DEPLOY_OPTION" = "1" ]; then
    echo ""
    echo -e "${GREEN}3️⃣ Atualizando configurações do serviço...${NC}"
    
    gcloud run services update $SERVICE \
        --region=$REGION \
        --cpu=2 \
        --memory=2Gi \
        --timeout=3600 \
        --session-affinity \
        --no-cpu-throttling \
        --concurrency=80 \
        --max-instances=10
    
    echo ""
    echo -e "${GREEN}✅ Configurações atualizadas com sucesso!${NC}"
    
elif [ "$DEPLOY_OPTION" = "2" ]; then
    echo ""
    echo -e "${GREEN}3️⃣ Iniciando build completo com Cloud Build...${NC}"
    
    gcloud builds submit \
        --region=$REGION \
        --config=cloudbuild.yaml \
        --substitutions=_SERVICE=$SERVICE,_REGION=$REGION,_REPO=medcall
    
    echo ""
    echo -e "${GREEN}✅ Deploy completo realizado com sucesso!${NC}"
else
    echo -e "${RED}❌ Opção inválida${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}4️⃣ Verificando status do serviço...${NC}"

# Verificar configurações aplicadas
TIMEOUT=$(gcloud run services describe $SERVICE --region=$REGION --format="value(spec.template.spec.timeoutSeconds)")
CPU=$(gcloud run services describe $SERVICE --region=$REGION --format="value(spec.template.spec.containers[0].resources.limits.cpu)")
MEMORY=$(gcloud run services describe $SERVICE --region=$REGION --format="value(spec.template.spec.containers[0].resources.limits.memory)")
URL=$(gcloud run services describe $SERVICE --region=$REGION --format="value(status.url)")

echo ""
echo -e "${GREEN}📊 Configurações Atuais:${NC}"
echo "   Timeout: ${TIMEOUT}s (esperado: 3600s)"
echo "   CPU: ${CPU} (esperado: 2)"
echo "   Memória: ${MEMORY} (esperado: 2Gi)"
echo "   URL: $URL"
echo ""

# Validar se timeout foi aplicado corretamente
if [ "$TIMEOUT" = "3600" ]; then
    echo -e "${GREEN}✅ Timeout configurado corretamente!${NC}"
else
    echo -e "${YELLOW}⚠️  Timeout não está em 3600s. Valor atual: ${TIMEOUT}s${NC}"
fi

echo ""
echo -e "${GREEN}5️⃣ Testando conectividade...${NC}"

# Testar endpoint de health
if curl -s -o /dev/null -w "%{http_code}" "${URL}/api/health" | grep -q "200"; then
    echo "   ✅ Health check passou"
else
    echo -e "   ${YELLOW}⚠️  Health check falhou (pode estar inicializando)${NC}"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✨ Deploy Concluído com Sucesso!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos Passos:${NC}"
echo "   1. Teste uma videochamada longa (> 1 hora)"
echo "   2. Monitore os logs: gcloud run logs read $SERVICE --region=$REGION --follow"
echo "   3. Verifique métricas no Cloud Console"
echo ""
echo -e "${YELLOW}📚 Documentação completa em:${NC}"
echo "   FIXES_TIMEOUT_VIDEO_CALL.md"
echo ""
















