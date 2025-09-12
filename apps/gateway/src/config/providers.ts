import OpenAI from 'openai';
import { AccessToken } from 'livekit-server-sdk';
import { config } from './index';

// Configuração do OpenAI
export const openaiClient = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  // Só incluir organization se ela existir e não estiver vazia
  ...(config.OPENAI_ORGANIZATION && config.OPENAI_ORGANIZATION.length > 0 && {
    organization: config.OPENAI_ORGANIZATION
  }),
  timeout: 30000, // 30 segundos
  maxRetries: 3,
});

// Teste de conexão com OpenAI
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const response = await openaiClient.models.list();
    
    if (response.data && response.data.length > 0) {
      console.log('✅ Conexão com OpenAI estabelecida com sucesso');
      console.log(`   Modelos disponíveis: ${response.data.length}`);
      return true;
    }
    
    console.error('❌ OpenAI conectado mas sem modelos disponíveis');
    return false;
  } catch (error) {
    console.error('❌ Falha ao conectar com OpenAI:', error);
    return false;
  }
}

// Configurações do LiveKit
export const livekitSettings = {
  url: config.LIVEKIT_URL,
  apiKey: config.LIVEKIT_API_KEY,
  apiSecret: config.LIVEKIT_API_SECRET,
};

// Geração de tokens LiveKit
export async function generateLiveKitToken(
  identity: string,
  roomName: string,
  options: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    metadata?: string;
  } = {}
): Promise<string> {
  const {
    canPublish = true,
    canSubscribe = true,
    canPublishData = true,
    metadata,
  } = options;

  const at = new AccessToken(
    config.LIVEKIT_API_KEY,
    config.LIVEKIT_API_SECRET,
    { identity, metadata }
  );

  // TTL em segundos (24h)
  at.ttl = 24 * 60 * 60;

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData,
  });

  return await at.toJwt(); // <- agora aguardando a Promise
}

// Teste de configuração do LiveKit
export async function testLiveKitConfig(): Promise<boolean> {
  try {
    const testToken = await generateLiveKitToken('test-user', 'test-room'); // <- await

    if (testToken && testToken.length > 0) {
      console.log('✅ Configuração do LiveKit válida');
      console.log(`   URL: ${config.LIVEKIT_URL}`);
      return true;
    }

    console.error('❌ Falha ao gerar token LiveKit');
    return false;
  } catch (error) {
    console.error('❌ Configuração inválida do LiveKit:', error);
    return false;
  }
}

// Configuração Redis (opcional por enquanto)
export const redisSettings = config.REDIS_URL 
  ? {
      url: config.REDIS_URL,
      password: config.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    }
  : null;

// Teste de conexão Redis (se configurado)
export async function testRedisConnection(): Promise<boolean> {
  if (!redisSettings) {
    console.log('⚠️  Redis não configurado - usando modo sem cache');
    return true; // Não é erro, apenas não está configurado
  }

  try {
    // TODO: Implementar teste de conexão Redis quando necessário
    console.log('⚠️  Redis configurado mas teste não implementado ainda');
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com Redis:', error);
    return false;
  }
}

// Configurações de AI específicas para diferentes modelos
export const aiModels = {
  transcription: {
    openai: {
      model: 'whisper-1',
      language: 'pt',
      response_format: 'verbose_json' as const,
      temperature: 0,
    },
    // Placeholder para outros providers
    google: {
      model: 'latest_long',
      languageCode: 'pt-BR',
      enableAutomaticPunctuation: true,
      useEnhanced: true,
    },
  },
  
  completion: {
    model: config.LLM_MODEL,
    temperature: config.LLM_TEMPERATURE,
    max_tokens: config.LLM_MAX_TOKENS,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  },

  embedding: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
};

// Helper para criar chat completion
export async function makeChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
) {
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    ...aiModels.completion,
    messages,
    ...options,
  };

  return await openaiClient.chat.completions.create(params);
}

// Helper para criar embeddings
export async function makeEmbedding(text: string) {
  return await openaiClient.embeddings.create({
    model: aiModels.embedding.model,
    input: text,
    dimensions: aiModels.embedding.dimensions,
  });
}

// Validação de todas as configurações
export async function validateAllProviders(): Promise<{
  openai: boolean;
  livekit: boolean;
  redis: boolean;
}> {
  console.log('🔄 Validando conexões com provedores...\n');

  const results = {
    openai: await testOpenAIConnection(),
    livekit: await testLiveKitConfig(),
    redis: await testRedisConnection(),
  };

  console.log('\n📊 Resultado da validação:');
  console.log(`   OpenAI: ${results.openai ? '✅' : '❌'}`);
  console.log(`   LiveKit: ${results.livekit ? '✅' : '❌'}`);
  console.log(`   Redis: ${results.redis ? '✅' : '⚠️'}`);

  return results;
}