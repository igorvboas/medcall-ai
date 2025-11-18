/**
 * AudioWorklet para processamento de áudio para transcrição
 * Substitui o deprecated ScriptProcessorNode no AudioProcessor.ts
 * Configurado para 24kHz (formato esperado pela OpenAI)
 */
class TranscriptionAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.isActive = true;
    this.targetSampleRate = 24000; // OpenAI espera 24kHz
  }

  process(inputs, outputs, parameters) {
    // Verificar se ainda está ativo
    if (!this.isActive) {
      return false;
    }

    const input = inputs[0];
    
    if (input && input.length > 0) {
      const inputChannel = input[0]; // Primeiro canal (mono)
      
      if (inputChannel && inputChannel.length > 0) {
        // Acumular dados no buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.inputBuffer[this.bufferIndex] = inputChannel[i];
          this.bufferIndex++;
          
          // Quando o buffer estiver cheio, processar
          if (this.bufferIndex >= this.bufferSize) {
            // Criar cópia do buffer para enviar
            const audioData = new Float32Array(this.inputBuffer);
            
            // Enviar dados de áudio para o thread principal
            // O resample e conversão para base64 será feito no thread principal
            // sampleRate será obtido do AudioContext no thread principal
            this.port.postMessage({
              type: 'audiodata',
              audioData: Array.from(audioData), // Converter para Array para serialização
              timestamp: Date.now()
            });
            
            // Reset do buffer
            this.bufferIndex = 0;
          }
        }
      }
    }
    
    // Continuar processamento
    return true;
  }

  // Método para parar o processador
  stop() {
    this.isActive = false;
  }
}

// Registrar o processador
registerProcessor('transcription-audio-processor', TranscriptionAudioProcessor);

