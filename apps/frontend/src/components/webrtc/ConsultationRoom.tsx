'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AudioProcessor } from './AudioProcessor';
import { TranscriptionManager } from './TranscriptionManager';

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
  
  // Refs para WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Refs para transcrição
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const transcriptionManagerRef = useRef<TranscriptionManager | null>(null);
  
  // Fila de ICE candidates pendentes
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  // Variáveis WebRTC
  const [didIOffer, setDidIOffer] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('');

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

  // Carregar Socket.IO dinamicamente
  useEffect(() => {
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
        socketRef.current = window.io.connect(
          process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001',
          {
            auth: {
              userName: userName || 'User-' + Math.floor(Math.random() * 100000),
              password: "x"
            }
          }
        );

        socketRef.current.on('connect', () => {
          console.log('✅ Conexão estabelecida com o servidor');
          setIsConnected(true);
          setupSocketListeners();
          joinRoom();
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

    if (userName) {
      loadSocketIO();
    }

    // Cleanup ao desmontar componente
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
  }, [userName]);

  // Determinar nome do usuário baseado no role
  useEffect(() => {
    if (role === 'host') {
      // Host - usar nome salvo ou solicitar
      const savedHostName = localStorage.getItem('hostName');
      if (savedHostName) {
        setUserName(savedHostName);
      } else {
        const prompted = prompt('Digite seu nome (Host):');
        if (prompted && prompted.trim()) {
          setUserName(prompted.trim());
          localStorage.setItem('hostName', prompted.trim());
        }
      }
    } else {
      // Participante - solicitar nome
      const name = prompt('Digite seu nome:');
      if (name && name.trim()) {
        setUserName(name.trim());
      }
    }
  }, [role]);

  // Inicializar setup automático para pacientes quando socket conectar
  useEffect(() => {
    if (userName && userType === 'patient' && isConnected) {
      console.log('🩺 [PACIENTE] Socket conectado, iniciando setup automático...');
      initializeMediaForPatient();
    }
  }, [userName, userType, isConnected]);

  const initializeMediaForPatient = async () => {
    try {
      console.log('🩺 [PACIENTE] Inicializando setup completo automaticamente...');
      
      // 1. Obter mídia (câmera/mic) - igual ao fetchUserMedia do Answer
      await fetchUserMedia();
      
      // 2. Ativar transcrição automaticamente para participante
      if (userType === 'patient') {
        await autoActivateTranscriptionForParticipant();
      }
      
      console.log('🩺 [PACIENTE] ✅ Setup completo finalizado - pronto para receber chamadas');
    } catch (error) {
      console.error('🩺 [PACIENTE] ❌ Erro no setup automático:', error);
    }
  };

  const autoActivateTranscriptionForParticipant = async () => {
    console.log('🎤 [PACIENTE] Ativando transcrição automaticamente...');
    
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

    // Transcrição listeners
    socketRef.current.on('receiveTranscriptionFromPeer', (data: any) => {
      console.log('Transcrição recebida de', data.from, ':', data.transcription);
      setTranscriptionText(prev => prev + `[${data.from}]: ${data.transcription}\n`);
    });

    // Para pacientes: mostrar botão Answer quando receber oferta
    socketRef.current.on('newOffer', (data: any) => {
      if (userType === 'patient') {
        setShowAnswerButton(true);
      }
      // Processar oferta normalmente
      answerOffer(data);
    });
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
    // Verificar se socket está conectado
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Erro: Não conectado ao servidor. Aguarde a conexão...');
      return;
    }

    await fetchUserMedia();
    await createPeerConnection();

    try {
      console.log("Criando oferta para sala:", roomId);
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);
      setDidIOffer(true);
      setIsCallActive(true);
      
      // Enviar oferta com roomId
      socketRef.current.emit('newOffer', {
        roomId: roomId,
        offer: offer
      });
    } catch(err) {
      console.error(err);
      alert('Erro ao iniciar chamada: ' + err);
    }
  };

  const answer = async () => {
    // Verificar se socket está conectado
    if (!socketRef.current || !socketRef.current.connected) {
      alert('Erro: Não conectado ao servidor. Aguarde a conexão...');
      return;
    }

    if (!localStreamRef.current) {
      alert('Erro: Stream de mídia não disponível. Recarregue a página.');
      return;
    }
    
    console.log('🩺 [PACIENTE] Respondendo à chamada...');
    setIsCallActive(true);
    setShowAnswerButton(false);
    
    // O peerConnection já foi criado quando recebeu a oferta
    // E o setup já foi feito automaticamente ao carregar a página
    if (peerConnectionRef.current && localStreamRef.current) {
      try {
        // Adicionar tracks do stream local ao peerConnection
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
        });
        
        // Criar e enviar resposta
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        socketRef.current.emit('newAnswer', {
          answer: answer,
          roomId: roomId,
          from: userName
        });
        
        console.log('🩺 [PACIENTE] ✅ Resposta enviada - chamada estabelecida');
      } catch(err) {
        console.error('🩺 [PACIENTE] ❌ Erro ao responder chamada:', err);
        alert('Erro ao responder chamada: ' + err);
      }
    }
  };

  const answerOffer = async (offerData: any) => {
    console.log('🩺 [PACIENTE] Processando oferta recebida...');
    
    // Não precisa fazer fetchUserMedia novamente - já foi feito automaticamente
    await createPeerConnection({ offer: offerData.offer });
    
    const answer = await peerConnectionRef.current!.createAnswer({});
    await peerConnectionRef.current!.setLocalDescription(answer);
    
    setRemoteUserName(offerData.offererUserName);
    console.log('🩺 [PACIENTE] Peer remoto identificado:', offerData.offererUserName);
    
    // Processar ICE candidates pendentes após definir localDescription
    processPendingIceCandidates();
    
    // Enviar resposta com roomId
    socketRef.current.emit('newAnswer', {
      roomId: roomId,
      answer: answer
    }, (offerIceCandidates: any[]) => {
      offerIceCandidates.forEach(c => {
        addIceCandidate(c);
      });
    });
    
    console.log('🩺 [PACIENTE] ✅ Oferta processada e resposta criada');
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
    try {
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
          
          // Configurar callback para atualizar UI
          transcriptionManagerRef.current.onTranscriptUpdate = (transcript: string) => {
            setTranscriptionText(transcript);
          };
        }
      } else {
        console.log('AudioProcessor já inicializado, reutilizando...');
      }
    } catch(err) {
      console.error('Erro ao obter mídia:', err);
    }
  };

  const createPeerConnection = async (offerObj?: any) => {
    peerConnectionRef.current = new RTCPeerConnection(peerConfiguration);
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
      });
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
    
    peerConnectionRef.current.addEventListener('track', e => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    });

    if(offerObj) {
      await peerConnectionRef.current.setRemoteDescription(offerObj.offer);
      // Processar ICE candidates pendentes após definir remoteDescription
      processPendingIceCandidates();
    }
  };

  const createAnswerButton = (offerData: any) => {
    // Esta função seria chamada para mostrar botão de resposta
    // Por enquanto, vamos responder automaticamente
    answerOffer(offerData);
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

  // Loading state
  if (!userName) {
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

          {userType === 'patient' && isCallActive && (
            <button 
              className="btn-transcription" 
              onClick={toggleTranscription}
            >
              {isTranscriptionActive ? 'Parar Transcrição' : 'Ativar Transcrição'}
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

            {/* Section de Transcrição - Para médicos e pacientes (quando chamada ativa) */}
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
    </div>
  );
}
