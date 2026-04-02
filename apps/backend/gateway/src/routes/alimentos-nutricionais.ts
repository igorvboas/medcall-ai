import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { searchAlimentosNutricionais } from '../controllers/alimentosNutricionaisController';

const router = Router();

router.get('/', authenticateToken, searchAlimentosNutricionais);

export default router;
