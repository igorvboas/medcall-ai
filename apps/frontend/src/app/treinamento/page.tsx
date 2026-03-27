'use client';

import { useState } from 'react';
import {
  PlayCircle,
  Home,
  FileText,
  MessageCircle,
  Calendar,
  Users,
  Settings,
  Video,
  Mic,
  BarChart3,
  Clock,
  BookOpen,
  ChevronRight,
  X,
} from 'lucide-react';
import './treinamento.css';

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  icon: React.ReactNode;
  videoUrl?: string;
}

const categories: { key: string; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'primeiros-passos', label: 'Primeiros Passos' },
  { key: 'funcionalidades', label: 'Funcionalidades' },
  { key: 'consultas', label: 'Consultas' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'configuracoes', label: 'Configurações' },
];

const lessons: Lesson[] = [
  {
    id: 'intro-plataforma',
    title: 'Introdução à Plataforma',
    description:
      'Conheça a plataforma completa, entenda como navegar e descubra todas as funcionalidades disponíveis para otimizar seu atendimento.',
    duration: '5:30',
    category: 'primeiros-passos',
    icon: <Home size={48} />,
  },
  {
    id: 'dashboard-visao-geral',
    title: 'Dashboard — Visão Geral',
    description:
      'Aprenda a interpretar os dados do dashboard, acompanhe métricas importantes e tenha uma visão completa da sua clínica em tempo real.',
    duration: '7:15',
    category: 'primeiros-passos',
    icon: <BarChart3 size={48} />,
  },
  {
    id: 'func-home',
    title: 'Funcionalidade: Home',
    description:
      'Explore a tela inicial da plataforma, atalhos rápidos e como personalizar sua experiência no dia a dia.',
    duration: '6:00',
    category: 'funcionalidades',
    icon: <Home size={48} />,
  },
  {
    id: 'func-nova-consulta',
    title: 'Funcionalidade: Nova Consulta',
    description:
      'Veja como iniciar uma nova consulta de forma rápida e eficiente, preenchendo todos os campos necessários.',
    duration: '5:15',
    category: 'funcionalidades',
    icon: <FileText size={48} />,
  },
  {
    id: 'func-consultas',
    title: 'Funcionalidade: Consultas',
    description:
      'Gerencie todas as suas consultas em um só lugar — filtre, pesquise e acompanhe o histórico completo.',
    duration: '5:30',
    category: 'funcionalidades',
    icon: <MessageCircle size={48} />,
  },
  {
    id: 'func-agenda',
    title: 'Funcionalidade: Agenda',
    description:
      'Domine a agenda integrada: crie, edite e organize seus agendamentos de forma prática e visual.',
    duration: '5:45',
    category: 'funcionalidades',
    icon: <Calendar size={48} />,
  },
  {
    id: 'func-pacientes',
    title: 'Funcionalidade: Pacientes',
    description:
      'Cadastre e gerencie seus pacientes com facilidade, acesse prontuários e mantenha tudo organizado.',
    duration: '6:20',
    category: 'funcionalidades',
    icon: <Users size={48} />,
  },
  {
    id: 'func-configuracoes',
    title: 'Funcionalidade: Configurações',
    description:
      'Personalize a plataforma de acordo com suas necessidades — perfil, notificações e preferências gerais.',
    duration: '4:00',
    category: 'funcionalidades',
    icon: <Settings size={48} />,
  },
  {
    id: 'func-treinamento',
    title: 'Funcionalidade: Treinamento',
    description:
      'Saiba como acessar e aproveitar ao máximo a área de treinamento e videoaulas da plataforma.',
    duration: '3:00',
    category: 'funcionalidades',
    icon: <BookOpen size={48} />,
  },
  {
    id: 'nova-consulta',
    title: 'Nova Consulta — Passo a Passo',
    description:
      'Acompanhe o fluxo completo de criação de uma consulta, desde a seleção do paciente até a finalização.',
    duration: '6:45',
    category: 'consultas',
    icon: <FileText size={48} />,
  },
  {
    id: 'consulta-telemedicina',
    title: 'Consulta por Telemedicina',
    description:
      'Aprenda a realizar consultas online com vídeo integrado, compartilhamento de tela e gravação de sessão.',
    duration: '8:20',
    category: 'consultas',
    icon: <Video size={48} />,
  },
  {
    id: 'consulta-presencial',
    title: 'Consulta Presencial',
    description:
      'Veja como registrar consultas presenciais, utilizar gravação de áudio e preencher todos os campos clínicos.',
    duration: '6:10',
    category: 'consultas',
    icon: <Mic size={48} />,
  },
  {
    id: 'lista-consultas',
    title: 'Lista de Consultas',
    description:
      'Navegue pela lista de consultas realizadas, aplique filtros avançados e exporte relatórios quando necessário.',
    duration: '5:00',
    category: 'consultas',
    icon: <MessageCircle size={48} />,
  },
  {
    id: 'agenda',
    title: 'Gestão da Agenda',
    description:
      'Organize sua agenda de atendimentos, configure horários disponíveis e evite conflitos de agendamento.',
    duration: '6:30',
    category: 'gestao',
    icon: <Calendar size={48} />,
  },
  {
    id: 'pacientes',
    title: 'Gestão de Pacientes',
    description:
      'Administre sua base de pacientes, atualize cadastros e acesse o histórico completo de atendimentos.',
    duration: '7:00',
    category: 'gestao',
    icon: <Users size={48} />,
  },
  {
    id: 'historico-sessoes',
    title: 'Histórico de Sessões',
    description:
      'Revise o histórico de todas as sessões realizadas, acompanhe a evolução dos pacientes e gere relatórios.',
    duration: '4:45',
    category: 'gestao',
    icon: <Clock size={48} />,
  },
  {
    id: 'configuracoes',
    title: 'Configurações Gerais',
    description:
      'Ajuste todas as configurações da plataforma — dados do perfil, integrações, segurança e preferências.',
    duration: '4:00',
    category: 'configuracoes',
    icon: <Settings size={48} />,
  },
];

export default function TreinamentoPage() {
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [selectedVideo, setSelectedVideo] = useState<Lesson | null>(null);

  const filteredLessons =
    selectedCategory === 'todos'
      ? lessons
      : lessons.filter((l) => l.category === selectedCategory);

  const uniqueCategories = new Set(lessons.map((l) => l.category));

  return (
    <div className="treinamento-container">
      {/* Header */}
      <div className="treinamento-header">
        <h1 className="treinamento-title">Treinamento</h1>
        <p className="treinamento-subtitle">
          Videoaulas completas para você dominar todas as funcionalidades da plataforma.
        </p>
      </div>

      {/* Stats */}
      <div className="treinamento-stats">
        <div className="treinamento-stat">
          <span className="treinamento-stat-value">{lessons.length}</span>
          <span className="treinamento-stat-label">Aulas disponíveis</span>
        </div>
        <div className="treinamento-stat">
          <span className="treinamento-stat-value">{uniqueCategories.size}</span>
          <span className="treinamento-stat-label">Categorias</span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="treinamento-filters">
        {categories.map((cat) => (
          <button
            key={cat.key}
            className={`treinamento-filter-btn ${selectedCategory === cat.key ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="treinamento-cards">
        {filteredLessons.map((lesson) => {
          const categoryLabel =
            categories.find((c) => c.key === lesson.category)?.label ?? lesson.category;

          return (
            <div
              key={lesson.id}
              className="treinamento-card"
              onClick={() => setSelectedVideo(lesson)}
            >
              {/* Thumbnail */}
              <div className="treinamento-thumb">
                <span className="treinamento-thumb-icon">{lesson.icon}</span>
                <PlayCircle size={56} className="treinamento-play-icon" />
                <span className="treinamento-duration">{lesson.duration}</span>
              </div>

              {/* Body */}
              <div className="treinamento-body">
                <span className="treinamento-tag">{categoryLabel}</span>
                <h3 className="treinamento-card-title">{lesson.title}</h3>
                <p className="treinamento-card-desc">{lesson.description}</p>
                <button
                  className="treinamento-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVideo(lesson);
                  }}
                >
                  Assistir Aula
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="treinamento-modal-overlay" onClick={() => setSelectedVideo(null)}>
          <div className="treinamento-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="treinamento-modal-header">
              <div className="treinamento-modal-info">
                <span className="treinamento-modal-icon">{selectedVideo.icon}</span>
                <div>
                  <h2 className="treinamento-modal-title">{selectedVideo.title}</h2>
                  <p className="treinamento-modal-desc">{selectedVideo.description}</p>
                </div>
              </div>
              <button
                className="treinamento-modal-close"
                onClick={() => setSelectedVideo(null)}
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Area */}
            <div className="treinamento-modal-video">
              {selectedVideo.videoUrl ? (
                <iframe
                  src={selectedVideo.videoUrl}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="treinamento-modal-placeholder">
                  <div className="treinamento-placeholder-content">
                    <Video size={48} />
                    <span>Vídeo em breve</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
