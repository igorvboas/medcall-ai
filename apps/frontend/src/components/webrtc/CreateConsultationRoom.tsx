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

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface CreateConsultationRoomProps {
  // Props para integração com sistema médico existente
  onRoomCreated?: (roomData: any) => void;
  onCancel?: () => void;
}

export function CreateConsultationRoom({ onRoomCreated, onCancel }: CreateConsultationRoomProps) {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const [consultationType, setConsultationType] = useState<'online' | 'presencial'>('online');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [consent, setConsent] = useState(false);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  
  const socketRef = useRef<any>(null);

  // Carregar script do Socket.IO (apenas o script)
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/socket.io/socket.io.js`;
    document.head.appendChild(script);
    return () => {
      // cleanup conexão se existir
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
    };
  }, []);

  // Conectar ao Socket.IO somente após ter o hostName carregado
  useEffect(() => {
    if (!window || !(window as any).io) return;
    if (!hostName) return; // aguarda carregar nome do médico
    if (socketRef.current) return; // já conectado

    try {
      socketRef.current = (window as any).io.connect(
        process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001',
        {
          auth: {
            userName: hostName,
            role: 'host',
            password: 'x'
          }
        }
      );
    } catch (error) {
      console.error('Erro ao conectar Socket.IO:', error);
    }
  }, [hostName]);

  // Carregar dados do médico logado
  useEffect(() => {
    const loadDoctorData = async () => {
      try {
        setLoadingDoctor(true);
        const response = await fetch('/api/medico');
        
        if (response.ok) {
          const data = await response.json();
          const doctorName = data.medico?.name || 'Dr. Médico';
          setHostName(doctorName);
          console.log('✅ Dados do médico carregados:', doctorName);
        } else {
          console.warn('⚠️ Não foi possível carregar dados do médico');
          setHostName('Dr. Médico');
        }
      } catch (error) {
        console.error('Erro ao carregar dados do médico:', error);
        setHostName('Dr. Médico');
      } finally {
        setLoadingDoctor(false);
      }
    };

    loadDoctorData();
  }, []);

  // Carregar pacientes do Supabase
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoadingPatients(true);
        const patientsData = await getPatients();
        setPatients(patientsData);
        
        // Selecionar primeiro paciente por padrão
        if (patientsData.length > 0) {
          setSelectedPatient(patientsData[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  // Carregar dispositivos de áudio (microfones)
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        // Solicitar permissão para acessar microfone
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Listar dispositivos de áudio
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microfone ${device.deviceId.slice(0, 8)}`
          }));
        
        setMicrophones(audioInputs);
        
        // Selecionar primeiro microfone por padrão
        if (audioInputs.length > 0) {
          setSelectedMicrophone(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Erro ao carregar dispositivos de áudio:', error);
      }
    };

    loadAudioDevices();
  }, []);

  const handleCreateRoom = async () => {
    // Validações
    if (!selectedPatient) {
      alert('Por favor, selecione um paciente');
      return;
    }

    if (!consent) {
      alert('Por favor, confirme o consentimento do paciente');
      return;
    }

    if (consultationType === 'online' && !selectedMicrophone) {
      alert('Por favor, selecione um microfone');
      return;
    }

    setIsCreatingRoom(true);

    try {
      // Encontrar dados do paciente selecionado
      const selectedPatientData = patients.find(p => p.id === selectedPatient);
      if (!selectedPatientData) {
        throw new Error('Paciente não encontrado');
      }

      // Gerar roomName automaticamente
      const roomName = `Consulta - ${selectedPatientData.name}`;

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
          userAuth: userAuth, // ✅ ID do user autenticado (Supabase Auth)
          consultationType: consultationType,
          microphoneId: selectedMicrophone
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
              patientData: selectedPatientData,
              consultationType: consultationType
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
        <div className="link-container show">
          <h5 className="text-center mb-3">Sala Criada com Sucesso!</h5>
          
          {/* Link do Paciente */}
          <p className="text-muted small text-center mb-2">
            <strong>Link para o Paciente:</strong>
            (Compartilhe este link)
          </p>

          <button 
            className="btn btn-copy"
            onClick={() => handleCopyLink(roomData.participantRoomUrl)}
          >
            Copiar Link do Paciente
          </button>
          
          {/* Link do Médico */}
          <p className="text-muted small text-center mb-2 mt-4">
            <strong>Seu link (Médico):</strong>
          </p>

          <button 
            className="btn btn-enter"
            onClick={() => handleEnterRoom(roomData.hostRoomUrl)}
          >
            Entrar na Consulta
          </button>

          <p className="text-muted small text-center mt-3">
            A sala expira em 5 minutos se ninguém entrar
          </p>

          <div className="mt-4 text-center">

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-consultation-container">
      <div className="consultation-card">
        <h2 className="section-title">Informações do Paciente</h2>

        <form onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }} className="consultation-form">
          {/* Selecionar Paciente */}
          <div className="form-group">
            <label htmlFor="patient-select" className="form-label">
              Selecionar Paciente <span className="required">*</span>
            </label>
            <select
              id="patient-select"
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="form-select"
              required
              disabled={loadingPatients || loadingDoctor}
            >
              <option value="">
                {loadingPatients ? 'Carregando pacientes...' : 'Selecione um paciente'}
              </option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Atendimento */}
          <div className="form-group">
            <label className="form-label">
              Tipo de Atendimento <span className="required">*</span>
            </label>
            <div className="consultation-type-buttons">
              <button
                type="button"
                className={`type-button ${consultationType === 'online' ? 'active' : ''}`}
                onClick={() => setConsultationType('online')}
              >
                Online
                {consultationType === 'online' && (
                  <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className={`type-button ${consultationType === 'presencial' ? 'active' : ''}`}
                onClick={() => setConsultationType('presencial')}
              >
                Presencial
                {consultationType === 'presencial' && (
                  <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Microfone do Médico (apenas para consultas online) */}
          {consultationType === 'online' && (
            <div className="form-group">
              <label htmlFor="microphone-select" className="form-label">
                Microfone do Médico <span className="required">*</span>
              </label>
              <select
                id="microphone-select"
                value={selectedMicrophone}
                onChange={(e) => setSelectedMicrophone(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Selecione o Microfone</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Consentimento */}
          <div className="form-group">
            <label className="form-label">
              Consentimento <span className="required">*</span>
            </label>
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span className="checkbox-text">
                Eu confirmo que o paciente foi informado e consentiu com a gravação e transcrição da consulta para fins médicos e de análise.
              </span>
            </label>
          </div>

          {/* Botão Iniciar Consulta */}
          <button 
            type="submit" 
            className="btn-submit"
            disabled={
              isCreatingRoom || 
              loadingPatients || 
              loadingDoctor ||
              !selectedPatient || 
              !consent ||
              (consultationType === 'online' && !selectedMicrophone)
            }
          >
            {isCreatingRoom ? 'Criando Consulta...' : 'Iniciar Consulta'}
          </button>
        </form>

        {isCreatingRoom && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Criando consulta...</p>
          </div>
        )}
      </div>
    </div>
  );
}
