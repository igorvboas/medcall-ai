'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';
import { useState, useEffect, useRef } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, Video, X, CheckCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { supabase } from '@/lib/supabase';
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
  const { showError } = useNotifications();
  const pathname = usePathname();
  const [activeConsultation, setActiveConsultation] = useState<ActiveConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const router = useRouter();
  
  // ✅ Ref para controlar se polling deve continuar (para em caso de erro 401)
  const pollingActiveRef = useRef(true);
  // Ref para armazenar IDs dos intervalos
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref para armazenar a consulta ativa atual (evita problemas com closures)
  const activeConsultationRef = useRef<ActiveConsultation | null>(null);

  useEffect(() => {
    pollingActiveRef.current = true;
    checkActiveConsultation();
    
    // Polling adaptativo baseado no status da consulta ativa
    intervalRef.current = setInterval(() => {
      if (pollingActiveRef.current) {
      checkActiveConsultation();
      }
    }, 10000); // ✅ Aumentado para 10 segundos (era 5)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
    };
  }, []);

  // Polling mais rápido enquanto há consulta ativa em RECORDING
  useEffect(() => {
    if (!activeConsultation) return;

    fastIntervalRef.current = setInterval(() => {
      if (pollingActiveRef.current) {
        checkActiveConsultation();
      }
    }, 5000);

    return () => {
      if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
    };
  }, [activeConsultation?.id]);

  const checkActiveConsultation = async () => {
    // ✅ Verificar se polling ainda está ativo
    if (!pollingActiveRef.current) {
      return;
    }

    try {
      // ✅ Só definir loading como true na primeira verificação
      if (!activeConsultationRef.current) {
        setLoading(true);
      }
      
      // Verificar autenticação
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // ✅ CORREÇÃO: Se erro de autenticação, parar polling imediatamente
      if (userError || !user) {
        console.warn('⚠️ [ActiveConsultationBanner] Sessão expirada - parando polling');
        pollingActiveRef.current = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
        setActiveConsultation(null);
        setLoading(false);
        return;
      }
      
      // Buscar médico primeiro
      const { data: medico, error: medicoError } = await supabase
        .from('medicos')
        .select('id')
        .eq('user_auth', user.id)
        .single();
      
      if (medicoError || !medico) {
        pollingActiveRef.current = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
        setActiveConsultation(null);
        setLoading(false);
        return;
      }
      
      // Buscar consultas ativas (RECORDING = consulta em andamento na sala)
      const { data: consultations, error: queryError } = await supabase
        .from('consultations')
        .select('*')
        .eq('doctor_id', medico.id)
        .eq('status', 'RECORDING')
        .order('created_at', { ascending: false })
        .limit(1);

      if (queryError) {
        // ✅ Se já existe consulta ativa, não remover em caso de erro temporário
        if (!activeConsultationRef.current) {
          activeConsultationRef.current = null;
          setActiveConsultation(null);
        }
        setLoading(false);
        return;
      }

      // Encontrar a primeira consulta em andamento (não finalizada)
      const active = consultations?.[0] || null;

      if (active) {
        // Só atualizar state se for uma consulta diferente (evita re-render desnecessário)
        if (!activeConsultationRef.current || activeConsultationRef.current.id !== active.id) {
          activeConsultationRef.current = active;
          setActiveConsultation(active);
        }
      } else {
        // Consulta não está mais em RECORDING — remover banner
        activeConsultationRef.current = null;
        setActiveConsultation(null);
      }
    } catch (error) {
      console.error('Erro ao verificar consulta em andamento:', error);
      // ✅ Em caso de erro, só remover se não houver consulta ativa já carregada
      if (!activeConsultationRef.current) {
        activeConsultationRef.current = null;
        setActiveConsultation(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToConsultation = async () => {
    if (!activeConsultation) return;

    try {
      const response = await gatewayClient.get(`/consultations/${activeConsultation.id}`);

      if (!response.success) {
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
        return;
      }

      const consultation = response.consultation;
      const patientId = consultation.patient_id || activeConsultation.patient_id || activeConsultation.patients?.id;

      if (consultation.consultation_type === 'PRESENCIAL') {
        // Presencial: redirecionar para página presencial com consultationId
        const params = new URLSearchParams({
          consultationId: activeConsultation.id,
          autoStart: 'true',
          micMode: 'single',
        });
        router.push(`/consulta/presencial?${params.toString()}`);
      } else if (consultation.roomId) {
        // Online: redirecionar para sala de vídeo
        const params = new URLSearchParams({
          roomId: consultation.roomId,
          role: 'host',
          ...(patientId && { patientId }),
        });
        router.push(`/consulta/online/doctor?${params.toString()}`);
      } else {
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da consulta:', error);
      router.push(`/consultas?consulta_id=${activeConsultation.id}`);
    }
  };

  const handleFinishConsultation = () => {
    if (!activeConsultation) return;
    setShowFinishConfirm(true);
  };

  const handleConfirmFinish = async () => {
    if (!activeConsultation) return;

    try {
      setIsFinishing(true);

      // Tentar finalizar remotamente (via realtime-service)
      let finalized = false;
      try {
        const finalizeResponse = await gatewayClient.post(
          `/consultations/${activeConsultation.id}/finalize-remote`
        );
        if (finalizeResponse.success) {
          finalized = true;
        }
      } catch (e) {
        console.warn('Finalize-remote falhou, usando fallback direto:', e);
      }

      // Fallback: finalizar via gateway (atualiza status + envia webhook)
      if (!finalized) {
        const response = await gatewayClient.post(
          `/consultations/${activeConsultation.id}/finalize-direct`
        );
        if (!response.success) {
          throw new Error(response.error || 'Erro ao finalizar consulta');
        }
      }

      activeConsultationRef.current = null;
      setActiveConsultation(null);
      window.location.reload();
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
      showError('Erro ao finalizar consulta. Tente novamente.', 'Erro');
      setIsFinishing(false);
    }
  };

  const handleDismiss = () => {
    activeConsultationRef.current = null;
    setActiveConsultation(null);
  };

  // Só exibir o banner em páginas internas do app (não em landing, auth, termos, etc.)
  const internalPrefixes = [
    '/consultas', '/consulta/', '/consultas-admin', '/dashboard',
    '/pacientes', '/agenda', '/documentos', '/configuracoes',
    '/treinamento', '/anamnese-inicial', '/anamnese-personalizada',
    '/clinica', '/conexao', '/administracao', '/admin', '/cadastro',
  ];
  const isInternalPage = pathname ? internalPrefixes.some(prefix => pathname.startsWith(prefix)) : false;

  // Não exibir na própria página da consulta (online ou presencial)
  if (!isInternalPage || pathname?.startsWith('/consulta/')) {
    return null;
  }

  if (loading || !activeConsultation) {
    return null;
  }

  const getStatusText = (status: string) => {
    if (status === 'RECORDING') return 'Gravando';
    return 'Em Andamento';
  };

  const patientName = activeConsultation.patients?.name || activeConsultation.patient_name;
  const consultationType = activeConsultation.consultation_type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';

  return (
    <>
      <ConfirmModal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        onConfirm={handleConfirmFinish}
        title="Encerrar Consulta"
        message={`Tem certeza que deseja encerrar a consulta com ${activeConsultation?.patients?.name || activeConsultation?.patient_name}?\n\nA consulta será finalizada e o status será alterado para PROCESSING para iniciar o processamento.`}
        confirmText="Encerrar"
        cancelText="Cancelar"
        variant="warning"
      />
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
    </>
  );
}

