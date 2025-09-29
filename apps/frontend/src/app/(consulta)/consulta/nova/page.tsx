'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateConsultationRoom } from '@/components/webrtc/CreateConsultationRoom';
import '@/components/webrtc/webrtc-styles.css';

// Componente simplificado usando o novo sistema WebRTC

export default function NovaConsultaPage() {
  const router = useRouter();

  const handleRoomCreated = (roomData: any) => {
    console.log('Sala criada:', roomData);
    // Aqui você pode salvar dados da sala no Supabase se necessário
    // Por enquanto, o componente já redireciona automaticamente
  };

  const handleCancel = () => {
    router.push('/consulta'); // Voltar para lista de consultas
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nova Consulta</h1>
        <p className="page-subtitle">
          Configure sua consulta e compartilhe o link com o paciente
        </p>
      </div>

      <CreateConsultationRoom 
        onRoomCreated={handleRoomCreated}
        onCancel={handleCancel}
      />
    </div>
  );
}
