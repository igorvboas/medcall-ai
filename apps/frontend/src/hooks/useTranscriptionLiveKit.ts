import { useEffect, useState, useCallback } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { Room, LocalAudioTrack, Track } from 'livekit-client';

console.log('[uTLK] >> 🚀🚀🚀 HOOK useTranscriptionLiveKit ARQUIVO CARREGADO!');

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
  console.log('[uTLK] >> 🚀🚀🚀 HOOK useTranscriptionLiveKit EXECUTADO!');
  
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  console.log('[uTLK] >> 📝 Hook useTranscriptionLiveKit iniciado com:', {
    roomName,
    participantId,
    consultationId,
    enabled
  });

  // Obter participante local do LiveKit
  const localParticipant = useLocalParticipant();

  // Debug: verificar estado do participante local
  console.log('[uTLK] >> 🔍 Debug - localParticipant:', localParticipant);
  console.log('[uTLK] >> 🔍 Debug - localParticipant.localParticipant:', localParticipant.localParticipant);

  // Inicializar transcrição LiveKit nativa
  useEffect(() => {
    console.log('[uTLK] >> 🔍 useEffect executado - enabled:', enabled, 'localParticipant:', !!localParticipant.localParticipant);
    
    if (!enabled) {
      console.log('[uTLK] >> ⚠️ Transcrição desabilitada');
      return;
    }
    
    if (!localParticipant.localParticipant) {
      console.log('[uTLK] >> ⚠️ Participante local não disponível');
      return;
    }

    console.log('[uTLK] >> 🎤 Inicializando transcrição LiveKit nativa...');
    
    // Garantir que o microfone está habilitado e publicado como Audio Track
    localParticipant.localParticipant.setMicrophoneEnabled(true);
    
    console.log('[uTLK] >> ✅ Microfone habilitado e publicado como Audio Track');
    setIsConnected(true);
    setIsTranscribing(true);
    
  }, [enabled, localParticipant.localParticipant]);

  // Handler para receber transcrições via Data Channel (texto)
  const onTranscriptionReceived = useCallback((message: any) => {
    if (!enabled) return;
    
    try {
      console.log('[uTLK] >> 📝 [LiveKit] Data channel message received:', message);
      
      if (!message.payload) return;
      
      const decoder = new TextDecoder();
      const messageStr = decoder.decode(message.payload);
      const parsedMessage = JSON.parse(messageStr);
      
      console.log('[uTLK] >> 📝 [LiveKit] Mensagem decodificada:', parsedMessage);
      
      if (parsedMessage.type === 'transcription' && parsedMessage.data) {
        const segment: TranscriptionSegment = {
          ...parsedMessage.data,
          timestamp: new Date(parsedMessage.data.timestamp)
        };
        
        console.log('[uTLK] >> 📝 [LiveKit] Nova transcrição recebida:', segment);
        
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
    console.log('[uTLK] >> 📝 [LiveKit] Iniciando transcrição nativa...');
    setIsTranscribing(true);
    setIsConnected(true);
    
    // Garantir que o microfone está habilitado
    if (localParticipant.localParticipant) {
      localParticipant.localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant.localParticipant]);

  const stopTranscription = useCallback(() => {
    console.log('[uTLK] >> 📝 [LiveKit] Parando transcrição nativa...');
    setIsTranscribing(false);
    setIsConnected(false);
  }, []);

  const clearTranscriptions = useCallback(() => {
    console.log('[uTLK] >> 📝 [LiveKit] Limpando transcrições...');
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