'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AudioProcessor } from './AudioProcessor';
import { TranscriptionManager } from './TranscriptionManager';
import './webrtc-styles.css';

interface ConsultationRoomProps {
  roomId: string;
  role?: 'host' | 'participant';
  userType?: 'doctor' | 'patient';
  patientId?: string;
  patientName?: string;
  onEndCall?: () => void;
}

export function ConsultationRoom({ 
  roomId, 
  role, 
  userType = 'doctor',
  patientId, 
  patientName, 
  onEndCall 
}: ConsultationRoomProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'host' | 'participant' | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState('Desconectado');
  const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);
  const [showAnswerButton, setShowAnswerButton] = useState(false);
  
  // Estados para modal do paciente - igual ao projeto original
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Estados para botão Answer - igual ao projeto original
  const [offerData, setOfferData] = useState<any>(null);
  
  // Refs para WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  // Refs para transcrição
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const transcriptionManagerRef = useRef<TranscriptionManager | null>(null);
  
  // Fila de ICE candidates pendentes
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  // Variáveis WebRTC
  const [didIOffer, setDidIOffer] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('');
  
  // ✅ CORREÇÃO: Refs para valores sempre atualizados (evitar closure)
  const didOfferRef = useRef<boolean>(false);
  const userNameRef = useRef<string>('');
  const remoteUserNameRef = useRef<string>('');
  const roomIdRef = useRef<string>(roomId);

  // Configuração WebRTC
  const peerConfiguration = {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302'
        ]
      }
    ]
  };

  // Função para carregar Socket.IO dinamicamente
  const loadSocketIO = async () => {
      try {
        // Se Socket.IO já está carregado, usar diretamente
        if (window.io) {
          console.log('Socket.IO já disponível, conectando...');
          connectSocket();
        } else {
          // Carregar Socket.IO do backend (mesmo domínio)
          console.log('Carregando Socket.IO do servidor...');
          const script = document.createElement('script');
          script.src = `${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/socket.io/socket.io.js`;
          script.onload = () => {
            console.log('Socket.IO carregado com sucesso');
            connectSocket();
          };
          script.onerror = () => {
            console.error('Erro ao carregar Socket.IO');
            alert('Erro ao carregar Socket.IO do servidor. Verifique se o backend está rodando.');
          };
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('Erro ao carregar Socket.IO:', error);
        alert('Erro ao carregar Socket.IO: ' + error);
      }
    };

  const connectSocket = () => {
      if (window.io) {
        console.log('Conectando ao servidor Socket.IO...');
        const tempUserName = userName || 'Temp-' + Math.floor(Math.random() * 100000);
        socketRef.current = window.io.connect(
          process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001',
          {
            auth: {
              userName: tempUserName,
              password: "x"
            }
          }
        );

        socketRef.current.on('connect', () => {
          console.log('✅ Conexão estabelecida com o servidor');
          setIsConnected(true);
          setupSocketListeners();
        });

        socketRef.current.on('connect_error', (error: any) => {
          console.error('❌ Erro ao conectar:', error);
          alert('Erro ao conectar com o servidor: ' + error.message);
        });

        socketRef.current.on('disconnect', () => {
          console.log('🔌 Desconectado do servidor');
          setIsConnected(false);
        });
      } else {
        console.error('Socket.IO não está disponível após carregamento');
        alert('Erro: Socket.IO não carregado. Recarregue a página.');
      }
    };

  // ✅ CORREÇÃO: Atualizar refs quando valores mudarem
  useEffect(() => {
    didOfferRef.current = didIOffer;
    console.log('🔄 didOfferRef atualizado:', didOfferRef.current);
  }, [didIOffer]);

  useEffect(() => {
    userNameRef.current = userName;
    console.log('🔄 userNameRef atualizado:', userNameRef.current);
  }, [userName]);

  useEffect(() => {
    remoteUserNameRef.current = remoteUserName;
    console.log('🔄 remoteUserNameRef atualizado:', remoteUserNameRef.current);
  }, [remoteUserName]);

  // ✅ CORREÇÃO: Função para configurar callbacks (será chamada após criar TranscriptionManager)
  const setupTranscriptionCallbacks = () => {
    if (!transcriptionManagerRef.current) {
      console.warn('⚠️ [TRANSCRIPTION] TranscriptionManager não existe ainda');
      return;
    }

    console.log('🔧 [TRANSCRIPTION] Configurando callbacks...');
    
    // ✅ NOVO: Callback quando recebe nova transcrição (transcript puro)
    transcriptionManagerRef.current.onTranscriptUpdate = (transcript: string) => {
      console.log('🎤 [TRANSCRIPTION] Recebido transcript:', transcript);
      console.log('🎤 [TRANSCRIPTION] didOfferRef.current:', didOfferRef.current);
      console.log('🎤 [TRANSCRIPTION] userType:', userType);
      console.log('🎤 [TRANSCRIPTION] userNameRef.current:', userNameRef.current);
      console.log('🎤 [TRANSCRIPTION] remoteUserNameRef.current:', remoteUserNameRef.current);
      
      // CASO 1: Sou o OFFERER (médico) - exibir localmente
      if (didOfferRef.current === true) {
        console.log('✅ Sou OFFERER - exibindo localmente');
        // Adicionar à UI usando método público do TranscriptionManager
        if (transcriptionManagerRef.current) {
          transcriptionManagerRef.current.addTranscriptToUI(transcript, userNameRef.current || 'Você');
        }
      } 
      // CASO 2: Sou o ANSWERER (paciente) - enviar para offerer, NUNCA exibir
      else if (didOfferRef.current === false && remoteUserNameRef.current) {
        console.log('✅ Sou ANSWERER - enviando para offerer:', remoteUserNameRef.current);
        
        // Enviar transcrição para o peer via socket
        if (socketRef.current && roomIdRef.current && userNameRef.current) {
          socketRef.current.emit('sendTranscriptionToPeer', {
            roomId: roomIdRef.current,
            from: userNameRef.current,
            to: remoteUserNameRef.current,
            transcription: transcript,
            timestamp: new Date().toISOString()
          });
          console.log('📤 [TRANSCRIPTION] Enviado para peer');
        } else {
          console.error('❌ [TRANSCRIPTION] Socket, roomId ou userName não disponível');
        }
      } else {
        console.warn('⚠️ [TRANSCRIPTION] Nenhuma condição atendida (possível erro de inicialização)');
        console.warn('⚠️ [TRANSCRIPTION] didOfferRef:', didOfferRef.current, 'remoteUserNameRef:', remoteUserNameRef.current);
      }
    };
    
    // ✅ NOVO: Callback para atualizar UI (texto completo formatado)
    transcriptionManagerRef.current.onUIUpdate = (fullText: string) => {
      console.log('📝 [TRANSCRIPTION] Atualizando UI com texto completo');
      setTranscriptionText(fullText);
    };
    
    console.log('✅ [TRANSCRIPTION] Callbacks configurados');
  };

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current.disconnect();
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Determinar nome do usuário baseado no userType - igual ao projeto original
  useEffect(() => {
    if (userType === 'doctor') {
      // Médico: usar nome salvo ou prompt
      let savedHostName = localStorage.getItem('hostName');
      if (!savedHostName) {
        const prompted = prompt('Digite seu nome (Médico):');
        if (prompted && prompted.trim()) {
          savedHostName = prompted.trim();
          localStorage.setItem('hostName', savedHostName);
        }
      }
      
      if (savedHostName) {
        setUserName(savedHostName);
      } else {
        alert('Erro: Nome do médico não informado. Recarregue a página.');
      }
    } else if (userType === 'patient') {
      // Paciente: mostrar modal para digitar nome - igual ao projeto original
      console.log('🩺 [PACIENTE] Definindo showParticipantModal = true');
      setShowParticipantModal(true);
      // Inicializar Socket.IO para paciente também
      loadSocketIO();
    }
  }, [userType]);

  // Inicializar conexão Socket.IO quando userName for definido
  useEffect(() => {
    if (userName && !socketRef.current) {
      loadSocketIO();
    }
  }, [userName]);

  // Entrar na sala quando conectar como médico
  useEffect(() => {
    if (userName && userType === 'doctor' && isConnected) {
      joinRoomAsHost();
    }
  }, [userName, userType, isConnected]);

  // Função para entrar como médico (host) - igual ao projeto original
  const joinRoomAsHost = async () => {
    console.log('👨‍⚕️ [MÉDICO] Entrando como HOST:', userName);
    
    if (socketRef.current) {
      socketRef.current.emit('joinRoom', {
        roomId: roomId,
        participantName: userName
      }, (response: any) => {
        if (response.success) {
          setUserRole(response.role);
          setRoomData(response.roomData);
          console.log('👨‍⚕️ [MÉDICO] ✅ Entrou na sala como HOST');
          
          // Inicializar mídia e transcrição
          fetchUserMedia().then(() => {
            console.log('👨‍⚕️ [MÉDICO] ✅ fetchUserMedia concluído na entrada da sala');
            return initializeTranscription();
          }).then(() => {
            console.log('👨‍⚕️ [MÉDICO] ✅ Transcrição inicializada');
          });
        } else {
          alert('Erro ao entrar na sala: ' + response.error);
        }
      });
    }
  };

  // Função para entrar como paciente (participant) - igual ao projeto original
  const joinRoomAsParticipant = async (participantName: string) => {
    console.log('🩺 [PACIENTE] Entrando como PARTICIPANTE:', participantName);
    setUserName(participantName);
    
    if (socketRef.current) {
      socketRef.current.emit('joinRoom', {
        roomId: roomId,
        participantName: participantName
      }, (response: any) => {
        if (response.success) {
          setUserRole(response.role);
          setRoomData(response.roomData);
          setShowParticipantModal(false);
          console.log('🩺 [PACIENTE] ✅ Entrou na sala como PARTICIPANTE');
          
          // Inicializar apenas transcrição - IGUAL AO PROJETO ORIGINAL
          // Transcrição será ativada apenas quando clicar "Answer"
          initializeTranscription();
        } else {
          setErrorMessage(response.error);
        }
      });
    } else {
      setErrorMessage('Erro: Socket não conectado. Aguarde...');
      // Tentar conectar novamente
      setTimeout(() => {
        if (socketRef.current) {
          joinRoomAsParticipant(participantName);
        }
      }, 1000);
    }
  };

  // Função para inicializar transcrição - igual ao projeto original
  const initializeTranscription = () => {
    return new Promise((resolve) => {
      if (transcriptionManagerRef.current && socketRef.current) {
        transcriptionManagerRef.current.setSocket(socketRef.current);
        
        // Definir variáveis globais para transcription.js acessar
        (window as any).userName = userName;
        (window as any).currentRoomId = roomId;
        
        resolve(true);
      } else {
        resolve(false);
      }
    });
  };

  // Função para lidar com o clique no botão "Entrar na Sala"
  const handleJoinRoom = () => {
    const name = participantName.trim();
    if (name) {
      joinRoomAsParticipant(name);
    } else {
      setErrorMessage('Por favor, digite seu nome');
    }
  };


  const autoActivateTranscriptionForParticipant = async () => {
    console.log('🎤 [PACIENTE] Ativando transcrição automaticamente...');
    
    // ✅ PROTEÇÃO: Evitar múltiplas ativações
    if (isTranscriptionActive) {
      console.log('🎤 [PACIENTE] ⚠️ Transcrição já ativa, ignorando...');
      return;
    }
    
    try {
      if (!transcriptionManagerRef.current) {
        console.log('🎤 [PACIENTE] ❌ TranscriptionManager não inicializado');
        return;
      }

      if (!socketRef.current || !socketRef.current.connected) {
        console.log('🎤 [PACIENTE] ❌ Socket não conectado, aguardando...');
        // Aguardar socket conectar
        const waitForSocket = setInterval(() => {
          if (socketRef.current && socketRef.current.connected) {
            clearInterval(waitForSocket);
            autoActivateTranscriptionForParticipant();
          }
        }, 500);
        
        setTimeout(() => clearInterval(waitForSocket), 10000);
        return;
      }

      // Conectar à OpenAI
      console.log('🎤 [PACIENTE] Conectando à OpenAI...');
      const success = await transcriptionManagerRef.current.init();
      
      if (success) {
        console.log('🎤 [PACIENTE] ✅ Transcrição conectada (aguardando AudioProcessor)');
        setTranscriptionStatus('Conectado');
        
        // Verificar a cada 500ms se audioProcessor está pronto
        const checkAudioProcessor = setInterval(() => {
          if (audioProcessorRef.current && audioProcessorRef.current.getStatus().initialized) {
            console.log('🎤 [PACIENTE] ✅ AudioProcessor pronto, iniciando transcrição...');
            clearInterval(checkAudioProcessor);
            
            transcriptionManagerRef.current!.start();
            setIsTranscriptionActive(true);
            setTranscriptionStatus('Transcrevendo');
          }
        }, 500);
        
        // Timeout de 10 segundos
        setTimeout(() => {
          clearInterval(checkAudioProcessor);
        }, 10000);
      } else {
        console.log('🎤 [PACIENTE] ❌ Falha ao conectar transcrição');
        setTranscriptionStatus('Erro');
      }
    } catch (error) {
      console.error('🎤 [PACIENTE] ❌ Erro ao ativar transcrição automática:', error);
      setTranscriptionStatus('Erro');
    }
  };

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    // Participante entrou (apenas host recebe)
    socketRef.current.on('participantJoined', (data: any) => {
      console.log('Participante entrou:', data.participantName);
      setParticipantName(data.participantName);
    });

    // Sala foi finalizada
    socketRef.current.on('roomEnded', (data: any) => {
      alert(data.message);
      router.push('/consulta/nova');
    });

    // WebRTC listeners
    socketRef.current.on('newOfferAwaiting', (data: any) => {
      console.log('Nova oferta recebida da sala:', data.roomId);
      if (data.roomId === roomId) {
        setRemoteUserName(data.offererUserName);
        createAnswerButton(data);
      }
    });

    socketRef.current.on('answerResponse', (data: any) => {
      console.log('Resposta recebida da sala:', data.roomId);
      if (data.roomId === roomId) {
        addAnswer(data);
      }
    });

    socketRef.current.on('receivedIceCandidateFromServer', (iceCandidate: any) => {
      console.log('ICE candidate recebido:', iceCandidate);
      addIceCandidate(iceCandidate);
    });

    // ✅ CORREÇÃO: Médico recebe transcrições e exibe usando método público
    if (userType === 'doctor') {
      socketRef.current.on('receiveTranscriptionFromPeer', (data: any) => {
        console.log('👨‍⚕️ [MÉDICO] Transcrição recebida de', data.from, ':', data.transcription);
        
        // Adicionar à UI usando método público do TranscriptionManager
        if (transcriptionManagerRef.current) {
          transcriptionManagerRef.current.addTranscriptToUI(data.transcription, data.from);
        }
      });
    }

    // Para pacientes: criar botão Answer - IGUAL AO PROJETO ORIGINAL
    if (userType === 'patient') {
      socketRef.current.on('newOfferAwaiting', (data: any) => {
        console.log('🩺 [PACIENTE] Oferta recebida via newOfferAwaiting, criando botão Answer...');
        // Criar botão Answer IGUAL AO PROJETO ORIGINAL
        createAnswerButton(data);
      });
    }
  };

  const joinRoom = () => {
    if (!socketRef.current || !userName) return;

    socketRef.current.emit('joinRoom', {
      roomId: roomId,
      participantName: userName
    }, (response: any) => {
      if (response.success) {
        setUserRole(response.role);
        setRoomData(response.roomData);
        setIsConnected(true);
        console.log('✅ Entrou na sala como', response.role);
        
        // Mostrar participante se já entrou
        if (response.roomData.participantUserName) {
          setParticipantName(response.roomData.participantUserName);
        }
      } else {
        alert('Erro ao entrar na sala: ' + response.error);
        router.push('/consulta/nova');
      }
    });
  };

  // WebRTC Functions
  const call = async () => {
    console.log('👨‍⚕️ [MÉDICO] Iniciando chamada...');
    
    // Verificar se socket está conectado
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Erro: Não conectado ao servidor. Aguarde a conexão...');
      return;
    }

    console.log('👨‍⚕️ [MÉDICO] 1. Chamando fetchUserMedia...');
    await fetchUserMedia();
    console.log('👨‍⚕️ [MÉDICO] ✅ fetchUserMedia concluído');

    console.log('👨‍⚕️ [MÉDICO] 2. Chamando createPeerConnection...');
    await createPeerConnection();
    console.log('👨‍⚕️ [MÉDICO] ✅ createPeerConnection concluído');

    try {
      console.log('👨‍⚕️ [MÉDICO] 3. Criando oferta para sala:', roomId);
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);
      
      // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente
      setDidIOffer(true);
      didOfferRef.current = true;
      setIsCallActive(true);
      console.log('👨‍⚕️ [MÉDICO] ✅ Offer criado, didIOffer definido como TRUE');
      console.log('👨‍⚕️ [MÉDICO] ✅ didOfferRef.current:', didOfferRef.current);
      
      // Enviar oferta com roomId
      console.log('👨‍⚕️ [MÉDICO] 4. Enviando newOffer...');
      socketRef.current.emit('newOffer', {
        roomId: roomId,
        offer: offer
      });
      console.log('👨‍⚕️ [MÉDICO] ✅ newOffer enviado');
    } catch(err) {
      console.error('👨‍⚕️ [MÉDICO] ❌ Erro:', err);
      alert('Erro ao iniciar chamada: ' + err);
    }
  };

  const answer = async () => {
    console.log('🩺 [PACIENTE] Clicou no botão Answer - IGUAL AO PROJETO ORIGINAL');
    
    // Verificar se socket está conectado
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Erro: Não conectado ao servidor. Aguarde a conexão...');
      return;
    }

    if (!offerData) {
      console.error('❌ Dados da oferta não encontrados');
      return;
    }

    try {
      // Usar dados da oferta armazenados - IGUAL AO PROJETO ORIGINAL
      await answerOffer(offerData);
      
      // Ativar transcrição automaticamente após Answer - IGUAL AO PROJETO ORIGINAL
      autoActivateTranscriptionForParticipant();
      
      setShowAnswerButton(false);
      setIsCallActive(true);
      console.log('🩺 [PACIENTE] ✅ Answer processado com sucesso');
    } catch(err) {
      console.error('❌ Erro ao responder chamada:', err);
      alert('Erro ao responder chamada: ' + err);
    }
  };

  const answerOffer = async (offerData: any) => {
    console.log('🩺 [PACIENTE] Processando oferta - IGUAL AO PROJETO ORIGINAL...');
    console.log('🩺 [PACIENTE] OfferData:', offerData);
    
    try {
      // 1. fetchUserMedia - igual ao projeto original
      await fetchUserMedia();
      
      // 2. createPeerConnection - igual ao projeto original
      await createPeerConnection({ offer: offerData.offer });
  
      
      // 3. Criar e enviar resposta - igual ao projeto original
      const answer = await peerConnectionRef.current!.createAnswer({});
      await peerConnectionRef.current!.setLocalDescription(answer);
      
      // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente
      setRemoteUserName(offerData.offererUserName);
      remoteUserNameRef.current = offerData.offererUserName;
      console.log('🩺 [PACIENTE] ✅ remoteUserName definido:', offerData.offererUserName);
      console.log('🩺 [PACIENTE] ✅ remoteUserNameRef.current:', remoteUserNameRef.current);
      
      // Processar ICE candidates pendentes
      processPendingIceCandidates();
      
      // Enviar resposta com roomId - igual ao projeto original
      socketRef.current.emit('newAnswer', {
        roomId: roomId,
        answer: answer
      }, (offerIceCandidates: any[]) => {
        offerIceCandidates.forEach(c => {
          addIceCandidate(c);
        });
      });
      
    } catch (error) {
      console.error('🩺 [PACIENTE] ❌ Erro ao processar oferta:', error);
    }
  };

  const addIceCandidate = async (iceCandidate: any) => {
    if (!peerConnectionRef.current) {
      console.log('PeerConnection não existe, adicionando ICE candidate à fila');
      pendingIceCandidatesRef.current.push(iceCandidate);
      return;
    }

    // Verificar se remoteDescription foi definida
    if (!peerConnectionRef.current.remoteDescription) {
      console.log('RemoteDescription não definida, adicionando ICE candidate à fila');
      pendingIceCandidatesRef.current.push(iceCandidate);
      return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(iceCandidate);
      console.log('✅ ICE candidate adicionado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao adicionar ICE candidate:', error);
    }
  };

  const processPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || pendingIceCandidatesRef.current.length === 0) {
      return;
    }

    console.log(`Processando ${pendingIceCandidatesRef.current.length} ICE candidates pendentes`);
    
    for (const iceCandidate of pendingIceCandidatesRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(iceCandidate);
        console.log('✅ ICE candidate pendente processado');
      } catch (error) {
        console.error('❌ Erro ao processar ICE candidate pendente:', error);
      }
    }
    
    // Limpar fila
    pendingIceCandidatesRef.current = [];
  };

  const addAnswer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(data.answer);
      // Processar ICE candidates pendentes após definir remoteDescription
      processPendingIceCandidates();
    }
  };

  const fetchUserMedia = async () => {
    // ✅ PROTEÇÃO: Evitar múltiplas chamadas
    if (localStreamRef.current) {
      console.log('📹 [MÍDIA] Stream já existe, reutilizando...');
      return;
    }
    
    try {
      console.log('📹 [MÍDIA] Obtendo stream de mídia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      localStreamRef.current = stream;
      
      // Inicializar AudioProcessor para transcrição (apenas uma vez)
      if (!audioProcessorRef.current) {
        console.log('Inicializando AudioProcessor...');
        audioProcessorRef.current = new AudioProcessor();
        await audioProcessorRef.current.init(stream);
        
        // Inicializar TranscriptionManager (apenas uma vez)
        if (!transcriptionManagerRef.current) {
          console.log('Inicializando TranscriptionManager...');
          transcriptionManagerRef.current = new TranscriptionManager();
          transcriptionManagerRef.current.setSocket(socketRef.current);
          transcriptionManagerRef.current.setAudioProcessor(audioProcessorRef.current);
          
          // ✅ CORREÇÃO: Configurar callbacks IMEDIATAMENTE após criar
          setupTranscriptionCallbacks();
        }
      } else {
        console.log('AudioProcessor já inicializado, reutilizando...');
      }
    } catch(err) {
      console.error('Erro ao obter mídia:', err);
    }
  };

  const createPeerConnection = async (offerObj?: any) => {
    console.log('🔗 [WEBRTC] Criando PeerConnection...');
    peerConnectionRef.current = new RTCPeerConnection(peerConfiguration);
    
    // ✅ CORREÇÃO: Criar remoteStream igual ao projeto original
    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log('🔗 [WEBRTC] Stream local disponível com', tracks.length, 'tracks');
      
      tracks.forEach((track, index) => {
        console.log(`🔗 [WEBRTC] Adicionando track ${index}:`, track.kind, track.enabled);
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
      });
      
      // Verificar senders após adicionar tracks
      const senders = peerConnectionRef.current.getSenders();
      console.log('🔗 [WEBRTC] Senders criados:', senders.length);
    } else {
      console.log('🔗 [WEBRTC] ❌ Stream local não disponível');
    }

    peerConnectionRef.current.addEventListener('icecandidate', e => {
      if(e.candidate) {
        socketRef.current.emit('sendIceCandidateToSignalingServer', {
          roomId: roomId,
          iceCandidate: e.candidate,
          iceUserName: userName,
          didIOffer,
        });
      }
    });
    
    // ✅ CORREÇÃO: Event 'track' igual ao projeto original
    peerConnectionRef.current.addEventListener('track', e => {
      console.log('🔗 [WEBRTC] Track remoto recebido:', e.track.kind, e.track.enabled);
      console.log('🔗 [WEBRTC] Streams recebidos:', e.streams.length);
      
      // Adicionar tracks ao remoteStream igual ao projeto original
      if (e.streams[0] && remoteStreamRef.current) {
        e.streams[0].getTracks().forEach(track => {
          console.log('🔗 [WEBRTC] Adicionando track remoto:', track.kind);
          remoteStreamRef.current!.addTrack(track);
        });
      }
    });

    if(offerObj) {
      await peerConnectionRef.current.setRemoteDescription(offerObj.offer);
      // Processar ICE candidates pendentes após definir remoteDescription
      processPendingIceCandidates();
    }
  };

  // Função IGUAL AO PROJETO ORIGINAL
  const createAnswerButton = (offerData: any) => {
    console.log('🩺 [PACIENTE] Criando botão Answer para:', offerData.offererUserName);
    setShowAnswerButton(true);
    
    // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente
    setRemoteUserName(offerData.offererUserName);
    remoteUserNameRef.current = offerData.offererUserName;
    
    // Armazenar dados da oferta para usar quando clicar Answer
    setOfferData(offerData);
    
    console.log('🩺 [PACIENTE] ✅ remoteUserName definido (createAnswerButton):', offerData.offererUserName);
  };

  // Controles de mídia
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const endCall = () => {
    // Parar transcrição
    if (transcriptionManagerRef.current) {
      transcriptionManagerRef.current.stop();
      transcriptionManagerRef.current.disconnect();
    }
    
    // Limpar AudioProcessor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
    }
    
    // Parar streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    setIsCallActive(false);
    setTranscriptionStatus('Desconectado');
    setIsTranscriptionActive(false);
    onEndCall?.();
  };

  const toggleTranscription = async () => {
    if (!transcriptionManagerRef.current) {
      alert('Transcrição não inicializada. Faça a chamada primeiro.');
      return;
    }

    if (!isTranscriptionActive) {
      // Conectar transcrição
      setTranscriptionStatus('Conectando...');
      
      const success = await transcriptionManagerRef.current.init();
      
      if (success) {
        setTranscriptionStatus('Conectado');
        setIsTranscriptionActive(true);
        
        // Iniciar transcrição automaticamente
        transcriptionManagerRef.current.start();
        setTranscriptionStatus('Transcrevendo');
      } else {
        setTranscriptionStatus('Erro');
      }
    } else {
      // Parar transcrição
      transcriptionManagerRef.current.stop();
      setTranscriptionStatus('Desconectado');
      setIsTranscriptionActive(false);
    }
  };

  const endRoom = () => {
    if (confirm('Tem certeza que deseja finalizar esta sala? As transcrições serão salvas.')) {
      socketRef.current.emit('endRoom', {
        roomId: roomId
      }, (response: any) => {
        if (response.success) {
          alert('✅ Sala finalizada!\n\n💾 Transcrições salvas no banco de dados\n📝 Total: ' + response.saveResult.transcriptionsCount + ' transcrições');
          router.push('/consulta/nova');
        } else {
          alert('Erro ao finalizar sala: ' + response.error);
        }
      });
    }
  };

  // Loading state - só mostrar se for médico sem nome
  if (userType === 'doctor' && !userName) {
    return (
      <div className="consultation-room-loading">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="consultation-room-container">
      {/* Header */}
      <div className="room-header">
        <div className="room-info">
          <h1>Consulta Online - {userType === 'doctor' ? 'Médico' : 'Paciente'}</h1>
          <p>
            Sala: {roomData?.roomName || roomId} | 
            Paciente: {patientName || participantName} | 
            Status: <span className={isConnected ? 'status-connected' : 'status-disconnected'}>
              {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
            </span>
          </p>
        </div>
        
        <div className="room-controls">
          {userType === 'doctor' && !isCallActive && (
            <button className="btn-call" onClick={call}>
              Call
            </button>
          )}
          
          {userType === 'doctor' && (
            <button 
              className="btn-transcription" 
              onClick={toggleTranscription}
            >
              {isTranscriptionActive ? 'Parar Transcrição' : 'Ativar Transcrição'}
            </button>
          )}
          
          {userType === 'doctor' && (
            <button className="btn-end-room" onClick={endRoom}>
              Finalizar Sala
            </button>
          )}

          {userType === 'patient' && showAnswerButton && (
            <button className="btn-answer" onClick={answer}>
              Answer
            </button>
          )}

        </div>
      </div>

      {/* Layout de vídeos */}
      <div className="video-layout">
        {/* Container principal com vídeo remoto e local sobreposto */}
        <div className="video-main-container">
          <span className="video-label">Vídeo Remoto</span>
          <video 
            className="video-player" 
            id="remote-video" 
            ref={remoteVideoRef}
            autoPlay 
            playsInline
          ></video>
          
          {/* Vídeo local sobreposto */}
          <div className="video-local-overlay">
            <span className="video-label">Seu Vídeo</span>
            <video 
              className="video-player" 
              id="local-video" 
              ref={localVideoRef}
              autoPlay 
              playsInline 
              muted
            ></video>
          </div>
          
          {/* Controles de mídia */}
          <div className="media-controls">
            <button 
              className="media-btn active" 
              onClick={toggleCamera}
              title="Câmera"
            >
              📹
            </button>
            <button 
              className="media-btn active" 
              onClick={toggleMicrophone}
              title="Microfone"
            >
              🎤
            </button>
            <button 
              className="media-btn end-call" 
              onClick={endCall}
              title="Desligar"
            >
              📞
            </button>
          </div>
        </div>

        {/* Sidebar - Médicos sempre veem, pacientes só durante chamada */}
        {(userType === 'doctor' || (userType === 'patient' && isCallActive)) && (
          <div className="video-sidebar">
            {/* Section de Sugestões - Apenas para médicos */}
            {userType === 'doctor' && (
              <div className="suggestions-box">
                <h6>Sugestões</h6>
                <div className="suggestions-content">
                  <p className="text-muted">As sugestões médicas aparecerão aqui baseadas na transcrição da consulta.</p>
                </div>
              </div>
            )}

            {/* Section de Transcrição - APENAS para médicos */}
            {userType === 'doctor' && (
              <div className="transcription-box">
              <div className="transcription-header">
                <h6>
                  Transcrição
                  <span className={`badge ${transcriptionStatus === 'Conectado' ? 'bg-success' : 'bg-secondary'}`}>
                    {transcriptionStatus}
                  </span>
                </h6>
              </div>
              <textarea 
                className="transcription-textarea"
                value={transcriptionText}
                readOnly
                placeholder="A transcrição aparecerá aqui..."
              />
              <div className="transcription-info">
                {transcriptionStatus === 'Conectado' ? 'Fale algo... a transcrição aparecerá abaixo' : 'Aguardando conexão...'}
              </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal do participante - igual ao projeto original */}
      {showParticipantModal && (
        <div className="participant-form">
          <div className="participant-form-content">
            <h3>Digite seu nome para entrar na sala</h3>
            <input
              type="text"
              placeholder="Seu nome"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinRoom();
                }
              }}
            />
            <button onClick={handleJoinRoom}>
              Entrar na Sala
            </button>
            {errorMessage && (
              <div className="error-message" style={{ display: 'block' }}>
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
