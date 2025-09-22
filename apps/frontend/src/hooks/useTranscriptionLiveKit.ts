import { useEffect, useState, useCallback } from 'react';
import { useDataChannel } from '@livekit/components-react';

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

  console.log('📝 Hook useTranscriptionLiveKit iniciado com:', {
    roomName,
    participantId,
    consultationId,
    enabled
  });

  // Callback para processar mensagens recebidas
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

  // Simular conexão ativa quando LiveKit está disponível
  useEffect(() => {
    if (enabled) {
      setIsConnected(true);
      setError(null);
      console.log('📝 [LiveKit] Transcrição ativada via data channels');
    } else {
      setIsConnected(false);
    }
  }, [enabled]);

  // Funções de controle (mantidas para compatibilidade)
  const startTranscription = useCallback(() => {
    console.log('📝 [LiveKit] startTranscription chamado (nativo LiveKit)');
    setIsConnected(true);
    setError(null);
  }, []);

  const stopTranscription = useCallback(() => {
    console.log('📝 [LiveKit] stopTranscription chamado (nativo LiveKit)');
    setIsConnected(false);
  }, []);

  const clearTranscriptions = useCallback(() => {
    console.log('📝 [LiveKit] clearTranscriptions chamado');
    setTranscriptions([]);
  }, []);

  return {
    transcriptions,
    isConnected,
    error,
    startTranscription,
    stopTranscription,
    clearTranscriptions
  };
}