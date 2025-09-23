/**
 * AudioWorklet para processamento de áudio em tempo real
 * Substitui o deprecated ScriptProcessorNode
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.isActive = true;
  }

  process(inputs, outputs, parameters) {
    // Verificar se ainda está ativo
    if (!this.isActive) {
      return false;
    }

    const input = inputs[0];
    
    if (input && input.length > 0) {
      const inputChannel = input[0]; // Primeiro canal
      
      if (inputChannel && inputChannel.length > 0) {
        // Acumular dados no buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.inputBuffer[this.bufferIndex] = inputChannel[i];
          this.bufferIndex++;
          
          // Quando o buffer estiver cheio, processar
          if (this.bufferIndex >= this.bufferSize) {
            // Criar cópia do buffer para enviar
            const audioData = new Float32Array(this.inputBuffer);
            
            // Calcular RMS para verificar se há áudio real
            let sum = 0;
            for (let j = 0; j < audioData.length; j++) {
              sum += audioData[j] * audioData[j];
            }
            const rms = Math.sqrt(sum / audioData.length);
            
            // Só enviar se houver áudio significativo
            if (rms > 0.001) {
              // Enviar dados de áudio para o thread principal
              this.port.postMessage({
                type: 'audiodata',
                audioData: audioData,
                timestamp: Date.now(),
                sampleRate: 44100,
                rms: rms
              });
            }
            
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
registerProcessor('audio-processor', AudioProcessor);
