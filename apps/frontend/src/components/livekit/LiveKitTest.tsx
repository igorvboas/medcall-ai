'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';

import React, { useState } from 'react';
import { VideoConference, PreJoin, LocalUserChoices, RoomContext } from '@livekit/components-react';
import { Room, RoomOptions, VideoPresets } from 'livekit-client';

interface ConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantToken: string;
  participantName: string;
}

export function LiveKitTest() {
  const [preJoinChoices, setPreJoinChoices] = useState<LocalUserChoices | undefined>(undefined);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [room] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720,
    },
  }));

  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    
    // Generate a test room name
    const testRoomName = `test-room-${Date.now()}`;
    
    // Fetch connection details from our new API
    const url = new URL('/api/connection-details', window.location.origin);
    url.searchParams.append('roomName', testRoomName);
    url.searchParams.append('participantName', values.username);
    
    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const connectionDetailsData = await response.json();
      setConnectionDetails(connectionDetailsData);
      
      console.log('✅ Connection details obtained:', connectionDetailsData);
    } catch (error) {
      console.error('❌ Error fetching connection details:', error);
      showError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Erro de Conexão');
    }
  }, []);

  const handlePreJoinError = React.useCallback((error: any) => {
    console.error('❌ PreJoin error:', error);
    showError(`PreJoin error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Erro no PreJoin');
  }, []);

  React.useEffect(() => {
    if (connectionDetails && preJoinChoices) {
      console.log('🔗 Connecting to room:', connectionDetails.roomName);
      
      room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
        .then(() => {
          console.log('✅ Connected to LiveKit room');
          
          // Enable camera and microphone based on user choices
          if (preJoinChoices.videoEnabled) {
            room.localParticipant.setCameraEnabled(true);
          }
          if (preJoinChoices.audioEnabled) {
            room.localParticipant.setMicrophoneEnabled(true);
          }
        })
        .catch((error) => {
          console.error('❌ Failed to connect to room:', error);
          showError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Erro de Conexão');
        });
    }
  }, [connectionDetails, preJoinChoices, room]);

  return (
    <div style={{ height: '100vh' }} data-lk-theme="default">
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1>LiveKit Components Test</h1>
            <p>Testing connection with official LiveKit components</p>
          </div>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <RoomContext.Provider value={room}>
          <VideoConference />
        </RoomContext.Provider>
      )}
    </div>
  );
}
