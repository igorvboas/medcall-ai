import express from 'express';
import { Request, Response } from 'express';

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

    // TODO: Buscar dados da sala no sistema de salas
    res.json({
      success: true,
      roomId: roomId,
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

export default router;
