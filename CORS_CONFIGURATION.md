# Configuração de CORS - MedCall AI

## Problema Resolvido

O erro "Bloqueado pelo CORS: Origin não permitida" foi resolvido temporariamente permitindo todos os origins em produção.

## Solução Implementada

### 1. Modificação Temporária no CORS (`apps/gateway/src/middleware/cors.ts`)

```typescript
// TEMPORÁRIO: Permitir todos os origins em produção para resolver problema de CORS
// TODO: Configurar domínios específicos após definir FRONTEND_URL correto
if (isProduction) {
  console.warn(`⚠️  CORS: Permitindo origin não autorizada: ${origin}`);
  return callback(null, true);
}
```

### 2. Atualização do app.yaml

```yaml
env_variables:
  NODE_ENV: "production"
  FRONTEND_URL: "https://medcall-ai-frontend.vercel.app"
```

## Próximos Passos (Recomendado para Produção)

### 1. Definir Domínios Corretos

Substitua o `FRONTEND_URL` no `app.yaml` pelo domínio real do seu frontend:

```yaml
env_variables:
  NODE_ENV: "production"
  FRONTEND_URL: "https://seu-dominio-real.com"
```

### 2. Configurar CORS Restritivo

Após definir o domínio correto, remova a configuração temporária e mantenha apenas:

```typescript
// Configuração específica de CORS para WebRTC e áudio
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Verificar se origin está na lista permitida
    if (origin && corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Em desenvolvimento, ser mais flexível
    if (isDevelopment) {
      return callback(null, true);
    }

    // Em produção, bloquear origins não autorizadas
    callback(new Error('Bloqueado pelo CORS: Origin não permitida'));
  },
  // ... resto da configuração
});
```

### 3. Adicionar Domínios Adicionais (se necessário)

Se você precisar permitir múltiplos domínios, atualize a configuração em `apps/gateway/src/config/index.ts`:

```typescript
export const corsOrigins = isDevelopment 
  ? ['http://localhost:3000', 'http://localhost:3001']
  : [
      config.FRONTEND_URL,
      'https://outro-dominio.com',
      'https://app.dominio.com'
    ];
```

## Deploy

Para aplicar as mudanças:

1. **Desenvolvimento**: Reinicie o servidor gateway
2. **Produção**: Faça deploy no Google Cloud Run

```bash
# Build e deploy
npm run build -w @medcall/gateway
gcloud app deploy
```

## Segurança

⚠️ **IMPORTANTE**: A configuração atual permite todos os origins em produção. Isso é adequado para desenvolvimento/teste, mas deve ser restringido em produção real para manter a segurança.

## Monitoramento

O sistema agora loga warnings quando origins não autorizadas são permitidas:

```
⚠️  CORS: Permitindo origin não autorizada: https://dominio-nao-autorizado.com
```

Monitore esses logs para identificar tentativas de acesso não autorizadas.
