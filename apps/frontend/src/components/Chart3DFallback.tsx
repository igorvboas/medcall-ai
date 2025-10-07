'use client';

import React from 'react';

interface Chart3DFallbackProps {
  data?: {
    presencial: number[];
    telemedicina: number[];
    labels: string[];
  };
}

const Chart3DFallback: React.FC<Chart3DFallbackProps> = ({ data }) => {
  // Dados padrão se não fornecidos
  const defaultData = {
    presencial: [480, 520, 540, 530, 535, 525, 515, 510, 505],
    telemedicina: [360, 390, 410, 400, 405, 395, 385, 380, 375],
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']
  };

  const chartData = data || defaultData;
  const maxValue = Math.max(...chartData.presencial, ...chartData.telemedicina);

  return (
    <div className="chart-3d-fallback">
      <svg width="100%" height="220" viewBox="0 0 400 220" className="fallback-svg">
        <defs>
          {/* Gradientes 3D para as linhas */}
          <linearGradient id="presencialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="1"/>
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.7"/>
          </linearGradient>
          
          <linearGradient id="telemedicinaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="1"/>
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.7"/>
          </linearGradient>

          {/* Filtros para efeitos 3D */}
          <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="shadowEffect" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3"/>
          </filter>

          {/* Grade sutil */}
          <pattern id="gridPattern" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Fundo da grade */}
        <rect width="100%" height="100%" fill="url(#gridPattern)" />
        
        {/* Eixos */}
        <line x1="50" y1="25" x2="50" y2="180" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <line x1="50" y1="180" x2="370" y2="180" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        
        {/* Labels dos eixos Y */}
        <text x="35" y="30" fill="#666" fontSize="11">{maxValue}</text>
        <text x="35" y="105" fill="#666" fontSize="11">{Math.round(maxValue/2)}</text>
        <text x="35" y="180" fill="#666" fontSize="11">0</text>
        
        {/* Sombras das linhas (efeito 3D) */}
        <g opacity="0.3" transform="translate(2,3)">
          <path 
            d={`M ${chartData.labels.map((_, i) => {
              const x = 60 + (i * 32);
              const y = 180 - ((chartData.presencial[i] / maxValue) * 145);
              return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
            }).join(' ')}`}
            fill="none" 
            stroke="#8b5cf6" 
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path 
            d={`M ${chartData.labels.map((_, i) => {
              const x = 60 + (i * 32);
              const y = 180 - ((chartData.telemedicina[i] / maxValue) * 145);
              return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
            }).join(' ')}`}
            fill="none" 
            stroke="#3b82f6" 
            strokeWidth="2"
            strokeDasharray="6,3"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>
        
        {/* Linhas principais */}
        <path 
          d={`M ${chartData.labels.map((_, i) => {
            const x = 60 + (i * 32);
            const y = 180 - ((chartData.presencial[i] / maxValue) * 145);
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
          }).join(' ')}`}
          fill="none" 
          stroke="url(#presencialGrad)" 
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glowEffect)"
          className="line-animated"
        />
        
        <path 
          d={`M ${chartData.labels.map((_, i) => {
            const x = 60 + (i * 32);
            const y = 180 - ((chartData.telemedicina[i] / maxValue) * 145);
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
          }).join(' ')}`}
          fill="none" 
          stroke="url(#telemedicinaGrad)" 
          strokeWidth="4"
          strokeDasharray="10,5"
          strokeLinecap="round"
          filter="url(#glowEffect)"
          className="line-animated"
        />
        
        {/* Pontos de dados */}
        {chartData.labels.map((label, i) => {
          const x = 60 + (i * 32);
          const yPresencial = 180 - ((chartData.presencial[i] / maxValue) * 145);
          const yTelemedicina = 180 - ((chartData.telemedicina[i] / maxValue) * 145);
          
          return (
            <g key={i}>
              {/* Pontos Presencial */}
              <circle 
                cx={x} 
                cy={yPresencial} 
                r="4" 
                fill="url(#presencialGrad)" 
                filter="url(#shadowEffect)" 
                className="point-3d-fallback"
              />
              
              {/* Pontos Telemedicina */}
              <circle 
                cx={x} 
                cy={yTelemedicina} 
                r="4" 
                fill="url(#telemedicinaGrad)" 
                filter="url(#shadowEffect)" 
                className="point-3d-fallback"
              />
              
              {/* Labels do eixo X */}
              <text 
                x={x} 
                y="200" 
                fill="#666" 
                fontSize="11" 
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default Chart3DFallback;
