import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAdminDashboard } from '../controllers/adminController';
import { getDoctorTracking } from '../controllers/doctorTrackingController';

const router = Router();

/**
 * GET /admin/dashboard
 * Dashboard administrativo
 */
router.get('/dashboard', authenticateToken, getAdminDashboard);

/**
 * GET /admin/doctor-tracking
 * Acompanhamento do funil de médicos
 */
router.get('/doctor-tracking', authenticateToken, getDoctorTracking);

export default router;
