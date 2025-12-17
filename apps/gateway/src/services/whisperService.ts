import OpenAI from 'openai';
import { logError } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configurar path do ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Serviço de integração com Whisper API da OpenAI
 * Para transcrição de áudio em consultas presenciais
 */
class WhisperService {
    private openai: OpenAI;
    private model = 'whisper-1';

    // Cache de transcrições (opcional - evitar reprocessamento)
    private transcriptionCache = new Map<string, string>();

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY || '';

        if (!apiKey) {
            console.error('❌ [WHISPER] OPENAI_API_KEY não configurada!');
            logError(
                'OPENAI_API_KEY não configurada para Whisper',
                'error',
                null,
                { service: 'whisper' }
            );
        }

        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Converte WebM para WAV usando ffmpeg
     */
    private async convertWebMToWAV(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('wav')
                .audioCodec('pcm_s16le')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('end', () => {
                    console.log(`✅ [WHISPER] Conversão WebM → WAV concluída`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ [WHISPER] Erro na conversão:`, err);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Transcreve chunk de áudio usando Whisper API
     * 
     * @param audioBuffer - Buffer do áudio (webm, mp3, wav, etc)
     * @param speaker - 'doctor' ou 'patient' (para logging)
     * @param language - Código do idioma (padrão: 'pt')
     * @returns Texto transcrito
     */
    async transcribeAudioChunk(
        audioBuffer: Buffer,
        speaker: 'doctor' | 'patient' = 'doctor',
        language: string = 'pt'
    ): Promise<{ text: string; duration?: number }> {
        if (!this.openai.apiKey) {
            throw new Error('OPENAI_API_KEY não configurada');
        }

        const startTime = Date.now();
        let tempFilePath: string | null = null;

        try {
            // Verificar cache (opcional)
            const cacheKey = this.generateCacheKey(audioBuffer);
            if (this.transcriptionCache.has(cacheKey)) {
                console.log(`📦 [WHISPER] Cache hit para ${speaker}`);
                return {
                    text: this.transcriptionCache.get(cacheKey)!,
                    duration: 0
                };
            }

            console.log(`🎤 [WHISPER] Transcrevendo áudio ${speaker} (${audioBuffer.length} bytes)...`);

            // Detectar formato do áudio baseado nos magic bytes
            const audioFormat = this.detectAudioFormat(audioBuffer);
            console.log(`🔍 [WHISPER] Formato detectado: ${audioFormat}`);

            // Criar arquivo temporário com extensão correta
            // Whisper API aceita webm, mp3, mp4, mpeg, mpga, m4a, wav, e webm diretamente
            const tempDir = os.tmpdir();
            tempFilePath = path.join(tempDir, `whisper_${speaker}_${Date.now()}.${audioFormat}`);

            // Escrever buffer no arquivo temporário
            fs.writeFileSync(tempFilePath, audioBuffer);
            console.log(`💾 [WHISPER] Arquivo ${audioFormat} criado: ${tempFilePath} (${audioBuffer.length} bytes)`);

            // Whisper API aceita WebM e outros formatos diretamente - não precisa converter!
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: this.model,
                language: language,
                response_format: 'json',
                temperature: 0.0
            });

            const duration = Date.now() - startTime;
            const text = transcription.text || '';

            console.log(`✅ [WHISPER] Transcrito ${speaker} em ${duration}ms: "${text.substring(0, 50)}..."`);

            // Salvar no cache
            this.transcriptionCache.set(cacheKey, text);

            // Limpar cache antigo (manter apenas últimos 100)
            if (this.transcriptionCache.size > 100) {
                const firstKey = this.transcriptionCache.keys().next().value;
                if (firstKey) {
                    this.transcriptionCache.delete(firstKey);
                }
            }

            return {
                text,
                duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [WHISPER] Erro ao transcrever ${speaker} (${duration}ms):`, error);

            // Log adicional para debug
            if (tempFilePath) {
                console.error(`📁 [WHISPER] Arquivo com problema: ${tempFilePath}`);
                if (fs.existsSync(tempFilePath)) {
                    const stats = fs.statSync(tempFilePath);
                    console.error(`📊 [WHISPER] Tamanho do arquivo: ${stats.size} bytes`);
                }
            }

            logError(
                `Erro ao transcrever áudio com Whisper`,
                'error',
                null,
                {
                    speaker,
                    bufferSize: audioBuffer.length,
                    error: error instanceof Error ? error.message : String(error)
                }
            );

            throw error;
        } finally {
            // Limpar arquivo temporário
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🗑️ [WHISPER] Arquivo temporário removido`);
                } catch (cleanupError) {
                    console.warn(`⚠️ [WHISPER] Erro ao remover arquivo temporário:`, cleanupError);
                }
            }
        }
    }

    /**
     * Gera chave de cache baseada no conteúdo do áudio
     */
    private generateCacheKey(buffer: Buffer): string {
        // Hash simples do buffer (primeiros 1KB + tamanho)
        const sample = buffer.slice(0, 1024).toString('base64');
        return `${buffer.length}_${sample}`;
    }

    /**
     * Helper para sleep/delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Valida formato de áudio aceito pelo Whisper
     */
    isValidAudioFormat(mimeType: string): boolean {
        const validFormats = [
            'audio/webm',
            'audio/mp3',
            'audio/mpeg',
            'audio/mp4',
            'audio/m4a',
            'audio/wav',
            'audio/x-wav'
        ];

        return validFormats.some(format => mimeType.includes(format));
    }

    /**
     * Detecta formato de áudio baseado nos magic bytes do buffer
     */
    private detectAudioFormat(buffer: Buffer): string {
        // WebM: 0x1A 0x45 0xDF 0xA3
        if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
            return 'webm';
        }

        // OGG: 'OggS'
        if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
            return 'ogg';
        }

        // WAV: 'RIFF' ... 'WAVE'
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            return 'wav';
        }

        // MP3: ID3 or 0xFF 0xFB
        if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
            (buffer[0] === 0xFF && buffer[1] === 0xFB)) {
            return 'mp3';
        }

        // Padrão: webm (mais comum no navegador)
        console.warn('⚠️ [WHISPER] Formato de áudio não identificado, usando webm como padrão');
        return 'webm';
    }

    /**
     * Limpa cache de transcrições
     */
    clearCache(): void {
        this.transcriptionCache.clear();
        console.log('🧹 [WHISPER] Cache limpo');
    }
}

// Exportar instância singleton
export const whisperService = new WhisperService();
