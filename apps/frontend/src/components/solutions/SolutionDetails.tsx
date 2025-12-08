'use client';

import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Share,
  Brain,
  Apple,
  Pill,
  Dumbbell,
  FileText
} from 'lucide-react';

interface SolutionDetailsProps {
  solutionId: string;
  solutionData: any;
  onBack: () => void;
}

export default function SolutionDetails({ solutionId, solutionData, onBack }: SolutionDetailsProps) {
  
  const getSolutionInfo = () => {
    switch (solutionId) {
      case 'mentalidade':
        return {
          title: 'Livro da Vida',
          icon: <Brain className="w-8 h-8" />,
          description: 'Transformação mental e emocional'
        };
      case 'alimentacao':
        return {
          title: 'Plano Alimentar',
          icon: <Apple className="w-8 h-8" />,
          description: 'Gramaturas e proporções nutricionais'
        };
      case 'suplementacao':
        return {
          title: 'Protocolo de Suplementação',
          icon: <Pill className="w-8 h-8" />,
          description: 'Suplementos e dosagens personalizadas'
        };
      case 'exercicios':
        return {
          title: 'Programa de Exercícios',
          icon: <Dumbbell className="w-8 h-8" />,
          description: 'Treinos e atividades físicas'
        };
      default:
        return {
          title: 'Solução',
          icon: <FileText className="w-8 h-8" />,
          description: 'Detalhes da solução'
        };
    }
  };

  const solutionInfo = getSolutionInfo();

  const renderSolutionContent = () => {
    if (!solutionData) {
      return (
        <div className="no-data-message">
          <p>Nenhum dado disponível para esta solução.</p>
        </div>
      );
    }

    switch (solutionId) {
      case 'mentalidade':
        return renderMentalidadeContent(solutionData);
      case 'alimentacao':
        return renderAlimentacaoContent(solutionData);
      case 'suplementacao':
        return renderSuplementacaoContent(solutionData);
      case 'exercicios':
        return renderExerciciosContent(solutionData);
      default:
        return renderGenericContent(solutionData);
    }
  };

  const renderMentalidadeContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Objetivo Principal</h3>
        <p>{data.objetivo_principal || 'Não especificado'}</p>
      </div>

      <div className="solution-section">
        <h3>Realidade do Caso</h3>
        <p>{data.realidade_caso || 'Não especificada'}</p>
      </div>

      {data.fase1_duracao && (
        <div className="solution-section">
          <h3>Fase 1 - Estabilização</h3>
          <p><strong>Duração:</strong> {data.fase1_duracao}</p>
          <p><strong>Objetivo:</strong> {data.fase1_objetivo}</p>
        </div>
      )}

      {data.psicoterapia_modalidade && (
        <div className="solution-section">
          <h3>Psicoterapia</h3>
          <p><strong>Modalidade:</strong> {data.psicoterapia_modalidade}</p>
          <p><strong>Frequência:</strong> {data.psicoterapia_frequencia}</p>
          <p><strong>Duração da Sessão:</strong> {data.psicoterapia_duracao_sessao}</p>
        </div>
      )}

      {data.cronograma_mental_12_meses && (
        <div className="solution-section">
          <h3>Cronograma de 12 Meses</h3>
          <p>{data.cronograma_mental_12_meses}</p>
        </div>
      )}
    </div>
  );

  const renderAlimentacaoContent = (data: any[]) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Plano Alimentar ({data.length} itens)</h3>
        <div className="alimentacao-grid">
          {data.map((item, index) => (
            <div key={index} className="alimentacao-item">
              <h4>{item.alimento}</h4>
              <div className="alimentacao-details">
                <p><strong>Tipo:</strong> {item.tipo_de_alimentos}</p>
                <p><strong>Proporção de Fruta:</strong> {item.proporcao_fruta}</p>
                {item.ref1_g && <p><strong>Refeição 1:</strong> {item.ref1_g}g ({item.ref1_kcal}kcal)</p>}
                {item.ref2_g && <p><strong>Refeição 2:</strong> {item.ref2_g}g ({item.ref2_kcal}kcal)</p>}
                {item.ref3_g && <p><strong>Refeição 3:</strong> {item.ref3_g}g ({item.ref3_kcal}kcal)</p>}
                {item.ref4_g && <p><strong>Refeição 4:</strong> {item.ref4_g}g ({item.ref4_kcal}kcal)</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSuplementacaoContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Objetivo Principal</h3>
        <p>{data.objetivo_principal || 'Não especificado'}</p>
      </div>

      <div className="solution-section">
        <h3>Filosofia do Protocolo</h3>
        <p><strong>Realidade:</strong> {data.filosofia_realidade}</p>
        <p><strong>Princípio:</strong> {data.filosofia_principio}</p>
        <p><strong>Duração:</strong> {data.filosofia_duracao}</p>
      </div>

      {data.protocolo_mes1_2_lista && (
        <div className="solution-section">
          <h3>Protocolo Meses 1-2</h3>
          <p><strong>Lista:</strong> {data.protocolo_mes1_2_lista}</p>
          <p><strong>Justificativa:</strong> {data.protocolo_mes1_2_justificativa}</p>
        </div>
      )}

      {data.protocolo_mes3_6_lista && (
        <div className="solution-section">
          <h3>Protocolo Meses 3-6</h3>
          <p><strong>Lista:</strong> {data.protocolo_mes3_6_lista}</p>
          <p><strong>Justificativa:</strong> {data.protocolo_mes3_6_justificativa}</p>
        </div>
      )}
    </div>
  );

  const renderExerciciosContent = (data: any[]) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Programa de Exercícios ({data.length} exercícios)</h3>
        <div className="exercicios-grid">
          {data.map((exercicio, index) => (
            <div key={index} className="exercicio-item">
              <h4>{exercicio.nome_exercicio || `Exercício ${index + 1}`}</h4>
              <div className="exercicio-details">
                <p><strong>Tipo:</strong> {exercicio.tipo_treino}</p>
                <p><strong>Grupo Muscular:</strong> {exercicio.grupo_muscular}</p>
                <p><strong>Séries:</strong> {exercicio.series}</p>
                <p><strong>Repetições:</strong> {exercicio.repeticoes}</p>
                <p><strong>Descanso:</strong> {exercicio.descanso}</p>
                {exercicio.observacoes && <p><strong>Observações:</strong> {exercicio.observacoes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGenericContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Dados da Solução</h3>
        <pre className="data-preview">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="solution-details-container">
      <div className="solution-details-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <div className="solution-title-section">
          <div className="solution-title-icon">{solutionInfo.icon}</div>
          <div>
            <h1 className="solution-title">{solutionInfo.title}</h1>
            <p className="solution-subtitle">{solutionInfo.description}</p>
          </div>
        </div>
        <div className="solution-actions">
          <button className="action-button">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="action-button">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button className="action-button">
            <Share className="w-4 h-4" />
            Compartilhar
          </button>
        </div>
      </div>

      <div className="solution-details-content">
        {renderSolutionContent()}
      </div>
    </div>
  );
}
