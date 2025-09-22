import { Request, Response } from 'express';
import { transcriptionService } from '../services/transcriptionService';

export class TranscriptionController {
  /**
   * Iniciar transcrição para uma consulta
   */
  async startTranscription(req: Request, res: Response): Promise<void> {
    try {
      const { roomName, consultationId } = req.body;
      
      if (!roomName || !consultationId) {
        res.status(400).json({
          error: 'roomName and consultationId are required'
        });
        return;
      }

      await transcriptionService.startTranscription(roomName, consultationId);
      
      res.status(200).json({
        message: 'Transcription started successfully',
        roomName,
        consultationId
      });
      
    } catch (error) {
      console.error('Error starting transcription:', error);
      res.status(500).json({
        error: 'Failed to start transcription',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Parar transcrição para uma consulta
   */
  async stopTranscription(req: Request, res: Response): Promise<void> {
    try {
      const { roomName } = req.params;
      
      if (!roomName) {
        res.status(400).json({
          error: 'roomName is required'
        });
        return;
      }

      await transcriptionService.stopTranscription(roomName);
      
      res.status(200).json({
        message: 'Transcription stopped successfully',
        roomName
      });
      
    } catch (error) {
      console.error('Error stopping transcription:', error);
      res.status(500).json({
        error: 'Failed to stop transcription',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obter estatísticas de transcrição
   */
  async getTranscriptionStats(req: Request, res: Response): Promise<void> {
    try {
      const { roomName } = req.params;
      
      if (!roomName) {
        res.status(400).json({
          error: 'roomName is required'
        });
        return;
      }

      const stats = await transcriptionService.getTranscriptionStats(roomName);
      
      res.status(200).json({
        stats
      });
      
    } catch (error) {
      console.error('Error getting transcription stats:', error);
      res.status(500).json({
        error: 'Failed to get transcription stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Processar áudio via HTTP (fallback)
   */
  async processAudio(req: Request, res: Response): Promise<void> {
    try {
      const { roomName, participantId, audioData, sampleRate, channels } = req.body;
      
      if (!roomName || !participantId || !audioData) {
        res.status(400).json({
          error: 'roomName, participantId, and audioData are required'
        });
        return;
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      
      await transcriptionService.processAudioChunk({
        data: audioBuffer,
        participantId,
        sampleRate: sampleRate || 16000,
        channels: channels || 1
      }, roomName);
      
      res.status(200).json({
        message: 'Audio processed successfully'
      });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      res.status(500).json({
        error: 'Failed to process audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Buscar transcrições de uma consulta
   */
  async getTranscriptions(req: Request, res: Response): Promise<void> {
    try {
      const { consultationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      if (!consultationId) {
        res.status(400).json({
          error: 'consultationId is required'
        });
        return;
      }

      // Buscar transcrições no banco via Supabase
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from('utterances')
        .select('*')
        .eq('consultation_id', consultationId)
        .order('timestamp', { ascending: true })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        throw error;
      }
      
      res.status(200).json({
        transcriptions: data || [],
        total: data?.length || 0
      });
      
    } catch (error) {
      console.error('Error getting transcriptions:', error);
      res.status(500).json({
        error: 'Failed to get transcriptions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Criar instância única para exportar
export const transcriptionController = new TranscriptionController();