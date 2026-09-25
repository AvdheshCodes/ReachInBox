import { Router } from 'express';
import { scheduleEmails, getScheduledEmails, getSentEmails, getStats } from '../controllers/emailController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/stats', getStats);

export default router;
