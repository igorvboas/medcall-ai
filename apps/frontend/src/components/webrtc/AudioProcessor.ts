// AudioProcessor.ts - Captura e processa áudio para transcrição
// Baseado no audioProcessor.js funcional

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isProcessing: boolean = false;
  private audioStream: MediaStream | null = null;

  // Configurações de áudio
  private readonly SAMPLE_RATE = 24000; // OpenAI espera 24kHz
  private readonly BUFFER_SIZE = 4096; // Tamanho do buffer de processamento

  /**
   * Inicializa o processamento de áudio
   */
  async init(stream: MediaStream): Promise<boolean> {
    console.log('Inicializando AudioProcessor...');
    
    try {
      // Criar AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.SAMPLE_RATE
      });

      console.log(`AudioContext criado com sample rate: ${this.audioContext.sampleRate}Hz`);

      // Extrair apenas o áudio do stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('Nenhuma track de áudio encontrada');
      }

      this.audioStream = new MediaStream([audioTracks[0]]);
      
      // Criar source node do stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Criar processor node (ScriptProcessor)
      this.processorNode = this.audioContext.createScriptProcessor(
        this.BUFFER_SIZE, 
        1, // 1 canal de entrada (mono)
        1  // 1 canal de saída
      );

      // Conectar nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      console.log('✅ AudioProcessor inicializado');
      return true;

    } catch (error) {
      console.error('Erro ao inicializar AudioProcessor:', error);
      return false;
    }
  }

  /**
   * Inicia o processamento e envio de áudio
   */
  start(onAudioData: (audioBase64: string) => void): boolean {
    if (!this.processorNode) {
      console.warn('ProcessorNode não inicializado');
      return false;
    }

    console.log('▶️ Iniciando processamento de áudio...');
    this.isProcessing = true;

    // Handler de processamento de áudio
    this.processorNode.onaudioprocess = (audioEvent) => {
      if (!this.isProcessing) return;

      // Pegar dados de áudio do buffer de entrada
      const inputData = audioEvent.inputBuffer.getChannelData(0);
      
      // Resample se necessário (do sample rate do AudioContext para 24kHz)
      let audioData: any = inputData;
      if (this.audioContext && this.audioContext.sampleRate !== this.SAMPLE_RATE) {
        audioData = this.resampleAudio(
          inputData, 
          this.audioContext.sampleRate, 
          this.SAMPLE_RATE
        );
      }

      // Converter para base64
      const base64Audio = this.audioToBase64(audioData);

      // Callback com os dados
      if (onAudioData && typeof onAudioData === 'function') {
        onAudioData(base64Audio);
      }
    };

    console.log('✅ Processamento ativo');
    return true;
  }

  /**
   * Para o processamento de áudio
   */
  stop(): void {
    console.log('⏸️ Parando processamento de áudio...');
    this.isProcessing = false;
    
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
    }
  }

  /**
   * Limpa recursos
   */
  cleanup(): void {
    console.log('Limpando AudioProcessor...');
    
    this.stop();
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    console.log('✅ AudioProcessor limpo');
  }

  /**
   * Retorna o estado atual
   */
  getStatus() {
    return {
      initialized: this.audioContext !== null,
      processing: this.isProcessing,
      sampleRate: this.audioContext?.sampleRate || 0
    };
  }

  /**
   * Converte Float32Array para PCM16 (formato esperado pela OpenAI)
   */
  private convertFloat32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp o valor entre -1 e 1
      let sample = Math.max(-1, Math.min(1, float32Array[i]));
      
      // Converter para 16-bit integer
      pcm16[i] = sample < 0 
        ? sample * 0x8000  // -32768
        : sample * 0x7FFF; // 32767
    }
    
    return pcm16;
  }

  /**
   * Converte PCM16 para Base64 (formato de envio para OpenAI)
   */
  private pcm16ToBase64(pcm16Array: Int16Array): string {
    // Converter Int16Array para Uint8Array (bytes)
    const uint8Array = new Uint8Array(pcm16Array.buffer as ArrayBuffer);
    
    // Converter para string binária
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    
    // Converter para Base64
    return btoa(binary);
  }

  /**
   * Converte Float32 diretamente para Base64
   */
  private audioToBase64(float32Array: Float32Array): string {
    const pcm16 = this.convertFloat32ToPCM16(float32Array);
    return this.pcm16ToBase64(pcm16);
  }

  /**
   * Resample áudio de uma sample rate para outra (se necessário)
   */
  private resampleAudio(audioData: any, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return new Float32Array(audioData);
    
    const ratio = fromRate / toRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
      const t = srcIndex - srcIndexFloor;
      
      // Interpolação linear
      result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
    }
    
    return result;
  }
}
