'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Video, X, CheckCircle } from 'lucide-react';
import './ActiveConsultationBanner.css';

interface ActiveConsultation {
  id: string;
  patient_name: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: string;
  created_at: string;
  patient_id?: string;
  patients?: {
    name: string;
    id?: string;
  };
}

export function ActiveConsultationBanner() {
  const [activeConsultation, setActiveConsultation] = useState<ActiveConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkActiveConsultation();
    // Verificar a cada 30 segundos se há consulta em andamento
    const interval = setInterval(checkActiveConsultation, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkActiveConsultation = async () => {
    try {
      setLoading(true);
      // Buscar apenas consultas com status RECORDING (sala aberta/gravando)
      const response = await fetch('/api/consultations?status=RECORDING&limit=10');
      
      if (!response.ok) {
        setActiveConsultation(null);
        return;
      }

      const data = await response.json();
      
      // Encontrar a primeira consulta com status RECORDING (sala em aberto)
      const active = data.consultations?.find((c: ActiveConsultation) => 
        c.status === 'RECORDING'
      );

      if (active) {
        setActiveConsultation(active);
      } else {
        setActiveConsultation(null);
      }
    } catch (error) {
      console.error('Erro ao verificar consulta em andamento:', error);
      setActiveConsultation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToConsultation = async () => {
    if (!activeConsultation) return;

    try {
      // Buscar detalhes da consulta para obter roomId
      const response = await fetch(`/api/consultations/${activeConsultation.id}`);
      
      if (!response.ok) {
        // Se não conseguir buscar, navegar para página de consultas
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
        return;
      }

      const data = await response.json();
      const consultation = data.consultation;
      
      // Se tiver roomId, navegar diretamente para a sala
      if (consultation.roomId) {
        const patientId = consultation.patient_id || activeConsultation.patient_id || activeConsultation.patients?.id;
        const patientName = consultation.patients?.name || activeConsultation.patients?.name || activeConsultation.patient_name;
        
        // Determinar tipo de consulta e navegar para a sala correta
        if (consultation.consultation_type === 'PRESENCIAL') {
          // Para presencial, precisamos de mais informações - redirecionar para consultas
          router.push(`/consultas?consulta_id=${activeConsultation.id}`);
        } else {
          // Para telemedicina, navegar para a sala de vídeo
          const params = new URLSearchParams({
            roomId: consultation.roomId,
            role: 'host',
            ...(patientId && { patientId }),
            ...(patientName && { patientName })
          });
          router.push(`/consulta/online/doctor?${params.toString()}`);
        }
      } else {
        // Se não tiver roomId, navegar para página de consultas
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da consulta:', error);
      // Em caso de erro, navegar para página de consultas
      router.push(`/consultas?consulta_id=${activeConsultation.id}`);
    }
  };

  const handleFinishConsultation = async () => {
    if (!activeConsultation) return;

    const confirmFinish = window.confirm(
      `Tem certeza que deseja encerrar a consulta com ${activeConsultation.patients?.name || activeConsultation.patient_name}?\n\nA consulta será finalizada e o status será alterado para PROCESSING para iniciar o processamento.`
    );

    if (!confirmFinish) return;

    try {
      setIsFinishing(true);
      
      // Atualizar status para PROCESSING (inicia o processamento da consulta)
      const response = await fetch(`/api/consultations/${activeConsultation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PROCESSING',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao finalizar consulta');
      }

      // Remover o banner
      setActiveConsultation(null);
      
      // Recarregar a página para atualizar o dashboard
      window.location.reload();
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
      alert('Erro ao finalizar consulta. Tente novamente.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleDismiss = () => {
    setActiveConsultation(null);
  };

  if (loading || !activeConsultation) {
    return null;
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALID_ANAMNESE':
        return 'Validação Anamnese';
      case 'VALID_DIAGNOSTICO':
        return 'Validação Diagnóstico';
      case 'VALID_SOLUCAO':
        return 'Validação Solução';
      case 'VALIDATION':
        return 'Em Validação';
      default:
        return 'Em Andamento';
    }
  };

  const patientName = activeConsultation.patients?.name || activeConsultation.patient_name;
  const consultationType = activeConsultation.consultation_type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';

  return (
    <div className="active-consultation-banner">
      <div className="banner-content">
        <div className="banner-icon">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="banner-info">
          <div className="banner-title">Consulta em Andamento</div>
          <div className="banner-details">
            <span className="patient-name">{patientName}</span>
            <span className="separator">•</span>
            <span className="consultation-type">{consultationType}</span>
            <span className="separator">•</span>
            <span className="status-badge">{getStatusText(activeConsultation.status)}</span>
          </div>
        </div>
        <div className="banner-actions">
          <button
            className="btn-return"
            onClick={handleReturnToConsultation}
            disabled={isFinishing}
          >
            <Video className="w-4 h-4" />
            Retornar à Consulta
          </button>
          <button
            className="btn-finish"
            onClick={handleFinishConsultation}
            disabled={isFinishing}
          >
            {isFinishing ? (
              <>
                <div className="spinner-small"></div>
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Finalizar
              </>
            )}
          </button>
          <button
            className="btn-dismiss"
            onClick={handleDismiss}
            disabled={isFinishing}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

