import { Router } from 'express';
import twilio from 'twilio';

const router = Router();

router.get('/turn-credentials', async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return res.status(500).json({ error: 'Twilio credentials not configured' });
    }

    const client = twilio(accountSid, authToken);
    // TTL aumentado de 1h (3600s) para 8h (28800s) para suportar consultas longas
    const token = await client.tokens.create({ ttl: 28800 });
    res.json({ iceServers: token.iceServers });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get TURN credentials' });
  }
});

export default router;

