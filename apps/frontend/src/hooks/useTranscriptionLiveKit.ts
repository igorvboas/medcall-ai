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
    clearTranscriptions
  };
}