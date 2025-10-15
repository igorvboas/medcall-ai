'use client';



import { useState, useEffect, useRef } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AudioProcessor } from './AudioProcessor';

import { TranscriptionManager } from './TranscriptionManager';

import { SuggestionsPanel } from './SuggestionsPanel';

import './webrtc-styles.css';

import { getPatientNameById } from '@/lib/supabase';
import { Video, Mic, CheckCircle } from 'lucide-react';



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

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  

  // Estados para modal do paciente - igual ao projeto original

  const [showParticipantModal, setShowParticipantModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  

  // Estados para botão Answer - igual ao projeto original

  const [offerData, setOfferData] = useState<any>(null);

  

  // Estados para sugestões de IA

  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  

  // Estado para modal de finalização

  const [showFinishModal, setShowFinishModal] = useState(false);
  
  // Estado para loading da finalização da sala
  const [isEndingRoom, setIsEndingRoom] = useState(false);

  

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

  const searchParams = useSearchParams();



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

  console.log('🟢 userName inicial:', userName);

  

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

              role: userType === 'doctor' ? 'host' : 'participant',

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

      //console.log('🎤 [TRANSCRIPTION] didOfferRef.current:', didOfferRef.current);
      //console.log('🎤 [TRANSCRIPTION] userType:', userType);
      //console.log('🎤 [TRANSCRIPTION] userNameRef.current:', userNameRef.current);
      //console.log('🎤 [TRANSCRIPTION] remoteUserNameRef.current:', remoteUserNameRef.current);
      

      // CASO 1: Sou o OFFERER (médico) - exibir localmente

      if (didOfferRef.current === true) {

        //console.log('✅ Sou OFFERER - exibindo localmente');
        // Adicionar à UI usando método público do TranscriptionManager

        if (transcriptionManagerRef.current) {

          transcriptionManagerRef.current.addTranscriptToUI(transcript, userNameRef.current || 'Você');

        }

      } 

      // CASO 2: Sou o ANSWERER (paciente) - enviar para offerer, NUNCA exibir

      else if (didOfferRef.current === false && remoteUserNameRef.current) {

        //console.log('✅ Sou ANSWERER - enviando para offerer:', remoteUserNameRef.current);
        

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

    

    //console.log('✅ [TRANSCRIPTION] Callbacks configurados');
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



  // Determinar nome do usuário baseado no userType

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

      // Paciente: auto-join lendo o id do paciente da URL e buscando nome

      console.log('🩺 [PACIENTE] Auto-join habilitado');

      loadSocketIO();



      const urlPatientId = searchParams?.get('id_paciente') || searchParams?.get('patientId') || patientId || '';

      const fallbackName = searchParams?.get('patientName') || patientName || '';



      (async () => {

        try {

          let resolvedName = fallbackName;

          if (!resolvedName && urlPatientId) {

            try {
            const fetchedName = await getPatientNameById(urlPatientId);

            resolvedName = fetchedName || '';

            } catch (err) {
              // ✅ Silenciar erro de busca de nome (não crítico)
              console.warn('⚠️ Não foi possível buscar nome do paciente no banco. Usando fallback.');
              resolvedName = '';
            }
          }



          if (!resolvedName) {

            console.warn('⚠️ Nome do paciente não encontrado. Usando "Paciente".');

            resolvedName = 'Paciente';

          }



          setParticipantName(resolvedName);

          // Aguardar pequeno tempo para garantir que o socket conecte

          const tryJoin = () => {

            if (socketRef.current) {

              joinRoomAsParticipant(resolvedName);

            } else {

              setTimeout(tryJoin, 200);

            }

          };

          tryJoin();

        } catch (e) {

          console.error('❌ Erro no auto-join do paciente:', e);

          setErrorMessage('Erro ao preparar a participação na sala. Recarregue a página.');

          setShowParticipantModal(true);

        }

      })();

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



  // ✅ AUTO-INICIAR: Iniciar chamada automaticamente quando médico entrar na sala

  useEffect(() => {

    if (userType === 'doctor' && userRole === 'host' && !isCallActive && !didIOffer && socketRef.current?.connected) {

      console.log('🚀 [AUTO-INICIAR] Iniciando chamada automaticamente para o médico...');

      // Aguardar um momento para garantir que tudo está pronto

      const timer = setTimeout(() => {

        call();

      }, 1500); // 1.5 segundos de delay para garantir que mídia e conexão estão prontas

      

      return () => clearTimeout(timer);

    }

  }, [userType, userRole, isCallActive, didIOffer]);



  // Função para entrar como médico (host) - igual ao projeto original

  const joinRoomAsHost = async () => {

    //console.log('👨‍⚕️ [MÉDICO] Entrando como HOST:', userName);
    

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

      }, async (response: any) => {
        if (response.success) {

          setUserRole(response.role);

          setRoomData(response.roomData);

          setShowParticipantModal(false);

          console.log('🩺 [PACIENTE] ✅ Entrou na sala como PARTICIPANTE');

          

          // ✅ FIX: Inicializar mídia E transcrição para o paciente
          console.log('🩺 [PACIENTE] Inicializando mídia...');
          await fetchUserMedia();
          console.log('🩺 [PACIENTE] ✅ Mídia inicializada');
          
          // Inicializar transcrição
          await initializeTranscription();
          console.log('🩺 [PACIENTE] ✅ Transcrição inicializada');
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

      if (userType === 'doctor') {

        // Médico: redireciona para nova consulta

        alert(data.message);

        router.push('/consulta/nova');

      } else {

        // Paciente: mostra modal de finalização

        setShowFinishModal(true);

      }

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



      // 🤖 SUGESTÕES DE IA: Médico recebe sugestões geradas pela IA

      socketRef.current.on('ai:suggestions', (data: any) => {

        console.log('🤖 [MÉDICO] Sugestões de IA recebidas:', data.suggestions.length);

        setAiSuggestions(data.suggestions);

      });

    }



    // Para pacientes: criar botão Answer - IGUAL AO PROJETO ORIGINAL

    if (userType === 'patient') {

      socketRef.current.on('newOfferAwaiting', (data: any) => {

        //console.log('🩺 [PACIENTE] Oferta recebida via newOfferAwaiting, criando botão Answer...');
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

    //console.log('👨‍⚕️ [MÉDICO] Iniciando chamada...');
    

    // Verificar se socket está conectado

    if (!socketRef.current || !socketRef.current.connected) {

      alert('Erro: Não conectado ao servidor. Aguarde a conexão...');

      return;

    }



    //console.log('👨‍⚕️ [MÉDICO] 1. Chamando fetchUserMedia...');
    await fetchUserMedia();

    //console.log('👨‍⚕️ [MÉDICO] ✅ fetchUserMedia concluído');


    //console.log('👨‍⚕️ [MÉDICO] 2. Chamando createPeerConnection...');
    await createPeerConnection();

    //console.log('👨‍⚕️ [MÉDICO] ✅ createPeerConnection concluído');


    try {

      //console.log('👨‍⚕️ [MÉDICO] 3. Criando oferta para sala:', roomId);
      const offer = await peerConnectionRef.current!.createOffer();

      await peerConnectionRef.current!.setLocalDescription(offer);

      

      // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente

      setDidIOffer(true);

      didOfferRef.current = true;

      setIsCallActive(true);

      //console.log('👨‍⚕️ [MÉDICO] ✅ Offer criado, didIOffer definido como TRUE');
      //console.log('👨‍⚕️ [MÉDICO] ✅ didOfferRef.current:', didOfferRef.current);
      

      // Enviar oferta com roomId

      //console.log('👨‍⚕️ [MÉDICO] 4. Enviando newOffer...');
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

    //console.log('🩺 [PACIENTE] Clicou no botão Answer - IGUAL AO PROJETO ORIGINAL');
    

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

      //console.log('🩺 [PACIENTE] ✅ Answer processado com sucesso');
    } catch(err) {

      console.error('❌ Erro ao responder chamada:', err);

      alert('Erro ao responder chamada: ' + err);

    }

  };



  const answerOffer = async (offerData: any) => {

    //console.log('🩺 [PACIENTE] Processando oferta - IGUAL AO PROJETO ORIGINAL...');
    //console.log('🩺 [PACIENTE] OfferData:', offerData);
    

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

      //console.log('🩺 [PACIENTE] ✅ remoteUserName definido:', offerData.offererUserName);
      //console.log('🩺 [PACIENTE] ✅ remoteUserNameRef.current:', remoteUserNameRef.current);
      

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

      const currentState = peerConnectionRef.current.signalingState;
      //console.log('👨‍⚕️ [MÉDICO] addAnswer - Estado atual:', currentState);
      
      // ✅ PROTEÇÃO: Só definir remoteDescription se estiver no estado correto
      if (currentState === 'have-local-offer') {
        //console.log('👨‍⚕️ [MÉDICO] ✅ Estado correto (have-local-offer), definindo answer...');
      await peerConnectionRef.current.setRemoteDescription(data.answer);

        //console.log('👨‍⚕️ [MÉDICO] ✅ Answer definido com sucesso');
        //console.log('👨‍⚕️ [MÉDICO] Novo estado:', peerConnectionRef.current.signalingState);
        
      // Processar ICE candidates pendentes após definir remoteDescription

      processPendingIceCandidates();

      } else if (currentState === 'stable') {
        console.log('👨‍⚕️ [MÉDICO] ⚠️ Conexão já está estabelecida (stable), ignorando answer duplicado');
      } else {
        console.warn('👨‍⚕️ [MÉDICO] ⚠️ Estado inesperado ao receber answer:', currentState);
      }
    }

  };



  const fetchUserMedia = async () => {

    // ✅ PROTEÇÃO: Evitar múltiplas chamadas

    if (localStreamRef.current) {

      console.log('📹 [MÍDIA] Stream já existe, reutilizando...');

      return;

    }

    

    try {

      //console.log('📹 [MÍDIA] Obtendo stream de mídia...');
      
      // ✅ NOVO: Tentar primeiro com preferências específicas
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (error) {
        // Se falhar com preferências, tentar sem
        console.warn('📹 [MÍDIA] Falha com preferências, tentando configuração básica...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }

      
      //console.log('📹 [MÍDIA] Stream obtido:', stream);
      console.log('📹 [MÍDIA] Tracks:', stream.getTracks().map(t => `${t.kind} - ${t.enabled}`));
      

      if (localVideoRef.current) {

        localVideoRef.current.srcObject = stream;

        console.log('📹 [MÍDIA] ✅ Stream local atribuído ao elemento de vídeo');
      } else {
        console.warn('📹 [MÍDIA] ⚠️ localVideoRef.current não existe!');
      }

      localStreamRef.current = stream;

      // Configurar estados iniciais dos controles
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled);
      }
      
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled);
      }

      // Inicializar AudioProcessor para transcrição (apenas uma vez)

      if (!audioProcessorRef.current) {

        //console.log('Inicializando AudioProcessor...');
        audioProcessorRef.current = new AudioProcessor();

        await audioProcessorRef.current.init(stream);

        

        // Inicializar TranscriptionManager (apenas uma vez)

        if (!transcriptionManagerRef.current) {

          //console.log('Inicializando TranscriptionManager...');
          transcriptionManagerRef.current = new TranscriptionManager();

          transcriptionManagerRef.current.setSocket(socketRef.current);

          transcriptionManagerRef.current.setAudioProcessor(audioProcessorRef.current);

          

          // ✅ CORREÇÃO: Configurar callbacks IMEDIATAMENTE após criar

          setupTranscriptionCallbacks();

        }

      } else {

        //console.log('AudioProcessor já inicializado, reutilizando...');
      }

    } catch(err) {

      console.error('❌ Erro ao obter mídia:', err);
      
      // ✅ NOVO: Se erro for "Device in use", tentar liberar e tentar novamente
      if (err instanceof DOMException && err.name === 'NotReadableError') {
        console.warn('⚠️ Dispositivo em uso. Tentando liberar e tentar novamente...');
        
        // Liberar qualquer stream anterior que possa estar travado
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
        
        // Aguardar um pouco e tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          console.log('✅ Stream obtido após retry');
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          localStreamRef.current = stream;
          
          // Inicializar AudioProcessor
          if (!audioProcessorRef.current) {
            audioProcessorRef.current = new AudioProcessor();
            await audioProcessorRef.current.init(stream);
            
            if (!transcriptionManagerRef.current) {
              transcriptionManagerRef.current = new TranscriptionManager();
              transcriptionManagerRef.current.setSocket(socketRef.current);
              transcriptionManagerRef.current.setAudioProcessor(audioProcessorRef.current);
              setupTranscriptionCallbacks();
            }
          }
        } catch (retryErr) {
          console.error('❌ Falha no retry:', retryErr);
          alert('Não foi possível acessar a câmera/microfone. Verifique as permissões do navegador.');
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        alert('Erro ao acessar câmera/microfone: ' + errorMessage);
      }
    }

  };



  const createPeerConnection = async (offerObj?: any) => {
    

    // ✅ NOVO: Verificar se stream local existe antes de criar PeerConnection
    if (!localStreamRef.current) {
      console.error('❌ [WEBRTC] Não é possível criar PeerConnection sem stream local');
      throw new Error('Stream local não disponível');
    }

    peerConnectionRef.current = new RTCPeerConnection(peerConfiguration);

    

    // ✅ Monitorar estado da conexão
    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log('🔗 [WEBRTC] Connection state:', peerConnectionRef.current?.connectionState);
    };
    
    peerConnectionRef.current.oniceconnectionstatechange = () => {
      console.log('🔗 [WEBRTC] ICE connection state:', peerConnectionRef.current?.iceConnectionState);
    };
    
    peerConnectionRef.current.onsignalingstatechange = () => {
      console.log('🔗 [WEBRTC] Signaling state:', peerConnectionRef.current?.signalingState);
    };
    
    // ✅ CORREÇÃO: Criar remoteStream vazio (será preenchido quando receber tracks)
    remoteStreamRef.current = new MediaStream();

    console.log('🔗 [WEBRTC] RemoteStream criado (vazio inicialmente)');
    

    if (localStreamRef.current) {

      const tracks = localStreamRef.current.getTracks();

      // console.log('🔗 [WEBRTC] Stream local disponível com', tracks.length, 'tracks');
      //console.log('🔗 [WEBRTC] userType:', userType);
      

      tracks.forEach((track, index) => {

        //console.log(`🔗 [WEBRTC] Adicionando track ${index}:`, track.kind, track.enabled, 'readyState:', track.readyState);
        const sender = peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
        //console.log(`🔗 [WEBRTC] ✅ Sender criado para track ${track.kind}:`, sender);
      });

      

      // Verificar senders após adicionar tracks

      const senders = peerConnectionRef.current.getSenders();

      //console.log('🔗 [WEBRTC] Total de senders criados:', senders.length);
      senders.forEach((sender, idx) => {
        //console.log(`🔗 [WEBRTC] Sender ${idx}:`, sender.track?.kind, 'enabled:', sender.track?.enabled);
      });
    } else {

      console.error('🔗 [WEBRTC] ❌ Stream local NÃO disponível!');
      console.error('🔗 [WEBRTC] localStreamRef.current:', localStreamRef.current);
    }



    // ✅ CORREÇÃO: Usar onicecandidate ao invés de addEventListener
    peerConnectionRef.current.onicecandidate = (e) => {
      if(e.candidate) {

        //console.log('🔗 [ICE] Enviando ICE candidate:', e.candidate.type);
        socketRef.current.emit('sendIceCandidateToSignalingServer', {

          roomId: roomId,

          iceCandidate: e.candidate,

          iceUserName: userName,

          didIOffer,

        });

      }

    };
    
    // ✅ CORREÇÃO: Usar ontrack ao invés de addEventListener
    peerConnectionRef.current.ontrack = (e) => {
      //console.log('🔗 [WEBRTC] 🎉 TRACK EVENTO DISPARADO!');
      //console.log('🔗 [WEBRTC] Track remoto recebido:', e.track.kind, 'enabled:', e.track.enabled, 'readyState:', e.track.readyState);
      //console.log('🔗 [WEBRTC] Streams recebidos:', e.streams.length);
      //console.log('🔗 [WEBRTC] Stream[0]:', e.streams[0]);
      //console.log('🔗 [WEBRTC] userType:', userType);
      
      // ✅ FIX: Atribuir o stream remoto diretamente ao elemento de vídeo
      if (e.streams && e.streams[0]) {
        //console.log('🔗 [WEBRTC] ✅ Atribuindo stream remoto ao elemento de vídeo');
        //console.log('🔗 [WEBRTC] remoteVideoRef.current existe?', !!remoteVideoRef.current);
        
        if (remoteVideoRef.current) {
          // ✅ FIX: Só atribuir se for um stream diferente
          const currentStream = remoteVideoRef.current.srcObject as MediaStream;
          if (!currentStream || currentStream.id !== e.streams[0].id) {
            console.log('🔗 [WEBRTC] Atribuindo novo stream (id:', e.streams[0].id, ')');
            remoteVideoRef.current.srcObject = e.streams[0];
            remoteStreamRef.current = e.streams[0];
            
            // Forçar reprodução após um pequeno delay
            setTimeout(() => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.play().then(() => {
                  console.log('🔗 [WEBRTC] ✅ Vídeo remoto começou a reproduzir');
                }).catch(err => {
                  // ✅ CORREÇÃO: Silenciar erro de autoplay (comum e não crítico)
                  if (err.name === 'NotAllowedError') {
                    console.warn('🔗 [WEBRTC] ⚠️ Autoplay bloqueado pelo navegador (normal)');
                    // Tentar novamente após interação do usuário
                    const handleUserInteraction = () => {
                      remoteVideoRef.current?.play().catch(() => {});
                      document.removeEventListener('click', handleUserInteraction);
                      document.removeEventListener('touchstart', handleUserInteraction);
                    };
                    document.addEventListener('click', handleUserInteraction, { once: true });
                    document.addEventListener('touchstart', handleUserInteraction, { once: true });
                  } else {
                    console.error('🔗 [WEBRTC] ❌ Erro ao reproduzir vídeo remoto:', err);
                    // Tentar novamente
                    setTimeout(() => {
                      remoteVideoRef.current?.play().catch(e => console.error('Retry falhou:', e));
                    }, 100);
                  }
                });
              }
            }, 100);
            
            console.log('🔗 [WEBRTC] ✅ Stream remoto atribuído com sucesso');
          } else {
            console.log('🔗 [WEBRTC] ℹ️ Stream já está atribuído (mesmo ID)');
          }
        } else {
          console.error('🔗 [WEBRTC] ❌ remoteVideoRef.current não existe!');
        }
      } else {
        console.warn('🔗 [WEBRTC] ⚠️ Nenhum stream recebido no evento track');
      }
    };


    if(offerObj) {

      // ✅ PROTEÇÃO: Verificar estado antes de setRemoteDescription
      const currentState = peerConnectionRef.current.signalingState;
      //console.log('🔗 [WEBRTC] Estado atual da conexão:', currentState);
      //console.log('🔗 [WEBRTC] Tipo de oferta:', offerObj.offer?.type);
      
      // ✅ CORREÇÃO: Para ANSWERER, só definir remoteDescription se estiver em 'stable' (estado inicial)
      // Se já estiver em 'have-remote-offer', significa que já foi definido
      if (currentState === 'stable') {
        //console.log('🔗 [WEBRTC] ✅ Estado correto (stable), definindo remoteDescription...');
      await peerConnectionRef.current.setRemoteDescription(offerObj.offer);

        //console.log('🔗 [WEBRTC] ✅ remoteDescription definido com sucesso');
        //console.log('🔗 [WEBRTC] Novo estado:', peerConnectionRef.current.signalingState);
      } else if (currentState === 'have-remote-offer') {
        console.log('🔗 [WEBRTC] ⚠️ remoteDescription já está definido (estado: have-remote-offer)');
      } else {
        console.warn('🔗 [WEBRTC] ⚠️ Estado inesperado:', currentState);
      }
      
      // Processar ICE candidates pendentes após definir remoteDescription

      processPendingIceCandidates();

    }

  };



  // ✅ MODIFICADO: Auto-executar Answer automaticamente
  const createAnswerButton = (offerData: any) => {

    //console.log('🩺 [PACIENTE] Oferta recebida de:', offerData.offererUserName);
    //console.log('🩺 [PACIENTE] 🚀 AUTO-ANSWER: Executando fluxo automaticamente...');
    
    // ✅ PROTEÇÃO: Evitar processar múltiplas ofertas
    if (isCallActive) {
      console.warn('⚠️ [AUTO-ANSWER] Chamada já está ativa, ignorando nova oferta');
      return;
    }
    
    // ✅ PROTEÇÃO: Verificar se já existe uma PeerConnection ativa
    if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'closed') {
      console.warn('⚠️ [AUTO-ANSWER] PeerConnection já existe, ignorando nova oferta');
      return;
    }
    

    // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente

    setRemoteUserName(offerData.offererUserName);

    remoteUserNameRef.current = offerData.offererUserName;

    

    // Armazenar dados da oferta
    setOfferData(offerData);

    

    //console.log('🩺 [PACIENTE] ✅ remoteUserName definido (createAnswerButton):', offerData.offererUserName);
    
    // 🚀 AUTO-EXECUTAR: Chamar answer() automaticamente após pequeno delay
    // O delay garante que todos os estados foram atualizados
    setTimeout(async () => {
      //console.log('🩺 [PACIENTE] 🚀 AUTO-ANSWER: Iniciando resposta automática...');
      
      // Verificar se socket está conectado
      if (!socketRef.current || !socketRef.current.connected) {
        console.error('❌ [AUTO-ANSWER] Socket não conectado');
        // Tentar novamente após 1 segundo
        setTimeout(() => createAnswerButton(offerData), 1000);
        return;
      }

      if (!offerData) {
        console.error('❌ [AUTO-ANSWER] Dados da oferta não encontrados');
        return;
      }

      try {
        // Executar o mesmo fluxo do botão Answer
        await answerOffer(offerData);
        
        // Ativar transcrição automaticamente
        autoActivateTranscriptionForParticipant();
        
        setShowAnswerButton(false);
        setIsCallActive(true);
        //console.log('🩺 [PACIENTE] ✅ AUTO-ANSWER: Resposta automática processada com sucesso');
      } catch(err) {
        console.error('❌ [AUTO-ANSWER] Erro ao responder chamada automaticamente:', err);
        // Em caso de erro, mostrar botão manual como fallback
        setShowAnswerButton(true);
      }
    }, 500); // 500ms de delay para garantir que tudo está pronto
  };



  // Controles de mídia

  const toggleCamera = () => {

    if (localStreamRef.current) {

      const videoTrack = localStreamRef.current.getVideoTracks()[0];

      if (videoTrack) {

        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);

      }

    }

  };



  const toggleMicrophone = () => {

    if (localStreamRef.current) {

      const audioTrack = localStreamRef.current.getAudioTracks()[0];

      if (audioTrack) {

        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);

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



  const endRoom = async () => {

    if (confirm('Tem certeza que deseja finalizar esta sala? As transcrições serão salvas.')) {

      // 🔍 DEBUG [REFERENCIA] Iniciando processo de finalização da sala
      console.log('🔍 DEBUG [REFERENCIA] Iniciando finalização da sala...');
      setIsEndingRoom(true);

      socketRef.current.emit('endRoom', {

        roomId: roomId

      }, async (response: any) => {

        if (response.success) {

          // ✅ Enviar transcrição para o webhook ANTES do redirect (aguardar envio)
          try {
              // Usar o cliente Supabase já configurado do app (mantém sessão/cookies)
              const { supabase } = await import('@/lib/supabase');
              const { data: { session } } = await supabase.auth.getSession();

              // Tentar obter doctorId via tabela medicos com o usuário autenticado
              let doctorId: string | null = null;
              if (session?.user?.id) {
                const { data: medico } = await supabase
                  .from('medicos')
                  .select('id')
                  .eq('user_auth', session.user.id)
                  .single();
                doctorId = medico?.id || null;
              }

              // Resolver consultationId pela call_sessions; fallback para última do médico; por fim roomId
              let consultationId: string | null = null;
              const { data: callSession } = await supabase
                .from('call_sessions')
                .select('consultation_id')
                .or(`room_name.eq.${roomId},livekit_room_id.eq.${roomId}`)
                .single();
              consultationId = callSession?.consultation_id || null;

              if (!consultationId && doctorId) {
                const { data: consultation } = await supabase
                  .from('consultations')
                  .select('id')
                  .eq('doctor_id', doctorId)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single();
                consultationId = consultation?.id || null;
              }

              if (!consultationId) consultationId = roomId;

              const webhookUrl = 'https://webhook.tc1.triacompany.com.br/webhook/usi-input-transcricao';
              const webhookData = {
                consultationId,
                doctorId: doctorId || null,
                patientId: patientId || 'unknown',
                transcription: transcriptionText
              };

              await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookData),
                keepalive: true
              }).catch(() => {});
            } catch (_) {
              // Silenciar erros (não bloquear UI)
            }

          // 🔍 DEBUG [REFERENCIA] Sala finalizada com sucesso
          console.log('🔍 DEBUG [REFERENCIA] Sala finalizada com sucesso');
          setIsEndingRoom(false);

          alert('✅ Sala finalizada!\n\n💾 Transcrições salvas no banco de dados\n📝 Total: ' + response.saveResult.transcriptionsCount + ' transcrições');

          router.push('/consulta/nova');

        } else {

          // 🔍 DEBUG [REFERENCIA] Erro ao finalizar sala
          console.log('🔍 DEBUG [REFERENCIA] Erro ao finalizar sala:', response.error);
          setIsEndingRoom(false);

          alert('Erro ao finalizar sala: ' + response.error);

        }

      });

    }

  };



  // ✅ CORREÇÃO: Removido early return - deixar useEffects executarem primeiro

  // Loading state agora é controlado pelos useEffects



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
              <span className={isConnected ? 'status-indicator status-indicator-connected' : 'status-indicator status-indicator-disconnected'}></span>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>

          </p>

        </div>

        

        <div className="room-controls">

          {/* ✅ Indicador de auto-início para o médico */}

          {userType === 'doctor' && !isCallActive && (

            <div className="auto-start-indicator">

              <div className="spinner"></div>

              <span>Iniciando consulta automaticamente...</span>

            </div>

          )}

          
          {/* ✅ Indicador de auto-entrada para o paciente */}
          {userType === 'patient' && !isCallActive && !showAnswerButton && (
            <div className="auto-start-indicator">
              <div className="spinner"></div>
              <span>Entrando na consulta automaticamente...</span>
            </div>

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

            <button 
              className="btn-end-room" 
              onClick={endRoom}
              disabled={isEndingRoom}
            >

              {isEndingRoom ? 'Finalizando...' : 'Finalizar Sala'}

            </button>

          )}



          {/* ✅ Botão manual de Answer como fallback (caso auto-answer falhe) */}
          {userType === 'patient' && showAnswerButton && (

            <button className="btn-answer" onClick={answer}>

              Entrar na Consulta
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

              className={`media-btn ${isVideoEnabled ? 'active' : 'disabled'}`}

              onClick={toggleCamera}

              title={isVideoEnabled ? "Desativar Câmera" : "Ativar Câmera"}

            >

              <Video size={20} />

            </button>

            <button 

              className={`media-btn ${isAudioEnabled ? 'active' : 'disabled'}`}

              onClick={toggleMicrophone}

              title={isAudioEnabled ? "Desativar Microfone" : "Ativar Microfone"}

            >

              <Mic size={20} />

            </button>

            

          </div>

        </div>



        {/* Sidebar - APENAS para médicos */}

        {userType === 'doctor' && (

          <div className="video-sidebar">

            {/* Section de Transcrição - APENAS para médicos */}

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

          </div>

        )}

      </div>



      {/* 🤖 Painel de Sugestões de IA - Apenas para médicos */}

      {userType === 'doctor' && aiSuggestions.length > 0 && (

        <SuggestionsPanel

          suggestions={aiSuggestions}

          onUseSuggestion={(suggestionId) => {

            console.log('Sugestão usada:', suggestionId);

            // TODO: Marcar sugestão como usada no backend

            if (socketRef.current) {

              socketRef.current.emit('suggestion:used', {

                suggestionId,

                sessionId: roomId

              });

            }

          }}

          onDismissSuggestion={(suggestionId) => {

            console.log('Sugestão descartada:', suggestionId);

            setAiSuggestions(prev => prev.filter(s => s.id !== suggestionId));

          }}

        />

      )}



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



      {/* Modal de finalização para paciente */}

      {showFinishModal && (

        <div className="finish-modal-overlay">

          <div className="finish-modal-content">

            <div className="finish-modal-icon">
              <CheckCircle size={48} />
            </div>

            <h2>Consulta Finalizada</h2>

            <p>Obrigado por participar da consulta. Você pode fechar esta página.</p>

            <button 

              className="finish-modal-button"

              onClick={() => setShowFinishModal(false)}

            >

              Entendi

            </button>

          </div>

        </div>

      )}

      {/* Loading overlay durante finalização da sala */}

      {isEndingRoom && (

        <div style={{

          position: 'fixed',

          top: 0,

          left: 0,

          right: 0,

          bottom: 0,

          backgroundColor: 'rgba(0, 0, 0, 0.7)',

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

          zIndex: 10000

        }}>

          <div style={{

            backgroundColor: '#1a1a1a',

            padding: '2rem',

            borderRadius: '8px',

            display: 'flex',

            flexDirection: 'column',

            alignItems: 'center',

            gap: '1rem',

            color: '#fff'

          }}>

            <div style={{

              width: '40px',

              height: '40px',

              border: '4px solid #333',

              borderTop: '4px solid #A6CE39',

              borderRadius: '50%',

              animation: 'spin 1s linear infinite'

            }}></div>

            <p style={{ margin: 0, fontSize: '16px' }}>Finalizando sala...</p>

            <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>Salvando transcrições no banco de dados</p>

          </div>

        </div>

      )}

    </div>

  );

}

