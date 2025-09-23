import { useCallback, useEffect, useRef, useState } from 'react';

interface MicTransmitterConfig {
  sessionId: string;
  participantId: string;
  gatewayUrl?: string;
}

interface MicTransmitterState {
  isConnected: boolean;
  isTransmitting: boolean;
  isMuted: boolean;
  error: string | null;
}

export function useMicTransmitter() {
  const [state, setState] = useState<MicTransmitterState>({
    isConnected: false,
    isTransmitting: false,
    isMuted: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const configRef = useRef<MicTransmitterConfig | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 segundo

  const cleanup = useCallback(() => {
    // Fechar WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Parar worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Fechar AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Parar stream de áudio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Limpar timeout de reconexão
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isTransmitting: false,
    }));
  }, []);

  const connectWebSocket = useCallback(async (config: MicTransmitterConfig) => {
    const gatewayUrl = config.gatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:3001';
    const wsUrl = `${gatewayUrl.replace('http', 'ws')}/ws/transcribe?session=${config.sessionId}&participant=${config.participantId}`;

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[MicTransmitter] WebSocket connected');
        reconnectAttemptsRef.current = 0;
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error('[MicTransmitter] WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log('[MicTransmitter] WebSocket closed:', event.code, event.reason);
        setState(prev => ({ ...prev, isConnected: false }));

        // Auto-reconexão se não foi fechamento manual
        if (event.code !== 1000 && configRef.current) {
          attemptReconnect();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[MicTransmitter] Message from server:', data);
        } catch (e) {
          console.warn('[MicTransmitter] Non-JSON message received:', event.data);
        }
      };
    });
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setState(prev => ({ ...prev, error: 'Max reconnection attempts reached' }));
      return;
    }

    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;

    console.log(`[MicTransmitter] Attempting reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(async () => {
      if (configRef.current) {
        try {
          wsRef.current = await connectWebSocket(configRef.current);
        } catch (error) {
          console.error('[MicTransmitter] Reconnection failed:', error);
          attemptReconnect();
        }
      }
    }, delay);
  }, [connectWebSocket]);

  const setupAudioCapture = useCallback(async () => {
    try {
      // Solicitar acesso ao microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Criar AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Carregar AudioWorklet
      await audioContext.audioWorklet.addModule('/worklets/pcm16-worklet.js');

      // Criar nós de áudio
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor');

      workletNodeRef.current = workletNode;

      // Conectar pipeline de áudio
      source.connect(workletNode);

      // Escutar mensagens do worklet (chunks PCM)
      workletNode.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && !state.isMuted) {
          wsRef.current.send(event.data); // Enviar ArrayBuffer binário
        }
      };

      setState(prev => ({ ...prev, isTransmitting: true }));
      console.log('[MicTransmitter] Audio capture setup completed');

    } catch (error) {
      console.error('[MicTransmitter] Audio setup failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: `Audio setup failed: ${message}` }));
      throw error;
    }
  }, [state.isMuted]);

  const start = useCallback(async (config: MicTransmitterConfig) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      configRef.current = config;

      // Conectar WebSocket
      wsRef.current = await connectWebSocket(config);

      // Configurar captura de áudio
      await setupAudioCapture();

      console.log('[MicTransmitter] Started successfully');
    } catch (error) {
      console.error('[MicTransmitter] Start failed:', error);
      cleanup();
      throw error;
    }
  }, [connectWebSocket, setupAudioCapture, cleanup]);

  const stop = useCallback(() => {
    console.log('[MicTransmitter] Stopping...');
    configRef.current = null;
    cleanup();
  }, [cleanup]);

  const mute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: true }));
    console.log('[MicTransmitter] Muted');
  }, []);

  const unmute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: false }));
    console.log('[MicTransmitter] Unmuted');
  }, []);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    start,
    stop,
    mute,
    unmute,
  };
}
