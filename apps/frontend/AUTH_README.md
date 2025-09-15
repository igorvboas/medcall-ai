# Autenticação - TRIA

Este documento descreve as funcionalidades de autenticação implementadas na aplicação TRIA.

## Funcionalidades Implementadas

### 1. Páginas de Autenticação

- **Sign Up** (`/auth/signup`): Página para criação de nova conta
- **Sign In** (`/auth/signin`): Página para login de usuários existentes

### 2. Componentes

- **useAuth Hook**: Hook personalizado para gerenciar autenticação
- **AuthRedirect**: Componente para redirecionamento baseado no estado de autenticação
- **UI Components**: Button, Input, Label, Card (componentes reutilizáveis)

### 3. Middleware de Proteção

- Proteção automática de rotas que requerem autenticação
- Redirecionamento automático para páginas de auth quando necessário
- Redirecionamento para dashboard quando usuário já está logado

### 4. Funcionalidades do Header

- Menu dropdown do usuário com informações da conta
- Botão de logout
- Exibição do email do usuário

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na pasta `apps/frontend/` com as seguintes variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Configuração do Supabase

No painel do Supabase, certifique-se de que:

1. A autenticação por email está habilitada
2. As políticas de segurança estão configuradas adequadamente
3. O domínio da aplicação está na lista de URLs permitidas

## Rotas Protegidas

As seguintes rotas requerem autenticação:
- `/dashboard`
- `/call`
- `/consulta`

## Fluxo de Autenticação

1. **Usuário não logado**: Redirecionado para `/auth/signin`
2. **Sign Up**: Usuário cria conta → Email de confirmação enviado → Redirecionado para sign in
3. **Sign In**: Usuário faz login → Redirecionado para `/dashboard`
4. **Logout**: Usuário faz logout → Redirecionado para `/auth/signin`

## Recursos Adicionais

- **Recuperação de senha**: Link "Esqueceu sua senha?" na página de sign in
- **Validação de formulários**: Validação de email e senha
- **Estados de loading**: Indicadores visuais durante operações de auth
- **Tratamento de erros**: Mensagens de erro amigáveis
- **Responsividade**: Interface adaptável para diferentes tamanhos de tela

## Estrutura de Arquivos

```
apps/frontend/src/
├── app/
│   ├── auth/
│   │   ├── layout.tsx          # Layout para páginas de auth
│   │   ├── signin/page.tsx     # Página de login
│   │   └── signup/page.tsx     # Página de cadastro
│   └── page.tsx                # Página inicial com redirecionamento
├── components/
│   ├── auth/
│   │   └── AuthRedirect.tsx    # Componente de redirecionamento
│   ├── shared/
│   │   └── Header.tsx          # Header com menu do usuário
│   └── ui/                     # Componentes UI reutilizáveis
├── hooks/
│   └── useAuth.ts              # Hook de autenticação
├── lib/
│   └── supabase.ts             # Configuração do Supabase
└── middleware.ts               # Middleware de proteção de rotas
```

## Próximos Passos

1. Configurar as variáveis de ambiente
2. Testar o fluxo completo de autenticação
3. Personalizar estilos conforme necessário
4. Implementar funcionalidades adicionais (2FA, perfil do usuário, etc.)
