'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';

function CallRoomContent() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <div className="call-room">
      <div className="page-header">
        <h1 className="page-title">Sala de Consulta</h1>
        <p className="page-subtitle">
          Consulta online - Sala: {roomId}
        </p>
      </div>

      <div className="call-content">
        <div className="call-placeholder">
          <h2>Consulta Online</h2>
          <p>Funcionalidade de consulta online será implementada em breve.</p>
          <p>Sala ID: {roomId}</p>
        </div>
      </div>
    </div>
  );
}

export default function CallRoomPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="loading-spinner" />
        <p>Carregando sala de consulta...</p>
      </div>
    }>
      <CallRoomContent />
    </Suspense>
  );
}
