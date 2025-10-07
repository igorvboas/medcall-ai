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

  useEffect(() => {
    if (!plotRef.current || !isClient || !Plotly) return;

    // Criar dados para o gráfico 3D
    const trace1 = {
      x: chartData.labels,
      y: chartData.presencial,
      z: chartData.labels.map((_, i) => i * 0.05), // Pequena profundidade Z
      mode: 'lines+markers',
      type: 'scatter3d',
      name: 'Presencial',
      line: {
        color: '#8b5cf6',
        width: 8
      },
      marker: {
        color: '#8b5cf6',
        size: 10,
        symbol: 'circle',
        line: {
          color: '#a855f7',
          width: 2
        }
      },
      hovertemplate: '<b>Presencial</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: '#8b5cf6',
        bordercolor: '#a855f7',
        font: { color: 'white', family: 'Inter' }
      }
    };

    const trace2 = {
      x: chartData.labels,
      y: chartData.telemedicina,
      z: chartData.labels.map((_, i) => i * 0.05 + 0.1), // Ligeiramente atrás
      mode: 'lines+markers',
      type: 'scatter3d',
      name: 'Telemedicina',
      line: {
        color: '#3b82f6',
        width: 8,
        dash: 'dash'
      },
      marker: {
        color: '#3b82f6',
        size: 10,
        symbol: 'circle',
        line: {
          color: '#60a5fa',
          width: 2
        }
      },
      hovertemplate: '<b>Telemedicina</b><br>' +
                     'Período: %{x}<br>' +
                     'Atendimentos: %{y}<br>' +
                     '<extra></extra>',
      hoverlabel: {
        bgcolor: '#3b82f6',
        bordercolor: '#60a5fa',
        font: { color: 'white', family: 'Inter' }
      }
    };

    const layout = {
      title: {
        text: '',
        font: { color: '#fff' }
      },
      scene: {
        xaxis: {
          title: 'Período',
          titlefont: { color: '#888', size: 12 },
          tickfont: { color: '#888', size: 10 },
          gridcolor: 'rgba(255,255,255,0.08)',
          zerolinecolor: 'rgba(255,255,255,0.15)',
          showspikes: false,
          range: [-0.5, 8.5] /* Margem extra para evitar cortes */
        },
        yaxis: {
          title: 'Atendimentos',
          titlefont: { color: '#888', size: 12 },
          tickfont: { color: '#888', size: 10 },
          gridcolor: 'rgba(255,255,255,0.08)',
          zerolinecolor: 'rgba(255,255,255,0.15)',
          showspikes: false,
          range: [280, 620] /* Margem extra para evitar cortes */
        },
        zaxis: {
          title: '',
          showticklabels: false,
          showgrid: false,
          zeroline: false,
          range: [0, 1],
          showspikes: false
        },
        bgcolor: 'rgba(18,19,22,0.8)',
        camera: {
          eye: { x: 1.3, y: 1.3, z: 0.8 }, /* Câmera otimizada para 180px */
          center: { x: 0, y: 0, z: 0 }
        },
        aspectmode: 'manual',
        aspectratio: { x: 1.8, y: 1, z: 0.2 } /* Proporção ainda mais compacta para 180px */
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#fff', family: 'Inter, sans-serif' },
      legend: {
        font: { color: '#aaa' },
        bgcolor: 'rgba(0,0,0,0)',
        x: 0,
        y: 1
      },
      margin: { l: 35, r: 35, t: 10, b: 20 }, /* Margens otimizadas para 180px */
      showlegend: false,
      hovermode: 'closest'
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      staticPlot: false,
      scrollZoom: false,
      doubleClick: false,
      showTips: false,
      displaylogo: false
    };

    Plotly.newPlot(plotRef.current, [trace1, trace2], layout, config).then(() => {
      // Animação de entrada suave
      if (plotRef.current) {
        const update = {
          'scene.camera.eye': { x: 1.3, y: 1.3, z: 0.8 }
        };
        
        Plotly.relayout(plotRef.current, update);
        
        // Adicionar interação de rotação automática sutil
        let angle = 0;
        const rotateInterval = setInterval(() => {
          if (!plotRef.current) {
            clearInterval(rotateInterval);
            return;
          }
          
          angle += 0.5;
          const x = 1.3 * Math.cos(angle * Math.PI / 180);
          const y = 1.3 * Math.sin(angle * Math.PI / 180);
          
          Plotly.relayout(plotRef.current, {
            'scene.camera.eye': { x, y, z: 0.8 }
          });
          
          // Parar após uma rotação completa
          if (angle >= 360) {
            clearInterval(rotateInterval);
            // Voltar à posição original
            Plotly.relayout(plotRef.current, {
              'scene.camera.eye': { x: 1.3, y: 1.3, z: 0.8 }
            });
          }
        }, 50);
        
        // Limpar intervalo após 20 segundos
        setTimeout(() => clearInterval(rotateInterval), 20000);
      }
    });

    // Cleanup
    return () => {
      if (plotRef.current && Plotly) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [chartData, isClient, Plotly]);

  // Usar fallback se houver erro ou não conseguir carregar Plotly
  if (hasError || (!isClient || !Plotly)) {
    if (hasError) {
      return <Chart3DFallback data={data} />;
    }
    
    return (
      <div className="chart-3d-container">
        <div style={{ 
          width: '100%', 
          height: '180px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#888',
          fontSize: '14px'
        }}>
          Carregando gráfico 3D...
        </div>
      </div>
    );
  }

  return (
    <div className="chart-3d-container">
      <div ref={plotRef} style={{ width: '100%', height: '180px' }} />
    </div>
  );
};

export default Chart3D;
