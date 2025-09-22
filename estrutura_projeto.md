# 📁 Estrutura do Projeto MedCall AI

## 🏗️ Visão Geral da Arquitetura

MedCall AI é um sistema de **transcrição e análise em tempo real para consultas médicas** construído como um **monorepo** com arquitetura distribuída, incluindo:

- **Frontend**: Aplicação Next.js com LiveKit para videochamadas
- **Gateway**: Serviço Node.js para processamento de áudio e IA
- **Banco de Dados**: Supabase (PostgreSQL) com extensões para IA
- **Infraestrutura**: Docker, Kubernetes e deployment em nuvem

## 📂 Estrutura de Diretórios

```
medcall-ai/
├── 📱 apps/                              # Aplicações principais
│   ├── 🎨 frontend/                      # Next.js React App
│   │   ├── 📁 src/
│   │   │   ├── 🎯 app/                   # App Router (Next.js 14)
│   │   │   │   ├── api/                  # API Routes
│   │   │   │   ├── consulta/             # Páginas de consulta
│   │   │   │   │   ├── nova/             # Nova consulta
│   │   │   │   │   ├── presencial/       # Consulta presencial
│   │   │   │   │   └── online/           # Consulta online
│   │   │   │   ├── dashboard/            # Dashboard médico
│   │   │   │   ├── login/                # Autenticação
│   │   │   │   └── globals.css           # Estilos globais
│   │   │   ├── 🧩 components/            # Componentes React
│   │   │   │   ├── livekit/              # Componentes LiveKit
│   │   │   │   │   ├── MedicalConsultationRoom.tsx
│   │   │   │   │   ├── TranscriptionDisplay.tsx
│   │   │   │   │   └── PresentialCallRoom.tsx
│   │   │   │   ├── ui/                   # Componentes UI reutilizáveis
│   │   │   │   └── call/                 # Componentes específicos de chamada
│   │   │   ├── 🪝 hooks/                 # Custom React Hooks
│   │   │   │   ├── useTranscriptionWebSocket.ts
│   │   │   │   └── useAudioForker.ts     # Captura dual de microfones
│   │   │   ├── 📚 lib/                   # Utilitários e configurações
│   │   │   │   ├── supabase.ts           # Cliente Supabase
│   │   │   │   └── livekit.ts            # Configuração LiveKit
│   │   │   ├── 🏪 store/                 # Estado global (Zustand)
│   │   │   ├── 📝 types/                 # Definições TypeScript
│   │   │   └── 🔧 utils/                 # Funções utilitárias
│   │   ├── 📁 public/                    # Arquivos estáticos
│   │   │   ├── audio-processor.js        # Processador de áudio
│   │   │   └── logo.svg
│   │   ├── 📄 package.json               # Dependências frontend
│   │   ├── 📄 next.config.js             # Configuração Next.js
│   │   ├── 📄 tailwind.config.js         # Configuração Tailwind CSS
│   │   └── 📄 tsconfig.json              # Configuração TypeScript
│   │
│   └── 🔧 gateway/                       # Serviço Node.js Backend
│       ├── 📁 src/
│       │   ├── 🎮 controllers/           # Controladores da API
│       │   │   ├── healthController.ts
│       │   │   ├── sessionController.ts
│       │   │   └── transcriptionController.ts
│       │   ├── 🛡️ middleware/            # Middlewares Express
│       │   │   ├── auth.ts               # Autenticação JWT
│       │   │   ├── cors.ts               # Configuração CORS
│       │   │   ├── errorHandler.ts       # Tratamento de erros
│       │   │   └── rateLimit.ts          # Rate limiting
│       │   ├── 🗃️ models/                # Modelos de dados
│       │   │   ├── Session.ts
│       │   │   ├── Suggestion.ts
│       │   │   ├── User.ts
│       │   │   └── Utterance.ts
│       │   ├── 🛣️ routes/                # Rotas da API
│       │   │   ├── health.ts
│       │   │   ├── sessions.ts
│       │   │   ├── transcription.ts
│       │   │   └── index.ts
│       │   ├── ⚙️ services/               # Serviços de negócio
│       │   │   ├── transcriptionService.ts    # Processamento de transcrição
│       │   │   ├── audioProcessor.ts          # Processamento de áudio
│       │   │   ├── asrService.ts              # Speech-to-Text
│       │   │   ├── suggestionService.ts       # Geração de sugestões IA
│       │   │   ├── medicalAnalysisService.ts  # Análise médica com IA
│       │   │   └── livekitService.ts          # Integração LiveKit
│       │   ├── 🌐 websocket/             # Handlers WebSocket
│       │   │   ├── transcriptionHandler.ts    # Handler de transcrição
│       │   │   ├── audioHandler.ts            # Handler de áudio
│       │   │   ├── suggestionHandler.ts       # Handler de sugestões
│       │   │   └── index.ts
│       │   ├── 🔧 config/                # Configurações
│       │   │   ├── database.ts           # Configuração banco
│       │   │   ├── redis.ts              # Configuração Redis
│       │   │   ├── providers.ts          # Configuração provedores IA
│       │   │   └── index.ts
│       │   ├── 📝 types/                 # Definições TypeScript
│       │   ├── 🔧 utils/                 # Utilitários
│       │   ├── 📄 prompts/               # Prompts para IA
│       │   │   └── medical-prompts.ts
│       │   ├── 🚀 index.ts               # Ponto de entrada
│       │   └── 🖥️ server.ts              # Servidor Express
│       ├── 📁 dist/                      # Build compilado
│       ├── 📁 tests/                     # Testes automatizados
│       │   ├── e2e/                      # Testes end-to-end
│       │   ├── integration/              # Testes de integração
│       │   └── unit/                     # Testes unitários
│       ├── 📄 package.json               # Dependências gateway
│       ├── 📄 tsconfig.json              # Configuração TypeScript
│       └── 📄 Dockerfile                 # Imagem Docker
│
├── 📦 packages/                          # Pacotes compartilhados
│   ├── 🔄 shared-types/                  # Tipos TypeScript compartilhados
│   │   ├── 📁 src/
│   │   │   ├── api.ts                    # Tipos da API
│   │   │   ├── call.ts                   # Tipos de chamada
│   │   │   ├── medical.ts                # Tipos médicos
│   │   │   ├── transcription.ts          # Tipos de transcrição
│   │   │   └── index.ts
│   │   ├── 📄 package.json
│   │   └── 📄 tsconfig.json
│   │
│   ├── 🎨 ui-components/                 # Componentes UI reutilizáveis
│   │   ├── 📁 src/
│   │   │   └── index.ts
│   │   ├── 📄 package.json
│   │   └── 📄 tsconfig.json
│   │
│   └── 🔧 utils/                         # Utilitários compartilhados
│       ├── 📁 src/
│       │   ├── audio.ts                  # Utilitários de áudio
│       │   ├── time.ts                   # Utilitários de tempo
│       │   ├── validation.ts             # Validações
│       │   └── index.ts
│       ├── 📄 package.json
│       └── 📄 tsconfig.json
│
├── 🗄️ database/                          # Banco de dados e migrações
│   ├── 📁 migrations/                    # Migrações SQL
│   │   ├── 000_supabase_setup.sql        # Setup inicial Supabase
│   │   ├── 001_medcall_ai_schema.sql     # Schema principal
│   │   ├── 002_add_embeddings.sql        # Extensões de IA
│   │   ├── 003_add_medical_protocols.sql # Protocolos médicos
│   │   └── 004_fix_timestamp_integer_overflow.sql
│   ├── 📁 schemas/                       # Definições de schema
│   │   ├── tables.sql                    # Definições de tabelas
│   │   └── functions.sql                 # Funções SQL
│   ├── 📁 seeds/                         # Dados de exemplo
│   │   ├── medical_protocols.sql         # Protocolos médicos
│   │   ├── test_data.sql                 # Dados de teste
│   │   ├── test_patients.sql             # Pacientes de teste
│   │   └── test_patients_data.sql
│   ├── create-medicos-table.sql          # Criação tabela médicos
│   ├── fix-consultations-rls.sql         # Correções RLS
│   ├── fix-medicos-rls.sql
│   ├── fix-patients-rls.sql
│   ├── fix-transcriptions-documents-rls.sql
│   └── fix-users-rls.sql
│
├── ⚙️ configs/                           # Configurações de deployment
│   ├── 📁 docker/                        # Configurações Docker
│   │   ├── docker-compose.prod.yml       # Compose produção
│   │   ├── frontend.Dockerfile           # Imagem frontend
│   │   └── gateway.Dockerfile            # Imagem gateway
│   ├── 📁 k8s/                          # Manifests Kubernetes
│   │   ├── frontend.yaml                 # Deployment frontend
│   │   ├── gateway.yaml                  # Deployment gateway
│   │   └── ingress.yaml                  # Ingress controller
│   └── nginx.conf                        # Configuração Nginx
│
├── 🛠️ scripts/                          # Scripts de automação
│   ├── build.sh                          # Build do projeto
│   ├── deploy.sh                         # Deploy
│   ├── setup.sh                          # Setup inicial
│   ├── setup-gcp-env.sh                  # Setup Google Cloud
│   ├── setup-gcp-env-secure.sh           # Setup seguro GCP
│   ├── test-livekit.sh                   # Teste LiveKit
│   └── seed-kb.js                        # Seed knowledge base
│
├── 🔧 tools/                            # Ferramentas de desenvolvimento
│   ├── 📁 dev-tools/                    # Ferramentas de desenvolvimento
│   │   ├── audio-simulator.js           # Simulador de áudio
│   │   └── mock-server.js               # Servidor mock
│   ├── 📁 load-testing/                 # Testes de carga
│   │   └── artillery.yml                # Configuração Artillery
│   └── 📁 monitoring/                   # Monitoramento
│       ├── 📁 grafana/                  # Dashboards Grafana
│       └── 📁 prometheus/               # Métricas Prometheus
│
├── 📚 docs/                             # Documentação
│   ├── api.md                           # Documentação da API
│   ├── architecture.md                  # Arquitetura do sistema
│   ├── deployment.md                    # Guia de deployment
│   └── medical-guidelines.md            # Diretrizes médicas
│
├── 📄 README.md                         # Documentação principal
├── 📄 PACIENTES_README.md               # Documentação pacientes
├── 📄 CONSULTA_PRESENCIAL_README.md     # Consulta presencial
├── 📄 CONSULTA_ONLINE_README.md         # Consulta online
├── 📄 SUGESTOES_IA_README.md            # Sistema de sugestões IA
├── 📄 CORS_CONFIGURATION.md             # Configuração CORS
├── 📄 GOOGLE_CLOUD_ENV_SETUP.md         # Setup Google Cloud
├── 📄 README-VERCEL.md                  # Deploy Vercel
├── 📄 package.json                      # Configuração monorepo
├── 📄 lerna.json                        # Configuração Lerna
├── 📄 docker-compose.yml                # Docker Compose dev
├── 📄 cloudbuild.yaml                   # Google Cloud Build
└── 📄 app.yaml                          # Google App Engine
```

## 🔄 Fluxo de Dados

### 1. **Consulta Online (LiveKit)**
```
Frontend (LiveKit) → Gateway (WebSocket) → IA Services → Database
```

### 2. **Consulta Presencial (Dual Microfone)**
```
Frontend (AudioForker) → Gateway (WebSocket) → AudioProcessor → ASR → IA → Database
```

## 🛠️ Tecnologias Principais

### **Frontend**
- **Next.js 14** - Framework React com App Router
- **LiveKit** - Videochamadas WebRTC
- **Tailwind CSS** - Estilização
- **Zustand** - Estado global
- **Socket.io** - WebSocket client

### **Backend (Gateway)**
- **Node.js + Express** - Servidor HTTP
- **TypeScript** - Tipagem estática
- **Socket.io** - WebSocket server
- **OpenAI API** - IA e transcrição
- **Supabase** - Banco de dados

### **Infraestrutura**
- **Docker** - Containerização
- **Kubernetes** - Orquestração
- **Google Cloud Platform** - Cloud provider
- **Supabase** - Backend-as-a-Service
- **Vercel** - Deploy frontend

## 🚀 Scripts Disponíveis

### **Desenvolvimento**
```bash
npm run dev              # Inicia todos os serviços
npm run dev:frontend     # Apenas frontend
npm run dev:gateway      # Apenas gateway
```

### **Build e Deploy**
```bash
npm run build            # Build de todos os projetos
npm run build:frontend   # Build frontend
npm run build:gateway    # Build gateway
```

### **Docker**
```bash
npm run docker:build     # Build imagens Docker
npm run docker:up        # Inicia containers
npm run docker:down      # Para containers
```

### **Banco de Dados**
```bash
npm run db:migrate       # Executa migrações
npm run db:seed          # Popula dados de teste
```

## 🔐 Segurança e Compliance

- **HIPAA Compliance** - Conformidade médica
- **JWT Authentication** - Autenticação segura
- **Rate Limiting** - Proteção contra abuso
- **CORS Configuration** - Controle de origem
- **Data Encryption** - Criptografia em trânsito e repouso

## 📊 Monitoramento

- **Health Checks** - Verificação de saúde dos serviços
- **Logging** - Winston para logs estruturados
- **Metrics** - Prometheus para métricas
- **Dashboards** - Grafana para visualização

Esta estrutura garante **escalabilidade**, **manutenibilidade** e **conformidade** para um sistema médico em produção.

