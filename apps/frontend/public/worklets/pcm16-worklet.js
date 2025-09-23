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
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Se não há input de áudio, continua processando
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0]; // Canal 0 (mono)
    
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
      
      // Envia como ArrayBuffer transferível para melhor performance
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
