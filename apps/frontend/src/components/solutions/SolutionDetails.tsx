'use client';

import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Share,
  Dna,
  Brain,
  Apple,
  Pill,
  Dumbbell,
  Leaf,
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
      case 'ltb':
        return {
          title: 'Limpeza Total do Bioma (LTB)',
          icon: <Dna className="w-8 h-8" />,
          description: 'Protocolo completo de desintoxicação e limpeza biológica'
        };
      case 'mentalidade':
        return {
          title: 'Mentalidade do Paciente',
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
      case 'habitos':
        return {
          title: 'Hábitos de Vida',
          icon: <Leaf className="w-8 h-8" />,
          description: 'Transformação de estilo de vida'
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
      case 'ltb':
        return renderLTBContent(solutionData);
      case 'mentalidade':
        return renderMentalidadeContent(solutionData);
      case 'alimentacao':
        return renderAlimentacaoContent(solutionData);
      case 'suplementacao':
        return renderSuplementacaoContent(solutionData);
      case 'exercicios':
        return renderExerciciosContent(solutionData);
      case 'habitos':
        return renderHabitosContent(solutionData);
      default:
        return renderGenericContent(solutionData);
    }
  };

  const renderLTBContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Objetivo Principal</h3>
        <p>{data.objetivo_principal || 'Não especificado'}</p>
      </div>

      <div className="solution-section">
        <h3>Urgência</h3>
        <p>{data.urgencia || 'Não especificada'}</p>
      </div>

      {data.fase1_duracao && (
        <div className="solution-section">
          <h3>Fase 1 - Limpeza</h3>
          <p><strong>Duração:</strong> {data.fase1_duracao}</p>
          <p><strong>Objetivo:</strong> {data.fase1_objetivo}</p>
        </div>
      )}

      {data.fase2_duracao && (
        <div className="solution-section">
          <h3>Fase 2 - Desparasitação</h3>
          <p><strong>Duração:</strong> {data.fase2_duracao}</p>
          <p><strong>Objetivo:</strong> {data.fase2_objetivo}</p>
        </div>
      )}

      {data.fase3_duracao && (
        <div className="solution-section">
          <h3>Fase 3 - Reconstrução</h3>
          <p><strong>Duração:</strong> {data.fase3_duracao}</p>
          <p><strong>Objetivo:</strong> {data.fase3_objetivo}</p>
        </div>
      )}

      {data.cronograma_mes1_foco && (
        <div className="solution-section">
          <h3>Cronograma</h3>
          <div className="cronograma-grid">
            {data.cronograma_mes1_foco && (
              <div className="cronograma-item">
                <h4>Mês 1</h4>
                <p><strong>Foco:</strong> {data.cronograma_mes1_foco}</p>
                <p><strong>Ações:</strong> {data.cronograma_mes1_acoes}</p>
              </div>
            )}
            {data.cronograma_mes2_foco && (
              <div className="cronograma-item">
                <h4>Mês 2</h4>
                <p><strong>Foco:</strong> {data.cronograma_mes2_foco}</p>
                <p><strong>Ações:</strong> {data.cronograma_mes2_acoes}</p>
              </div>
            )}
            {data.cronograma_mes3_4_foco && (
              <div className="cronograma-item">
                <h4>Meses 3-4</h4>
                <p><strong>Foco:</strong> {data.cronograma_mes3_4_foco}</p>
                <p><strong>Ações:</strong> {data.cronograma_mes3_4_acoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

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

  const renderHabitosContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Metas por Período</h3>
        {data.mes_1_2_meta && (
          <div className="meta-item">
            <h4>Meses 1-2</h4>
            <p><strong>Foco:</strong> {data.mes_1_2_foco}</p>
            <p><strong>Meta:</strong> {data.mes_1_2_meta}</p>
            <p><strong>Mudanças Simultâneas (máx):</strong> {data.mes_1_2_mudancas_simultaneas_maximo}</p>
          </div>
        )}
        {data.mes_3_4_meta && (
          <div className="meta-item">
            <h4>Meses 3-4</h4>
            <p><strong>Foco:</strong> {data.mes_3_4_foco}</p>
            <p><strong>Meta:</strong> {data.mes_3_4_meta}</p>
          </div>
        )}
        {data.mes_5_6_meta && (
          <div className="meta-item">
            <h4>Meses 5-6</h4>
            <p><strong>Foco:</strong> {data.mes_5_6_foco}</p>
            <p><strong>Meta:</strong> {data.mes_5_6_meta}</p>
          </div>
        )}
      </div>

      {data.ritual_matinal_sequencia && (
        <div className="solution-section">
          <h3>Ritual Matinal</h3>
          <p><strong>Sequência:</strong> {data.ritual_matinal_sequencia}</p>
          <p><strong>Regra:</strong> {data.ritual_matinal_regra}</p>
        </div>
      )}

      {data.apps_recomendados && (
        <div className="solution-section">
          <h3>Recursos Recomendados</h3>
          <p><strong>Apps:</strong> {data.apps_recomendados}</p>
          {data.livros && <p><strong>Livros:</strong> {data.livros}</p>}
          {data.comunidades && <p><strong>Comunidades:</strong> {data.comunidades}</p>}
        </div>
      )}
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
