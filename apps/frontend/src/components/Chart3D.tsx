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

    // Cores do design Figma
    const presencialColor = '#9770F5'; // roxo
    const telemedicinaColor = '#4387F5'; // azul
    const gridColorHorizontal = '#F7F7F7';
    const gridColorVertical = '#D4D4D4';
    const labelColorY = '#3E4954';
    const labelColorX = 'rgba(62, 73, 84, 0.42)'; // #3E4954 com opacidade 0.42

    // Criar dados para o gráfico
    const trace1 = {
      x: chartData.labels,
      y: chartData.presencial,
      mode: 'lines+markers',
      type: 'scatter',
      name: 'Presencial',
      line: {
        color: presencialColor,
        width: 3
      },
      marker: {
        color: presencialColor,
        size: 7,
        line: {
          color: '#ffffff',
          width: 0.5
        }
      },
      hovertemplate: '<b>Presencial</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: presencialColor,
        bordercolor: presencialColor,
        font: { color: '#ffffff', family: 'Inter' }
      }
    };

    const trace2 = {
      x: chartData.labels,
      y: chartData.telemedicina,
      mode: 'lines+markers',
      type: 'scatter',
      name: 'Telemedicina',
      line: {
        color: telemedicinaColor,
        width: 3
      },
      marker: {
        color: telemedicinaColor,
        size: 7,
        line: {
          color: '#ffffff',
          width: 0.5
        }
      },
      hovertemplate: '<b>Telemedicina</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: telemedicinaColor,
        bordercolor: telemedicinaColor,
        font: { color: '#ffffff', family: 'Inter' }
      }
    };

    const layout = {
      title: {
        text: '',
        font: { color: labelColorY }
      },
      xaxis: {
        title: {
          text: '',
          font: { color: labelColorX, size: 12 }
        },
        tickfont: { color: labelColorX, size: 14 },
        gridcolor: gridColorVertical,
        zerolinecolor: gridColorHorizontal,
        showgrid: true,
        zeroline: false,
        showline: false
      },
      yaxis: {
        title: {
          text: '',
          font: { color: labelColorY, size: 12 }
        },
        tickfont: { color: labelColorY, size: 14 },
        gridcolor: gridColorHorizontal,
        zerolinecolor: gridColorHorizontal,
        showgrid: true,
        zeroline: true,
        showline: false
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: labelColorY, family: 'Inter, sans-serif' },
      legend: {
        font: { color: labelColorY },
        bgcolor: 'rgba(0,0,0,0)',
        x: 0,
        y: 1,
        orientation: 'h'
      },
      margin: { l: 40, r: 40, t: 10, b: 70 },
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
          height: '250px', 
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
      <div ref={plotRef} style={{ width: '100%', height: '250px' }} />
    </div>
  );
};

export default Chart3D;