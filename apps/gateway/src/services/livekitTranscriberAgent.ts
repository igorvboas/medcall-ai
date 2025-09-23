import '@livekit/rtc-node';
import { Room, RoomEvent, RemoteAudioTrack, Track } from 'livekit-client';
import { transcriptionService } from './transcriptionService';

type ActiveAgent = {
  room: Room;
  roomName: string;
};

class LiveKitTranscriberAgentManager {
  private agents: Map<string, ActiveAgent> = new Map();

  constructor() {}

  async start(roomName: string): Promise<void> {
    if (this.agents.has(roomName)) return;

    const url = process.env.LIVEKIT_URL as string;
    const token = await this.createAccessToken(roomName);

    const room = new Room();
    // Garantir auto-subscribe para tracks remotas
    try { (room as any).setAutoSubscribe?.(true); } catch {}
    await room.connect(url, token);

    const ensureSubscribed = (pub: any) => {
      try {
        const k = (pub as any)?.kind;
        if (k === 'audio' || k === 1) {
          console.log('[LK-Agent] Ensuring subscribed to pub:', {
            kind: k,
            trackSid: (pub as any)?.trackSid,
            subscribed: (pub as any)?.isSubscribed,
          });
          (pub as any)?.setSubscribed?.(true);
        }
      } catch (e) {
        console.error('[LK-Agent] Failed to subscribe to pub:', e);
      }
    };

    // Forçar subscribe para publicações já existentes ao conectar (compat com diferentes typings)
    try {
      const parts: any = (room as any).participants ?? (room as any).remoteParticipants ?? (room as any).getParticipants?.();
      if (parts && typeof parts.forEach === 'function') {
        parts.forEach((p: any) => {
          p?.trackPublications?.forEach?.((pub: any) => ensureSubscribed(pub));
        });
      }
    } catch {}

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LK-Agent] ParticipantConnected:', participant.identity);
      try {
        (participant as any)?.trackPublications?.forEach?.((pub: any) => ensureSubscribed(pub));
      } catch {}
    });

    room.on(RoomEvent.TrackPublished, (pub) => {
      try {
        ensureSubscribed(pub as any);
      } catch {}
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      console.log('[LK-Agent] TrackSubscribed:', {
        kind: (track as any)?.kind,
        participant: participant?.identity,
        sid: (track as any)?.sid,
      });
      const kind = (track as any)?.kind;
      // Aceitar 'audio' (browser) ou 1 (enum numérico no Node bindings)
      if (!(kind === 'audio' || kind === 1)) return;
      const audioTrack = track as RemoteAudioTrack;
      // createAudioStream is provided by @livekit/rtc-node at runtime,
      // but it's not in the TypeScript typings of livekit-client.
      const createAudioStream = (audioTrack as any)?.createAudioStream?.bind(audioTrack);
      if (!createAudioStream) {
        console.error('❌ createAudioStream not available on RemoteAudioTrack (rtc-node not registered?)');
        return;
      }
      const pcm = createAudioStream(16000, 1);
      pcm.on('data', async (buf: Buffer) => {
        try {
          if (!buf || buf.length === 0) return;
          console.log('[LK-Agent] PCM chunk received:', buf.length);
        await transcriptionService.processAudioChunk(
          {
            data: buf,
            participantId: participant.identity ?? participant.sid,
            sampleRate: 16000,
            channels: 1,
          },
          roomName,
        );
        } catch (e) {
          console.error('[LK-Agent] Error processing PCM chunk:', e);
        }
      });
    });

    // Relay transcriptions back over Text Stream
    const relay = ({ roomName: rn, segment }: any) => {
      if (rn !== roomName) return;
      try {
        const msg = Buffer.from(JSON.stringify({ type: 'transcription', data: segment }), 'utf8');
        const opts = { reliable: true, topic: 'lk.transcription' } as any;
        room.localParticipant?.publishData(msg, opts);
      } catch {}
    };
    transcriptionService.on('transcription', relay);

    this.agents.set(roomName, { room, roomName });
    console.log(`🎧 LiveKit transcriber bot joined room ${roomName}`);
  }

  async stop(roomName: string): Promise<void> {
    const agent = this.agents.get(roomName);
    if (!agent) return;
    await agent.room.disconnect();
    this.agents.delete(roomName);
    console.log(`🛑 LiveKit transcriber bot left room ${roomName}`);
  }

  isActive(roomName: string): boolean {
    return this.agents.has(roomName);
  }

  private async createAccessToken(roomName: string): Promise<string> {
    const { AccessToken } = await import('livekit-server-sdk');
    const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
      identity: 'transcriber-bot',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: false, canSubscribe: true, canPublishData: true });
    return at.toJwt();
  }
}

export const livekitTranscriberAgent = new LiveKitTranscriberAgentManager();


