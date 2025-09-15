# Página de Pacientes - MedCall AI

## Funcionalidades Implementadas

### 📋 Lista de Pacientes
- **Visualização em cards**: Cada paciente é exibido em um card com informações organizadas
- **Informações exibidas**:
  - Nome completo
  - Idade calculada automaticamente
  - Gênero
  - Localização (cidade, estado)
  - Contatos (telefone, email)
  - Histórico médico resumido
  - Alergias conhecidas
  - Status do paciente (Ativo, Inativo, Arquivado)
  - Data de cadastro

### 🔍 Filtros e Busca
- **Busca por texto**: Pesquisa por nome, email ou telefone
- **Filtro por status**: Ativos, Inativos, Arquivados ou Todos
- **Busca em tempo real**: Filtros aplicados automaticamente com debounce

### ➕ Cadastro de Novos Pacientes
- **Formulário completo** com seções organizadas:
  - **Informações Básicas**: Nome, email, telefone, CPF, data de nascimento, sexo
  - **Endereço**: Endereço completo, cidade, estado
  - **Contato de Emergência**: Nome e telefone do contato
  - **Informações Médicas**: Histórico médico, alergias, medicamentos em uso

### ✏️ Edição de Pacientes
- **Modal de edição**: Mesmo formulário usado para criação
- **Pré-preenchimento**: Todos os campos são preenchidos com dados existentes
- **Validação**: Mesmas validações aplicadas na criação

### 🗑️ Exclusão de Pacientes
- **Confirmação**: Modal de confirmação antes da exclusão
- **Segurança**: Verificação de permissões antes da exclusão

### 📄 Paginação
- **Navegação**: Botões Anterior/Próxima
- **Informações**: Exibição da página atual e total de páginas
- **Performance**: Carregamento de 20 pacientes por página

## Arquivos Criados

### Frontend
- `apps/frontend/src/app/pacientes/page.tsx` - Página principal
- `apps/frontend/src/app/pacientes/page.module.css` - Estilos CSS
- `apps/frontend/src/app/pacientes/layout.tsx` - Layout da página
- `apps/frontend/src/components/patients/PatientForm.tsx` - Formulário de pacientes

### API
- `apps/frontend/src/app/api/patients/route.ts` - Endpoints GET e POST
- `apps/frontend/src/app/api/patients/[id]/route.ts` - Endpoints GET, PUT e DELETE

### Tipos
- `packages/shared-types/src/medical.ts` - Interfaces TypeScript para pacientes

## Estrutura do Banco de Dados

A funcionalidade utiliza a tabela `patients` já existente no banco:

```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(2),
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('M', 'F', 'O')),
    cpf VARCHAR(14) UNIQUE,
    address TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Validações Implementadas

### Campos Obrigatórios
- **Nome**: Campo obrigatório, não pode estar vazio

### Validações de Formato
- **Email**: Validação de formato de email válido
- **CPF**: Validação de formato brasileiro (000.000.000-00)
- **Data de Nascimento**: Não pode ser data futura
- **Telefone**: Formatação automática para padrão brasileiro

### Formatação Automática
- **CPF**: Aplicação automática de máscara
- **Telefone**: Formatação para (11) 99999-9999
- **Estado**: Conversão automática para maiúsculas

## Segurança

### Row Level Security (RLS)
- Médicos só podem ver seus próprios pacientes
- Políticas de segurança implementadas no banco de dados

### Validação de Permissões
- Verificação de ownership antes de operações de edição/exclusão
- Validação de existência do paciente antes de operações

## Responsividade

### Design Responsivo
- **Desktop**: Grid com múltiplas colunas
- **Tablet**: Grid adaptativo
- **Mobile**: Layout em coluna única
- **Formulário**: Campos se reorganizam em telas menores

## Estados da Interface

### Loading
- Spinner de carregamento durante requisições
- Estados de loading específicos para cada operação

### Error Handling
- Mensagens de erro claras e específicas
- Botão de "Tentar Novamente" em caso de erro
- Validação de campos com feedback visual

### Empty States
- Mensagem quando não há pacientes
- Call-to-action para adicionar primeiro paciente
- Diferentes mensagens para busca sem resultados vs. lista vazia

## Próximos Passos Sugeridos

1. **Autenticação Real**: Implementar sistema de autenticação completo
2. **Upload de Fotos**: Adicionar campo para foto do paciente
3. **Histórico de Consultas**: Link para consultas do paciente
4. **Exportação**: Funcionalidade para exportar lista de pacientes
5. **Busca Avançada**: Mais filtros (idade, cidade, etc.)
6. **Notificações**: Sistema de notificações para lembretes
7. **Backup**: Funcionalidade de backup dos dados
