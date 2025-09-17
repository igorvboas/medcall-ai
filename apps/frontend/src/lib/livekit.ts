import { Room, RoomOptions, VideoPresets as LiveKitVideoPresets } from 'livekit-client';

// Configurações do LiveKit
export const livekitConfig = {
  serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
  apiKey: process.env.NEXT_PUBLIC_LIVEKIT_API_KEY || '',
  apiSecret: process.env.LIVEKIT_API_SECRET || '', // Server-side only
};


// Configurações padrão para o Room
export const defaultRoomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    videoSimulcastLayers: [
      LiveKitVideoPresets.h90,
      LiveKitVideoPresets.h180,
      LiveKitVideoPresets.h360,
    ],
    audioPreset: {
      maxBitrate: 64_000,
      priority: 'high',
    },
  },
  videoCaptureDefaults: {
    resolution: LiveKitVideoPresets.h720,
    facingMode: 'user',
  },
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

// VideoPresets customizados (re-exportando os do LiveKit com nomes mais claros)
export const VideoPresets = {
  h90: LiveKitVideoPresets.h90,
  h180: LiveKitVideoPresets.h180,
  h360: LiveKitVideoPresets.h360,
  h720: LiveKitVideoPresets.h720,
  h1080: LiveKitVideoPresets.h1080,
};

// Função para criar uma nova instância do Room
export function createLiveKitRoom(options?: Partial<RoomOptions>): Room {
  const roomOptions = { ...defaultRoomOptions, ...options };
  return new Room(roomOptions);
}

// Função para validar se as configurações do LiveKit estão corretas
export function validateLiveKitConfig(): boolean {
  if (!livekitConfig.serverUrl) {
    throw new Error('NEXT_PUBLIC_LIVEKIT_URL não configurado');
  }
  
  if (!livekitConfig.apiKey) {
    throw new Error('NEXT_PUBLIC_LIVEKIT_API_KEY não configurado');
  }
  
  return true;
}

// Função para obter a URL do servidor LiveKit
export function getLiveKitServerUrl(): string {
  return livekitConfig.serverUrl;
}
