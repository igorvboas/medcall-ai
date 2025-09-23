/**
 * AudioWorklet para conversão de Float32 → PCM16 (Int16LE)
 * Processa áudio em tempo real para transcrição STT
 */
class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleBuffer = [];
    this.targetSampleRate = 16000;
    this.inputSampleRate = sampleRate; // AudioContext sampleRate
    this.downsampleRatio = this.inputSampleRate / this.targetSampleRate;
    this.downsampleCounter = 0;
    this.chunksProcessed = 0;
    this.totalSamples = 0;
    
    // Log inicial
    console.log('[PCM16Worklet] Initialized:', {
      inputSampleRate: this.inputSampleRate,
      targetSampleRate: this.targetSampleRate,
      downsampleRatio: this.downsampleRatio
    });
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Log dos primeiros processes para debug
    if (this.chunksProcessed < 3) {
      console.log(`[PCM16Worklet] Process #${this.chunksProcessed}:`, {
        hasInput: !!input,
        hasChannel: !!(input && input[0]),
        inputLength: input?.[0]?.length || 0
      });
    }
    
    // Se não há input de áudio, continua processando
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0]; // Canal 0 (mono)
    this.totalSamples += inputChannel.length;
    
    // Detectar se há áudio real (não silêncio)
    const hasSignal = inputChannel.some(sample => Math.abs(sample) > 0.001);
    
    // Log ocasional para verificar se há sinal
    if (this.chunksProcessed < 10 || this.chunksProcessed % 1000 === 0) {
      console.log(`[PCM16Worklet] Chunk ${this.chunksProcessed}:`, {
        samples: inputChannel.length,
        hasSignal,
        maxAmplitude: Math.max(...inputChannel.map(Math.abs)),
        totalSamples: this.totalSamples
      });
    }
    
    // Processo de downsampling para 16kHz se necessário
    for (let i = 0; i < inputChannel.length; i++) {
      this.downsampleCounter += this.targetSampleRate;
      
      if (this.downsampleCounter >= this.inputSampleRate) {
        this.downsampleCounter -= this.inputSampleRate;
        
        // Clamp valor entre -1 e 1, depois converte para Int16
        const sample = Math.max(-1, Math.min(1, inputChannel[i]));
        const pcm16Sample = Math.round(sample * 0x7FFF);
        
        this.sampleBuffer.push(pcm16Sample);
      }
    }

    // Envia chunks de aproximadamente 20-60ms (320-960 amostras em 16kHz)
    const chunkSize = 640; // ~40ms em 16kHz
    
    if (this.sampleBuffer.length >= chunkSize) {
      const chunk = new Int16Array(this.sampleBuffer.splice(0, chunkSize));
      
      // Log dos primeiros chunks enviados
      if (this.chunksProcessed < 5) {
        console.log(`[PCM16Worklet] Sending chunk ${this.chunksProcessed}:`, {
          size: chunk.length,
          bufferSize: chunk.buffer.byteLength,
          firstSamples: Array.from(chunk.slice(0, 5))
        });
      }
      
      // Envia como ArrayBuffer transferível para melhor performance
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    this.chunksProcessed++;
    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
