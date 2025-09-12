import { Router } from 'express';
import { audioProcessor } from '@/services/audioProcessor';
import { asrService } from '@/services/asrService';

const router = Router();

// Middleware de desenvolvimento apenas
const isDevelopment = process.env.NODE_ENV === 'development';

router.use((req, res, next) => {
  if (!isDevelopment) {
    return res.status(404).json({ error: 'Debug endpoints only available in development' });
  }
  next();
});

// Controles do ASR
router.post('/asr/simulation/enable', (req, res) => {
  asrService.setSimulationEnabled(true);
  res.json({ 
    message: '🎭 Simulação de ASR habilitada',
    enabled: asrService.isSimulationEnabled()
  });
});

router.post('/asr/simulation/disable', (req, res) => {
  asrService.setSimulationEnabled(false);
  res.json({ 
    message: '🔇 Simulação de ASR desabilitada',
    enabled: asrService.isSimulationEnabled()
  });
});

router.get('/asr/status', (req, res) => {
  res.json({
    status: asrService.getStatus(),
    simulationEnabled: asrService.isSimulationEnabled()
  });
});

// Controles do Audio Processor
router.post('/audio/vad/:threshold', (req, res) => {
  const threshold = parseFloat(req.params.threshold);
  
  if (isNaN(threshold) || threshold < 0.001 || threshold > 1.0) {
    return res.status(400).json({ 
      error: 'Threshold deve ser um número entre 0.001 e 1.0' 
    });
  }
  
  audioProcessor.setVADThreshold(threshold);
  res.json({ 
    message: `🎛️ VAD Threshold definido para ${threshold}`,
    config: audioProcessor.getConfiguration()
  });
});

router.post('/audio/duration/:duration', (req, res) => {
  const duration = parseInt(req.params.duration);
  
  if (isNaN(duration) || duration < 100 || duration > 10000) {
    return res.status(400).json({ 
      error: 'Duração deve ser um número entre 100 e 10000 ms' 
    });
  }
  
  audioProcessor.setMinVoiceDuration(duration);
  res.json({ 
    message: `⏱️ Duração mínima definida para ${duration}ms`,
    config: audioProcessor.getConfiguration()
  });
});

router.post('/audio/silence/:threshold', (req, res) => {
  const threshold = parseInt(req.params.threshold);
  
  if (isNaN(threshold) || threshold < 500 || threshold > 10000) {
    return res.status(400).json({ 
      error: 'Threshold de silêncio deve ser um número entre 500 e 10000 ms' 
    });
  }
  
  audioProcessor.setSilenceThreshold(threshold);
  res.json({ 
    message: `🔇 Threshold de silêncio definido para ${threshold}ms`,
    config: audioProcessor.getConfiguration()
  });
});

router.get('/audio/stats', (req, res) => {
  res.json({
    stats: audioProcessor.getStats(),
    timestamp: new Date().toISOString()
  });
});

router.get('/audio/config', (req, res) => {
  res.json({
    audioProcessor: audioProcessor.getConfiguration(),
    asrService: {
      status: asrService.getStatus(),
      simulationEnabled: asrService.isSimulationEnabled()
    },
    timestamp: new Date().toISOString()
  });
});

// Reset completo do sistema
router.post('/reset', (req, res) => {
  // Limpar todos os buffers
  audioProcessor.clearAllSessions();
  
  // Resetar configurações para padrão
  audioProcessor.setVADThreshold(0.08);
  audioProcessor.setMinVoiceDuration(500);
  audioProcessor.setSilenceThreshold(1500);
  
  // Desabilitar simulação
  asrService.setSimulationEnabled(false);
  
  res.json({
    message: '🔄 Sistema resetado para configurações padrão',
    config: {
      audioProcessor: audioProcessor.getConfiguration(),
      asrSimulation: asrService.isSimulationEnabled()
    }
  });
});

export default router;
