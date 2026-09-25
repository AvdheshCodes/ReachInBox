import { Router } from 'express';
import { googleLogin, getCurrentUser } from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/google', googleLogin);
router.get('/me', authenticateToken, getCurrentUser);

export default router;
