import { Router } from 'express';
import { scheduleEmails, getScheduledEmails, getSentEmails, getStats, previewEmail } from '../controllers/emailController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Public HTML preview route
router.get('/preview/:jobId', previewEmail);

// Protected routes
router.use(authenticateToken);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/stats', getStats);

export default router;
