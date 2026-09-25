import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginWithGoogleBackend } from '@/lib/api';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: (process.env.GOOGLE_CLIENT_ID || 'dummy-client-id').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret').trim(),
    }),
    CredentialsProvider({
      id: 'demo-login',
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'user@reachinbox.ai' },
        name: { label: 'Name', type: 'text', placeholder: 'Outreach Manager' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        return {
          id: 'user-' + Date.now(),
          email: credentials.email,
          name: credentials.name || 'Demo User',
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(credentials.email)}`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.user = user;
      }
      if (!token.backendToken && (user || token.email)) {
        try {
          const userInfo = user || { email: token.email, name: token.name, image: (token as any).picture };
          const backendRes = await loginWithGoogleBackend(account?.id_token, userInfo);
          if (backendRes?.token) {
            token.backendToken = backendRes.token;
          }
        } catch (err) {
          console.error('Failed syncing Auth with backend:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user as any;
      }
      (session as any).backendToken = token.backendToken;
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'reachinbox_nextauth_secret_key_12345',
};
