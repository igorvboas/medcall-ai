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
  { key: 'consultas', label: 'Consultas' },
  { key: 'analise', label: 'Análise e Diagnóstico' },
  { key: 'gestao', label: 'Gestão' },
];

const lessons: Lesson[] = [
  {
    id: 'boas-vindas',
    title: 'Boas vindas à plataforma',
    description: 'Conheça a plataforma Auton Health, entenda como ela funciona e descubra como otimizar seus atendimentos.',
    duration: '',
    category: 'primeiros-passos',
    icon: <Home size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=a383051d-1155-49bd-81d0-66d560ee5a1e',
  },
  {
    id: 'home',
    title: 'Home',
    description: 'Explore a tela inicial da plataforma, atalhos rápidos e visão geral do seu dia a dia.',
    duration: '',
    category: 'primeiros-passos',
    icon: <BarChart3 size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=64ac31ae-3355-46fd-b793-f32e0f30bc38',
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    description: 'Personalize a plataforma de acordo com suas necessidades — perfil, logo, integrações e preferências.',
    duration: '',
    category: 'primeiros-passos',
    icon: <Settings size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=768c5ec4-96d0-416d-9ddd-9f1c20936056',
  },
  {
    id: 'cadastrar-pacientes',
    title: 'Como cadastrar e gerenciar seus pacientes',
    description: 'Cadastre e gerencie seus pacientes com facilidade, acesse prontuários e mantenha tudo organizado.',
    duration: '',
    category: 'gestao',
    icon: <Users size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=373a51cc-5775-4b5d-ac8b-66229822a978',
  },
  {
    id: 'consulta-online',
    title: 'Como criar uma consulta online',
    description: 'Aprenda a realizar consultas online com vídeo integrado, gravação de sessão e transcrição automática.',
    duration: '',
    category: 'consultas',
    icon: <Video size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=904afd55-a7ec-4d45-bd99-dd5a3a0941e8',
  },
  {
    id: 'consulta-presencial',
    title: 'Como criar uma consulta presencial',
    description: 'Veja como registrar consultas presenciais, utilizar gravação de áudio e captura com microfone.',
    duration: '',
    category: 'consultas',
    icon: <Mic size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=c8d3e79a-fa82-443a-8a40-114ae7d89d37',
  },
  {
    id: 'analise-consultas',
    title: 'Análise de consultas',
    description: 'Entenda como acessar e interpretar a análise completa gerada após cada consulta.',
    duration: '',
    category: 'analise',
    icon: <FileText size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=57f89471-a9e7-41b1-89a4-a256a4b14d19',
  },
  {
    id: 'diagnostico',
    title: 'Diagnóstico',
    description: 'Aprenda a navegar pelo diagnóstico integrado e entender os dados gerados pela IA.',
    duration: '',
    category: 'analise',
    icon: <MessageCircle size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=1ace1754-f060-42ca-a47b-86112b28df65',
  },
  {
    id: 'cadastro',
    title: 'Cadastro',
    description: 'Aprenda a cadastrar alimentos, refeições, treinos e prescrições para usar nos protocolos.',
    duration: '',
    category: 'gestao',
    icon: <BookOpen size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=4989a010-2833-43ea-96ec-4f03c8dadae6',
  },
  {
    id: 'anexar-exames',
    title: 'Como e quando anexar os exames',
    description: 'Saiba como e em qual momento anexar exames do paciente para enriquecer a análise da consulta.',
    duration: '',
    category: 'consultas',
    icon: <FileText size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=b06043a7-41cd-4df1-8324-5f7fbc31b88a',
  },
  {
    id: 'evolucao-paciente',
    title: 'Como acompanhar a evolução do paciente',
    description: 'Acompanhe a evolução dos seus pacientes com métricas, gráficos e histórico de consultas.',
    duration: '',
    category: 'gestao',
    icon: <Clock size={48} />,
    videoUrl: 'https://player-vz-b0562e45-7aa.tv.pandavideo.com.br/embed/?v=1d0267af-983f-4425-866f-6550d2942eb5',
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
                {lesson.duration && <span className="treinamento-duration">{lesson.duration}</span>}
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
