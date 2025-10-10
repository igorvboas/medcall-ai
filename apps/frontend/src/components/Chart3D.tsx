'use client';

import React, { useEffect, useRef, useState } from 'react';
import Chart3DFallback from './Chart3DFallback';

interface Chart3DProps {
  data?: {
    presencial: number[];
    telemedicina: number[];
    labels: string[];
  };
}

const Chart3D: React.FC<Chart3DProps> = ({ data }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [Plotly, setPlotly] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  // Dados padrão se não fornecidos
  const defaultData = {
    presencial: [120, 80, 60, 70, 65, 75, 85, 90, 95],
    telemedicina: [140, 110, 90, 100, 95, 105, 115, 120, 125],
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  };

  const chartData = data || defaultData;

  // Carregar Plotly apenas no cliente
  useEffect(() => {
    setIsClient(true);
    
    const loadPlotly = async () => {
      try {
        const plotlyModule = await import('plotly.js-basic-dist');
        setPlotly(plotlyModule.default);
      } catch (error) {
        console.error('Erro ao carregar Plotly:', error);
        setHasError(true);
      }
    };

    loadPlotly();
  }, []);

  // Função para criar o gráfico
  const createChart = () => {
    if (!plotRef.current || !isClient || !Plotly) return;

    // Detectar tema atual
    const isDarkMode = document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#ffffff' : '#1a1a1a';
    const legendColor = isDarkMode ? '#cccccc' : '#666666';
    const gridColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    const zeroLineColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

    // Criar dados para o gráfico
    const trace1 = {
      x: chartData.labels,
      y: chartData.presencial,
      mode: 'lines+markers',
      type: 'scatter',
      name: 'Presencial',
      line: {
        color: '#8b5cf6',
        width: 3
      },
      marker: {
        color: '#8b5cf6',
        size: 8,
        line: {
          color: '#ffffff',
          width: 1
        }
      },
      hovertemplate: '<b>Presencial</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: '#8b5cf6',
        bordercolor: '#a855f7',
        font: { color: chartTextColor, family: 'Inter' }
      }
    };

    const trace2 = {
      x: chartData.labels,
      y: chartData.telemedicina,
      mode: 'lines+markers',
      type: 'scatter',
      name: 'Telemedicina',
      line: {
        color: '#3b82f6',
        width: 3,
        dash: 'dash'
      },
      marker: {
        color: '#3b82f6',
        size: 8,
        line: {
          color: '#ffffff',
          width: 1
        }
      },
      hovertemplate: '<b>Telemedicina</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: '#3b82f6',
        bordercolor: '#60a5fa',
        font: { color: chartTextColor, family: 'Inter' }
      }
    };

    const layout = {
      title: {
        text: '',
        font: { color: chartTextColor }
      },
      xaxis: {
        title: {
          text: 'Período',
          font: { color: legendColor, size: 12 }
        },
        tickfont: { color: legendColor, size: 10 },
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        showgrid: true,
        zeroline: true
      },
      yaxis: {
        title: {
          text: 'Atendimentos',
          font: { color: legendColor, size: 12 }
        },
        tickfont: { color: legendColor, size: 10 },
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        showgrid: true,
        zeroline: true
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: chartTextColor, family: 'Inter, sans-serif' },
      legend: {
        font: { color: legendColor },
        bgcolor: 'rgba(0,0,0,0)',
        x: 0,
        y: 1,
        orientation: 'h'
      },
      margin: { l: 50, r: 30, t: 20, b: 40 },
      showlegend: false,
      hovermode: 'closest'
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      staticPlot: false
    };

    Plotly.newPlot(plotRef.current, [trace1, trace2], layout, config);
  };

  // Criar gráfico inicial
  useEffect(() => {
    createChart();
    
    // Cleanup
    return () => {
      if (plotRef.current && Plotly) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [chartData, isClient, Plotly]);

  // Detectar mudanças de tema e recriar gráfico
  useEffect(() => {
    if (!isClient) return;

    const observer = new MutationObserver(() => {
      // Recriar gráfico quando o tema mudar
      setTimeout(() => {
        createChart();
      }, 100);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [isClient, Plotly, chartData]);

  // Usar fallback se houver erro ou não conseguir carregar Plotly
  if (hasError || (!isClient || !Plotly)) {
    if (hasError) {
      return <Chart3DFallback data={data} />;
    }
    
    return (
      <div className="chart-3d-container">
        <div style={{ 
          width: '100%', 
          height: '200px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#888',
          fontSize: '14px'
        }}>
          Carregando gráfico...
        </div>
      </div>
    );
  }

  return (
    <div className="chart-3d-container">
      <div ref={plotRef} style={{ width: '100%', height: '200px' }} />
    </div>
  );
};

export default Chart3D;