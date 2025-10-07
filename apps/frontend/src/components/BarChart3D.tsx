'use client';

import React, { useEffect, useRef, useState } from 'react';
import SimpleBarChart from '@/components/SimpleBarChart';

interface BarChart3DProps {
  data: {
    labels: string[];
    values: number[];
    colors: string[];
  };
  useCSS3D?: boolean;
}

const BarChart3D: React.FC<BarChart3DProps> = ({ data, useCSS3D = false }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [Plotly, setPlotly] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const loadPlotly = async () => {
      try {
        const PlotlyModule = await import('plotly.js-basic-dist');
        setPlotly(PlotlyModule.default);
      } catch (error) {
        console.error('Erro ao carregar Plotly:', error);
        setHasError(true);
      }
    };

    loadPlotly();
  }, [isClient]);

  useEffect(() => {
    if (!Plotly || !plotRef.current || !isClient) return;

    // Criar gráfico de barras tradicional com efeito 3D usando scatter3d
    const trace = {
      x: data.labels,
      y: data.values,
      z: data.labels.map(() => 0), // Z fixo para efeito 3D sutil
      type: 'scatter3d',
      mode: 'markers',
      marker: {
        size: data.values.map(val => Math.max(8, (val / Math.max(...data.values)) * 25)), // Tamanho proporcional
        color: data.colors,
        opacity: 0.9,
        symbol: 'square',
        line: {
          color: 'rgba(255,255,255,0.4)',
          width: 2
        }
      },
      hovertemplate: '<b>%{x}</b><br>Atendimentos: %{y}<extra></extra>',
      hoverlabel: {
        bgcolor: 'rgba(0,0,0,0.8)',
        bordercolor: 'rgba(255,255,255,0.2)',
        font: { color: '#fff', family: 'Inter, sans-serif' }
      }
    };
    
    // Adicionar linhas verticais para simular barras tradicionais
    const barLines = data.labels.map((label, index) => ({
      type: 'scatter3d',
      mode: 'lines',
      x: [label, label],
      y: [0, data.values[index]],
      z: [0, 0],
      line: {
        color: data.colors[index],
        width: 8
      },
      showlegend: false,
      hoverinfo: 'skip'
    }));
    
    const traces = [trace, ...barLines];

    const layout = {
      title: {
        text: '',
        font: { color: '#fff' }
      },
      scene: {
        xaxis: {
          title: 'Dias da Semana',
          titlefont: { color: '#888', size: 12 },
          tickfont: { color: '#888', size: 10 },
          gridcolor: 'rgba(255,255,255,0.08)',
          zerolinecolor: 'rgba(255,255,255,0.15)',
          showspikes: false,
          range: [-0.5, data.labels.length - 0.5],
          tickvals: data.labels.map((_, index) => index),
          ticktext: data.labels
        },
        yaxis: {
          title: 'Atendimentos',
          titlefont: { color: '#888', size: 12 },
          tickfont: { color: '#888', size: 10 },
          gridcolor: 'rgba(255,255,255,0.08)',
          zerolinecolor: 'rgba(255,255,255,0.15)',
          showspikes: false,
          range: [0, Math.max(...data.values) * 1.2]
        },
        zaxis: {
          title: '',
          showticklabels: false,
          showgrid: false,
          zeroline: false,
          range: [-0.5, 0.5],
          showspikes: false
        },
        bgcolor: 'rgba(18,19,22,0.8)',
        camera: {
          eye: { x: 1.8, y: 1.8, z: 0.5 }, /* Câmera mais afastada para visão tradicional */
          center: { x: 0, y: 0, z: 0 }
        },
        aspectmode: 'manual',
        aspectratio: { x: 2.5, y: 1.5, z: 0.2 } /* Proporção mais achatada */
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#fff', family: 'Inter, sans-serif' },
      margin: { l: 10, r: 10, t: 10, b: 15 },
      showlegend: false,
      hovermode: 'closest'
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      staticPlot: false
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      // Animação de entrada suave
      if (plotRef.current) {
        const update = {
          'scene.camera.eye': { x: 1.8, y: 1.8, z: 0.5 }
        };
        
        Plotly.relayout(plotRef.current, update);
        
        // Adicionar interação de rotação automática sutil
        let angle = 0;
        const rotateInterval = setInterval(() => {
          if (!plotRef.current) {
            clearInterval(rotateInterval);
            return;
          }
          
          angle += 0.3;
          const x = 1.8 * Math.cos(angle * Math.PI / 180);
          const y = 1.8 * Math.sin(angle * Math.PI / 180);
          
          Plotly.relayout(plotRef.current, {
            'scene.camera.eye': { x, y, z: 0.5 }
          });
          
          // Parar após uma rotação completa
          if (angle >= 360) {
            clearInterval(rotateInterval);
            // Voltar à posição original
            Plotly.relayout(plotRef.current, {
              'scene.camera.eye': { x: 1.8, y: 1.8, z: 0.5 }
            });
          }
        }, 60);
        
        // Limpar intervalo após 20 segundos
        setTimeout(() => clearInterval(rotateInterval), 20000);
      }
    });

    // Cleanup
    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [data, isClient, Plotly]);

  // Usar gráfico simples por padrão (mais limpo e confiável)
  return <SimpleBarChart data={data} />;
};

export default BarChart3D;
