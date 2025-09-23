import { useEffect, useState, useCallback } from 'react';
import { useDataChannel } from '@livekit/components-react';
import { io, Socket } from 'socket.io-client';

interface TranscriptionSegment {
  id: string;
  text: string;
  participantId: string;
  participantName: string;
  timestamp: Date;
  final: boolean;
  confidence?: number;
}

interface UseTranscriptionLiveKitProps {
  roomName: string;
  participantId: string;
  consultationId: string;
  enabled?: boolean;
}

export function useTranscriptionLiveKit({
  roomName,
  participantId,
  consultationId,
  enabled = true,
}: UseTranscriptionLiveKitProps) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  console.log('📝 Hook useTranscriptionLiveKit iniciado com:', {
    roomName,
    participantId,
    consultationId,
    enabled
  });

  // Conectar ao WebSocket para controle de transcrição
  useEffect(() => {
    if (!enabled || !roomName || !participantId || !consultationId) return;

    console.log('🔗 Conectando ao WebSocket para controle de transcrição...');
    
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
    const socketUrl = gatewayUrl.replace('http', 'ws');
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true
    });

    socketInstance.on('connect', () => {
      console.log('✅ Conectado ao WebSocket para controle de transcrição');
      setSocket(socketInstance);
      
      // Iniciar transcrição online
      socketInstance.emit('online:start-transcription', {
        roomName,
        consultationId,
        participantId,
        participantName: participantId
      });
    });

    socketInstance.on('online:transcription-started', (data) => {
      console.log('🎤 Transcrição online iniciada:', data);
      setIsConnected(true);
      setError(null);
      
      // Iniciar captura de áudio real do LiveKit
      startLiveKitAudioCapture(socketInstance);
    });

    socketInstance.on('online:transcription-stopped', (data) => {
      console.log('🛑 Transcrição online parada:', data);
      setIsConnected(false);
    });

    socketInstance.on('error', (data) => {
      console.error('❌ Erro na transcrição online:', data);
      setError(data.message || 'Erro desconhecido');
    });

    return () => {
      if (socketInstance.connected) {
        socketInstance.emit('online:stop-transcription', { roomName, consultationId });
        socketInstance.disconnect();
      }
    };
  }, [enabled, roomName, participantId, consultationId]);

  // Capturar áudio real do LiveKit
  const startLiveKitAudioCapture = (socket: Socket) => {
    try {
      console.log('🎤 Iniciando captura de áudio real do LiveKit...');
      
      // Aguardar LiveKit carregar completamente
      setTimeout(() => {
        const audioElements = document.querySelectorAll('audio');
        console.log(`🔍 Elementos de áudio encontrados: ${audioElements.length}`);
        
        if (audioElements.length > 0) {
          audioElements.forEach((audio, index) => {
            if (audio.srcObject) {
              const stream = audio.srcObject as MediaStream;
              const audioTracks = stream.getAudioTracks();
              
              if (audioTracks.length > 0) {
                console.log(`✅ Track de áudio encontrado ${index}, iniciando captura...`);
                captureAudioFromStream(stream, socket);
              }
            }
          });
        } else {
          console.log('⚠️ Nenhum elemento de áudio do LiveKit encontrado');
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar captura de áudio:', error);
    }
  };

  // Capturar áudio de um stream
  const captureAudioFromStream = (stream: MediaStream, socket: Socket) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (!socket.connected) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Verificar se há áudio (não silêncio)
        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
        if (!hasAudio) return;
        
        // Converter para Int16Array
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Enviar para o backend
        const audioData = Buffer.from(int16Data.buffer).toString('base64');
        socket.emit('online:audio-data', {
          roomName,
          participantId,
          audioData,
          sampleRate: 16000,
          channels: 1
        });
        
        console.log('🎤 Áudio enviado para transcrição');
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log('✅ Captura de áudio LiveKit iniciada');
      
    } catch (error) {
      console.error('❌ Erro ao capturar áudio:', error);
    }
  };

  // Callback para processar mensagens recebidas via LiveKit Data Channels
  const onDataReceived = useCallback((message: any) => {
    if (!enabled) return;

    try {
      console.log('📝 [LiveKit] Data channel message received:', message);

      // Verificar se a mensagem tem payload
      if (!message.payload) return;

      // Decodificar payload
      const decoder = new TextDecoder();
      const messageStr = decoder.decode(message.payload);
      const parsedMessage = JSON.parse(messageStr);

      console.log('📝 [LiveKit] Mensagem decodificada:', parsedMessage);

      // Verificar se é mensagem de transcrição
      if (parsedMessage.type === 'transcription' && parsedMessage.data) {
        const segment: TranscriptionSegment = {
          ...parsedMessage.data,
          timestamp: new Date(parsedMessage.data.timestamp)
        };

        console.log('📝 [LiveKit] Nova transcrição recebida:', segment);

        // Evitar duplicatas baseado no ID
        setTranscriptions(prev => {
          const exists = prev.some(t => t.id === segment.id);
          if (exists) return prev;
          return [...prev, segment];
        });

        setIsConnected(true);
        setError(null);
      }

    } catch (error) {
      console.error('📝 [LiveKit] Erro ao processar mensagem:', error);
      setError('Erro ao processar transcrição recebida');
    }
  }, [enabled]);

  // Usar hook nativo LiveKit para data channels com callback
  const { send } = useDataChannel('transcription', onDataReceived);

  // Função para enviar áudio para o backend (simulação)
  const sendAudioToBackend = useCallback((audioData: ArrayBuffer) => {
    if (!socket?.connected) return;

    try {
      // Converter para base64
      const base64Audio = Buffer.from(audioData).toString('base64');
      
      // Enviar para o backend
      socket.emit('online:audio-data', {
        roomName,
        participantId,
        audioData: base64Audio,
        sampleRate: 16000,
        channels: 1
      });
      
      console.log('🎤 Áudio enviado para o backend');
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
    }
  }, [socket, roomName, participantId]);

  // Funções de controle
  const startTranscription = useCallback(() => {
    console.log('📝 [LiveKit] startTranscription chamado');
    if (socket?.connected) {
      socket.emit('online:start-transcription', {
        roomName,
        consultationId,
        participantId,
        participantName: participantId
      });
    }
  }, [socket, roomName, consultationId, participantId]);

  const stopTranscription = useCallback(() => {
    console.log('📝 [LiveKit] stopTranscription chamado');
    if (socket?.connected) {
      socket.emit('online:stop-transcription', { roomName, consultationId });
    }
  }, [socket, roomName, consultationId]);

  const clearTranscriptions = useCallback(() => {
    console.log('📝 [LiveKit] clearTranscriptions chamado');
    setTranscriptions([]);
    if (socket?.connected) {
      socket.emit('online:clear-transcriptions', { roomName, consultationId });
    }
  }, [socket, roomName, consultationId]);

  return {
    transcriptions,
    isConnected,
    error,
    startTranscription,
    stopTranscription,
    clearTranscriptions,
    sendAudioToBackend
  };
}