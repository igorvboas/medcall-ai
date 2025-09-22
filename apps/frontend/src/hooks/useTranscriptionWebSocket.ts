import { useEffect, useRef, useState } from 'react';
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

interface UseTranscriptionWebSocketProps {
  roomName: string;
  participantId: string;
  consultationId: string;
  enabled?: boolean;
  gatewayUrl?: string;
}

export function useTranscriptionWebSocket({
  roomName,
  participantId,
  consultationId,
  enabled = true,
  gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'
}: UseTranscriptionWebSocketProps) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Conectar ao WebSocket
  useEffect(() => {
    if (!enabled || !roomName || !participantId) return;

    const socketUrl = gatewayUrl.replace('http', 'ws');
    socketRef.current = io(`${socketUrl}/transcription`, {
      transports: ['websocket'],
      autoConnect: true
    });

    const socket = socketRef.current;

    // Event listeners
    socket.on('connect', () => {
      console.log('Conectado ao serviço de transcrição');
      setIsConnected(true);
      setError(null);

      // Entrar na sala de transcrição
      socket.emit('join-transcription-room', {
        roomName,
        participantId,
        consultationId
      });
    });

    socket.on('disconnect', () => {
      console.log('Desconectado do serviço de transcrição');
      setIsConnected(false);
    });

    socket.on('transcription-joined', (data) => {
      console.log('Entrou na sala de transcrição:', data);
    });

    socket.on('transcription-segment', (data) => {
      const { segment } = data;
      setTranscriptions(prev => [...prev, segment]);
    });

    socket.on('error', (data) => {
      console.error('Erro na transcrição:', data);
      setError(data.message || 'Erro desconhecido');
    });

    return () => {
      if (socket.connected) {
        socket.emit('leave-transcription-room', { roomName });
        socket.disconnect();
      }
    };
  }, [enabled, roomName, participantId, consultationId, gatewayUrl]);

  // Configurar captura de áudio
  useEffect(() => {
    if (!enabled || !isConnected || !socketRef.current) return;

    const startAudioCapture = async () => {
      try {
        // Solicitar acesso ao microfone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        mediaStreamRef.current = stream;

        // Criar contexto de áudio
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);

        // Criar processador para capturar áudio
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processorRef.current.onaudioprocess = (event) => {
          if (!socketRef.current?.connected) return;

          const inputData = event.inputBuffer.getChannelData(0);
          
          // Converter float32 para int16
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }

          // Converter para base64 e enviar
          const audioData = Buffer.from(int16Data.buffer).toString('base64');
          
          socketRef.current.emit('audio-data', {
            roomName,
            participantId,
            audioData,
            sampleRate: 16000,
            channels: 1
          });
        };

        // Conectar os nós
        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

        console.log('Captura de áudio iniciada para transcrição');

      } catch (error) {
        console.error('Erro ao iniciar captura de áudio:', error);
        setError('Erro ao acessar microfone');
      }
    };

    startAudioCapture();

    return () => {
      // Limpar recursos de áudio
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [enabled, isConnected, roomName, participantId]);

  // Funções de controle
  const startTranscription = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('start-transcription', {
        roomName,
        consultationId
      });
    }
  };

  const stopTranscription = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop-transcription', {
        roomName
      });
    }
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
  };

  return {
    transcriptions,
    isConnected,
    error,
    startTranscription,
    stopTranscription,
    clearTranscriptions
  };
}