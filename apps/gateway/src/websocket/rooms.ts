import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import WebSocket from 'ws';
import { db, logError, logWarning } from '../config/database';
import { suggestionService } from '../services/suggestionService';
import { aiPricingService } from '../services/aiPricingService';

// ==================== ESTRUTURAS DE DADOS ====================

// Mapa de salas: roomId -> roomData
const rooms = new Map();

// Mapa de usuário para sala ativa: userName -> roomId
const userToRoom = new Map();

// Mapa de socket para sala: socketId -> roomId
const socketToRoom = new Map();

// Mapa de conexões OpenAI: userName -> WebSocket
const openAIConnections = new Map();

// Mapa de keepalive timers para conexões OpenAI: userName -> Interval
const openAIKeepaliveTimers = new Map();

// 📊 Mapa para rastrear tempo de uso da Realtime API: userName -> { startTime, roomId }
const openAIUsageTracker = new Map<string, { startTime: number; roomId: string }>();

// Mapa separado para timers (não serializar com room data)
const roomTimers = new Map(); // roomId -> Timeout

// ✅ NOVO: Mapa para timers de duração de chamada
const callTimers = new Map(); // roomId -> Interval
const callStartTimes = new Map(); // roomId -> timestamp (em segundos)

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Gera um roomId único
 */
function generateRoomId(): string {
  return 'room-' + crypto.randomBytes(6).toString('hex'); // Ex: room-a1b2c3d4e5f6
}

/**
 * ✅ NOVO: Inicia o timer da chamada
 */
function startCallTimer(roomId: string, io: SocketIOServer): void {
  // Se já existe timer, não criar outro
  if (callTimers.has(roomId)) {
    return;
  }

  const startTime = Math.floor(Date.now() / 1000); // timestamp em segundos
  callStartTimes.set(roomId, startTime);

  // Emitir atualização a cada segundo
  const timer = setInterval(() => {
    const currentTime = Math.floor(Date.now() / 1000);
    const duration = currentTime - startTime;
    
    // Emitir para todos na sala
    const room = rooms.get(roomId);
    if (room) {
      // Emitir para host se estiver conectado
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('callTimerUpdate', { duration });
      }
      // Emitir para participante se estiver conectado
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('callTimerUpdate', { duration });
      }
      // Também emitir para a sala inteira (backup)
      io.to(roomId).emit('callTimerUpdate', { duration });
    }
  }, 1000);

  callTimers.set(roomId, timer);
}

/**
 * ✅ NOVO: Para o timer da chamada
 */
function stopCallTimer(roomId: string): void {
  const timer = callTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    callTimers.delete(roomId);
    callStartTimes.delete(roomId);
  }
}

/**
 * ✅ NOVO: Obtém a duração atual da chamada
 */
function getCallDuration(roomId: string): number {
  const startTime = callStartTimes.get(roomId);
  if (!startTime) return 0;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - startTime;
}

/**
 * Limpa sala expirada (3min vazia, 15min com 1 pessoa)
 */
function cleanExpiredRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  console.log(`🧹 Limpando sala expirada: ${roomId}`);
  
  // Remover usuários do mapeamento
  if (room.hostUserName) userToRoom.delete(room.hostUserName);
  if (room.participantUserName) userToRoom.delete(room.participantUserName);
  
  // Limpar timer do mapa separado
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }
  
  // ✅ NOVO: Parar timer da chamada
  stopCallTimer(roomId);
  
  // Remover sala
  rooms.delete(roomId);
}

/**
 * Inicia timer de expiração de sala (lógica inteligente baseada em histórico)
 */
function startRoomExpiration(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  // Limpar timer anterior do mapa separado
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
  }

  // Contar quantas pessoas estão conectadas
  const hasHost = room.hostSocketId !== null;
  const hasParticipant = room.participantSocketId !== null;
  const connectedCount = (hasHost ? 1 : 0) + (hasParticipant ? 1 : 0);

  // Verificar se sala já esteve ativa (teve 2 pessoas alguma vez)
  const wasActive = room.status === 'active'; // Status muda para 'active' quando 2ª pessoa entra

  let timeoutMinutes: number;
  
  if (connectedCount === 0) {
    if (wasActive) {
      // Sala estava ATIVA mas ambos desconectaram: 30 minutos para reconexão
      timeoutMinutes = 30;
      console.log(`⏱️ Timer iniciado para sala ATIVA (0 conectados) ${roomId}: ${timeoutMinutes} minutos (reconexão)`);
    } else {
      // Sala NUNCA ficou ativa (waiting): 3 minutos
      timeoutMinutes = 3;
      console.log(`⏱️ Timer iniciado para sala VAZIA (nunca ativa) ${roomId}: ${timeoutMinutes} minutos`);
    }
  } else if (connectedCount === 1) {
    if (wasActive) {
      // Sala estava ATIVA, 1 pessoa desconectou: 30 minutos para reconexão
      timeoutMinutes = 30;
      console.log(`⏱️ Timer iniciado para sala ATIVA (1 conectado) ${roomId}: ${timeoutMinutes} minutos (reconexão)`);
    } else {
      // Sala aguardando 2ª pessoa pela primeira vez: 15 minutos
      timeoutMinutes = 15;
      console.log(`⏱️ Timer iniciado para sala AGUARDANDO 2ª pessoa ${roomId}: ${timeoutMinutes} minutos`);
    }
  } else {
    // Sala ATIVA (2 pessoas): SEM timer automático
    console.log(`✅ Sala ATIVA ${roomId}: timer desabilitado (2 pessoas conectadas)`);
    return; // Não criar timer quando ambos estão conectados
  }

  const timer = setTimeout(() => {
    cleanExpiredRoom(roomId);
  }, timeoutMinutes * 60 * 1000);

  roomTimers.set(roomId, timer);
}

/**
 * Reseta timer de expiração (chamado em atividade)
 */
function resetRoomExpiration(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.lastActivity = new Date().toISOString();
  startRoomExpiration(roomId); // Reinicia o timer
}

/**
 * Calcula duração em segundos entre dois timestamps
 */
function calculateDuration(startTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date().getTime();
  return Math.floor((end - start) / 1000); // retorna em segundos
}

// ==================== SOCKET.IO HANDLERS ====================

export function setupRoomsWebSocket(io: SocketIOServer): void {
  io.on('connection', (socket) => {

    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== "x") {
      socket.disconnect(true);
      return;
    }

    console.log(`[${userName}] conectado - Socket: ${socket.id}`);

    // ==================== CRIAR SALA ====================
    
    socket.on('createRoom', async (data, callback) => {
      const { hostName, roomName, patientId, patientName, patientEmail, patientPhone, userAuth, consultationType } = data;
      
      // Verificar se usuário já está em outra sala
      if (userToRoom.has(hostName)) {
        const existingRoom = userToRoom.get(hostName);
        callback({ 
          success: false, 
          error: 'Você já está em outra sala ativa',
          existingRoomId: existingRoom
        });
        return;
      }

      const roomId = generateRoomId();
      
      // Criar sala
      const room: any = {
        roomId: roomId,
        roomName: roomName || 'Sala sem nome',
        hostUserName: hostName,
        hostSocketId: socket.id,
        participantUserName: null,
        participantSocketId: null,
        status: 'waiting', // waiting | active | ended
        offer: null,
        answer: null,
        offerIceCandidates: [],
        answererIceCandidates: [],
        transcriptions: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        // Dados médicos integrados
        patientId: patientId,
        patientName: patientName,
        patientEmail: patientEmail,
        patientPhone: patientPhone,
        userAuth: userAuth, // ID do user autenticado (Supabase Auth)
        callSessionId: null, // Será preenchido após criar no banco
        doctorName: null // ✅ Nome do médico (será preenchido quando buscar dados do médico)
      };
      rooms.set(roomId, room);
      userToRoom.set(hostName, roomId);
      socketToRoom.set(socket.id, roomId);

      // Iniciar timer de expiração
      startRoomExpiration(roomId);

      // ✅ CRIAR CALL_SESSION NO BANCO DE DADOS
      let consultationId = null;
      try {
        const callSession = await db.createCallSession({
          room_id: roomId,
          room_name: roomName || 'Sala sem nome',
          session_type: 'online',
          participants: {
            host: hostName,
            patient: patientName,
            patientId: patientId
          },
          metadata: {
            patientEmail: patientEmail,
            patientPhone: patientPhone,
            userAuth: userAuth
          }
        });

        if (callSession) {
          console.log(`✅ [CALL_SESSION] Criada no banco: ${callSession.id} para sala ${roomId}`);
          room.callSessionId = callSession.id; // Salvar referência
          console.log(`✅ [CALL_SESSION] callSessionId salvo na room: ${room.callSessionId}`);
        } else {
          console.error(`❌ [CALL_SESSION] Falha ao criar call_session no banco para sala ${roomId} (sala criada apenas em memória)`);
          console.error(`❌ [CALL_SESSION] Isso impedirá o salvamento de transcrições!`);
          logError(
            `Falha ao criar call_session no banco - transcrições não serão salvas`,
            'error',
            null,
            { roomId, hostName, patientId, patientName }
          );
        }

        // ✅ CRIAR CONSULTA COM STATUS RECORDING QUANDO A SALA É CRIADA
        // ✅ Também salvar nome do médico na room para uso posterior
        let doctorName = hostName; // Fallback para hostName
        if (userAuth && patientId) {
          try {
            const doctor = await db.getDoctorByAuth(userAuth);
            
            if (doctor && doctor.id) {
              // ✅ Salvar nome do médico (pode estar em 'name', 'nome', 'full_name', etc.)
              doctorName = doctor.name || doctor.nome || doctor.full_name || doctor.nome_completo || hostName;
              room.doctorName = doctorName; // Salvar na room para uso posterior
              
              // ✅ Salvar nome do médico também na call_sessions metadata
              if (callSession && callSession.id) {
                const currentMetadata = callSession.metadata || {};
                await db.updateCallSession(roomId, {
                  metadata: {
                    ...currentMetadata,
                    doctorName: doctorName
                  }
                });
              }
              
              const consultationTypeValue = consultationType === 'presencial' ? 'PRESENCIAL' : 'TELEMEDICINA';
              
              const consultation = await db.createConsultation({
                doctor_id: doctor.id,
                patient_id: patientId,
                patient_name: patientName,
                consultation_type: consultationTypeValue,
                status: 'RECORDING',
                patient_context: `Consulta ${consultationTypeValue.toLowerCase()} - Sala: ${roomName || 'Sala sem nome'}`
              });

              if (consultation) {
                consultationId = consultation.id;
                room.consultationId = consultationId;
                
                if (callSession && callSession.id) {
                  await db.updateCallSession(roomId, {
                    consultation_id: consultationId
                  });
                }
              }
            }
          } catch (consultationError) {
            console.error('❌ Erro ao criar consulta:', consultationError);
            logError(
              `Erro ao criar consulta ao criar sala`,
              'error',
              null,
              { roomId, hostName, patientId, patientName, error: consultationError instanceof Error ? consultationError.message : String(consultationError) }
            );
          }
        }
      } catch (error) {
        console.error('❌ Erro ao criar call_session:', error);
        logError(
          `Exceção ao criar call_session`,
          'error',
          null,
          { roomId, hostName, error: error instanceof Error ? error.message : String(error) }
        );
        // Continuar mesmo se falhar (sala funciona em memória)
      }

      console.log(`✅ Sala criada: ${roomId} por ${hostName}`);

      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

      callback({ 
        success: true, 
        roomId: roomId,
        roomUrl: `${FRONTEND_URL}/consulta/online/patient?roomId=${roomId}`
      });
    });
    
    // ==================== ENTRAR EM SALA ====================
    
    socket.on('joinRoom', async (data, callback) => {
      const { roomId, participantName } = data;
      
      const room = rooms.get(roomId);
      
      // Verificar se sala existe
      if (!room) {
        callback({ 
          success: false, 
          error: 'Sala não encontrada ou expirada' 
        });
        return;
      }

      // Verificar se é host pela role (independente do nome) ou reconexão por nome igual
      const requesterRole = (socket.handshake && socket.handshake.auth && socket.handshake.auth.role) || null;
      const isHostByRole = requesterRole === 'host' || requesterRole === 'doctor';

      if (isHostByRole || participantName === room.hostUserName) {
        console.log(`🔄 Reconexão do host: ${participantName} na sala ${roomId}`);
        room.hostSocketId = socket.id;
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId); // ✅ NOVO: Entrar na sala do Socket.IO
        resetRoomExpiration(roomId);
        
      // ✅ NOVO: Buscar transcrições do banco de dados
      let transcriptionHistory: any[] = room.transcriptions || [];
      if (room.callSessionId) {
        try {
          const { db } = await import('../config/database');
          const dbUtterances = await db.getSessionUtterances(room.callSessionId);
          
          if (dbUtterances && dbUtterances.length > 0) {
            // ✅ CORREÇÃO: Fazer parse do JSON e extrair cada conversa individualmente
            const parsedTranscriptions: any[] = [];
            
            for (const u of dbUtterances) {
              try {
                const parsed = JSON.parse(u.text);
                if (Array.isArray(parsed)) {
                  // Array de conversas - adicionar cada uma individualmente
                  for (const conv of parsed) {
                    parsedTranscriptions.push({
                      speaker: conv.speaker === 'doctor' 
                        ? room.hostUserName 
                        : room.participantUserName || 'Paciente',
                      text: conv.text,
                      timestamp: u.created_at
                    });
                  }
                } else {
                  // Fallback: texto simples (não é array)
                  parsedTranscriptions.push({
                    speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                    text: u.text,
                    timestamp: u.created_at
                  });
                }
              } catch {
                // Não é JSON válido - usar como texto simples
                parsedTranscriptions.push({
                  speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                  text: u.text,
                  timestamp: u.created_at
                });
              }
            }
            
            transcriptionHistory = parsedTranscriptions;
            
            // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
            const memoryTranscriptions = room.transcriptions || [];
            const dbTexts = new Set(transcriptionHistory.map((t: any) => t.text));
            const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTexts.has(t.text));
            transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];
            
            console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (host)`);
          }
        } catch (error) {
          console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
          // Logar erro no banco
          logError(
            `Erro ao buscar transcrições do banco para host`,
            'error',
            room.consultationId || null,
            { roomId, error: error instanceof Error ? error.message : String(error) }
          );
          // Usar apenas transcrições em memória se falhar
        }
      }
      
      // ✅ CORREÇÃO: Enviar transcrições históricas para reconexão
      const roomDataWithHistory = {
        ...room,
        // Enviar histórico de transcrições (do banco + memória)
        transcriptionHistory: transcriptionHistory,
        // ✅ NOVO: Enviar duração atual da chamada
        callDuration: getCallDuration(roomId)
      };
      
      callback({ 
        success: true, 
        role: 'host',
        roomData: roomDataWithHistory
      });

      // ✅ NOVO: Enviar duração atual imediatamente
      socket.emit('callTimerUpdate', { duration: getCallDuration(roomId) });

      // Se já tem participante E já tem oferta, reenviar para o participante
      if (room.participantSocketId && room.offer) {
        console.log(`🔄 Reenviando oferta para participante após reconexão do host`);
        io.to(room.participantSocketId).emit('newOfferAwaiting', {
          roomId: roomId,
          offer: room.offer,
          offererUserName: room.hostUserName
        });
      }
      
      return;
      }

      // Verificar se usuário já está em outra sala
      if (userToRoom.has(participantName)) {
        const existingRoom = userToRoom.get(participantName);
        
        // Se é a mesma sala, é reconexão
        if (existingRoom === roomId) {
          console.log(`🔄 Reconexão do participante: ${participantName} na sala ${roomId}`);
          room.participantSocketId = socket.id;
          socketToRoom.set(socket.id, roomId);
          resetRoomExpiration(roomId);
          
          // ✅ NOVO: Buscar transcrições do banco de dados
          let transcriptionHistory: any[] = room.transcriptions || [];
          if (room.callSessionId) {
            try {
              const { db } = await import('../config/database');
              const dbUtterances = await db.getSessionUtterances(room.callSessionId);
              
              if (dbUtterances && dbUtterances.length > 0) {
                // ✅ CORREÇÃO: Fazer parse do JSON e extrair cada conversa individualmente
                const parsedTranscriptions: any[] = [];
                
                for (const u of dbUtterances) {
                  try {
                    const parsed = JSON.parse(u.text);
                    if (Array.isArray(parsed)) {
                      // Array de conversas - adicionar cada uma individualmente
                      for (const conv of parsed) {
                        parsedTranscriptions.push({
                          speaker: conv.speaker === 'doctor' 
                            ? room.hostUserName 
                            : room.participantUserName || 'Paciente',
                          text: conv.text,
                          timestamp: u.created_at
                        });
                      }
                    } else {
                      // Fallback: texto simples (não é array)
                      parsedTranscriptions.push({
                        speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                        text: u.text,
                        timestamp: u.created_at
                      });
                    }
                  } catch {
                    // Não é JSON válido - usar como texto simples
                    parsedTranscriptions.push({
                      speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                      text: u.text,
                      timestamp: u.created_at
                    });
                  }
                }
                
                transcriptionHistory = parsedTranscriptions;
                
                // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
                const memoryTranscriptions = room.transcriptions || [];
                const dbTexts = new Set(transcriptionHistory.map((t: any) => t.text));
                const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTexts.has(t.text));
                transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];
                
                console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (participant)`);
              }
            } catch (error) {
              console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
              // Logar erro no banco
              logError(
                `Erro ao buscar transcrições do banco para participante reconectando`,
                'error',
                room.consultationId || null,
                { roomId, error: error instanceof Error ? error.message : String(error) }
              );
            }
          }
          
          // ✅ CORREÇÃO: Enviar transcrições históricas para reconexão
          const roomDataWithHistory = {
            ...room,
            // Enviar histórico de transcrições (do banco + memória)
            transcriptionHistory: transcriptionHistory
          };
          
          callback({ 
            success: true, 
            role: 'participant',
            roomData: roomDataWithHistory
          });
          
          // ✅ NOVO: Se host está conectado, notificar para RECONECTAR WebRTC
          if (room.hostSocketId) {
            console.log(`🔔 Notificando host para RECONECTAR WebRTC (paciente ${participantName} reconectou)`);
            io.to(room.hostSocketId).emit('patient-entered-reconnect-webrtc', {
              roomId: roomId,
              participantName: participantName,
              isReconnection: true
            });
            
            // Manter o evento antigo para compatibilidade
            io.to(room.hostSocketId).emit('participantRejoined', {
              roomId: roomId,
              participantName: participantName
            });
          }
          
          return;
        }
        
        callback({ 
          success: false, 
          error: 'Você já está em outra sala ativa' 
        });
        return;
      }

      console.log("[DEBUG-IGOR] participantName", participantName)
      console.log("[DEBUG-IGOR] room.participantUserName", room.participantUserName)
      // Verificar se sala já tem participante
      if (room.participantUserName && room.participantUserName !== participantName) {
        callback({ 
          success: false, 
          error: 'Esta sala já está cheia' 
        });
        return;
      }

      // Adicionar participante à sala
      room.participantUserName = participantName;
      room.participantSocketId = socket.id;
      room.status = 'active';
      
      userToRoom.set(participantName, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId); // ✅ NOVO: Entrar na sala do Socket.IO
      
      resetRoomExpiration(roomId);

      // ✅ NOVO: Iniciar timer da chamada quando sala ficar ativa
      startCallTimer(roomId, io);

      console.log(`✅ ${participantName} entrou na sala ${roomId}`);

      // ✅ NOVO: Buscar transcrições do banco de dados
      let transcriptionHistory = room.transcriptions || [];
      if (room.callSessionId) {
        try {
          const { db } = await import('../config/database');
          const dbUtterances = await db.getSessionUtterances(room.callSessionId);
          
          if (dbUtterances && dbUtterances.length > 0) {
            // Converter utterances do banco para formato do frontend
            transcriptionHistory = dbUtterances.map((u: any) => ({
              speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
              text: u.text,
              timestamp: u.created_at || u.timestamp
            }));
            
            // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
            const memoryTranscriptions = room.transcriptions || [];
            const dbTimestamps = new Set(transcriptionHistory.map((t: any) => t.timestamp));
            const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTimestamps.has(t.timestamp));
            transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];
            
            console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (new participant)`);
          }
        } catch (error) {
          console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
          // Logar erro no banco
          logError(
            `Erro ao buscar transcrições do banco para novo participante`,
            'error',
            room.consultationId || null,
            { roomId, error: error instanceof Error ? error.message : String(error) }
          );
        }
      }
      
      // ✅ CORREÇÃO: Enviar transcrições históricas (caso seja reconexão ou sala já iniciada)
      const roomDataWithHistory = {
        ...room,
        // Enviar histórico de transcrições (do banco + memória)
        transcriptionHistory: transcriptionHistory,
        // ✅ NOVO: Enviar duração atual da chamada
        callDuration: getCallDuration(roomId)
      };

      callback({ 
        success: true, 
        role: 'participant',
        roomData: roomDataWithHistory
      });

      // ✅ NOVO: Enviar duração atual imediatamente
      socket.emit('callTimerUpdate', { duration: getCallDuration(roomId) });

      // Notificar host que participante entrou
      io.to(room.hostSocketId).emit('participantJoined', {
        participantName: participantName
      });

      // ✅ NOVO: Notificar host para RECONECTAR WebRTC quando paciente entrar
      console.log(`🔔 Notificando host para RECONECTAR WebRTC (paciente ${participantName} entrou)`);
      io.to(room.hostSocketId).emit('patient-entered-reconnect-webrtc', {
        roomId: roomId,
        participantName: participantName
      });

      // ✅ CORREÇÃO: NÃO enviar oferta pendente aqui pois o médico vai reconectar
      // e criar uma nova oferta automaticamente. Enviar oferta antiga causava
      // múltiplas offers simultâneas e loop de reconexões.
      // A oferta será gerada pelo evento 'patient-entered-reconnect-webrtc'
    });

    // ==================== WEBRTC COM ROOMS ====================
    
    socket.on('newOffer', (data) => {
      const { roomId, offer } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        console.log(`❌ Oferta rejeitada: sala ${roomId} não existe`);
        return;
      }

      // Salvar oferta APENAS nesta sala específica
      room.offer = offer;
      room.offererUserName = userName;
      resetRoomExpiration(roomId);

      console.log(`📤 Nova oferta salva na sala ${roomId}`);

      // Enviar oferta APENAS para o participante DESTA sala
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('newOfferAwaiting', {
          roomId: roomId,
          offer: offer,
          offererUserName: room.hostUserName
        });
        console.log(`📨 Oferta enviada para participante da sala ${roomId}`);
      } else {
        console.log(`📦 Oferta salva, aguardando participante entrar na sala ${roomId}`);
      }
    });

    socket.on('newAnswer', async (data, ackFunction) => {
      const { roomId, answer } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.log(`❌ Resposta rejeitada: sala ${roomId} não existe`);
        return;
      }

      room.answer = answer;
      room.answererUserName = userName;
      resetRoomExpiration(roomId);

      console.log(`📥 Nova resposta na sala ${roomId}`);

      // Enviar resposta para host
      io.to(room.hostSocketId).emit('answerResponse', {
        roomId: roomId,
        answer: answer,
        answererUserName: room.participantUserName
      });

      // Enviar ICE candidates do ofertante
      ackFunction(room.offerIceCandidates);
    });

    socket.on('sendIceCandidateToSignalingServer', (data) => {
      const { roomId, iceCandidate, didIOffer } = data;
      const room = rooms.get(roomId);

      if (!room) return;

      resetRoomExpiration(roomId);

      if (didIOffer) {
        // ICE do host
        room.offerIceCandidates.push(iceCandidate);
        
        if (room.participantSocketId && room.answererUserName) {
          io.to(room.participantSocketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
      } else {
        // ICE do participante
        room.answererIceCandidates.push(iceCandidate);
        
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
      }
    });

    // ==================== TRANSCRIÇÕES COM ROOMS ====================
    
    socket.on('transcription:connect', (data, callback) => {
      console.log(`🔍 [TRANSCRIPTION] Solicitação de conexão recebida de socket ${socket.id}`);
      
      const roomId = socketToRoom.get(socket.id);
      const userName = socket.handshake.auth.userName;
      
      console.log(`🔍 [TRANSCRIPTION] Room ID: ${roomId}, User: ${userName}`);
      
      if (!roomId) {
        console.error(`❌ [TRANSCRIPTION] Socket ${socket.id} não está em uma sala`);
        // Logar warning no banco (não é um erro crítico)
        logWarning(
          `Tentativa de conexão de transcrição sem estar em sala`,
          null,
          { socketId: socket.id, userName }
        );
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Você não está em uma sala. Entre em uma sala primeiro.' });
        }
        return;
      }

      console.log(`[${userName}] Solicitando conexão OpenAI na sala ${roomId}`);

      // ✅ CORREÇÃO: Se já existe uma conexão OpenAI ativa, reutilizar
      if (openAIConnections.has(userName)) {
        const existingWs = openAIConnections.get(userName);
        
        // Verificar se a conexão ainda está aberta
        if (existingWs && existingWs.readyState === WebSocket.OPEN) {
          console.log(`[${userName}] ✅ Reutilizando conexão OpenAI existente (reconexão)`);
          
          // Reconfigurar listeners para o novo socket
          existingWs.removeAllListeners('message');
          existingWs.removeAllListeners('error');
          existingWs.removeAllListeners('close');
          
          // Adicionar listeners para o socket atual
          existingWs.on('message', (data: any) => {
            const message = data.toString();        
            try {
              const parsed = JSON.parse(message);
              if (parsed.type === 'conversation.item.input_audio_transcription.completed') {
                console.log(`[${userName}] 📝 TRANSCRIÇÃO:`, parsed.transcript);
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
            socket.emit('transcription:message', message);
          });

          existingWs.on('error', (error: Error) => {
            console.error(`[${userName}] ❌ Erro OpenAI:`, error.message);
            socket.emit('transcription:error', { error: error.message });
          });

          existingWs.on('close', () => {
            console.log(`[${userName}] OpenAI WebSocket fechado`);
            openAIConnections.delete(userName);
            
            const keepaliveInterval = openAIKeepaliveTimers.get(userName);
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
              openAIKeepaliveTimers.delete(userName);
            }
            
            socket.emit('transcription:disconnected');
          });
          
          callback({ success: true, message: 'Conexão existente reutilizada' });
          return;
        } else {
          // Conexão antiga está fechada, remover e criar nova
          console.log(`[${userName}] ⚠️ Conexão OpenAI antiga fechada, criando nova...`);
          openAIConnections.delete(userName);
          const keepaliveInterval = openAIKeepaliveTimers.get(userName);
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            openAIKeepaliveTimers.delete(userName);
          }
        }
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        console.error('❌ [TRANSCRIPTION] OPENAI_API_KEY não configurada!');
        console.error('❌ [TRANSCRIPTION] Verifique as variáveis de ambiente no gateway');
        // Logar erro crítico de configuração
        const room = rooms.get(roomId);
        logError(
          `OPENAI_API_KEY não configurada no servidor`,
          'error',
          room?.consultationId || null,
          { roomId, userName }
        );
        callback({ success: false, error: 'OpenAI API Key não configurada no servidor' });
        return;
      }
      
      console.log(`🔗 [TRANSCRIPTION] Tentando conectar à OpenAI para ${userName} na sala ${roomId}`);

      const openAIWs = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        }
      );

      openAIWs.on('open', () => {
        console.log(`[${userName}] ✅ Conectado à OpenAI na sala ${roomId}`);
        openAIConnections.set(userName, openAIWs);
        
        // 📊 Iniciar tracking de uso da Realtime API
        openAIUsageTracker.set(userName, { 
          startTime: Date.now(), 
          roomId: roomId 
        });
        console.log(`📊 [AI_PRICING] Iniciando tracking Realtime API para ${userName}`);
        
        // ✅ Iniciar keepalive para manter conexão viva (ping a cada 5 minutos)
        const keepaliveInterval = setInterval(() => {
          if (openAIWs.readyState === WebSocket.OPEN) {
            // Enviar ping simples via mensagem vazia ou session.update
            try {
              openAIWs.send(JSON.stringify({
                type: 'session.update',
                session: {} // Atualização vazia apenas para keepalive
              }));
              console.log(`[${userName}] 💓 Keepalive enviado para OpenAI`);
            } catch (error) {
              console.error(`[${userName}] ❌ Erro ao enviar keepalive:`, error);
            }
          } else {
            // Se conexão está fechada, limpar interval
            clearInterval(keepaliveInterval);
            openAIKeepaliveTimers.delete(userName);
          }
        }, 5 * 60 * 1000); // 5 minutos
        
        openAIKeepaliveTimers.set(userName, keepaliveInterval);
        
        callback({ success: true, message: 'Conectado com sucesso' });
      });

      openAIWs.on('message', (data) => {
        const message = data.toString();        
        // Log específico para transcrições
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === 'conversation.item.input_audio_transcription.completed') {
            console.log(`[${userName}] 📝 TRANSCRIÇÃO:`, parsed.transcript);
          }
        } catch (e) {
          // Ignorar erros de parsing
        }
        socket.emit('transcription:message', data.toString());
      });

      openAIWs.on('error', (error: any) => {
        console.error(`❌ [TRANSCRIPTION] Erro OpenAI para ${userName}:`, error);
        console.error(`❌ [TRANSCRIPTION] Mensagem:`, error?.message || 'Erro desconhecido');
        console.error(`❌ [TRANSCRIPTION] Stack:`, error?.stack);
        // Logar erro de conexão OpenAI
        const room = rooms.get(roomId);
        logError(
          `Erro na conexão WebSocket com OpenAI Realtime API`,
          'error',
          room?.consultationId || null,
          { roomId, userName, errorMessage: error?.message || 'Erro desconhecido', errorStack: error?.stack }
        );
        socket.emit('transcription:error', { error: error?.message || 'Erro desconhecido ao conectar à OpenAI' });
        if (typeof callback === 'function') {
          callback({ success: false, error: error?.message || 'Erro desconhecido ao conectar à OpenAI' });
        }
      });

      openAIWs.on('close', async () => {
        console.log(`[${userName}] OpenAI WebSocket fechado`);
        openAIConnections.delete(userName);
        
        // 📊 Registrar uso da Realtime API
        const usageData = openAIUsageTracker.get(userName);
        if (usageData) {
          const durationMs = Date.now() - usageData.startTime;
          const room = rooms.get(usageData.roomId);
          
          // Prioridade: consultationId da room > buscar do banco pelo roomId
          let consultaId = room?.consultationId || null;
          
          // Se não encontrou na room, buscar do banco de dados
          if (!consultaId && usageData.roomId) {
            console.log(`🔍 [AI_PRICING] Buscando consultaId do banco para room ${usageData.roomId}...`);
            consultaId = await db.getConsultationIdByRoomId(usageData.roomId);
            
            // Atualizar a room em memória se encontrou
            if (consultaId && room) {
              room.consultationId = consultaId;
              console.log(`✅ [AI_PRICING] consultaId recuperado do banco: ${consultaId}`);
            }
          }
          
          if (!consultaId) {
            console.warn(`⚠️ [AI_PRICING] Não foi possível obter consultaId para room ${usageData.roomId}`);
          }
          
          await aiPricingService.logRealtimeUsage(durationMs, consultaId);
          console.log(`📊 [AI_PRICING] Realtime API encerrada: ${userName} - ${(durationMs / 60000).toFixed(2)} minutos - consultaId: ${consultaId}`);
          
          openAIUsageTracker.delete(userName);
        }
        
        // Limpar keepalive timer
        const keepaliveInterval = openAIKeepaliveTimers.get(userName);
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          openAIKeepaliveTimers.delete(userName);
        }
        
        socket.emit('transcription:disconnected');
      });
    });

    socket.on('transcription:send', (data) => {
      const openAIWs = openAIConnections.get(userName);
      
      if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) {
        // Logar warning de conexão não disponível
        const roomId = socketToRoom.get(socket.id);
        const room = roomId ? rooms.get(roomId) : null;
        logWarning(
          `Tentativa de enviar transcrição sem conexão OpenAI ativa`,
          room?.consultationId || null,
          { userName, roomId, wsReadyState: openAIWs?.readyState }
        );
        socket.emit('transcription:error', { error: 'Não conectado à OpenAI' });
        return;
      }
      openAIWs.send(data);
    });

    socket.on('transcription:disconnect', async () => {
      const openAIWs = openAIConnections.get(userName);
      if (openAIWs) {
        // 📊 Registrar uso da Realtime API antes de fechar
        const usageData = openAIUsageTracker.get(userName);
        if (usageData) {
          const durationMs = Date.now() - usageData.startTime;
          const room = rooms.get(usageData.roomId);
          
          // Prioridade: consultationId da room > buscar do banco pelo roomId
          let consultaId = room?.consultationId || null;
          
          // Se não encontrou na room, buscar do banco de dados
          if (!consultaId && usageData.roomId) {
            console.log(`🔍 [AI_PRICING] Buscando consultaId do banco para room ${usageData.roomId}...`);
            consultaId = await db.getConsultationIdByRoomId(usageData.roomId);
            
            // Atualizar a room em memória se encontrou
            if (consultaId && room) {
              room.consultationId = consultaId;
              console.log(`✅ [AI_PRICING] consultaId recuperado do banco: ${consultaId}`);
            }
          }
          
          if (!consultaId) {
            console.warn(`⚠️ [AI_PRICING] Não foi possível obter consultaId para room ${usageData.roomId}`);
          }
          
          await aiPricingService.logRealtimeUsage(durationMs, consultaId);
          console.log(`📊 [AI_PRICING] Realtime API desconectada: ${userName} - ${(durationMs / 60000).toFixed(2)} minutos - consultaId: ${consultaId}`);
          
          openAIUsageTracker.delete(userName);
        }
        
        openAIWs.close();
        openAIConnections.delete(userName);
      }
      
      // Limpar keepalive timer
      const keepaliveInterval = openAIKeepaliveTimers.get(userName);
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        openAIKeepaliveTimers.delete(userName);
      }
    });

    socket.on('sendTranscriptionToPeer', async (data) => {
      console.log(`📨 [RECEIVED] Evento sendTranscriptionToPeer recebido:`, {
        roomId: data.roomId,
        from: data.from,
        to: data.to,
        transcriptionLength: data.transcription?.length || 0,
        hasTranscription: !!data.transcription
      });
      
      const { roomId, transcription, from, to } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.error(`❌ [AUTO-SAVE] Transcrição rejeitada: sala ${roomId} não existe`);
        console.error(`❌ [AUTO-SAVE] Salas disponíveis:`, Array.from(rooms.keys()));
        // Logar warning - sala não encontrada
        logWarning(
          `Transcrição rejeitada: sala não existe`,
          null,
          { roomId, salasDisponiveis: Array.from(rooms.keys()), userName }
        );
        return;
      }
      
      //console.log(`✅ [AUTO-SAVE] Sala encontrada: ${roomId}`, {
      //  hasCallSessionId: !!room.callSessionId,
      //  callSessionId: room.callSessionId,
      //  hostUserName: room.hostUserName,
      //  participantUserName: room.participantUserName
      //});

      // Salvar transcrição no histórico da sala (memória)
      const transcriptionEntry = {
        speaker: from,
        text: transcription,
        timestamp: new Date().toISOString()
      };
      room.transcriptions.push(transcriptionEntry);
      console.log('[DEBUG] [sendTranscriptionToPeer]')
      
      // ✅ NOVO: Salvar transcrição em array único (atualizando o registro existente)
      //console.log(`🔍 [AUTO-SAVE] Verificando condições para salvar:`, {
      //  roomId: roomId,
      //  hasCallSessionId: !!room.callSessionId,
      //  callSessionId: room.callSessionId,
      //  from: from,
      //  transcriptionLength: transcription.length
      //});

      if (room.callSessionId) {
        try {
          const { db } = await import('../config/database');
          
          // ✅ CORREÇÃO: Usar socket.id para identificar quem é o médico (mais confiável que comparar nomes)
          const isDoctor = socket.id === room.hostSocketId;
          const speaker = isDoctor ? 'doctor' : 'patient';
          const speakerId = isDoctor 
            ? (room.doctorName || room.hostUserName) 
            : (room.participantUserName || room.patientName || 'Paciente');
          
          //console.log(`💾 [AUTO-SAVE] Tentando salvar transcrição:`, {
          //  sessionId: room.callSessionId,
          //  speaker: speaker,
          //  speakerId: speakerId,
          //  doctorName: room.doctorName || room.hostUserName,
          //  textLength: transcription.length,
          //  roomId: roomId,
          //  socketId: socket.id,
          //  hostSocketId: room.hostSocketId,
          //  isDoctor: isDoctor,
          //  environment: process.env.NODE_ENV
          //});
          
          // ✅ Salvar no array de conversas (atualiza o registro único)
          const success = await db.addTranscriptionToSession(room.callSessionId, {
            speaker: speaker,
            speaker_id: speakerId,
            text: transcription,
            confidence: 0.95,
            start_ms: Date.now(),
            end_ms: Date.now(),
            doctor_name: room.doctorName || room.hostUserName // ✅ Passar nome do médico
          });
          
          if (!success) {
            console.error(`❌ [AUTO-SAVE] Falha ao adicionar transcrição ao array`);
            console.error(`❌ [AUTO-SAVE] Session ID: ${room.callSessionId}`);
            console.error(`❌ [AUTO-SAVE] Room ID: ${roomId}`);
            console.error(`❌ [AUTO-SAVE] Verifique os logs anteriores para mais detalhes`);
            // Logar erro de salvamento de transcrição
            logError(
              `Falha ao adicionar transcrição ao array no banco`,
              'error',
              room.consultationId || null,
              { roomId, sessionId: room.callSessionId, speaker, textLength: transcription.length }
            );
          } else {
            console.log(`✅ [AUTO-SAVE] Transcrição salva com sucesso! Session: ${room.callSessionId}`);
          }
        } catch (error) {
          console.error(`❌ [AUTO-SAVE] Erro ao salvar transcrição no banco:`, error);
          if (error instanceof Error) {
            console.error(`❌ [AUTO-SAVE] Stack:`, error.stack);
          }
          // Logar erro de exceção ao salvar
          logError(
            `Erro ao salvar transcrição no banco`,
            'error',
            room.consultationId || null,
            { roomId, sessionId: room.callSessionId, error: error instanceof Error ? error.message : String(error) }
          );
          // Continuar mesmo se falhar (não bloquear transcrição)
        }
      } else {
        console.error(`❌ [AUTO-SAVE] callSessionId não disponível para sala ${roomId}, transcrição NÃO será salva no banco!`);
        console.error(`❌ [AUTO-SAVE] Room data:`, { 
          roomId, 
          hostUserName: room.hostUserName,
          participantUserName: room.participantUserName,
          patientName: room.patientName,
          hasCallSessionId: !!room.callSessionId,
          callSessionId: room.callSessionId
        });
        console.error(`❌ [AUTO-SAVE] Isso indica que a call_session não foi criada corretamente!`);
        // Logar warning - sessão não configurada corretamente
        logWarning(
          `callSessionId não disponível - transcrição não será salva no banco`,
          room.consultationId || null,
          { 
            roomId, 
            hostUserName: room.hostUserName,
            participantUserName: room.participantUserName,
            patientName: room.patientName
          }
        );
      }
      
      resetRoomExpiration(roomId);

      console.log(`[ROOM ${roomId}] ${from} -> ${to}: "${transcription}"`);

      // ✅ CORREÇÃO: Enviar para todos os participantes da sala
      const participants = [
        { socketId: room.hostSocketId, userName: room.hostUserName },
        { socketId: room.participantSocketId, userName: room.participantUserName }
      ].filter(p => p.socketId && p.userName); // Filtrar participantes válidos

      participants.forEach(participant => {
        if (participant.socketId !== socket.id) { // Não enviar para quem enviou
          io.to(participant.socketId).emit('receiveTranscriptionFromPeer', {
            roomId: roomId,
            transcription: transcription,
            from: from
          });
        }
      });
      
      console.log(`[ROOM ${roomId}] 📝 Transcrição "${transcription}" enviada para ${participants.length - 1} participantes`);

      // 🤖 GERAÇÃO DE SUGESTÕES DE IA
      // Disparar análise de IA a cada 5 transcrições
      if (room.transcriptions.length % 5 === 0 && room.transcriptions.length > 0) {
        //console.log(`🤖 [ROOM ${roomId}] Disparando análise de IA (${room.transcriptions.length} transcrições)`);
        
        // ✅ Usar IIFE async para resolver o consultationId corretamente antes de chamar o serviço
        (async () => {
          try {
            // Buscar consultationId correto (UUID) para vincular custos corretamente
            let consultationId = room.consultationId;
            // console.log(`🕵️ [DEBUG_ID] ID em memória para ${roomId}: ${consultationId}`);
            
            if (!consultationId) {
              // Tentar buscar do banco se não estiver na memória
              // console.log(`🕵️ [DEBUG_ID] Buscando ID no banco para ${roomId}...`);
              consultationId = await db.getConsultationIdByRoomId(roomId);
              // console.log(`🕵️ [DEBUG_ID] Resultado do banco para ${roomId}: ${consultationId}`);

              if (consultationId) {
                // Atualizar cache na room se ainda existir
                const currentRoom = rooms.get(roomId);
                if (currentRoom) {
                  currentRoom.consultationId = consultationId;
                }
              } else {
                console.warn(`⚠️ [AI_PRICING] Não foi possível encontrar consultation_id para sala ${roomId}. Usando fallback.`);
              }
            }

            // Calcular duração da sessão em minutos
            const sessionDuration = Math.floor((Date.now() - new Date(room.createdAt).getTime()) / (1000 * 60));
            
            // Preparar contexto para o suggestionService
            const context = {
              // ✅ Usar consultationId (UUID da tabela consultations) - NÃO usar callSessionId pois é de outra tabela!
              sessionId: consultationId || null, // Se não tiver consultationId, passar null para evitar ID errado
              patientName: room.patientName || room.participantUserName || 'Paciente',
              sessionDuration: sessionDuration,
              consultationType: 'online',
              utterances: room.transcriptions.map((t: any) => ({
                speaker: t.speaker === room.hostUserName ? 'doctor' : 'patient',
                text: t.text,
                timestamp: t.timestamp
              })),
              specialty: 'clinica_geral'
            };

            // Gerar sugestões
            const result = await suggestionService.generateSuggestions(context);
            
            //nsole.log(`🤖 [ROOM ${roomId}] Resultado da IA:`, result ? `${result.suggestions.length} sugestões` : 'null');
            
            if (result && result.suggestions.length > 0) {
              //console.log(`✅ [ROOM ${roomId}] ${result.suggestions.length} sugestões geradas`);
              
              // Enviar sugestões APENAS para o MÉDICO (host)
              if (room.hostSocketId) {
                const suggestionData = {
                  sessionId: roomId,
                  suggestions: result.suggestions,
                  context: result.context_analysis,
                  count: result.suggestions.length,
                  timestamp: new Date().toISOString()
                };
                
                io.to(room.hostSocketId).emit('ai:suggestions', suggestionData);
                //console.log(`📤 [ROOM ${roomId}] Sugestões enviadas para o médico:`, suggestionData.suggestions.map(s => s.content.substring(0, 50) + '...'));
              } else {
                console.warn(`⚠️ [ROOM ${roomId}] Host socket não encontrado para enviar sugestões`);
                logWarning(
                  `Host socket não encontrado para enviar sugestões de IA`,
                  room.consultationId || null,
                  { roomId, suggestionsCount: result.suggestions.length }
                );
              }
            } else {
              console.log(`📭 [ROOM ${roomId}] Nenhuma sugestão gerada ou resultado nulo`);
            }
          } catch (error) {
            console.error(`❌ [ROOM ${roomId}] Erro ao gerar sugestões:`, error);
            logError(
              `Erro ao gerar sugestões de IA`,
              'error',
              room.consultationId || null,
              { roomId, error: error instanceof Error ? error.message : String(error) }
            );
          }
        })();
      }
    });

    // ==================== FINALIZAR SALA ====================
    
    socket.on('endRoom', async (data, callback) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      // Verificar se quem está finalizando é o host
      if (socket.id !== room.hostSocketId) {
        const requester = (socket.handshake && socket.handshake.auth) || {};
        const requesterName = requester.userName || null;
        const requesterRole = requester.role || null;

        const isHostByIdentity = Boolean(requesterName && requesterName === room.hostUserName);
        const isHostByRole = requesterRole === 'host' || requesterRole === 'doctor';

        if (isHostByIdentity || isHostByRole) {
          console.log(`🔄 Reatando host ao novo socket para finalizar sala ${roomId}`);
          room.hostSocketId = socket.id;
        } else {
          callback({ success: false, error: 'Apenas o host pode finalizar a sala' });
          return;
        }
      }

      console.log(`🏁 Finalizando sala ${roomId}...`);

      let saveResult: any = {
        transcriptionsCount: room.transcriptions.length,
        transcriptions: room.transcriptions
      };

      // ==================== SALVAR NO BANCO DE DADOS ====================
      try {
        // 1. Buscar doctor_id pelo userAuth (se necessário para fallback)
        let doctorId = null;
        if (room.userAuth && !room.consultationId) {
          // Só buscar se não temos consultationId (para fallback)
          const doctor = await db.getDoctorByAuth(room.userAuth);
          if (doctor) {
            doctorId = doctor.id;
            console.log(`👨‍⚕️ Médico encontrado: ${doctor.name} (${doctorId})`);
          } else {
            console.warn(`⚠️ Médico não encontrado para userAuth: ${room.userAuth}`);
          }
        }

        // 2. Usar CONSULTATION existente ou criar se não existir
        let consultationId = room.consultationId || null;
        
        if (consultationId) {
          // ✅ Consulta já existe (foi criada quando a sala foi criada)
          // Atualizar status para PROCESSING e registrar fim da consulta
          try {
            const { supabase } = await import('../config/database');
            
            // ✅ Calcular duração em minutos (duracao é REAL no banco)
            const duracaoSegundos = calculateDuration(room.createdAt);
            const duracaoMinutos = duracaoSegundos / 60; // Converter para minutos
            const consultaFim = new Date().toISOString();
            
            const { error: updateError } = await supabase
              .from('consultations')
              .update({
                status: 'PROCESSING',
                consulta_fim: consultaFim, // ✅ Registrar fim da consulta
                duracao: duracaoMinutos, // ✅ Duração em minutos
                updated_at: consultaFim
              })
              .eq('id', consultationId);
            
            if (updateError) {
              console.error('❌ Erro ao atualizar status da consulta:', updateError);
              logError(
                `Erro ao atualizar status da consulta para PROCESSING`,
                'error',
                consultationId,
                { roomId, error: updateError.message }
              );
            } else {
              console.log(`📋 Consulta ${consultationId} atualizada para PROCESSING (duração: ${duracaoMinutos.toFixed(2)} min)`);
            }
          } catch (updateError) {
            console.error('❌ Erro ao atualizar consulta:', updateError);
            logError(
              `Exceção ao atualizar consulta`,
              'error',
              consultationId,
              { roomId, error: updateError instanceof Error ? updateError.message : String(updateError) }
            );
          }
        } else if (doctorId && room.patientId) {
          // ✅ Fallback: criar consulta se não foi criada antes (compatibilidade)
          console.warn('⚠️ Consulta não encontrada na room, criando nova...');
          const consultation = await db.createConsultation({
            doctor_id: doctorId,
            patient_id: room.patientId,
            patient_name: room.patientName,
            consultation_type: 'TELEMEDICINA',
            status: 'PROCESSING',
            patient_context: `Consulta online - Sala: ${room.roomName}`
          });

          if (consultation) {
            consultationId = consultation.id;
            console.log(`📋 Consulta criada (fallback): ${consultationId}`);
            saveResult.consultationId = consultationId;
            
            // ✅ Atualizar consulta_fim e duracao (já que a consulta foi criada no fim)
            try {
              const { supabase } = await import('../config/database');
              const duracaoSegundos = calculateDuration(room.createdAt);
              const duracaoMinutos = duracaoSegundos / 60;
              
              await supabase
                .from('consultations')
                .update({
                  consulta_fim: new Date().toISOString(),
                  duracao: duracaoMinutos
                })
                .eq('id', consultationId);
              
              console.log(`📋 Consulta ${consultationId} atualizada com duração: ${duracaoMinutos.toFixed(2)} min`);
            } catch (updateError) {
              console.error('❌ Erro ao atualizar duração da consulta fallback:', updateError);
              logError(
                `Erro ao atualizar duração da consulta fallback`,
                'error',
                consultationId,
                { roomId, error: updateError instanceof Error ? updateError.message : String(updateError) }
              );
            }
          } else {
            console.warn('⚠️ Falha ao criar consulta no banco');
            logError(
              `Falha ao criar consulta no banco (fallback)`,
              'error',
              null,
              { roomId, doctorId, patientId: room.patientId, patientName: room.patientName }
            );
          }
        } else {
          console.warn('⚠️ Consulta não criada/atualizada - faltam doctor_id ou patientId');
          logWarning(
            `Consulta não criada/atualizada - faltam doctor_id ou patientId`,
            null,
            { roomId, hasDoctorId: !!doctorId, hasPatientId: !!room.patientId }
          );
        }

        // 3. Atualizar CALL_SESSION com consultation_id
        if (room.callSessionId && consultationId) {
          const updated = await db.updateCallSession(roomId, {
            consultation_id: consultationId,
            status: 'ended',
            ended_at: new Date().toISOString(),
            metadata: {
              transcriptionsCount: room.transcriptions.length,
              duration: calculateDuration(room.createdAt),
              participantName: room.participantUserName
            }
          });

          if (updated) {
            console.log(`💾 Call session atualizada: ${room.callSessionId}`);
          }
        }

        // 4. Salvar TRANSCRIÇÕES (raw_text completo)
        if (consultationId && room.transcriptions.length > 0) {
          // Juntar todas as transcrições em um único texto
          const rawText = room.transcriptions
            .map((t: any) => `[${t.speaker}] (${t.timestamp}): ${t.text}`)
            .join('\n');

          const transcription = await db.saveConsultationTranscription({
            consultation_id: consultationId,
            raw_text: rawText,
            language: 'pt-BR',
            model_used: 'gpt-4o-mini'
          });

          if (transcription) {
            console.log(`📝 Transcrição salva: ${transcription.id}`);
            saveResult.transcriptionId = transcription.id;
          } else {
            console.warn('⚠️ Falha ao salvar transcrição no banco');
            logError(
              `Falha ao salvar transcrição completa no banco ao finalizar consulta`,
              'error',
              consultationId,
              { roomId, transcriptionsCount: room.transcriptions.length }
            );
          }
        }

        console.log(`✅ Dados salvos no banco de dados com sucesso`);
      } catch (error) {
        console.error('❌ Erro ao salvar no banco de dados:', error);
        saveResult.error = 'Erro ao salvar alguns dados no banco';
        logError(
          `Erro geral ao salvar dados no banco ao finalizar consulta`,
          'error',
          room.consultationId || null,
          { roomId, error: error instanceof Error ? error.message : String(error) }
        );
      }
      // ================================================================

      // Notificar participante que sala foi finalizada
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('roomEnded', {
          roomId: roomId,
          message: 'A sala foi finalizada pelo host'
        });
      }

      // Limpar timer do mapa separado
      if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }

      // Remover mapeamentos
      if (room.hostUserName) userToRoom.delete(room.hostUserName);
      if (room.participantUserName) userToRoom.delete(room.participantUserName);
      socketToRoom.delete(room.hostSocketId);
      if (room.participantSocketId) socketToRoom.delete(room.participantSocketId);

      // Remover sala
      rooms.delete(roomId);

      console.log(`✅ Sala ${roomId} finalizada`);

      callback({ 
        success: true, 
        message: 'Sala finalizada com sucesso',
        saveResult: saveResult
      });
    });

    // ==================== DESCONEXÃO ====================
    
    socket.on('disconnect', () => {
      console.log(`[${userName}] desconectado - Socket: ${socket.id}`);

      const roomId = socketToRoom.get(socket.id);
      
      if (roomId) {
        const room = rooms.get(roomId);
        
        if (room) {
          // Se host desconectou
          if (socket.id === room.hostSocketId) {
            console.log(`⚠️ Host desconectou da sala ${roomId}`);
            room.hostSocketId = null;
          }
          
          // Se participante desconectou
          if (socket.id === room.participantSocketId) {
            console.log(`⚠️ Participante desconectou da sala ${roomId}`);
            // Liberar vaga do participante para evitar sala ficar "cheia"
            if (room.participantUserName) {
              userToRoom.delete(room.participantUserName);
            }
            room.participantUserName = null;
            room.participantSocketId = null;
          }

          // Continuar com timer de expiração (permite reconexão)
          resetRoomExpiration(roomId);
        }
      }

      // Limpar conexão OpenAI
      const openAIWs = openAIConnections.get(userName);
      if (openAIWs) {
        // openAIWs.close();
        openAIConnections.delete(userName);
      }
      
      // Limpar keepalive timer
      const keepaliveInterval = openAIKeepaliveTimers.get(userName);
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        openAIKeepaliveTimers.delete(userName);
      }

      socketToRoom.delete(socket.id);
    });
  });

  // console.log('✅ Handlers de salas WebSocket configurados');
}

// Exportar funções e mapas para uso em outras partes do sistema
export { 
  rooms, 
  userToRoom, 
  socketToRoom, 
  openAIConnections
};
