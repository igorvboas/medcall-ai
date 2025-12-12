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
  
  // ✅ NOVO: Reconexão automática
  private reconnectionAttempts: number = 0;
  private maxReconnectionAttempts: number = 10;
  private reconnectionTimer: any = null;
  private healthCheckInterval: any = null;
  private lastAudioTime: number = 0;
  
  // Configurações
  private readonly OPENAI_MODEL = 'gpt-realtime-mini-2025-10-06';
  private readonly AUDIO_FORMAT = 'pcm16';

  /**
   * Define a referência do socket.io
   */
  setSocket(socketInstance: any): void {
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
      
      // ✅ Tentar reconectar automaticamente em caso de erro
      console.log('[TRANSCRIPTION] Erro detectado, agendando reconexão...');
      this.scheduleReconnection();
    });

    // Desconexão
    this.socket.on('transcription:disconnected', () => {
      console.log('[TRANSCRIPTION] Desconectado da OpenAI');
      this.isConnected = false;
      
      // ✅ Tentar reconectar automaticamente
      console.log('[TRANSCRIPTION] Desconexão detectada, agendando reconexão...');
      this.scheduleReconnection();
    });

    // ✅ CORREÇÃO: Removido listener duplicado - agora é gerenciado pelo ConsultationRoom
    // this.socket.on('receiveTranscriptionFromPeer', ...) - REMOVIDO para evitar duplicação
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
      
      // ✅ CRÍTICO: Iniciar transcrição (processar áudio) após conectar
      console.log('[TRANSCRIPTION] Iniciando processamento de áudio...');
      this.start(); // Método correto é start(), não startTranscription()
      
      // ✅ Iniciar monitoramento de saúde
      this.startHealthCheck();
      
      // ✅ Resetar contador de tentativas após sucesso
      this.reconnectionAttempts = 0;
      
      return true;
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Erro ao inicializar:', error);
      
      // ✅ Tentar reconectar automaticamente
      this.scheduleReconnection();
      
      return false;
    }
  }

  /**
   * Conecta via proxy do backend
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[TRANSCRIPTION] Conectando via proxy backend...');
      
      // ✅ Verificar se socket está conectado antes de tentar
      if (!this.socket) {
        const error = 'Socket não está definido. Chame setSocket() primeiro.';
        console.error('[TRANSCRIPTION ERROR]', error);
        reject(new Error(error));
        return;
      }
      
      if (!this.socket.connected) {
        const error = 'Socket não está conectado. Aguarde a conexão do socket primeiro.';
        console.error('[TRANSCRIPTION ERROR]', error);
        console.error('[TRANSCRIPTION ERROR] Socket state:', this.socket.connected ? 'connected' : 'disconnected');
        reject(new Error(error));
        return;
      }
      
      console.log('[TRANSCRIPTION] Socket está conectado, solicitando conexão OpenAI...');
      
      // Timeout de conexão
      const connectionTimeout = setTimeout(() => {
        reject(new Error('Timeout na conexão com OpenAI (10s)'));
      }, 10000);

      // Solicitar conexão ao backend
      this.socket.emit('transcription:connect', {}, (response: any) => {
        clearTimeout(connectionTimeout);
        
        if (response && response.success) {
          console.log('[TRANSCRIPTION] ✅ Conectado via proxy!');
          this.isConnected = true;
          
          // Configurar sessão após conectar
          setTimeout(() => this.configureSession(), 500);
          resolve();
        } else {
          const errorMsg = response?.error || 'Erro desconhecido ao conectar à OpenAI';
          console.error('[TRANSCRIPTION ERROR] Falha na conexão:', errorMsg);
          console.error('[TRANSCRIPTION ERROR] Resposta completa:', response);
          reject(new Error(errorMsg));
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
          model: 'whisper-1',
          language: 'pt' // Forçar idioma Português
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
      // Logs removidos para reduzir poluição no console

      switch (message.type) {
        case 'session.created':
          // Log removido
          break;

        case 'session.updated':
          // Log removido
          break;

        case 'input_audio_buffer.committed':
          // Log removido
          break;

        case 'input_audio_buffer.speech_started':
          this.isTranscribing = true;
          break;

        case 'input_audio_buffer.speech_stopped':
          this.finalizeSpeech();
          break;

        case 'conversation.item.created':
          // Log removido
          break;

        case 'conversation.item.input_audio_transcription.completed':
          // Único evento correto: transcrição do áudio do USUÁRIO
          this.processUserTranscription(message.transcript);
          break;

        case 'response.created':
          // Ignorado: não queremos respostas do assistente
          break;

        case 'response.output_item.added':
          // Ignorado: outputs são respostas do assistente
          break;

        case 'response.content_part.added':
          // Ignorado: conteúdo gerado pelo assistente
          break;

        case 'response.audio_transcript.delta':
          // Ignorado: transcrição do áudio gerado pelo assistente
          break;

        case 'response.done':
          // Log removido
          break;

        case 'error':
          console.error('[TRANSCRIPTION ERROR] ❌ Erro da API:', message.error);
          break;

        default:
          // Log removido - apenas erros são logados
      }
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Processa a transcrição do usuário
   * ✅ CORREÇÃO: Não exibe localmente - apenas repassa para o callback
   */
  private processUserTranscription(transcript: string): void {
    if (!transcript) return;

    console.log('[TRANSCRIPTION] 🎤 Transcrição processada:', transcript);
    
    // ✅ CORREÇÃO: Apenas chamar callback - deixar decisão para o componente
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(transcript);
    } else {
      console.warn('[TRANSCRIPTION] ⚠️ onTranscriptUpdate não definido');
    }
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
   * ✅ NOVO: Método público para adicionar transcrição à UI
   * Adiciona uma linha completa (não incremental)
   */
  addTranscriptToUI(text: string, speaker: string): void {
    console.log(`[TRANSCRIPTION] 📝 Adicionando à UI: [${speaker}]: ${text}`);
    console.log(`[TRANSCRIPTION] 📊 Estado atual: ${this.currentTranscript.length} caracteres já existentes`);
    
    // ✅ CORREÇÃO: Adicionar como linha completa, não incremental
    // Finalizar fala anterior se houver
    if (this.currentSpeechText && this.lastSpeaker) {
      this.currentTranscript += this.currentSpeechText + '\n';
      this.currentSpeechText = '';
    }
    
    // ✅ PROTEÇÃO: Verificar se o texto não está vazio antes de adicionar
    if (!text || text.trim().length === 0) {
      console.warn('[TRANSCRIPTION] ⚠️ Tentativa de adicionar texto vazio, ignorando');
      return;
    }
    
    // Adicionar nova linha completa
    const newLine = `[${speaker}]: ${text}\n`;
    this.currentTranscript += newLine;
    this.lastSpeaker = speaker;
    
    console.log(`[TRANSCRIPTION] ✅ Adicionado. Novo tamanho: ${this.currentTranscript.length} caracteres`);
    
    // Atualizar UI com o texto completo
    this.onUIUpdate?.(this.currentTranscript);
  }

  /**
   * Exibe transcrição na UI de forma incremental (agora privado)
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
    
    // ✅ CORREÇÃO: Disparar callback de UI update (para transcrições de peers)
    this.onUIUpdate?.(this.currentTranscript + this.currentSpeechText);
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

    // ✅ Registrar timestamp do último áudio enviado (para health check)
    this.lastAudioTime = Date.now();

    // console.log('[TRANSCRIPTION] 🎵 Enviando chunk de áudio...', audioBase64.length, 'bytes');
    return this.send(audioMessage);
  }

  /**
   * Inicia transcrição
   * @param preserveHistory - Se true, não limpa o histórico existente (útil para reconexões)
   */
  start(preserveHistory: boolean = false): void {
    // ✅ CORREÇÃO: Se já está transcrevendo, não fazer nada (evitar múltiplas chamadas)
    if (this.isTranscribing) {
      console.log('[TRANSCRIPTION] ⚠️ Já está transcrevendo, ignorando start() duplicado');
      return;
    }
    
    console.log('[TRANSCRIPTION] ▶️ Iniciando transcrição...', preserveHistory ? '(preservando histórico)' : '');
    this.isTranscribing = true;
    
    // ✅ CORREÇÃO CRÍTICA: NUNCA limpar se já houver transcrições, independente do parâmetro
    // Isso previne perda de dados quando start() é chamado múltiplas vezes
    if (this.currentTranscript.length > 0) {
      console.log('[TRANSCRIPTION] 💾 Preservando', this.currentTranscript.length, 'caracteres de transcrição existente (proteção automática)');
      // NÃO limpar - preservar sempre
    } else if (!preserveHistory) {
      // Só limpar se não houver transcrições E não for para preservar
      this.currentTranscript = '';
      console.log('[TRANSCRIPTION] 🧹 Limpando transcrição (primeira vez, sem histórico)');
    } else {
      console.log('[TRANSCRIPTION] 💾 Preservando histórico (parâmetro preserveHistory=true)');
    }

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
    
    // ✅ Parar monitoramento
    this.stopHealthCheck();
    this.clearReconnectionTimer();
    
    if (this.socket) {
      this.socket.emit('transcription:disconnect');
    }
    
    this.isConnected = false;
    this.isTranscribing = false;
  }

  /**
   * ✅ NOVO: Reconecta à transcrição após desconexão
   */
  async reconnect(): Promise<boolean> {
    console.log('[TRANSCRIPTION] Reconectando...');
    
    // ✅ CORREÇÃO: Salvar transcrições existentes antes de reconectar
    const savedTranscript = this.currentTranscript;
    console.log(`[TRANSCRIPTION] 💾 Salvando ${savedTranscript.length} caracteres de transcrição existente`);
    
    // Parar health check temporariamente
    this.stopHealthCheck();
    
    // Primeiro desconectar conexão antiga (se existir)
    if (this.socket) {
      this.socket.emit('transcription:disconnect');
    }
    this.isConnected = false;
    this.isTranscribing = false;
    
    // Aguardar um pouco antes de reconectar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Tentar reconectar
    try {
      await this.connect();
      
      // ✅ CORREÇÃO: Restaurar transcrições salvas ANTES de iniciar
      this.currentTranscript = savedTranscript;
      console.log(`[TRANSCRIPTION] ✅ Restauradas ${savedTranscript.length} caracteres de transcrição`);
      
      // Iniciar transcrição preservando histórico
      console.log('[TRANSCRIPTION] Reiniciando transcrição...');
      this.start(true); // ✅ Preservar histórico ao reconectar
      
      // ✅ Reiniciar health check
      this.startHealthCheck();
      
      // ✅ Resetar contador de tentativas
      this.reconnectionAttempts = 0;
      
      console.log('[TRANSCRIPTION] ✅ Reconexão bem-sucedida!');
      return true;
    } catch (error) {
      console.error('[TRANSCRIPTION ERROR] Falha ao reconectar:', error);
      return false;
    }
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

  /**
   * ✅ NOVO: Inicia monitoramento de saúde da transcrição
   */
  private startHealthCheck(): void {
    // Limpar health check anterior se existir
    this.stopHealthCheck();
    
    console.log('[TRANSCRIPTION] 💓 Iniciando monitoramento de saúde...');
    
    // Verificar a cada 30 segundos (reduzido de 10s para evitar spam)
    this.healthCheckInterval = setInterval(() => {
      // Verificar se está conectado
      if (!this.isConnected) {
        console.warn('[TRANSCRIPTION] ⚠️ Health check: Desconectado! Tentando reconectar...');
        this.scheduleReconnection();
        return;
      }
      
      // Verificar se audioProcessor está ativo
      if (this.isTranscribing && this.audioProcessor) {
        const now = Date.now();
        // Se passou mais de 30 segundos sem processar áudio, pode estar com problema
        if (this.lastAudioTime > 0 && (now - this.lastAudioTime) > 30000) {
          console.warn('[TRANSCRIPTION] ⚠️ Health check: Sem áudio há 30s, pode estar travado');
          // Não reconectar automaticamente por falta de áudio, pode ser silêncio natural
        }
      }
      
      // ✅ Só logar se estiver desconectado ou com problema (reduzir spam de logs)
      if (!this.isConnected || !this.isTranscribing) {
        console.log('[TRANSCRIPTION] 💓 Health check: (connected:', this.isConnected, 'transcribing:', this.isTranscribing, ')');
      }
    }, 30000); // 30 segundos (reduzido de 10s)
  }

  /**
   * ✅ NOVO: Para monitoramento de saúde
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[TRANSCRIPTION] Health check parado');
    }
  }

  /**
   * ✅ NOVO: Agenda reconexão com backoff exponencial
   */
  private scheduleReconnection(): void {
    // Limpar timer anterior
    this.clearReconnectionTimer();
    
    // Verificar limite de tentativas
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('[TRANSCRIPTION] ❌ Limite de tentativas de reconexão atingido');
      return;
    }
    
    this.reconnectionAttempts++;
    
    // Backoff exponencial: 2s, 4s, 8s, 16s... (máx 30s)
    const delay = Math.min(2000 * Math.pow(2, this.reconnectionAttempts - 1), 30000);
    
    console.log(`[TRANSCRIPTION] 🔄 Agendando reconexão #${this.reconnectionAttempts} em ${delay/1000}s...`);
    
    this.reconnectionTimer = setTimeout(async () => {
      console.log(`[TRANSCRIPTION] 🔄 Tentativa de reconexão #${this.reconnectionAttempts}...`);
      
      try {
        const success = await this.reconnect();
        
        if (success) {
          console.log('[TRANSCRIPTION] ✅ Reconexão bem-sucedida!');
          this.reconnectionAttempts = 0;
        } else {
          console.warn('[TRANSCRIPTION] ⚠️ Reconexão falhou, tentando novamente...');
          this.scheduleReconnection();
        }
      } catch (error) {
        console.error('[TRANSCRIPTION] ❌ Erro na reconexão:', error);
        this.scheduleReconnection();
      }
    }, delay);
  }

  /**
   * ✅ NOVO: Limpa timer de reconexão
   */
  private clearReconnectionTimer(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
  }

  // ✅ CORREÇÃO: Callback quando recebe nova transcrição (transcript puro)
  onTranscriptUpdate?: (transcript: string) => void;
  
  // ✅ NOVO: Callback para atualizar UI (texto completo formatado)
  onUIUpdate?: (fullText: string) => void;
}
