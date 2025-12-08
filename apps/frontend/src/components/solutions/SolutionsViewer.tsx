'use client';

import React, { useState, useEffect } from 'react';
import SolutionsList from './SolutionsList';
import SolutionDetails from './SolutionDetails';

interface SolutionsViewerProps {
  consultaId: string;
  onBack: () => void;
  onSolutionSelect?: (solutionType: string) => void;
}

interface SolutionsData {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

export default function SolutionsViewer({ consultaId, onBack, onSolutionSelect }: SolutionsViewerProps) {
  const [solutions, setSolutions] = useState<SolutionsData | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetchSolutions();
  }, [consultaId]);

  const fetchSolutions = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/solutions/${consultaId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar soluções');
      }

      const data = await response.json();
      setSolutions(data.solutions);
    } catch (err) {
      console.error('❌ SolutionsViewer - Erro ao buscar soluções:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSolutionSelect = (solutionId: string) => {
    
    if (onSolutionSelect) {
      // Se há uma função onSolutionSelect, usa ela (integração com o sistema principal)
      onSolutionSelect(solutionId);
    } else {
      // Senão, usa o comportamento antigo (visualização)
      setSelectedSolution(solutionId);
    }
  };

  const handleBackToList = () => {
    setSelectedSolution(null);
  };

  const getSolutionData = () => {
    if (!solutions || !selectedSolution) return null;

    switch (selectedSolution) {
      case 'ltb':
        return solutions.ltb;
      case 'mentalidade':
        return solutions.mentalidade;
      case 'alimentacao':
        return solutions.alimentacao;
      case 'suplementacao':
        return solutions.suplementacao;
      case 'exercicios':
        return solutions.exercicios;
      case 'habitos':
        return solutions.habitos;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="solutions-container">
        <div className="solutions-header">
          <button className="back-button" onClick={onBack}>
            ← Voltar
          </button>
          <h1 className="solutions-title">Soluções da Consulta</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando soluções...</p>
        </div>
      </div>
    );
  }

  if (selectedSolution) {
    return (
      <SolutionDetails
        solutionId={selectedSolution}
        solutionData={getSolutionData()}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <SolutionsList
      consultaId={consultaId}
      onBack={onBack}
      onSolutionSelect={handleSolutionSelect}
      solutions={solutions}
      loading={loading}
    />
  );
}
