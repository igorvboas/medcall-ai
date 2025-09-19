'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  LiveKitRoom, 
  PreJoin, 
  LocalUserChoices,
  RoomAudioRenderer,
  ConnectionState 
} from '@livekit/components-react';
import { 
  Room, 
  RoomOptions, 
  VideoPresets, 
  RoomConnectOptions,
  DeviceUnsupportedError,
  RoomEvent
} from 'livekit-client';

interface LiveKitRoomProviderProps {
  roomName: string;
  participantName: string;
  serverUrl?: string;
  token?: string;
  children: React.ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  // Configurações de qualidade
  hq?: boolean;
  adaptiveStream?: boolean;
  dynacast?: boolean;
  // Configurações de dispositivos
  videoCaptureDefaults?: {
    deviceId?: string;
    resolution?: typeof VideoPresets.h720;
  };
  audioCaptureDefaults?: {
    deviceId?: string;
  };
}

interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantToken: string;
  participantName: string;
}

export function LiveKitRoomProvider({
  roomName,
  participantName,
  serverUrl,
  token,
  children,
  onConnected,
  onDisconnected,
  onError,
  hq = false,
  adaptiveStream = true,
  dynacast = true,
  videoCaptureDefaults,
  audioCaptureDefaults,
}: LiveKitRoomProviderProps) {
  const [preJoinChoices, setPreJoinChoices] = useState<LocalUserChoices | undefined>(undefined);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Room options otimizadas
  const roomOptions = useMemo((): RoomOptions => {
    return {
      adaptiveStream,
      dynacast,
      videoCaptureDefaults: videoCaptureDefaults || {
        resolution: hq ? VideoPresets.h1080 : VideoPresets.h720,
      },
      audioCaptureDefaults: audioCaptureDefaults || {},
      publishDefaults: {
        dtx: false, // Disable discontinuous transmission for medical audio
        videoSimulcastLayers: hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
        red: true, // Enable redundancy encoding
      },
    };
  }, [hq, adaptiveStream, dynacast, videoCaptureDefaults, audioCaptureDefaults]);

  // Connection options
  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  // PreJoin defaults baseados nas props
  const preJoinDefaults = useMemo(() => {
    return {
      username: participantName,
      videoEnabled: true,
      audioEnabled: true,
      videoDeviceId: videoCaptureDefaults?.deviceId,
      audioDeviceId: audioCaptureDefaults?.deviceId,
    };
  }, [participantName, videoCaptureDefaults?.deviceId, audioCaptureDefaults?.deviceId]);

  // Handle PreJoin submission
  const handlePreJoinSubmit = useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    setConnectionState('connecting');
    setConnectionError(null);

    try {
      let connectionDetailsData: ConnectionDetails;

      if (serverUrl && token) {
        // Use provided server URL and token
        connectionDetailsData = {
          serverUrl,
          roomName,
          participantToken: token,
          participantName: values.username,
        };
      } else {
        // Fetch connection details from API
        const url = new URL('/api/connection-details', window.location.origin);
        url.searchParams.append('roomName', roomName);
        url.searchParams.append('participantName', values.username);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        connectionDetailsData = await response.json();
      }

      setConnectionDetails(connectionDetailsData);
      console.log('✅ Connection details obtained:', connectionDetailsData);

    } catch (error) {
      console.error('❌ Error obtaining connection details:', error);
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
      setConnectionState('error');
      onError?.(error instanceof Error ? error : new Error('Connection failed'));
    }
  }, [roomName, participantName, serverUrl, token, onError]);

  const handlePreJoinError = useCallback((error: any) => {
    console.error('❌ PreJoin error:', error);
    setConnectionError(error instanceof Error ? error.message : 'PreJoin failed');
    setConnectionState('error');
    onError?.(error instanceof Error ? error : new Error('PreJoin failed'));
  }, [onError]);

  // Handle room connection events
  const handleConnected = useCallback(() => {
    console.log('✅ Room connected');
    setConnectionState('connected');
    setConnectionError(null);
    onConnected?.();
  }, [onConnected]);

  const handleDisconnected = useCallback(() => {
    console.log('❌ Room disconnected');
    setConnectionState('disconnected');
    onDisconnected?.();
  }, [onDisconnected]);

  const handleConnectionError = useCallback((error: Error) => {
    console.error('❌ Room connection error:', error);
    setConnectionState('error');
    
    if (error instanceof DeviceUnsupportedError) {
      setConnectionError('Device not supported. Please check your camera and microphone.');
    } else {
      setConnectionError(error.message);
    }
    
    onError?.(error);
  }, [onError]);

  // Retry connection
  const handleRetry = useCallback(() => {
    setConnectionState('disconnected');
    setConnectionError(null);
    setConnectionDetails(undefined);
    setPreJoinChoices(undefined);
  }, []);

  // Render error state
  if (connectionState === 'error') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{ color: 'red', marginBottom: '1rem' }}>Connection Error</h2>
        <p style={{ marginBottom: '2rem', maxWidth: '500px' }}>
          {connectionError || 'An unexpected error occurred while connecting to the room.'}
        </p>
        <button 
          onClick={handleRetry}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render PreJoin if not connected yet
  if (!connectionDetails || !preJoinChoices) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <PreJoin
          defaults={preJoinDefaults}
          onSubmit={handlePreJoinSubmit}
          onError={handlePreJoinError}
          joinLabel={connectionState === 'connecting' ? 'Connecting...' : 'Join Room'}
          micLabel="Microphone"
          camLabel="Camera"
        />
      </div>
    );
  }

  // Render connected room
  return (
    <LiveKitRoom
      video={preJoinChoices.videoEnabled}
      audio={preJoinChoices.audioEnabled}
      token={connectionDetails.participantToken}
      serverUrl={connectionDetails.serverUrl}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      room={roomOptions}
      connect={connectOptions}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleConnectionError}
    >
      <RoomAudioRenderer />
      {children}
    </LiveKitRoom>
  );
}
