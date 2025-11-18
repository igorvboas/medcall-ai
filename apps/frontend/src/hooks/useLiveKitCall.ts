'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, LocalVideoTrack, LocalAudioTrack, Track, AudioTrack, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { createLiveKitRoom, VideoPresets } from '@/lib/livekit';

interface UseLiveKitCallProps {
  token: string;
  serverUrl: string;
  roomName: string;
  onAudioData?: (audioData: Float32Array, timestamp: number) => void;
  onError?: (error: string) => void;
}

interface UseLiveKitCallReturn {
  room: Room | null;
  isConnected: boolean;
  participants: RemoteParticipant[];
  localVideoTrack: LocalVideoTrack | null;
  localAudioTrack: LocalAudioTrack | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  toggleVideo: () => void;
  toggleAudio: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useLiveKitCall({
  token,
  serverUrl,
  roomName,
  onAudioData,
  onError
}: UseLiveKitCallProps): UseLiveKitCallReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const roomRef = useRef<Room | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Conectar ao LiveKit
  const connect = useCallback(async () => {
    try {
      console.log('🔗 Conectando ao LiveKit...', { serverUrl, roomName });
      
      // Criar nova instância do Room
      const newRoom = createLiveKitRoom();

      roomRef.current = newRoom;
      setRoom(newRoom);

      // Configurar event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log('✅ Conectado ao LiveKit');
        setIsConnected(true);
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('❌ Desconectado do LiveKit:', reason);
        setIsConnected(false);
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participante conectado:', participant.identity);
        setParticipants(prev => [...prev.filter(p => p.identity !== participant.identity), participant]);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('👋 Participante desconectado:', participant.identity);
        setParticipants(prev => prev.filter(p => p.identity !== participant.identity));
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('📺 Track inscrito:', track.kind, participant.identity);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log('📺 Track desinscrito:', track.kind, participant.identity);
      });

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('📤 Track publicado:', publication.kind, participant.identity);
      });

      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        console.log('📤 Track despublicado:', publication.kind, participant.identity);
      });

      // Conectar ao room
      await newRoom.connect(serverUrl, token);
      console.log('🚀 Conectado com sucesso ao LiveKit');

      // Habilitar câmera e microfone
      await enableCamera();
      await enableMicrophone();

    } catch (error) {
      console.error('❌ Erro ao conectar ao LiveKit:', error);
      onError?.(`Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [token, serverUrl, roomName, onError]);

  // Desconectar do LiveKit
  const disconnect = useCallback(async () => {
    try {
      if (roomRef.current) {
        console.log('🔌 Desconectando do LiveKit...');
        
        // Limpar processamento de áudio
        if (audioProcessorRef.current) {
          audioProcessorRef.current.disconnect();
          audioProcessorRef.current = null;
        }
        
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Desconectar do room
        await roomRef.current.disconnect();
        roomRef.current = null;
        setRoom(null);
        setIsConnected(false);
        setParticipants([]);
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
        
        console.log('✅ Desconectado do LiveKit');
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar do LiveKit:', error);
      onError?.(`Erro de desconexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [onError]);

  // Habilitar câmera
  const enableCamera = useCallback(async () => {
    try {
      if (!roomRef.current) return;
      
      const videoTrack = await createLocalVideoTrack({
        resolution: VideoPresets.h720,
        facingMode: 'user',
      });
      
      await roomRef.current.localParticipant.publishTrack(videoTrack);
      setLocalVideoTrack(videoTrack);
      setIsVideoEnabled(true);
      
      console.log('📹 Câmera habilitada');
    } catch (error) {
      console.error('❌ Erro ao habilitar câmera:', error);
      onError?.(`Erro ao habilitar câmera: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [onError]);

  // Habilitar microfone
  const enableMicrophone = useCallback(async () => {
    try {
      if (!roomRef.current) return;
      
      const audioTrack = await createLocalAudioTrack();
      await roomRef.current.localParticipant.publishTrack(audioTrack);
      setLocalAudioTrack(audioTrack);
      setIsAudioEnabled(true);
      
      // Configurar processamento de áudio para transcrição
      await setupAudioProcessing(audioTrack);
      
      console.log('🎤 Microfone habilitado');
    } catch (error) {
      console.error('❌ Erro ao habilitar microfone:', error);
      onError?.(`Erro ao habilitar microfone: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [onAudioData, onError]);

  // Configurar processamento de áudio
  const setupAudioProcessing = useCallback(async (audioTrack: LocalAudioTrack) => {
    try {
      if (!onAudioData) return;

      // Criar AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Criar MediaStreamSource
      const stream = new MediaStream([audioTrack.mediaStreamTrack]);
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Criar ScriptProcessorNode para capturar dados de áudio
      const bufferSize = 4096;
      const processor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Converter para Float32Array e enviar para callback
        const audioData = new Float32Array(inputData);
        onAudioData(audioData, Date.now());
      };

      // ✅ CORREÇÃO: Usar AnalyserNode como destino (não reproduz áudio)
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      
      // Conectar os nós (sem conectar ao destination para evitar interferência)
      source.connect(processor);
      processor.connect(analyser);

      audioProcessorRef.current = processor;
      
      console.log('🎵 Processamento de áudio configurado');
    } catch (error) {
      console.error('❌ Erro ao configurar processamento de áudio:', error);
    }
  }, [onAudioData]);

  // Alternar vídeo
  const toggleVideo = useCallback(async () => {
    try {
      if (!roomRef.current) return;

      if (isVideoEnabled) {
        // Desabilitar vídeo
        if (localVideoTrack) {
          await roomRef.current.localParticipant.unpublishTrack(localVideoTrack);
          localVideoTrack.stop();
          setLocalVideoTrack(null);
        }
        setIsVideoEnabled(false);
        console.log('📹 Vídeo desabilitado');
      } else {
        // Habilitar vídeo
        await enableCamera();
      }
    } catch (error) {
      console.error('❌ Erro ao alternar vídeo:', error);
      onError?.(`Erro ao alternar vídeo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [isVideoEnabled, localVideoTrack, enableCamera, onError]);

  // Alternar áudio
  const toggleAudio = useCallback(async () => {
    try {
      if (!roomRef.current) return;

      if (isAudioEnabled) {
        // Desabilitar áudio
        if (localAudioTrack) {
          await roomRef.current.localParticipant.unpublishTrack(localAudioTrack);
          localAudioTrack.stop();
          setLocalAudioTrack(null);
        }
        
        // Limpar processamento de áudio
        if (audioProcessorRef.current) {
          audioProcessorRef.current.disconnect();
          audioProcessorRef.current = null;
        }
        
        setIsAudioEnabled(false);
        console.log('🎤 Áudio desabilitado');
      } else {
        // Habilitar áudio
        await enableMicrophone();
      }
    } catch (error) {
      console.error('❌ Erro ao alternar áudio:', error);
      onError?.(`Erro ao alternar áudio: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }, [isAudioEnabled, localAudioTrack, enableMicrophone, onError]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    room,
    isConnected,
    participants,
    localVideoTrack,
    localAudioTrack,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    connect,
    disconnect
  };
}

