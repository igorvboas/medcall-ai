import { useEffect, useState, useCallback } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { Room, LocalAudioTrack, Track } from 'livekit-client';

// Logs removidos para evitar spam infinito

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
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Obter participante local do LiveKit
  const localParticipant = useLocalParticipant();

  // Inicializar transcrição LiveKit nativa
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    if (!localParticipant.localParticipant) {
      return;
    }

    // Garantir que o microfone está habilitado e publicado como Audio Track
    localParticipant.localParticipant.setMicrophoneEnabled(true);
    
    setIsConnected(true);
    setIsTranscribing(true);
    
  }, [enabled, localParticipant.localParticipant]);

  // Handler para receber transcrições via Data Channel (texto)
  const onTranscriptionReceived = useCallback((message: any) => {
    if (!enabled) return;
    
    try {
      // Log removido
      
      if (!message.payload) return;
      
      const decoder = new TextDecoder();
      const messageStr = decoder.decode(message.payload);
      const parsedMessage = JSON.parse(messageStr);
      
      // Log removido
      
      if (parsedMessage.type === 'transcription' && parsedMessage.data) {
        const segment: TranscriptionSegment = {
          ...parsedMessage.data,
          timestamp: new Date(parsedMessage.data.timestamp)
        };
        
        // Log removido
        
        setTranscriptions(prev => {
          // Evitar duplicatas
          const exists = prev.some(t => t.id === segment.id);
          if (exists) return prev;
          return [...prev, segment];
        });
        
        setIsConnected(true);
        setError(null);
      }
    } catch (error) {
      console.error('❌ Erro ao processar transcrição:', error);
      setError(`Erro na transcrição: ${error}`);
    }
  }, [enabled]);

  // Escutar Data Channel para transcrições
  const { send } = useDataChannel('lk.transcription', onTranscriptionReceived);

  const startTranscription = useCallback(() => {
    // Log removido
    setIsTranscribing(true);
    setIsConnected(true);
    
    // Garantir que o microfone está habilitado
    if (localParticipant.localParticipant) {
      localParticipant.localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant.localParticipant]);

  const stopTranscription = useCallback(() => {
    // Log removido
    setIsTranscribing(false);
    setIsConnected(false);
  }, []);

  const clearTranscriptions = useCallback(() => {
    // Log removido
    setTranscriptions([]);
  }, []);

  return {
    transcriptions,
    isConnected,
    error,
    isTranscribing,
    startTranscription,
    stopTranscription,
    clearTranscriptions,
  };
}