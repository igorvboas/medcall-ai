'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceActivityDetector } from '@/lib/audioUtils';

/** Silence threshold before triggering alert (ms) */
export const SILENCE_THRESHOLD_MS = 30000;

/** Interval between silence checks (ms) */
export const SILENCE_CHECK_INTERVAL_MS = 1000;

export interface MicMonitorResult {
  isMicConnected: boolean;
  isSilent: boolean;
  silenceDurationMs: number;
}

/**
 * Hook to monitor microphone connectivity and silence.
 *
 * Three detection mechanisms:
 * 1. track.onended — fires when mic is physically disconnected or OS revokes access
 * 2. navigator.mediaDevices devicechange — fallback that checks if active device is still present
 * 3. Silence detection via VoiceActivityDetector — alerts after 30s of silence
 *
 * Does NOT stop recording automatically (per D-04).
 */
export function useMicMonitor(
  stream: MediaStream | null,
  isRecording: boolean
): MicMonitorResult {
  const [isMicConnected, setIsMicConnected] = useState(true);
  const [silenceDurationMs, setSilenceDurationMs] = useState(0);

  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);

  // 1. track.onended detection (D-01)
  useEffect(() => {
    if (!stream) {
      return;
    }

    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      return;
    }

    const activeTrack = tracks[0];
    activeTrackRef.current = activeTrack;

    // Check if track is already ended
    if (activeTrack.readyState === 'ended') {
      setIsMicConnected(false);
      return;
    }

    setIsMicConnected(true);

    const handleTrackEnded = () => {
      setIsMicConnected(false);
    };

    activeTrack.addEventListener('ended', handleTrackEnded);

    return () => {
      activeTrack.removeEventListener('ended', handleTrackEnded);
    };
  }, [stream]);

  // 2. devicechange fallback (D-02)
  useEffect(() => {
    if (!stream) {
      return;
    }

    const handleDeviceChange = async () => {
      const activeTrack = activeTrackRef.current;
      if (!activeTrack) return;

      const settings = activeTrack.getSettings();
      const activeDeviceId = settings.deviceId;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        const stillPresent = audioInputs.some((d) => d.deviceId === activeDeviceId);

        if (!stillPresent) {
          setIsMicConnected(false);
        } else if (activeTrack.readyState === 'live') {
          // Auto-recovery: mic reconnected (D-03 banner auto-dismiss)
          setIsMicConnected(true);
        }
      } catch (err) {
        console.error('[useMicMonitor] Error enumerating devices:', err);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [stream]);

  // 3. Silence detection (D-06, D-08, D-09)
  useEffect(() => {
    if (!stream || !isRecording) {
      // Reset silence state when not recording
      silenceStartRef.current = null;
      setSilenceDurationMs(0);
      // Destroy any existing VAD
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
      return;
    }

    // Create a new VoiceActivityDetector instance for silence monitoring
    vadRef.current = new VoiceActivityDetector(stream);

    const intervalId = setInterval(() => {
      if (!vadRef.current) return;

      const speaking = vadRef.current.isSpeaking();

      if (speaking) {
        // Voice detected — reset silence counter
        silenceStartRef.current = null;
        setSilenceDurationMs(0);
      } else {
        // Silence — start or continue tracking
        if (silenceStartRef.current === null) {
          silenceStartRef.current = Date.now();
        }
        setSilenceDurationMs(Date.now() - silenceStartRef.current);
      }
    }, SILENCE_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      vadRef.current?.destroy();
      vadRef.current = null;
    };
  }, [stream, isRecording]);

  return {
    isMicConnected,
    isSilent: silenceDurationMs >= SILENCE_THRESHOLD_MS,
    silenceDurationMs,
  };
}
