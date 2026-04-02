import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAdminDashboard } from '../controllers/adminController';
import { getDoctorTracking } from '../controllers/doctorTrackingController';
import { searchDoctors } from '../controllers/adminDoctorsController';

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

/**
 * GET /admin/doctors/search
 * Busca médicos por nome ou email (admin only)
 */
router.get('/doctors/search', authenticateToken, searchDoctors);

export default router;
