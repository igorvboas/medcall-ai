'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  useLocalParticipant, 
  useRemoteParticipants,
  useTracks,
  useRoomContext 
} from '@livekit/components-react';
import { Track, DataPacket_Kind } from 'livekit-client';
import { Mic, MicOff, Brain, Download, Search, Filter } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import styles from './RealtimeTranscription.module.css';

interface TranscriptionEntry {
  id: string;
  speaker: 'doctor' | 'patient' | 'system';
  text: string;
  timestamp: Date;
  confidence: number;
  isFinal: boolean;
  language?: string;
}

interface RealtimeTranscriptionProps {
  sessionId: string;
  userRole?: 'doctor' | 'patient';
  onTranscriptionUpdate?: (transcriptions: TranscriptionEntry[]) => void;
}

function AudioProcessor({ 
  audioTrack, 
  onAudioData 
}: { 
  audioTrack: any;
  onAudioData: (audioData: Float32Array) => void;
}) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    if (!audioTrack || !audioTrack.mediaStreamTrack) return;

    const setupAudioProcessing = async () => {
      try {
        // Create audio context
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioContext = audioContextRef.current;

        // Create media stream source
        const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(mediaStream);

        // Create script processor for audio analysis
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const audioData = inputBuffer.getChannelData(0);
          
          // Convert to Float32Array and send for transcription
          onAudioData(new Float32Array(audioData));
        };

        // Connect nodes
        source.connect(processor);
        processor.connect(audioContext.destination);

        console.log('✅ Audio processing setup complete');
      } catch (error) {
        console.error('❌ Error setting up audio processing:', error);
      }
    };

    setupAudioProcessing();

    return () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioTrack, onAudioData]);

  return null;
}

function TranscriptionDisplay({ 
  transcriptions, 
  searchTerm,
  showOnlyFinal 
}: { 
  transcriptions: TranscriptionEntry[];
  searchTerm: string;
  showOnlyFinal: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const filteredTranscriptions = transcriptions.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.speaker.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !showOnlyFinal || entry.isFinal;
    
    return matchesSearch && matchesFilter;
  });

  const getSpeakerIcon = (speaker: string) => {
    switch (speaker) {
      case 'doctor': return '👨‍⚕️';
      case 'patient': return '👤';
      case 'system': return '🤖';
      default: return '💬';
    }
  };

  const getSpeakerLabel = (speaker: string) => {
    switch (speaker) {
      case 'doctor': return 'Médico';
      case 'patient': return 'Paciente';
      case 'system': return 'Sistema';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className={styles.transcriptionDisplay} ref={containerRef}>
      {filteredTranscriptions.length === 0 ? (
        <div className={styles.emptyState}>
          <Mic size={32} />
          <p>Aguardando transcrição...</p>
          <small>Fale para começar a transcrever automaticamente</small>
        </div>
      ) : (
        filteredTranscriptions.map((entry) => (
          <div 
            key={entry.id} 
            className={`${styles.transcriptionEntry} ${
              entry.isFinal ? styles.final : styles.partial
            } ${styles[entry.speaker]}`}
          >
            <div className={styles.entryHeader}>
              <div className={styles.speakerInfo}>
                <span className={styles.speakerIcon}>
                  {getSpeakerIcon(entry.speaker)}
                </span>
                <span className={styles.speakerLabel}>
                  {getSpeakerLabel(entry.speaker)}
                </span>
              </div>
              
              <div className={styles.entryMetadata}>
                <span className={styles.timestamp}>
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span className={`${styles.confidence} ${
                  entry.confidence > 0.8 ? styles.highConfidence :
                  entry.confidence > 0.6 ? styles.mediumConfidence : styles.lowConfidence
                }`}>
                  {Math.round(entry.confidence * 100)}%
                </span>
                {!entry.isFinal && (
                  <span className={styles.partialIndicator}>...</span>
                )}
              </div>
            </div>
            
            <div className={styles.entryText}>
              {entry.text}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function RealtimeTranscription({
  sessionId,
  userRole = 'doctor',
  onTranscriptionUpdate
}: RealtimeTranscriptionProps) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyFinal, setShowOnlyFinal] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Get local audio track for processing
  const localTracks = useTracks([
    { participant: localParticipant, source: Track.Source.Microphone }
  ], { onlySubscribed: false });

  const localAudioTrack = localTracks[0]?.track;

  // Setup WebSocket connection for transcription
  useEffect(() => {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
    const socket = io(gatewayUrl, {
      transports: ['websocket'],
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔗 Connected to transcription service');
      setSocketConnected(true);
      
      // Join transcription session
      socket.emit('session:join', {
        sessionId,
        userId: userRole === 'doctor' ? 'doctor-current' : 'patient-current',
        role: userRole
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from transcription service');
      setSocketConnected(false);
    });

    // Listen for transcription updates
    socket.on('transcription:update', (data: any) => {
      const newEntry: TranscriptionEntry = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        speaker: data.speaker || 'system',
        text: data.text || '',
        timestamp: new Date(data.timestamp || Date.now()),
        confidence: data.confidence || 0,
        isFinal: data.isFinal !== false,
        language: data.language || 'pt-BR'
      };

      setTranscriptions(prev => {
        // Update existing entry if it's a partial update
        const existingIndex = prev.findIndex(entry => 
          entry.id === newEntry.id || 
          (!newEntry.isFinal && entry.speaker === newEntry.speaker && !entry.isFinal)
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newEntry;
          return updated;
        } else {
          return [...prev, newEntry];
        }
      });
    });

    // Listen for suggestions from AI
    socket.on('suggestion:new', (suggestion: any) => {
      const suggestionEntry: TranscriptionEntry = {
        id: `suggestion-${suggestion.id}`,
        speaker: 'system',
        text: `💡 Sugestão: ${suggestion.text}`,
        timestamp: new Date(),
        confidence: suggestion.confidence || 0.8,
        isFinal: true
      };

      setTranscriptions(prev => [...prev, suggestionEntry]);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, userRole]);

  // Update parent component when transcriptions change
  useEffect(() => {
    onTranscriptionUpdate?.(transcriptions);
  }, [transcriptions, onTranscriptionUpdate]);

  // Handle audio data for transcription
  const handleAudioData = useCallback((audioData: Float32Array) => {
    if (!socketConnected || !isTranscribing || !socketRef.current) return;

    // Send audio data to transcription service
    const audioChannel = userRole === 'doctor' ? 'doctor' : 'patient';
    socketRef.current.emit(`online:audio:${audioChannel}`, {
      sessionId,
      audioData: Array.from(audioData),
      timestamp: Date.now(),
      sampleRate: 16000
    });
  }, [sessionId, userRole, socketConnected, isTranscribing]);

  // Send transcription via DataChannel to other participants
  const sendTranscriptionViaDataChannel = useCallback((entry: TranscriptionEntry) => {
    if (room && room.localParticipant) {
      const data = JSON.stringify({
        type: 'transcription',
        ...entry
      });

      room.localParticipant.publishData(
        new TextEncoder().encode(data),
        DataPacket_Kind.RELIABLE
      );
    }
  }, [room]);

  // Listen for transcriptions from other participants via DataChannel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'transcription') {
          const entry: TranscriptionEntry = {
            id: data.id,
            speaker: data.speaker,
            text: data.text,
            timestamp: new Date(data.timestamp),
            confidence: data.confidence,
            isFinal: data.isFinal,
            language: data.language
          };

          setTranscriptions(prev => [...prev, entry]);
        }
      } catch (error) {
        // Ignore non-JSON data
      }
    };

    room.on('dataReceived', handleDataReceived);

    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  const toggleTranscription = () => {
    setIsTranscribing(!isTranscribing);
  };

  const exportTranscription = () => {
    const transcriptText = transcriptions
      .filter(entry => entry.isFinal)
      .map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${entry.speaker}: ${entry.text}`)
      .join('\n');

    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${sessionId}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
  };

  return (
    <div className={styles.realtimeTranscription}>
      {/* Header */}
      <div className={styles.transcriptionHeader}>
        <div className={styles.headerTitle}>
          <h3>📝 Transcrição em Tempo Real</h3>
          <div className={styles.statusIndicators}>
            <span className={`${styles.statusDot} ${socketConnected ? styles.connected : styles.disconnected}`} />
            <span className={styles.statusText}>
              {socketConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className={styles.headerControls}>
          <button
            className={`${styles.controlButton} ${isTranscribing ? styles.active : ''}`}
            onClick={toggleTranscription}
            title={isTranscribing ? 'Pausar Transcrição' : 'Iniciar Transcrição'}
          >
            {isTranscribing ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            className={styles.controlButton}
            onClick={exportTranscription}
            title="Exportar Transcrição"
            disabled={transcriptions.length === 0}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className={styles.transcriptionFilters}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar na transcrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <label className={styles.filterOption}>
          <input
            type="checkbox"
            checked={showOnlyFinal}
            onChange={(e) => setShowOnlyFinal(e.target.checked)}
          />
          Apenas finais
        </label>
      </div>

      {/* Transcription Display */}
      <TranscriptionDisplay
        transcriptions={transcriptions}
        searchTerm={searchTerm}
        showOnlyFinal={showOnlyFinal}
      />

      {/* Audio Processor (hidden) */}
      {localAudioTrack && isTranscribing && (
        <AudioProcessor
          audioTrack={localAudioTrack}
          onAudioData={handleAudioData}
        />
      )}

      {/* Statistics */}
      <div className={styles.transcriptionStats}>
        <span>{transcriptions.filter(t => t.isFinal).length} finais</span>
        <span>{transcriptions.filter(t => !t.isFinal).length} parciais</span>
        <span>
          {Math.round(
            transcriptions.reduce((sum, t) => sum + t.confidence, 0) / 
            Math.max(transcriptions.length, 1) * 100
          )}% confiança média
        </span>
      </div>
    </div>
  );
}
