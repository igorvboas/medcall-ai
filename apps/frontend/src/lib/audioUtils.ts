/**
 * Utilitários para processamento de áudio
 * Voice Activity Detection (VAD) e helpers
 */

export interface VADConfig {
    threshold: number; // RMS threshold (0.0 - 1.0)
    minSpeechDuration: number; // ms mínimo de fala para considerar chunk
    analysisInterval: number; // ms entre análises
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
    threshold: 0.02,
    minSpeechDuration: 1500, // 1.5s
    analysisInterval: 100 // 100ms
};

/**
 * Voice Activity Detector usando Web Audio API
 */
export class VoiceActivityDetector {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private config: VADConfig;
    private source: MediaStreamAudioSourceNode;

    constructor(stream: MediaStream, config: VADConfig = DEFAULT_VAD_CONFIG) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.config = config;

        this.source = this.audioContext.createMediaStreamSource(stream);
        this.analyser.fftSize = 512;
        this.source.connect(this.analyser);
    }

    /**
     * Calcula nível de áudio atual (RMS)
     */
    getAudioLevel(): number {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        // Calcular RMS (Root Mean Square)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / bufferLength);
    }

    /**
     * Verifica se há voz detectada
     */
    isSpeaking(): boolean {
        return this.getAudioLevel() > this.config.threshold;
    }

    /**
     * Decide se chunk deve ser enviado baseado em amostras de voz
     */
    shouldSendChunk(durationMs: number, samplesWithVoice: number): boolean {
        const totalSamples = durationMs / this.config.analysisInterval;
        const voicePercentage = samplesWithVoice / totalSamples;

        // Enviar se pelo menos 30% do chunk tem voz
        return voicePercentage >= 0.3;
    }

    /**
     * Limpa recursos
     */
    destroy(): void {
        this.source.disconnect();
        this.analyser.disconnect();
        this.audioContext.close();
    }
}

/**
 * Converte Blob de áudio para base64
 */
export async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            // Remover prefixo "data:audio/webm;base64,"
            const base64Data = base64.split(',')[1] || base64;
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Formata duração em segundos para HH:MM:SS
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Detecta se navegador suporta MediaRecorder com webm
 */
export function isWebMSupported(): boolean {
    if (!window.MediaRecorder) return false;
    return MediaRecorder.isTypeSupported('audio/webm;codecs=opus');
}

/**
 * Retorna melhor tipo MIME suportado para gravação
 * Prioriza formatos compatíveis com Whisper API
 */
export function getBestAudioMimeType(): string {
    // Formatos compatíveis com Whisper API, em ordem de preferência
    const types = [
        'audio/webm;codecs=opus',  // Melhor qualidade e compressão
        'audio/webm',               // Fallback genérico webm
        'audio/ogg;codecs=opus',    // Alternativa ogg
        'audio/wav'                 // Última opção (sem compressão, arquivos grandes)
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log(`🎤 Usando formato de áudio: ${type}`);
            return type;
        }
    }

    console.warn('⚠️ Nenhum formato de áudio compatível encontrado!');
    return ''; // Navegador não suporta nenhum
}
