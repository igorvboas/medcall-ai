import { Router } from 'express';
import { livekitTranscriberAgent } from '../services/livekitTranscriberAgent';

const router = Router();

router.post('/start', async (req, res) => {
  try {
    const roomName = (req.query.room as string) || (req.body?.room as string);
    if (!roomName) return res.status(400).json({ error: 'room is required' });
    await livekitTranscriberAgent.start(roomName);
    res.json({ ok: true, room: roomName, active: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to start' });
  }
});

router.post('/stop', async (req, res) => {
  try {
    const roomName = (req.query.room as string) || (req.body?.room as string);
    if (!roomName) return res.status(400).json({ error: 'room is required' });
    await livekitTranscriberAgent.stop(roomName);
    res.json({ ok: true, room: roomName, active: false });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to stop' });
  }
});

router.get('/status', (req, res) => {
  const roomName = (req.query.room as string) || '';
  res.json({ room: roomName, active: roomName ? livekitTranscriberAgent.isActive(roomName) : false });
});

export default router;


