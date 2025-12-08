# 📧 Configuração de Email no Supabase

Este guia explica como configurar o Supabase para enviar emails automaticamente quando um paciente é criado.

## ✅ Boa Notícia!

O código está configurado para usar o **sistema de email padrão do Supabase** (o mesmo usado para confirmação de email de conta). Isso significa que você **NÃO precisa configurar SMTP** se estiver usando o plano gratuito ou se o sistema padrão estiver funcionando.

## 🔧 Configuração Necessária

### Opção 1: Usar Sistema Padrão do Supabase (Recomendado para começar)

O `inviteUserByEmail` usa o sistema de email integrado do Supabase, que funciona automaticamente:

1. **Verificar se está habilitado**
   - Acesse o painel do Supabase → seu projeto
   - Vá em **Authentication → Settings**
   - Verifique se **Enable Email Signup** está ativado
   - Verifique se **Enable Magic Link** está ativado

2. **Configurar URLs de redirecionamento**
   - Authentication → URL Configuration
   - Adicione suas URLs permitidas

3. **Testar**
   - Crie um paciente e verifique se o email chega
   - Se funcionar, não precisa configurar SMTP!

### Opção 2: Configurar SMTP Personalizado (Opcional - Para produção)

Se você quiser usar um servidor SMTP personalizado (recomendado para produção), siga os passos abaixo:

#### Passo a Passo:

1. **Acesse o Painel do Supabase**
   - Vá para [app.supabase.com](https://app.supabase.com)
   - Selecione seu projeto

2. **Navegue até Authentication → Settings**
   - No menu lateral, clique em **Authentication**
   - Depois clique em **Settings** (Configurações)

3. **Configure o SMTP**
   - Role até a seção **SMTP Settings**
   - Preencha os seguintes campos:

   ```
   SMTP Host: smtp.seuprovedor.com
   SMTP Port: 587 (TLS) ou 465 (SSL)
   SMTP User: seu-email@dominio.com
   SMTP Password: sua-senha-smtp
   Sender Name: MedCall AI (ou o nome que preferir)
   Sender Email: noreply@seudominio.com
   ```

4. **Salve as Configurações**
   - Clique em **Save** para salvar

### 2. Provedores SMTP Recomendados

#### Opção 1: Gmail (Desenvolvimento/Teste)
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: seu-email@gmail.com
SMTP Password: [Senha de App do Gmail]
```

**⚠️ Importante para Gmail:**
- Você precisa criar uma "Senha de App" no Google
- Acesse: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Gere uma senha de app específica para o Supabase

#### Opção 2: SendGrid (Produção)
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Sua API Key do SendGrid]
```

#### Opção 3: AWS SES (Produção)
```
SMTP Host: email-smtp.regiao.amazonaws.com
SMTP Port: 587
SMTP User: [Seu SMTP Username]
SMTP Password: [Seu SMTP Password]
```

#### Opção 4: Mailgun (Produção)
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP User: [Seu Mailgun Username]
SMTP Password: [Sua Mailgun Password]
```

### 3. Personalizar Templates de Email (Opcional)

1. **Acesse Authentication → Email Templates**
   - No menu lateral, clique em **Authentication**
   - Depois clique em **Email Templates**

2. **Personalize os Templates**
   - **Magic Link**: Template usado quando enviamos o magic link
   - Você pode personalizar o assunto, corpo do email, etc.

3. **Variáveis Disponíveis**
   - `{{ .ConfirmationURL }}` - Link de confirmação
   - `{{ .Email }}` - Email do usuário
   - `{{ .Token }}` - Token de confirmação
   - `{{ .TokenHash }}` - Hash do token

### 4. Configurar URL de Redirecionamento

1. **Acesse Authentication → URL Configuration**
   - No menu lateral, clique em **Authentication**
   - Depois clique em **URL Configuration**

2. **Adicione suas URLs**
   - **Site URL**: `http://localhost:3000` (desenvolvimento) ou `https://seudominio.com` (produção)
   - **Redirect URLs**: Adicione todas as URLs que podem receber redirecionamentos:
     ```
     http://localhost:3000/**
     https://seudominio.com/**
     https://seudominio.com/auth/callback
     ```

### 5. Verificar Configuração

Após configurar, você pode testar:

1. **Criar um paciente** através da interface
2. **Verificar o email** do paciente (incluindo spam)
3. **Verificar os logs** no Supabase:
   - Vá em **Authentication → Logs**
   - Procure por eventos de "invite" ou "magiclink"

## 🚨 Troubleshooting

### Email não está sendo enviado?

1. **Verifique as credenciais SMTP**
   - Teste as credenciais em um cliente de email separado
   - Certifique-se de que a senha está correta

2. **Verifique os logs do Supabase**
   - Vá em **Authentication → Logs**
   - Procure por erros relacionados a email

3. **Verifique o spam**
   - Os emails podem estar indo para a pasta de spam
   - Adicione o remetente à lista de contatos

4. **Teste com um email diferente**
   - Tente criar um paciente com outro email
   - Verifique se o problema é específico de um email

### Erro: "SMTP not configured"

- Certifique-se de que preencheu todos os campos do SMTP
- Salve as configurações após preencher
- Aguarde alguns minutos para as mudanças serem aplicadas

### Email chega mas o link não funciona?

- Verifique se a URL de redirecionamento está configurada corretamente
- Certifique-se de que o domínio está na lista de URLs permitidas
- Verifique se há algum firewall bloqueando o acesso

## 📝 Notas Importantes

1. **Limite de Emails Gratuitos**
   - O plano gratuito do Supabase tem limites de email
   - Para produção, considere usar um serviço SMTP externo

2. **Segurança**
   - Nunca compartilhe suas credenciais SMTP
   - Use variáveis de ambiente para armazenar senhas
   - Rotacione as senhas periodicamente

3. **Desenvolvimento Local**
   - Para desenvolvimento, você pode usar o Gmail ou um serviço de teste
   - Considere usar [Mailtrap](https://mailtrap.io) para testar emails sem enviar para emails reais

## ✅ Checklist de Configuração

### Com Sistema Padrão do Supabase:
- [ ] Enable Email Signup ativado
- [ ] Enable Magic Link ativado
- [ ] URLs de redirecionamento configuradas
- [ ] Teste de criação de paciente realizado
- [ ] Email recebido e link funcionando

### Com SMTP Personalizado (Opcional):
- [ ] SMTP configurado no Supabase
- [ ] Credenciais SMTP testadas e funcionando
- [ ] Templates de email personalizados (opcional)
- [ ] URLs de redirecionamento configuradas
- [ ] Teste de criação de paciente realizado
- [ ] Email recebido e link funcionando

## 🔗 Links Úteis

- [Documentação Supabase - SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Documentação Supabase - Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)

