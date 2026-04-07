export interface TutorialStep {
  selector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  expandSidebar?: boolean;
}

export const DASHBOARD_STEPS: TutorialStep[] = [
  {
    selector: '[data-tutorial-nav="home"]',
    title: 'Home',
    description: 'Acesse o painel principal com resumo das suas consultas e metricas.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="nova-consulta"]',
    title: 'Nova Consulta',
    description: 'Inicie uma nova consulta presencial ou por telemedicina.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="consultas"]',
    title: 'Consultas',
    description: 'Veja todas as suas consultas realizadas e em andamento.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="agenda"]',
    title: 'Agenda',
    description: 'Gerencie seus horarios e agendamentos.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="pacientes"]',
    title: 'Pacientes',
    description: 'Acesse a lista completa dos seus pacientes cadastrados.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="cadastro"]',
    title: 'Cadastro',
    description: 'Gerencie seus cadastros de alimentos, refeições, treinos e prescrições.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '[data-tutorial-nav="configuracoes"]',
    title: 'Configurações',
    description: 'Ajuste suas preferências e dados do perfil.',
    position: 'right',
    expandSidebar: true,
  },
  {
    selector: '.tutorial-restart-btn',
    title: 'Reiniciar Tutorial',
    description: 'Clique aqui a qualquer momento para rever o tutorial desta tela.',
    position: 'bottom',
  },
  {
    selector: '.dark-mode-toggle-btn',
    title: 'Modo Escuro / Claro',
    description: 'Alterne entre o tema claro e escuro da plataforma.',
    position: 'bottom',
  },
  {
    selector: '.user-menu',
    title: 'Seu Perfil',
    description: 'Acesse seu perfil e opcoes de conta.',
    position: 'bottom',
  },
  {
    selector: '.kpi.kpi--cyan',
    title: 'Consultas no Dia',
    description: 'Veja quantas consultas voce tem agendadas para hoje.',
    position: 'bottom',
  },
  {
    selector: '.kpi.kpi--amber',
    title: 'Pacientes Cadastrados',
    description: 'Total de pacientes registrados na sua clinica.',
    position: 'bottom',
  },
  {
    selector: '.kpi.kpi--lilac',
    title: 'Tempo Medio de Consulta',
    description: 'Duracao media das suas consultas recentes.',
    position: 'bottom',
  },
  {
    selector: '.status-card',
    title: 'Status de Consultas',
    description: 'Acompanhe o status das suas consultas: agendadas, em andamento e concluidas.',
    position: 'left',
  },
  {
    selector: '.chart-card',
    title: 'Presencial vs Telemedicina',
    description: 'Compare a distribuicao entre consultas presenciais e por telemedicina.',
    position: 'right',
  },
  {
    selector: '.calendar-card',
    title: 'Calendario',
    description: 'Visualize rapidamente os dias com consultas agendadas.',
    position: 'left',
  },
  {
    selector: '.weekly-chart',
    title: 'Atendimentos na Semana',
    description: 'Grafico com o volume de atendimentos ao longo da semana.',
    position: 'right',
  },
  {
    selector: '.consultations-table',
    title: 'Ultimas Consultas',
    description: 'Lista das consultas mais recentes com status e detalhes.',
    position: 'top',
  },
];

export const CONSULTAS_STEPS: TutorialStep[] = [
  {
    selector: '.consultas-stats-badge',
    title: 'Total de Consultas',
    description: 'Numero total de consultas registradas.',
    position: 'bottom',
  },
  {
    selector: '.btn-new-consultation',
    title: 'Nova Consulta',
    description: 'Clique para iniciar uma nova consulta.',
    position: 'bottom',
  },
  {
    selector: '.search-input',
    title: 'Buscar Consultas',
    description: 'Pesquise consultas pelo nome do paciente.',
    position: 'bottom',
  },
  {
    selector: '.filters-section',
    title: 'Filtros',
    description: 'Filtre por status, tipo ou data.',
    position: 'bottom',
  },
  {
    selector: '.consultas-table',
    title: 'Lista de Consultas',
    description: 'Todas as suas consultas com acoes rapidas.',
    position: 'top',
  },
];

export const AGENDA_STEPS: TutorialStep[] = [
  {
    selector: '.agenda-title-section',
    title: 'Agenda',
    description: 'Sua central de agendamentos.',
    position: 'bottom',
  },
  {
    selector: '.google-calendar-wrapper',
    title: 'Google Calendar',
    description: 'Integre com o Google Calendar para sincronizar seus eventos.',
    position: 'bottom',
  },
  {
    selector: '.agenda-actions .btn-primary',
    title: 'Nova Consulta',
    description: 'Agende uma nova consulta diretamente pela agenda.',
    position: 'bottom',
  },
  {
    selector: '.calendar-section',
    title: 'Calendario',
    description: 'Navegue pelos dias para ver os agendamentos.',
    position: 'right',
  },
  {
    selector: '[data-tutorial="selecione-data"]',
    title: 'Selecione uma Data',
    description: 'Clique em um dia para ver os detalhes.',
    position: 'left',
  },
  {
    selector: '[data-tutorial="resumo-mes"]',
    title: 'Resumo do Mes',
    description: 'Resumo com total de consultas do mes.',
    position: 'left',
  },
];

export const PACIENTES_STEPS: TutorialStep[] = [
  {
    selector: '.patients-count-badge',
    title: 'Total de Pacientes',
    description: 'Numero total de pacientes cadastrados.',
    position: 'bottom',
  },
  {
    selector: '.btn-novo-paciente',
    title: 'Novo Paciente',
    description: 'Cadastre um novo paciente.',
    position: 'bottom',
  },
  {
    selector: '.search-container-inline',
    title: 'Buscar Paciente',
    description: 'Pesquise por nome, email ou telefone.',
    position: 'bottom',
  },
  {
    selector: '.patients-table-body',
    title: 'Lista de Pacientes',
    description: 'Todos os seus pacientes com informacoes de contato.',
    position: 'top',
  },
  {
    selector: '.action-btn-table.email',
    title: 'Enviar Email e WhatsApp',
    description: 'Envie a anamnese por email e WhatsApp.',
    position: 'left',
  },
  {
    selector: '.action-btn-table.copy',
    title: 'Copiar Link',
    description: 'Copie o link da anamnese para compartilhar.',
    position: 'left',
  },
  {
    selector: '.action-btn-table.details',
    title: 'Ver Detalhes',
    description: 'Acesse o perfil completo e metricas do paciente.',
    position: 'left',
  },
  {
    selector: '.action-btn-table.user-manage',
    title: 'Gerenciar Acesso',
    description: 'Gerencie o acesso do paciente a plataforma.',
    position: 'left',
  },
  {
    selector: '.action-btn-table.edit',
    title: 'Editar Paciente',
    description: 'Edite os dados cadastrais do paciente.',
    position: 'left',
  },
  {
    selector: '.action-btn-table.delete',
    title: 'Excluir Paciente',
    description: 'Remova o paciente do sistema.',
    position: 'left',
  },
];

export const NOVA_CONSULTA_STEPS: TutorialStep[] = [
  {
    selector: '.consultation-cards-container .consultation-card:nth-child(1)',
    title: 'Selecionar Paciente',
    description: 'Escolha o paciente e defina se é uma consulta nova ou retorno.',
    position: 'bottom',
  },
  {
    selector: '.consultation-cards-container .consultation-card:nth-child(2)',
    title: 'Tipo de Atendimento',
    description: 'Selecione entre consulta presencial ou telemedicina, e escolha entre iniciar agora ou agendar.',
    position: 'bottom',
  },
  {
    selector: '.consultation-cards-container .consultation-card:nth-child(3)',
    title: 'Configuração e Início',
    description: 'Configure o microfone (presencial) ou data/horário (agendamento) e crie a consulta.',
    position: 'bottom',
  },
];

export const CONFIGURACOES_STEPS: TutorialStep[] = [
  {
    selector: '.configuracoes-header',
    title: 'Configurações',
    description: 'Gerencie suas configurações pessoais e da clínica.',
    position: 'bottom',
  },
  {
    selector: '[data-tutorial="info-pessoais"]',
    title: 'Informações Pessoais',
    description: 'Atualize seu nome, email, telefone, CPF, foto de perfil e data de nascimento.',
    position: 'bottom',
  },
  {
    selector: '[data-tutorial="logo-upload"]',
    title: 'Logo para Documentos',
    description: 'Adicione a logo da sua clínica que aparecerá nas receitas e prescrições geradas.',
    position: 'bottom',
  },
  {
    selector: '[data-tutorial="info-profissionais"]',
    title: 'Informações Profissionais',
    description: 'Preencha sua especialidade, CRM, endereço e dados da clínica.',
    position: 'bottom',
  },
  {
    selector: '[data-tutorial="whatsapp-conexao"]',
    title: 'Conexão WhatsApp',
    description: 'Conecte seu WhatsApp para enviar lembretes e mensagens diretamente aos pacientes.',
    position: 'top',
  },
];

export const CADASTRO_STEPS: TutorialStep[] = [
  {
    selector: '.cadastro-header',
    title: 'Cadastro',
    description: 'Gerencie todos os cadastros da sua clinica: pacientes, alimentos, refeicoes, treinos e prescricoes.',
    position: 'bottom',
  },
  {
    selector: '.cadastro-tabs',
    title: 'Abas de Cadastro',
    description: 'Navegue entre as categorias: Pacientes, Alimentos, Refeicoes, Treinos e Prescricoes.',
    position: 'bottom',
  },
  {
    selector: '.cadastro-section-header',
    title: 'Acoes',
    description: 'Adicione novos itens e pesquise nos cadastros existentes.',
    position: 'bottom',
  },
  {
    selector: '.cadastro-grid',
    title: 'Lista de Itens',
    description: 'Visualize, edite, favorite ou exclua os itens cadastrados.',
    position: 'top',
  },
];
