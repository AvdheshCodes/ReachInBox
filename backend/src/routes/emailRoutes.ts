import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getStats,
  previewEmail,
  deleteScheduledEmail,
  deleteScheduledEmailsBatch,
} from '../controllers/emailController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Public HTML preview route
router.get('/preview/:jobId', previewEmail);

// Protected routes
router.use(authenticateToken);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.delete('/scheduled/batch', deleteScheduledEmailsBatch);
router.post('/scheduled/delete-batch', deleteScheduledEmailsBatch);
router.delete('/scheduled/:id', deleteScheduledEmail);
router.get('/sent', getSentEmails);
router.get('/stats', getStats);

export default router;

