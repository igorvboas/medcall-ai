// TranscriptionManager.ts - Gerenciador de transcrição em tempo real (usando proxy backend)
// Baseado no transcription.js funcional
import { AudioProcessor } from './AudioProcessor';


export class TranscriptionManager {
  private socket: any = null;
  private isConnected: boolean = false;
  private isTranscribing: boolean = false;
  private currentTranscript: string = '';
  private transcriptHistory: any[] = [];
  private audioProcessor: AudioProcessor | null = null;
  private lastSpeaker: string | null = null;
  private currentSpeechText: string = '';
  
  // Configurações
  private readonly OPENAI_MODEL = 'gpt-4o-realtime-preview-2024-12-17';
  private readonly AUDIO_FORMAT = 'pcm16';

  /**
   * Define a referência do socket.io
   */
  setSocket(socketInstance: any): void {
    // ✅ PROTEÇÃO: Evitar múltiplos listeners
    if (this.socket === socketInstance) {
      console.log('🎤 [TRANSCRIPTION] Socket já configurado, ignorando...');
      return;
    }
    
    this.socket = socketInstance;
    this.setupSocketListeners();
  }

  /**
   * Define a referência do AudioProcessor
   */
  setAudioProcessor(audioProcessorInstance: AudioProcessor): void {
    this.audioProcessor = audioProcessorInstance;
  }

  /**
   * Configura listeners do socket.io para transcrição
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // ✅ PROTEÇÃO: Remover listeners antigos antes de adicionar novos
    this.socket.off('transcription:message');
    this.socket.off('transcription:error');

    // Mensagens da OpenAI
    this.socket.on('transcription:message', (data: any) => {
      this.handleMessage(data);
    });

    // Erros
    this.socket.on('transcription:error', (data: any) => {
      console.error('[TRANSCRIPTION ERROR] Erro:', data.error);
      this.isConnected = false;
    });

    // Desconexão
    this.socket.on('transcription:disconnected', () => {
      console.log('[TRANSCRIPTION] Desconectado da OpenAI');
      this.isConnected = false;
    });

    // Receber transcrição de outro peer
    this.socket.on('receiveTranscriptionFromPeer', (data: any) => {
      const { transcription, from } = data;
      console.log('[TRANSCRIPTION] 📩 Transcrição recebida de', from, ':', transcription);
      this.displayTranscript(transcription, from, false);
    });
  }

  /**
   * Inicializa a conexão com OpenAI através do proxy
   */
  async init(): Promise<boolean> {
    console.log('[TRANSCRIPTION] Inicializando TranscriptionManager...');
    
    if (!this.socket) {
      console.error('[TRANSCRIPTION ERROR] Socket.io não foi definido! Chame setSocket() primeiro');
      return false;
    }

    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Erro ao inicializar:', error);
      return false;
    }
  }

  /**
   * Conecta via proxy do backend
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[TRANSCRIPTION] Conectando via proxy backend...');
      
      // Timeout de conexão
      const connectionTimeout = setTimeout(() => {
        reject(new Error('Timeout na conexão'));
      }, 10000);

      // Solicitar conexão ao backend
      this.socket!.emit('transcription:connect', {}, (response: any) => {
        clearTimeout(connectionTimeout);
        
        if (response.success) {
          console.log('[TRANSCRIPTION] ✅ Conectado via proxy!');
          this.isConnected = true;
          
          // Configurar sessão após conectar
          setTimeout(() => this.configureSession(), 500);
          resolve();
        } else {
          console.error('[TRANSCRIPTION ERROR] Falha na conexão:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  }

  /**
   * Configura a sessão do OpenAI Realtime
   */
  private configureSession(): void {
    console.log('[TRANSCRIPTION] Configurando sessão...');
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        // Apenas texto: Sem áudio de resposta do assistente
        modalities: ['text'],
        
        // Instruções claras: Apenas transcrever, nunca responder
        instructions: 'Você é um assistente de transcrição. Apenas transcreva o áudio recebido em português brasileiro. NUNCA responda, NUNCA comente, NUNCA interaja. Apenas transcreva exatamente o que foi dito, palavra por palavra.',
        
        // Formato de input: PCM16 para áudio recebido
        input_audio_format: this.AUDIO_FORMAT,
        
        // Transcrição de input: Usar Whisper para transcrever áudio do usuário
        input_audio_transcription: {
          model: 'whisper-1'
        },
        
        // Detecção de voz: VAD (Voice Activity Detection) automático
        turn_detection: {
          type: 'server_vad', // Server-side Voice Activity Detection
          threshold: 0.5,      // Sensibilidade (0.0 a 1.0)
          prefix_padding_ms: 300,    // Capturar 300ms antes da fala
          silence_duration_ms: 500   // Considerar pausa após 500ms de silêncio
        }
      }
    };

    this.send(sessionConfig);
    console.log('[TRANSCRIPTION] ✅ Sessão configurada para transcrição apenas (sem respostas)');
  }

  /**
   * Envia mensagem através do proxy
   */
  private send(data: any): boolean {
    if (!this.isConnected || !this.socket) {
      console.warn('[TRANSCRIPTION WARNING] Não conectado ao proxy');
      return false;
    }

    try {
      this.socket.emit('transcription:send', JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Erro ao enviar mensagem:', error);
      return false;
    }
  }

  /**
   * Processa mensagens recebidas do WebSocket
   */
  private handleMessage(data: any): void {
    try {
      const message = JSON.parse(data);
      console.log('[TRANSCRIPTION] 📨 Mensagem recebida:', message.type);

      switch (message.type) {
        case 'session.created':
          console.log('[TRANSCRIPTION] ✅ Sessão criada:', message.session);
          break;

        case 'session.updated':
          console.log('[TRANSCRIPTION] ✅ Sessão atualizada');
          break;

        case 'input_audio_buffer.committed':
          console.log('[TRANSCRIPTION] ✅ Buffer de áudio confirmado');
          break;

        case 'input_audio_buffer.speech_started':
          console.log('[TRANSCRIPTION] 🎤 Fala detectada!');
          this.isTranscribing = true;
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('[TRANSCRIPTION] 🤐 Fala pausada');
          this.finalizeSpeech();
          break;

        case 'conversation.item.created':
          console.log('[TRANSCRIPTION] 💬 Item de conversa criado:', message.item);
          this.handleTranscription(message.item);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          console.log('[TRANSCRIPTION] 📝 Transcrição de input completa:', message.transcript);
          // Único evento correto: transcrição do áudio do USUÁRIO
          this.processUserTranscription(message.transcript);
          break;

        case 'response.created':
          console.log('[TRANSCRIPTION] 🤖 Resposta criada');
          // Ignorado: não queremos respostas do assistente
          break;

        case 'response.output_item.added':
          console.log('[TRANSCRIPTION] 📤 Item de output adicionado:', message.item);
          // Ignorado: outputs são respostas do assistente
          break;

        case 'response.content_part.added':
          console.log('[TRANSCRIPTION] 📝 Parte de conteúdo adicionada');
          // Ignorado: conteúdo gerado pelo assistente
          break;

        case 'response.audio_transcript.delta':
          console.log('[TRANSCRIPTION] 📝 Delta de transcrição de áudio:', message.delta);
          // Ignorado: transcrição do áudio gerado pelo assistente
          break;

        case 'response.done':
          console.log('[TRANSCRIPTION] ✅ Resposta completa');
          break;

        case 'error':
          console.error('[TRANSCRIPTION ERROR] ❌ Erro da API:', message.error);
          break;

        default:
          console.log('[TRANSCRIPTION] 📦 Tipo de mensagem:', message.type, message);
      }
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Processa a transcrição do usuário
   */
  private processUserTranscription(transcript: string): void {
    if (!transcript) return;

    // Lógica de decisão: exibir ou enviar baseado no contexto
    // Por enquanto, sempre exibir localmente
    // TODO: Implementar lógica de offer/answer quando integrar com WebRTC
    this.displayTranscript(transcript, 'Você', true);
  }

  /**
   * Processa transcrição (mantido para compatibilidade)
   */
  private handleTranscription(item: any): void {
    if (item.type === 'message' && item.role === 'user') {
      const content = item.content?.[0];
      if (content?.type === 'input_audio' && content.transcript) {
        console.log('[TRANSCRIPTION] 📝 Transcrição do usuário:', content.transcript);
        this.displayTranscript(content.transcript, 'Você', true);
      }
    }
  }

  /**
   * Exibe transcrição na UI de forma incremental
   */
  private displayTranscript(text: string, speaker: string, isLocal: boolean): void {
    const label = isLocal ? 'Você' : speaker;
    
    if (this.lastSpeaker === label) {
      // Mesmo falante - adiciona ao texto atual
      this.currentSpeechText += ' ' + text;
    } else {
      // Falante diferente
      // Consolidar fala anterior
      if (this.lastSpeaker && this.currentSpeechText) {
        this.currentTranscript += this.currentSpeechText + '\n';
      }
      
      // Começar nova fala
      this.lastSpeaker = label;
      this.currentSpeechText = text;
      this.currentTranscript += `[${label}]: `;
    }
    
    // Disparar evento customizado para atualizar UI
    this.onTranscriptUpdate?.(this.currentTranscript + this.currentSpeechText);
  }

  /**
   * Finaliza a fala atual (chamado quando detecta pausa)
   */
  private finalizeSpeech(): void {
    if (this.currentSpeechText) {
      // Consolidar a fala completa no histórico
      this.currentTranscript += this.currentSpeechText;
      this.currentSpeechText = '';
      console.log('[TRANSCRIPTION] ✅ Fala finalizada');
    }
  }

  /**
   * Envia áudio para transcrição
   */
  sendAudio(audioBase64: string): boolean {
    if (!this.isConnected) {
      console.warn('[TRANSCRIPTION WARNING] Não conectado, áudio não enviado');
      return false;
    }

    const audioMessage = {
      type: 'input_audio_buffer.append',
      audio: audioBase64
    };

    console.log('[TRANSCRIPTION] 🎵 Enviando chunk de áudio...', audioBase64.length, 'bytes');
    return this.send(audioMessage);
  }

  /**
   * Inicia transcrição
   */
  start(): void {
    console.log('[TRANSCRIPTION] ▶️ Iniciando transcrição...');
    this.isTranscribing = true;
    this.currentTranscript = '';

    // Iniciar processamento de áudio
    if (this.audioProcessor) {
      this.audioProcessor.start((audioBase64: string) => {
        this.sendAudio(audioBase64);
      });
    } else {
      console.warn('[TRANSCRIPTION WARNING] AudioProcessor não está disponível');
    }
  }

  /**
   * Para transcrição
   */
  stop(): void {
    console.log('[TRANSCRIPTION] ⏸️ Parando transcrição...');
    this.isTranscribing = false;
    
    // Finalizar fala atual antes de parar
    this.finalizeSpeech();
    
    // Parar processamento de áudio
    if (this.audioProcessor) {
      this.audioProcessor.stop();
    }
    
    // Salvar no histórico
    if (this.currentTranscript) {
      this.transcriptHistory.push({
        timestamp: this.getTimestamp(),
        text: this.currentTranscript
      });
    }
  }

  /**
   * Desconecta e limpa recursos
   */
  disconnect(): void {
    console.log('[TRANSCRIPTION] Desconectando...');
    
    if (this.socket) {
      this.socket.emit('transcription:disconnect');
    }
    
    this.isConnected = false;
    this.isTranscribing = false;
  }

  /**
   * Verifica status da conexão
   */
  getStatus() {
    return {
      connected: this.isConnected,
      transcribing: this.isTranscribing,
      transcript: this.currentTranscript,
      history: this.transcriptHistory
    };
  }

  /**
   * Formata timestamp para exibição
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  // Callback para atualização da UI
  onTranscriptUpdate?: (transcript: string) => void;
}
