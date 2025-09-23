import { useEffect, useState, useCallback } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { Room, LocalAudioTrack, Track } from 'livekit-client';

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

  console.log('📝 Hook useTranscriptionLiveKit iniciado com:', {
    roomName,
    participantId,
    consultationId,
    enabled
  });

  // Obter participante local do LiveKit
  const localParticipant = useLocalParticipant();

  // Inicializar transcrição LiveKit nativa
  useEffect(() => {
    if (!enabled || !localParticipant.localParticipant) return;

    console.log('🎤 Inicializando transcrição LiveKit nativa...');
    
    // Verificar se há track de áudio local
    const audioTracks = Array.from(localParticipant.localParticipant.audioTrackPublications.values());
    const audioTrack = audioTracks.find(track => track.track);
    
    if (!audioTrack || !audioTrack.track) {
      console.log('⚠️ Nenhum track de áudio encontrado');
      return;
    }

    console.log('✅ Track de áudio encontrado, iniciando transcrição...');
    setIsConnected(true);
    setIsTranscribing(true);
    
    // Iniciar captura de áudio nativa do LiveKit
    startNativeLiveKitTranscription(audioTrack.track as LocalAudioTrack);
    
  }, [enabled, localParticipant.localParticipant]);

  // Capturar áudio nativo do LiveKit
  const startNativeLiveKitTranscription = (audioTrack: LocalAudioTrack) => {
    try {
      console.log('🎤 Iniciando captura de áudio nativa do LiveKit...');
      
      // Obter stream do track de áudio do LiveKit
      const stream = audioTrack.mediaStream;
      if (!stream) {
        console.error('❌ Stream de áudio não disponível');
        setError('Stream de áudio não disponível');
        return;
      }
      
      console.log('✅ Stream de áudio obtido do LiveKit');
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let audioChunkCount = 0;
      
      processor.onaudioprocess = (event) => {
        if (!isTranscribing) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Verificar se há áudio (não silêncio)
        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
        if (!hasAudio) return;
        
        audioChunkCount++;
        
        // Converter para Int16Array
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Enviar áudio via LiveKit Data Channel
        const audioData = Buffer.from(int16Data.buffer).toString('base64');
        sendAudioViaLiveKit(audioData);
        
        console.log(`🎤 Áudio enviado via LiveKit (chunk ${audioChunkCount})`);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log('✅ Captura de áudio LiveKit iniciada');
      
      // Limpar recursos quando parar
      const cleanup = () => {
        processor.disconnect();
        source.disconnect();
        audioContext.close();
      };
      
      // Armazenar função de cleanup
      (localParticipant.localParticipant as any).audioCleanup = cleanup;
      
    } catch (error) {
      console.error('❌ Erro ao iniciar captura de áudio LiveKit:', error);
      setError('Erro ao iniciar captura de áudio LiveKit');
    }
  };

  // Enviar áudio via LiveKit Data Channel
  const sendAudioViaLiveKit = (audioData: string) => {
    try {
      if (!localParticipant.localParticipant) return;
      
      const message = {
        type: 'audio-data',
        data: {
          participantId,
          audioData,
          sampleRate: 16000,
          channels: 1,
          timestamp: Date.now()
        }
      };
      
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      
      // Enviar via LiveKit Data Channel
      localParticipant.localParticipant.publishData(data, { reliable: true });
      
    } catch (error) {
      console.error('❌ Erro ao enviar áudio via LiveKit:', error);
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

  // Funções de controle LiveKit nativas
  const startTranscription = useCallback(() => {
    console.log('📝 [LiveKit] Iniciando transcrição nativa...');
    setIsTranscribing(true);
    setIsConnected(true);
  }, []);

  const stopTranscription = useCallback(() => {
    console.log('📝 [LiveKit] Parando transcrição nativa...');
    setIsTranscribing(false);
    setIsConnected(false);
    
    // Limpar recursos de áudio
    if ((localParticipant.localParticipant as any).audioCleanup) {
      (localParticipant.localParticipant as any).audioCleanup();
      (localParticipant.localParticipant as any).audioCleanup = null;
    }
  }, [localParticipant.localParticipant]);

  const clearTranscriptions = useCallback(() => {
    console.log('📝 [LiveKit] Limpando transcrições...');
    setTranscriptions([]);
  }, []);

  return {
    transcriptions,
    isConnected,
    error,
    isTranscribing,
    startTranscription,
    stopTranscription,
    clearTranscriptions
  };
}