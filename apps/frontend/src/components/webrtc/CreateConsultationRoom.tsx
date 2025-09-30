'use client';

import { useState, useEffect, useRef } from 'react';
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

interface CreateConsultationRoomProps {
  // Props para integração com sistema médico existente
  onRoomCreated?: (roomData: any) => void;
  onCancel?: () => void;
}

export function CreateConsultationRoom({ onRoomCreated, onCancel }: CreateConsultationRoomProps) {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  
  const socketRef = useRef<any>(null);

  // Carregar Socket.IO dinamicamente
  useEffect(() => {
    const loadSocketIO = async () => {
      try {
        // Carregar Socket.IO do backend (mesmo domínio)
        const script = document.createElement('script');
        script.src = `${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/socket.io/socket.io.js`;
        script.onload = () => {
          if (window.io) {
            socketRef.current = window.io.connect(
              process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001',
              {
                auth: {
                  userName: hostName || 'Host-' + Math.floor(Math.random() * 100000),
                  password: "x"
                }
              }
            );
          }
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Erro ao carregar Socket.IO:', error);
      }
    };

    loadSocketIO();
  }, []);

  // Carregar pacientes do Supabase
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);
        const patientsData = await getPatients();
        setPatients(patientsData);
        
        // Auto-preenchir nome da sala com primeiro paciente se disponível
        if (patientsData.length > 0) {
          setSelectedPatient(patientsData[0].id);
          setRoomName(`Consulta - ${patientsData[0].name}`);
        }
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  // Carregar nome do host salvo
  useEffect(() => {
    const savedHostName = localStorage.getItem('hostName');
    if (savedHostName) {
      setHostName(savedHostName);
    } else {
      // Gerar nome padrão baseado em dados médicos
      setHostName('Dr. Médico'); // TODO: Pegar do contexto de autenticação
    }
  }, []);

  const handleCreateRoom = async () => {
    if (!hostName.trim() || !roomName.trim() || !selectedPatient) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsCreatingRoom(true);

    try {
      // Salvar nome do host
      localStorage.setItem('hostName', hostName);

      // Encontrar dados do paciente selecionado
      const selectedPatientData = patients.find(p => p.id === selectedPatient);
      if (!selectedPatientData) {
        throw new Error('Paciente não encontrado');
      }

      // ✅ Obter user autenticado (para buscar doctor_id no backend)
      const { getCurrentUser } = await import('@/lib/supabase');
      const user = await getCurrentUser();
      const userAuth = user?.id || null;

      if (!userAuth) {
        console.warn('⚠️ Usuário não autenticado - consulta será criada sem doctor_id');
      }

      // Criar sala via Socket.IO
      if (socketRef.current) {
        socketRef.current.emit('createRoom', {
          hostName: hostName,
          roomName: roomName,
          patientId: selectedPatient,
          patientName: selectedPatientData.name,
          patientEmail: selectedPatientData.email,
          patientPhone: selectedPatientData.phone,
          userAuth: userAuth // ✅ ID do user autenticado (Supabase Auth)
        }, (response: any) => {
          setIsCreatingRoom(false);

          if (response.success) {
            // Gerar URLs para médico e paciente
            const baseUrl = window.location.origin;
            const participantRoomUrl = `${baseUrl}/consulta/online/patient?roomId=${response.roomId}&patientId=${selectedPatient}`;
            const hostRoomUrl = `${baseUrl}/consulta/online/doctor?roomId=${response.roomId}&role=host&patientId=${selectedPatient}`;

            const roomInfo = {
              roomId: response.roomId,
              roomName: roomName,
              hostName: hostName,
              patientName: selectedPatientData.name,
              participantRoomUrl,
              hostRoomUrl,
              patientData: selectedPatientData
            };

            setRoomData(roomInfo);
            setRoomCreated(true);
            
            // Callback para integração com sistema médico
            onRoomCreated?.(roomInfo);
          } else {
            alert('Erro ao criar sala: ' + response.error);
          }
        });
      } else {
        throw new Error('Socket.IO não conectado');
      }
    } catch (error) {
      setIsCreatingRoom(false);
      console.error('Erro ao criar sala:', error);
      alert('Erro ao criar sala. Tente novamente.');
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao copiar link. Copie manualmente: ' + link);
    }
  };

  const handleEnterRoom = (url: string) => {
    window.location.href = url;
  };

  if (roomCreated && roomData) {
    return (
      <div className="create-room-container">
        <div className="create-room-header">
          <div className="icon">🎥</div>
          <h1>Sala de Consulta Criada</h1>
          <p>Sala: {roomData.roomName} | Paciente: {roomData.patientName}</p>
        </div>

        <div className="link-container show">
          <h5 className="text-center mb-3">✅ Sala Criada com Sucesso!</h5>
          
          {/* Link do Paciente */}
          <p className="text-muted small text-center mb-2">
            <strong>Link para o Paciente:</strong><br />
            (Compartilhe este link)
          </p>
          <div className="room-link">{roomData.participantRoomUrl}</div>
          <button 
            className="btn btn-copy"
            onClick={() => handleCopyLink(roomData.participantRoomUrl)}
          >
            📋 Copiar Link do Paciente
          </button>
          
          {/* Link do Médico */}
          <p className="text-muted small text-center mb-2 mt-4">
            <strong>Seu link (Médico):</strong>
          </p>
          <div className="room-link" style={{ background: '#e7f3ff', borderColor: '#007bff' }}>
            {roomData.hostRoomUrl}
          </div>
          <button 
            className="btn btn-enter"
            onClick={() => handleEnterRoom(roomData.hostRoomUrl)}
          >
            🚪 Entrar na Consulta
          </button>

          <p className="text-muted small text-center mt-3">
            ⏱️ A sala expira em 5 minutos se ninguém entrar
          </p>

          <div className="mt-4 text-center">
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setRoomCreated(false);
                setRoomData(null);
              }}
            >
              Criar Nova Sala
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-room-container">
      <div className="create-room-header">
        <div className="icon">🎥</div>
        <h1>Criar Sala de Consulta</h1>
        <p>Configure sua consulta e compartilhe o link com o paciente</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
        <div className="mb-3">
          <label htmlFor="host-name" className="form-label">Seu Nome</label>
          <input 
            type="text" 
            className="form-control" 
            id="host-name" 
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Ex: Dr. Silva" 
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="patient-select" className="form-label">Paciente *</label>
          <select
            id="patient-select"
            value={selectedPatient}
            onChange={(e) => {
              setSelectedPatient(e.target.value);
              const patient = patients.find(p => p.id === e.target.value);
              if (patient) {
                setRoomName(`Consulta - ${patient.name}`);
              }
            }}
            className="form-control"
            required
            disabled={loadingPatients}
          >
            <option value="">
              {loadingPatients ? 'Carregando pacientes...' : 'Selecione um paciente'}
            </option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} {patient.email ? `- ${patient.email}` : ''} {patient.city ? `(${patient.city})` : ''}
              </option>
            ))}
          </select>
          {loadingPatients && (
            <div className="loading-indicator">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
              <span>Carregando pacientes...</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="room-name" className="form-label">Nome da Consulta</label>
          <input 
            type="text" 
            className="form-control" 
            id="room-name" 
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Ex: Consulta Paciente X" 
            required
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary btn-create"
          disabled={isCreatingRoom || loadingPatients || !hostName.trim() || !roomName.trim() || !selectedPatient}
        >
          {isCreatingRoom ? 'Criando Sala...' : 'Criar Sala de Consulta'}
        </button>
      </form>

      {isCreatingRoom && (
        <div className="loading show">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Criando sala...</span>
          </div>
          <p className="mt-2">Criando sala...</p>
        </div>
      )}

      {onCancel && (
        <div className="mt-3 text-center">
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
