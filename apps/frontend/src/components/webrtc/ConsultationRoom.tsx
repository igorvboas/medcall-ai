'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AudioProcessor } from './AudioProcessor';
import { TranscriptionManager } from './TranscriptionManager';

interface ConsultationRoomProps {
  roomId: string;
  role?: 'host' | 'participant';
  patientId?: string;
  patientName?: string;
  onEndCall?: () => void;
}

export function ConsultationRoom({ 
  roomId, 
  role, 
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
  
  // Refs para WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Refs para transcrição
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const transcriptionManagerRef = useRef<TranscriptionManager | null>(null);
  
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
        if (window.io) {
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
            console.log('Conexão estabelecida com o servidor');
            setupSocketListeners();
            joinRoom();
          });
        }
      } catch (error) {
        console.error('Erro ao carregar Socket.IO:', error);
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
      if (peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(iceCandidate);
      }
    });

    // Transcrição listeners
    socketRef.current.on('receiveTranscriptionFromPeer', (data: any) => {
      console.log('Transcrição recebida de', data.from, ':', data.transcription);
      setTranscriptionText(prev => prev + `[${data.from}]: ${data.transcription}\n`);
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
    await fetchUserMedia();
    await createPeerConnection();

    try {
      console.log("Criando oferta para sala:", roomId);
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);
      setDidIOffer(true);
      
      // Enviar oferta com roomId
      socketRef.current.emit('newOffer', {
        roomId: roomId,
        offer: offer
      });
    } catch(err) {
      console.error(err);
    }
  };

  const answerOffer = async (offerData: any) => {
    await fetchUserMedia();
    await createPeerConnection({ offer: offerData.offer });
    
    const answer = await peerConnectionRef.current!.createAnswer({});
    await peerConnectionRef.current!.setLocalDescription(answer);
    
    setRemoteUserName(offerData.offererUserName);
    console.log('Peer remoto identificado:', offerData.offererUserName);
    
    // Enviar resposta com roomId
    socketRef.current.emit('newAnswer', {
      roomId: roomId,
      answer: answer
    }, (offerIceCandidates: any[]) => {
      offerIceCandidates.forEach(c => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addIceCandidate(c);
        }
      });
    });
  };

  const addAnswer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(data.answer);
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
      
      // Inicializar AudioProcessor para transcrição
      if (!audioProcessorRef.current) {
        audioProcessorRef.current = new AudioProcessor();
        await audioProcessorRef.current.init(stream);
        
        // Inicializar TranscriptionManager
        if (!transcriptionManagerRef.current) {
          transcriptionManagerRef.current = new TranscriptionManager();
          transcriptionManagerRef.current.setSocket(socketRef.current);
          transcriptionManagerRef.current.setAudioProcessor(audioProcessorRef.current);
          
          // Configurar callback para atualizar UI
          transcriptionManagerRef.current.onTranscriptUpdate = (transcript: string) => {
            setTranscriptionText(transcript);
          };
        }
      }
    } catch(err) {
      console.error(err);
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
          <h1>Consulta Online - {userRole === 'host' ? 'Médico' : 'Paciente'}</h1>
          <p>Sala: {roomData?.roomName || roomId} | Paciente: {patientName || participantName}</p>
        </div>
        
        <div className="room-controls">
          {userRole === 'host' && !isCallActive && (
            <button className="btn-call" onClick={call}>
              Call
            </button>
          )}
          
          {userRole === 'host' && (
            <button 
              className="btn-transcription" 
              onClick={toggleTranscription}
            >
              {isTranscriptionActive ? 'Parar Transcrição' : 'Ativar Transcrição'}
            </button>
          )}
          
          {userRole === 'host' && (
            <button className="btn-end-room" onClick={endRoom}>
              Finalizar Sala
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

        {/* Sidebar */}
        {userRole === 'host' && (
          <div className="video-sidebar">
            {/* Status da transcrição */}
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
