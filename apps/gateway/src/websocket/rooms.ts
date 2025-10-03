import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import WebSocket from 'ws';
import { db } from '../config/database';
import { suggestionService } from '../services/suggestionService';

// ==================== ESTRUTURAS DE DADOS ====================

// Mapa de salas: roomId -> roomData
const rooms = new Map();

// Mapa de usuário para sala ativa: userName -> roomId
const userToRoom = new Map();

// Mapa de socket para sala: socketId -> roomId
const socketToRoom = new Map();

// Mapa de conexões OpenAI: userName -> WebSocket
const openAIConnections = new Map();

// Mapa separado para timers (não serializar com room data)
const roomTimers = new Map(); // roomId -> Timeout

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Gera um roomId único
 */
function generateRoomId(): string {
  return 'room-' + crypto.randomBytes(6).toString('hex'); // Ex: room-a1b2c3d4e5f6
}

/**
 * Limpa sala expirada (5 minutos de inatividade)
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
  
  // Remover sala
  rooms.delete(roomId);
}

/**
 * Inicia timer de expiração de sala (5 minutos)
 */
function startRoomExpiration(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  // Limpar timer anterior do mapa separado
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
  }

  // Criar novo timer de 5 minutos e armazenar no mapa separado
  const timer = setTimeout(() => {
    cleanExpiredRoom(roomId);
  }, 5 * 60 * 1000); // 5 minutos

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
      const { hostName, roomName, patientId, patientName, patientEmail, patientPhone, userAuth } = data;
      
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
        callSessionId: null // Será preenchido após criar no banco
      };
      rooms.set(roomId, room);
      userToRoom.set(hostName, roomId);
      socketToRoom.set(socket.id, roomId);

      // Iniciar timer de expiração
      startRoomExpiration(roomId);

      // ✅ CRIAR CALL_SESSION NO BANCO DE DADOS
      try {
        const callSession = await db.createCallSession({
          livekit_room_id: roomId,
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
          console.log(`💾 Call session criada no banco: ${callSession.id}`);
          room.callSessionId = callSession.id; // Salvar referência
        } else {
          console.warn('⚠️ Falha ao criar call_session no banco (sala criada apenas em memória)');
        }
      } catch (error) {
        console.error('❌ Erro ao criar call_session:', error);
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
    
    socket.on('joinRoom', (data, callback) => {
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

      // Verificar se é reconexão do host
      if (participantName === room.hostUserName) {
        console.log(`🔄 Reconexão do host: ${participantName} na sala ${roomId}`);
        room.hostSocketId = socket.id;
        socketToRoom.set(socket.id, roomId);
        resetRoomExpiration(roomId);
        
        callback({ 
          success: true, 
          role: 'host',
          roomData: room
        });

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
          
          callback({ 
            success: true, 
            role: 'participant',
            roomData: room
          });
          return;
        }
        
        callback({ 
          success: false, 
          error: 'Você já está em outra sala ativa' 
        });
        return;
      }

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
      
      resetRoomExpiration(roomId);

      console.log(`✅ ${participantName} entrou na sala ${roomId}`);

      callback({ 
        success: true, 
        role: 'participant',
        roomData: room
      });

      // Notificar host que participante entrou
      io.to(room.hostSocketId).emit('participantJoined', {
        participantName: participantName
      });

      // Enviar oferta pendente se existir
      if (room.offer) {
        console.log(`📤 Enviando oferta pendente para ${participantName} na sala ${roomId}`);
        io.to(socket.id).emit('newOfferAwaiting', {
          roomId: roomId,
          offer: room.offer,
          offererUserName: room.hostUserName
        });
      }
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
      const roomId = socketToRoom.get(socket.id);
      
      if (!roomId) {
        callback({ success: false, error: 'Você não está em uma sala' });
        return;
      }

      console.log(`[${userName}] Solicitando conexão OpenAI na sala ${roomId}`);

      if (openAIConnections.has(userName)) {
        callback({ success: true, message: 'Já conectado' });
        return;
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        callback({ success: false, error: 'OpenAI API Key não configurada' });
        return;
      }

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

      openAIWs.on('error', (error) => {
        console.error(`[${userName}] ❌ Erro OpenAI:`, error.message);
        socket.emit('transcription:error', { error: error.message });
        callback({ success: false, error: error.message });
      });

      openAIWs.on('close', () => {
        console.log(`[${userName}] OpenAI WebSocket fechado`);
        openAIConnections.delete(userName);
        socket.emit('transcription:disconnected');
      });
    });

    socket.on('transcription:send', (data) => {
      const openAIWs = openAIConnections.get(userName);
      
      if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) {
        socket.emit('transcription:error', { error: 'Não conectado à OpenAI' });
        return;
      }
      openAIWs.send(data);
    });

    socket.on('transcription:disconnect', () => {
      const openAIWs = openAIConnections.get(userName);
      if (openAIWs) {
        openAIWs.close();
        openAIConnections.delete(userName);
      }
    });

    socket.on('sendTranscriptionToPeer', async (data) => {
      const { roomId, transcription, from, to } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.log(`❌ Transcrição rejeitada: sala ${roomId} não existe`);
        return;
      }

      // Salvar transcrição no histórico da sala
      room.transcriptions.push({
        speaker: from,
        text: transcription,
        timestamp: new Date().toISOString()
      });
      console.log('[DEBUG] [sendTranscriptionToPeer]')
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
        console.log(`🤖 [ROOM ${roomId}] Disparando análise de IA (${room.transcriptions.length} transcrições)`);
        
        try {
          // Calcular duração da sessão em minutos
          const sessionDuration = Math.floor((Date.now() - new Date(room.createdAt).getTime()) / (1000 * 60));
          
          // Preparar contexto para o suggestionService
          const context = {
            sessionId: room.callSessionId || roomId, // Usar callSessionId (UUID) se disponível
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

          // Gerar sugestões (executa em background)
          console.log(`🤖 [ROOM ${roomId}] Iniciando geração de sugestões com sessionId: ${context.sessionId}`);
          
          suggestionService.generateSuggestions(context).then(result => {
            console.log(`🤖 [ROOM ${roomId}] Resultado da IA:`, result ? `${result.suggestions.length} sugestões` : 'null');
            
            if (result && result.suggestions.length > 0) {
              console.log(`✅ [ROOM ${roomId}] ${result.suggestions.length} sugestões geradas`);
              
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
                console.log(`📤 [ROOM ${roomId}] Sugestões enviadas para o médico:`, suggestionData.suggestions.map(s => s.content.substring(0, 50) + '...'));
              } else {
                console.warn(`⚠️ [ROOM ${roomId}] Host socket não encontrado para enviar sugestões`);
              }
            } else {
              console.log(`📭 [ROOM ${roomId}] Nenhuma sugestão gerada ou resultado nulo`);
            }
          }).catch(error => {
            console.error(`❌ [ROOM ${roomId}] Erro ao gerar sugestões:`, error);
          });
          
        } catch (error) {
          console.error(`❌ [ROOM ${roomId}] Erro ao preparar contexto para IA:`, error);
        }
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
        callback({ success: false, error: 'Apenas o host pode finalizar a sala' });
        return;
      }

      console.log(`🏁 Finalizando sala ${roomId}...`);

      let saveResult: any = {
        transcriptionsCount: room.transcriptions.length,
        transcriptions: room.transcriptions
      };

      // ==================== SALVAR NO BANCO DE DADOS ====================
      try {
        // 1. Buscar doctor_id pelo userAuth
        let doctorId = null;
        if (room.userAuth) {
          const doctor = await db.getDoctorByAuth(room.userAuth);
          if (doctor) {
            doctorId = doctor.id;
            console.log(`👨‍⚕️ Médico encontrado: ${doctor.name} (${doctorId})`);
          } else {
            console.warn(`⚠️ Médico não encontrado para userAuth: ${room.userAuth}`);
          }
        }

        // 2. Criar CONSULTATION (se temos doctor_id e patientId)
        let consultationId = null;
        if (doctorId && room.patientId) {
          const consultation = await db.createConsultation({
            doctor_id: doctorId,
            patient_id: room.patientId,
            patient_name: room.patientName,
            consultation_type: 'TELEMEDICINA',
            status: 'COMPLETED',
            patient_context: `Consulta online via WebRTC - Sala: ${room.roomName}`
          });

          if (consultation) {
            consultationId = consultation.id;
            console.log(`📋 Consulta criada: ${consultationId}`);
            saveResult.consultationId = consultationId;
          } else {
            console.warn('⚠️ Falha ao criar consulta no banco');
          }
        } else {
          console.warn('⚠️ Consulta não criada - faltam doctor_id ou patientId');
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
            model_used: 'gpt-4o-realtime-preview-2024-12-17'
          });

          if (transcription) {
            console.log(`📝 Transcrição salva: ${transcription.id}`);
            saveResult.transcriptionId = transcription.id;
          } else {
            console.warn('⚠️ Falha ao salvar transcrição no banco');
          }
        }

        console.log(`✅ Dados salvos no banco de dados com sucesso`);
      } catch (error) {
        console.error('❌ Erro ao salvar no banco de dados:', error);
        saveResult.error = 'Erro ao salvar alguns dados no banco';
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

      socketToRoom.delete(socket.id);
    });
  });

  // console.log('✅ Handlers de salas WebSocket configurados');
}

// Exportar funções para uso em outras partes do sistema
export { rooms, userToRoom, socketToRoom, openAIConnections };
