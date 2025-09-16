# 🤖 Sistema de Sugestões de IA - MedCall AI

## 📋 Visão Geral

O Sistema de Sugestões de IA é um componente inteligente que analisa a transcrição em tempo real das consultas médicas e gera sugestões contextualizadas para auxiliar os médicos durante o atendimento. O sistema utiliza protocolos médicos, análise de contexto e inteligência artificial para propor perguntas relevantes e insights clínicos.

## 🎯 Funcionalidades Principais

### ✅ **Análise de Contexto em Tempo Real**
- Monitora a transcrição da conversa médico-paciente
- Identifica a fase atual da consulta (anamnese, exame físico, diagnóstico, tratamento)
- Detecta sintomas mencionados pelo paciente
- Avalia nível de urgência dos sintomas
- Rastreia perguntas já feitas pelo médico

### ✅ **Geração Inteligente de Sugestões**
- **Perguntas Contextualizadas**: Baseadas nos sintomas mencionados
- **Protocolos Médicos**: Seguindo guidelines e procedimentos estabelecidos
- **Alertas Clínicos**: Para situações de risco ou urgência
- **Sugestões de Seguimento**: Para aprofundar avaliações
- **Insights Clínicos**: Observações relevantes sobre o caso

### ✅ **Sistema RAG (Retrieval Augmented Generation)**
- Busca semântica em base de conhecimento médico
- Integração com protocolos especializados
- Embeddings para similaridade contextual
- Filtros por especialidade médica

### ✅ **Interface Interativa**
- Exibição em tempo real das sugestões
- Categorização por tipo e prioridade
- Botões para marcar sugestões como usadas
- Histórico de sugestões da sessão
- Indicadores de confiança e relevância

## 🏗️ Arquitetura Técnica

```
Frontend (React)
    ↓ WebSocket
Gateway (Node.js)
    ↓
SuggestionService
    ↓
ContextAnalyzer + RAGEngine
    ↓
Knowledge Base (Supabase + Embeddings)
```

### **Componentes Principais**

1. **`SuggestionService`** - Serviço principal de geração de sugestões
2. **`PromptTemplate`** - Sistema de prompts médicos estruturados
3. **`ContextAnalyzer`** - Análise de contexto da conversa
4. **`RAGEngine`** - Busca em base de conhecimento
5. **`WebSocket Handlers`** - Comunicação em tempo real
6. **`Frontend Components`** - Interface de usuário

## 📁 Estrutura de Arquivos

```
apps/gateway/src/
├── prompts/
│   └── medical-prompts.ts          # Prompts médicos estruturados
├── services/
│   ├── suggestionService.ts        # Serviço principal de sugestões
│   └── asrService.ts              # Integração com transcrição
├── websocket/
│   └── index.ts                   # Handlers WebSocket
└── config/
    └── database.ts                # Helpers de banco de dados

apps/frontend/src/
├── components/call/
│   └── PresentialCallRoom.tsx    # Interface de sugestões
└── app/(dashboard)/dashboard/
    └── dashboard.css              # Estilos das sugestões

database/
├── migrations/
│   └── 001_medcall_ai_schema.sql.sql  # Schema do banco
└── seeds/
    └── medical_protocols.sql      # Protocolos médicos
```

## 🔧 Configuração e Instalação

### **1. Variáveis de Ambiente**

```bash
# Gateway (.env)
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORGANIZATION=your_org_id  # Opcional
LLM_MODEL=gpt-4-1106-preview
LLM_TEMPERATURE=0.3
LLM_MAX_TOKENS=2000
RAG_SIMILARITY_THRESHOLD=0.6
RAG_MAX_RESULTS=5
```

### **2. Banco de Dados**

```bash
# Executar migrações
psql -d medcall_ai -f database/migrations/001_medcall_ai_schema.sql.sql

# Popular com protocolos médicos
psql -d medcall_ai -f database/seeds/medical_protocols.sql
```

### **3. Dependências**

```bash
# Gateway
cd apps/gateway
npm install

# Frontend
cd apps/frontend
npm install
```

## 🚀 Como Usar

### **1. Iniciar os Serviços**

```bash
# Terminal 1 - Gateway
cd apps/gateway
npm run dev

# Terminal 2 - Frontend
cd apps/frontend
npm run dev
```

### **2. Testar o Sistema**

```bash
# Executar testes automatizados
cd apps/gateway
node test-suggestion-system.js
```

### **3. Usar na Interface**

1. Acesse a página de consulta presencial
2. Inicie a gravação de áudio
3. As sugestões aparecerão automaticamente no painel direito
4. Clique em "Usar Sugestão" para marcar como utilizada
5. Use os botões "Carregar" e "Gerar" para controle manual

## 📊 Tipos de Sugestões

### **Por Categoria**

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `question` | Perguntas para o médico fazer | "Qual a intensidade da dor em uma escala de 0 a 10?" |
| `protocol` | Seguir protocolo médico | "Aplicar protocolo de dor torácica" |
| `alert` | Situações de risco | "⚠️ Avaliar estabilidade vital imediatamente" |
| `followup` | Aprofundar avaliação | "Investigar fatores desencadeantes da dor" |
| `assessment` | Avaliação específica | "Avaliar sinais vitais básicos" |
| `insight` | Observação clínica | "Histórico familiar de cardiopatia é relevante" |
| `warning` | Aviso preventivo | "Considerar encaminhamento para emergência" |

### **Por Prioridade**

- 🔴 **Crítica**: Situações de emergência
- 🟠 **Alta**: Sintomas importantes
- 🟡 **Média**: Perguntas de rotina
- 🟢 **Baixa**: Informações complementares

## 🧠 Prompts Médicos

O sistema utiliza prompts estruturados para diferentes situações:

### **Análise de Contexto**
```typescript
const CONTEXT_ANALYSIS_PROMPT = `
Você é um assistente médico especializado em análise de consultas clínicas.
Analise o contexto atual e forneça uma análise estruturada...
`;
```

### **Geração de Sugestões**
```typescript
const SUGGESTION_GENERATION_PROMPT = `
Você é um médico experiente auxiliando um colega durante uma consulta.
Gere perguntas específicas baseadas no contexto e protocolos...
`;
```

### **Protocolos de Emergência**
```typescript
const EMERGENCY_PROMPT = `
⚠️ PROTOCOLO DE URGÊNCIA MÉDICA ⚠️
Sintomas críticos detectados requerem avaliação imediata...
`;
```

## 🔄 Fluxo de Funcionamento

1. **Transcrição Recebida** → ContextAnalyzer atualiza contexto
2. **Contexto Analisado** → SuggestionService gera sugestões
3. **Protocolos Buscados** → RAGEngine encontra guidelines relevantes
4. **Sugestões Filtradas** → Priorizadas por relevância e urgência
5. **Enviadas via WebSocket** → Frontend exibe para o médico
6. **Médico Usa Sugestão** → Sistema aprende e melhora

## 📈 Métricas e Analytics

### **Estatísticas Disponíveis**

```typescript
const stats = suggestionService.getServiceStats();
console.log(stats);
// {
//   isEnabled: true,
//   activeSessions: 5,
//   totalSuggestions: 127,
//   config: { ... }
// }
```

### **Eventos WebSocket**

- `ai:suggestions` - Múltiplas sugestões
- `ai:suggestion` - Sugestão individual
- `ai:context_update` - Atualização de contexto
- `ai:suggestion:used` - Sugestão marcada como usada
- `suggestions:request` - Solicitar sugestões existentes
- `suggestions:generate` - Gerar novas sugestões

## 🛠️ Desenvolvimento e Customização

### **Adicionar Novos Protocolos**

1. Editar `database/seeds/medical_protocols.sql`
2. Adicionar documento na tabela `kb_documents`
3. Inserir chunks de conteúdo em `kb_chunks`
4. Executar script SQL

### **Criar Prompts Personalizados**

1. Editar `apps/gateway/src/prompts/medical-prompts.ts`
2. Adicionar novo template de prompt
3. Implementar lógica no `SuggestionService`
4. Testar com diferentes cenários

### **Modificar Interface**

1. Editar `apps/frontend/src/components/call/PresentialCallRoom.tsx`
2. Ajustar estilos em `dashboard.css`
3. Adicionar novos tipos de sugestão
4. Implementar novas funcionalidades

## 🧪 Testes

### **Testes Automatizados**

```bash
# Executar suite completa
node test-suggestion-system.js

# Testar cenários específicos
node -e "
const { testDifferentScenarios } = require('./test-suggestion-system.js');
testDifferentScenarios();
"
```

### **Cenários de Teste**

- ✅ Consulta de clínica geral
- ✅ Consulta psiquiátrica
- ✅ Situação de emergência
- ✅ Check-up de rotina
- ✅ Casos complexos com múltiplos sintomas

## 🔒 Segurança e Compliance

### **Proteção de Dados**

- ✅ Dados médicos criptografados
- ✅ Logs de auditoria completos
- ✅ Conformidade com LGPD
- ✅ Acesso restrito por sessão

### **Validação de Sugestões**

- ✅ Confiança mínima de 70%
- ✅ Validação de estrutura JSON
- ✅ Filtros de conteúdo inadequado
- ✅ Rate limiting para evitar spam

## 🚨 Troubleshooting

### **Problemas Comuns**

1. **Sugestões não aparecem**
   - Verificar conexão WebSocket
   - Confirmar OPENAI_API_KEY
   - Checar logs do gateway

2. **Sugestões de baixa qualidade**
   - Ajustar temperatura do LLM
   - Melhorar prompts médicos
   - Adicionar mais protocolos

3. **Performance lenta**
   - Otimizar queries do banco
   - Reduzir frequência de geração
   - Implementar cache

### **Logs Úteis**

```bash
# Gateway logs
tail -f apps/gateway/logs/suggestion-service.log

# WebSocket logs
tail -f apps/gateway/logs/websocket.log

# Database logs
tail -f /var/log/postgresql/postgresql.log
```

## 📚 Recursos Adicionais

- 📖 [Documentação da API](./docs/api.md)
- 🏗️ [Arquitetura do Sistema](./docs/architecture.md)
- 🚀 [Guia de Deploy](./docs/deployment.md)
- 🩺 [Guidelines Médicos](./docs/medical-guidelines.md)

## 🤝 Contribuição

Para contribuir com o sistema de sugestões:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente testes para sua funcionalidade
4. Submeta um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](../../LICENSE) para detalhes.

---

**Desenvolvido com ❤️ para melhorar a qualidade do atendimento médico através da inteligência artificial.**
