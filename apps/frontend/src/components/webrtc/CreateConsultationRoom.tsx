'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { getPatients, supabase } from '@/lib/supabase';
import { gatewayClient } from '@/lib/gatewayClient';
import io, { Socket } from 'socket.io-client';

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  profile_pic?: string;
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
  const { theme, systemTheme } = useTheme();
  const { showError, showSuccess, showWarning, showInfo } = useNotifications();
  const [mounted, setMounted] = useState(false);

  // Determinar se está em modo dark
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDarkMode = mounted && currentTheme === 'dark';

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
  // Presencial mic config
  const [presencialMicMode, setPresencialMicMode] = useState<'single' | 'dual'>('single');
  const [presencialDoctorMic, setPresencialDoctorMic] = useState('');
  const [presencialPatientMic, setPresencialPatientMic] = useState('');
  const [showDualMicWarning, setShowDualMicWarning] = useState(false);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeConsultationBlock, setActiveConsultationBlock] = useState<{ id: string; patient_name: string } | null>(null);

  // Novos estados para agendamento
  const [creationType, setCreationType] = useState<'instantanea' | 'agendamento' | ''>('instantanea');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Estado para indicar se estamos iniciando a partir de um agendamento
  const [isFromAgendamento, setIsFromAgendamento] = useState(false);

  // Estado para tipo de retorno (Novo/Retorno)
  const [patientReturnType, setPatientReturnType] = useState<'novo' | 'retorno'>('novo');

  // Estado para searchbox de pacientes
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Estados para captura de áudio em tempo real
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
  const agendamentoAutoStarted = useRef(false);
  useEffect(() => {
    if (
      isFromAgendamento &&
      !agendamentoAutoStarted.current &&
      !loadingDoctor &&
      !loadingPatients &&
      selectedPatient &&
      hostName &&
      !isCreatingRoom &&
      !roomCreated
    ) {
      agendamentoAutoStarted.current = true;
      console.log('🚀 Iniciando consulta automaticamente a partir do agendamento');
      handleCreateRoom();
    }
  }, [isFromAgendamento, loadingDoctor, loadingPatients, selectedPatient, hostName, isCreatingRoom, roomCreated]);

  // ✅ Helper para conectar ao socket sob demanda
  const connectSocket = async (hostName: string): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      // Se já estiver conectado, retornar socket existente
      if (socketRef.current?.connected) {
        return resolve(socketRef.current);
      }

      // Se já existe mas está desconectado, conectar
      if (socketRef.current) {
        socketRef.current.connect();
        return resolve(socketRef.current);
      }

      const realtimeUrl = (process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'ws://localhost:3002').replace(/^ws/, 'http');
      console.log('🔌 Conectando ao Socket.IO...', realtimeUrl);

      const socket = io(realtimeUrl, {
        auth: {
          userName: hostName,
          role: 'host',
          password: 'x'
        },
        transports: ['polling', 'websocket'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        upgrade: true
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ Socket.IO conectado via', socket.io.engine.transport.name);
        setSocketConnected(true);
        resolve(socket);
      });

      socket.on('connect_error', (error: Error) => {
        console.error('❌ Erro ao conectar Socket.IO:', error.message);
        setSocketConnected(false);
        reject(error);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO desconectado:', reason);
        setSocketConnected(false);
      });
    });
  };

  // ❌ REMOVIDO: Conexão automática ao montar/mudar hostname
  // A conexão agora é feita apenas ao clicar em "Criar Consulta"

  // Carregar dados do médico logado
  useEffect(() => {
    const loadDoctorData = async () => {
      try {
        setLoadingDoctor(true);

        // Buscar usuário autenticado
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('⚠️ Usuário não autenticado');
          setHostName('Dr. Médico');
          return;
        }

        // Buscar dados do médico
        const { data: medico, error: medicoError } = await supabase
          .from('medicos')
          .select('*')
          .eq('user_auth', user.id)
          .single();

        if (medicoError || !medico) {
          console.warn('⚠️ Não foi possível carregar dados do médico');
          setHostName('Dr. Médico');
        } else {
          const doctorName = medico.name || 'Dr. Médico';
          setHostName(doctorName);
          console.log('✅ Dados do médico carregados:', doctorName);

          // Verificar se médico já tem consulta em andamento
          const { data: activeConsult } = await supabase
            .from('consultations')
            .select('id, patient_name, patients(name)')
            .eq('doctor_id', medico.id)
            .eq('status', 'RECORDING')
            .maybeSingle();

          if (activeConsult) {
            const patientName = (activeConsult as any).patients?.name || activeConsult.patient_name || 'Paciente';
            setActiveConsultationBlock({ id: activeConsult.id, patient_name: patientName });
          }
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

        // Não pré-selecionar nenhum paciente — o searchbox inicia vazio
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
      } finally {
        setLoadingPatients(false);
      }
    };

    loadPatients();
  }, [preselectedPatientId]);

  // Fechar dropdown de pacientes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preencher o search quando paciente é pré-selecionado (agendamento)
  useEffect(() => {
    if (selectedPatient && patients.length > 0) {
      const patient = patients.find((p) => p.id === selectedPatient);
      if (patient) setPatientSearch(patient.name);
    }
  }, [selectedPatient, patients]);

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
          setPresencialDoctorMic(audioInputs[0].deviceId);
          if (audioInputs.length > 1) {
            setPresencialPatientMic(audioInputs[1].deviceId);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dispositivos de áudio:', error);
      }
    };

    loadAudioDevices();
  }, []);

  // Capturar áudio do microfone selecionado e atualizar nível em tempo real
  useEffect(() => {
    // Só capturar se for consulta online instantânea e tiver microfone selecionado
    if (
      consultationType !== 'online' ||
      creationType !== 'instantanea' ||
      !selectedMicrophone
    ) {
      // Parar captura se não atender os requisitos
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioLevel(0);
      setIsAudioMuted(true);
      return;
    }

    let isMounted = true;

    const startAudioCapture = async () => {
      try {
        // Parar captura anterior se existir
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Criar novo stream com o microfone selecionado
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: selectedMicrophone }
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        audioStreamRef.current = stream;

        // Criar AudioContext
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Criar source node
        const source = audioContext.createMediaStreamSource(stream);

        // Criar analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        source.connect(analyser);
        analyserRef.current = analyser;

        // Verificar se o áudio está mutado
        const audioTrack = stream.getAudioTracks()[0];
        setIsAudioMuted(!audioTrack || !audioTrack.enabled || audioTrack.muted);

        // Função para atualizar nível de áudio
        const updateAudioLevel = () => {
          if (!isMounted || !analyserRef.current) return;

          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calcular média do nível de áudio
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const level = Math.min(100, (average / 128) * 100);

          setAudioLevel(level);

          // Verificar se está mutado
          if (audioStreamRef.current) {
            const track = audioStreamRef.current.getAudioTracks()[0];
            setIsAudioMuted(!track || !track.enabled || track.muted || level < 1);
          }

          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };

        updateAudioLevel();

      } catch (error) {
        console.error('Erro ao capturar áudio:', error);
        setAudioLevel(0);
        setIsAudioMuted(true);
      }
    };

    startAudioCapture();

    // Cleanup
    return () => {
      isMounted = false;
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [selectedMicrophone, consultationType, creationType]);

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

      // ✅ AGENDAMENTO: Criar consulta via Supabase sem Socket.IO
      if (creationType === 'agendamento') {
        // Combinar data e hora para criar o timestamp
        const consultaInicio = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

        // ✅ NOVO: Criar agendamento via Gateway (verifica conflitos)
        const response = await gatewayClient.post<{ consultation: any }>('/consultations/schedule', {
          patient_id: selectedPatient,
          patient_name: selectedPatientData.name,
          consultation_type: consultationType,
          scheduled_date: consultaInicio,
          duration_minutes: 60, // Padrão 1 hora
          andamento: patientReturnType === 'retorno' ? 'RETORNO' : 'NOVA'
        });

        setIsCreatingRoom(false);

        if (!response.success) {
          // Tratar erro de conflito de horário (409)
          if ((response as any).status === 409 || response.error?.includes('ocupado')) {
            showWarning(response.error || 'Este horário já está ocupado por outra consulta.', 'Horário Indisponível');
          } else {
            showError('Erro ao criar agendamento: ' + (response.error || 'Erro desconhecido'), 'Erro ao Criar');
          }
          return;
        }

        const consultation = response.consultation;
        console.log('✅ Agendamento criado:', consultation);

        // 📅 Sincronizar com Google Calendar (se falhar, não impedir o fluxo principal)
        try {
          const endTime = new Date(new Date(consultaInicio).getTime() + 60 * 60 * 1000).toISOString(); // 1 hora de duração padrão

          gatewayClient.post('/api/auth/google-calendar/events', {
            title: `Consulta MedCall: ${selectedPatientData.name}`,
            description: `Consulta agendada via MedCall.\nPaciente: ${selectedPatientData.name}\nTipo: ${consultationType === 'online' ? 'Online' : 'Presencial'}\nLink: ${window.location.origin}/consulta/online/doctor?roomId=${consultation.id}`, // Link placeholder, idealmente seria o link real
            startTime: consultaInicio,
            endTime: endTime,
            attendees: selectedPatientData.email ? [selectedPatientData.email] : []
          }).then(async (res) => {
            if (res.success && res.eventId) {
              console.log('✅ Evento criado no Google Calendar:', res.eventId);
              showSuccess('Evento adicionado ao Google Calendar', 'Agenda');

              // 🔄 CRITICAL FIX: Salvar ID do evento no banco para permitir exclusão futura
              try {
                const { error: updateError } = await supabase
                  .from('consultations')
                  .update({
                    google_event_id: res.eventId,
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString()
                  })
                  .eq('id', consultation.id);

                if (updateError) {
                  console.error('❌ Erro ao salvar google_event_id no banco:', updateError);
                } else {
                  console.log('✅ google_event_id salvo com sucesso na consulta');
                }
              } catch (dbError) {
                console.error('❌ Exceção ao salvar google_event_id:', dbError);
              }

            } else if (res.error?.includes('não conectado')) {
              console.warn('Google Calendar não conectado para este médico');
            } else {
              console.error('Erro ao sync Google Calendar:', res.error);
            }
          });

        } catch (calError) {
          console.error('Erro ao preparar sync do Calendar:', calError);
        }

        // Redirecionar para página de consultas
        router.push('/consultas');
        return;
      }

      // ✅ CONSULTA INSTANTÂNEA

      // Se for consulta PRESENCIAL, criar via API e redirecionar para página presencial
      if (consultationType === 'presencial') {
        const { getCurrentUser } = await import('@/lib/supabase');
        const user = await getCurrentUser();
        const userAuth = user?.id || null;

        if (!userAuth) {
          throw new Error('Usuário não autenticado');
        }

        // Buscar médico na tabela medicos usando a FK do auth.users
        const { data: medico, error: medicoError } = await supabase
          .from('medicos')
          .select('id')
          .eq('user_auth', userAuth)
          .single();

        if (medicoError || !medico) {
          throw new Error('Médico não encontrado. Verifique se sua conta está sincronizada.');
        }

        // ✅ Determinar "from" baseado na URL de origem
        const origin = window.location.origin;
        let consultationFrom: string | null = null;
        if (origin.includes('medcall-ai-frontend-v2.vercel.app')) {
          consultationFrom = 'medcall';
        } else if (origin.includes('autonhealth.com.br')) {
          consultationFrom = 'auton';
        } else if (origin.includes('localhost')) {
          consultationFrom = 'localhost';
        }

        // Criar consulta presencial via Supabase
        const { data: consultation, error: insertError } = await supabase
          .from('consultations')
          .insert({
            patient_id: selectedPatient,
            patient_name: selectedPatientData.name,
            consultation_type: 'PRESENCIAL',
            status: 'RECORDING',
            doctor_id: medico.id,
            from: consultationFrom,
            andamento: patientReturnType === 'retorno' ? 'RETORNO' : 'NOVA',
            consulta_inicio: new Date().toISOString(),
          })
          .select()
          .single();

        setIsCreatingRoom(false);

        if (insertError || !consultation) {
          throw new Error(insertError?.message || 'Erro ao criar consulta presencial');
        }

        console.log('✅ Consulta presencial criada:', consultation.id);

        // Redirecionar para página de consulta presencial com configuração de mic
        const baseUrl = window.location.origin;
        const micParams = presencialMicMode === 'single'
          ? `&micMode=single&singleMicId=${encodeURIComponent(presencialDoctorMic)}`
          : `&micMode=dual&doctorMic=${encodeURIComponent(presencialDoctorMic)}&patientMic=${encodeURIComponent(presencialPatientMic)}`;
        const presencialUrl = `${baseUrl}/consulta/presencial?consultationId=${consultation.id}&autoStart=true${micParams}`;
        console.log('🚀 Redirecionando para consulta presencial:', presencialUrl);
        window.location.href = presencialUrl;
        return;
      }

      // ✅ CONSULTA ONLINE: Criar sala via Socket.IO (comportamento original)
      // Obter user autenticado (para buscar doctor_id no backend)
      const { getCurrentUser } = await import('@/lib/supabase');
      const user = await getCurrentUser();
      const userAuth = user?.id || null;

      if (!userAuth) {
        console.warn('⚠️ Usuário não autenticado - consulta será criada sem doctor_id');
      }

      // Criar sala via Socket.IO
      try {
        // Conectar sob demanda
        const socket = await connectSocket(hostName);

        socket.emit('createRoom', {
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
          agendamentoId: isFromAgendamento ? agendamentoId : null,
          andamento: patientReturnType === 'retorno' ? 'RETORNO' : 'NOVA'
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
      } catch (err) {
        console.error('Erro ao conectar socket:', err);
        showError('Erro ao conectar ao servidor de tempo real', 'Erro de Conexão');
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

  // Estado para controle de loading do envio do WhatsApp
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const handleSendWhatsApp = async (link: string, patientName?: string, patientPhone?: string | null) => {
    // Validação: Verificar se telefone existe
    if (!patientPhone) {
      showWarning('Telefone do paciente não cadastrado! Por favor, cadastre um telefone para o paciente.', 'Atenção');
      return;
    }

    setSendingWhatsapp(true);

    try {
      const message = `Olá${patientName ? ` ${patientName}` : ''}! 👋\n\n🔗 Link para sua consulta online:\n${link}\n\nPor favor, clique no link acima para entrar na consulta.`;

      const response = await gatewayClient.post('/whatsapp/send', {
        number: patientPhone,
        text: message
      });

      if (response.success) {
        showSuccess('Mensagem enviada com sucesso para o WhatsApp do paciente!', 'Envio Concluído');
        if ((response as any).usedDefaultDevice) {
          showInfo('Mensagem enviada pelo dispositivo padrão. Conecte seu WhatsApp em Conexão para enviar pelo seu número.', 'WhatsApp');
        }
      } else {
        showError('Erro ao enviar mensagem. Tente novamente.', 'Erro');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      showError('Erro ao enviar mensagem. Tente novamente.', 'Erro');
    } finally {
      setSendingWhatsapp(false);
    }
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
    const selectedPatientData = patients.find(p => p.id === selectedPatient);

    return (
      <div className="sala-consulta-container">
        {/* Título "Sala da Consulta" */}
        <div className="sala-consulta-header">
          <h1 className="sala-consulta-title">Sala da Consulta</h1>
        </div>

        {/* Botão Voltar */}
        <button
          className="btn-voltar-consulta"
          onClick={() => {
            // Se a sala já foi criada, apenas voltar para o formulário (não chamar onCancel)
            if (roomCreated) {
              setRoomCreated(false);
              setRoomData(null);
            } else {
              // Se ainda não criou a sala, chamar onCancel para voltar à página anterior
              if (onCancel) onCancel();
            }
          }}
        >
          <img src="/arrow-left.svg" alt="Voltar" className="btn-voltar-icon" />
          <span>Voltar</span>
        </button>

        {/* Card principal branco */}
        <div className="sala-consulta-main-card">
          {/* Seção de informações do paciente */}
          <div className="sala-consulta-patient-info">
            {/* Foto do paciente */}
            <div className="sala-consulta-patient-photo">
              {selectedPatientData?.profile_pic ? (
                <img
                  src={selectedPatientData.profile_pic}
                  alt={selectedPatientData.name}
                  className="sala-consulta-patient-photo-img"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="sala-consulta-patient-photo-placeholder">
                  {selectedPatientData?.name?.charAt(0).toUpperCase() || roomData?.patientName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>

            {/* Nome, telefone e badges */}
            <div className="sala-consulta-patient-details">
              <div className="sala-consulta-patient-name-row">
                <h2 className="sala-consulta-patient-name">
                  {selectedPatientData?.name || roomData?.patientName || 'Paciente'}
                </h2>
                <div className="sala-consulta-patient-badges">
                  <button className="sala-consulta-badge-btn sala-consulta-badge-retorno">
                    {patientReturnType === 'novo' ? 'Novo' : 'Retorno'}
                  </button>
                  <button className="sala-consulta-badge-btn sala-consulta-badge-online">
                    {consultationType === 'online' ? 'Online' : 'Presencial'}
                  </button>
                </div>
              </div>
              <p className="sala-consulta-patient-phone">
                {selectedPatientData?.phone || 'Telefone não cadastrado'}
              </p>
            </div>
          </div>

          {/* Linha divisória */}
          <div className="sala-consulta-divider"></div>

          {/* Três cards */}
          <div className="sala-consulta-cards-row">
            {/* Card 1: Compartilhar Link (WhatsApp) */}
            <div className="sala-consulta-card">
              <div className="sala-consulta-card-icon-container">
                <img src="/whatsapp.svg" alt="WhatsApp" className="sala-consulta-card-icon" />
              </div>
              <p className="sala-consulta-card-text">
                Compartilhe o link abaixo com seu paciente
              </p>

              <button
                className="sala-consulta-btn-whatsapp"
                onClick={() => handleSendWhatsApp(roomData.participantRoomUrl, roomData.patientName, roomData.patientData?.phone)}
                disabled={sendingWhatsapp}
                style={{ opacity: sendingWhatsapp ? 0.7 : 1, cursor: sendingWhatsapp ? 'not-allowed' : 'pointer' }}
              >
                {sendingWhatsapp ? 'Enviando...' : 'Enviar para o Whatsapp'}
              </button>

              <button
                className="sala-consulta-btn-copy-link"
                onClick={() => handleCopyLink(roomData.participantRoomUrl)}
              >
                <img src="/document-copy.svg" alt="Copiar" className="sala-consulta-copy-icon" />
                Copiar link do Paciente
              </button>
            </div>

            {/* Card 2: Permissões (Câmera e Microfone) */}
            <div className="sala-consulta-card">
              <div className="sala-consulta-card-icon-container sala-consulta-icon-permissions">
                <img src="/consentimento.svg" alt="Câmera e Microfone" className="sala-consulta-card-icon-permissions" />
              </div>
              <div className="sala-consulta-card-text-container-permissions">
                <p className="sala-consulta-card-text sala-consulta-card-text-permissions-main">
                  Não esqueça de permitir a utilização da câmera e microfone.
                </p>
                <p className="sala-consulta-card-text sala-consulta-card-text-permissions-help">
                  Certifique-se de estar em um ambiente silencioso e bem iluminado, isso garante uma experiência mais agradável para consulta
                </p>
              </div>
            </div>

            {/* Card 3: Entrar na Consulta */}
            <div className="sala-consulta-card">
              <div className="sala-consulta-card-icon-container sala-consulta-icon-login">
                <img src="/login.svg" alt="Entrar" className="sala-consulta-card-icon-login" />
              </div>
              <button
                className="sala-consulta-btn-enter"
                onClick={() => handleEnterRoom(roomData.hostRoomUrl)}
              >
                Entrar na Consulta
                <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.42499 2.54999L13.3396 7.49999L7.42499 12.45" stroke="currentColor" strokeWidth="1.24902" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="sala-consulta-warning-text">
                ⚠ Caso ninguém entre na sala nos próximos 5 minutos a sessão será encerrada automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedPatientData = patients.find(p => p.id === selectedPatient);

  return (
    <div className="create-consultation-container">
      {/* Título "Nova Consulta" com ícone */}
      <div className="nova-consulta-header">
        <h1 className="nova-consulta-title">Nova Consulta</h1>
        <svg className="nova-consulta-add-icon" viewBox="0 0 24 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.125 3.125V10.125H4.125V11.875H11.125V18.875H12.875V11.875H19.875V10.125H12.875V3.125H11.125Z" fill="currentColor" />
        </svg>
      </div>

      {/* Aviso de consulta em andamento */}
      {activeConsultationBlock && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: '#92400E', marginBottom: '4px', fontSize: '15px' }}>
              Você já tem uma consulta em andamento
            </p>
            <p style={{ color: '#92400E', fontSize: '14px', marginBottom: '12px' }}>
              Paciente: <strong>{activeConsultationBlock.patient_name}</strong>. Finalize a consulta atual antes de iniciar uma nova.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/consultas?consulta_id=${activeConsultationBlock.id}`)}
              style={{
                background: '#D97706',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Retornar à Consulta
            </button>
          </div>
        </div>
      )}

      {/* Container dos três cards */}
      <form id="consultation-form" onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }} className="consultation-cards-container">
        {/* Card 1: Selecionar Paciente */}
        <div className="consultation-card">
          <div className="card-title-wrapper">
            <h2 className="card-title">Selecionar Paciente</h2>
            <span className="card-title-asterisk">*</span>
          </div>

          <div className="patient-search-container" ref={patientSearchRef}>
            <div className="patient-search-box">
              <svg className="patient-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                className="patient-search-input"
                placeholder={loadingPatients ? 'Carregando pacientes...' : 'Digite o nome do paciente...'}
                value={patientSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setPatientSearch(val);
                  setShowPatientDropdown(true);
                  if (selectedPatient) {
                    setSelectedPatient('');
                  }
                }}
                onFocus={() => setShowPatientDropdown(true)}
                disabled={loadingPatients || loadingDoctor || isFromAgendamento}
                autoComplete="off"
              />
              {patientSearch && (
                <button
                  type="button"
                  className="patient-search-clear"
                  onClick={() => {
                    setPatientSearch('');
                    setSelectedPatient('');
                    setShowPatientDropdown(false);
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {showPatientDropdown && !selectedPatient && (() => {
              const filtered = patientSearch
                ? patients.filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase()))
                : patients;
              if (filtered.length === 0) {
                return (
                  <ul className="patient-search-dropdown">
                    <li className="patient-search-item patient-search-empty">
                      Nenhum paciente encontrado
                    </li>
                  </ul>
                );
              }
              return (
                <ul className="patient-search-dropdown">
                  {filtered.map((patient) => {
                    // Highlight do texto que deu match
                    const name = patient.name;
                    const idx = patientSearch ? name.toLowerCase().indexOf(patientSearch.toLowerCase()) : -1;
                    return (
                      <li
                        key={patient.id}
                        className="patient-search-item"
                        onMouseDown={() => {
                          setSelectedPatient(patient.id);
                          setPatientSearch(patient.name);
                          setShowPatientDropdown(false);
                        }}
                      >
                        {idx >= 0 ? (
                          <>
                            {name.slice(0, idx)}
                            <strong>{name.slice(idx, idx + patientSearch.length)}</strong>
                            {name.slice(idx + patientSearch.length)}
                          </>
                        ) : (
                          name
                        )}
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            <input type="hidden" name="selectedPatient" value={selectedPatient} required />
          </div>

          {/* Foto do paciente */}
          <div className="patient-photo-container">
            {selectedPatientData?.profile_pic ? (
              <img
                src={selectedPatientData.profile_pic}
                alt={selectedPatientData.name}
                className="patient-photo"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="patient-photo-placeholder">
                {selectedPatientData?.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Dropdown Retorno */}
          <select
            value={patientReturnType}
            onChange={(e) => setPatientReturnType(e.target.value as 'novo' | 'retorno')}
            className="retorno-select"
          >
            <option value="novo">Novo</option>
            <option value="retorno">Retorno</option>
          </select>

          <p className="help-text">
            Selecione se o paciente está sendo consultado pela primeira vez ou se é retorno
          </p>
        </div>

        {/* Card 2: Tipo de Atendimento */}
        <div className="consultation-card">
          <div className="card-title-wrapper">
            <h2 className="card-title">Tipo de Atendimento</h2>
            <span className="card-title-asterisk">*</span>
          </div>

          <select
            value={consultationType}
            onChange={(e) => setConsultationType(e.target.value as 'online' | 'presencial')}
            className="form-select-figma"
            required
          >
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </select>

          {/* Ícone circular */}
          <div className="icon-circle-container">
            <div className="icon-circle cam-mic-circle">
              <img
                src={isDarkMode ? "/display.svg" : "/cam-mic.svg"}
                alt="Câmera e Microfone"
                className="cam-mic-icon"
              />
            </div>
          </div>

          {/* Checkbox de consentimento */}
          <label className="consent-checkbox-figma">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span className="checkbox-text-figma">
              Eu confirmo que o paciente foi informado e consentiu com a gravação e transcrição da consulta para fins médicos e de análise.
            </span>
          </label>
        </div>

        {/* Card 3: Microfone do Profissional ou Agendamento */}
        <div className="consultation-card">
          {creationType === 'agendamento' ? (
            <>
              <div className="card-title-wrapper">
                <h2 className="card-title">Data e Horário do Agendamento</h2>
                <span className="card-title-asterisk">*</span>
              </div>

              {/* Campo de Data */}
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="scheduled-date" className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  Data da Consulta
                </label>
                <input
                  type="date"
                  id="scheduled-date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="form-select-figma"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  style={{ width: '100%', padding: '12px', fontSize: '14px', border: '1px solid #D1D5DB', borderRadius: '8px' }}
                />
              </div>

              {/* Campo de Hora */}
              <div>
                <label htmlFor="scheduled-time" className="form-label" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  Horário da Consulta
                </label>
                <input
                  type="time"
                  id="scheduled-time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="form-select-figma"
                  required
                  style={{ width: '100%', padding: '12px', fontSize: '14px', border: '1px solid #D1D5DB', borderRadius: '8px' }}
                />
              </div>

              {/* Ícone circular do calendário */}
              <div className="icon-circle-container">
                <div className="icon-circle">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '32px', height: '32px', color: '#1B4266' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <p className="help-text">
                Selecione a data e horário para agendar a consulta
              </p>
            </>
          ) : consultationType === 'presencial' && creationType === 'instantanea' ? (
            <>
              <div className="card-title-wrapper">
                <h2 className="card-title">Configuração de Microfone</h2>
              </div>

              {/* Toggle single/dual */}
              <div style={{ display: 'flex', gap: 8, marginBottom: showDualMicWarning ? 0 : 16 }}>
                <button
                  type="button"
                  onClick={() => { setPresencialMicMode('single'); setShowDualMicWarning(false); }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: presencialMicMode === 'single' ? '#1B4266' : '#F1F5F9',
                    color: presencialMicMode === 'single' ? '#fff' : '#64748B',
                  }}
                >
                  1 Microfone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (presencialMicMode === 'single') {
                      setShowDualMicWarning(true);
                      return;
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: presencialMicMode === 'dual' ? '#1B4266' : '#F1F5F9',
                    color: presencialMicMode === 'dual' ? '#fff' : '#64748B',
                  }}
                >
                  2 Microfones
                </button>
              </div>

              {/* Aviso inline ao mudar para 2 microfones */}
              {showDualMicWarning && (
                <div style={{
                  margin: '12px 0 16px', padding: '14px 16px', borderRadius: 10,
                  background: '#FEF3C7', border: '1.5px solid #FCD34D',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>Mudar para 2 microfones?</div>
                      <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5, margin: 0 }}>
                        Você precisará selecionar um microfone para o profissional e outro para o paciente. Use este modo quando cada pessoa tiver seu próprio microfone.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button type="button" onClick={() => { setPresencialMicMode('dual'); setShowDualMicWarning(false); }}
                          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#D97706', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Sim, mudar
                        </button>
                        <button type="button" onClick={() => setShowDualMicWarning(false)}
                          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #FCD34D', background: '#fff', color: '#92400E', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {presencialMicMode === 'single' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: '#374151' }}>Microfone</label>
                  <select
                    value={presencialDoctorMic}
                    onChange={(e) => setPresencialDoctorMic(e.target.value)}
                    className="form-select-figma"
                  >
                    <option value="">Selecione o Microfone</option>
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Um microfone captura o áudio de ambos (profissional e paciente)</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Microfone do Profissional</label>
                    <select
                      value={presencialDoctorMic}
                      onChange={(e) => setPresencialDoctorMic(e.target.value)}
                      className="form-select-figma"
                    >
                      <option value="">Selecione</option>
                      {microphones.map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Microfone do Paciente</label>
                    <select
                      value={presencialPatientMic}
                      onChange={(e) => setPresencialPatientMic(e.target.value)}
                      className="form-select-figma"
                    >
                      <option value="">Selecione</option>
                      {microphones.filter(m => m.deviceId !== presencialDoctorMic).map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <p className="help-text" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 12 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                {presencialMicMode === 'single' ? 'Modo microfone único — captura todo o áudio da sala' : 'Modo dois microfones — um para cada participante'}
              </p>
            </>
          ) : consultationType === 'online' && creationType === 'instantanea' ? (
            <>
              <div className="card-title-wrapper">
                <h2 className="card-title">Microfone do Profissional</h2>
                <span className="card-title-asterisk">*</span>
              </div>

              <select
                value={selectedMicrophone}
                onChange={(e) => setSelectedMicrophone(e.target.value)}
                className="form-select-figma"
                required
              >
                <option value="">Selecione o Microfone</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </option>
                ))}
              </select>

              {/* Ícone circular do microfone */}
              <div className="icon-circle-container">
                <div className="icon-circle">
                  <img
                    src={isDarkMode ? "/mic.svg" : "/microphone-2.svg"}
                    alt="Microfone"
                    className="microphone-icon"
                  />
                </div>
              </div>

              {/* Barra de progresso de áudio */}
              <div className="audio-progress-container">
                <div className="audio-progress-bar">
                  <div className="audio-progress-fill" style={{ width: `${audioLevel}%` }}></div>
                </div>
                <img
                  src="/muted-mic.svg"
                  alt={isAudioMuted ? "Microfone mudo" : "Microfone ativo"}
                  className={`audio-mute-icon ${isAudioMuted ? 'muted' : 'active'}`}
                />
              </div>

              <p className="help-text">
                Não esqueça de permitir o uso do microfone em seu navegador
              </p>
            </>
          ) : null}
        </div>
      </form>

      {/* Botao Iniciar Consulta */}
      {!isFromAgendamento && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
          <button
            type="submit"
            form="consultation-form"
            onClick={(e) => {
              e.preventDefault();
              handleCreateRoom();
            }}
            disabled={
              isCreatingRoom ||
              loadingPatients ||
              loadingDoctor ||
              !selectedPatient ||
              !consent ||
              (consultationType === 'online' && !selectedMicrophone)
            }
            style={{
              padding: '14px 36px',
              borderRadius: 10,
              border: 'none',
              background: '#22c55e',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
              opacity: (isCreatingRoom || !selectedPatient || !consent || (consultationType === 'online' && !selectedMicrophone)) ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#16a34a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#22c55e'; }}
          >
            {isCreatingRoom ? 'Criando...' : 'Iniciar Consulta'}
          </button>
        </div>
      )}

      {isCreatingRoom && (
        <div className="loading-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div className="spinner"></div>
          <p>Criando consulta...</p>
        </div>
      )}
    </div>
  );
}
