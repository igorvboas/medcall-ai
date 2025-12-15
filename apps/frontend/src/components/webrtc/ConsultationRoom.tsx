'use client';



import { useState, useEffect, useRef } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AudioProcessor } from './AudioProcessor';

import { TranscriptionManager } from './TranscriptionManager';

import { SuggestionsPanel } from './SuggestionsPanel';

import './webrtc-styles.css';

import { getPatientNameById } from '@/lib/supabase';
import { Video, Mic, CheckCircle, Copy, Check, Brain, Sparkles, ChevronDown, ChevronUp, MoreVertical, Minimize2, Maximize2 } from 'lucide-react';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';
import { useNotifications } from '@/components/shared/NotificationSystem';



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
  const { showError, showSuccess, showWarning, showInfo } = useNotifications();

  const [userName, setUserName] = useState('');

  const [userRole, setUserRole] = useState<'host' | 'participant' | null>(null);

  const [roomData, setRoomData] = useState<any>(null);

  const [isConnected, setIsConnected] = useState(false);

  const [isReconnecting, setIsReconnecting] = useState(false); // ✅ NOVO: Estado de reconexão

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false); // ✅ NOVO: Flag para saber se já entrou na sala

  const [isCallActive, setIsCallActive] = useState(false);

  const [participantName, setParticipantName] = useState('');
  
  // ✅ NOVO: Estado para controlar se paciente está pronto para entrar
  const [isPatientReadyToJoin, setIsPatientReadyToJoin] = useState(false);

  // ✅ NOVO: Flag quando o navegador bloqueia o autoplay do vídeo remoto
  const [isRemotePlaybackBlocked, setIsRemotePlaybackBlocked] = useState(false);

  const [transcriptionText, setTranscriptionText] = useState('');

  const [transcriptionStatus, setTranscriptionStatus] = useState('Desconectado');

  const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);

  const [showAnswerButton, setShowAnswerButton] = useState(false);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // ✅ NOVO: Timer da chamada (em segundos) - controlado pelo servidor
  const [callDuration, setCallDuration] = useState(0);
  const [isCallTimerActive, setIsCallTimerActive] = useState(false);

  // ✅ NOVO: Estado para controlar se o link foi copiado
  const [linkCopied, setLinkCopied] = useState(false);

  // ✅ NOVO: Estado para notificação de paciente entrando
  const [showPatientJoinedNotification, setShowPatientJoinedNotification] = useState(false);
  const [patientJoinedName, setPatientJoinedName] = useState('');

  

  // Estados para modal do paciente - igual ao projeto original

  const [showParticipantModal, setShowParticipantModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  

  // Estados para botão Answer - igual ao projeto original

  const [offerData, setOfferData] = useState<any>(null);

  

  // Estados para sugestões de IA

  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState<boolean>(true);
  const [suggestionsPanelVisible, setSuggestionsPanelVisible] = useState<boolean>(true);

  // Estado para minimizar transcrição
  const [isTranscriptionMinimized, setIsTranscriptionMinimized] = useState(false);

  // Estado para dropdown de ações
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  

  // Estado para modal de finalização (removido - agora redireciona para página)
  
  // Estado para loading da finalização da sala
  const [isEndingRoom, setIsEndingRoom] = useState(false);

  // Estado para geração de anamnese
  const [isGeneratingAnamnese, setIsGeneratingAnamnese] = useState(false);
  
  // ✅ NOVO: Estado para saber se anamnese está pronta para acessar
  const [anamneseReady, setAnamneseReady] = useState(false);
  
  // ✅ NOVO: ID da consulta atual (para usar no botão "Acessar Anamnese")
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null);

  

  // Refs para WebRTC

  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<any>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);

  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Refs para polling de anamnese
  const anamnesePollingRef = useRef<NodeJS.Timeout | null>(null);
  const anamneseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  

  // Refs para transcrição

  const audioProcessorRef = useRef<AudioProcessor | null>(null);

  const transcriptionManagerRef = useRef<TranscriptionManager | null>(null);

  

  // Fila de ICE candidates pendentes

  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // ✅ NOVO: Fila de offers pendentes (para quando mídia ainda não está pronta)
  
  const pendingOfferRef = useRef<{offer: RTCSessionDescriptionInit, userName: string} | null>(null);
  
  const isMediaReadyRef = useRef<boolean>(false);
  
  // ✅ NOVO: Flag para evitar múltiplas chamadas simultâneas a rejoinRoom
  
  const isRejoiningRef = useRef<boolean>(false);
  
  const hasJoinedRoomRef = useRef<boolean>(false);

  

  // Variáveis WebRTC

  const [didIOffer, setDidIOffer] = useState(false);

  const [remoteUserName, setRemoteUserName] = useState('');

  

  // ✅ CORREÇÃO: Refs para valores sempre atualizados (evitar closure)

  const didOfferRef = useRef<boolean>(false);

  const userNameRef = useRef<string>('');

  const remoteUserNameRef = useRef<string>('');

  const roomIdRef = useRef<string>(roomId);

  const searchParams = useSearchParams();



  // Configuração WebRTC (STUN + opcional TURN via variáveis de ambiente e Twilio)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ]
    }
  ];

  if (turnUrl && turnUsername && turnCredential) {
    // Aceitar lista separada por vírgulas/space e normalizar cada item
    const rawEntries = turnUrl.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const urls: string[] = [];

    rawEntries.forEach(entry => {
      let e = entry;
      const hasScheme = /^turns?:/i.test(e);
      const isTlsPort = /:(5349|443)(\b|$)/.test(e);
      if (!hasScheme) {
        e = `${isTlsPort ? 'turns' : 'turn'}:${e}`;
      }
      // Adicionar variantes UDP/TCP quando não for TLS explícito
      if (/^turns:/i.test(e)) {
        urls.push(e);
      } else {
        urls.push(`${e}?transport=udp`);
        urls.push(`${e}?transport=tcp`);
      }
    });

    // Garantir unicidade
    const uniqueUrls = Array.from(new Set(urls));
    iceServers.push({ urls: uniqueUrls as any, username: turnUsername as string, credential: turnCredential as string });
  }

  // Estado com ICE servers (começa com STUN + eventual TURN do .env)
  const [iceServersState, setIceServersState] = useState<RTCIceServer[]>(iceServers);

  // Buscar credenciais efêmeras da Twilio via gateway (se disponível)
  // ✅ CORREÇÃO: Adicionar ref para evitar múltiplas chamadas
  const turnCredentialsFetchedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // ✅ CORREÇÃO: Evitar múltiplas chamadas
    if (turnCredentialsFetchedRef.current) {
      return;
    }
    turnCredentialsFetchedRef.current = true;
    
    const httpBase = (process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001').replace(/^ws/i, 'http');
    console.log('🔄 [TURN] Buscando credenciais TURN do gateway...');
    
    fetch(`${httpBase}/api/turn-credentials`)
      .then(async (r) => {
        // ✅ CORREÇÃO: Agora o endpoint sempre retorna 200 (com STUN se Twilio não estiver configurado)
        const data = await r.json();
        if (data && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          console.log(`✅ [TURN] ${data.iceServers.length} ICE servers recebidos`);
          setIceServersState(data.iceServers as RTCIceServer[]);
        } else {
          console.warn('⚠️ [TURN] Nenhum ICE server recebido, usando configuração padrão');
        }
      })
      .catch((error) => {
        console.warn('⚠️ [TURN] Erro ao buscar credenciais TURN, usando STUN apenas:', error);
        // Continuar com STUN apenas - não é crítico
      });
  }, []); // ✅ Executar apenas uma vez na montagem

  const peerConfiguration: RTCConfiguration = {
    iceServers: iceServersState
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

            showError('Erro ao carregar Socket.IO do servidor. Verifique se o backend está rodando.', 'Erro de Conexão');

          };

          document.head.appendChild(script);

        }

      } catch (error) {

        console.error('Erro ao carregar Socket.IO:', error);

        showError('Erro ao carregar Socket.IO: ' + error, 'Erro de Conexão');

      }

    };



  // ✅ NOVO: Função para renegociar WebRTC após desconexão

  const renegotiateWebRTC = async () => {

    if (!socketRef.current || !isConnected) {

      console.log('❌ Não é possível renegociar: Socket não conectado');

      return;

    }



    console.log('🔄 RENEGOCIAÇÃO: Iniciando...');
    
    // ✅ CORREÇÃO: Verificar se stream local ainda está disponível
    if (!localStreamRef.current) {
      console.log('❌ RENEGOCIAÇÃO: Stream local não disponível, tentando recriar...');
      try {
        await fetchUserMedia();
      } catch (error) {
        console.error('❌ RENEGOCIAÇÃO: Erro ao recriar stream:', error);
        return;
      }
    }

    

    try {

      // Se for o host (médico), criar nova offer

      if (userType === 'doctor' && didIOffer) {

        console.log('🔄 RENEGOCIAÇÃO: Criando nova offer com ICE restart...');
        
        // ✅ NOVO: Se PeerConnection não existe ou está em estado ruim, recriar
        if (!peerConnectionRef.current || 
            peerConnectionRef.current.connectionState === 'failed' ||
            peerConnectionRef.current.connectionState === 'closed') {
          console.log('🔄 RENEGOCIAÇÃO: PeerConnection não existe ou falhou, recriando...');
          await createPeerConnection();
        }

        const offer = await peerConnectionRef.current!.createOffer({

          iceRestart: true // Força reiniciar ICE (importante para reconexão)

        });

        await peerConnectionRef.current!.setLocalDescription(offer);

        

        socketRef.current.emit('newOffer', {

          roomId: roomId,

          offer: offer

        });

        

        console.log('✅ RENEGOCIAÇÃO: Nova offer enviada!');

      } else {

        console.log('⏳ RENEGOCIAÇÃO: Aguardando nova offer do host...');
        
        // ✅ NOVO: Paciente precisa recriar PeerConnection se estiver em estado failed/closed
        if (!peerConnectionRef.current ||
            peerConnectionRef.current.connectionState === 'failed' ||
            peerConnectionRef.current.connectionState === 'closed' ||
            peerConnectionRef.current.iceConnectionState === 'failed' ||
            peerConnectionRef.current.iceConnectionState === 'closed') {
          console.log('🔄 RENEGOCIAÇÃO: PeerConnection não existe ou falhou, recriando...');
          await createPeerConnection();
          console.log('✅ RENEGOCIAÇÃO: PeerConnection recriado, aguardando offer...');
        }

      }

    } catch (error) {

      console.error('❌ RENEGOCIAÇÃO: Erro ao renegociar:', error);

    }

  };



  // ✅ NOVO: Função para rejuntar à sala após reconexão

  const rejoinRoom = () => {

    if (!socketRef.current || !roomId) return;
    
    // ✅ CORREÇÃO: Evitar múltiplas chamadas simultâneas
    if (isRejoiningRef.current) {
      console.warn('⚠️ rejoinRoom já está em execução, ignorando chamada duplicada');
      return;
    }
    
    // ✅ CORREÇÃO: Evitar rejoin se já entrou na sala
    if (hasJoinedRoomRef.current) {
      console.warn('⚠️ Já está na sala, ignorando rejoinRoom duplicado');
      return;
    }
    
    isRejoiningRef.current = true;
    console.log('🔄 Rejuntando à sala:', roomId, 'como', userType);



    socketRef.current.emit('joinRoom', {

      roomId: roomId,

      participantName: userName

    }, (response: any) => {

      if (response.success) {

        console.log('✅ Rejuntado à sala com sucesso!');
        
        console.log('📊 Room Status:', response.roomData?.status);

        setRoomData(response.roomData);

        setUserRole(response.role);

        setHasJoinedRoom(true); // ✅ Garantir que flag está setada
        
        // ✅ CORREÇÃO: Marcar que entrou na sala e resetar flag de rejoining
        hasJoinedRoomRef.current = true;
        isRejoiningRef.current = false;
        console.log('✅ hasJoinedRoomRef = true, isRejoiningRef = false');

        // ✅ NOVO: Restaurar histórico de transcrições
        if (response.roomData?.transcriptionHistory && response.roomData.transcriptionHistory.length > 0) {

          console.log(`🔄 Restaurando ${response.roomData.transcriptionHistory.length} transcrições históricas...`);
          
          // Restaurar cada transcrição no TranscriptionManager
          if (transcriptionManagerRef.current) {

            response.roomData.transcriptionHistory.forEach((transcription: any) => {

              const displayName = transcription.speaker || 'Desconhecido';

              transcriptionManagerRef.current!.addTranscriptToUI(transcription.text, displayName);

            });

            console.log('✅ Transcrições históricas restauradas!');

          }

        }

        

        // ✅ NOVO: Restaurar WebRTC baseado no status da sala e tipo de usuário
        
        const roomStatus = response.roomData?.status;
        
        // Se a sala está ativa, significa que o WebRTC deve ser reestabelecido
        
        if (roomStatus === 'active' || roomStatus === 'waiting') {
          
          console.log('🔄 Sala estava ativa, restaurando WebRTC...');
          
          // ✅ CORREÇÃO: Ativar chamada para mostrar vídeo
          if (roomStatus === 'active') {
            setIsCallActive(true);
            console.log('✅ [REJOIN] isCallActive = true (sala está ativa)');
          }
          
          // MÉDICO: Reconstruir conexão e criar nova offer
          
          if (userType === 'doctor') {
            
            setTimeout(async () => {
              
              console.log('👨‍⚕️ [RELOAD] Médico reconectando: iniciando chamada...');
              
              try {
                
                // Garantir que mídia está disponível
                
                if (!localStreamRef.current) {
                  
                  await fetchUserMedia();
                  
                }
                
                
                // Criar nova conexão WebRTC
                
                await createPeerConnection();
                
                
                // Criar nova offer
                
                const offer = await peerConnectionRef.current!.createOffer();
                
                await peerConnectionRef.current!.setLocalDescription(offer);
                
                
                setDidIOffer(true);
                
                didOfferRef.current = true;
                
                setIsCallActive(true);
                
                
                // Emitir nova offer para o paciente
                
                socketRef.current!.emit('newOffer', { 
                  
                  offer: offer, 
                  
                  roomId: roomId 
                  
                });
                
                
                console.log('✅ [RELOAD] Nova offer enviada após reload!');
                
              } catch (error) {
                
                console.error('❌ [RELOAD] Erro ao restaurar WebRTC do médico:', error);
                
              }
              
            }, 1500);
            
          } 
          
          // PACIENTE: Aguardar offer do médico
          
          else {
            
            console.log('👤 [RELOAD] Paciente reconectando: aguardando offer...');
            
            setTimeout(async () => {
              
              try {
                
                // Garantir que mídia está disponível
                
                if (!localStreamRef.current) {
                  
                  await fetchUserMedia();
                  
                }
                
                
                // Criar conexão WebRTC (aguardando offer)
                
                await createPeerConnection();
                
                
                console.log('✅ [RELOAD] Paciente pronto para receber offer');
                
              } catch (error) {
                
                console.error('❌ [RELOAD] Erro ao restaurar WebRTC do paciente:', error);
                
              }
              
            }, 1000);
            
          }
          
        }

        

        // ✅ Reconectar transcrição se estava ativa (ou iniciar automaticamente para médico)

        if (userType === 'doctor') {

          console.log('🔄 Restabelecendo transcrição do médico...');

          // Auto-start novamente

          setTimeout(() => autoStartTranscription(), 2000);

        } else if (isTranscriptionActive && transcriptionManagerRef.current) {

          console.log('🔄 Restabelecendo transcrição...');

          transcriptionManagerRef.current.reconnect();

        }

      } else {

        console.error('❌ Erro ao rejuntar à sala:', response.error);

        showError('Erro ao rejuntar à sala: ' + response.error, 'Erro ao Reconectar');

      }

    });

  };

  
  // ✅ NOVO: Força nova conexão Socket.IO (sem reusar SID)
  const forceNewConnection = async () => {
    console.log('🔄 FORÇANDO NOVA CONEXÃO Socket.IO...');
    
    try {
      // 1. Desconectar socket antigo completamente
      if (socketRef.current) {
        console.log('🔌 Desconectando socket antigo...');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      setIsConnected(false);
      
      // 2. Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Verificar se Socket.IO está disponível
      if (!window || !(window as any).io) {
        console.error('❌ Socket.IO não está disponível');
        showError('Socket.IO não está carregado. Recarregue a página.', 'Erro de Conexão');
        return;
      }
      
      // 4. Criar NOVA conexão com forceNew: true
      console.log('🔄 Criando nova conexão Socket.IO...');
      
      const tempUserName = userName || localStorage.getItem('userName') || 'Anônimo';
      
      socketRef.current = (window as any).io.connect(
        process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001',
        {
          auth: {
            userName: tempUserName,
            role: userType === 'doctor' ? 'host' : 'participant',
            password: "x"
          },
          forceNew: true,              // ✅ FORÇAR NOVA CONEXÃO (não reusar SID)
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10     // Limitar tentativas para não travar
        }
      );
      
      // 5. Configurar listeners
      socketRef.current.on('connect', () => {
        console.log('✅ NOVA CONEXÃO estabelecida!');
        setIsConnected(true);
        setIsReconnecting(false); // ✅ Desativar indicador de reconexão
        setupSocketListeners();
        
        // 6. Rejuntar à sala se já estava na sala
        if (hasJoinedRoom && roomId) {
          setTimeout(() => rejoinRoom(), 1000);
        }
      });
      
      socketRef.current.on('connect_error', (error: any) => {
        console.error('❌ Erro na nova conexão:', error);
      });
      
      socketRef.current.on('disconnect', (reason: string) => {
        console.log('❌ Nova conexão desconectada:', reason);
        setIsConnected(false);
      });
      
    } catch (error) {
      console.error('❌ Erro ao forçar nova conexão:', error);
      showError('Erro ao reconectar. Por favor, recarregue a página.', 'Erro de Conexão');
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

            },

            // ✅ CORREÇÃO: FORÇAR NOVA CONEXÃO (não reusar SID antigo após refresh)
            
            forceNew: true,                // SEMPRE criar nova conexão (resolve problema de SID expirado)

            // ✅ RECONEXÃO AUTOMÁTICA habilitada

            reconnection: true,

            reconnectionDelay: 1000,       // 1 segundo entre tentativas

            reconnectionDelayMax: 5000,    // máximo 5 segundos

            reconnectionAttempts: Infinity // tentar infinitamente

          }

        );



        socketRef.current.on('connect', () => {

          console.log('✅ Conexão estabelecida com o servidor');

          setIsConnected(true);
          
          setIsReconnecting(false); // ✅ Desativar indicador de reconexão

          setupSocketListeners();

        });



        socketRef.current.on('connect_error', (error: any) => {

          console.error('❌ Erro ao conectar:', error);

          
          // ✅ CORREÇÃO: Detectar erro de SID inválido e forçar nova conexão
          if (error.message && (error.message.includes('websocket') || error.message.includes('sid'))) {
            console.warn('⚠️ Erro de SID/WebSocket detectado, forçando nova conexão...');
            
            // Limpar conexão atual
            if (socketRef.current) {
              socketRef.current.disconnect();
              socketRef.current.close();
              socketRef.current = null;
            }
            
            // Aguardar um pouco e tentar nova conexão
            setTimeout(() => {
              console.log('🔄 Tentando criar nova conexão com forceNew...');
              if (!socketRef.current) {
                connectSocket();
              }
            }, 2000);
          }

        });



        socketRef.current.on('disconnect', (reason: string) => {

          console.log('🔌 Desconectado do servidor. Motivo:', reason);

          setIsConnected(false);
          
          // ✅ CORREÇÃO: Resetar flags ao desconectar
          hasJoinedRoomRef.current = false;
          isRejoiningRef.current = false;
          console.log('🔌 Flags resetados: hasJoinedRoomRef = false, isRejoiningRef = false');

          

          // Mostrar toast/notificação ao usuário

          if (reason === 'io server disconnect') {

            // Servidor desconectou propositalmente (não vai reconectar)

            setIsReconnecting(false);

            showWarning('Servidor desconectou a sessão. Recarregue a página.', 'Conexão Perdida');

          } else {

            // Desconexão temporária (vai tentar reconectar)

            setIsReconnecting(true);

            console.log('⏳ Tentando reconectar...');

          }

        });



        // ✅ NOVO: Listener para reconexão bem-sucedida

        socketRef.current.on('reconnect', (attemptNumber: number) => {

          console.log(`✅ Reconectado após ${attemptNumber} tentativa(s)!`);

          setIsConnected(true);

          setIsReconnecting(false);

          

          // ✅ CRÍTICO: Rejuntar à sala após reconexão

          if (roomId && hasJoinedRoom) {

            console.log(`🔄 RECONEXÃO: Rejuntando à sala ${roomId} após ${attemptNumber} tentativa(s)`);

            

            // Aguardar um pouco para setupSocketListeners() terminar

            setTimeout(() => {

              rejoinRoom();
              
              // ✅ NOVO: Reconectar transcrição após rejuntar à sala
              setTimeout(() => {
                if (transcriptionManagerRef.current && isTranscriptionActive) {
                  console.log('🔄 RECONEXÃO: Reconectando transcrição...');
                  
                  // Reconfigurar socket
                  transcriptionManagerRef.current.setSocket(socketRef.current);
                  
                  // Tentar reconectar
                  transcriptionManagerRef.current.reconnect().then(() => {
                    console.log('✅ RECONEXÃO: Transcrição reconectada!');
                  }).catch((error) => {
                    console.error('❌ RECONEXÃO: Erro ao reconectar transcrição:', error);
                  });
                }
                
                // ✅ CORREÇÃO: SEMPRE renegociar WebRTC após reconexão do Socket.IO
                if (isCallActive) {
                  console.log('🔄 RECONEXÃO: Verificando estado WebRTC...');
                  
                  if (peerConnectionRef.current) {
                    const connectionState = peerConnectionRef.current.connectionState;
                    const iceState = peerConnectionRef.current.iceConnectionState;
                    console.log(`🔍 RECONEXÃO: connectionState=${connectionState}, iceConnectionState=${iceState}`);
                    
                    // Renegociar se não estiver conectado
                    if (connectionState !== 'connected' || iceState !== 'connected') {
                      console.log('🔄 RECONEXÃO: Renegociando WebRTC...');
                      setTimeout(() => renegotiateWebRTC(), 2000);
                    } else {
                      console.log('✅ RECONEXÃO: WebRTC já está conectado, não precisa renegociar');
                    }
                  } else {
                    // PeerConnection não existe mais, médico precisa iniciar nova call
                    if (userType === 'doctor') {
                      console.log('🔄 RECONEXÃO: PeerConnection não existe, médico vai recriar chamada...');
                      setTimeout(() => call(), 2000);
                    }
                  }
                }
              }, 1500);

            }, 500);

          } else {

            console.log('⚠️ RECONEXÃO: Não vai rejuntar (roomId:', roomId, ', hasJoinedRoom:', hasJoinedRoom, ')');

          }

        });



        // ✅ NOVO: Listener para tentativas de reconexão

        socketRef.current.on('reconnect_attempt', (attemptNumber: number) => {

          console.log(`🔄 Tentativa de reconexão #${attemptNumber}...`);

          setIsReconnecting(true);

        });



        // ✅ NOVO: Listener para erro de reconexão

        socketRef.current.on('reconnect_error', (error: any) => {

          console.error('❌ Erro ao reconectar:', error);

        });



        // ✅ NOVO: Listener para falha de reconexão

        socketRef.current.on('reconnect_failed', () => {

          console.error('❌ Falha ao reconectar após todas as tentativas');

          console.log('🔄 Tentando forçar nova conexão...');
          
          // ✅ Forçar nova conexão do zero (sem reusar SID)
          forceNewConnection();

        });

      } else {

        console.error('Socket.IO não está disponível após carregamento');

        showError('Socket.IO não carregado. Recarregue a página.', 'Erro de Conexão');

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



    //console.log('🔧 [TRANSCRIPTION] Configurando callbacks...');

    

    // ✅ NOVO: Callback quando recebe nova transcrição (transcript puro)

    transcriptionManagerRef.current.onTranscriptUpdate = (transcript: string) => {

      // Log removido

      //console.log('🎤 [TRANSCRIPTION] didOfferRef.current:', didOfferRef.current);
      //console.log('🎤 [TRANSCRIPTION] userType:', userType);
      //console.log('🎤 [TRANSCRIPTION] userNameRef.current:', userNameRef.current);
      //console.log('🎤 [TRANSCRIPTION] remoteUserNameRef.current:', remoteUserNameRef.current);
      

      // CASO 1: Sou o OFFERER (médico) - exibir localmente E enviar para servidor
      if (didOfferRef.current === true) {
        // Adicionar à UI usando método público do TranscriptionManager
        if (transcriptionManagerRef.current) {
          transcriptionManagerRef.current.addTranscriptToUI(transcript, userNameRef.current || 'Você');
        }
        
        // ✅ NOVO: Médico também envia transcrição para servidor para salvar no banco
        if (socketRef.current && roomIdRef.current && userNameRef.current) {
          socketRef.current.emit('sendTranscriptionToPeer', {
            roomId: roomIdRef.current,
            from: userNameRef.current,
            to: remoteUserNameRef.current || 'patient',
            transcription: transcript,
            timestamp: new Date().toISOString()
          });
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

          // Log removido

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

      // Logs removidos
      
      // ✅ PROTEÇÃO: Não substituir por texto vazio se já houver conteúdo no manager
      // O TranscriptionManager já tem proteções, mas adicionamos uma camada extra aqui
      if (!fullText || fullText.trim().length === 0) {
        console.warn('[TRANSCRIPTION] ⚠️ Tentativa de atualizar UI com texto vazio - isso não deveria acontecer!');
        // Não atualizar se vier vazio - o manager deve preservar o histórico
        return;
      }

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

        showError('Nome do médico não informado. Recarregue a página.', 'Erro de Configuração');

      }

    } else if (userType === 'patient') {

      // ✅ NOVO: Paciente aguarda clique no botão (não auto-join)

      console.log('🩺 [PACIENTE] Preparando sala... (aguardando clique no botão)');

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
          
          // ✅ Auto-join se roomId presente na URL (reconexão)
          if (roomId && resolvedName) {
            console.log('🔄 [PACIENTE] RoomId detectado na URL:', roomId);
            console.log('🔄 [PACIENTE] Nome do paciente:', resolvedName);
            console.log('🔄 [PACIENTE] Aguardando Socket.IO para entrar automaticamente...');
            
            let attempts = 0;
            const maxAttempts = 20; // 10 segundos (20 * 500ms)
            
            // Aguardar Socket.IO conectar antes de tentar auto-join
            const waitForSocket = setInterval(() => {
              attempts++;
              console.log(`🔄 [PACIENTE] Tentativa ${attempts}/${maxAttempts} - Socket conectado?`, !!socketRef.current?.connected);
              
              if (socketRef.current && socketRef.current.connected) {
                clearInterval(waitForSocket);
                console.log('✅ [PACIENTE] Socket.IO conectado! Entrando na sala...');
                console.log('✅ [PACIENTE] hasJoinedRoomRef.current:', hasJoinedRoomRef.current);
                
                if (!hasJoinedRoomRef.current) {
                  joinRoomAsParticipant(resolvedName);
                } else {
                  console.warn('⚠️ [PACIENTE] Já entrou na sala anteriormente, pulando auto-join');
                }
              } else if (attempts >= maxAttempts) {
                clearInterval(waitForSocket);
                console.error('❌ [PACIENTE] Timeout aguardando Socket.IO. Mostrando botão para entrada manual.');
                setIsPatientReadyToJoin(true);
              }
            }, 500);
          } else {
            // Sem roomId = primeira entrada, aguarda clique no botão
            console.log('📋 [PACIENTE] Sem roomId na URL, aguardando clique no botão...');
            console.log('📋 [PACIENTE] roomId atual:', roomId);
            console.log('📋 [PACIENTE] resolvedName:', resolvedName);
            setIsPatientReadyToJoin(true);
            console.log('✅ [PACIENTE] Pronto! Aguardando clique no botão...');
          }

        } catch (e) {

          console.error('❌ Erro ao preparar sala do paciente:', e);

          setErrorMessage('Erro ao preparar a participação na sala. Recarregue a página.');

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

    // ✅ CORREÇÃO: Evitar múltiplas chamadas simultâneas
    if (isRejoiningRef.current) {
      console.warn('⚠️ joinRoomAsHost já está em execução, ignorando');
      return;
    }
    
    // ✅ CORREÇÃO: Evitar join se já entrou na sala
    if (hasJoinedRoomRef.current) {
      console.warn('⚠️ Já está na sala, ignorando joinRoomAsHost duplicado');
      return;
    }
    
    isRejoiningRef.current = true;
    console.log('👨‍⚕️ [MÉDICO] Entrando como HOST:', userName);
    

    if (socketRef.current) {

      socketRef.current.emit('joinRoom', {

        roomId: roomId,

        participantName: userName

      }, (response: any) => {

        if (response.success) {

          setUserRole(response.role);

          setRoomData(response.roomData);

          setHasJoinedRoom(true); // ✅ Marcar que já entrou na sala

          console.log('👨‍⚕️ [MÉDICO] ✅ Entrou na sala como HOST');
          
          console.log('📊 [MÉDICO] Status da sala:', response.roomData?.status);
          
          // ✅ CORREÇÃO: Marcar que entrou na sala e resetar flag
          hasJoinedRoomRef.current = true;
          isRejoiningRef.current = false;
          console.log('✅ hasJoinedRoomRef = true, isRejoiningRef = false');

          // ✅ Função auxiliar para restaurar histórico após TranscriptionManager estar pronto
          const restoreTranscriptionHistory = () => {
            if (response.roomData?.transcriptionHistory && response.roomData.transcriptionHistory.length > 0) {
              console.log(`🔄 [MÉDICO] Restaurando ${response.roomData.transcriptionHistory.length} transcrições históricas...`);
              
              if (transcriptionManagerRef.current) {
                response.roomData.transcriptionHistory.forEach((transcription: any) => {
                  const displayName = transcription.speaker || 'Desconhecido';
                  transcriptionManagerRef.current!.addTranscriptToUI(transcription.text, displayName);
                });
                console.log('✅ [MÉDICO] Transcrições históricas restauradas!');
              } else {
                console.warn('⚠️ [MÉDICO] TranscriptionManager não está pronto ainda, tentando novamente...');
                setTimeout(restoreTranscriptionHistory, 500);
              }
            }
          };

          // ✅ NOVO: Se sala estava ativa (reload durante chamada), restaurar WebRTC
          const roomStatus = response.roomData?.status;
          
          if (roomStatus === 'active') {
            console.log('🔄 [RELOAD] Sala ativa detectada! Restaurando WebRTC...');
            
            // ✅ CORREÇÃO: Ativar chamada para mostrar vídeo
            setIsCallActive(true);
            console.log('✅ [RELOAD] isCallActive = true (sala já estava ativa)');
            
            // Aguardar mídia carregar e então iniciar chamada
            fetchUserMedia().then(async () => {
              console.log('👨‍⚕️ [RELOAD] fetchUserMedia concluído');
              
              await initializeTranscription();
              console.log('👨‍⚕️ [RELOAD] Transcrição inicializada');
              
              // ✅ Restaurar histórico após TranscriptionManager estar pronto
              restoreTranscriptionHistory();
              
              // Forçar início da chamada (WebRTC)
              setTimeout(() => {
                console.log('👨‍⚕️ [RELOAD] Forçando início da chamada após reload...');
                call(); // Isso vai criar nova offer e enviar
              }, 1000);
            });
          } else {
            // Fluxo normal: primeira vez entrando na sala
            fetchUserMedia().then(() => {
              console.log('👨‍⚕️ [MÉDICO] ✅ fetchUserMedia concluído na entrada da sala');
              return initializeTranscription();
            }).then(() => {
              console.log('👨‍⚕️ [MÉDICO] ✅ Transcrição inicializada');
              
              // ✅ Restaurar histórico após TranscriptionManager estar pronto
              restoreTranscriptionHistory();
            });
          }

        } else {

          showError('Erro ao entrar na sala: ' + response.error, 'Erro ao Entrar');

        }

      });

    }

  };



  // ✅ NOVO: Função chamada quando paciente clica no botão "Entrar na Consulta"
  const handlePatientJoinClick = () => {
    console.log('👤 [PACIENTE] Botão "Entrar na Consulta" clicado!');
    
    if (!participantName) {
      console.error('❌ Nome do paciente não definido');
      setErrorMessage('Erro: Nome não definido. Recarregue a página.');
      return;
    }
    
    if (!socketRef.current) {
      console.error('❌ Socket não conectado');
      setErrorMessage('Erro: Conexão não estabelecida. Recarregue a página.');
      return;
    }
    
    // Aguardar socket conectar e então entrar
    const tryJoin = () => {
      if (socketRef.current?.connected) {
        joinRoomAsParticipant(participantName);
      } else {
        console.log('🔄 Aguardando socket conectar...');
        setTimeout(tryJoin, 200);
      }
    };
    
    tryJoin();
  };

  // ✅ NOVO: Formatar duração da chamada
  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resumeRemotePlayback = async () => {
    console.log('🔘 [WEBRTC] Botão "Liberar áudio e vídeo" clicado!');
    const video = remoteVideoRef.current;
    
    if (!video) {
      console.warn('⚠️ [WEBRTC] resumeRemotePlayback chamado mas remoteVideoRef é null');
      return;
    }

    console.log('🔍 [WEBRTC] Estado atual do vídeo:', {
      srcObject: !!video.srcObject,
      paused: video.paused,
      muted: video.muted,
      readyState: video.readyState
    });

    try {
      // Garantir que o srcObject está atribuído
      if (!video.srcObject && remoteStreamRef.current) {
        console.log('ℹ️ [WEBRTC] Reatribuindo stream remoto antes de retomar reprodução');
        video.srcObject = remoteStreamRef.current;
      }

      if (!video.srcObject) {
        console.error('❌ [WEBRTC] Não há srcObject para reproduzir!');
        return;
      }

      // ✅ SOLUÇÃO SIMPLES: Apenas remover o overlay e deixar o vídeo tocar
      // O vídeo já está tocando (paused: false), só estava mudo por causa do autoplay
      console.log('🔊 [WEBRTC] Liberando áudio do vídeo remoto...');
      
      video.muted = false;
      video.controls = false;
      
      // Se estiver pausado, tentar dar play
      if (video.paused) {
        console.log('▶️ [WEBRTC] Vídeo pausado, tentando play...');
        try {
          await video.play();
          console.log('✅ [WEBRTC] Play executado com sucesso!');
        } catch (playError) {
          console.warn('⚠️ [WEBRTC] Play falhou, tentando mudo primeiro...', playError);
          video.muted = true;
          await video.play();
          console.log('✅ [WEBRTC] Play mudo OK, desmutando...');
          await new Promise(resolve => setTimeout(resolve, 100));
          video.muted = false;
        }
      }
      
      console.log('✅ [WEBRTC] Áudio liberado com sucesso!');
      setIsRemotePlaybackBlocked(false);
      
    } catch (error) {
      console.error('❌ [WEBRTC] Erro ao liberar áudio:', error);
      // Fallback: mostrar controles nativos
      video.controls = true;
      video.muted = false;
      showInfo('Use os controles do vídeo para iniciar a reprodução.', 'Controle de Vídeo');
    }
  };

  // Função para entrar como paciente (participant) - igual ao projeto original

  const joinRoomAsParticipant = async (participantName: string) => {

    // ✅ CORREÇÃO: Evitar múltiplas chamadas simultâneas
    if (isRejoiningRef.current) {
      console.warn('⚠️ joinRoomAsParticipant já está em execução, ignorando');
      return;
    }
    
    // ✅ CORREÇÃO: Evitar join se já entrou na sala
    if (hasJoinedRoomRef.current) {
      console.warn('⚠️ Já está na sala, ignorando joinRoomAsParticipant duplicado');
      return;
    }
    
    isRejoiningRef.current = true;
    console.log('🩺 [PACIENTE] Entrando como PARTICIPANTE:', participantName);

    setUserName(participantName);
    userNameRef.current = participantName; // ✅ Atualizar ref também

    

    if (socketRef.current) {

      socketRef.current.emit('joinRoom', {

        roomId: roomId,

        participantName: participantName

      }, async (response: any) => {
        if (response.success) {

          setUserRole(response.role);

          setRoomData(response.roomData);

          setHasJoinedRoom(true); // ✅ Marcar que já entrou na sala

          setShowParticipantModal(false);

          console.log('🩺 [PACIENTE] ✅ Entrou na sala como PARTICIPANTE');
          
          console.log('📊 [PACIENTE] Status da sala:', response.roomData?.status);
          
          // ✅ CORREÇÃO: Marcar que entrou na sala e resetar flag
          hasJoinedRoomRef.current = true;
          isRejoiningRef.current = false;
          console.log('✅ hasJoinedRoomRef = true, isRejoiningRef = false');

          // ✅ Função auxiliar para restaurar histórico após TranscriptionManager estar pronto
          const restoreTranscriptionHistory = () => {
            if (response.roomData?.transcriptionHistory && response.roomData.transcriptionHistory.length > 0) {
              console.log(`🔄 [PACIENTE] Restaurando ${response.roomData.transcriptionHistory.length} transcrições históricas...`);
              
              if (transcriptionManagerRef.current) {
                response.roomData.transcriptionHistory.forEach((transcription: any) => {
                  const displayName = transcription.speaker || 'Desconhecido';
                  transcriptionManagerRef.current!.addTranscriptToUI(transcription.text, displayName);
                });
                console.log('✅ [PACIENTE] Transcrições históricas restauradas!');
              } else {
                console.warn('⚠️ [PACIENTE] TranscriptionManager não está pronto ainda, tentando novamente...');
                setTimeout(restoreTranscriptionHistory, 500);
              }
            }
          };

          // ✅ CORREÇÃO: Inicializar mídia PRIMEIRO (ANTES de tudo)
          console.log('🩺 [PACIENTE] 1️⃣ Inicializando mídia...');
          try {
            await fetchUserMedia();
            console.log('🩺 [PACIENTE] ✅ Mídia inicializada COM SUCESSO');
            console.log('🩺 [PACIENTE] localStreamRef.current existe?', !!localStreamRef.current);
            console.log('🩺 [PACIENTE] Tracks no stream:', localStreamRef.current?.getTracks().length);
            
            // ✅ NOVO: Marcar mídia como pronta
            isMediaReadyRef.current = true;
            console.log('🩺 [PACIENTE] ✅ isMediaReadyRef = true');
            
          } catch (error) {
            console.error('❌ [PACIENTE] ERRO ao inicializar mídia:', error);
            setErrorMessage('Erro ao acessar câmera/microfone. Verifique as permissões.');
            return;
          }
          
          // ✅ CORREÇÃO: Inicializar transcrição DEPOIS da mídia
          console.log('🩺 [PACIENTE] 2️⃣ Inicializando transcrição...');
          await initializeTranscription();
          console.log('🩺 [PACIENTE] ✅ Transcrição inicializada');
          
          // ✅ Restaurar histórico após TranscriptionManager estar pronto
          restoreTranscriptionHistory();
          
          // ✅ CORREÇÃO: Marcar que está pronto para receber offers
          console.log('🩺 [PACIENTE] 3️⃣ Pronto para receber offers do médico');
          
          // ✅ NOVO: Processar offer pendente se houver
          if (pendingOfferRef.current) {
            console.log('🩺 [PACIENTE] ✅ Processando offer pendente...');
            const { offer, userName } = pendingOfferRef.current;
            pendingOfferRef.current = null; // Limpar
            
            // Criar objeto compatível com createAnswerButton
            await createAnswerButton({ 
              offer: offer, 
              offererUserName: userName 
            });
          }
          
          // ✅ NOVO: Se sala estava ativa (reload durante chamada), preparar WebRTC
          const roomStatus = response.roomData?.status;
          
          if (roomStatus === 'active') {
            console.log('🔄 [RELOAD] Sala ativa detectada! Aguardando offer do médico...');
            console.log('🩺 [RELOAD] ✅ Pronto para receber offer (PeerConnection será criado ao receber offer)');
            
            // ✅ CORREÇÃO: Ativar chamada para mostrar vídeo
            setIsCallActive(true);
            console.log('✅ [RELOAD] isCallActive = true (sala já estava ativa)');
            
            // ✅ CORREÇÃO: NÃO criar PeerConnection aqui para evitar race condition
            // O createAnswerButton() criará quando receber a offer do médico
          }
        } else {

          setErrorMessage(response.error);
          
          // ✅ CORREÇÃO: Resetar flag em caso de erro
          isRejoiningRef.current = false;
          console.error('❌ Erro ao rejuntar sala, isRejoiningRef = false');

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
      // ✅ Função auxiliar para iniciar transcrição do paciente
      const startPatientTranscription = async () => {
        try {
          console.log('🎤 [PACIENTE] Conectando à OpenAI...');
          console.log('🎤 [PACIENTE] Socket state:', socketRef.current?.connected ? 'connected' : 'disconnected');
          
          const success = await transcriptionManagerRef.current!.init();

          if (success) {
            console.log('🎤 [PACIENTE] ✅ Transcrição conectada (aguardando AudioProcessor)');
            setTranscriptionStatus('Conectado');

            // Verificar a cada 500ms se audioProcessor está pronto
            const checkAudioProcessor = setInterval(() => {
              if (audioProcessorRef.current && audioProcessorRef.current.getStatus().initialized) {
                console.log('🎤 [PACIENTE] ✅ AudioProcessor pronto, iniciando transcrição...');
                clearInterval(checkAudioProcessor);

                // ✅ CORREÇÃO: Preservar histórico se já houver transcrições
                const hasExistingTranscript = transcriptionManagerRef.current!.getStatus().transcript.length > 0;
                transcriptionManagerRef.current!.start(hasExistingTranscript);

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
      
      // ✅ Verificar se socket está conectado antes de tentar
      if (!socketRef.current || !socketRef.current.connected) {
        console.error('❌ [PACIENTE] Socket não está conectado! Aguardando conexão...');
        setTranscriptionStatus('Aguardando conexão...');
        
        // Aguardar até o socket conectar (máximo 10 segundos)
        let attempts = 0;
        const maxAttempts = 20; // 20 tentativas de 500ms = 10 segundos
        const checkSocket = setInterval(() => {
          attempts++;
          if (socketRef.current && socketRef.current.connected) {
            clearInterval(checkSocket);
            console.log('✅ [PACIENTE] Socket conectado, iniciando transcrição...');
            startPatientTranscription();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkSocket);
            console.error('❌ [PACIENTE] Timeout aguardando socket conectar');
            setTranscriptionStatus('Erro: Socket não conectou');
          }
        }, 500);
        
        return;
      }
      
      // Socket já está conectado, iniciar transcrição diretamente
      startPatientTranscription();
    } catch (error) {
      console.error('❌ [PACIENTE] Erro ao ativar transcrição automática:', error);
      setTranscriptionStatus('Erro');
    }
  };

  const setupSocketListeners = () => {

    if (!socketRef.current) return;



    // Participante entrou (apenas host recebe)

    socketRef.current.on('participantJoined', (data: any) => {

      console.log('Participante entrou:', data.participantName);

      setParticipantName(data.participantName);

      // ✅ NOVO: Mostrar notificação quando paciente entra (apenas para médico)
      if (userType === 'doctor') {
        setPatientJoinedName(data.participantName || patientName || 'Paciente');
        setShowPatientJoinedNotification(true);
        
        // ✅ NOVO: Tocar som de notificação
        try {
          // Criar um tom de notificação usando Web Audio API
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Configurar o som (tom agradável e curto)
          oscillator.frequency.value = 800; // Frequência em Hz
          oscillator.type = 'sine'; // Tom suave
          
          // Envelope de volume (fade in/out suave)
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
        } catch (error) {
          console.warn('Não foi possível tocar som de notificação:', error);
        }
        
        // Esconder notificação após 5 segundos
        setTimeout(() => {
          setShowPatientJoinedNotification(false);
        }, 5000);
      }

    });

    // ✅ NOVO: Atualização do timer da chamada (servidor)

    socketRef.current.on('callTimerUpdate', (data: any) => {

      const { duration } = data;
      setCallDuration(duration);
      setIsCallTimerActive(true);

    });



    // Sala foi finalizada

    socketRef.current.on('roomEnded', (data: any) => {

      if (userType === 'doctor') {

        // Médico: redireciona para nova consulta

        showSuccess(data.message || 'Operação realizada com sucesso');

        router.push('/consulta/nova');

      } else {

        // Paciente: parar todos os streams e redirecionar para página de finalização

        console.log('🏁 [PACIENTE] Sala finalizada, parando streams e redirecionando...');

        // Parar transcrição
        if (transcriptionManagerRef.current) {
          transcriptionManagerRef.current.stop();
          transcriptionManagerRef.current.disconnect();
        }

        // Limpar AudioProcessor
        if (audioProcessorRef.current) {
          audioProcessorRef.current.cleanup();
        }

        // Parar streams de vídeo e áudio
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 [PACIENTE] Track parado:', track.kind);
          });
          localStreamRef.current = null;
        }

        // Fechar conexão WebRTC
        if (peerConnectionRef.current) {
          try {
            peerConnectionRef.current.close();
            console.log('🛑 [PACIENTE] PeerConnection fechada');
          } catch (error) {
            console.warn('⚠️ [PACIENTE] Erro ao fechar PeerConnection:', error);
          }
          peerConnectionRef.current = null;
        }

        // Limpar referências de vídeo remoto
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }

        // Desconectar socket
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        // Redirecionar para página de finalização
        const patientNameParam = patientName ? encodeURIComponent(patientName) : '';
        const roomIdParam = roomId ? `&roomId=${roomId}` : '';
        router.push(`/consulta/finalizada?patientName=${patientNameParam}${roomIdParam}`);

      }

    });

    // ✅ NOVO: Sala foi encerrada pelo administrador
    socketRef.current.on('roomTerminatedByAdmin', (data: any) => {
      console.log('🛑 [ADMIN] Sala encerrada pelo administrador:', data);
      
      // Mostrar mensagem para o usuário
      showWarning(`A consulta foi encerrada pelo administrador.\n\nMotivo: ${data.reason || 'Encerramento administrativo'}`, 'Consulta Encerrada');
      
      // Parar transcrição
      if (transcriptionManagerRef.current) {
        transcriptionManagerRef.current.stop();
        transcriptionManagerRef.current.disconnect();
      }

      // Limpar AudioProcessor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.cleanup();
      }

      // Parar streams de vídeo e áudio
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 [ADMIN-TERMINATE] Track parado:', track.kind);
        });
        localStreamRef.current = null;
      }

      // Fechar conexão WebRTC
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
          console.log('🛑 [ADMIN-TERMINATE] PeerConnection fechada');
        } catch (error) {
          console.warn('⚠️ [ADMIN-TERMINATE] Erro ao fechar PeerConnection:', error);
        }
        peerConnectionRef.current = null;
      }

      // Limpar referências de vídeo remoto
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Desconectar socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Redirecionar baseado no tipo de usuário
      if (userType === 'doctor') {
        router.push('/consulta/nova');
      } else {
        const patientNameParam = patientName ? encodeURIComponent(patientName) : '';
        const roomIdParam = roomId ? `&roomId=${roomId}` : '';
        router.push(`/consulta/finalizada?patientName=${patientNameParam}${roomIdParam}`);
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

      // Log removido

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
      
      // ✅ NOVO: Notificação quando paciente reconecta (refresh)
      socketRef.current.on('participantRejoined', (data: any) => {
        console.log(`🔔 [MÉDICO] Paciente ${data.participantName} reconectou! Reiniciando chamada IMEDIATAMENTE...`);
        
        const restartDoctorCall = async () => {
          try {
            console.log('🔄 [MÉDICO] Iniciando restart da chamada...');
            
            // Limpar eventual offer pendente / estados
            pendingOfferRef.current = null;
            isMediaReadyRef.current = true; // médico já tem mídia pronta

            if (peerConnectionRef.current) {
              console.log('🧹 [MÉDICO] Encerrando PeerConnection antiga antes de recriar...');
              try {
                peerConnectionRef.current.ontrack = null;
                peerConnectionRef.current.onicecandidate = null;
                peerConnectionRef.current.close();
              } catch (closeError) {
                console.warn('⚠️ [MÉDICO] Erro ao fechar PeerConnection antiga:', closeError);
              }
              peerConnectionRef.current = null;
            }

            // Resetar flags de offer
            didOfferRef.current = false;
            setDidIOffer(false);
            setIsCallActive(false);

            // Garantir stream local disponível
            if (!localStreamRef.current) {
              console.log('📹 [MÉDICO] Stream local ausente, chamando fetchUserMedia...');
              await fetchUserMedia();
            }

            console.log('📞 [MÉDICO] Chamando call() para enviar nova offer...');
            await call();
            console.log('✅ [MÉDICO] Nova offer enviada após restart do paciente!');
          } catch (error) {
            console.error('❌ [MÉDICO] Falha ao reiniciar chamada após reconexão do paciente:', error);
          }
        };

        // ✅ MUDANÇA: Reduzir delay para 800ms (o suficiente para paciente se conectar ao Socket.IO)
        setTimeout(restartDoctorCall, 800);
      });
      
      // ✅ NOVO: Reconectar WebRTC quando paciente entrar/reconectar
      // ✅ CORREÇÃO: Adicionar debounce para evitar múltiplas reconexões simultâneas
      let reconnectTimeout: NodeJS.Timeout | null = null;
      let isReconnecting = false;
      
      socketRef.current.on('patient-entered-reconnect-webrtc', (data: any) => {
        console.log(`🔔 [MÉDICO] Paciente ${data.participantName} entrou/reconectou!`);
        
        // ✅ Se já está reconectando, ignorar
        if (isReconnecting) {
          console.log('⏭️ [MÉDICO] Reconexão já em andamento, ignorando evento duplicado');
          return;
        }
        
        // ✅ Limpar timeout anterior se houver
        if (reconnectTimeout) {
          console.log('🔄 [MÉDICO] Cancelando reconexão anterior (debounce)');
          clearTimeout(reconnectTimeout);
        }
        
        // ✅ Agendar reconexão com debounce de 1 segundo
        reconnectTimeout = setTimeout(async () => {
          if (isReconnecting) {
            console.log('⏭️ [MÉDICO] Reconexão já em andamento, pulando');
            return;
          }
          
          isReconnecting = true;
          console.log('🔄 [MÉDICO] Iniciando RECONEXÃO FORÇADA do WebRTC...');
          
          try {
            // 1. Fechar PeerConnection antiga
            if (peerConnectionRef.current) {
              console.log('🧹 [MÉDICO] Encerrando PeerConnection antiga...');
              try {
                peerConnectionRef.current.ontrack = null;
                peerConnectionRef.current.onicecandidate = null;
                peerConnectionRef.current.oniceconnectionstatechange = null;
                peerConnectionRef.current.onconnectionstatechange = null;
                peerConnectionRef.current.close();
              } catch (closeError) {
                console.warn('⚠️ [MÉDICO] Erro ao fechar PeerConnection:', closeError);
              }
              peerConnectionRef.current = null;
            }
            
            // 2. Resetar estados
            pendingOfferRef.current = null;
            didOfferRef.current = false;
            setDidIOffer(false);
            setIsCallActive(false);
            
            // 3. Garantir mídia local
            isMediaReadyRef.current = true; // médico já tem mídia
            if (!localStreamRef.current) {
              console.log('📹 [MÉDICO] Stream local ausente, recriando...');
              await fetchUserMedia();
            }
            
            // 4. Aguardar um pouco para o paciente estar pronto
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 5. Criar nova conexão e enviar offer
            console.log('📞 [MÉDICO] Criando nova PeerConnection e enviando offer...');
            await call();
            console.log('✅ [MÉDICO] WebRTC reconectado com sucesso!');
          } catch (error) {
            console.error('❌ [MÉDICO] Erro ao reconectar WebRTC:', error);
          } finally {
            isReconnecting = false;
            reconnectTimeout = null;
          }
        }, 1000); // Debounce de 1 segundo
      });

    }



    // Handler duplicado removido para evitar processar oferta duas vezes no paciente

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

        showError('Erro ao entrar na sala: ' + response.error, 'Erro ao Entrar');

        router.push('/consulta/nova');

      }

    });

  };



  // WebRTC Functions

  const call = async () => {

    //console.log('👨‍⚕️ [MÉDICO] Iniciando chamada...');
    

    // Verificar se socket está conectado

    if (!socketRef.current || !socketRef.current.connected) {

      showWarning('Não conectado ao servidor. Aguarde a conexão...', 'Aguardando Conexão');

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
      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] createOffer()...');
      const offer = await peerConnectionRef.current!.createOffer();

      await peerConnectionRef.current!.setLocalDescription(offer);
      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] setLocalDescription(offer) OK');

      

      // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente

      setDidIOffer(true);

      didOfferRef.current = true;

      setIsCallActive(true);

      

      // ✅ AUTO-START: Iniciar transcrição automaticamente (médico)

      setTimeout(() => autoStartTranscription(), 2000); // Aguardar 2s para WebRTC estabilizar

      

      //console.log('👨‍⚕️ [MÉDICO] ✅ Offer criado, didIOffer definido como TRUE');
      //console.log('👨‍⚕️ [MÉDICO] ✅ didOfferRef.current:', didOfferRef.current);
      

      // Enviar oferta com roomId

      //console.log('👨‍⚕️ [MÉDICO] 4. Enviando newOffer...');
      console.log('🔍 DEBUG [REFERENCIA] [SIGNALING] emit newOffer');
      socketRef.current.emit('newOffer', {

        roomId: roomId,

        offer: offer

      });

      console.log('👨‍⚕️ [MÉDICO] ✅ newOffer enviado');

    } catch(err) {

      console.error('👨‍⚕️ [MÉDICO] ❌ Erro:', err);

      showError('Erro ao iniciar chamada: ' + err, 'Erro na Chamada');

    }

  };



  const answer = async () => {

    //console.log('🩺 [PACIENTE] Clicou no botão Answer - IGUAL AO PROJETO ORIGINAL');
    

    // Verificar se socket está conectado

    if (!socketRef.current || !socketRef.current.connected) {

      showWarning('Não conectado ao servidor. Aguarde a conexão...', 'Aguardando Conexão');

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

      showError('Erro ao responder chamada: ' + err, 'Erro na Chamada');

    }

  };



  const answerOffer = async (offerData: any) => {

    //console.log('🩺 [PACIENTE] Processando oferta - IGUAL AO PROJETO ORIGINAL...');
    //console.log('🩺 [PACIENTE] OfferData:', offerData);
    

    try {

      // 1. fetchUserMedia - igual ao projeto original

      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] answer: fetchUserMedia');
      await fetchUserMedia();

      

      // 2. createPeerConnection - igual ao projeto original

      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] answer: createPeerConnection with remote offer');
      await createPeerConnection({ offer: offerData.offer });

  

      

      // 3. Criar e enviar resposta - igual ao projeto original

      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] createAnswer()...');
      const answer = await peerConnectionRef.current!.createAnswer({});

      await peerConnectionRef.current!.setLocalDescription(answer);
      console.log('🔍 DEBUG [REFERENCIA] [WEBRTC] setLocalDescription(answer) OK');

      

      // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente

      setRemoteUserName(offerData.offererUserName);

      remoteUserNameRef.current = offerData.offererUserName;

      //console.log('🩺 [PACIENTE] ✅ remoteUserName definido:', offerData.offererUserName);
      //console.log('🩺 [PACIENTE] ✅ remoteUserNameRef.current:', remoteUserNameRef.current);
      

      // Processar ICE candidates pendentes

      processPendingIceCandidates();

      

      // Enviar resposta com roomId - igual ao projeto original

      console.log('🔍 DEBUG [REFERENCIA] [SIGNALING] emit newAnswer');
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

      // Log removido

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

      
      // 🔍 DEBUG [REFERENCIA] MÍDIA OBTIDA
      // Logs removidos
      

      // ✅ CORREÇÃO: Anexar stream com retry para garantir que o elemento está disponível
      const attachVideoStream = (stream: MediaStream, retries = 10) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('📹 [MÍDIA] ✅ Stream local atribuído ao elemento de vídeo');
          
          // ✅ Forçar play (elemento já tem autoPlay no HTML)
          setTimeout(() => {
            if (localVideoRef.current) {
              localVideoRef.current.play().catch((err) => {
                console.warn('📹 [MÍDIA] ⚠️ Autoplay bloqueado:', err.message);
              });
            }
          }, 100);
        } else if (retries > 0) {
          console.warn(`📹 [MÍDIA] ⚠️ localVideoRef.current não disponível, tentando novamente em 100ms (${retries} tentativas restantes)...`);
          setTimeout(() => attachVideoStream(stream, retries - 1), 100);
        } else {
          console.error('📹 [MÍDIA] ❌ Falha ao anexar stream após múltiplas tentativas!');
        }
      };

      attachVideoStream(stream);

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

        console.log('🔍 DEBUG [REFERENCIA] [MEDIA] Inicializando AudioProcessor...');
        audioProcessorRef.current = new AudioProcessor();

        await audioProcessorRef.current.init(stream);

        

        // Inicializar TranscriptionManager (apenas uma vez)

        if (!transcriptionManagerRef.current) {

          console.log('🔍 DEBUG [REFERENCIA] [MEDIA] Inicializando TranscriptionManager...');
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
          
          // Usar a mesma função de anexar com retry
          const attachVideoStreamRetry = (stream: MediaStream, retries = 10) => {
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              console.log('📹 [MÍDIA] ✅ Stream local atribuído ao elemento de vídeo (retry)');
              
              setTimeout(() => {
                if (localVideoRef.current) {
                  localVideoRef.current.play().catch((err) => {
                    console.warn('📹 [MÍDIA] ⚠️ Autoplay bloqueado (retry):', err.message);
                  });
                }
              }, 100);
            } else if (retries > 0) {
              console.warn(`📹 [MÍDIA] ⚠️ localVideoRef.current não disponível no retry, tentando novamente... (${retries})`);
              setTimeout(() => attachVideoStreamRetry(stream, retries - 1), 100);
            }
          };
          
          attachVideoStreamRetry(stream);
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
          showError('Não foi possível acessar a câmera/microfone. Verifique as permissões do navegador.', 'Erro de Permissão');
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        showError('Erro ao acessar câmera/microfone: ' + errorMessage, 'Erro de Acesso');
      }
    }

  };



  const createPeerConnection = async (offerObj?: any) => {
    

    // ✅ NOVO: Verificar se stream local existe antes de criar PeerConnection
    if (!localStreamRef.current) {
      console.error('❌ [WEBRTC] Não é possível criar PeerConnection sem stream local');
      throw new Error('Stream local não disponível');
    }

    // ✅ CORREÇÃO: Limpar peerConnection anterior se existir
    if (peerConnectionRef.current) {
      console.log('🧹 [WEBRTC] Limpando peerConnection anterior...');
      try {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      } catch (error) {
        console.error('❌ [WEBRTC] Erro ao fechar peerConnection anterior:', error);
      }
    }

    peerConnectionRef.current = new RTCPeerConnection(peerConfiguration);
    // Log removido

    

    // ✅ Monitorar estado da conexão
    peerConnectionRef.current.onconnectionstatechange = () => {
      // Log removido
    };
    
    peerConnectionRef.current.oniceconnectionstatechange = () => {
      const state = peerConnectionRef.current?.iceConnectionState;
      // Log removido
      
      // ✅ RECONEXÃO AUTOMÁTICA: Detectar falha e tentar renegociar
      if (state === 'failed' || state === 'disconnected') {
        console.log('⚠️ WebRTC desconectado! Estado:', state);
        
        // Tentar reconectar após 3 segundos
        setTimeout(() => {
          if (peerConnectionRef.current?.iceConnectionState === 'failed' || 
              peerConnectionRef.current?.iceConnectionState === 'disconnected') {
            console.log('🔄 Tentando renegociar WebRTC...');
            renegotiateWebRTC();
          }
        }, 3000);
      } else if (state === 'connected' || state === 'completed') {
        console.log('✅ WebRTC conectado com sucesso!');
        // Timer é controlado pelo servidor via Socket.IO
      }
    };
    
    peerConnectionRef.current.onsignalingstatechange = () => {
      // Log removido
    };
    
    // ✅ CORREÇÃO: Criar remoteStream vazio (será preenchido quando receber tracks)
    remoteStreamRef.current = new MediaStream();

    console.log('🔗 [WEBRTC] RemoteStream criado (vazio inicialmente)');
    

    if (localStreamRef.current) {

      const tracks = localStreamRef.current.getTracks();

      // console.log('🔗 [WEBRTC] Stream local disponível com', tracks.length, 'tracks');
      //console.log('🔗 [WEBRTC] userType:', userType);
      

      // Log removido
      tracks.forEach((track, index) => {
        console.log(`🔍 DEBUG [REFERENCIA] [WEBRTC] addTrack #${index} kind=${track.kind} enabled=${track.enabled} state=${track.readyState}`);
        
        // ✅ DEBUG: Verificar se é track de áudio e se está habilitado
        if (track.kind === 'audio') {
          console.log(`🔊 [WEBRTC] Track de áudio encontrado: enabled=${track.enabled}, readyState=${track.readyState}, id=${track.id}`);
        }
        
        const sender = peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
        console.log(`🔍 DEBUG [REFERENCIA] [WEBRTC] sender #${index} criado para ${track.kind}`, sender ? 'ok' : 'fail');
        
        // ✅ DEBUG: Verificar sender de áudio
        if (track.kind === 'audio' && sender) {
          console.log(`🔊 [WEBRTC] Sender de áudio criado: track.enabled=${sender.track?.enabled}, track.readyState=${sender.track?.readyState}`);
        }
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
        console.log('🔍 DEBUG [REFERENCIA] [ICE] candidate gerado (type, protocol):', e.candidate.type, e.candidate.protocol);
        socketRef.current.emit('sendIceCandidateToSignalingServer', {

          roomId: roomId,

          iceCandidate: e.candidate,

          iceUserName: userName,

          didIOffer: didOfferRef.current,

        });

      }

    };
    
    // ✅ CORREÇÃO: Usar ontrack ao invés de addEventListener
    peerConnectionRef.current.ontrack = (e) => {
      // Logs removidos para reduzir poluição no console
      
      // ✅ FIX: Atribuir o stream remoto diretamente ao elemento de vídeo
      if (e.streams && e.streams[0]) {
        //console.log('🔗 [WEBRTC] ✅ Atribuindo stream remoto ao elemento de vídeo');
        //console.log('🔗 [WEBRTC] remoteVideoRef.current existe?', !!remoteVideoRef.current);
        
        // ✅ CORREÇÃO: Anexar vídeo remoto com retry
        const attachRemoteStream = (stream: MediaStream, retries = 10) => {
          if (remoteVideoRef.current) {
            try {
              const previousStream = remoteVideoRef.current.srcObject as MediaStream | null;
              remoteVideoRef.current.srcObject = stream;
              remoteStreamRef.current = stream;

              const isNewStream = previousStream !== stream;
              const isFirstTime = !previousStream;
              
              if (previousStream && previousStream !== stream) {
                console.log('🔄 [WEBRTC] Substituindo stream remoto anterior por um novo (id anterior:', previousStream.id, '| novo id:', stream.id, ')');
              } else if (!previousStream) {
                console.log('🔗 [WEBRTC] Stream remoto atribuído pela primeira vez (id:', stream.id, ')');
              } else {
                console.log('🔁 [WEBRTC] Reaproveitando stream remoto com mesmo id:', stream.id);
              }

              remoteVideoRef.current.controls = false;
              remoteVideoRef.current.style.opacity = '1';
              remoteVideoRef.current.muted = true; // Sempre começar mudo para autoplay

              console.log('📊 [WEBRTC] Stream remoto atribuído (readyState:', remoteVideoRef.current.readyState, ')');

              // ✅ CORREÇÃO CRÍTICA: Só chamar play() se for stream NOVO ou PRIMEIRA VEZ
              // Evita múltiplos play() quando tracks chegam separadamente
              if (isFirstTime || isNewStream) {
                console.log('▶️ [WEBRTC] Iniciando play() pois é', isFirstTime ? 'primeira vez' : 'stream novo');
                
                const playPromise = remoteVideoRef.current.play();
                
                if (playPromise) {
                  playPromise
                    .then(() => {
                      console.log('🎬 [WEBRTC] Reprodução remota iniciada (modo mudo temporário)');
                      setIsRemotePlaybackBlocked(false);
                      
                      // ✅ CORREÇÃO: Tentar desmutar após 500ms e verificar se realmente foi desmutado
                      setTimeout(() => {
                        if (remoteVideoRef.current) {
                          const wasMuted = remoteVideoRef.current.muted;
                          remoteVideoRef.current.muted = false;
                          console.log(`🔊 [WEBRTC] Áudio remoto reativado automaticamente (estava mudo: ${wasMuted}, agora: ${remoteVideoRef.current.muted})`);
                          
                          // ✅ DEBUG: Verificar tracks de áudio do stream
                          const stream = remoteVideoRef.current.srcObject as MediaStream | null;
                          if (stream) {
                            const audioTracks = stream.getAudioTracks();
                            console.log(`🔊 [WEBRTC] Stream tem ${audioTracks.length} tracks de áudio:`, 
                              audioTracks.map(t => ({ enabled: t.enabled, readyState: t.readyState, muted: t.muted }))
                            );
                          }
                        }
                      }, 500);
                    })
                    .catch((err: any) => {
                      console.log('⚠️ [WEBRTC] Play falhou:', err?.name, err?.message);
                      
                      // Verificar se é bloqueio de autoplay real
                      const isAutoplayError = err?.name === 'NotAllowedError' || 
                                             err?.name === 'NotSupportedError';
                      
                      if (isAutoplayError) {
                        console.warn('📹 [WEBRTC] ⚠️ Autoplay bloqueado pelo navegador. Solicitando interação do usuário...');
                        setIsRemotePlaybackBlocked(true);
                      } else {
                        // Outros erros (AbortError, etc) não devem mostrar overlay
                        console.log('📹 [WEBRTC] ℹ️ Play será retomado automaticamente quando stream tiver dados');
                        setIsRemotePlaybackBlocked(false);
                      }
                      
                      // ✅ CORREÇÃO: Tentar desmutar mesmo quando play() falhar
                      setTimeout(() => {
                        if (remoteVideoRef.current) {
                          remoteVideoRef.current.muted = false;
                          console.log('🔊 [WEBRTC] Áudio desmutado mesmo após falha no play()');
                        }
                      }, 1000);
                    });
                } else {
                  // Fallback para navegadores antigos
                  setIsRemotePlaybackBlocked(false);
                }
              } else {
                console.log('⏭️ [WEBRTC] Pulando play() - mesmo stream já está tocando');
                
                // ✅ CORREÇÃO: Garantir que o áudio seja desmutado mesmo quando pulamos o play()
                // (quando o segundo track chega)
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    const wasMuted = remoteVideoRef.current.muted;
                    remoteVideoRef.current.muted = false;
                    console.log(`🔊 [WEBRTC] Áudio remoto garantido após segundo track (estava mudo: ${wasMuted}, agora: ${remoteVideoRef.current.muted})`);
                    
                    // ✅ DEBUG: Verificar se o vídeo está tocando
                    if (remoteVideoRef.current.paused) {
                      console.warn('⚠️ [WEBRTC] Vídeo remoto está pausado, tentando play()...');
                      remoteVideoRef.current.play().catch((err) => {
                        console.error('❌ [WEBRTC] Erro ao fazer play() do vídeo remoto:', err);
                      });
                    }
                    
                    // ✅ DEBUG: Verificar tracks de áudio do stream
                    const stream = remoteVideoRef.current.srcObject as MediaStream | null;
                    if (stream) {
                      const audioTracks = stream.getAudioTracks();
                      console.log(`🔊 [WEBRTC] Stream tem ${audioTracks.length} tracks de áudio:`, 
                        audioTracks.map(t => ({ enabled: t.enabled, readyState: t.readyState, muted: t.muted }))
                      );
                    }
                  }
                }, 500);
              }

              return true;
            } catch (error) {
              console.error('📹 [WEBRTC] ❌ Erro ao anexar stream remoto:', error);
              return false;
            }
          } else if (retries > 0) {
            console.warn(`📹 [WEBRTC] ⚠️ remoteVideoRef.current não disponível, tentando novamente em 100ms (${retries} tentativas restantes)...`);
            setTimeout(() => attachRemoteStream(stream, retries - 1), 100);
            return false;
          } else {
            console.error('📹 [WEBRTC] ❌ Falha ao anexar stream remoto após múltiplas tentativas!');
            return false;
          }
        };

        if (attachRemoteStream(e.streams[0])) {
            console.log('🔗 [WEBRTC] ✅ Stream remoto atribuído com sucesso');
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

    console.log('🩺 [PACIENTE] Oferta recebida de:', offerData.offererUserName);
    console.log('🩺 [PACIENTE] 🚀 AUTO-ANSWER: Executando fluxo automaticamente...');
    
    // ✅ CORREÇÃO: Verificar estado da PeerConnection para reconexão
    if (peerConnectionRef.current) {
      const state = peerConnectionRef.current.connectionState;
      const iceState = peerConnectionRef.current.iceConnectionState;
      
      console.log(`🔍 [AUTO-ANSWER] PeerConnection existe. connectionState: ${state}, iceConnectionState: ${iceState}`);
      
      // Se está conectado/conectando e chamada ativa, ignorar
      if (isCallActive && (state === 'connected' || state === 'connecting')) {
        console.warn('⚠️ [AUTO-ANSWER] Chamada já está ativa e conectada, ignorando nova oferta');
        return;
      }
      
      // Se está failed/disconnected/closed, limpar para aceitar nova oferta
      if (state === 'failed' || state === 'closed' || state === 'disconnected' || 
          iceState === 'failed' || iceState === 'closed' || iceState === 'disconnected') {
        console.log('🔄 [AUTO-ANSWER] Conexão anterior falhou/desconectou, limpando PeerConnection...');
        try {
          peerConnectionRef.current.close();
        } catch (e) {
          console.warn('Erro ao fechar PeerConnection:', e);
        }
        peerConnectionRef.current = null;
        setIsCallActive(false); // Resetar flag
        console.log('✅ [AUTO-ANSWER] PeerConnection limpo, prosseguindo com nova oferta');
      }
    }
    
    // ✅ CORREÇÃO: Verificar se mídia está pronta
    if (!isMediaReadyRef.current || !localStreamRef.current) {
      console.warn('⚠️ [AUTO-ANSWER] Mídia ainda não está pronta, GUARDANDO offer para processar depois...');
      console.log('⚠️ [AUTO-ANSWER] isMediaReadyRef.current:', isMediaReadyRef.current);
      console.log('⚠️ [AUTO-ANSWER] localStreamRef.current:', !!localStreamRef.current);
      
      // ✅ GUARDAR offer pendente ao invés de tentar novamente
      pendingOfferRef.current = {
        offer: offerData.offer,
        userName: offerData.offererUserName
      };
      console.log('✅ [AUTO-ANSWER] Offer guardada! Será processada quando mídia estiver pronta.');
      return;
    }
    
    console.log('✅ [AUTO-ANSWER] Mídia pronta! Processando offer...');
    console.log('✅ [AUTO-ANSWER] Tracks disponíveis:', localStreamRef.current.getTracks().length);

    // ✅ CORREÇÃO: Atualizar estado E ref simultaneamente

    setRemoteUserName(offerData.offererUserName);

    remoteUserNameRef.current = offerData.offererUserName;

    

    // Armazenar dados da oferta
    setOfferData(offerData);

    

    console.log('🩺 [PACIENTE] ✅ remoteUserName definido (createAnswerButton):', offerData.offererUserName);
    
    // 🚀 AUTO-EXECUTAR: Chamar answer() automaticamente após pequeno delay
    // O delay garante que todos os estados foram atualizados
    setTimeout(async () => {
      console.log('🩺 [PACIENTE] 🚀 AUTO-ANSWER: Iniciando resposta automática...');
      
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
        console.log('🩺 [PACIENTE] ✅ AUTO-ANSWER: Resposta automática processada com sucesso');
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



  // ✅ NOVO: Auto-start da transcrição (apenas para médico)

  const autoStartTranscription = async () => {

    if (userType !== 'doctor') return; // Apenas médico tem transcrição

    if (isTranscriptionActive) return; // Já está ativa

    if (!transcriptionManagerRef.current) {

      console.error('❌ AUTO-START: TranscriptionManager não existe!');

      return;

    }



    console.log('🎙️ AUTO-START: Iniciando transcrição automaticamente...');

    

    // ✅ CRÍTICO: Configurar callbacks ANTES de iniciar

    console.log('🎙️ AUTO-START: Configurando callbacks...');

    setupTranscriptionCallbacks();

    

    setTranscriptionStatus('Conectando...');

    

    // ✅ Verificar se socket está conectado antes de tentar
    if (!socketRef.current || !socketRef.current.connected) {
      console.error('❌ AUTO-START: Socket não está conectado! Aguardando conexão...');
      setTranscriptionStatus('Aguardando conexão...');
      
      // Aguardar até o socket conectar (máximo 10 segundos)
      let attempts = 0;
      const maxAttempts = 20; // 20 tentativas de 500ms = 10 segundos
      const checkSocket = setInterval(() => {
        attempts++;
        if (socketRef.current && socketRef.current.connected) {
          clearInterval(checkSocket);
          console.log('✅ AUTO-START: Socket conectado, iniciando transcrição...');
          startTranscriptionAfterSocketReady();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkSocket);
          console.error('❌ AUTO-START: Timeout aguardando socket conectar');
          setTranscriptionStatus('Erro: Socket não conectou');
        }
      }, 500);
      
      return;
    }
    
    startTranscriptionAfterSocketReady();
  };
  
  const startTranscriptionAfterSocketReady = async () => {
    try {
      console.log('🎙️ AUTO-START: Socket conectado, iniciando transcrição...');
      console.log('🎙️ AUTO-START: Socket state:', socketRef.current?.connected ? 'connected' : 'disconnected');
      
      const success = await transcriptionManagerRef.current!.init();

      if (success) {
        setTranscriptionStatus('Conectado');
        setIsTranscriptionActive(true);
        console.log('✅ AUTO-START: Transcrição iniciada com sucesso!');
      } else {
        setTranscriptionStatus('Erro ao conectar');
        console.error('❌ AUTO-START: Falha ao iniciar transcrição');
      }
    } catch (error) {
      console.error('❌ AUTO-START: Erro ao iniciar transcrição:', error);
      setTranscriptionStatus('Erro');
    }

  };



  const toggleTranscription = async () => {

    if (!transcriptionManagerRef.current) {

      showWarning('Transcrição não inicializada. Faça a chamada primeiro.', 'Transcrição');

      return;

    }



    if (!isTranscriptionActive) {

      // Conectar transcrição

      setTranscriptionStatus('Conectando...');

      

      const success = await transcriptionManagerRef.current.init();

      

      if (success) {

        setTranscriptionStatus('Conectado');

        setIsTranscriptionActive(true);

        

        // ✅ CORREÇÃO: Preservar histórico se já houver transcrições
        const hasExistingTranscript = transcriptionManagerRef.current.getStatus().transcript.length > 0;
        transcriptionManagerRef.current.start(hasExistingTranscript);

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

  // Função para fazer polling do status da consulta quando anamnese está sendo gerada
  const startAnamnesePolling = (consultationId: string) => {
    // Limpar qualquer polling anterior
    if (anamnesePollingRef.current) {
      clearInterval(anamnesePollingRef.current);
    }
    if (anamneseTimeoutRef.current) {
      clearTimeout(anamneseTimeoutRef.current);
    }

    // Guardar o ID da consulta para usar no botão "Acessar Anamnese"
    setCurrentConsultationId(consultationId);

    console.log('🔄 Iniciando polling para verificar status da anamnese...');
    
    anamnesePollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/consultations/${consultationId}`);
        if (!response.ok) {
          console.error('Erro ao verificar status da consulta');
          return;
        }
        
        const data = await response.json();
        const consultation = data.consultation;
        
        console.log('📊 Status da consulta:', consultation.status, '| Etapa:', consultation.etapa);
        
        // ✅ NOVO: Verificar se status=VALIDATION e etapa=ANAMNESE
        if (consultation.status === 'VALIDATION' && consultation.etapa === 'ANAMNESE') {
          console.log('✅ Anamnese pronta! Atualizando botão...');
          
          if (anamnesePollingRef.current) {
            clearInterval(anamnesePollingRef.current);
            anamnesePollingRef.current = null;
          }
          if (anamneseTimeoutRef.current) {
            clearTimeout(anamneseTimeoutRef.current);
            anamneseTimeoutRef.current = null;
          }
          
          setIsGeneratingAnamnese(false);
          setAnamneseReady(true);
          
          // Mostrar notificação na página atual (sem abrir nova aba automaticamente)
          showSuccess('Anamnese gerada com sucesso!\n\nClique em "Acessar Anamnese" para visualizar.', 'Anamnese Gerada');
        }
      } catch (error) {
        console.error('Erro ao verificar status da consulta:', error);
      }
    }, 3000); // Verificar a cada 3 segundos
    
    // Limpar polling após 5 minutos (timeout de segurança)
    anamneseTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Timeout: Polling de anamnese encerrado após 5 minutos');
      if (anamnesePollingRef.current) {
        clearInterval(anamnesePollingRef.current);
        anamnesePollingRef.current = null;
      }
      setIsGeneratingAnamnese(false);
    }, 300000); // 5 minutos
  };

  // Limpar polling quando componente desmontar
  useEffect(() => {
    return () => {
      if (anamnesePollingRef.current) {
        clearInterval(anamnesePollingRef.current);
      }
      if (anamneseTimeoutRef.current) {
        clearTimeout(anamneseTimeoutRef.current);
      }
    };
  }, []);

  // ✅ NOVO: Função para copiar link do paciente
  const handleCopyPatientLink = async () => {
    try {
      const baseUrl = window.location.origin;
      const patientParams = new URLSearchParams({
        roomId: roomId,
        role: 'participant',
      });
      
      if (patientId) {
        patientParams.append('patientId', patientId);
      }
      
      if (patientName) {
        patientParams.append('patientName', patientName);
      }

      const patientLink = `${baseUrl}/consulta/online/patient?${patientParams.toString()}`;
      
      await navigator.clipboard.writeText(patientLink);
      setLinkCopied(true);
      
      // Resetar mensagem após 3 segundos
      setTimeout(() => {
        setLinkCopied(false);
      }, 3000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      showError('Erro ao copiar link. Tente novamente.', 'Erro ao Copiar');
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
                .or(`room_name.eq.${roomId},room_id.eq.${roomId}`)
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

              const webhookEndpoints = getWebhookEndpoints();
              const webhookHeaders = getWebhookHeaders();
              
              // ✅ NOVO: Adicionar consulta_finalizada: true ao finalizar consulta
              const webhookData = {
                consultationId,
                doctorId: doctorId || null,
                patientId: patientId || 'unknown',
                transcription: transcriptionText,
                consulta_finalizada: true  // ✅ Consulta está sendo finalizada
              };
              
              console.log('📤 Enviando transcrição final para webhook (consulta_finalizada: true):', webhookData);

              await fetch(webhookEndpoints.transcricao, {
                method: 'POST',
                headers: webhookHeaders,
                body: JSON.stringify(webhookData),
                keepalive: true
              }).catch(() => {});
            } catch (_) {
              // Silenciar erros (não bloquear UI)
            }

          // 🔍 DEBUG [REFERENCIA] Sala finalizada com sucesso
          console.log('🔍 DEBUG [REFERENCIA] Sala finalizada com sucesso');
          setIsEndingRoom(false);

          showSuccess(`Sala finalizada!\n\nTranscrições salvas no banco de dados\nTotal: ${response.saveResult.transcriptionsCount} transcrições`, 'Sala Finalizada');

          router.push('/consulta/nova');

        } else {

          // 🔍 DEBUG [REFERENCIA] Erro ao finalizar sala
          console.log('🔍 DEBUG [REFERENCIA] Erro ao finalizar sala:', response.error);
          setIsEndingRoom(false);

          showError('Erro ao finalizar sala: ' + response.error, 'Erro ao Finalizar');

        }

      });

    }

  };



  // ✅ CORREÇÃO: Removido early return - deixar useEffects executarem primeiro

  // Loading state agora é controlado pelos useEffects



  return (

    <div className="consultation-room-container">

      {/* ✅ NOVO: Notificação de paciente entrando */}
      {showPatientJoinedNotification && userType === 'doctor' && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            minWidth: '300px',
            animation: 'slideInRight 0.3s ease-out',
            cursor: 'pointer'
          }}
          onClick={() => setShowPatientJoinedNotification(false)}
        >
          <CheckCircle size={24} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
              Paciente Entrou na Sala
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              {patientJoinedName} está agora na consulta
            </div>
          </div>
        </div>
      )}

      {/* Header */}

      <div className="room-header">

        <div className="room-info">

          <h1>Consulta Online - {userType === 'doctor' ? 'Médico' : 'Paciente'}</h1>

          <p>
            <span style={{ fontWeight: '600' }}>{patientName || participantName}</span>
            {roomData?.roomName && roomData.roomName !== patientName && (
              <>
                {' • '}
                <span style={{ color: '#6b7280', fontSize: '0.95em' }}>
                  {roomData.roomName.replace(/^Consulta\s*[-–]\s*/i, '').trim() || roomData.roomName}
                </span>
              </>
            )}
            {' • '}
            <span className={isConnected ? 'status-connected' : 'status-disconnected'}>
              <span className={isConnected ? 'status-indicator status-indicator-connected' : 'status-indicator status-indicator-disconnected'}></span>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>

            {/* ✅ NOVO: Indicador de reconexão */}

            {isReconnecting && (

              <span className="status-reconnecting" style={{

                marginLeft: '10px',

                color: '#ff9800',

                fontWeight: 'bold',

                animation: 'pulse 1.5s infinite'

              }}>

                🔄 Reconectando...

              </span>

            )}

            {/* ✅ NOVO: Timer da chamada */}

            {isCallTimerActive && (

              <span style={{

                marginLeft: '15px',

                padding: '4px 12px',

                backgroundColor: '#4CAF50',

                color: 'white',

                borderRadius: '20px',

                fontSize: '0.9em',

                fontWeight: 'bold',

                fontFamily: 'monospace'

              }}>

                ⏱️ {formatCallDuration(callDuration)}

              </span>

            )}

            

            {/* ✅ NOVO: Indicador de transcrição automática (só para médico) */}

            {userType === 'doctor' && (

              <span style={{

                marginLeft: '10px',

                color: isTranscriptionActive ? '#4caf50' : '#999',

                fontWeight: '500',

                fontSize: '0.9em'

              }}>

                • 🎙️ <span style={{color: isTranscriptionActive ? '#4caf50' : '#999'}}>

                  {isTranscriptionActive ? 'Transcrição ativa' : 'Aguardando transcrição'}

                </span>

              </span>

            )}

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

          
          {/* ✅ NOVO: Tela de boas-vindas com botão para paciente */}
          {userType === 'patient' && !hasJoinedRoom && isPatientReadyToJoin && (
            <div className="patient-welcome-screen">
              <div className="welcome-card">
                <h2>🩺 Bem-vindo à Consulta Online</h2>
                <p className="patient-name">Olá, <strong>{participantName}</strong>!</p>
                <p className="welcome-text">
                  Você está prestes a entrar na consulta com o médico.
                  <br />
                  Certifique-se de que sua câmera e microfone estão funcionando.
                </p>
                <button 
                  className="join-button" 
                  onClick={handlePatientJoinClick}
                >
                  📹 Entrar na Consulta
                </button>
                <p className="connection-status">
                  {isConnected ? '✅ Conectado ao servidor' : '🔄 Conectando ao servidor...'}
                </p>
              </div>
            </div>
          )}
          
          {/* ✅ Indicador de carregamento (enquanto prepara) */}
          {userType === 'patient' && !hasJoinedRoom && !isPatientReadyToJoin && (
            <div className="auto-start-indicator">
              <div className="spinner"></div>
              <span>Preparando consulta...</span>
            </div>
          )}

          

          {/* ✅ DESABILITADO: Transcrição agora é automática */}

          {/* {userType === 'doctor' && (

            <button 

              className="btn-transcription" 

              onClick={toggleTranscription}

            >

              {isTranscriptionActive ? 'Parar Transcrição' : 'Ativar Transcrição'}

            </button>

          )} */}

          

          {/* ✅ Dropdown de Ações - apenas para médico */}
          {userType === 'doctor' && (
            <div style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Dropdown Menu */}
              <div style={{ position: 'relative' }}>
              <button 
                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                style={{
                  padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="Ações da consulta"
                >
                  <MoreVertical size={16} />
                  <span>Ações</span>
                  {showActionsDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showActionsDropdown && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 998,
                      }}
                      onClick={() => setShowActionsDropdown(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        minWidth: '220px',
                        zIndex: 999,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Copiar Link */}
                      <button
                        onClick={() => {
                          handleCopyPatientLink();
                          setShowActionsDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: linkCopied ? '#f0fdf4' : 'transparent',
                          color: linkCopied ? '#16a34a' : '#374151',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          if (!linkCopied) e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!linkCopied) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{linkCopied ? 'Link Copiado!' : 'Copiar Link do Paciente'}</span>
              </button>
              
                      {/* Sugestões IA */}
              <button 
                onClick={() => {
                  setSuggestionsEnabled(!suggestionsEnabled);
                  if (!suggestionsEnabled) {
                    setAiSuggestions([]);
                    setSuggestionsPanelVisible(true);
                  } else {
                    setSuggestionsPanelVisible(false);
                  }
                          setShowActionsDropdown(false);
                }}
                style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: suggestionsEnabled ? '#f0fdf4' : 'transparent',
                          color: suggestionsEnabled ? '#16a34a' : '#374151',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          if (!suggestionsEnabled) e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!suggestionsEnabled) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Brain size={16} style={{ color: suggestionsEnabled ? '#16a34a' : '#6b7280' }} />
                        <span>{suggestionsEnabled ? 'Desativar' : 'Ativar'} Sugestões IA</span>
              </button>

                      {/* Gerar/Acessar Anamnese */}
              <button 
                onClick={async () => {
                          setShowActionsDropdown(false);
                          
                  // ✅ Se anamnese já está pronta, abrir em nova aba
                  if (anamneseReady && currentConsultationId) {
                    const anamneseUrl = `${window.location.origin}/consultas?consulta_id=${currentConsultationId}`;
                    window.open(anamneseUrl, '_blank');
                    return;
                  }
                  
                  if (isGeneratingAnamnese) return;
                  
                  try {
                    setIsGeneratingAnamnese(true);
                    
                    // Obter consultationId e doctorId
                    const { supabase } = await import('@/lib/supabase');
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    let doctorId: string | null = null;
                    if (session?.user?.id) {
                      const { data: medico } = await supabase
                        .from('medicos')
                        .select('id')
                        .eq('user_auth', session.user.id)
                        .single();
                      doctorId = medico?.id || null;
                    }
                    
                    let consultationId: string | null = null;
                    const { data: callSession } = await supabase
                      .from('call_sessions')
                      .select('consultation_id')
                      .or(`room_name.eq.${roomId},room_id.eq.${roomId}`)
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
                    
                    if (!consultationId) {
                              showError('Não foi possível identificar a consulta. Tente novamente.', 'Erro');
                      setIsGeneratingAnamnese(false);
                      return;
                    }
                    
                    // ✅ NOVO: Enviar transcrição para webhook com consulta_finalizada: false
                    const webhookEndpoints = getWebhookEndpoints();
                    const webhookHeaders = getWebhookHeaders();
                    
                    const webhookData = {
                      consultationId: consultationId,
                      doctorId: doctorId || null,
                      patientId: patientId || 'unknown',
                      transcription: transcriptionText,
                      consulta_finalizada: false  // ✅ Consulta continua ativa
                    };
                    
                    console.log('📤 Enviando transcrição para webhook (consulta_finalizada: false):', webhookData);
                    
                    const response = await fetch(webhookEndpoints.transcricao, {
                      method: 'POST',
                      headers: webhookHeaders,
                      body: JSON.stringify(webhookData),
                    });

                    if (!response.ok) {
                      throw new Error('Erro ao enviar transcrição para gerar anamnese');
                    }

                    // Atualizar status da consulta para PROCESSING
                    await fetch(`/api/consultations/${consultationId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        status: 'PROCESSING',
                        etapa: 'ANAMNESE'
                      }),
                    });

                    // Iniciar polling para verificar quando anamnese estiver pronta
                    startAnamnesePolling(consultationId);
                    
                    // Mostrar mensagem informativa
                            showInfo('Anamnese da consulta está sendo gerada!\n\nO botão mudará para "Acessar Anamnese" quando estiver pronta.\n\nVocê pode continuar a consulta normalmente.', 'Gerando Anamnese');
                    
                  } catch (error) {
                    console.error('Erro ao gerar anamnese:', error);
                            showError('Erro ao gerar anamnese. Tente novamente.', 'Erro ao Gerar');
                    setIsGeneratingAnamnese(false);
                  }
                }}
                disabled={isGeneratingAnamnese}
                style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: isGeneratingAnamnese ? '#f3f4f6' : 'transparent',
                          color: isGeneratingAnamnese ? '#9ca3af' : (anamneseReady ? '#3b82f6' : '#10b981'),
                  border: 'none',
                  cursor: isGeneratingAnamnese ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'background 0.2s',
                          textAlign: 'left',
                          opacity: isGeneratingAnamnese ? 0.7 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isGeneratingAnamnese) e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isGeneratingAnamnese) e.currentTarget.style.background = 'transparent';
                        }}
              >
                {isGeneratingAnamnese ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                              border: '2px solid #9ca3af',
                              borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Gerando...</span>
                  </>
                ) : anamneseReady ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Acessar Anamnese</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Gerar Anamnese</span>
                  </>
                )}
              </button>
                    </div>
                  </>
                )}
              </div>

              {/* Botão Finalizar Sala (separado por ser ação crítica) */}
              <button 
                className="btn-end-room" 
                onClick={endRoom}
                disabled={isEndingRoom}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isEndingRoom ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: isEndingRoom ? 0.7 : 1,
                }}
              >
                {isEndingRoom ? 'Finalizando...' : 'Finalizar Sala'}
              </button>
            </div>
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

          {isRemotePlaybackBlocked && (
            <div className="remote-playback-overlay">
              <p>⚠️ O navegador bloqueou o áudio/vídeo remoto.</p>
              <button type="button" onClick={resumeRemotePlayback}>
                Liberar áudio e vídeo
              </button>
            </div>
          )}

          

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

        {userType === 'doctor' && !isTranscriptionMinimized && (

          <div className="video-sidebar">

            {/* Section de Transcrição - APENAS para médicos */}

            <div className="transcription-box">

            <div className="transcription-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsTranscriptionMinimized(!isTranscriptionMinimized)}>

              <h6 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, flex: 1 }}>

                Transcrição

                <span className={`badge ${transcriptionStatus === 'Conectado' ? 'bg-success' : 'bg-secondary'}`}>

                  {transcriptionStatus}

                </span>

              </h6>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTranscriptionMinimized(!isTranscriptionMinimized);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
                title="Minimizar transcrição"
              >
                <Minimize2 size={16} />
              </button>

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

        {/* Ícone flutuante da transcrição quando minimizada */}
        {userType === 'doctor' && isTranscriptionMinimized && (
          <button
            onClick={() => setIsTranscriptionMinimized(false)}
            className="transcription-floating-icon"
            title="Expandir transcrição"
          >
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mic size={24} />
              {isTranscriptionActive && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#4caf50',
                  border: '2px solid white',
                  animation: 'pulse 2s infinite',
                }}></span>
              )}
      </div>
            {transcriptionText.length > 0 && (
              <span className="transcription-badge">
                {transcriptionText.split('\n').filter(line => line.trim().length > 0).length}
              </span>
            )}
          </button>
        )}

      </div>



      {/* 🤖 Painel de Sugestões de IA - Apenas para médicos - Só aparece se estiver habilitado e visível */}

      {userType === 'doctor' && suggestionsEnabled && suggestionsPanelVisible && aiSuggestions.length > 0 && (

        <SuggestionsPanel

          suggestions={aiSuggestions}

          enabled={true}

          onClose={() => setSuggestionsPanelVisible(false)}

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



      {/* Modal de finalização removido - agora redireciona para página /consulta/finalizada */}

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
      
      {/* ✅ NOVO: Estilos para tela de boas-vindas do paciente */}
      <style jsx>{`
        .patient-welcome-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.5s ease-in;
        }
        
        .welcome-card {
          background: white;
          border-radius: 20px;
          padding: 3rem 2.5rem;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
          animation: slideUp 0.6s ease-out;
        }
        
        .welcome-card h2 {
          font-size: 2rem;
          color: #333;
          margin-bottom: 1rem;
          font-weight: 700;
        }
        
        .patient-name {
          font-size: 1.2rem;
          color: #667eea;
          margin-bottom: 1.5rem;
        }
        
        .welcome-text {
          font-size: 1rem;
          color: #666;
          line-height: 1.6;
          margin-bottom: 2rem;
        }
        
        .join-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 1rem 3rem;
          font-size: 1.2rem;
          font-weight: 600;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .join-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        
        .join-button:active {
          transform: translateY(0);
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .connection-status {
          margin-top: 1.5rem;
          font-size: 0.9rem;
          color: #999;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @media (max-width: 768px) {
          .welcome-card {
            padding: 2rem 1.5rem;
          }
          
          .welcome-card h2 {
            font-size: 1.5rem;
          }
          
          .join-button {
            padding: 0.875rem 2rem;
            font-size: 1rem;
          }
        }
      `}</style>

    </div>

  );

}

