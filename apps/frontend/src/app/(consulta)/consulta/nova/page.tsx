'use client';

import { useRouter } from 'next/navigation';
import { CreateConsultationRoom } from '@/components/webrtc/CreateConsultationRoom';
import '@/components/webrtc/webrtc-styles.css';

export default function NovaConsultaPage() {
  const router = useRouter();

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
    />
  );
}
