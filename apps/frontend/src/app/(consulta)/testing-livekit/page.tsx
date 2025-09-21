'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatients } from '@/lib/supabase';

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
}

export default function TestingLiveKitPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    // Carregar pacientes do banco de dados
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);
        const patientsData = await getPatients();
        setPatients(patientsData);
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
        // Fallback para pacientes de teste se houver erro
        const testPatients: Patient[] = [
          { id: 'patient-001', name: 'João Silva', email: 'joao@test.com', phone: null, city: null, status: 'active' },
          { id: 'patient-002', name: 'Maria Santos', email: 'maria@test.com', phone: null, city: null, status: 'active' },
          { id: 'patient-003', name: 'Pedro Costa', email: 'pedro@test.com', phone: null, city: null, status: 'active' },
          { id: 'patient-004', name: 'Ana Oliveira', email: 'ana@test.com', phone: null, city: null, status: 'active' },
          { id: 'patient-005', name: 'Carlos Ferreira', email: 'carlos@test.com', phone: null, city: null, status: 'active' },
        ];
        setPatients(testPatients);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  const handleStartCall = async () => {
    if (!selectedPatient) {
      alert('Selecione um paciente primeiro!');
      return;
    }

    setIsLoading(true);
    
    try {
      // Criar sessão de teste
      const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultation_id: 'test-' + Date.now(),
          session_type: 'online',
          participants: {
            doctor: {
              id: 'doctor-current',
              name: 'Dr. Médico',
              email: 'doctor@medcall.com'
            },
            patient: patients.find(p => p.id === selectedPatient)
          },
          consent: true,
          metadata: {
            appointmentType: 'online',
            isTest: true
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao criar sessão');
      }

      const sessionData = await response.json();
      console.log('✅ Sessão criada:', sessionData);

      // Redirecionar para página de teste
      const selectedPatientData = patients.find(p => p.id === selectedPatient);
      const params = new URLSearchParams({
        sessionId: sessionData.session.id,
        consultationId: 'test-' + Date.now(),
        roomName: sessionData.session.roomName,
        token: sessionData.tokens.doctor,
        patientToken: sessionData.tokens.patient,
        livekitUrl: sessionData.livekit.url,
        patientName: selectedPatientData?.name || 'Paciente Teste',
        cameraId: 'default',
        microphoneId: 'default',
        isTest: 'true'
      });

      router.push(`/testing-livekit/nova-online?${params.toString()}`);

    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: 'white',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: '#2a2a2a',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #4a5568'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          fontSize: '2rem',
          color: '#a6ce39'
        }}>
          🧪 Teste LiveKit
        </h1>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '1.1rem',
            fontWeight: '500'
          }}>
            Selecionar Paciente:
          </label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            disabled={loadingPatients}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              background: loadingPatients ? '#2a2a2a' : '#1a1a1a',
              color: loadingPatients ? '#666' : 'white',
              border: '1px solid #4a5568',
              borderRadius: '6px',
              cursor: loadingPatients ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">
              {loadingPatients ? 'Carregando pacientes...' : 'Selecione um paciente...'}
            </option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} {patient.email && `(${patient.email})`}
                {patient.city && ` - ${patient.city}`}
              </option>
            ))}
          </select>
          {loadingPatients && (
            <p style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.9rem', 
              color: '#ffc107',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>🔄</span> Carregando pacientes do banco de dados...
            </p>
          )}
        </div>

        <div style={{
          background: '#1a1a1a',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          fontSize: '0.9rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffc107' }}>📋 Informações do Teste:</h3>
          <p style={{ margin: '0.25rem 0' }}>• Gateway: {process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}</p>
          <p style={{ margin: '0.25rem 0' }}>• LiveKit: {process.env.NEXT_PUBLIC_LIVEKIT_URL || 'Não configurado'}</p>
          <p style={{ margin: '0.25rem 0' }}>• Tipo: Sessão de Teste</p>
          <p style={{ margin: '0.25rem 0' }}>• Pacientes: {patients.length} disponíveis {loadingPatients ? '(carregando...)' : ''}</p>
          <p style={{ margin: '0.25rem 0' }}>• Fonte: {patients.length > 0 && patients[0].id.startsWith('patient-') ? 'Teste' : 'Banco de dados'}</p>
        </div>

        <button
          onClick={handleStartCall}
          disabled={!selectedPatient || isLoading}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.1rem',
            background: selectedPatient && !isLoading ? '#a6ce39' : '#6c757d',
            color: selectedPatient && !isLoading ? 'black' : 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: selectedPatient && !isLoading ? 'pointer' : 'not-allowed',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
        >
          {isLoading ? (
            <>
              <span style={{ marginRight: '0.5rem' }}>🔄</span>
              Criando Sessão...
            </>
          ) : (
            <>
              <span style={{ marginRight: '0.5rem' }}>🎥</span>
              Iniciar Chamada de Teste
            </>
          )}
        </button>

        {selectedPatient && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(166, 206, 57, 0.1)',
            border: '1px solid #a6ce39',
            borderRadius: '6px',
            fontSize: '0.9rem'
          }}>
            <strong>Paciente Selecionado:</strong> {patients.find(p => p.id === selectedPatient)?.name}
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#1a1a1a',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#a0aec0'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffc107' }}>🔧 Debug Info:</h4>
          <p style={{ margin: '0.25rem 0' }}>• Timestamp: {new Date().toLocaleString()}</p>
          <p style={{ margin: '0.25rem 0' }}>• Environment: {typeof window !== 'undefined' ? 'Client' : 'Server'}</p>
        </div>
      </div>
    </div>
  );
}
