'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Users, Plus } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import './ConsultationStatusChart.css';

interface StatusData {
  created: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

interface MetricData {
  label: string;
  value: number;
  change: number;
  isPositive: boolean;
}

interface ConsultationStatusChartProps {
  data?: StatusData;
  metrics?: MetricData[];
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

const defaultData: StatusData = {
  created: 8,
  inProgress: 5,
  completed: 12,
  cancelled: 2
};

const defaultMetrics: MetricData[] = [
  { label: 'Consultas Criadas', value: 25, change: 5, isPositive: true },
  { label: 'Novos Pacientes', value: 30, change: 50, isPositive: true }
];

const periods = [
  { value: '7d', label: '📅 Últimos 7 dias' },
  { value: '15d', label: '📅 Últimos 15 dias' },
  { value: '30d', label: '📅 Últimos 30 dias' }
];

export function ConsultationStatusChart({ 
  data = defaultData, 
  metrics = defaultMetrics,
  selectedPeriod = '7d',
  onPeriodChange 
}: ConsultationStatusChartProps) {
  const [animationProgress, setAnimationProgress] = useState(0);

  const total = data.created + data.inProgress + data.completed + data.cancelled;
  
  // Calcular percentuais
  const percentages = {
    created: total > 0 ? (data.created / total) * 100 : 0,
    inProgress: total > 0 ? (data.inProgress / total) * 100 : 0,
    completed: total > 0 ? (data.completed / total) * 100 : 0,
    cancelled: total > 0 ? (data.cancelled / total) * 100 : 0
  };

  // Calcular ângulos para o gráfico de pizza
  const angles = {
    created: (percentages.created / 100) * 360,
    inProgress: (percentages.inProgress / 100) * 360,
    completed: (percentages.completed / 100) * 360,
    cancelled: (percentages.cancelled / 100) * 360
  };

  // Animação de entrada
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationProgress(1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Gerar gradiente do gráfico de pizza
  const generatePieGradient = () => {
    let currentAngle = 0;
    const segments = [];

    if (data.created > 0) {
      segments.push(`#ffa447 ${currentAngle}deg ${currentAngle + angles.created}deg`);
      currentAngle += angles.created;
    }
    
    if (data.inProgress > 0) {
      segments.push(`#4fa2ff ${currentAngle}deg ${currentAngle + angles.inProgress}deg`);
      currentAngle += angles.inProgress;
    }
    
    if (data.completed > 0) {
      segments.push(`#65f6b1 ${currentAngle}deg ${currentAngle + angles.completed}deg`);
      currentAngle += angles.completed;
    }
    
    if (data.cancelled > 0) {
      segments.push(`#ef4444 ${currentAngle}deg ${currentAngle + angles.cancelled}deg`);
    }

    return `conic-gradient(${segments.join(', ')})`;
  };

  return (
    <div className="consultation-status-chart">
      {/* Header */}
      <div className="chart-header">
        <h3 className="chart-title">Status de Consultas</h3>
      </div>

      {/* Gráfico com Legenda ao Lado */}
      <div className="chart-with-legend">
        <div 
          className="enhanced-pie-chart"
          style={{
            background: generatePieGradient(),
            transform: `scale(${0.8 + (animationProgress * 0.2)})`
          }}
        >
          <div className="pie-center"></div>
        </div>

        {/* Legenda ao Lado */}
        <div className="side-legend">
          <div className="legend-item-simple">
            <span className="legend-dot legend-created"></span>
            <span className="legend-label">Criadas</span>
          </div>
          
          <div className="legend-item-simple">
            <span className="legend-dot legend-progress"></span>
            <span className="legend-label">Em Andamento</span>
          </div>
          
          <div className="legend-item-simple">
            <span className="legend-dot legend-completed"></span>
            <span className="legend-label">Concluídas</span>
          </div>
          
          <div className="legend-item-simple">
            <span className="legend-dot legend-cancelled"></span>
            <span className="legend-label">Canceladas</span>
          </div>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="period-selector">
        <select 
          value={selectedPeriod}
          onChange={(e) => onPeriodChange?.(e.target.value)}
          className="period-select"
        >
          {periods.map(period => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {/* Métricas Melhoradas */}
      <div className="enhanced-metrics">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-card">
            <div className="metric-header">
              <span className="metric-label">{metric.label}</span>
              {metric.isPositive ? (
                <TrendingUp className="metric-trend positive" size={16} />
              ) : (
                <TrendingDown className="metric-trend negative" size={16} />
              )}
            </div>
            <div className="metric-content">
              <span className="metric-value">{metric.value}</span>
              <span className={`metric-change ${metric.isPositive ? 'positive' : 'negative'}`}>
                {metric.isPositive ? '+' : ''}{metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
