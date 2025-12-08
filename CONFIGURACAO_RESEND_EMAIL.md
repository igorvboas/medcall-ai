# 📧 Configuração do Resend para Envio de Emails

Este guia explica como configurar o Resend para enviar emails automaticamente com as credenciais dos pacientes.

## 🔧 Configuração Necessária

### 1. Criar Conta no Resend

1. Acesse [resend.com](https://resend.com)
2. Crie uma conta gratuita
3. Verifique seu email

### 2. Obter API Key

1. No dashboard do Resend, vá em **API Keys**
2. Clique em **Create API Key**
3. Dê um nome (ex: "MedCall AI Production")
4. Copie a API Key gerada

### 3. Configurar Domínio (OBRIGATÓRIO para Produção)

⚠️ **IMPORTANTE:** No modo de teste, o Resend só permite enviar emails para o email verificado da sua conta (geralmente o email que você usou para criar a conta).

**Para enviar emails para qualquer destinatário, você DEVE verificar um domínio:**

1. Vá em **Domains** no dashboard do Resend
2. Clique em **Add Domain**
3. Adicione seu domínio (ex: `triacompany.com.br`)
4. Siga as instruções para verificar o domínio:
   - Adicione os registros DNS fornecidos pelo Resend no seu provedor de DNS
   - Aguarde a verificação (pode levar alguns minutos)
5. Após verificar, atualize a variável `RESEND_FROM_EMAIL` no `.env`:
   ```bash
   RESEND_FROM_EMAIL=noreply@triacompany.com.br
   ```

**Para desenvolvimento/teste:** Você pode usar o domínio padrão (`onboarding@resend.dev`), mas só poderá enviar para o email verificado da sua conta.

### 4. Adicionar Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env` do frontend:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@seudominio.com  # Opcional: usar domínio verificado
APP_NAME=MedCall AI  # Opcional: nome que aparece no email
```

**Para desenvolvimento:**
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
APP_NAME=MedCall AI
```

### 5. Reiniciar o Servidor

Após adicionar as variáveis, reinicie o servidor Next.js:

```bash
npm run dev
```

## ✅ Como Funciona

Quando você criar um paciente com email:

1. ✅ Sistema cria usuário no Supabase Auth com senha
2. ✅ Gera senha temporária segura
3. ✅ **Envia email automaticamente com as credenciais**
4. ✅ Exibe modal com credenciais (backup)

## 📧 Conteúdo do Email

O email enviado contém:
- ✅ Nome do paciente
- ✅ Email de login
- ✅ Senha temporária
- ✅ Link para acessar o sistema
- ✅ Aviso de segurança

## 🎨 Personalização

Você pode personalizar o template do email editando:
- `apps/frontend/src/lib/email-service.ts`

## 🚨 Troubleshooting

### Email não está sendo enviado?

1. **Verifique a API Key:**
   ```bash
   grep RESEND_API_KEY apps/frontend/.env
   ```

2. **Verifique os logs:**
   - Procure por `📧 Enviando email` nos logs do servidor
   - Procure por erros relacionados ao Resend
   - Procure por `✅ Email aceito pelo Resend!` - isso significa que o Resend aceitou o email

3. **Teste a API Key:**
   - Verifique se a API Key está ativa no dashboard do Resend
   - Verifique se não excedeu o limite de emails

### Email foi enviado mas não chegou?

Se os logs mostram `✅ Email aceito pelo Resend!` mas o email não chegou:

1. **Verifique o Dashboard do Resend:**
   - Acesse: https://resend.com/emails
   - Procure pelo ID do email (aparece nos logs)
   - Verifique o status de entrega:
     - ✅ **Delivered**: Email entregue com sucesso
     - ⏳ **Sending**: Ainda sendo enviado
     - ❌ **Bounced**: Email rejeitado pelo servidor de destino
     - ⚠️ **Complained**: Destinatário marcou como spam

2. **Verifique a Caixa de SPAM:**
   - O email pode estar na pasta de spam/lixo eletrônico
   - Procure por "MedCall AI" ou "Credenciais de acesso"

3. **Verifique o Email de Destino:**
   - Confirme que o email está correto
   - Verifique se o servidor de email do destinatário está funcionando

4. **Verifique os Logs Detalhados:**
   - Nos logs do servidor, procure pelo ID do email
   - Exemplo: `✅ Email aceito pelo Resend! ID: f61402b7-b2d1-4c0a-93f1-2f2575e7b2c7`
   - Use esse ID para buscar no dashboard do Resend

### Erro: "RESEND_API_KEY não configurado"

- Adicione a variável `RESEND_API_KEY` no arquivo `.env`
- Reinicie o servidor

### Erro: "You can only send testing emails to your own email address"

Este erro ocorre quando o Resend está em modo de teste. Para resolver:

1. **Verifique um domínio no Resend** (veja seção 3 acima)
2. **Atualize `RESEND_FROM_EMAIL`** no `.env` para usar o domínio verificado:
   ```bash
   RESEND_FROM_EMAIL=noreply@seudominio.com.br
   ```
3. **Reinicie o servidor**

### Emails indo para spam?

- Verifique seu domínio no Resend
- Use um domínio verificado (não `onboarding@resend.dev`)
- Configure SPF e DKIM no DNS (o Resend fornece essas configurações)

### Como verificar se o email foi realmente enviado?

1. **Nos logs do servidor, procure por:**
   ```
   ✅ Email aceito pelo Resend!
   - ID do email: [ID_AQUI]
   ```

2. **Acesse o Dashboard do Resend:**
   - https://resend.com/emails
   - Use o ID do email para buscar

3. **Status possíveis:**
   - **Delivered**: ✅ Email entregue (verifique spam se não chegou)
   - **Sending**: ⏳ Ainda processando
   - **Bounced**: ❌ Rejeitado (verifique o email de destino)
   - **Complained**: ⚠️ Marcado como spam pelo destinatário

## 📊 Limites do Plano Gratuito

- **100 emails/dia** no plano gratuito do Resend
- Para produção, considere um plano pago

## 🔗 Links Úteis

- [Documentação Resend](https://resend.com/docs)
- [Dashboard Resend](https://resend.com/emails)
- [API Keys](https://resend.com/api-keys)

