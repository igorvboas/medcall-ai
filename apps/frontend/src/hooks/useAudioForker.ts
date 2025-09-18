import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioForkerState {
  isRecording: boolean;
  doctorMicLevel: number;
  patientMicLevel: number;
  error: string | null;
  isSupported: boolean;
}

interface AudioStreamInfo {
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  processor: AudioWorkletNode | null;
  source: MediaStreamAudioSourceNode | null;
}

interface UseAudioForkerProps {
  doctorMicId: string;
  patientMicId: string;
  onAudioData?: (data: {
    channel: 'doctor' | 'patient';
    audioData: Float32Array;
    timestamp: number;
    sampleRate: number;
  }) => void;
  onError?: (error: string) => void;
}

export function useAudioForker({
  doctorMicId,
  patientMicId,
  onAudioData,
  onError
}: UseAudioForkerProps) {
  const [state, setState] = useState<AudioForkerState>({
    isRecording: false,
    doctorMicLevel: 0,
    patientMicLevel: 0,
    error: null,
    isSupported: false
  });

  // Refs para streams de áudio
  const doctorStreamRef = useRef<AudioStreamInfo>({
    stream: null,
    audioContext: null,
    analyser: null,
    processor: null,
    source: null
  });

  const patientStreamRef = useRef<AudioStreamInfo>({
    stream: null,
    audioContext: null,
    analyser: null,
    processor: null,
    source: null
  });

  const animationFrameRef = useRef<number>();

  // Verificar suporte do browser
  useEffect(() => {
    const checkSupport = () => {
      const hasGetUserMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const hasAudioContext = Boolean(window.AudioContext || (window as any).webkitAudioContext);
      
      setState(prev => ({
        ...prev,
        isSupported: Boolean(hasGetUserMedia && hasAudioContext)
      }));

      if (!hasGetUserMedia || !hasAudioContext) {
        const error = 'Browser não suporta captura de áudio avançada';
        setState(prev => ({ ...prev, error }));
        onError?.(error);
      }
    };

    checkSupport();
  }, [onError]);

  // Função para criar stream de áudio
  const createAudioStream = useCallback(async (
    deviceId: string,
    channel: 'doctor' | 'patient'
  ): Promise<AudioStreamInfo> => {
    try {
      // Solicitar stream do microfone específico
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // Criar contexto de áudio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });
      
      // Garantir que o contexto está rodando
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      try {
        // Verificar se AudioWorklet está disponível
        if (!audioContext.audioWorklet) {
          throw new Error('AudioWorklet não suportado neste navegador');
        }

        // Tentar carregar o AudioWorklet (abordagem moderna)
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        
        // Criar nós de processamento
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        const processor = new AudioWorkletNode(audioContext, 'audio-processor');

        // Configurar analyser para medição de volume
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // Conectar nós
        source.connect(analyser);
        source.connect(processor);
        processor.connect(audioContext.destination);

        // Configurar processamento de áudio via MessagePort
        processor.port.onmessage = (event) => {
          const { type, audioData, timestamp, sampleRate, rms } = event.data;
          
          if (type === 'audiodata' && onAudioData) {
            // Debug: verificar se há áudio real
            if (rms > 0.01) {
              console.log(`🎤 Frontend capturou áudio real: ${channel} - RMS: ${rms.toFixed(4)}`);
            }
            
            onAudioData({
              channel,
              audioData: new Float32Array(audioData),
              timestamp: Date.now(), // Usar timestamp do navegador para consistência
              sampleRate: sampleRate
            });
          }
        };

        console.log(`✅ AudioWorklet carregado com sucesso para ${channel}`);
        return {
          stream,
          audioContext,
          analyser,
          processor,
          source
        };

      } catch (workletError) {
        console.warn('AudioWorklet não disponível, usando ScriptProcessor como fallback:', workletError);
        
        // Fallback para ScriptProcessor se AudioWorklet não estiver disponível
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        const processor = audioContext.createScriptProcessor(4096, 1, 1) as any; // Cast para compatibilidade

        // Configurar analyser para medição de volume
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // Conectar nós
        source.connect(analyser);
        source.connect(processor);
        processor.connect(audioContext.destination);

        // Configurar processamento de áudio (fallback)
        processor.onaudioprocess = (event: any) => {
          const inputBuffer = event.inputBuffer;
          const audioData = inputBuffer.getChannelData(0);
          
          // Calcular RMS para verificar se há áudio real
          let sum = 0;
          for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
          }
          const rms = Math.sqrt(sum / audioData.length);
          
          // Só enviar se houver áudio significativo
          if (rms > 0.001) {
            // Enviar dados para callback
            if (onAudioData) {
              onAudioData({
                channel,
                audioData: new Float32Array(audioData),
                timestamp: Date.now(),
                sampleRate: audioContext.sampleRate
              });
            }
          }
        };

        console.log(`✅ ScriptProcessor fallback ativado para ${channel}`);
        return {
          stream,
          audioContext,
          analyser,
          processor,
          source
        };
      }
    } catch (error) {
      console.error(`Erro ao criar stream ${channel}:`, error);
      throw error;
    }
  }, [onAudioData]);

  // Função para calcular nível de volume
  const calculateVolumeLevel = useCallback((analyser: AnalyserNode): number => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / bufferLength;
    return Math.min(average / 128, 1); // Normalizar para 0-1
  }, []);

  // Função para atualizar níveis de volume
  const updateVolumeLevels = useCallback(() => {
    const doctorAnalyser = doctorStreamRef.current.analyser;
    const patientAnalyser = patientStreamRef.current.analyser;

    if (doctorAnalyser && patientAnalyser) {
      const doctorLevel = calculateVolumeLevel(doctorAnalyser);
      const patientLevel = calculateVolumeLevel(patientAnalyser);

      setState(prev => ({
        ...prev,
        doctorMicLevel: doctorLevel,
        patientMicLevel: patientLevel
      }));
    }

    if (state.isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateVolumeLevels);
    }
  }, [state.isRecording, calculateVolumeLevel]);

  // Função para parar stream
  const stopAudioStream = useCallback((streamInfo: AudioStreamInfo) => {
    if (streamInfo.processor) {
      streamInfo.processor.disconnect();
      
      // Limpar handlers específicos do tipo de processador
      if ('port' in streamInfo.processor && streamInfo.processor.port) {
        // AudioWorkletNode
        streamInfo.processor.port.onmessage = null;
      } else if ('onaudioprocess' in streamInfo.processor) {
        // ScriptProcessorNode (fallback)
        (streamInfo.processor as any).onaudioprocess = null;
      }
    }
    
    if (streamInfo.source) {
      streamInfo.source.disconnect();
    }
    
    if (streamInfo.analyser) {
      streamInfo.analyser.disconnect();
    }
    
    if (streamInfo.audioContext) {
      streamInfo.audioContext.close();
    }
    
    if (streamInfo.stream) {
      streamInfo.stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  // Função para iniciar gravação
  const startRecording = useCallback(async () => {
    if (!state.isSupported) {
      const error = 'Funcionalidade não suportada pelo browser';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    if (!doctorMicId || !patientMicId) {
      const error = 'Selecione os microfones do médico e paciente';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    try {
      setState(prev => ({ ...prev, isRecording: true, error: null }));

      // Criar streams para ambos os microfones
      const [doctorStream, patientStream] = await Promise.all([
        createAudioStream(doctorMicId, 'doctor'),
        createAudioStream(patientMicId, 'patient')
      ]);

      doctorStreamRef.current = doctorStream;
      patientStreamRef.current = patientStream;

      // Iniciar monitoramento de volume
      updateVolumeLevels();

      console.log('✅ Gravação iniciada com sucesso');
    } catch (error) {
      const errorMessage = `Erro ao iniciar gravação: ${error}`;
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        error: errorMessage 
      }));
      onError?.(errorMessage);
    }
  }, [
    state.isSupported,
    doctorMicId,
    patientMicId,
    createAudioStream,
    updateVolumeLevels,
    onError
  ]);

  // Função para parar gravação
  const stopRecording = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isRecording: false,
      doctorMicLevel: 0,
      patientMicLevel: 0
    }));

    // Parar animação
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Parar streams
    stopAudioStream(doctorStreamRef.current);
    stopAudioStream(patientStreamRef.current);

    // Limpar refs
    doctorStreamRef.current = {
      stream: null,
      audioContext: null,
      analyser: null,
      processor: null,
      source: null
    };
    
    patientStreamRef.current = {
      stream: null,
      audioContext: null,
      analyser: null,
      processor: null,
      source: null
    };

    console.log('⏹️ Gravação interrompida');
  }, [stopAudioStream]);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording
  };
}
