import '@livekit/rtc-node';
import { Room, RoomEvent, RemoteAudioTrack, Track } from '@livekit/rtc-node';
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
    await room.connect(url, token);

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind !== 'audio' as any) return;
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
        await transcriptionService.processAudioChunk(
          {
            data: buf,
            participantId: participant.identity ?? participant.sid,
            sampleRate: 16000,
            channels: 1,
          },
          roomName,
        );
      });
    });

    // Relay transcriptions back over Text Stream
    const relay = ({ roomName: rn, segment }: any) => {
      if (rn !== roomName) return;
      try {
        const msg = Buffer.from(JSON.stringify({ type: 'transcription', data: segment }), 'utf8');
        const opts = { reliable: true, topic: 'transcription' } as any;
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


