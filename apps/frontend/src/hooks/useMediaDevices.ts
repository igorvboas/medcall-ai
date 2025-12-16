'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

export interface DevicePreviewState {
  videoStream: MediaStream | null;
  audioLevel: number;
  isPreviewActive: boolean;
}

interface UseMediaDevicesReturn {
  // Dispositivos disponíveis
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  
  // Dispositivos selecionados
  selectedCamera: string | null;
  selectedMicrophone: string | null;
  
  // Preview
  previewState: DevicePreviewState;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  
  // Funções
  loadDevices: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  startPreview: () => Promise<void>;
  stopPreview: () => void;
  getSelectedDevices: () => { cameraId: string | null; microphoneId: string | null };
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<DevicePreviewState>({
    videoStream: null,
    audioLevel: 0,
    isPreviewActive: false
  });
  
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Carregar dispositivos disponíveis
  const loadDevices = useCallback(async () => {
    try {
      // Solicitar permissões primeiro
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Câmera ${device.deviceId.slice(0, 8)}`,
          kind: 'videoinput' as const
        }));
        
      const audioDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${device.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const
        }));
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
      // Selecionar primeiro dispositivo por padrão
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioDevices[0].deviceId);
      }
      
      console.log('📱 Dispositivos carregados:', { 
        cameras: videoDevices.length, 
        microphones: audioDevices.length 
      });
      
    } catch (error) {
      console.error('❌ Erro ao carregar dispositivos:', error);
      throw error;
    }
  }, [selectedCamera, selectedMicrophone]);

  // Selecionar câmera
  const selectCamera = useCallback(async (deviceId: string) => {
    setSelectedCamera(deviceId);
    
    // Se preview está ativo, atualizar stream
    if (previewState.isPreviewActive) {
      await startPreview();
    }
  }, [previewState.isPreviewActive]);

  // Selecionar microfone
  const selectMicrophone = useCallback(async (deviceId: string) => {
    setSelectedMicrophone(deviceId);
    
    // Se preview está ativo, atualizar stream
    if (previewState.isPreviewActive) {
      await startPreview();
    }
  }, [previewState.isPreviewActive]);

  // Iniciar preview
  const startPreview = useCallback(async () => {
    try {
      // Parar preview anterior
      stopPreview();
      
      if (!selectedCamera || !selectedMicrophone) {
        throw new Error('Dispositivos não selecionados');
      }

      // Criar novo stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: selectedCamera },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: { 
          deviceId: { exact: selectedMicrophone },
          echoCancellation: false,
          noiseSuppression: false
        }
      });

      // Configurar vídeo
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      // Configurar análise de áudio
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Atualizar estado
      setPreviewState({
        videoStream: stream,
        audioLevel: 0,
        isPreviewActive: true
      });

      // Iniciar monitoramento de áudio
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const level = Math.min(100, (average / 128) * 100);
          
          setPreviewState(prev => ({ ...prev, audioLevel: level }));
        }
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
      
      console.log('🎥 Preview iniciado');
      
    } catch (error) {
      console.error('❌ Erro ao iniciar preview:', error);
      throw error;
    }
  }, [selectedCamera, selectedMicrophone]);

  // Parar preview
  const stopPreview = useCallback(() => {
    // Parar stream
    if (previewState.videoStream) {
      previewState.videoStream.getTracks().forEach(track => track.stop());
    }
    
    // Limpar contexto de áudio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Parar animação
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Limpar vídeo
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    
    setPreviewState({
      videoStream: null,
      audioLevel: 0,
      isPreviewActive: false
    });
    
    console.log('🛑 Preview parado');
  }, [previewState.videoStream]);

  // Obter dispositivos selecionados
  const getSelectedDevices = useCallback(() => ({
    cameraId: selectedCamera,
    microphoneId: selectedMicrophone
  }), [selectedCamera, selectedMicrophone]);

  // Carregar dispositivos no mount
  useEffect(() => {
    loadDevices().catch(console.error);
  }, [loadDevices]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  return {
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    previewState,
    previewVideoRef,
    loadDevices,
    selectCamera,
    selectMicrophone,
    startPreview,
    stopPreview,
    getSelectedDevices
  };
}
