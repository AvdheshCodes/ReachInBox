'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  return (
    <main className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">R</div>
          <span className="login-logo-text">ReachInbox</span>
        </div>

        <p className="login-title">Email Scheduler Operations Dashboard</p>

        {/* Session Check */}
        {status === 'loading' && (
          <div className="login-session-check">
            <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
            <span>Checking active session...</span>
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="btn-google"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign in with Google</span>
        </button>

        {/* Divider */}
        <div className="login-divider">
          <div className="login-divider-line"></div>
          <span className="login-divider-text">Or Quick Demo</span>
          <div className="login-divider-line"></div>
        </div>

        {/* Demo Login */}
        <button
          onClick={() =>
            signIn('demo-login', {
              email: 'admin@reachinbox.ai',
              name: 'Outreach Admin',
              callbackUrl: '/dashboard',
            })
          }
          className="btn-demo"
        >
          Enter Dashboard (Instant Demo)
        </button>

        {/* Footer */}
        <div className="login-footer">
          ReachInbox Hiring Assignment &bull; Full-stack Email Job Scheduler
        </div>
      </div>
    </main>
  );
}
