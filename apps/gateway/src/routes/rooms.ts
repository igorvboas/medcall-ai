import express from 'express';
import { Request, Response } from 'express';
import { rooms } from '../websocket/rooms';

const router = express.Router();

// Health check para rotas de salas
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'rooms-api',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para criar sala (usado pelo frontend React)
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { hostName, roomName, patientId, patientName, patientEmail, patientPhone } = req.body;

    if (!hostName || !roomName) {
      return res.status(400).json({
        success: false,
        error: 'Nome do host e nome da sala são obrigatórios'
      });
    }

    // TODO: Integrar com sistema de salas via Socket.IO
    // Por enquanto, retornar sucesso para integração
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      roomId: roomId,
      roomName: roomName,
      hostName: hostName,
      patientId: patientId,
      patientName: patientName,
      message: 'Sala criada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint para obter informações da sala
router.get('/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // Buscar sala no mapa de salas
    const room = rooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou expirada'
      });
    }

    res.json({
      success: true,
      roomId: roomId,
      roomData: {
        roomName: room.roomName,
        status: room.status,
        createdAt: room.createdAt,
        hostUserName: room.hostUserName,
        participantUserName: room.participantUserName,
        transcriptionsCount: room.transcriptions?.length || 0
      },
      message: 'Informações da sala obtidas'
    });

  } catch (error) {
    console.error('Erro ao obter sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ✅ NOVO: Endpoint para recuperar histórico de transcrições de uma sala
router.get('/:roomId/transcriptions', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    console.log(`📝 [API] Solicitação de histórico de transcrições para sala: ${roomId}`);

    // Buscar sala no mapa de salas
    const room = rooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou expirada'
      });
    }

    // Retornar histórico de transcrições
    res.json({
      success: true,
      roomId: roomId,
      transcriptions: room.transcriptions || [],
      count: room.transcriptions?.length || 0,
      roomStatus: room.status
    });

    console.log(`✅ [API] Retornado ${room.transcriptions?.length || 0} transcrições para sala ${roomId}`);

  } catch (error) {
    console.error('❌ [API] Erro ao obter transcrições da sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
