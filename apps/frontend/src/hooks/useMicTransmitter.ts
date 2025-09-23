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

  // Referências fortes para evitar GC
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const configRef = useRef<MicTransmitterConfig | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const buffersSentRef = useRef(0);
  const lastPingRef = useRef(0);

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 segundo
  const pingInterval = 20000; // 20 segundos - keepalive para frontend

  const cleanup = useCallback(() => {
    console.log('[MicTransmitter] 🧹 Starting cleanup...');

    // Fechar WebSocket
    if (wsRef.current) {
      console.log('[MicTransmitter] 🔌 Closing WebSocket');
      wsRef.current.close();
      wsRef.current = null;
    }

    // Desconectar audio graph corretamente
    if (sourceNodeRef.current) {
      console.log('[MicTransmitter] 🎵 Disconnecting source node');
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (workletNodeRef.current) {
      console.log('[MicTransmitter] 🔧 Disconnecting worklet node');
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Fechar AudioContext (suspend primeiro para evitar clicks)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('[MicTransmitter] 🎧 Closing AudioContext, current state:', audioContextRef.current.state);
      if (audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend().then(() => {
          audioContextRef.current?.close();
        });
      } else {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }

    // Parar stream de áudio
    if (streamRef.current) {
      console.log('[MicTransmitter] 🎙️ Stopping media stream tracks');
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[MicTransmitter] 🛑 Stopped track:', track.kind, track.label);
      });
      streamRef.current = null;
    }

    // Limpar timeout de reconexão
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset counters
    buffersSentRef.current = 0;
    lastPingRef.current = 0;

    setState(prev => ({
      ...prev,
      isConnected: false,
      isTransmitting: false,
    }));

    console.log('[MicTransmitter] ✅ Cleanup completed');
  }, []);

  const connectWebSocket = useCallback(async (config: MicTransmitterConfig) => {
    const gatewayUrl = config.gatewayUrl || process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:3001';
    const wsUrl = `${gatewayUrl.replace('http', 'ws')}/ws/transcribe?session=${config.sessionId}&participant=${config.participantId}`;

    console.log('[MicTransmitter] 🔗 Connecting WebSocket:', {
      gatewayUrl,
      wsUrl,
      sessionId: config.sessionId,
      participantId: config.participantId
    });

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[MicTransmitter] ✅ WebSocket connected successfully');
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
      console.log('[MicTransmitter] 🎤 Setting up audio capture...');

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
      console.log('[MicTransmitter] ✅ Media stream obtained:', {
        tracks: stream.getTracks().length,
        audio: stream.getAudioTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState 
        }))
      });

      // Criar AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Verificar e ativar AudioContext se necessário
      if (audioContext.state === 'suspended') {
        console.log('[MicTransmitter] ⏳ AudioContext suspended, resuming...');
        await audioContext.resume();
      }

      console.log('[MicTransmitter] 🎧 AudioContext state:', audioContext.state, 'sampleRate:', audioContext.sampleRate);

      // Carregar AudioWorklet
      console.log('[MicTransmitter] 📥 Loading AudioWorklet module...');
      try {
        await audioContext.audioWorklet.addModule('/worklets/pcm16-worklet.js');
        console.log('[MicTransmitter] ✅ AudioWorklet module loaded successfully');
      } catch (workletError) {
        console.error('[MicTransmitter] ❌ Failed to load AudioWorklet:', workletError);
        const message = workletError instanceof Error ? workletError.message : 'Unknown error';
        throw new Error(`AudioWorklet loading failed: ${message}`);
      }

      // Criar nós de áudio
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor');

      sourceNodeRef.current = source;
      workletNodeRef.current = workletNode;

      // Verificar conexão do audio graph
      console.log('[MicTransmitter] 🔗 Connecting audio graph: MediaStreamSource → WorkletNode');
      source.connect(workletNode);

      // Verificar se o worklet está conectado
      console.log('[MicTransmitter] 🔍 Worklet connected:', {
        numberOfInputs: workletNode.numberOfInputs,
        numberOfOutputs: workletNode.numberOfOutputs,
        channelCount: workletNode.channelCount,
      });

      // Escutar mensagens do worklet (chunks PCM)
      workletNode.port.onmessage = (event) => {
        buffersSentRef.current++;

        // Log detalhado dos primeiros buffers
        if (buffersSentRef.current <= 5) {
          console.log(`[MicTransmitter] 🎵 Worklet buffer #${buffersSentRef.current}:`, {
            size: event.data.byteLength,
            wsState: wsRef.current?.readyState,
            isMuted: state.isMuted,
            wsReady: wsRef.current?.readyState === WebSocket.OPEN
          });
        }

        if (wsRef.current?.readyState === WebSocket.OPEN && !state.isMuted) {
          try {
            wsRef.current.send(event.data); // Enviar ArrayBuffer binário
            
            // Log ocasional para debug
            if (buffersSentRef.current % 100 === 0) {
              console.log(`[MicTransmitter] 📊 Sent ${buffersSentRef.current} buffers, last size: ${event.data.byteLength} bytes`);
            }
          } catch (sendError) {
            console.error('[MicTransmitter] ❌ Failed to send buffer via WebSocket:', sendError);
          }
        } else {
          if (buffersSentRef.current <= 10) {
            console.warn(`[MicTransmitter] ⚠️ Skipping buffer #${buffersSentRef.current} - WS not ready or muted:`, {
              wsState: wsRef.current?.readyState,
              isMuted: state.isMuted
            });
          }
        }
      };

      // Verificar se worklet está produzindo dados
      setTimeout(() => {
        if (buffersSentRef.current === 0) {
          console.warn('[MicTransmitter] ⚠️ No audio buffers produced after 3 seconds - check microphone permissions/mute');
        }
      }, 3000);

      setState(prev => ({ ...prev, isTransmitting: true }));
      console.log('[MicTransmitter] ✅ Audio capture setup completed');

    } catch (error) {
      console.error('[MicTransmitter] ❌ Audio setup failed:', error);
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

      // TESTE SIMPLES: Enviar dados de teste primeiro
      console.log('[MicTransmitter] 🧪 Sending test data to keep WebSocket alive...');
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Criar buffer PCM16 de teste (silêncio)
        const testBuffer = new Int16Array(640).fill(0); // 640 samples = ~40ms de silêncio
        wsRef.current.send(testBuffer.buffer);
        console.log('[MicTransmitter] ✅ Test buffer sent:', testBuffer.buffer.byteLength, 'bytes');
      }

      // Configurar captura de áudio (se teste funcionar)
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
