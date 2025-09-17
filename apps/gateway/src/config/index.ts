import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Carrega variáveis de ambiente do próprio gateway
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env') 
});

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // App Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(process.env.PORT ? parseInt(process.env.PORT) : 8080),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  
  // LiveKit
  LIVEKIT_URL: z.string().min(1, 'LIVEKIT_URL é obrigatório'),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY é obrigatório'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET é obrigatório'),
  
  // Supabase
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL é obrigatório'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY é obrigatório'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY é obrigatório'),
  OPENAI_ORGANIZATION: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY deve ter pelo menos 32 caracteres'),
  
  // Redis (opcional por enquanto)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional(),
  
  // Medical & Compliance
  ENABLE_RECORDING: z.coerce.boolean().default(false),
  DATA_RETENTION_DAYS: z.coerce.number().default(30),
  HIPAA_COMPLIANT_MODE: z.coerce.boolean().default(true),
  
  // Audio Processing
  VAD_SILENCE_THRESHOLD_MS: z.coerce.number().default(1200),
  MAX_AUDIO_DURATION_MS: z.coerce.number().default(300000), // 5 minutos
  AUDIO_SAMPLE_RATE: z.coerce.number().default(16000),
  
  // AI & RAG Settings
  LLM_MODEL: z.string().default('gpt-4-1106-preview'),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.3),
  LLM_MAX_TOKENS: z.coerce.number().default(500),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  RAG_MAX_RESULTS: z.coerce.number().default(5),
  
  // Development
  DEBUG_AUDIO: z.coerce.boolean().default(false),
  MOCK_ASR: z.coerce.boolean().default(false),
  MOCK_LLM: z.coerce.boolean().default(false),
});

// Valida e exporta as configurações
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuração inválida:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
}

export const config = validateEnv();

// Configurações derivadas
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Configurações específicas por ambiente
export const corsOrigins = isDevelopment 
  ? ['http://localhost:3000', 'http://localhost:3001']
  : [config.FRONTEND_URL];

// Configurações de logging
export const logConfig = {
  level: config.LOG_LEVEL,
  format: isDevelopment ? 'dev' : 'combined',
  enableConsole: isDevelopment,
  enableFile: isProduction,
};

// Configurações de rate limiting
export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Muitas requisições, tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
};

// Configurações de áudio
export const audioConfig = {
  sampleRate: config.AUDIO_SAMPLE_RATE,
  vadSilenceThreshold: config.VAD_SILENCE_THRESHOLD_MS,
  maxDuration: config.MAX_AUDIO_DURATION_MS,
  enableDebug: config.DEBUG_AUDIO,
};

// Configurações de AI
export const aiConfig = {
  openai: {
    apiKey: config.OPENAI_API_KEY,
    organization: config.OPENAI_ORGANIZATION,
    model: config.LLM_MODEL,
    temperature: config.LLM_TEMPERATURE,
    maxTokens: config.LLM_MAX_TOKENS,
  },
  rag: {
    similarityThreshold: config.RAG_SIMILARITY_THRESHOLD,
    maxResults: config.RAG_MAX_RESULTS,
  },
  mocks: {
    asr: config.MOCK_ASR,
    llm: config.MOCK_LLM,
  },
};

// Configurações de compliance
export const complianceConfig = {
  enableRecording: config.ENABLE_RECORDING,
  dataRetentionDays: config.DATA_RETENTION_DAYS,
  hipaaMode: config.HIPAA_COMPLIANT_MODE,
};

export default config;