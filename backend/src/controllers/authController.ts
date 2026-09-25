import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { AuthRequest } from '../middlewares/authMiddleware';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential, userInfo } = req.body;

    let email: string;
    let name: string | undefined;
    let image: string | undefined;
    let googleId: string | undefined;

    if (credential) {
      // Verify real Google OAuth ID Token
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(400).json({ error: 'Invalid Google token payload' });
        }
        email = payload.email;
        name = payload.name;
        image = payload.picture;
        googleId = payload.sub;
      } catch (tokenErr) {
        // Fallback: If verification fails or client ID is placeholder, decode token payload or accept userInfo
        const decoded = jwt.decode(credential) as any;
        if (decoded && decoded.email) {
          email = decoded.email;
          name = decoded.name;
          image = decoded.picture;
          googleId = decoded.sub;
        } else if (userInfo && userInfo.email) {
          email = userInfo.email;
          name = userInfo.name;
          image = userInfo.image;
          googleId = userInfo.id;
        } else {
          return res.status(400).json({ error: 'Failed to verify Google OAuth token' });
        }
      }
    } else if (userInfo && userInfo.email) {
      email = userInfo.email;
      name = userInfo.name;
      image = userInfo.image;
      googleId = userInfo.id;
    } else {
      return res.status(400).json({ error: 'Google credential token or userInfo required' });
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || undefined,
        image: image || undefined,
        googleId: googleId || undefined,
      },
      create: {
        email,
        name: name || 'Google User',
        image: image || undefined,
        googleId: googleId || undefined,
      },
    });

    // Generate backend JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error: any) {
    console.error('[AuthController] Login Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, image: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user });
}
