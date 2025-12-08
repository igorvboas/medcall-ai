'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CreateConsultationRoom } from '@/components/webrtc/CreateConsultationRoom';
import '@/components/webrtc/webrtc-styles.css';

function NovaConsultaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Parâmetros de agendamento (quando iniciando a partir de um agendamento)
  const agendamentoId = searchParams.get('agendamento_id');
  const patientId = searchParams.get('patient_id');
  const patientName = searchParams.get('patient_name');
  const consultationType = searchParams.get('consultation_type') as 'TELEMEDICINA' | 'PRESENCIAL' | null;

  const handleRoomCreated = (roomData: any) => {
    console.log('Sala criada:', roomData);
    // Aqui você pode salvar dados da sala no Supabase se necessário
    // Por enquanto, o componente já redireciona automaticamente
  };

  const handleCancel = () => {
    router.push('/consultas'); // Voltar para lista de consultas
  };

  return (
    <CreateConsultationRoom 
      onRoomCreated={handleRoomCreated}
      onCancel={handleCancel}
      // Props para iniciar a partir de um agendamento
      agendamentoId={agendamentoId}
      preselectedPatientId={patientId}
      preselectedPatientName={patientName}
      preselectedConsultationType={consultationType === 'TELEMEDICINA' ? 'online' : consultationType === 'PRESENCIAL' ? 'presencial' : undefined}
    />
  );
}

export default function NovaConsultaPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NovaConsultaContent />
    </Suspense>
  );
}
