'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPatients } from '@/lib/supabase';
import io, { Socket } from 'socket.io-client';

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
  // Props para iniciar a partir de um agendamento
  agendamentoId?: string | null;
  preselectedPatientId?: string | null;
  preselectedPatientName?: string | null;
  preselectedConsultationType?: 'online' | 'presencial' | null;
}

export function CreateConsultationRoom({ 
  onRoomCreated, 
  onCancel,
  agendamentoId,
  preselectedPatientId,
  preselectedPatientName,
  preselectedConsultationType
}: CreateConsultationRoomProps) {
  const router = useRouter();
  const { showError, showSuccess, showWarning } = useNotifications();
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
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Novos estados para agendamento
  const [creationType, setCreationType] = useState<'instantanea' | 'agendamento'>('instantanea');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Estado para indicar se estamos iniciando a partir de um agendamento
  const [isFromAgendamento, setIsFromAgendamento] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  // Efeito para pré-configurar valores quando iniciando a partir de um agendamento
  useEffect(() => {
    if (agendamentoId && preselectedPatientId) {
      console.log('📅 Iniciando consulta a partir de agendamento:', agendamentoId);
      setIsFromAgendamento(true);
      setSelectedPatient(preselectedPatientId);
      if (preselectedConsultationType) {
        setConsultationType(preselectedConsultationType);
      }
      // Forçar tipo instantânea quando iniciando de agendamento
      setCreationType('instantanea');
      // Auto-marcar consentimento para agendamentos (já foi dado no momento do agendamento)
      setConsent(true);
    }
  }, [agendamentoId, preselectedPatientId, preselectedConsultationType]);

  // Efeito para iniciar automaticamente a consulta quando vier de um agendamento
  useEffect(() => {
    if (
      isFromAgendamento && 
      socketConnected && 
      !loadingDoctor && 
      !loadingPatients && 
      selectedPatient && 
      hostName &&
      !isCreatingRoom &&
      !roomCreated
    ) {
      console.log('🚀 Iniciando consulta automaticamente a partir do agendamento');
      handleCreateRoom();
    }
  }, [isFromAgendamento, socketConnected, loadingDoctor, loadingPatients, selectedPatient, hostName, isCreatingRoom, roomCreated]);

  // Conectar ao Socket.IO quando hostName estiver disponível E for consulta instantânea
  useEffect(() => {
    // Só conectar ao Socket.IO para consultas instantâneas
    if (creationType === 'agendamento') {
      // Desconectar se estava conectado e mudou para agendamento
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
      return;
    }
    
    if (!hostName) return; // aguarda carregar nome do médico
    if (socketRef.current?.connected) return; // já conectado

    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001';
    
    console.log('🔌 Conectando ao Socket.IO...', gatewayUrl);
    
    // Criar conexão Socket.IO com polling primeiro (mais confiável)
    const socket = io(gatewayUrl, {
      auth: {
        userName: hostName,
        role: 'host',
        password: 'x'
      },
      // Tentar polling primeiro, depois websocket (mais confiável quando backend pode estar lento)
      transports: ['polling', 'websocket'],
      timeout: 15000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Forçar upgrade para websocket após conectar via polling
      upgrade: true
    });

    socketRef.current = socket;

    // Configurar listeners de conexão
    socket.on('connect', () => {
      console.log('✅ Socket.IO conectado via', socket.io.engine.transport.name);
      setSocketConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO desconectado:', reason);
      setSocketConnected(false);
      
      // Se foi desconexão forçada pelo servidor, não tentar reconectar
      if (reason === 'io server disconnect') {
        console.warn('⚠️ Servidor desconectou a conexão');
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Erro ao conectar Socket.IO:', error.message);
      console.error('💡 Verifique se o backend está rodando em', gatewayUrl);
      setSocketConnected(false);
    });

    // Cleanup ao desmontar
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [hostName, creationType]);

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
        
        // Selecionar primeiro paciente por padrão, EXCETO se vier de um agendamento
        if (patientsData.length > 0 && !preselectedPatientId) {
          setSelectedPatient(patientsData[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, [preselectedPatientId]);

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
      showWarning('Por favor, selecione um paciente', 'Validação');
      return;
    }

    if (!consent) {
      showWarning('Por favor, confirme o consentimento do paciente', 'Validação');
      return;
    }

    // Validação específica para agendamento
    if (creationType === 'agendamento') {
      if (!scheduledDate || !scheduledTime) {
        showWarning('Por favor, selecione a data e horário do agendamento', 'Validação');
        return;
      }
    }

    // Validação de microfone só para consulta instantânea online
    if (creationType === 'instantanea' && consultationType === 'online' && !selectedMicrophone) {
      showWarning('Por favor, selecione um microfone', 'Validação');
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

      // ✅ AGENDAMENTO: Criar consulta via API sem Socket.IO
      if (creationType === 'agendamento') {
        // Combinar data e hora para criar o timestamp
        const consultaInicio = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        
        const response = await fetch('/api/consultations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patient_id: selectedPatient,
            patient_name: selectedPatientData.name,
            consultation_type: consultationType === 'online' ? 'TELEMEDICINA' : 'PRESENCIAL',
            status: 'AGENDAMENTO',
            consulta_inicio: consultaInicio,
          }),
        });

        setIsCreatingRoom(false);

        if (response.ok) {
          const consultation = await response.json();
          console.log('✅ Agendamento criado:', consultation);
          
          // Redirecionar para página de consultas
          router.push('/consultas');
        } else {
          const errorData = await response.json();
          showError('Erro ao criar agendamento: ' + (errorData.error || 'Erro desconhecido'), 'Erro ao Criar');
        }
        return;
      }

      // ✅ CONSULTA INSTANTÂNEA: Criar sala via Socket.IO (comportamento original)
      // Obter user autenticado (para buscar doctor_id no backend)
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
          microphoneId: selectedMicrophone,
          // ✅ NOVO: ID do agendamento para atualizar em vez de criar nova consulta
          agendamentoId: isFromAgendamento ? agendamentoId : null
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

            // ✅ Se veio de um agendamento, redirecionar diretamente para a consulta
            if (isFromAgendamento) {
              console.log('🚀 Redirecionando diretamente para a consulta:', hostRoomUrl);
              window.location.href = hostRoomUrl;
              return;
            }

            setRoomData(roomInfo);
            setRoomCreated(true);
            
            // Callback para integração com sistema médico
            onRoomCreated?.(roomInfo);
          } else {
            showError('Erro ao criar sala: ' + response.error, 'Erro ao Criar');
          }
        });
      } else {
        throw new Error('Socket.IO não conectado');
      }
    } catch (error) {
      setIsCreatingRoom(false);
      console.error('Erro ao criar sala:', error);
      showError('Erro ao criar sala. Tente novamente.', 'Erro');
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Link copiado para a área de transferência!', 'Link Copiado');
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      showError('Erro ao copiar link. Copie manualmente: ' + link, 'Erro ao Copiar');
    }
  };

  const handleShareWhatsApp = (link: string, patientName?: string) => {
    // Mensagem formatada para WhatsApp
    const message = `Olá${patientName ? ` ${patientName}` : ''}! 👋\n\n🔗 Link para sua consulta online:\n${link}\n\nPor favor, clique no link acima para entrar na consulta.`;
    
    // Codificar a mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // URL do WhatsApp Web
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    // Abrir WhatsApp em nova aba
    window.open(whatsappUrl, '_blank');
  };

  const handleEnterRoom = (url: string) => {
    window.location.href = url;
  };

  // Mostrar loading quando iniciando automaticamente de um agendamento
  if (isFromAgendamento && (isCreatingRoom || !socketConnected || loadingDoctor || loadingPatients)) {
    return (
      <div className="create-consultation-container">
        <div className="consultation-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div className="loading-overlay" style={{ position: 'relative', background: 'transparent' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '20px', color: '#6b7280' }}>
              {!socketConnected ? 'Conectando ao servidor...' : 
               loadingDoctor ? 'Carregando dados do médico...' :
               loadingPatients ? 'Carregando dados do paciente...' :
               'Iniciando consulta...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Botão WhatsApp */}
          <button 
            className="btn btn-whatsapp"
            onClick={() => handleShareWhatsApp(roomData.participantRoomUrl, roomData.patientName)}
            style={{ marginTop: '12px' }}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Enviar Link via WhatsApp
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
            A sala expira em 5 minutos se ninguém entrar.
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
        <h2 className="section-title">
          {isFromAgendamento ? 'Iniciar Consulta Agendada' : 'Informações do Paciente'}
        </h2>

        <form onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }} className="consultation-form">
          {/* Selecionar Paciente - PRIMEIRO */}
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
              disabled={loadingPatients || loadingDoctor || isFromAgendamento}
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

          {/* Tipo de Criação: Instantânea ou Agendamento (ocultar se vier de agendamento) */}
          {!isFromAgendamento && (
          <div className="form-group">
            <label className="form-label">
              Tipo de Consulta <span className="required">*</span>
            </label>
            <div className="consultation-type-buttons">
              <button
                type="button"
                className={`type-button ${creationType === 'instantanea' ? 'active' : ''}`}
                onClick={() => setCreationType('instantanea')}
              >
                Instantânea
                {creationType === 'instantanea' && (
                  <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className={`type-button ${creationType === 'agendamento' ? 'active' : ''}`}
                onClick={() => setCreationType('agendamento')}
              >
                Agendamento
                {creationType === 'agendamento' && (
                  <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          )}

          {/* Campos de Data e Hora (apenas para agendamento) */}
          {creationType === 'agendamento' && (
            <div className="form-group">
              <label className="form-label">
                Data e Horário da Consulta <span className="required">*</span>
              </label>
              <div className="schedule-inputs">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="form-input schedule-date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="form-input schedule-time"
                  required
                />
              </div>
            </div>
          )}

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

          {/* Microfone do Médico (apenas para consultas online instantâneas) */}
          {consultationType === 'online' && creationType === 'instantanea' && (
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

          {/* Botão Iniciar/Agendar Consulta */}
          <button 
            type="submit" 
            className="btn-submit"
            disabled={
              isCreatingRoom || 
              loadingPatients || 
              loadingDoctor ||
              (creationType === 'instantanea' && !socketConnected) ||
              !selectedPatient || 
              !consent ||
              (creationType === 'instantanea' && consultationType === 'online' && !selectedMicrophone) ||
              (creationType === 'agendamento' && (!scheduledDate || !scheduledTime))
            }
          >
            {isCreatingRoom 
              ? (creationType === 'agendamento' ? 'Agendando...' : 'Criando Consulta...') 
              : (creationType === 'agendamento' ? 'Agendar Consulta' : 'Iniciar Consulta')
            }
          </button>

          {/* ✅ Indicador de status da conexão (apenas para consulta instantânea) */}
          {creationType === 'instantanea' && !socketConnected && !loadingDoctor && (
            <div className="connection-status">
              <div className="spinner-small"></div>
              <span className="text-muted small">Conectando ao servidor...</span>
            </div>
          )}
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
