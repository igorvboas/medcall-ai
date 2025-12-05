# MedCall AI

-> 9° DEPLOY PARA HOMOLOG

AI-powered real-time transcription and analysis for medical video calls......

## 🚀 Overview

MedCall AI provides intelligent assistance during medical consultations by:
- Real-time transcription of doctor-patient conversations
- AI-powered suggestions for follow-up questions
- Medical protocol compliance assistance
- Secure, HIPAA-compliant data handling

## 🏗️ Architecture

This is a monorepo containing:

- **Frontend** (`apps/frontend`): Next.js application with LiveKit integration
- **Gateway** (`apps/gateway`): Node.js service for audio processing and AI
- **Shared Types** (`packages/shared-types`): Common TypeScript interfaces
- **Utils** (`packages/utils`): Shared utility functions

## 📋 Prerequisites

- Node.js 18+ 
- npm 9+
- Docker & Docker Compose (optional)
- LiveKit Cloud account
- Supabase account
- OpenAI API key

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables
# See .env.example for all required variables
```

### 3. Database Setup

```bash
# If using local PostgreSQL
npm run docker:up postgres redis

# Or configure Supabase connection in .env
```

### 4. Development

```bash
# Start all services in development mode
npm run dev

# Or start services individually
npm run dev:frontend  # http://localhost:3000
npm run dev:gateway   # http://localhost:3001
```

### 5. Docker Setup (Alternative)

```bash
# Build and start all services
npm run docker:build
npm run docker:up

# Stop services
npm run docker:down
```

## 🔧 Configuration

### LiveKit Setup

1. Create account at [LiveKit Cloud](https://cloud.livekit.io)
2. Create new project
3. Copy API Key and Secret to `.env`

### Supabase Setup

1. Create project at [Supabase](https://supabase.com)
2. Enable pgvector extension (for RAG)
3. Run database migrations
4. Copy URL and keys to `.env`

### OpenAI Setup

1. Get API key from [OpenAI](https://platform.openai.com)
2. Add to `.env` file
3. Configure model preferences

## 📁 Project Structure

```
medcall-ai/
├── apps/
│   ├── frontend/          # Next.js React app
│   └── gateway/           # Node.js backend service
├── packages/
│   ├── shared-types/      # TypeScript definitions
│   └── utils/             # Shared utilities
├── database/
│   ├── migrations/        # SQL migrations
│   └── seeds/             # Sample data
├── configs/
│   ├── docker/           # Docker configurations
│   └── k8s/              # Kubernetes manifests
└── docs/                 # Documentation
```

## 🚀 Available Scripts

### Root Level
- `npm run dev` - Start all services in development
- `npm run build` - Build all applications
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run clean` - Clean all build artifacts

### Frontend Specific
- `npm run dev:frontend` - Start Next.js dev server
- `npm run build:frontend` - Build frontend for production

### Gateway Specific
- `npm run dev:gateway` - Start Gateway with hot reload
- `npm run build:gateway` - Build Gateway for production

## 🔐 Security & Compliance

### HIPAA Compliance
- All audio data is encrypted in transit and at rest
- Optional local-only processing mode
- Configurable data retention policies
- Audit logging for all medical data access

### Security Features
- JWT-based authentication
- Rate limiting on all endpoints
- CORS configuration for WebRTC
- Input validation and sanitization

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific workspace tests
npm test --workspace=apps/gateway
```

## 📊 Monitoring & Logging

- Structured logging with Winston
- Error tracking with Sentry (optional)
- Performance monitoring built-in
- Audio processing metrics

## 🐳 Deployment

### Docker Production

```bash
# Build production images
docker-compose -f configs/docker/docker-compose.prod.yml build

# Deploy with production config
docker-compose -f configs/docker/docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Apply K8s manifests
kubectl apply -f configs/k8s/
```

## 🔧 Development

### Adding New Features

1. Create feature branch
2. Add types to `packages/shared-types`
3. Implement backend logic in `apps/gateway`
4. Add frontend components in `apps/frontend`
5. Update tests and documentation

### Code Style

- ESLint + Prettier for code formatting
- Conventional commits for version control
- TypeScript strict mode enabled
- Pre-commit hooks with Husky

## 📚 API Documentation

- Gateway API: `http://localhost:3001/api/docs`
- WebSocket Events: See `docs/websocket-api.md`
- Medical Guidelines: See `docs/medical-guidelines.md`

## 🐛 Troubleshooting

### Common Issues

**Audio not working**: Check microphone permissions and WebRTC configuration
**High latency**: Verify network connection and ASR service status
**Build failures**: Clear node_modules and reinstall dependencies

### Debug Mode

```bash
# Enable debug logging
DEBUG_AUDIO=true npm run dev:gateway

# Enable mock services for testing
MOCK_ASR=true MOCK_LLM=true npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🆘 Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Discussions: GitHub Discussions

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Made with ❤️ for healthcare professionals**
